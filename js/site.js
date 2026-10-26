const APP_CONFIG = window.APP_CONFIG || {};
const SUPABASE_URL = String(APP_CONFIG.supabaseUrl || "");
const SUPABASE_PUBLISHABLE_KEY = String(APP_CONFIG.supabasePublishableKey || "");
const PRODUCT_IMAGES_BUCKET = "product-images";
const WHATSAPP_NUMBER = "393446498901";
// Numero minimo di schede visibili a collezione chiusa (vedi le regole .is-collapsed nel CSS).
const MIN_COLLAPSED_PRODUCTS = 6;

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

function createIcon(symbolId) {
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  svg.setAttribute("class", "icon");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(namespace, "use");
  use.setAttribute("href", `#${symbolId}`);
  svg.append(use);
  return svg;
}

function createPriceElement(product, className) {
  const price = document.createElement("p");
  price.className = className;

  if (product.price_from) {
    const from = document.createElement("span");
    from.className = "price-from";
    from.textContent = "da";
    price.append(from, " ");
  }

  price.append(formatPrice(product.price));
  return price;
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
  // loading va impostato prima di src, altrimenti il browser scarica subito l'immagine.
  image.loading = "lazy";
  image.decoding = "async";
  image.width = 800;
  image.height = 1000;
  image.alt = `${product.title}, oggetto stampato in 3D da artigianidel3d`;
  image.src = getImageUrl(product.image_path);
  media.append(image);

  const body = document.createElement("div");
  body.className = "product-body";

  const title = document.createElement("h3");
  title.className = "product-title";
  const openButton = document.createElement("button");
  openButton.className = "product-open";
  openButton.type = "button";
  openButton.setAttribute("aria-haspopup", "dialog");
  openButton.textContent = product.title;
  title.append(openButton);

  const description = document.createElement("p");
  description.className = "product-description";
  description.textContent = product.description;

  const footer = document.createElement("div");
  footer.className = "product-footer";

  const link = document.createElement("a");
  link.className = "order-link";
  link.href = getWhatsAppOrderUrl(product);
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.setAttribute("aria-label", `Ordina su WhatsApp: ${product.title}`);
  link.append(createIcon("i-chat"), "Ordina");

  footer.append(createPriceElement(product, "product-price"), link);
  body.append(title, description, footer);
  article.append(media, body);
  return article;
}

function updateCollectionToggle(productCount) {
  const grid = document.getElementById("product-grid");
  const toggle = document.getElementById("collection-toggle");
  const fitsCollapsed = productCount <= MIN_COLLAPSED_PRODUCTS;

  toggle.hidden = fitsCollapsed;
  if (fitsCollapsed) grid.classList.remove("is-collapsed");

  const expanded = !grid.classList.contains("is-collapsed");
  toggle.setAttribute("aria-expanded", String(expanded));
  toggle.textContent = expanded ? "Mostra meno" : `Mostra tutta la collezione (${productCount})`;
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
    retryButton.className = "button button-outline";
    retryButton.type = "button";
    retryButton.textContent = "Riprova";
    retryButton.addEventListener("click", loadProducts);
    state.append(retryButton);
  }

  grid.replaceChildren(state);
  count.textContent = "";
  updateCollectionToggle(0);
}

function renderProducts(products) {
  const grid = document.getElementById("product-grid");
  const count = document.getElementById("product-count");

  if (products.length === 0) {
    renderState("Nuove forme in arrivo.", "La collezione è in aggiornamento. Intanto puoi chiederci un oggetto su misura.");
    return;
  }

  const fragment = document.createDocumentFragment();
  products.forEach((product) => fragment.append(createProductCard(product)));
  grid.replaceChildren(fragment);
  count.textContent = `${products.length} ${products.length === 1 ? "oggetto" : "oggetti"}`;
  updateCollectionToggle(products.length);
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

// La scheda di dettaglio legge i dati dalla card, così funziona sia con le schede
// pre-generate sia con quelle create dopo il caricamento live.
function openProductDialog(card) {
  const dialog = document.getElementById("product-dialog");
  const cardImage = card.querySelector(".product-image");
  const dialogImage = document.getElementById("dialog-image");

  dialogImage.src = cardImage.currentSrc || cardImage.src;
  dialogImage.alt = cardImage.alt;
  document.getElementById("dialog-title").textContent = card.querySelector(".product-title").textContent;
  document.getElementById("dialog-description").textContent = card.querySelector(".product-description").textContent;
  document.getElementById("dialog-order").href = card.querySelector(".order-link").href;

  const price = card.querySelector(".product-price").cloneNode(true);
  document.getElementById("dialog-price").replaceChildren(...price.childNodes);

  dialog.showModal();
}

function setupProductDialog() {
  const grid = document.getElementById("product-grid");
  const dialog = document.getElementById("product-dialog");

  grid.addEventListener("click", (event) => {
    const trigger = event.target.closest(".product-open, .product-media");
    if (!trigger) return;
    openProductDialog(trigger.closest(".product-card"));
  });

  document.getElementById("dialog-close").addEventListener("click", () => dialog.close());

  // Un clic sullo sfondo oscurato chiude la scheda.
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
}

function setupCollectionToggle() {
  const grid = document.getElementById("product-grid");
  const toggle = document.getElementById("collection-toggle");

  toggle.addEventListener("click", () => {
    const collapsing = !grid.classList.contains("is-collapsed");
    grid.classList.toggle("is-collapsed");
    updateCollectionToggle(grid.querySelectorAll(".product-card").length);
    if (collapsing) document.getElementById("collezione").scrollIntoView({ block: "start" });
  });

  updateCollectionToggle(grid.querySelectorAll(".product-card").length);
}

// Su smartphone il pulsante fisso compare dopo la prima schermata e sparisce sull'invito finale.
function setupMobileCta() {
  if (!("IntersectionObserver" in window)) return;

  const watched = [document.querySelector(".hero"), document.querySelector(".cta-panel")];
  const visible = new Set();

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) visible.add(entry.target);
      else visible.delete(entry.target);
    });
    document.body.classList.toggle("show-mobile-cta", visible.size === 0);
  });

  watched.forEach((element) => observer.observe(element));
}

document.getElementById("current-year").textContent = new Date().getFullYear();
setupProductDialog();
setupCollectionToggle();
setupMobileCta();
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && Date.now() - lastCatalogUpdate > 60000) loadProducts();
});
loadProducts();
