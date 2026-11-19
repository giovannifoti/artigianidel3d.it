// Logica condivisa della lettera con nome: opzioni, misure, posizione delle
// decorazioni e parametri per modello/lettera-nome.scad.
// Usata dal configuratore, dal pannello admin e dalla funzione che genera il 3D.
// Le misure in M rispecchiano lettera-nome.scad: se ne cambi una, cambiala anche lì.

(function (root) {
  "use strict";

  const VERSIONS = {
    essenziale: { label: "Essenziale", price: 25 },
    decorata: { label: "Decorata", price: 35 }
  };

  const LETTER_FONTS = {
    classica: { label: "Classica", css: "ADL Classica", scad: "DM Serif Display", file: "DMSerifDisplay-Regular.ttf" },
    morbida: { label: "Morbida", css: "ADL Morbida", scad: "Rammetto One", file: "RammettoOne-Regular.ttf" },
    decisa: { label: "Decisa", css: "ADL Decisa", scad: "Archivo Black", file: "ArchivoBlack-Regular.ttf" }
  };

  const NAME_FONTS = {
    tondo: { label: "Tondo", css: "ADL Tondo", scad: "Pacifico", file: "Pacifico-Regular.ttf" },
    elegante: { label: "Elegante", css: "ADL Elegante", scad: "Great Vibes", file: "GreatVibes-Regular.ttf" },
    delicato: { label: "Delicato", css: "ADL Delicato", scad: "Satisfy", file: "Satisfy-Regular.ttf" }
  };

  // Colori dei filamenti disponibili: modifica qui per aggiungerne o toglierne.
  const LETTER_COLORS = {
    azzurro: { label: "Azzurro", hex: "#8fd3e0" },
    rosa: { label: "Rosa", hex: "#f4b6c6" },
    salvia: { label: "Salvia", hex: "#a9c8a4" },
    lilla: { label: "Lilla", hex: "#c6b5e6" },
    giallo: { label: "Giallo burro", hex: "#f6dc8c" },
    avorio: { label: "Avorio", hex: "#f3ecdc" }
  };

  const ACCENT_COLORS = {
    sabbia: { label: "Sabbia", hex: "#d8c3a0" },
    bianco: { label: "Bianco", hex: "#f7f5f0" },
    oro: { label: "Oro", hex: "#d4af5a" },
    grigio: { label: "Grigio perla", hex: "#c9c9cf" }
  };

  // Raggi in frazione dell'altezza della lettera.
  const STAR = { type: "stella", r: 0.0367, min: 0.0233, spin: true };
  const THEMES = {
    cielo: {
      label: "Cielo",
      detail: "mongolfiera, nuvole e stelle",
      items: [
        { type: "mongolfiera", r: 0.133, min: 0.053, hero: true },
        { type: "nuvola", r: 0.08, min: 0.04 },
        { type: "nuvola", r: 0.08, min: 0.04 },
        STAR, STAR, STAR, STAR, STAR, STAR
      ]
    },
    notte: {
      label: "Notte",
      detail: "luna, nuvole e stelle",
      items: [
        { type: "luna", r: 0.107, min: 0.047, hero: true },
        { type: "nuvola", r: 0.08, min: 0.04 },
        { type: "nuvola", r: 0.08, min: 0.04 },
        STAR, STAR, STAR, STAR, STAR, STAR, STAR
      ]
    },
    fiori: {
      label: "Fiori",
      detail: "fiori e farfalle",
      items: [
        { type: "fiore", r: 0.093, min: 0.047, hero: true },
        { type: "farfalla", r: 0.073, min: 0.04, spin: true },
        { type: "farfalla", r: 0.073, min: 0.04, spin: true },
        { type: "fiore", r: 0.0367, min: 0.0233, spin: true },
        { type: "fiore", r: 0.0367, min: 0.0233, spin: true },
        { type: "fiore", r: 0.0367, min: 0.0233, spin: true },
        { type: "fiore", r: 0.0367, min: 0.0233, spin: true },
        { type: "fiore", r: 0.0367, min: 0.0233, spin: true }
      ]
    }
  };

  const DECORATION_TYPES = ["stella", "nuvola", "mongolfiera", "luna", "fiore", "farfalla"];

  const CHARACTERS = {
    orsetto: { label: "Orsetto", height: 98 },
    elefantino: { label: "Elefantino", height: 92 },
    coniglietto: { label: "Coniglietto", height: 114 },
    nessuno: { label: "Nessuno", height: 98 }
  };

  // Misure del modello in mm (vedi lettera-nome.scad)
  const M = {
    letterHeight: 186,
    letterDepth: 30,
    nameMaxHeight: 37,
    nameMinWidth: 180,
    namePosition: 0.52,
    nameDepth: 6,
    nameThicken: 0.3,
    decorationDepth: 1.2,
    baseHeight: 17,
    baseMargin: 22,
    baseChamfer: 2,
    slotDepth: 3,
    characterHeight: 87,
    characterGap: 3,
    characterOffset: 12,
    characterFront: 31,
    characterBack: 23,
    characterHalfWidth: 30,
    decorationMargin: 1.5,
    decorationGap: 2
  };

  const TOTAL_HEIGHT_MM = M.baseHeight - M.slotDepth + M.letterHeight;
  const NAME_PATTERN = /^\p{L}[\p{L}' .-]*$/u;
  const NAME_MAX_LENGTH = 14;

  const DEFAULT_CONFIG = {
    version: "decorata",
    name: "Salvatore",
    letterFont: "classica",
    nameFont: "tondo",
    letterColor: "azzurro",
    accentColor: "sabbia",
    theme: "cielo",
    character: "orsetto"
  };

  // ---------------------------------------------------------------- Utilità

  function round(value, digits = 4) {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
  }

  function hashString(text) {
    let hash = 2166136261;
    for (const character of text) {
      hash ^= character.codePointAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function createRandom(seed) {
    let state = seed || 1;
    return () => {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function normalizeName(raw) {
    return String(raw || "").normalize("NFC").replace(/\s+/g, " ").trim();
  }

  function validateName(name) {
    if (!name) return "Scrivi il nome da stampare.";
    if ([...name].length > NAME_MAX_LENGTH) return `Al massimo ${NAME_MAX_LENGTH} caratteri.`;
    if (!NAME_PATTERN.test(name)) return "Usa solo lettere, spazi, apostrofo o trattino.";
    return "";
  }

  function getInitial(name) {
    const first = [...(name || "A")][0];
    return first.toLocaleUpperCase("it-IT");
  }

  // Riporta qualsiasi oggetto a una configurazione con soli valori ammessi.
  function normalizeConfig(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const pick = (value, options, fallback) => (Object.prototype.hasOwnProperty.call(options, value) ? value : fallback);
    const config = {
      version: pick(source.version, VERSIONS, DEFAULT_CONFIG.version),
      name: normalizeName(source.name),
      letterFont: pick(source.letterFont, LETTER_FONTS, DEFAULT_CONFIG.letterFont),
      nameFont: pick(source.nameFont, NAME_FONTS, DEFAULT_CONFIG.nameFont),
      letterColor: pick(source.letterColor, LETTER_COLORS, DEFAULT_CONFIG.letterColor),
      accentColor: pick(source.accentColor, ACCENT_COLORS, DEFAULT_CONFIG.accentColor),
      theme: pick(source.theme, THEMES, DEFAULT_CONFIG.theme),
      character: pick(source.character, CHARACTERS, DEFAULT_CONFIG.character)
    };
    if (config.version !== "decorata") config.character = "nessuno";
    return config;
  }

  function priceOf(config) {
    return VERSIONS[config.version].price;
  }

  function describe(config) {
    const decorated = config.version === "decorata";
    const lines = [
      ["Versione", `${VERSIONS[config.version].label} (${VERSIONS[config.version].price} €)`],
      ["Nome", config.name || "—"],
      ["Lettera", `${getInitial(config.name)}, stile ${LETTER_FONTS[config.letterFont].label}, colore ${LETTER_COLORS[config.letterColor].label}`],
      ["Scritta del nome", NAME_FONTS[config.nameFont].label],
      [decorated ? "Nome, base e decorazioni" : "Nome e base", ACCENT_COLORS[config.accentColor].label]
    ];
    if (decorated) {
      lines.push(["Decorazioni", `${THEMES[config.theme].label} (${THEMES[config.theme].detail})`]);
      lines.push(["Personaggio", CHARACTERS[config.character].label]);
    }
    return lines;
  }

  // ---------------------------------------------------------------- Misure (solo browser)

  let measureContext = null;

  // Riquadro dell'inchiostro in em: [min x, min y, max x, max y], y verso l'alto.
  function measureText(text, family) {
    if (!measureContext) measureContext = document.createElement("canvas").getContext("2d");
    const size = 200;
    measureContext.font = `${size}px "${family}"`;
    measureContext.textAlign = "left";
    measureContext.textBaseline = "alphabetic";
    const metrics = measureContext.measureText(text);
    return [
      -metrics.actualBoundingBoxLeft / size,
      -metrics.actualBoundingBoxDescent / size,
      metrics.actualBoundingBoxRight / size,
      metrics.actualBoundingBoxAscent / size
    ];
  }

  // Ripete i calcoli di lettera-nome.scad (sezione "Misure derivate").
  function computeLayout(config, boxes) {
    const displayName = config.name || "Nome";
    const letterBox = boxes ? boxes.letterBox : measureText(getInitial(config.name), LETTER_FONTS[config.letterFont].css);
    const nameBox = boxes ? boxes.nameBox : measureText(displayName, NAME_FONTS[config.nameFont].css);

    const H = M.letterHeight;
    const T = M.letterDepth;
    const letterScale = H / (letterBox[3] - letterBox[1]);
    const W = (letterBox[2] - letterBox[0]) * letterScale;

    const nameWidthEm = nameBox[2] - nameBox[0];
    const nameHeightEm = nameBox[3] - nameBox[1];
    const nameMaxWidth = Math.max(M.nameMinWidth, W * 0.95);
    const nameScale = Math.min(M.nameMaxHeight / nameHeightEm, nameMaxWidth / nameWidthEm);

    const decorated = config.version === "decorata";
    const withCharacter = decorated && config.character !== "nessuno";
    const characterScale = M.characterHeight / CHARACTERS[config.character].height;
    const characterX = -W / 2 + M.characterOffset;
    const characterY = -T / 2 - M.characterGap - M.characterBack * characterScale;

    const baseFront = -T / 2 - M.baseMargin - (withCharacter
      ? M.characterGap + (M.characterFront + M.characterBack) * characterScale - M.baseMargin * 0.4
      : 0);
    const baseBack = T / 2 + M.baseMargin;
    const baseCenterY = (baseFront + baseBack) / 2;
    const baseB = (baseBack - baseFront) / 2;
    const semiAxisX = (x, y) => x / Math.sqrt(1 - (y / baseB) ** 2);
    const baseForLetter = semiAxisX(W / 2 + M.baseMargin * 0.6, Math.max(Math.abs(T / 2 - baseCenterY), Math.abs(-T / 2 - baseCenterY)));
    const baseForCharacter = withCharacter
      ? semiAxisX(Math.abs(characterX) + M.characterHalfWidth * characterScale + 6, Math.abs(characterY - baseCenterY))
      : 0;
    const baseA = Math.max(baseForLetter, baseForCharacter, baseB * 1.25);

    return {
      letterBox,
      nameBox,
      initial: getInitial(config.name),
      displayName,
      H,
      T,
      W,
      letterScale,
      nameScale,
      nameWidth: nameWidthEm * nameScale,
      nameHeight: nameHeightEm * nameScale,
      decorated,
      withCharacter,
      characterScale,
      characterX,
      characterY,
      baseA,
      baseB,
      baseCenterY,
      letterZ: M.baseHeight - M.slotDepth,
      baseDiagonal: 2 * Math.sqrt((baseA ** 2 + baseB ** 2) / 2)
    };
  }

  // ---------------------------------------------------------------- Decorazioni (solo browser)

  // Disegna la lettera su una griglia (2 px per mm) per sapere dove c'è materiale.
  function rasterizeLetter(config, layout) {
    const pxPerMm = 2;
    const pad = 4;
    const width = Math.ceil(layout.W * pxPerMm) + pad * 2;
    const height = Math.ceil(layout.H * pxPerMm) + pad * 2;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const fontSize = layout.letterScale * pxPerMm;
    context.font = `${fontSize}px "${LETTER_FONTS[config.letterFont].css}"`;
    context.textBaseline = "alphabetic";
    context.fillStyle = "#000";
    context.fillText(layout.initial, pad - layout.letterBox[0] * fontSize, pad + layout.letterBox[3] * fontSize);
    const alpha = context.getImageData(0, 0, width, height).data;

    return (x, y) => {
      const px = Math.round(pad + x * pxPerMm);
      const py = Math.round(pad + (layout.H - y) * pxPerMm);
      if (px < 0 || py < 0 || px >= width || py >= height) return false;
      return alpha[(py * width + px) * 4 + 3] > 127;
    };
  }

  function circleFits(inside, cx, cy, radius) {
    if (!inside(cx, cy)) return false;
    for (const [fraction, count] of [[1, 28], [0.5, 12]]) {
      for (let index = 0; index < count; index += 1) {
        const angle = (index / count) * Math.PI * 2;
        if (!inside(cx + Math.cos(angle) * radius * fraction, cy + Math.sin(angle) * radius * fraction)) return false;
      }
    }
    return true;
  }

  function computeDecorations(config, layout) {
    if (!layout.decorated) return [];

    const inside = rasterizeLetter(config, layout);
    const random = createRandom(hashString(`${layout.initial}|${config.letterFont}|${config.theme}`));
    const nameCenter = M.namePosition * layout.H;
    const nameHalf = layout.nameHeight / 2 + M.nameThicken;
    const characterRight = M.characterOffset + M.characterHalfWidth * layout.characterScale + 4;
    const characterTop = M.characterHeight + M.slotDepth + 4;
    const placed = [];
    const result = [];

    for (const item of THEMES[config.theme].items) {
      let chosen = null;

      for (let radius = item.r * layout.H; radius >= item.min * layout.H && !chosen; radius *= 0.88) {
        const reach = radius + M.decorationMargin;
        const valid = [];

        for (let attempt = 0; attempt < 900; attempt += 1) {
          const cx = reach + random() * (layout.W - reach * 2);
          const cy = reach + random() * (layout.H - reach * 2);
          if (Math.abs(cy - nameCenter) < nameHalf + radius + 3) continue;
          if (layout.withCharacter && cx - radius < characterRight && cy - radius < characterTop) continue;
          if (placed.some((other) => Math.hypot(other.x - cx, other.y - cy) < other.r + radius + M.decorationGap)) continue;
          if (!circleFits(inside, cx, cy, reach)) continue;
          valid.push({ x: cx, y: cy });
        }

        if (valid.length === 0) continue;

        if (item.hero) {
          chosen = valid.reduce((best, point) => (point.y + point.x * 0.15 > best.y + best.x * 0.15 ? point : best));
        } else {
          // Il punto più lontano da quelli già usati, per distribuire le decorazioni.
          const score = (point) => placed.length === 0
            ? random()
            : Math.min(...placed.map((other) => Math.hypot(other.x - point.x, other.y - point.y) - other.r));
          chosen = valid.reduce((best, point) => (score(point) > score(best) ? point : best));
        }
        chosen.r = radius;
      }

      if (!chosen) continue;
      placed.push(chosen);
      const rotation = item.spin ? Math.round((random() - 0.5) * 50) : 0;
      result.push([item.type, round(chosen.x / layout.W), round(chosen.y / layout.H), round(chosen.r / layout.H), rotation]);
    }

    return result;
  }

  // ---------------------------------------------------------------- Parametri del modello

  // Tutto ciò che serve a lettera-nome.scad, calcolato nel browser con i font del sito.
  function computeModel(config) {
    const layout = computeLayout(config);
    const decorations = computeDecorations(config, layout);
    return {
      layout,
      decorations,
      params: {
        config,
        letterBox: layout.letterBox.map((value) => round(value)),
        nameBox: layout.nameBox.map((value) => round(value)),
        decorations
      }
    };
  }

  // Controlla i parametri ricevuti da fuori (richieste salvate, chiamate alla funzione 3D).
  function validateParams(raw) {
    if (!raw || typeof raw !== "object") return null;
    const config = normalizeConfig(raw.config);
    if (validateName(config.name)) return null;
    const box = (value) => Array.isArray(value) && value.length === 4 && value.every((n) => Number.isFinite(n) && Math.abs(n) < 50)
      && value[2] - value[0] > 0.01 && value[3] - value[1] > 0.01;
    if (!box(raw.letterBox) || !box(raw.nameBox)) return null;
    const decorations = Array.isArray(raw.decorations) ? raw.decorations : [];
    if (decorations.length > 12) return null;
    for (const item of decorations) {
      if (!Array.isArray(item) || item.length !== 5) return null;
      const [type, u, v, r, rotation] = item;
      if (!DECORATION_TYPES.includes(type)) return null;
      if (![u, v].every((n) => Number.isFinite(n) && n >= 0 && n <= 1)) return null;
      if (!Number.isFinite(r) || r <= 0 || r > 0.2) return null;
      if (!Number.isFinite(rotation) || Math.abs(rotation) > 180) return null;
    }
    return {
      config,
      letterBox: raw.letterBox.map((n) => round(n)),
      nameBox: raw.nameBox.map((n) => round(n)),
      decorations: config.version === "decorata"
        ? decorations.map(([type, u, v, r, rotation]) => [type, round(u), round(v), round(r), Math.round(rotation)])
        : []
    };
  }

  function scadString(value) {
    return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }

  // Assegnazioni OpenSCAD da mettere dopo "include <lettera-nome.scad>".
  function toScad(params, includePath) {
    const { config } = params;
    const list = (values) => `[${values.join(", ")}]`;
    const lines = [
      `// ${describe(config).map(([label, value]) => `${label}: ${value}`).join(" · ")}`,
      `include <${includePath}>`,
      "",
      `nome = ${scadString(config.name)};`,
      `lettera = ${scadString(getInitial(config.name))};`,
      `versione = ${scadString(config.version)};`,
      `font_lettera = ${scadString(LETTER_FONTS[config.letterFont].scad)};`,
      `font_nome = ${scadString(NAME_FONTS[config.nameFont].scad)};`,
      `tema = ${scadString(config.theme)};`,
      `personaggio = ${scadString(config.character)};`,
      `colore_lettera = ${scadString(LETTER_COLORS[config.letterColor].hex)}; // ${LETTER_COLORS[config.letterColor].label}`,
      `colore_accenti = ${scadString(ACCENT_COLORS[config.accentColor].hex)}; // ${ACCENT_COLORS[config.accentColor].label}`,
      `colore_personaggio = ${scadString(ACCENT_COLORS[config.accentColor].hex)};`,
      `lettera_bbox = ${list(params.letterBox)};`,
      `nome_bbox = ${list(params.nameBox)};`,
      params.decorations.length > 0
        ? `decorazioni = [\n${params.decorations.map(([type, u, v, r, rotation]) => `  [${scadString(type)}, ${u}, ${v}, ${r}, ${rotation}]`).join(",\n")}\n];`
        : "decorazioni = [];",
      ""
    ];
    return lines.join("\n");
  }

  // Codifica compatta e sicura per URL (base64url di JSON UTF-8).
  function encodeParams(params) {
    const bytes = new TextEncoder().encode(JSON.stringify(params));
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function decodeParams(text) {
    try {
      const base64 = String(text).replace(/-/g, "+").replace(/_/g, "/");
      const binary = atob(base64);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return null;
    }
  }

  function fontFamilies() {
    return [...Object.values(LETTER_FONTS), ...Object.values(NAME_FONTS)].map((font) => font.css);
  }

  async function loadFonts() {
    const timeout = new Promise((resolve) => setTimeout(resolve, 6000));
    await Promise.race([
      Promise.all(fontFamilies().map((family) => document.fonts.load(`100px "${family}"`).catch(() => null))),
      timeout
    ]);
  }

  root.LetteraCore = Object.freeze({
    VERSIONS,
    LETTER_FONTS,
    NAME_FONTS,
    LETTER_COLORS,
    ACCENT_COLORS,
    THEMES,
    CHARACTERS,
    DECORATION_TYPES,
    M,
    TOTAL_HEIGHT_MM,
    NAME_MAX_LENGTH,
    DEFAULT_CONFIG,
    round,
    normalizeName,
    validateName,
    getInitial,
    normalizeConfig,
    priceOf,
    describe,
    computeLayout,
    computeModel,
    validateParams,
    toScad,
    encodeParams,
    decodeParams,
    loadFonts
  });
})(typeof window !== "undefined" ? window : globalThis);
