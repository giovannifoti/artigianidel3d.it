"use strict";

// Scheda "Richieste lettere" del pannello admin: elenco delle richieste arrivate dal
// configuratore, contatti del cliente, stato, anteprima 3D e download dei file di stampa.
// I dati dei clienti vengono inseriti sempre come testo (textContent), mai come HTML.

(() => {
  const Core = window.LetteraCore;
  const API_URL = "/api/lettera";

  const STATUSES = {
    nuova: "Nuova",
    contattata: "Contattata",
    in_lavorazione: "In lavorazione",
    completata: "Completata",
    annullata: "Annullata"
  };

  // Gruppi di stampa: ogni file contiene pezzi allineati, da importare come un solo oggetto.
  const PRINT_GROUPS = [
    { part: "gruppo_lettera", file: "1-lettera-e-decorazioni" },
    { part: "gruppo_nome", file: "2-nome" },
    { part: "gruppo_base", file: "3-base" },
    { part: "gruppo_personaggio", file: "4-personaggio", character: true }
  ];

  const STL_PARTS = [
    { part: "lettera", file: "lettera" },
    { part: "decorazioni", file: "decorazioni", decorated: true },
    { part: "nome", file: "nome" },
    { part: "base", file: "base" },
    { part: "personaggio", file: "personaggio-corpo", character: true },
    { part: "personaggio_dettagli", file: "personaggio-dettagli", character: true },
    { part: "personaggio_cuore", file: "personaggio-cuore", character: true },
    { part: "personaggio_occhi", file: "personaggio-occhi", character: true }
  ];

  let client = null;
  let requests = [];
  let filter = "attive";
  let viewer = null;

  const dateFormatter = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" });

  // ------------------------------------------------------------ DOM

  function h(tag, attributes = {}, children = []) {
    const element = document.createElement(tag);
    for (const [key, value] of Object.entries(attributes)) {
      if (value === undefined || value === null || value === false) continue;
      if (key === "className") element.className = value;
      else if (key === "text") element.textContent = value;
      else if (key.startsWith("on")) element.addEventListener(key.slice(2), value);
      else element.setAttribute(key, value === true ? "" : String(value));
    }
    for (const child of [].concat(children)) {
      if (child === null || child === undefined || child === false) continue;
      element.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return element;
  }

  function whatsappNumber(phone) {
    let digits = String(phone).replace(/[^\d+]/g, "");
    if (digits.startsWith("+")) digits = digits.slice(1);
    else if (digits.startsWith("00")) digits = digits.slice(2);
    else if (/^3\d{8,9}$/.test(digits)) digits = `39${digits}`;
    return digits.replace(/\D/g, "");
  }

  function configHash(config) {
    const params = new URLSearchParams({
      v: config.version,
      n: config.name,
      fl: config.letterFont,
      fn: config.nameFont,
      cl: config.letterColor,
      ca: config.accentColor
    });
    if (config.version === "decorata") {
      params.set("t", config.theme);
      params.set("p", config.character);
    }
    return params.toString();
  }

  function paramsOf(request) {
    return Core.validateParams({ ...(request.model_params || {}), config: request.config });
  }

  function setListMessage(message) {
    const list = document.getElementById("request-list");
    list.replaceChildren(h("p", { className: "empty-state", text: message }));
  }

  // ------------------------------------------------------------ Elenco

  function visibleRequests() {
    if (filter === "tutte") return requests;
    if (filter === "chiuse") return requests.filter((request) => ["completata", "annullata"].includes(request.status));
    return requests.filter((request) => !["completata", "annullata"].includes(request.status));
  }

  function updateBadge() {
    const badge = document.getElementById("richieste-badge");
    const fresh = requests.filter((request) => request.status === "nuova").length;
    badge.textContent = String(fresh);
    badge.hidden = fresh === 0;
  }

  function sizeWarning(params) {
    const layout = Core.computeLayout(params.config, { letterBox: params.letterBox, nameBox: params.nameBox });
    const base = `${Math.round(layout.baseA * 2)} × ${Math.round(layout.baseB * 2)} mm`;
    const letter = `${Math.round(layout.W)} × ${Math.round(layout.H)} mm`;
    const tooLong = layout.baseA * 2 > 250;
    return h("p", { className: tooLong ? "request-size is-warning" : "request-size" }, [
      `Lettera ${letter} · base ${base}`,
      tooLong ? (layout.baseDiagonal <= 250 ? " · la base va messa in diagonale sul piatto" : " · la base non entra nel piatto: va divisa") : ""
    ]);
  }

  function renderRequest(request) {
    const config = Core.normalizeConfig(request.config);
    const params = paramsOf(request);
    const initial = Core.getInitial(config.name);
    const wa = whatsappNumber(request.phone);

    const statusSelect = h("select", {
      className: "status-select",
      "aria-label": `Stato della richiesta di ${request.customer_name}`,
      "data-status": request.status,
      onchange: (event) => updateStatus(request, event.target.value, event.target)
    }, Object.entries(STATUSES).map(([value, label]) => h("option", { value, selected: value === request.status, text: label })));

    const actions = h("div", { className: "request-actions" }, [
      h("button", { className: "row-button edit-button", type: "button", text: "Anteprima 3D", disabled: !params, onclick: () => openPreview(request) }),
      h("button", { className: "row-button download-button", type: "button", text: "Scarica 3MF", disabled: !params, onclick: (event) => download(request, "3mf", event.currentTarget) }),
      h("button", { className: "row-button download-button", type: "button", text: "Scarica STL", disabled: !params, onclick: (event) => download(request, "stl", event.currentTarget) }),
      h("a", { className: "row-button ghost-button", href: `lettera-personalizzata#${configHash(config)}`, target: "_blank", rel: "noopener", text: "Apri nel configuratore" }),
      h("button", { className: "row-button delete-button", type: "button", text: "Elimina", onclick: (event) => remove(request, event.currentTarget) })
    ]);

    return h("article", { className: `request-card status-${request.status}` }, [
      h("header", { className: "request-head" }, [
        h("div", {}, [
          h("p", { className: "request-date", text: dateFormatter.format(new Date(request.created_at)) }),
          h("h3", { className: "request-title", text: `Lettera ${initial} · ${config.name}` }),
          h("p", { className: "request-price", text: `${Core.VERSIONS[config.version].label} · ${Number(request.price).toFixed(0)} €` })
        ]),
        statusSelect
      ]),
      h("div", { className: "request-body" }, [
        h("section", { className: "request-contact" }, [
          h("h4", { text: "Cliente" }),
          h("p", { className: "contact-name", text: request.customer_name }),
          h("p", {}, [h("a", { href: `tel:${request.phone.replace(/[^\d+]/g, "")}`, text: request.phone })]),
          h("p", {}, [h("a", { href: `mailto:${request.email}`, text: request.email })]),
          h("div", { className: "contact-actions" }, [
            wa ? h("a", { className: "row-button whatsapp-button", href: `https://wa.me/${wa}`, target: "_blank", rel: "noopener noreferrer", text: "WhatsApp" }) : null,
            h("a", { className: "row-button ghost-button", href: `tel:${request.phone.replace(/[^\d+]/g, "")}`, text: "Chiama" }),
            h("a", { className: "row-button ghost-button", href: `mailto:${request.email}?subject=${encodeURIComponent(`La tua lettera ${initial} con il nome ${config.name}`)}`, text: "Email" })
          ])
        ]),
        h("section", { className: "request-details" }, [
          h("h4", { text: "Lettera" }),
          h("ul", {}, Core.describe(config).slice(1).map(([label, value]) => h("li", {}, [`${label}: `, h("strong", { text: value })]))),
          params ? sizeWarning(params) : h("p", { className: "request-size is-warning", text: "Parametri del modello non validi: apri nel configuratore e rigenera." })
        ])
      ]),
      request.notes ? h("p", { className: "request-notes" }, [h("strong", { text: "Note: " }), request.notes]) : null,
      actions
    ]);
  }

  function render() {
    updateBadge();
    const list = document.getElementById("request-list");
    const items = visibleRequests();
    document.getElementById("richieste-count").textContent = `${items.length} ${items.length === 1 ? "richiesta" : "richieste"}`;
    if (items.length === 0) {
      setListMessage(filter === "attive" ? "Nessuna richiesta da gestire. Le nuove arrivano anche su Telegram." : "Nessuna richiesta in questo elenco.");
      return;
    }
    list.replaceChildren(...items.map(renderRequest));
  }

  async function load() {
    if (!client) return;
    setListMessage("Caricamento richieste…");
    const { data, error } = await client
      .from("letter_requests")
      .select("id, created_at, status, customer_name, phone, email, notes, config, model_params, price")
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) {
      console.error("Richieste non caricate:", error);
      setListMessage(error.code === "42P01"
        ? "La tabella delle richieste non esiste ancora: esegui supabase-migration-richieste-lettere.sql."
        : "Non è stato possibile caricare le richieste.");
      return;
    }
    requests = data || [];
    render();
  }

  async function updateStatus(request, status, select) {
    select.disabled = true;
    const { error } = await client.from("letter_requests").update({ status }).eq("id", request.id);
    select.disabled = false;
    if (error) {
      console.error(error);
      select.value = request.status;
      window.alert("Stato non aggiornato. Riprova.");
      return;
    }
    request.status = status;
    render();
  }

  async function remove(request, button) {
    const confirmed = window.confirm(`Eliminare definitivamente la richiesta di ${request.customer_name}? I suoi dati verranno cancellati.`);
    if (!confirmed) return;
    button.disabled = true;
    const { error } = await client.from("letter_requests").delete().eq("id", request.id);
    if (error) {
      console.error(error);
      button.disabled = false;
      window.alert("Richiesta non eliminata. Riprova.");
      return;
    }
    requests = requests.filter((item) => item.id !== request.id);
    render();
  }

  // ------------------------------------------------------------ Anteprima

  async function openPreview(request) {
    const params = paramsOf(request);
    if (!params) return;
    const dialog = document.getElementById("request-dialog");
    const status = document.getElementById("request-dialog-status");
    document.getElementById("request-dialog-title").textContent = `Lettera ${Core.getInitial(params.config.name)} · ${params.config.name}`;
    status.textContent = "Genero il modello…";
    status.hidden = false;
    dialog.showModal();

    try {
      const [module, response] = await Promise.all([
        import("./lettera-3d.js"),
        fetch(`${API_URL}?p=${Core.encodeParams(params)}`)
      ]);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!viewer) viewer = module.createViewer(document.getElementById("request-dialog-viewer"), { static: true });
      await viewer.show(await response.arrayBuffer());
      status.hidden = true;
    } catch (error) {
      console.error(error);
      status.textContent = "Anteprima non disponibile.";
    }
  }

  // ------------------------------------------------------------ Download

  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  async function deflate(bytes) {
    if (typeof CompressionStream === "undefined") return null;
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  // Archivio ZIP minimo (file compressi quando conviene).
  async function makeZip(files) {
    const encoder = new TextEncoder();
    const chunks = [];
    const directory = [];
    let offset = 0;
    const now = new Date();
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
    const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

    for (const file of files) {
      const name = encoder.encode(file.name);
      const data = file.data;
      const compressed = await deflate(data);
      const useDeflate = compressed && compressed.length < data.length;
      const body = useDeflate ? compressed : data;
      const crc = crc32(data);

      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);
      local.setUint16(6, 0x0800, true);
      local.setUint16(8, useDeflate ? 8 : 0, true);
      local.setUint16(10, dosTime, true);
      local.setUint16(12, dosDate, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, body.length, true);
      local.setUint32(22, data.length, true);
      local.setUint16(26, name.length, true);
      chunks.push(new Uint8Array(local.buffer), name, body);

      const central = new DataView(new ArrayBuffer(46));
      central.setUint32(0, 0x02014b50, true);
      central.setUint16(4, 20, true);
      central.setUint16(6, 20, true);
      central.setUint16(8, 0x0800, true);
      central.setUint16(10, useDeflate ? 8 : 0, true);
      central.setUint16(12, dosTime, true);
      central.setUint16(14, dosDate, true);
      central.setUint32(16, crc, true);
      central.setUint32(20, body.length, true);
      central.setUint32(24, data.length, true);
      central.setUint16(28, name.length, true);
      central.setUint32(42, offset, true);
      directory.push(new Uint8Array(central.buffer), name);

      offset += 30 + name.length + body.length;
    }

    const directorySize = directory.reduce((sum, chunk) => sum + chunk.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, directorySize, true);
    end.setUint32(16, offset, true);
    return new Blob([...chunks, ...directory, new Uint8Array(end.buffer)], { type: "application/zip" });
  }

  function fileSafe(text) {
    return String(text).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "lettera";
  }

  function readme(params, format) {
    const config = params.config;
    const letter = Core.LETTER_COLORS[config.letterColor].label;
    const accent = Core.ACCENT_COLORS[config.accentColor].label;
    const decorated = config.version === "decorata";
    const lines = [
      `Lettera ${Core.getInitial(config.name)} con il nome ${config.name} — artigianidel3d`,
      Core.describe(config).map(([label, value]) => `${label}: ${value}`).join("\n"),
      ""
    ];
    if (format === "3mf") {
      lines.push(
        "Ogni file .3mf contiene pezzi già allineati: in Bambu Studio importalo e conferma",
        "\"oggetto singolo con più parti\", poi assegna i filamenti:",
        `- 1-lettera-e-decorazioni: lettera in ${letter}${decorated ? `, decorazioni in ${accent}` : ""}. Stampa sdraiata.`,
        `- 2-nome: ${accent}. Stampa sdraiata, poi incolla il nome sulla lettera poco sopra metà altezza.`,
        `- 3-base: ${accent}. Logo inciso sul fondo; la lettera entra nella sede in alto (3 mm).`
      );
      if (config.character !== "nessuno") {
        lines.push(`- 4-personaggio: corpo ${accent}, dettagli bianco, cuore ${letter}, occhi marrone scuro. Supporti ad albero.`);
      }
    } else {
      lines.push(
        "File STL separati, tutti con la stessa origine: importandoli insieme restano allineati.",
        `Colori: lettera ${letter}; nome, base${decorated ? " e decorazioni" : ""} ${accent}.`
      );
      if (config.character !== "nessuno") lines.push(`Personaggio: corpo ${accent}, dettagli bianco, cuore ${letter}, occhi marrone scuro.`);
    }
    return `${lines.join("\n")}\n`;
  }

  async function download(request, format, button) {
    const params = paramsOf(request);
    if (!params) return;
    const label = button.textContent;
    button.disabled = true;

    try {
      const { data } = await client.auth.getSession();
      const token = data.session && data.session.access_token;
      if (!token) throw new Error("Sessione scaduta: accedi di nuovo.");

      const decorated = params.config.version === "decorata";
      const withCharacter = params.config.character !== "nessuno";
      const list = (format === "3mf" ? PRINT_GROUPS : STL_PARTS)
        .filter((item) => (!item.character || withCharacter) && (!item.decorated || decorated));
      const encoded = Core.encodeParams(params);
      const files = [];

      for (const [index, item] of list.entries()) {
        button.textContent = `Genero ${index + 1}/${list.length}…`;
        const response = await fetch(`${API_URL}?p=${encoded}&parte=${item.part}&formato=${format}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.status === 422) continue;
        if (!response.ok) throw new Error(response.status === 401 ? "Accesso non autorizzato." : `Errore ${response.status} su ${item.file}.`);
        files.push({ name: `${item.file}.${format}`, data: new Uint8Array(await response.arrayBuffer()) });
      }

      files.push({ name: "LEGGIMI.txt", data: new TextEncoder().encode(readme(params, format)) });
      const zip = await makeZip(files);
      const link = h("a", {
        href: URL.createObjectURL(zip),
        download: `lettera-${fileSafe(params.config.name)}-${format}.zip`
      });
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 2000);
    } catch (error) {
      console.error(error);
      window.alert(error.message || "Download non riuscito.");
    } finally {
      button.disabled = false;
      button.textContent = label;
    }
  }

  // ------------------------------------------------------------ Schede e avvio

  function selectTab(name) {
    for (const tab of document.querySelectorAll(".admin-tab")) {
      const active = tab.dataset.tab === name;
      tab.setAttribute("aria-selected", active ? "true" : "false");
      tab.tabIndex = active ? 0 : -1;
      document.getElementById(tab.getAttribute("aria-controls")).hidden = !active;
    }
  }

  for (const tab of document.querySelectorAll(".admin-tab")) {
    tab.addEventListener("click", () => selectTab(tab.dataset.tab));
  }

  for (const button of document.querySelectorAll("[data-filter]")) {
    button.addEventListener("click", () => {
      filter = button.dataset.filter;
      for (const other of document.querySelectorAll("[data-filter]")) other.setAttribute("aria-pressed", other === button ? "true" : "false");
      render();
    });
  }

  document.getElementById("richieste-refresh").addEventListener("click", load);
  document.getElementById("request-dialog-close").addEventListener("click", () => document.getElementById("request-dialog").close());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && client) load();
  });

  window.addEventListener("adl:admin-ready", (event) => {
    client = event.detail.client;
    load();
  });
  window.addEventListener("adl:admin-logout", () => {
    client = null;
    requests = [];
    document.getElementById("request-list").replaceChildren();
    updateBadge();
  });
})();
