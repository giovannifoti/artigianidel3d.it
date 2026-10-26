const APP_CONFIG = window.APP_CONFIG || {};
const SUPABASE_URL = String(APP_CONFIG.supabaseUrl || "");
const SUPABASE_PUBLISHABLE_KEY = String(APP_CONFIG.supabasePublishableKey || "");
const PRODUCT_IMAGES_BUCKET = "product-images";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_SOURCE_IMAGE_SIZE = 25 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1600;
const WEBP_QUALITY = 0.82;
const JPEG_QUALITY = 0.85;
// Sopra questa soglia un'immagine viene proposta per l'ottimizzazione.
const HEAVY_IMAGE_BYTES = 600 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const hasSupabaseConfig =
  SUPABASE_URL.startsWith("https://") &&
  SUPABASE_PUBLISHABLE_KEY.length > 20 &&
  SUPABASE_PUBLISHABLE_KEY.startsWith("sb_publishable_");

const supabaseAvailable = Boolean(window.supabase && window.supabase.createClient);
const supabaseClient = hasSupabaseConfig && supabaseAvailable
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;

const currencyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR"
});

const FORM_COPY = {
  addTitle: "Aggiungi un prodotto",
  addHelper: "Tutti i campi sono obbligatori.",
  addButton: "Pubblica prodotto ↗",
  addBusy: "Pubblicazione…",
  editTitle: "Modifica prodotto",
  editHelper: "Aggiorna i dati del prodotto. La foto è facoltativa: scegline una nuova solo se vuoi sostituirla.",
  editButton: "Salva modifiche ✓",
  editBusy: "Salvataggio…"
};

let activeUser = null;
let editingProduct = null;
let selectedImageFile = null;
let selectedImageBase64 = "";
let pendingAuthMessage = "";
let currentProducts = [];
let optimizingImages = false;
const imageSizes = new Map();

function formatPrice(price) {
  const numericPrice = Number(price);
  return Number.isFinite(numericPrice) ? currencyFormatter.format(numericPrice) : "€ 0,00";
}

function parsePrice(price) {
  return Number(String(price).replace(/€/g, "").replace(",", ".").trim());
}

function formatPriceInput(price) {
  const numericPrice = Number(price);
  if (!Number.isFinite(numericPrice)) return "";

  return numericPrice.toLocaleString("it-IT", {
    minimumFractionDigits: numericPrice % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  });
}

function getImageUrl(imagePath) {
  if (!imagePath || !supabaseClient) return "";
  return supabaseClient.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .getPublicUrl(imagePath).data.publicUrl;
}

function setAuthMessage(message) {
  document.getElementById("auth-message").textContent = message || "";
}

function showLogin(message) {
  activeUser = null;
  document.getElementById("auth-view").hidden = false;
  document.getElementById("admin-view").hidden = true;
  document.getElementById("session-tools").hidden = true;
  setAuthMessage(message || "");
}

function showAdmin(user) {
  activeUser = user;
  pendingAuthMessage = "";
  document.getElementById("auth-view").hidden = true;
  document.getElementById("admin-view").hidden = false;
  document.getElementById("session-tools").hidden = false;
  document.getElementById("session-email").textContent = user.email || "Amministratore";
}

async function isAuthorizedAdmin(userId) {
  const { data, error } = await supabaseClient
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Errore durante la verifica dei permessi:", error);
    return false;
  }

  return Boolean(data);
}

async function synchronizeSession(session) {
  if (!session) {
    showLogin(pendingAuthMessage);
    return;
  }

  const authorized = await isAuthorizedAdmin(session.user.id);

  if (!authorized) {
    pendingAuthMessage = "Questo account non è autorizzato a gestire il catalogo.";
    await supabaseClient.auth.signOut({ scope: "local" });
    showLogin(pendingAuthMessage);
    return;
  }

  showAdmin(session.user);
  await loadProducts();
}

function setButtonBusy(button, busy, busyLabel, idleLabel) {
  button.disabled = busy;
  button.textContent = busy ? busyLabel : idleLabel;
}

async function handleLogin(event) {
  event.preventDefault();
  setAuthMessage("");

  if (!supabaseClient) {
    setAuthMessage("Il database non è ancora configurato.");
    return;
  }

  const form = event.currentTarget;
  const button = document.getElementById("login-button");
  setButtonBusy(button, true, "Accesso in corso…", "Accedi al pannello →");

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: form.elements["email"].value.trim(),
    password: form.elements["password"].value
  });

  setButtonBusy(button, false, "Accesso in corso…", "Accedi al pannello →");

  if (error || !data.session) {
    console.error("Login non riuscito:", error);
    setAuthMessage("Email o password non corrette.");
    return;
  }

  await synchronizeSession(data.session);
}

