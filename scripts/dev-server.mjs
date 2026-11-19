// Server di prova locale: serve dist/ con le intestazioni di sicurezza di dist/_headers
// e collega /api/lettera alla funzione Netlify. Uso: npm run build && npm run dev
// Il pannello admin si collega comunque al progetto Supabase configurato in .env.

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import handler from "../netlify/functions/lettera.mjs";

const root = join(fileURLToPath(new URL("..", import.meta.url)), "dist");
const port = Number(process.env.PORT || 8888);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ttf": "font/ttf",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8"
};

async function globalHeaders() {
  const text = await readFile(join(root, "_headers"), "utf8").catch(() => "");
  const block = text.split(/\n(?=\/)/).find((section) => section.startsWith("/*"));
  const headers = {};
  for (const line of (block || "").split("\n").slice(1)) {
    const match = line.match(/^\s+([A-Za-z-]+):\s*(.+)$/);
    if (match) headers[match[1]] = match[2];
  }
  // In locale il sito è servito in http: niente upgrade a https.
  if (headers["Content-Security-Policy"]) {
    headers["Content-Security-Policy"] = headers["Content-Security-Policy"].replace(/;\s*upgrade-insecure-requests/, "");
  }
  return headers;
}

async function findFile(pathname) {
  const clean = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  for (const candidate of [clean, `${clean}.html`, join(clean, "index.html")]) {
    const file = join(root, candidate);
    if (!file.startsWith(root)) return null;
    const info = await stat(file).catch(() => null);
    if (info && info.isFile()) return file;
  }
  return null;
}

createServer(async (request, response) => {
  const url = new URL(request.url, `http://localhost:${port}`);
  const security = await globalHeaders();

  if (url.pathname === "/api/lettera") {
    const result = await handler(new Request(url, { method: request.method, headers: request.headers }));
    response.writeHead(result.status, { ...security, ...Object.fromEntries(result.headers) });
    response.end(Buffer.from(await result.arrayBuffer()));
    return;
  }

  const file = await findFile(url.pathname);
  if (!file) {
    response.writeHead(404, { ...security, "Content-Type": "text/html; charset=utf-8" });
    response.end(await readFile(join(root, "404.html")).catch(() => "Non trovato"));
    return;
  }
  response.writeHead(200, { ...security, "Content-Type": TYPES[extname(file)] || "application/octet-stream" });
  response.end(await readFile(file));
}).listen(port, () => {
  console.log(`Sito di prova su http://localhost:${port}`);
});
