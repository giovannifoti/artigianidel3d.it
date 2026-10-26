import { readFile, writeFile, mkdir, rm, copyFile, cp } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = join(projectRoot, "dist");

const SITE_URL = "https://artigianidel3d.it";
const PRODUCT_IMAGES_BUCKET = "product-images";
const WHATSAPP_NUMBER = "393446498901";
const SCRIPT_FILES = ["site.js", "admin.js"];

async function loadLocalEnvironment() {
  const environmentPath = join(projectRoot, ".env");
  if (!existsSync(environmentPath)) return;

  const contents = await readFile(environmentPath, "utf8");

  for (const sourceLine of contents.split(/\r?\n/)) {
    const line = sourceLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator < 1) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) process.env[key] = value;
  }
}

function validateConfiguration(url, publishableKey) {
  const validUrl = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url);
  const validKey = publishableKey.startsWith("sb_publishable_") && publishableKey.length > 30;

  if (!validUrl || !validKey) {
    throw new Error(
      "Configurazione Supabase assente o non valida. Imposta SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY."
    );
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function replaceOnce(source, marker, replacement) {
  if (!source.includes(marker)) throw new Error(`Segnaposto mancante: ${marker}`);
  return source.replace(marker, () => replacement);
}

// Legge il catalogo pubblico (solo lettura, chiave publishable) per inserirlo nell'HTML statico.
// Se Supabase non risponde la build prosegue: il catalogo verrà comunque caricato dal browser.
async function fetchPublicProducts(supabaseUrl, publishableKey) {
  const endpoint =
    `${supabaseUrl}/rest/v1/products` +
    "?select=id,title,description,price,price_from,image_path,created_at,updated_at" +
    "&order=created_at.desc";

  try {
    const response = await fetch(endpoint, {
      headers: { apikey: publishableKey, Accept: "application/json" },
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const products = await response.json();
    if (!Array.isArray(products)) throw new Error("risposta inattesa");
    return products;
  } catch (error) {
    console.warn(`Avviso: catalogo non pre-generato (${error.message}). Verrà caricato dal browser.`);
    return null;
  }
}

function createPriceFormatter() {
  const formatter = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
  return (price) => {
    const numericPrice = Number(price);
    return Number.isFinite(numericPrice) ? formatter.format(numericPrice) : "€ 0,00";
  };
}

function getProductImageUrl(supabaseUrl, imagePath) {
  if (/^https:/i.test(imagePath)) return imagePath;
  const encodedPath = String(imagePath).split("/").map(encodeURIComponent).join("/");
  return `${supabaseUrl}/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${encodedPath}`;
}

function getWhatsAppOrderUrl(product) {
  const numericPrice = Number(product.price);
  const price = Number.isFinite(numericPrice) ? numericPrice.toFixed(2).replace(".", ",") : "0,00";
  const priceLabel = product.price_from ? `a partire da €${price}` : `€${price}`;
  const message = `Ciao! Vorrei ordinare il prodotto: ${product.title} (Prezzo: ${priceLabel})`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

// Deve restare allineato a createProductCard() in js/site.js.
function renderProductCard(product, supabaseUrl, formatPrice) {
  const title = escapeHtml(product.title);
  const priceFrom = product.price_from ? `<span class="price-from">da</span> ` : "";

  return `<article class="product-card">` +
    `<div class="product-media">` +
    `<img class="product-image" src="${escapeHtml(getProductImageUrl(supabaseUrl, product.image_path))}" ` +
    `alt="${title}, oggetto stampato in 3D da artigianidel3d" width="800" height="1000" loading="lazy" decoding="async">` +
    `</div>` +
    `<div class="product-body">` +
    `<h3 class="product-title"><button class="product-open" type="button" aria-haspopup="dialog">${title}</button></h3>` +
    `<p class="product-description">${escapeHtml(product.description)}</p>` +
    `<div class="product-footer">` +
    `<p class="product-price">${priceFrom}${escapeHtml(formatPrice(product.price))}</p>` +
    `<a class="order-link" href="${escapeHtml(getWhatsAppOrderUrl(product))}" target="_blank" rel="noopener noreferrer" ` +
    `aria-label="Ordina su WhatsApp: ${title}"><svg class="icon" aria-hidden="true"><use href="#i-chat"></use></svg>Ordina</a>` +
    `</div>` +
    `</div>` +
    `</article>`;
}

function renderProductsJsonLd(products, supabaseUrl) {
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Collezione di oggetti stampati in 3D di artigianidel3d",
    itemListElement: products.map((product, index) => {
      const price = Number(product.price);
      const offers = product.price_from
        ? { "@type": "AggregateOffer", lowPrice: price.toFixed(2), priceCurrency: "EUR", url: `${SITE_URL}/#collezione` }
        : { "@type": "Offer", price: price.toFixed(2), priceCurrency: "EUR", url: `${SITE_URL}/#collezione` };

      return {
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "Product",
          name: product.title,
          description: product.description,
          image: getProductImageUrl(supabaseUrl, product.image_path),
          brand: { "@type": "Brand", name: "artigianidel3d" },
          offers
        }
      };
    })
  };

  // "<" viene codificato per impedire la chiusura anticipata del tag script.
  const json = JSON.stringify(itemList).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">${json}</script>`;
}

async function writeHashedScripts() {
  const scriptPaths = {};
  await mkdir(join(outputDirectory, "js"), { recursive: true });

  for (const fileName of SCRIPT_FILES) {
    const contents = await readFile(join(projectRoot, "js", fileName));
    const hash = createHash("sha256").update(contents).digest("hex").slice(0, 10);
    const hashedName = fileName.replace(/\.js$/, `.${hash}.js`);
    await writeFile(join(outputDirectory, "js", hashedName), contents);
    scriptPaths[`js/${fileName}`] = `js/${hashedName}`;
  }

  return scriptPaths;
}

function applyScriptPaths(html, scriptPaths) {
  let result = html;
  for (const [source, hashed] of Object.entries(scriptPaths)) {
    result = result.replaceAll(`src="${source}"`, `src="${hashed}"`);
  }
  return result;
}

async function buildIndex(scriptPaths, supabaseUrl, products) {
  let html = await readFile(join(projectRoot, "index.html"), "utf8");
  const formatPrice = createPriceFormatter();

  html = replaceOnce(
    html,
    "<!-- PRECONNECT_SUPABASE -->",
    `<link rel="preconnect" href="${supabaseUrl}" crossorigin>`
  );

  if (products && products.length > 0) {
    const cards = products.map((product) => renderProductCard(product, supabaseUrl, formatPrice)).join("");
    const countLabel = `${products.length} ${products.length === 1 ? "oggetto" : "oggetti"}`;
    html = replaceOnce(html, "<!-- PRODUCTS_HTML -->", cards);
    html = replaceOnce(html, "<!-- PRODUCTS_JSONLD -->", renderProductsJsonLd(products, supabaseUrl));
    html = replaceOnce(
      html,
      '<span class="product-count" id="product-count" aria-live="polite"></span>',
      `<span class="product-count" id="product-count" aria-live="polite">${countLabel}</span>`
    );
  } else {
    html = replaceOnce(html, "<!-- PRODUCTS_HTML -->", "");
    html = replaceOnce(html, "<!-- PRODUCTS_JSONLD -->", "");
  }

  return applyScriptPaths(html, scriptPaths);
}

function buildSitemap(lastModified) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${lastModified}</lastmod>
  </url>
</urlset>
`;
}

await loadLocalEnvironment();

const supabaseUrl = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const supabasePublishableKey = String(process.env.SUPABASE_PUBLISHABLE_KEY || "");

validateConfiguration(supabaseUrl, supabasePublishableKey);

const supabaseOrigin = new URL(supabaseUrl);

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

await Promise.all([
  copyFile(join(projectRoot, "robots.txt"), join(outputDirectory, "robots.txt")),
  copyFile(join(projectRoot, "404.html"), join(outputDirectory, "404.html")),
  cp(join(projectRoot, "assets"), join(outputDirectory, "assets"), { recursive: true })
]);

const [scriptPaths, products] = await Promise.all([
  writeHashedScripts(),
  fetchPublicProducts(supabaseUrl, supabasePublishableKey)
]);

const indexHtml = await buildIndex(scriptPaths, supabaseUrl, products);
const adminHtml = applyScriptPaths(await readFile(join(projectRoot, "admin.html"), "utf8"), scriptPaths);

// La CSP autorizza soltanto il progetto Supabase configurato, non qualsiasi *.supabase.co.
const headers = (await readFile(join(projectRoot, "_headers"), "utf8"))
  .replaceAll("__SUPABASE_ORIGIN__", supabaseOrigin.origin)
  .replaceAll("__SUPABASE_WS_ORIGIN__", `wss://${supabaseOrigin.host}`);

const browserConfig = `window.APP_CONFIG = Object.freeze(${JSON.stringify({
  supabaseUrl,
  supabasePublishableKey
}, null, 2)});\n`;

await Promise.all([
  writeFile(join(outputDirectory, "index.html"), indexHtml, "utf8"),
  writeFile(join(outputDirectory, "admin.html"), adminHtml, "utf8"),
  writeFile(join(outputDirectory, "_headers"), headers, "utf8"),
  writeFile(join(outputDirectory, "sitemap.xml"), buildSitemap(new Date().toISOString().slice(0, 10)), "utf8"),
  writeFile(join(outputDirectory, "config.js"), browserConfig, "utf8")
]);

const productSummary = products ? `${products.length} prodotti pre-generati` : "catalogo non pre-generato";
console.log(`Build completata (${productSummary}): cartella dist pronta per la pubblicazione.`);
