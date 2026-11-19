"use strict";

// Configuratore della lettera con nome.
// Opzioni, misure e posizione delle decorazioni stanno in js/lettera-core.js;
// qui ci sono il modulo, l'anteprima disegnata (immediata) e quella 3D (dal server).

(() => {
  const Core = window.LetteraCore;
  const { M, VERSIONS, LETTER_FONTS, NAME_FONTS, LETTER_COLORS, ACCENT_COLORS, THEMES, CHARACTERS, round } = Core;

  const API_URL = "/api/lettera";
  // Da aumentare quando cambia il modello, per non usare anteprime vecchie in cache.
  const MODEL_REVISION = "2";
  const PREVIEW_DELAY_MS = 450;
  const PHONE_PATTERN = /^\+?[0-9 ()./-]{6,24}$/;
  const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  // Proiezione obliqua dell'anteprima disegnata: la profondità (y) sale verso destra.
  const DEPTH_X = 0.42;
  const DEPTH_Y = 0.3;

  const APP_CONFIG = window.APP_CONFIG || {};
  const supabaseClient = window.supabase && APP_CONFIG.supabaseUrl && APP_CONFIG.supabasePublishableKey
    ? window.supabase.createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabasePublishableKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
    : null;

  // ------------------------------------------------------------ Utilità

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

  function project(x, y, z) {
    return [x + y * DEPTH_X, -z - y * DEPTH_Y];
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

  function buildPreview(config, layout, decorations) {
    const letterColor = LETTER_COLORS[config.letterColor].hex;
    const accent = ACCENT_COLORS[config.accentColor].hex;
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
    const letterFamily = LETTER_FONTS[config.letterFont].css;
    const fontSize = layout.letterScale;
    const penX = -W / 2 - layout.letterBox[0] * fontSize;
    const baselineZ = letterZ - layout.letterBox[1] * fontSize;
    const letterText = (y, attributes) => {
      const [x, screenY] = project(penX, y, baselineZ);
      return `<text x="${round(x, 2)}" y="${round(screenY, 2)}" font-family="${letterFamily}" font-size="${round(fontSize, 3)}" ${attributes}>${escapeXml(layout.initial)}</text>`;
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
    const nameFamily = NAME_FONTS[config.nameFont].css;
    const nameSize = layout.nameScale;
    const box = layout.nameBox;
    const nameCenterZ = letterZ + M.namePosition * H;
    const namePenX = -((box[0] + box[2]) / 2) * nameSize;
    const nameBaselineZ = nameCenterZ - ((box[1] + box[3]) / 2) * nameSize;
    const nameText = (y, attributes, dx = 0, dy = 0) => {
      const [x, screenY] = project(namePenX, y, nameBaselineZ);
      return `<text x="${round(x + dx, 2)}" y="${round(screenY + dy, 2)}" font-family="${nameFamily}" font-size="${round(nameSize, 3)}" stroke-width="${M.nameThicken * 2}" stroke-linejoin="round" ${attributes}>${escapeXml(layout.displayName)}</text>`;
    };
    parts.push(nameText(-T / 2, `fill="rgba(0,0,0,0.3)" stroke="rgba(0,0,0,0.3)" filter="url(#ombra-nome)"`, 2.5, 3.5));
    const nameOut = M.nameDepth - M.nameInset;
    for (let depth = 0; depth < nameOut; depth += 0.75) {
      parts.push(nameText(-T / 2 - depth, `fill="${accentSide}" stroke="${accentSide}"`));
    }
    parts.push(nameText(-T / 2 - nameOut, `fill="${accent}" stroke="${accent}"`));

    // Personaggio davanti alla lettera
    if (layout.withCharacter) {
      const [x, y] = project(layout.characterX, layout.characterY, M.baseHeight);
      const scale = layout.characterScale;
      parts.push(ellipse(x + 4, y - 2, 28 * scale, 7 * scale, `fill="rgba(0,0,0,0.18)" filter="url(#ombra-nome)"`));
      parts.push(`<g transform="translate(${round(x, 2)} ${round(y, 2)}) scale(${round(scale, 4)} ${round(-scale, 4)})">` +
        characterShapes(config.character, {
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


  // ------------------------------------------------------------ Stato del modulo

  function readConfig(form) {
    const data = new FormData(form);
    return Core.normalizeConfig({
      version: data.get("versione"),
      name: data.get("nome"),
      letterFont: data.get("fontLettera"),
      nameFont: data.get("fontNome"),
      letterColor: data.get("coloreLettera"),
      accentColor: data.get("coloreAccenti"),
      theme: data.get("tema"),
      character: data.get("personaggio")
    });
  }

  function configToHash(config) {
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

  function applyHash(form) {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const params = new URLSearchParams(hash);
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
    const name = Core.normalizeName(params.get("n"));
    if (name && !Core.validateName(name)) form.elements.nome.value = name;
  }

  // ------------------------------------------------------------ Anteprima 3D

  function createPreview3d(stage, status) {
    let viewer = null;
    let viewerFailed = false;
    let timer = 0;
    let controller = null;
    let lastKey = "";

    const setStatus = (text) => {
      status.textContent = text;
      status.hidden = !text;
    };

    async function ensureViewer() {
      if (viewer || viewerFailed) return viewer;
      try {
        const module = await import("./lettera-3d.js");
        viewer = module.createViewer(stage.querySelector(".viewer-3d"));
      } catch (error) {
        console.warn("Anteprima 3D non disponibile:", error);
        viewerFailed = true;
      }
      return viewer;
    }

    async function load(params) {
      const key = Core.encodeParams(params);
      if (key === lastKey) return;
      lastKey = key;
      if (controller) controller.abort();
      controller = new AbortController();
      const { signal } = controller;

      stage.classList.add("is-loading");
      setStatus(stage.classList.contains("has-3d") ? "Aggiorno il modello 3D…" : "Preparo il modello 3D…");

      try {
        const [activeViewer, response] = await Promise.all([
          ensureViewer(),
          fetch(`${API_URL}?p=${key}&v=${MODEL_REVISION}`, { signal })
        ]);
        if (!activeViewer) throw new Error("WebGL non disponibile");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const buffer = await response.arrayBuffer();
        if (signal.aborted) return;
        await activeViewer.show(buffer);
        stage.classList.add("has-3d");
        setStatus("");
      } catch (error) {
        if (signal.aborted) return;
        console.warn("Anteprima 3D non aggiornata:", error);
        lastKey = "";
        setStatus(stage.classList.contains("has-3d") ? "Anteprima 3D non aggiornata: riprova tra poco." : "");
      } finally {
        if (!signal.aborted) stage.classList.remove("is-loading");
      }
    }

    return {
      schedule(params) {
        clearTimeout(timer);
        timer = setTimeout(() => load(params), PREVIEW_DELAY_MS);
      }
    };
  }

  // ------------------------------------------------------------ Invio della richiesta

  function validateContact(fields) {
    const errors = {};
    if (fields.customerName.length < 2) errors.customerName = "Scrivi nome e cognome.";
    const digits = fields.phone.replace(/\D/g, "");
    if (!PHONE_PATTERN.test(fields.phone) || digits.length < 6) errors.phone = "Controlla il numero di telefono.";
    if (!EMAIL_PATTERN.test(fields.email) || fields.email.length > 120) errors.email = "Controlla l’indirizzo email.";
    if (!fields.consent) errors.consent = "Serve il consenso per poterti ricontattare.";
    return errors;
  }

  function showFieldErrors(form, errors) {
    for (const [name, element] of Object.entries({
      customerName: form.elements.clienteNome,
      phone: form.elements.clienteTelefono,
      email: form.elements.clienteEmail,
      consent: form.elements.privacy
    })) {
      const message = errors[name] || "";
      element.setAttribute("aria-invalid", message ? "true" : "false");
      const output = document.getElementById(`errore-${element.id}`);
      if (output) output.textContent = message;
    }
  }

  // ------------------------------------------------------------ Avvio

  async function init() {
    const form = document.getElementById("config-form");
    const preview = document.getElementById("preview");
    const stage = document.getElementById("preview-stage");
    const loading = document.getElementById("preview-loading");
    const nameInput = document.getElementById("nome");
    const nameError = document.getElementById("nome-error");
    const nameCounter = document.getElementById("nome-counter");
    const decorationStep = document.getElementById("step-decorazioni");
    const summaryPrice = document.getElementById("summary-price");
    const mobilePrice = document.getElementById("mobile-price");
    const summaryList = document.getElementById("summary-list");
    const submitButton = document.getElementById("submit-button");
    const formMessage = document.getElementById("form-message");
    const success = document.getElementById("request-success");
    const preview3d = createPreview3d(stage, document.getElementById("preview-status"));

    buildChoiceGroups();
    applyHash(form);

    await Core.loadFonts();
    loading.hidden = true;

    let current = null;
    let frame = 0;

    const render = () => {
      frame = 0;
      const config = readConfig(form);
      const error = Core.validateName(config.name);

      nameInput.setAttribute("aria-invalid", error ? "true" : "false");
      nameError.textContent = error;
      nameCounter.textContent = `${[...config.name].length}/${Core.NAME_MAX_LENGTH}`;

      const initial = Core.getInitial(config.name || "Nome");
      for (const sample of document.querySelectorAll('[data-sample="nome"]')) sample.textContent = config.name || "Nome";
      for (const sample of document.querySelectorAll('[data-sample="lettera"]')) sample.textContent = initial;
      document.getElementById("colore-lettera-name").innerHTML = `Scelto: <strong>${LETTER_COLORS[config.letterColor].label}</strong>`;
      document.getElementById("colore-accenti-name").innerHTML = `Scelto: <strong>${ACCENT_COLORS[config.accentColor].label}</strong>`;

      const decorated = config.version === "decorata";
      decorationStep.hidden = !decorated;
      for (const element of document.querySelectorAll("[data-step-dopo-decorazioni]")) {
        element.textContent = String(Number(element.dataset.stepDopoDecorazioni) - (decorated ? 0 : 1));
      }
      document.getElementById("colore-accenti-label").textContent = decorated
        ? "Colore di nome, base e decorazioni"
        : "Colore di nome e base";

      const model = Core.computeModel(config);
      const scene = buildPreview(config, model.layout, model.decorations);
      preview.setAttribute("viewBox", scene.viewBox);
      preview.innerHTML = `<title id="preview-title">${escapeXml(`Anteprima: lettera ${model.layout.initial} con il nome ${model.layout.displayName}`)}</title>${scene.markup}`;

      const price = `${Core.priceOf(config)} €`;
      summaryPrice.textContent = price;
      mobilePrice.textContent = price;
      summaryList.innerHTML = Core.describe(config)
        .map(([label, value]) => `<li>${escapeXml(label)}: <strong>${escapeXml(value)}</strong></li>`)
        .join("");

      if (!error) preview3d.schedule(model.params);
      current = { config, params: model.params, error };
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(render);
    };

    form.addEventListener("input", (event) => {
      if (event.target.closest("[data-config]")) schedule();
    });
    form.addEventListener("change", (event) => {
      if (event.target.closest("[data-config]")) schedule();
    });
    window.addEventListener("hashchange", () => {
      applyHash(form);
      schedule();
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      formMessage.textContent = "";

      if (!current || current.error) {
        nameInput.focus();
        nameInput.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      // Campo trappola per i bot: le persone non lo vedono.
      if (form.elements.sito.value) return;

      const fields = {
        customerName: form.elements.clienteNome.value.replace(/\s+/g, " ").trim(),
        phone: form.elements.clienteTelefono.value.trim(),
        email: form.elements.clienteEmail.value.trim(),
        notes: form.elements.note.value.trim().slice(0, 500),
        consent: form.elements.privacy.checked
      };
      const errors = validateContact(fields);
      showFieldErrors(form, errors);
      const firstError = Object.keys(errors)[0];
      if (firstError) {
        const target = { customerName: "clienteNome", phone: "clienteTelefono", email: "clienteEmail", consent: "privacy" }[firstError];
        form.elements[target].focus();
        return;
      }

      if (!supabaseClient) {
        formMessage.textContent = "Il modulo non è disponibile in questo momento. Scrivici su WhatsApp al +39 344 649 8901.";
        return;
      }

      submitButton.disabled = true;
      submitButton.textContent = "Invio in corso…";

      const { error } = await supabaseClient.from("letter_requests").insert({
        customer_name: fields.customerName,
        phone: fields.phone,
        email: fields.email,
        notes: fields.notes,
        config: current.config,
        model_params: current.params,
        privacy_consent: true
      });

      submitButton.disabled = false;
      submitButton.textContent = "Invia la richiesta";

      if (error) {
        console.error("Richiesta non salvata:", error);
        formMessage.textContent = error.code === "P0001"
          ? error.message
          : "Non siamo riusciti a inviare la richiesta. Riprova tra poco o scrivici su WhatsApp al +39 344 649 8901.";
        return;
      }

      if (window.goatcounter && typeof window.goatcounter.count === "function") {
        window.goatcounter.count({ path: `richiesta-lettera-${current.config.version}`, title: "Richiesta lettera con nome", event: true });
      }

      document.getElementById("success-summary").textContent =
        `Lettera ${Core.getInitial(current.config.name)} con il nome ${current.config.name} · ${VERSIONS[current.config.version].label} ${Core.priceOf(current.config)} €`;
      form.hidden = true;
      success.hidden = false;
      success.focus();
      document.querySelector(".mobile-order").hidden = true;
      history.replaceState(null, "", `#${configToHash(current.config)}`);
    });

    document.getElementById("new-request").addEventListener("click", () => {
      success.hidden = true;
      form.hidden = false;
      document.querySelector(".mobile-order").hidden = false;
      form.elements.clienteNome.focus();
    });

    render();
  }

  init();
})();