async function handleLogout() {
  const button = document.getElementById("logout-button");
  button.disabled = true;
  pendingAuthMessage = "";
  await supabaseClient.auth.signOut({ scope: "local" });
  button.disabled = false;
  showLogin("");
}

function resetImagePreview() {
  selectedImageFile = null;
  selectedImageBase64 = "";
  document.getElementById("product-image").value = "";
  document.getElementById("image-preview").removeAttribute("src");
  document.getElementById("image-preview-wrap").classList.remove("visible");
  document.getElementById("file-prompt").hidden = false;
}

function showStoredImagePreview(imagePath) {
  selectedImageFile = null;
  selectedImageBase64 = "";
  document.getElementById("product-image").value = "";
  document.getElementById("image-preview").src = getImageUrl(imagePath);
  document.getElementById("image-preview-wrap").classList.add("visible");
  document.getElementById("file-prompt").hidden = true;
}

function restoreImageSelectionState() {
  if (editingProduct) {
    showStoredImagePreview(editingProduct.image_path);
  } else {
    resetImagePreview();
  }
}

function resetProductForm() {
  const form = document.getElementById("product-form");
  const imageInput = document.getElementById("product-image");
  const publishButton = document.getElementById("publish-button");

  editingProduct = null;
  form.reset();
  imageInput.required = true;
  document.querySelector(".form-panel").classList.remove("is-editing");
  document.getElementById("form-title").textContent = FORM_COPY.addTitle;
  document.getElementById("form-helper").textContent = FORM_COPY.addHelper;
  document.getElementById("image-required").hidden = false;
  document.getElementById("cancel-edit-button").hidden = true;
  publishButton.disabled = false;
  publishButton.textContent = FORM_COPY.addButton;
  resetImagePreview();
}

function startProductEdit(product) {
  const form = document.getElementById("product-form");
  const imageInput = document.getElementById("product-image");
  const formPanel = document.querySelector(".form-panel");
  const publishButton = document.getElementById("publish-button");

  editingProduct = product;
  form.elements["title"].value = product.title || "";
  form.elements["description"].value = product.description || "";
  form.elements["price"].value = formatPriceInput(product.price);
  form.elements["priceFrom"].checked = Boolean(product.price_from);
  imageInput.required = false;

  document.getElementById("form-title").textContent = FORM_COPY.editTitle;
  document.getElementById("form-helper").textContent = FORM_COPY.editHelper;
  document.getElementById("image-required").hidden = true;
  document.getElementById("cancel-edit-button").hidden = false;
  publishButton.disabled = false;
  publishButton.textContent = FORM_COPY.editButton;
  formPanel.classList.add("is-editing");
  showStoredImagePreview(product.image_path);

  formPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  window.setTimeout(function () {
    form.elements["title"].focus({ preventScroll: true });
  }, 320);
}

function handleImageSelection(event) {
  const file = event.target.files[0];

  if (!file) {
    restoreImageSelectionState();
    return;
  }

  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    alert("Seleziona un’immagine JPG, PNG o WebP.");
    event.target.value = "";
    restoreImageSelectionState();
    return;
  }

  if (file.size > MAX_SOURCE_IMAGE_SIZE) {
    alert("L’immagine supera 25 MB. Scegli un file più leggero.");
    event.target.value = "";
    restoreImageSelectionState();
    return;
  }

  selectedImageFile = file;
  const reader = new FileReader();

  reader.onload = function () {
    selectedImageBase64 = String(reader.result);
    document.getElementById("image-preview").src = selectedImageBase64;
    document.getElementById("image-preview-wrap").classList.add("visible");
    document.getElementById("file-prompt").hidden = true;
  };

  reader.onerror = function () {
    alert("Non è stato possibile leggere l’immagine. Riprova.");
    event.target.value = "";
    restoreImageSelectionState();
  };

  reader.readAsDataURL(file);
}

