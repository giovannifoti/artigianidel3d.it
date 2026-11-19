"use strict";

// Configuratore della lettera con nome.
// Le misure e le forme qui sotto rispecchiano modello/lettera-nome.scad: se cambi
// una costante in un file, cambiala anche nell'altro.

const WHATSAPP_NUMBER = "393446498901";
const PAGE_URL = "https://artigianidel3d.it/lettera-personalizzata";
const LAB_STORAGE_KEY = "adl-laboratorio";

const VERSIONS = {
  essenziale: { label: "Essenziale", price: 25 },
  decorata: { label: "Decorata", price: 35 }
};

const LETTER_FONTS = {
  classica: { label: "Classica", css: "ADL Classica", scad: "DM Serif Display" },
  morbida: { label: "Morbida", css: "ADL Morbida", scad: "Titan One" },
  decisa: { label: "Decisa", css: "ADL Decisa", scad: "Archivo Black" }
};

const NAME_FONTS = {
  tondo: { label: "Tondo", css: "ADL Tondo", scad: "Pacifico" },
  elegante: { label: "Elegante", css: "ADL Elegante", scad: "Yellowtail" },
  delicato: { label: "Delicato", css: "ADL Delicato", scad: "Satisfy" }
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

const THEMES = {
  cielo: {
    label: "Cielo",
    detail: "mongolfiera, nuvole e stelle",
    items: [
      { type: "mongolfiera", r: 20, min: 8, hero: true },
      { type: "nuvola", r: 12, min: 6 },
      { type: "nuvola", r: 12, min: 6 },
      ...Array(6).fill({ type: "stella", r: 5.5, min: 3.5, spin: true })
    ]
  },
  notte: {
    label: "Notte",
    detail: "luna, nuvole e stelle",
    items: [
      { type: "luna", r: 16, min: 7, hero: true },
      { type: "nuvola", r: 12, min: 6 },
      { type: "nuvola", r: 12, min: 6 },
      ...Array(7).fill({ type: "stella", r: 5.5, min: 3.5, spin: true })
    ]
  },
  fiori: {
    label: "Fiori",
    detail: "fiori e farfalle",
    items: [
      { type: "fiore", r: 14, min: 7, hero: true },
      { type: "farfalla", r: 11, min: 6, spin: true },
      { type: "farfalla", r: 11, min: 6, spin: true },
      ...Array(5).fill({ type: "fiore", r: 5.5, min: 3.5, spin: true })
    ]
  }
};

const CHARACTERS = {
  orsetto: { label: "Orsetto", height: 98 },
  elefantino: { label: "Elefantino", height: 92 },
  coniglietto: { label: "Coniglietto", height: 114 },
  nessuno: { label: "Nessuno", height: 98 }
};

// ------------------------------------------------------------ Misure del modello (mm)

const M = {
  letterHeight: 150,
  letterDepth: 25,
  nameMaxHeight: 30,
  nameMinWidth: 145,
  namePosition: 0.52,
  nameDepth: 5,
  nameThicken: 0.3,
  decorationDepth: 1.2,
  baseHeight: 14,
  baseMargin: 18,
  baseChamfer: 2,
  slotDepth: 3,
  characterHeight: 70,
  characterGap: 3,
  characterFront: 31,
  characterBack: 23,
  characterHalfWidth: 30,
  decorationMargin: 1.5,
  decorationGap: 2
};

const NAME_PATTERN = /^\p{L}[\p{L}' .-]*$/u;
const NAME_MAX_LENGTH = 14;

// Proiezione obliqua: la profondità (y) sale verso destra.
const DEPTH_X = 0.42;
const DEPTH_Y = 0.3;

const SVG_NS = "http://www.w3.org/2000/svg";

// ------------------------------------------------------------ Utilità

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function shade(hex, amount) {
  const value = parseInt(hex.slice(1), 16);
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  const target = amount < 0 ? 0 : 255;
  const mixed = channels.map((channel) => Math.round(channel + (target - channel) * Math.abs(amount)));
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

function project(x, y, z) {
  return [x + y * DEPTH_X, -z - y * DEPTH_Y];
}

function formatEuro(value) {
  return `${value} €`;
}

// ------------------------------------------------------------ Stato del modulo

function normalizeName(raw) {
  return String(raw || "").replace(/\s+/g, " ").trim();
}

function validateName(name) {
  if (!name) return "Scrivi il nome da stampare.";
  if ([...name].length > NAME_MAX_LENGTH) return `Al massimo ${NAME_MAX_LENGTH} caratteri.`;
  if (!NAME_PATTERN.test(name)) return "Usa solo lettere, spazi, apostrofo o trattino.";
  return "";
}

function getInitial(name) {
  const first = [...name][0] || "A";
  return first.toLocaleUpperCase("it-IT");
}

function readState(form) {
  const data = new FormData(form);
  const version = VERSIONS[data.get("versione")] ? data.get("versione") : "decorata";
  const name = normalizeName(data.get("nome"));
  return {
    version,
    name,
    displayName: name || "Nome",
    initial: getInitial(name || "Nome"),
    letterFont: LETTER_FONTS[data.get("fontLettera")] ? data.get("fontLettera") : "classica",
    nameFont: NAME_FONTS[data.get("fontNome")] ? data.get("fontNome") : "tondo",
    letterColor: LETTER_COLORS[data.get("coloreLettera")] ? data.get("coloreLettera") : "azzurro",
    accentColor: ACCENT_COLORS[data.get("coloreAccenti")] ? data.get("coloreAccenti") : "sabbia",
    theme: THEMES[data.get("tema")] ? data.get("tema") : "cielo",
    character: CHARACTERS[data.get("personaggio")] ? data.get("personaggio") : "orsetto",
    notes: String(data.get("note") || "").trim().slice(0, 300)
  };
}

// ------------------------------------------------------------ Misure dei testi

const measureCanvas = document.createElement("canvas");
const measureContext = measureCanvas.getContext("2d");

// Riquadro dell'inchiostro in em: [min x, min y, max x, max y], y verso l'alto.
function measureText(text, family) {
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
function computeLayout(state) {
  const letterBox = measureText(state.initial, LETTER_FONTS[state.letterFont].css);
  const nameBox = measureText(state.displayName, NAME_FONTS[state.nameFont].css);

  const H = M.letterHeight;
  const T = M.letterDepth;
  const letterScale = H / (letterBox[3] - letterBox[1]);
  const W = (letterBox[2] - letterBox[0]) * letterScale;

  const nameWidthEm = nameBox[2] - nameBox[0];
  const nameHeightEm = nameBox[3] - nameBox[1];
  const nameMaxWidth = Math.max(M.nameMinWidth, W * 0.95);
  const nameScale = Math.min(M.nameMaxHeight / nameHeightEm, nameMaxWidth / nameWidthEm);

  const decorated = state.version === "decorata";
  const withCharacter = decorated && state.character !== "nessuno";
  const characterScale = M.characterHeight / CHARACTERS[state.character].height;
  const characterX = -W / 2 + 10;
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
    letterZ: M.baseHeight - M.slotDepth
  };
}

// ------------------------------------------------------------ Posizione delle decorazioni

// Disegna la lettera su una griglia (2 px per mm) per sapere dove c'è materiale.
function rasterizeLetter(state, layout) {
  const pxPerMm = 2;
  const pad = 4;
  const width = Math.ceil(layout.W * pxPerMm) + pad * 2;
  const height = Math.ceil(layout.H * pxPerMm) + pad * 2;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const fontSize = layout.letterScale * pxPerMm;
  context.font = `${fontSize}px "${LETTER_FONTS[state.letterFont].css}"`;
  context.textBaseline = "alphabetic";
  context.fillStyle = "#000";
  context.fillText(
    state.initial,
    pad - layout.letterBox[0] * fontSize,
    pad + layout.letterBox[3] * fontSize
  );
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

function computeDecorations(state, layout) {
  if (!layout.decorated) return [];

  const inside = rasterizeLetter(state, layout);
  const random = createRandom(hashString(`${state.initial}|${state.letterFont}|${state.theme}`));
  const nameCenter = M.namePosition * layout.H;
  const nameHalf = layout.nameHeight / 2 + M.nameThicken;
  const characterRight = 10 + M.characterHalfWidth * layout.characterScale + 4;
  const characterTop = M.characterHeight + M.slotDepth + 4;
  const placed = [];
  const result = [];

  for (const item of THEMES[state.theme].items) {
    let chosen = null;

    for (let radius = item.r; radius >= item.min && !chosen; radius *= 0.88) {
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
    result.push([
      item.type,
      round(chosen.x / layout.W),
      round(chosen.y / layout.H),
      round(chosen.r / layout.H),
      rotation
    ]);
  }

  return result;
}

// ------------------------------------------------------------ Forme SVG (coordinate con y verso l'alto)

let uniqueCounter = 0;

function nextId(prefix) {
  uniqueCounter += 1;
  return `${prefix}-${uniqueCounter}`;
}

function circle(x, y, r, attributes = "") {
  return `<circle cx="${round(x, 3)}" cy="${round(y, 3)}" r="${round(r, 3)}" ${attributes}/>`;
}

function ellipse(x, y, rx, ry, attributes = "", rotation = 0) {
  const transform = rotation ? ` transform="rotate(${rotation} ${round(x, 3)} ${round(y, 3)})"` : "";
  return `<ellipse cx="${round(x, 3)}" cy="${round(y, 3)}" rx="${round(rx, 3)}" ry="${round(ry, 3)}"${transform} ${attributes}/>`;
}

function polygon(points, attributes = "") {
  return `<polygon points="${points.map(([x, y]) => `${round(x, 3)},${round(y, 3)}`).join(" ")}" ${attributes}/>`;
}

// Inviluppo convesso di due cerchi uno sopra l'altro (come hull() in OpenSCAD).
function verticalCapsulePath(topY, topR, bottomY, bottomR) {
  const distance = topY - bottomY;
  const sin = (topR - bottomR) / distance;
  const cos = Math.sqrt(1 - sin * sin);
  // I punti di tangenza stanno sotto l'equatore di ciascun cerchio.
  const p = (y, r, side) => `${round(side * r * cos, 3)} ${round(y - r * sin, 3)}`;
  return `M ${p(topY, topR, -1)} A ${topR} ${topR} 0 1 0 ${p(topY, topR, 1)} ` +
    `L ${p(bottomY, bottomR, 1)} A ${bottomR} ${bottomR} 0 0 0 ${p(bottomY, bottomR, -1)} Z`;
}

function tangentPoint(from, center, radius, side) {
  const dx = center[0] - from[0];
  const dy = center[1] - from[1];
  const distance = Math.hypot(dx, dy);
  const beta = Math.asin(Math.min(1, radius / distance)) * side;
  const length = Math.sqrt(Math.max(0, distance * distance - radius * radius));
  const angle = Math.atan2(dy, dx) + beta;
  return [from[0] + Math.cos(angle) * length, from[1] + Math.sin(angle) * length];
}

function heartShape(cx, cy, size, attributes) {
  const r = size * 0.3;
  const tip = [cx, cy - size * 0.55];
  let shapes = "";
  for (const side of [-1, 1]) {
    const center = [cx + side * r * 0.7, cy + r * 0.35];
    shapes += circle(center[0], center[1], r, attributes);
    shapes += polygon([tip, tangentPoint(tip, center, r, 1), center, tangentPoint(tip, center, r, -1)], attributes);
  }
  return shapes;
}

function starPoints(r) {
  return Array.from({ length: 10 }, (_, index) => {
    const angle = ((90 + index * 36) * Math.PI) / 180;
    const radius = index % 2 === 0 ? r : r * 0.48;
    return [radius * Math.cos(angle), radius * Math.sin(angle)];
  });
}

function decorationShape(type, r, fill, background) {
  const paint = `fill="${fill}"`;
  switch (type) {
    case "stella":
      return polygon(starPoints(r), `${paint} stroke="${fill}" stroke-width="${round(r * 0.12, 3)}" stroke-linejoin="round"`);
    case "nuvola":
      return circle(-0.45 * r, -0.1 * r, 0.42 * r, paint) +
        circle(0, 0.12 * r, 0.55 * r, paint) +
        circle(0.45 * r, -0.05 * r, 0.45 * r, paint) +
        `<rect x="${round(-0.45 * r, 3)}" y="${round(-0.5 * r, 3)}" width="${round(0.9 * r, 3)}" height="${round(0.42 * r, 3)}" ${paint}/>`;
    case "mongolfiera": {
      const stripe = Math.max(0.06 * r, 0.9);
      const clipId = nextId("pallone");
      const envelope = verticalCapsulePath(0.25 * r, 0.62 * r, -0.42 * r, 0.14 * r);
      let svg = `<clipPath id="${clipId}"><path d="${envelope}"/></clipPath><path d="${envelope}" ${paint}/>`;
      svg += `<g clip-path="url(#${clipId})" fill="none" stroke="${background}" stroke-width="${round(stripe, 3)}">`;
      for (const side of [-1, 1]) svg += ellipse(side * 0.24 * r, 0.12 * r, 0.2496 * r - stripe / 2, 0.78 * r - stripe * 1.5);
      svg += "</g>";
      for (const side of [-1, 1]) {
        svg += `<line x1="${round(side * 0.12 * r, 3)}" y1="${round(-0.48 * r, 3)}" x2="${round(side * 0.13 * r, 3)}" y2="${round(-0.72 * r, 3)}" stroke="${fill}" stroke-width="${round(stripe, 3)}" stroke-linecap="round"/>`;
      }
      svg += `<rect x="${round(-0.16 * r, 3)}" y="${round(-0.95 * r, 3)}" width="${round(0.32 * r, 3)}" height="${round(0.24 * r, 3)}" rx="${round(0.03 * r, 3)}" ${paint}/>`;
      return svg;
    }
    case "luna": {
      const maskId = nextId("luna");
      return `<mask id="${maskId}"><rect x="${-r}" y="${-r}" width="${2 * r}" height="${2 * r}" fill="#fff"/>` +
        circle(0.38 * r, 0.22 * r, 0.78 * r, `fill="#000"`) + `</mask>` +
        circle(0, 0, 0.9 * r, `${paint} mask="url(#${maskId})"`);
    }
    case "fiore": {
      let svg = "";
      for (let index = 0; index < 5; index += 1) {
        const angle = ((90 + index * 72) * Math.PI) / 180;
        svg += circle(Math.cos(angle) * 0.5 * r, Math.sin(angle) * 0.5 * r, 0.42 * r, paint);
      }
      return svg + circle(0, 0, 0.27 * r, `fill="${background}"`) + circle(0, 0, 0.17 * r, paint);
    }
    case "farfalla": {
      const gap = Math.max(0.06 * r, 0.8);
      let svg = "";
      for (const side of [-1, 1]) {
        svg += ellipse(side * (0.38 * r + gap), 0.22 * r, 0.38 * 0.9 * r, 0.5 * 0.9 * r, paint, side * -20);
        svg += ellipse(side * (0.3 * r + gap), -0.3 * r, 0.26 * 0.9 * r, 0.34 * 0.9 * r, paint, side * 25);
      }
      return svg + ellipse(0, 0, 0.11 * r, 0.62 * r, paint);
    }
    default:
      return "";
  }
}

// ------------------------------------------------------------ Personaggi (vista frontale, unità native)

const E = (group, x, z, rx, rz, rotation = 0) => ({ kind: "ellipse", group, x, z, rx, rz, rotation });
const mirrored = (factory) => [factory(-1), factory(1)];

const CHARACTER_SHAPES = {
  orsetto: [
    ...mirrored((s) => E("corpo", s * 16, 90, 8.5, 8.5)),
    ...mirrored((s) => E("dettagli", s * 16, 90, 5, 5)),
    E("corpo", 0, 32, 26, 30),
    ...mirrored((s) => E("corpo", s * 25, 40, 8, 15, s * 28)),
    ...mirrored((s) => E("corpo", s * 16, 11, 11, 11)),
    ...mirrored((s) => E("dettagli", s * 16, 11, 6.5, 6.5)),
    { kind: "heart", group: "cuore", x: 0, z: 34, size: 13 },
    E("corpo", 0, 72, 23, 21),
    E("dettagli", 0, 66, 10, 7.5),
    E("occhi", 0, 69, 3.6, 2.6),
    ...mirrored((s) => E("occhi", s * 8.5, 76.5, 2.6, 2.6))
  ],
  elefantino: [
    ...mirrored((s) => E("corpo", s * 25, 70, 14.5, 17)),
    ...mirrored((s) => E("dettagli", s * 25, 70, 10, 13)),
    E("corpo", 0, 30, 27, 29),
    ...mirrored((s) => E("corpo", s * 14, 10, 9.5, 10)),
    ...mirrored((s) => E("dettagli", s * 14, 10, 6.5, 6.5)),
    { kind: "heart", group: "cuore", x: 0, z: 20, size: 12 },
    E("corpo", 0, 68, 23, 22),
    { kind: "trunk", group: "corpo" },
    ...mirrored((s) => E("occhi", s * 9, 74, 2.5, 2.5))
  ],
  coniglietto: [
    ...mirrored((s) => E("corpo", s * 8, 94, 6.5, 19, -s * 10)),
    ...mirrored((s) => E("dettagli", s * 8, 95, 3.6, 14, -s * 10)),
    E("corpo", 0, 28, 24, 27),
    ...mirrored((s) => E("corpo", s * 22, 35, 7, 13, s * 25)),
    ...mirrored((s) => E("corpo", s * 14, 9, 9, 9)),
    ...mirrored((s) => E("dettagli", s * 14, 9, 6, 6)),
    { kind: "heart", group: "cuore", x: 0, z: 29, size: 12 },
    E("corpo", 0, 64, 21, 19),
    ...mirrored((s) => E("dettagli", s * 3.6, 58.5, 4.6, 4)),
    E("occhi", 0, 62, 2.6, 2),
    ...mirrored((s) => E("occhi", s * 8, 69, 2.4, 2.4))
  ]
};

// Restituisce il personaggio in coordinate con y verso l'alto, piedi su y = 0.
function characterShapes(character, colors, gradientPrefix) {
  const shapes = CHARACTER_SHAPES[character];
  if (!shapes) return "";
  const cut = 2;
  const fills = {
    corpo: `url(#${gradientPrefix}-corpo)`,
    dettagli: `url(#${gradientPrefix}-dettagli)`,
    cuore: colors.heart,
    occhi: colors.eyes
  };
  const gradient = (id, color) => `<radialGradient id="${id}" cx="0.38" cy="0.32" r="0.75">` +
    `<stop offset="0" stop-color="${shade(color, 0.28)}"/><stop offset="0.55" stop-color="${color}"/>` +
    `<stop offset="1" stop-color="${shade(color, -0.22)}"/></radialGradient>`;
  let svg = `<defs>${gradient(`${gradientPrefix}-corpo`, colors.body)}${gradient(`${gradientPrefix}-dettagli`, colors.details)}</defs>`;
  svg += `<g transform="translate(0 ${-cut})">`;
  for (const shape of shapes) {
    const fill = `fill="${fills[shape.group]}"`;
    if (shape.kind === "ellipse") {
      svg += ellipse(shape.x, shape.z, shape.rx, shape.rz, fill, shape.rotation);
    } else if (shape.kind === "heart") {
      svg += heartShape(shape.x, shape.z, shape.size, fill);
    } else if (shape.kind === "trunk") {
      svg += `<path d="M -7 63 L 7 63 L 4.5 39.5 A 4.5 4.5 0 0 1 -4.5 39.5 Z" ${fill}/>`;
    }
  }
  return `${svg}</g>`;
}

// ------------------------------------------------------------ Anteprima

function ellipsePath(layout, z, inset = 0) {
  const points = [];
  for (let index = 0; index < 96; index += 1) {
    const t = (index / 96) * Math.PI * 2;
    const x = (layout.baseA - inset) * Math.cos(t);
    const y = layout.baseCenterY + (layout.baseB - inset) * Math.sin(t);
    points.push(project(x, y, z));
  }
  return `M ${points.map(([x, y]) => `${round(x, 2)} ${round(y, 2)}`).join(" L ")} Z`;
}

function buildPreview(state, layout, decorations) {
  const letterColor = LETTER_COLORS[state.letterColor].hex;
  const accent = ACCENT_COLORS[state.accentColor].hex;
  const accentSide = shade(accent, -0.2);
  const letterSide = shade(letterColor, -0.2);
  const { H, T, W, letterZ } = layout;
  const parts = [];

  parts.push(`<defs>
    <filter id="ombra-morbida" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
    <filter id="ombra-nome" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="1.6"/></filter>
    <filter id="rilievo" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0.5" dy="0.8" stdDeviation="0.5" flood-color="#000" flood-opacity="0.28"/></filter>
  </defs>`);

  // Ombra a terra e base
  const [shadowX, shadowY] = project(0, layout.baseCenterY, 0);
  parts.push(ellipse(shadowX, shadowY + 6, layout.baseA * 1.02, layout.baseB * DEPTH_Y * 2 + 6, `fill="rgba(20,24,28,0.22)" filter="url(#ombra-morbida)"`));
  for (let z = 0; z <= M.baseHeight - M.baseChamfer; z += 1) {
    parts.push(`<path d="${ellipsePath(layout, z)}" fill="${z === 0 ? shade(accentSide, -0.1) : accentSide}"/>`);
  }
  for (let step = 1; step <= M.baseChamfer; step += 0.5) {
    parts.push(`<path d="${ellipsePath(layout, M.baseHeight - M.baseChamfer + step, step)}" fill="${shade(accent, -0.08)}"/>`);
  }
  parts.push(`<path d="${ellipsePath(layout, M.baseHeight, M.baseChamfer)}" fill="${accent}"/>`);

  // Lettera: copie sovrapposte per lo spessore, poi la faccia
  const letterFamily = LETTER_FONTS[state.letterFont].css;
  const fontSize = layout.letterScale;
  const penX = -W / 2 - layout.letterBox[0] * fontSize;
  const baselineZ = letterZ - layout.letterBox[1] * fontSize;
  const letterText = (y, attributes) => {
    const [x, screenY] = project(penX, y, baselineZ);
    return `<text x="${round(x, 2)}" y="${round(screenY, 2)}" font-family="${letterFamily}" font-size="${round(fontSize, 3)}" ${attributes}>${escapeXml(state.initial)}</text>`;
  };
  for (let depth = T / 2; depth > -T / 2; depth -= 1) {
    parts.push(letterText(depth, `fill="${letterSide}"`));
  }
  parts.push(letterText(-T / 2, `fill="${letterColor}" stroke="${shade(letterColor, -0.12)}" stroke-width="0.5"`));

  // Decorazioni sulla faccia
  if (decorations.length > 0) {
    let group = `<g filter="url(#rilievo)">`;
    for (const [type, u, v, radius, rotation] of decorations) {
      const [x, y] = project(-W / 2 + u * W, -T / 2 - M.decorationDepth, letterZ + v * H);
      group += `<g transform="translate(${round(x, 2)} ${round(y, 2)}) scale(1 -1) rotate(${rotation})">` +
        decorationShape(type, radius * H, accent, letterColor) + `</g>`;
    }
    parts.push(`${group}</g>`);
  }

  // Nome in corsivo, con la sua ombra sulla lettera
  const nameFamily = NAME_FONTS[state.nameFont].css;
  const nameSize = layout.nameScale;
  const box = layout.nameBox;
  const nameCenterZ = letterZ + M.namePosition * H;
  const namePenX = -((box[0] + box[2]) / 2) * nameSize;
  const nameBaselineZ = nameCenterZ - ((box[1] + box[3]) / 2) * nameSize;
  const nameText = (y, attributes, dx = 0, dy = 0) => {
    const [x, screenY] = project(namePenX, y, nameBaselineZ);
    return `<text x="${round(x + dx, 2)}" y="${round(screenY + dy, 2)}" font-family="${nameFamily}" font-size="${round(nameSize, 3)}" stroke-width="${M.nameThicken * 2}" stroke-linejoin="round" ${attributes}>${escapeXml(state.displayName)}</text>`;
  };
  parts.push(nameText(-T / 2, `fill="rgba(0,0,0,0.3)" stroke="rgba(0,0,0,0.3)" filter="url(#ombra-nome)"`, 2.5, 3.5));
  for (let depth = 0; depth < M.nameDepth; depth += 0.75) {
    parts.push(nameText(-T / 2 - depth, `fill="${accentSide}" stroke="${accentSide}"`));
  }
  parts.push(nameText(-T / 2 - M.nameDepth, `fill="${accent}" stroke="${accent}"`));

  // Personaggio davanti alla lettera
  if (layout.withCharacter) {
    const [x, y] = project(layout.characterX, layout.characterY, M.baseHeight);
    const scale = layout.characterScale;
    parts.push(ellipse(x + 4, y - 2, 28 * scale, 7 * scale, `fill="rgba(0,0,0,0.18)" filter="url(#ombra-nome)"`));
    parts.push(`<g transform="translate(${round(x, 2)} ${round(y, 2)}) scale(${round(scale, 4)} ${round(-scale, 4)})">` +
      characterShapes(state.character, {
        body: accent,
        details: "#fbf8f2",
        heart: letterColor,
        eyes: "#3b2b25"
      }, "pers") + `</g>`);
  }

  // Inquadratura: comprende base, lettera e nome
  const corners = [];
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) corners.push(project(sx * layout.baseA, layout.baseCenterY + sy * layout.baseB, 0));
  }
  corners.push(project(-W / 2, -T / 2, letterZ + H), project(W / 2, T / 2, letterZ + H));
  corners.push(project(-layout.nameWidth / 2, -T / 2, nameCenterZ), project(layout.nameWidth / 2, -T / 2, nameCenterZ));
  const xs = corners.map(([x]) => x);
  const ys = corners.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys) + 14;
  const side = Math.max(maxX - minX, maxY - minY) + 40;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const viewBox = [centerX - side / 2, centerY - side / 2, side, side].map((value) => round(value, 2)).join(" ");

  return { markup: parts.join(""), viewBox };
}

// ------------------------------------------------------------ Icone delle scelte

function themeIcon(theme) {
  const hero = THEMES[theme].items[0].type;
  return `<svg viewBox="-24 -24 48 48" aria-hidden="true"><g transform="scale(1 -1)">` +
    `<rect x="-24" y="-24" width="48" height="48" rx="12" fill="#e6f3f6"/>` +
    decorationShape(hero, 16, "#c9ad80", "#e6f3f6") + `</g></svg>`;
}

function characterIcon(character) {
  if (character === "nessuno") {
    return `<svg viewBox="-24 -24 48 48" aria-hidden="true"><circle r="15" fill="none" stroke="#b9b3aa" stroke-width="2.5"/>` +
      `<path d="M -10 10 L 10 -10" stroke="#b9b3aa" stroke-width="2.5" stroke-linecap="round"/></svg>`;
  }
  const height = CHARACTERS[character].height;
  return `<svg viewBox="-62 -${height + 6} 124 ${height + 12}" aria-hidden="true"><g transform="scale(1 -1)">` +
    characterShapes(character, { body: "#d8c3a0", details: "#fbf8f2", heart: "#8fd3e0", eyes: "#3b2b25" }, `icona-${character}`) +
    `</g></svg>`;
}

function buildChoiceGroups() {
  const swatchGroup = (containerId, name, colors, selected) => {
    const container = document.getElementById(containerId);
    container.innerHTML = Object.entries(colors).map(([key, color]) =>
      `<label class="choice" title="${color.label}"><input type="radio" name="${name}" value="${key}"${key === selected ? " checked" : ""}>` +
      `<span class="swatch" style="background:${color.hex}"><span class="visually-hidden">${color.label}</span></span></label>`
    ).join("");
  };
  swatchGroup("colore-lettera-group", "coloreLettera", LETTER_COLORS, "azzurro");
  swatchGroup("colore-accenti-group", "coloreAccenti", ACCENT_COLORS, "sabbia");

  document.getElementById("tema-group").innerHTML = Object.entries(THEMES).map(([key, theme]) =>
    `<label class="choice"><input type="radio" name="tema" value="${key}"${key === "cielo" ? " checked" : ""}>` +
    `<span class="chip icon-chip">${themeIcon(key)}<span class="chip-label">${theme.label}</span></span></label>`
  ).join("");

  document.getElementById("personaggio-group").innerHTML = Object.entries(CHARACTERS).map(([key, character]) =>
    `<label class="choice"><input type="radio" name="personaggio" value="${key}"${key === "orsetto" ? " checked" : ""}>` +
    `<span class="chip icon-chip">${characterIcon(key)}<span class="chip-label">${character.label}</span></span></label>`
  ).join("");
  document.getElementById("personaggio-group").style.gridTemplateColumns = "repeat(4, minmax(0, 1fr))";
}

// ------------------------------------------------------------ Ordine e laboratorio

function describe(state) {
  const lines = [
    ["Versione", `${VERSIONS[state.version].label} (${formatEuro(VERSIONS[state.version].price)})`],
    ["Nome", state.name || "—"],
    ["Lettera", `${state.initial}, stile ${LETTER_FONTS[state.letterFont].label}, colore ${LETTER_COLORS[state.letterColor].label}`],
    ["Scritta del nome", NAME_FONTS[state.nameFont].label],
    [state.version === "decorata" ? "Nome, base e decorazioni" : "Nome e base", ACCENT_COLORS[state.accentColor].label]
  ];
  if (state.version === "decorata") {
    lines.push(["Decorazioni", `${THEMES[state.theme].label} (${THEMES[state.theme].detail})`]);
    lines.push(["Personaggio", CHARACTERS[state.character].label]);
  }
  return lines;
}

function stateToHash(state) {
  const params = new URLSearchParams({
    v: state.version,
    n: state.name,
    fl: state.letterFont,
    fn: state.nameFont,
    cl: state.letterColor,
    ca: state.accentColor
  });
  if (state.version === "decorata") {
    params.set("t", state.theme);
    params.set("p", state.character);
  }
  return params.toString();
}

function buildWhatsAppUrl(state) {
  const lines = describe(state).map(([label, value]) => `• ${label}: ${value}`);
  if (state.notes) lines.push(`• Note: ${state.notes}`);
  const message = [
    "Ciao! Vorrei ordinare la lettera con nome personalizzata:",
    ...lines,
    "",
    `Riepilogo: ${PAGE_URL}#${stateToHash(state)}`
  ].join("\n");
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

function scadString(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function buildScad(state, layout, decorations) {
  const today = new Date().toLocaleDateString("it-IT");
  const list = (values) => `[${values.map((value) => round(value)).join(", ")}]`;
  const decorationLines = decorations.map(([type, u, v, radius, rotation]) =>
    `  [${scadString(type)}, ${u}, ${v}, ${radius}, ${rotation}]`
  );
  const lines = [
    `// Ordine lettera con nome — artigianidel3d, ${today}`,
    `// ${describe(state).map(([label, value]) => `${label}: ${value}`).join(" · ")}`
  ];
  if (state.notes) lines.push(`// Note del cliente: ${state.notes.replace(/\s+/g, " ")}`);
  lines.push(
    "include <../lettera-nome.scad>",
    "",
    `nome = ${scadString(state.name)};`,
    `lettera = ${scadString(state.initial)};`,
    `versione = ${scadString(state.version)};`,
    `font_lettera = ${scadString(LETTER_FONTS[state.letterFont].scad)};`,
    `font_nome = ${scadString(NAME_FONTS[state.nameFont].scad)};`,
    `tema = ${scadString(state.theme)};`,
    `personaggio = ${scadString(state.version === "decorata" ? state.character : "nessuno")};`,
    `colore_lettera = ${scadString(LETTER_COLORS[state.letterColor].hex)}; // ${LETTER_COLORS[state.letterColor].label}`,
    `colore_accenti = ${scadString(ACCENT_COLORS[state.accentColor].hex)}; // ${ACCENT_COLORS[state.accentColor].label}`,
    `colore_personaggio = ${scadString(ACCENT_COLORS[state.accentColor].hex)};`,
    `lettera_bbox = ${list(layout.letterBox)};`,
    `nome_bbox = ${list(layout.nameBox)};`,
    decorationLines.length > 0 ? `decorazioni = [\n${decorationLines.join(",\n")}\n];` : "decorazioni = [];",
    ""
  );
  return lines.join("\n");
}

function fileSafeName(name) {
  return (name || "ordine").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "ordine";
}

// ------------------------------------------------------------ Avvio

function applyHash(form) {
  const hash = window.location.hash.slice(1);
  if (!hash) return;
  const params = new URLSearchParams(hash);

  if (params.has("laboratorio")) {
    if (params.get("laboratorio") === "0") localStorage.removeItem(LAB_STORAGE_KEY);
    else localStorage.setItem(LAB_STORAGE_KEY, "1");
  }

  const setRadio = (name, value) => {
    const input = value && form.querySelector(`input[name="${name}"][value="${CSS.escape(value)}"]`);
    if (input) input.checked = true;
  };
  setRadio("versione", params.get("v"));
  setRadio("fontLettera", params.get("fl"));
  setRadio("fontNome", params.get("fn"));
  setRadio("coloreLettera", params.get("cl"));
  setRadio("coloreAccenti", params.get("ca"));
  setRadio("tema", params.get("t"));
  setRadio("personaggio", params.get("p"));
  const name = normalizeName(params.get("n"));
  if (name && !validateName(name)) form.elements.nome.value = name;
}

async function loadFonts() {
  const families = [...Object.values(LETTER_FONTS), ...Object.values(NAME_FONTS)].map((font) => font.css);
  const timeout = new Promise((resolve) => setTimeout(resolve, 6000));
  await Promise.race([
    Promise.all(families.map((family) => document.fonts.load(`100px "${family}"`).catch(() => null))),
    timeout
  ]);
}

async function init() {
  const form = document.getElementById("config-form");
  const preview = document.getElementById("preview");
  const loading = document.getElementById("preview-loading");
  const nameInput = document.getElementById("nome");
  const nameError = document.getElementById("nome-error");
  const nameCounter = document.getElementById("nome-counter");
  const decorationStep = document.getElementById("step-decorazioni");
  const noteNumber = document.getElementById("note-number");
  const summaryPrice = document.getElementById("summary-price");
  const mobilePrice = document.getElementById("mobile-price");
  const summaryList = document.getElementById("summary-list");
  const orderButton = document.getElementById("order-button");
  const lab = document.getElementById("lab");
  const labOutput = document.getElementById("lab-output");
  const previewTitle = document.getElementById("preview-title");

  buildChoiceGroups();
  applyHash(form);
  lab.hidden = localStorage.getItem(LAB_STORAGE_KEY) !== "1";

  await loadFonts();
  loading.hidden = true;

  let current = null;
  let frame = 0;

  const render = () => {
    frame = 0;
    const state = readState(form);
    const error = validateName(state.name);

    nameInput.setAttribute("aria-invalid", error ? "true" : "false");
    nameError.textContent = error;
    nameCounter.textContent = `${[...state.name].length}/${NAME_MAX_LENGTH}`;

    for (const sample of document.querySelectorAll('[data-sample="nome"]')) sample.textContent = state.displayName;
    for (const sample of document.querySelectorAll('[data-sample="lettera"]')) sample.textContent = state.initial;
    document.getElementById("colore-lettera-name").innerHTML = `Scelto: <strong>${LETTER_COLORS[state.letterColor].label}</strong>`;
    document.getElementById("colore-accenti-name").innerHTML = `Scelto: <strong>${ACCENT_COLORS[state.accentColor].label}</strong>`;

    const decorated = state.version === "decorata";
    decorationStep.hidden = !decorated;
    noteNumber.textContent = decorated ? "6" : "5";
    document.getElementById("colore-accenti-label").textContent = decorated
      ? "Colore di nome, base e decorazioni"
      : "Colore di nome e base";

    const layout = computeLayout(state);
    const decorations = computeDecorations(state, layout);
    const scene = buildPreview(state, layout, decorations);
    preview.setAttribute("viewBox", scene.viewBox);
    preview.innerHTML = `<title id="preview-title">${escapeXml(`Anteprima: lettera ${state.initial} con il nome ${state.displayName}`)}</title>${scene.markup}`;

    const height = Math.round((M.baseHeight - M.slotDepth + M.letterHeight) / 10);
    document.getElementById("preview-height").textContent = `${height} cm`;

    const price = formatEuro(VERSIONS[state.version].price);
    summaryPrice.textContent = price;
    mobilePrice.textContent = price;
    summaryList.innerHTML = describe(state)
      .map(([label, value]) => `<li>${escapeXml(label)}: <strong>${escapeXml(value)}</strong></li>`)
      .join("");

    orderButton.href = buildWhatsAppUrl(state);
    orderButton.setAttribute("aria-disabled", error ? "true" : "false");

    if (!lab.hidden) labOutput.value = buildScad(state, layout, decorations);
    current = { state, error };
  };

  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(render);
  };

  form.addEventListener("input", schedule);
  form.addEventListener("change", schedule);
  form.addEventListener("submit", (event) => event.preventDefault());
  window.addEventListener("hashchange", () => {
    applyHash(form);
    lab.hidden = localStorage.getItem(LAB_STORAGE_KEY) !== "1";
    schedule();
  });

  orderButton.addEventListener("click", (event) => {
    if (!current || current.error) {
      event.preventDefault();
      nameInput.focus();
      nameInput.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (window.goatcounter && typeof window.goatcounter.count === "function") {
      window.goatcounter.count({ path: `ordine-lettera-${current.state.version}`, title: "Ordine lettera con nome", event: true });
    }
  });

  document.getElementById("lab-copy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(labOutput.value);
    } catch {
      labOutput.select();
    }
  });

  document.getElementById("lab-download").addEventListener("click", () => {
    const blob = new Blob([labOutput.value], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `lettera-${fileSafeName(current && current.state.name)}.scad`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  });

  render();
}

init();
