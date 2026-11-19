// Genera la lettera con nome con OpenSCAD (build WebAssembly ufficiale per Node).
//
//   GET /api/lettera?p=<parametri>                      anteprima colorata (pubblica, in cache)
//   GET /api/lettera?p=<parametri>&parte=gruppo_lettera  pezzi da stampare (solo admin)
//
// Il sorgente del modello resta sul server: al browser arriva solo la mesh.
// I parametri sono quelli di LetteraCore.computeModel(), codificati con encodeParams().

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import "../../js/lettera-core.js";

const Core = globalThis.LetteraCore;

const PUBLIC_PARTS = new Set(["anteprima"]);
const ADMIN_PARTS = new Set([
  "gruppo_lettera",
  "gruppo_nome",
  "gruppo_base",
  "gruppo_personaggio",
  "lettera",
  "decorazioni",
  "nome",
  "base",
  "logo",
  "personaggio",
  "personaggio_dettagli",
  "personaggio_cuore",
  "personaggio_occhi"
]);
const FORMATS = { "3mf": "model/3mf", stl: "model/stl" };
const RENDER_TIMEOUT_MS = 20000;

function findRoot() {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [process.env.LAMBDA_TASK_ROOT, process.cwd(), here, join(here, ".."), join(here, "..", "..")];
  for (const candidate of candidates) {
    if (candidate && existsSync(join(candidate, "modello", "lettera-nome.scad"))) return candidate;
  }
  throw new Error("Modello non trovato nel pacchetto della funzione.");
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

function runOpenScad(root, args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [join(root, "vendor", "openscad-node", "openscad.cjs"), ...args], {
      cwd,
      stdio: ["ignore", "ignore", "pipe"]
    });
    let log = "";
    child.stderr.on("data", (chunk) => {
      if (log.length < 20000) log += chunk.toString();
    });
    const timer = setTimeout(() => child.kill("SIGKILL"), RENDER_TIMEOUT_MS);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, log });
    });
  });
}

// L'utente deve essere loggato e presente in admin_users (stesse regole del pannello).
async function isAdmin(request) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const supabaseUrl = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = String(process.env.SUPABASE_PUBLISHABLE_KEY || "");
  if (!token || !supabaseUrl || !key) return false;

  const headers = { apikey: key, Authorization: `Bearer ${token}` };
  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers });
  if (!userResponse.ok) return false;
  const user = await userResponse.json();
  if (!user || typeof user.id !== "string") return false;

  const adminResponse = await fetch(
    `${supabaseUrl}/rest/v1/admin_users?select=user_id&user_id=eq.${encodeURIComponent(user.id)}`,
    { headers }
  );
  if (!adminResponse.ok) return false;
  const rows = await adminResponse.json();
  return Array.isArray(rows) && rows.length === 1;
}

export default async function handler(request) {
  if (request.method !== "GET") return jsonResponse(405, { error: "Metodo non consentito." });

  const url = new URL(request.url);
  const part = url.searchParams.get("parte") || "anteprima";
  const format = url.searchParams.get("formato") || "3mf";

  if (!PUBLIC_PARTS.has(part) && !ADMIN_PARTS.has(part)) return jsonResponse(400, { error: "Parte sconosciuta." });
  if (!FORMATS[format]) return jsonResponse(400, { error: "Formato non supportato." });

  const params = Core.validateParams(Core.decodeParams(url.searchParams.get("p") || ""));
  if (!params) return jsonResponse(400, { error: "Parametri non validi." });

  const forPrinting = ADMIN_PARTS.has(part);
  if (forPrinting && !(await isAdmin(request))) return jsonResponse(401, { error: "Accesso riservato." });

  const root = findRoot();
  const workDirectory = await mkdtemp(join(tmpdir(), "lettera-"));

  try {
    const orderFile = join(workDirectory, "ordine.scad");
    const outputFile = join(workDirectory, `pezzo.${format}`);
    await writeFile(orderFile, Core.toScad(params, join(root, "modello", "lettera-nome.scad")), "utf8");

    const args = ["--backend=Manifold", "--enable=lazy-union", "-D", `parte="${part}"`];
    if (format === "stl") args.push("--export-format=binstl");
    if (!forPrinting) args.push("-D", "$fn=32");
    args.push("-o", outputFile, orderFile);

    const result = await runOpenScad(root, args, workDirectory);

    if (!existsSync(outputFile)) {
      if (/empty/i.test(result.log)) return jsonResponse(422, { error: "Questo pezzo non serve per questa configurazione." });
      console.error("OpenSCAD non ha prodotto il file", result.code, result.log.slice(-2000));
      return jsonResponse(500, { error: "Generazione non riuscita." });
    }

    const body = await readFile(outputFile);
    const headers = { "Content-Type": FORMATS[format] };

    if (forPrinting) {
      headers["Cache-Control"] = "no-store";
    } else {
      // La risposta dipende solo dall'indirizzo: la CDN la conserva fino al prossimo deploy.
      headers["Cache-Control"] = "public, max-age=3600";
      headers["Netlify-CDN-Cache-Control"] = "public, durable, max-age=31536000";
    }

    return new Response(body, { status: 200, headers });
  } finally {
    await rm(workDirectory, { recursive: true, force: true });
  }
}

export const config = { path: "/api/lettera" };