function createProductRow(product) {
  const row = document.createElement("article");
  row.className = "product-row";

  const image = document.createElement("img");
  image.className = "product-thumb";
  image.src = getImageUrl(product.image_path);
  image.alt = "";

  const info = document.createElement("div");
  info.className = "product-info";

  const name = document.createElement("h3");
  name.className = "product-name";
  name.textContent = product.title;

  const meta = document.createElement("p");
  meta.className = "product-meta";
  meta.textContent = (product.price_from ? "A partire da " : "") + formatPrice(product.price);

  const description = document.createElement("p");
  description.className = "product-description";
  description.textContent = product.description;

  const actions = document.createElement("div");
  actions.className = "row-actions";

  const editButton = document.createElement("button");
  editButton.className = "row-button edit-button";
  editButton.type = "button";
  editButton.textContent = "Modifica";
  editButton.setAttribute("aria-label", "Modifica " + product.title);
  editButton.addEventListener("click", function () {
    startProductEdit(product);
  });

  const deleteButton = document.createElement("button");
  deleteButton.className = "row-button delete-button";
  deleteButton.type = "button";
  deleteButton.textContent = "Elimina";
  deleteButton.setAttribute("aria-label", "Elimina " + product.title);
  deleteButton.addEventListener("click", function () {
    deleteProduct(product, deleteButton);
  });

  actions.append(editButton, deleteButton);
  info.append(name, meta, description);
  row.append(image, info, actions);
  return row;
}

function renderListState(message) {
  const list = document.getElementById("product-list");
  const status = document.createElement("div");
  status.className = "list-status";
  status.textContent = message;
  list.replaceChildren(status);
}

function updateOptimizeBox() {
  const box = document.getElementById("optimize-box");
  const pending = currentProducts.filter(needsImageOptimization).length;

  box.hidden = pending === 0 && !optimizingImages;
  if (!optimizingImages) {
    document.getElementById("optimize-copy").textContent =
      pending + (pending === 1 ? " immagine pesa" : " immagini pesano") +
      " più di 600 KB: ottimizzarle alleggerisce la vetrina, soprattutto da smartphone.";
  }
}

function renderProductList(products) {
  const list = document.getElementById("product-list");
  const count = document.getElementById("catalog-count");
  currentProducts = products;
  updateOptimizeBox();
  measureImageSizes(products);
  list.replaceChildren();
  count.textContent = products.length + " " + (products.length === 1 ? "elemento" : "elementi");

  if (products.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";

    const title = document.createElement("strong");
    title.textContent = "Il catalogo è vuoto.";

    const copy = document.createElement("span");
    copy.textContent = "Aggiungi il primo prodotto usando il modulo.";

    emptyState.append(title, copy);
    list.append(emptyState);
    return;
  }

  const fragment = document.createDocumentFragment();
  products.forEach(function (product) {
    fragment.append(createProductRow(product));
  });
  list.append(fragment);
}

async function loadProducts() {
  if (!activeUser) return;

  renderListState("Caricamento catalogo…");

  const { data, error } = await supabaseClient
    .from("products")
    .select("id,title,description,price,price_from,image_path,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Errore durante il caricamento:", error);
    renderListState("Impossibile caricare i prodotti. Ricarica la pagina e riprova.");
    return;
  }

  renderProductList(data || []);
}

function canvasToBlob(canvas, type, quality) {
  return new Promise(function (resolve) {
    canvas.toBlob(resolve, type, quality);
  });
}

function drawImageOnCanvas(bitmap, width, height, background) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (background) {
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
  }
  context.drawImage(bitmap, 0, 0, width, height);
  return canvas;
}

// Ridimensiona e converte in WebP (JPEG se il browser non sa codificare WebP).
// Restituisce il file originale se l'ottimizzazione fallisce o non riduce il peso.
async function optimizeImage(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    let blob = await canvasToBlob(drawImageOnCanvas(bitmap, width, height), "image/webp", WEBP_QUALITY);

    if (!blob || blob.type !== "image/webp") {
      blob = await canvasToBlob(drawImageOnCanvas(bitmap, width, height, "#15151a"), "image/jpeg", JPEG_QUALITY);
    }

    if (bitmap.close) bitmap.close();
    return blob && blob.size < file.size ? blob : file;
  } catch (error) {
    console.warn("Ottimizzazione immagine non riuscita, uso il file originale:", error);
    return file;
  }
}

function needsImageOptimization(product) {
  return (imageSizes.get(product.image_path) || 0) > HEAVY_IMAGE_BYTES;
}

