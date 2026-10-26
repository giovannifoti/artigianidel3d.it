const APP_CONFIG = window.APP_CONFIG || {};
const SUPABASE_URL = String(APP_CONFIG.supabaseUrl || "");
const SUPABASE_PUBLISHABLE_KEY = String(APP_CONFIG.supabasePublishableKey || "");
const PRODUCT_IMAGES_BUCKET = "product-images";
const WHATSAPP_NUMBER = "393446498901";

const hasSupabaseConfig =
  SUPABASE_URL.startsWith("https://") &&
  SUPABASE_PUBLISHABLE_KEY.length > 20 &&
  SUPABASE_PUBLISHABLE_KEY.startsWith("sb_publishable_");

// Se la libreria non arriva dal CDN (rete assente o verifica SRI fallita) la pagina resta utilizzabile.
const supabaseAvailable = Boolean(window.supabase && window.supabase.createClient);
const supabaseClient = hasSupabaseConfig && supabaseAvailable
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;

const currencyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR"
});

let lastCatalogUpdate = 0;

function formatPrice(price) {
  const numericPrice = Number(price);
  return Number.isFinite(numericPrice) ? currencyFormatter.format(numericPrice) : "€ 0,00";
}

function formatWhatsAppPrice(price) {
  const numericPrice = Number(price);
  return Number.isFinite(numericPrice)
    ? numericPrice.toFixed(2).replace(".", ",")
    : "0,00";
}

function getImageUrl(imagePath) {
  if (!imagePath) return "";
  if (/^https:/i.test(imagePath)) return imagePath;
  if (!supabaseClient) return "";

  return supabaseClient.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .getPublicUrl(imagePath).data.publicUrl;
}

function getWhatsAppOrderUrl(product) {
  const price = formatWhatsAppPrice(product.price);
  const priceLabel = product.price_from ? `a partire da €${price}` : `€${price}`;
  const message = `Ciao! Vorrei ordinare il prodotto: ${product.title} (Prezzo: ${priceLabel})`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

// Il markup deve restare allineato a renderProductCard() in scripts/build.mjs,
// che pre-genera le stesse schede nell'HTML statico per i motori di ricerca.
function createProductCard(product) {
  const article = document.createElement("article");
  article.className = "product-card";

  const media = document.createElement("div");
  media.className = "product-media";

  const image = document.createElement("img");
  image.className = "product-image";
  image.src = getImageUrl(product.image_path);
  image.alt = `${product.title}, oggetto stampato in 3D da artigianidel3d`;
  image.width = 800;
  image.height = 600;
  image.loading = "lazy";
  image.decoding = "async";

  const badge = document.createElement("span");
  badge.className = "product-badge";
  badge.textContent = "Stampa 3D";
  media.append(image, badge);

  const body = document.createElement("div");
  body.className = "product-body";

  const titleRow = document.createElement("div");
  titleRow.className = "product-title-row";

  const title = document.createElement("h3");
  title.className = "product-title";
  title.textContent = product.title;

  const price = document.createElement("span");
  price.className = "product-price";
  price.textContent = `${product.price_from ? "A partire da " : ""}${formatPrice(product.price)}`;

  const description = document.createElement("p");
  description.className = "product-description";
  description.textContent = product.description;

  const link = document.createElement("a");
  link.className = "primary-button whatsapp-button";
  link.href = getWhatsAppOrderUrl(product);
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.setAttribute("aria-label", `Ordina via WhatsApp: ${product.title}`);
  const arrow = document.createElement("span");
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "↗";
  link.append("Ordina via WhatsApp", arrow);

  titleRow.append(title, price);
  body.append(titleRow, description, link);
  article.append(media, body);
  return article;
}

function renderState(titleText, copyText, options = {}) {
  const grid = document.getElementById("product-grid");
  const count = document.getElementById("product-count");
  const state = document.createElement("div");
  state.className = "empty-state";

  const title = document.createElement("strong");
  if (options.loading) {
    const dot = document.createElement("span");
    dot.className = "loading-dot";
    dot.setAttribute("aria-hidden", "true");
    title.append(dot, titleText);
  } else {
    title.textContent = titleText;
  }

  const copy = document.createElement("span");
  copy.textContent = copyText;
  state.append(title, copy);

  if (options.retry) {
    const retryButton = document.createElement("button");
    retryButton.className = "primary-button state-action";
    retryButton.type = "button";
    retryButton.textContent = "Riprova";
    retryButton.addEventListener("click", loadProducts);
    state.append(retryButton);
  }

  grid.replaceChildren(state);
  count.textContent = options.loading ? "Caricamento" : "0 prodotti";
}

function renderProducts(products) {
  const grid = document.getElementById("product-grid");
  const count = document.getElementById("product-count");
  grid.replaceChildren();
  count.textContent = `${products.length} ${products.length === 1 ? "prodotto" : "prodotti"}`;

  if (products.length === 0) {
    renderState("Nuove forme in arrivo.", "La collezione è in aggiornamento. Torna presto a trovarci.");
    return;
  }

  const fragment = document.createDocumentFragment();
  products.forEach((product) => fragment.append(createProductCard(product)));
  grid.append(fragment);
}

async function loadProducts() {
  const grid = document.getElementById("product-grid");
  // Schede già presenti: generate in fase di build o da un caricamento precedente.
  const hasVisibleProducts = Boolean(grid.querySelector(".product-card"));

  if (!supabaseClient) {
    if (!hasVisibleProducts) {
      renderState("Catalogo in configurazione.", "La collezione sarà disponibile a breve.");
    }
    return;
  }

  // Le schede già visibili restano al loro posto mentre arrivano i dati aggiornati.
  if (!hasVisibleProducts) {
    renderState("Carico la collezione…", "Solo un istante.", { loading: true });
  }

  const { data, error } = await supabaseClient
    .from("products")
    .select("id,title,description,price,price_from,image_path,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Errore durante il caricamento dei prodotti:", error);
    if (!hasVisibleProducts) {
      renderState("Qualcosa non ha preso forma.", "Non è stato possibile caricare il catalogo.", { retry: true });
    }
    return;
  }

  lastCatalogUpdate = Date.now();
  renderProducts(data || []);
}

document.getElementById("current-year").textContent = new Date().getFullYear();
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && Date.now() - lastCatalogUpdate > 60000) loadProducts();
});
loadProducts();