// Legge il peso delle immagini con richieste HEAD, poi aggiorna il riquadro di ottimizzazione.
async function measureImageSizes(products) {
  const unknown = products.filter(function (product) {
    return product.image_path && !imageSizes.has(product.image_path);
  });

  await Promise.all(unknown.map(async function (product) {
    try {
      const response = await fetch(getImageUrl(product.image_path), { method: "HEAD", cache: "no-store" });
      imageSizes.set(product.image_path, Number(response.headers.get("content-length")) || 0);
    } catch (error) {
      console.warn("Peso immagine non disponibile:", error);
    }
  }));

  updateOptimizeBox();
}

async function uploadProductImage(file) {
  const path = createImagePath(file);
  const { error } = await supabaseClient.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(path, file, {
      // Ogni file ha un nome univoco e non viene mai sovrascritto: può restare in cache a lungo.
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false
    });

  if (error) throw error;
  return path;
}

async function optimizeExistingImages() {
  const candidates = currentProducts.filter(needsImageOptimization);
  if (candidates.length === 0 || optimizingImages) return;

  const confirmed = window.confirm(
    "Ottimizzare " + candidates.length + " immagini? Le foto originali verranno sostituite con versioni più leggere."
  );
  if (!confirmed) return;

  const button = document.getElementById("optimize-button");
  const copy = document.getElementById("optimize-copy");
  let optimized = 0;
  let skipped = 0;
  let failed = 0;

  optimizingImages = true;
  button.disabled = true;

  for (const [index, product] of candidates.entries()) {
    copy.textContent = "Ottimizzo " + (index + 1) + " di " + candidates.length + ": " + product.title + "…";
    let uploadedPath = "";

    try {
      const response = await fetch(getImageUrl(product.image_path), { cache: "no-store" });
      if (!response.ok) throw new Error("Download immagine non riuscito: HTTP " + response.status);

      const original = await response.blob();
      const smaller = await optimizeImage(original);

      // Sostituisce l'immagine solo se il guadagno è significativo.
      if (smaller === original || smaller.size > original.size * 0.9) {
        skipped += 1;
        continue;
      }

      uploadedPath = await uploadProductImage(smaller);

      const { data, error } = await supabaseClient
        .from("products")
        .update({ image_path: uploadedPath })
        .eq("id", product.id)
        .select("id");

      if (error || !data || data.length === 0) throw error || new Error("Prodotto non aggiornato");

      const { error: storageError } = await supabaseClient.storage
        .from(PRODUCT_IMAGES_BUCKET)
        .remove([product.image_path]);
      if (storageError) console.error("Pulizia vecchia immagine fallita:", storageError);

      optimized += 1;
    } catch (error) {
      console.error("Ottimizzazione non riuscita per " + product.title + ":", error);
      if (uploadedPath) {
        await supabaseClient.storage.from(PRODUCT_IMAGES_BUCKET).remove([uploadedPath]);
      }
      failed += 1;
    }
  }

  optimizingImages = false;
  button.disabled = false;
  await loadProducts();
  alert(
    "Ottimizzazione completata: " + optimized + " immagini convertite" +
    (skipped ? ", " + skipped + " già leggere" : "") +
    (failed ? ", " + failed + " non riuscite (riprova più tardi)" : "") + "."
  );
}

function createImagePath(file) {
  const extensionByType = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
  };
  const uniqueId = window.crypto && window.crypto.randomUUID
    ? window.crypto.randomUUID()
    : String(Date.now()) + "-" + Math.random().toString(16).slice(2);

  return activeUser.id + "/" + uniqueId + "." + extensionByType[file.type];
}

async function saveProduct(event) {
  event.preventDefault();

  if (!activeUser) {
    alert("La sessione è scaduta. Accedi di nuovo.");
    return;
  }

  const isEditing = Boolean(editingProduct);

  if (!isEditing && !selectedImageFile) {
    alert("Seleziona una foto per il prodotto.");
    return;
  }

  const form = event.currentTarget;
  const price = parsePrice(form.elements["price"].value);

  if (!Number.isFinite(price) || price < 0) {
    alert("Inserisci un prezzo valido.");
    return;
  }

  const publishButton = document.getElementById("publish-button");
  const idleLabel = isEditing ? FORM_COPY.editButton : FORM_COPY.addButton;
  const busyLabel = isEditing ? FORM_COPY.editBusy : FORM_COPY.addBusy;
  const productBeingEdited = editingProduct;
  let imagePath = productBeingEdited ? productBeingEdited.image_path : "";
  let uploadedReplacementPath = "";

  setButtonBusy(publishButton, true, busyLabel, idleLabel);

  if (selectedImageFile) {
    const imageToUpload = await optimizeImage(selectedImageFile);

    if (imageToUpload.size > MAX_IMAGE_SIZE) {
      setButtonBusy(publishButton, false, busyLabel, idleLabel);
      alert("L’immagine supera 5 MB anche dopo l’ottimizzazione. Scegli un file più leggero.");
      return;
    }

    try {
      uploadedReplacementPath = await uploadProductImage(imageToUpload);
    } catch (uploadError) {
      console.error("Upload immagine fallito:", uploadError);
      setButtonBusy(publishButton, false, busyLabel, idleLabel);
      alert("Non è stato possibile caricare l’immagine. Riprova.");
      return;
    }

    imagePath = uploadedReplacementPath;
  }

  const productPayload = {
    title: form.elements["title"].value.trim(),
    description: form.elements["description"].value.trim(),
    price: price,
    price_from: form.elements["priceFrom"].checked,
    image_path: imagePath
  };

  const { data, error } = isEditing
    ? await supabaseClient
        .from("products")
        .update(productPayload)
        .eq("id", productBeingEdited.id)
        .select("id")
    : await supabaseClient
        .from("products")
        .insert(productPayload)
        .select("id");

  if (error || !data || data.length === 0) {
    console.error(isEditing ? "Aggiornamento prodotto fallito:" : "Salvataggio prodotto fallito:", error);
    if (uploadedReplacementPath) {
      await supabaseClient.storage.from(PRODUCT_IMAGES_BUCKET).remove([uploadedReplacementPath]);
    }
    setButtonBusy(publishButton, false, busyLabel, idleLabel);
    alert(isEditing ? "Non è stato possibile aggiornare il prodotto. Riprova." : "Non è stato possibile salvare il prodotto. Riprova.");
    return;
  }

  if (
    isEditing &&
    uploadedReplacementPath &&
    productBeingEdited.image_path &&
    productBeingEdited.image_path !== uploadedReplacementPath
  ) {
    const { error: storageError } = await supabaseClient.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .remove([productBeingEdited.image_path]);

    if (storageError) {
      console.error("Pulizia vecchia immagine fallita:", storageError);
    }
  }

  resetProductForm();
  await loadProducts();
  alert(isEditing ? "Prodotto aggiornato con successo!" : "Prodotto pubblicato con successo!");
}

async function deleteProduct(product, button) {
  const confirmed = window.confirm("Eliminare definitivamente “" + product.title + "”?");
  if (!confirmed) return;

  button.disabled = true;
  button.textContent = "Elimino…";

  const { data, error } = await supabaseClient
    .from("products")
    .delete()
    .eq("id", product.id)
    .select("id");

  if (error || !data || data.length === 0) {
    console.error("Eliminazione prodotto fallita:", error);
    button.disabled = false;
    button.textContent = "Elimina";
    alert("Non è stato possibile eliminare il prodotto.");
    return;
  }

  const { error: storageError } = await supabaseClient.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .remove([product.image_path]);

  if (storageError) {
    console.error("Pulizia immagine fallita:", storageError);
  }

  if (editingProduct && editingProduct.id === product.id) {
    resetProductForm();
  }

  await loadProducts();
}

async function initialize() {
  const configWarning = document.getElementById("config-warning");
  const loginButton = document.getElementById("login-button");

  if (!supabaseClient) {
    configWarning.hidden = false;
    loginButton.disabled = true;
    return;
  }

  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    console.error("Impossibile leggere la sessione:", error);
    showLogin("Non è stato possibile verificare la sessione.");
    return;
  }

  await synchronizeSession(data.session);
}

document.getElementById("login-form").addEventListener("submit", handleLogin);
document.getElementById("logout-button").addEventListener("click", handleLogout);
document.getElementById("product-image").addEventListener("change", handleImageSelection);
document.getElementById("cancel-edit-button").addEventListener("click", resetProductForm);
document.getElementById("product-form").addEventListener("submit", saveProduct);
document.getElementById("optimize-button").addEventListener("click", optimizeExistingImages);

if (supabaseClient) {
  supabaseClient.auth.onAuthStateChange(function (_event, session) {
    window.setTimeout(function () {
      synchronizeSession(session);
    }, 0);
  });
}

initialize();
