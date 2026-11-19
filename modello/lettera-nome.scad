// Lettera con nome — modello parametrico di artigianidel3d
// © 2026 artigianidel3d. Modello originale, riservato all'uso interno del laboratorio.
//
// Pezzi stampabili separatamente (variabile "parte"):
//   lettera, decorazioni  -> stessa origine: importali insieme nello slicer come
//                            un unico oggetto multicolore (decorazioni sopra la faccia)
//   nome                  -> scritta in corsivo da incollare sulla lettera
//   base, logo            -> base con incastro per la lettera e logo sotto il fondo
//                            (il pezzo "logo" serve solo con logo = "intarsio")
//   personaggio, personaggio_dettagli, personaggio_cuore, personaggio_occhi
//                         -> stessa origine: un unico oggetto multicolore
//
// I valori della sezione "Dati generati dal configuratore" arrivano dalla pagina
// /lettera-personalizzata (pannello laboratorio). Non vanno modificati a mano:
// dipendono dai font e dalle posizioni calcolate per le decorazioni.

use <../assets/fonts/DMSerifDisplay-Regular.ttf>
use <../assets/fonts/RammettoOne-Regular.ttf>
use <../assets/fonts/ArchivoBlack-Regular.ttf>
use <../assets/fonts/Pacifico-Regular.ttf>
use <../assets/fonts/GreatVibes-Regular.ttf>
use <../assets/fonts/Satisfy-Regular.ttf>
use <logo-scritta.scad>

/* [Personalizzazione] */
nome = "Salvatore";
// Vuoto = iniziale del nome
lettera = "S";
versione = "decorata"; // [essenziale, decorata]
font_lettera = "DM Serif Display"; // [DM Serif Display, Rammetto One, Archivo Black]
font_nome = "Pacifico"; // [Pacifico, Great Vibes, Satisfy]
tema = "cielo"; // [cielo, notte, fiori]
personaggio = "orsetto"; // [orsetto, elefantino, coniglietto, nessuno]

/* [Colori dell'anteprima] */
colore_lettera = "#8fd3e0";
colore_accenti = "#d8c3a0";
colore_personaggio = "#d8c3a0";
colore_dettagli = "#fbf8f2";
colore_occhi = "#3b2b25";
colore_logo = "#2b2930";

/* [Dimensioni in mm] */
// Altezza totale dell'oggetto: altezza_base - profondita_incastro + altezza_lettera = 200 mm
altezza_lettera = 186;
spessore_lettera = 30;
altezza_max_nome = 42;
// 0 = automatica: almeno 190 mm, di più sulle lettere larghe
larghezza_max_nome = 0;
// Centro del nome sull'altezza della lettera (0 = fondo, 1 = cima)
posizione_nome = 0.52;
// Spessore totale del nome: i primi incasso_nome mm entrano nella scanalatura della lettera
spessore_nome = 10;
incasso_nome = 2;
tolleranza_nome = 0.2;
// Irrobustisce i tratti sottili del corsivo
ispessimento_nome = 0.3;
spessore_decorazioni = 1.2;
altezza_base = 17;
// Spazio minimo tra lettera (o personaggio) e bordo della base
margine_base = 10;
// La base è rotonda; oltre questo diametro diventa leggermente ovale (piatto da 256 mm)
diametro_max_base = 250;
smusso_base = 2;
profondita_incastro = 3;
tolleranza_incastro = 0.25;
altezza_personaggio = 62;

/* [Logo sotto la base] */
logo = "inciso"; // [inciso, intarsio, nessuno]
larghezza_logo = 95;
profondita_logo = 0.8;

/* [Esportazione] */
// I "gruppo_" esportano più pezzi allineati in un solo file (con --enable=lazy-union
// ogni pezzo resta un oggetto separato, pronto per la stampa multicolore)
parte = "anteprima"; // [anteprima, gruppo_lettera, gruppo_nome, gruppo_base, gruppo_personaggio, lettera, decorazioni, nome, base, logo, personaggio, personaggio_dettagli, personaggio_cuore, personaggio_occhi]

/* [Dati generati dal configuratore] */
// Riquadro dell'inchiostro del testo rispetto all'origine del carattere:
// [min x, min y, max x, max y], in qualunque unità purché la stessa per x e y
lettera_bbox = [0.03, -0.018, 0.492, 0.678];
nome_bbox = [0.034, -0.008, 4.141, 0.94];
// [tipo, u, v, raggio, rotazione]: u e v da 0 a 1 sul riquadro della lettera,
// raggio in frazione dell'altezza della lettera
decorazioni = [
  ["mongolfiera", 0.8576, 0.2566, 0.0798, 0],
  ["nuvola", 0.1514, 0.7445, 0.08, 0],
  ["nuvola", 0.2182, 0.8817, 0.0422, 0],
  ["stella", 0.7641, 0.1093, 0.0367, -12],
  ["stella", 0.8584, 0.8994, 0.0323, 13],
  ["stella", 0.6967, 0.3582, 0.0284, -11]
];

/* [Hidden] */
$fn = 48;
EPS = 0.01;

// ---------------------------------------------------------------- Misure derivate

L = lettera != "" ? lettera : nome[0];
H = altezza_lettera;
T = spessore_lettera;
kL = H / (lettera_bbox[3] - lettera_bbox[1]);
W = (lettera_bbox[2] - lettera_bbox[0]) * kL;

nome_w_em = nome_bbox[2] - nome_bbox[0];
nome_h_em = nome_bbox[3] - nome_bbox[1];
LARGHEZZA_NOME = larghezza_max_nome > 0 ? larghezza_max_nome : max(190, W * 0.95);
kN = min(altezza_max_nome / nome_h_em, LARGHEZZA_NOME / nome_w_em);
NH = nome_h_em * kN;

decorata = versione == "decorata";
con_personaggio = decorata && personaggio != "nessuno";

// Personaggio: misure native (unità del disegno) e scala
P_ALTEZZA = personaggio == "coniglietto" ? 114 : personaggio == "elefantino" ? 92 : 98;
P_FRONTE = 31;   // sporgenza verso il fronte dal centro, unità native
P_RETRO = 23;    // sporgenza verso il retro
P_MEZZA_LARGH = 30;
sP = altezza_personaggio / P_ALTEZZA;
GAP_PERSONAGGIO = 3;
PERS_X = -W / 2 + 12;
PERS_Y = -T / 2 - GAP_PERSONAGGIO - P_RETRO * sP;

// Base rotonda: il cerchio più piccolo che contiene lettera e personaggio con il margine.
// Il centro si sposta in avanti quanto serve per fare spazio al personaggio.
function raggio_base(yc) = max(
  norm([W / 2 + margine_base, T / 2 + abs(yc) + margine_base]),
  con_personaggio
    ? norm([abs(PERS_X) + P_MEZZA_LARGH * sP, abs(PERS_Y - P_FRONTE * sP - yc)]) + margine_base * 0.6
    : 0,
  H * 0.4
);
RAGGI_BASE = [for (y = [-60 : 1 : 0]) raggio_base(y)];
RAGGIO_BASE = min(RAGGI_BASE);
BASE_YC = [for (y = [-60 : 1 : 0]) if (raggio_base(y) == RAGGIO_BASE) y][0];
BASE_B = min(RAGGIO_BASE, diametro_max_base / 2);
BASE_A = max(BASE_B, W / 2 + 4);

Z_LETTERA = altezza_base - profondita_incastro;

// Ingombro della base ruotata di 45°: deve stare sul piatto da 256 mm
if (2 * BASE_A > 254)
  echo(str("ATTENZIONE: la base misura ", round(2 * BASE_A), " x ", round(2 * BASE_B), " mm e non entra nel piatto"));

// ---------------------------------------------------------------- Forme 2D

// Lettera con il riquadro dell'inchiostro in [0, W] x [0, H]
module lettera2d() {
  translate([-lettera_bbox[0] * kL, -lettera_bbox[1] * kL])
    resize([0, H], auto = true)
      text(L, size = 10, font = font_lettera);
}

// Nome centrato sull'origine
module nome2d() {
  offset(r = ispessimento_nome)
    translate([-(nome_bbox[0] + nome_bbox[2]) / 2 * kN, -(nome_bbox[1] + nome_bbox[3]) / 2 * kN])
      resize([0, NH], auto = true)
        text(nome, size = 10, font = font_nome);
}

module stella2d(r) {
  offset(r = 0.08 * r) offset(delta = -0.08 * r)
    polygon([for (i = [0:9]) let(a = 90 + i * 36, rr = i % 2 == 0 ? r : r * 0.48) [rr * cos(a), rr * sin(a)]]);
}

module nuvola2d(r) {
  intersection() {
    union() {
      translate([-0.45 * r, -0.1 * r]) circle(0.42 * r);
      translate([0, 0.12 * r]) circle(0.55 * r);
      translate([0.45 * r, -0.05 * r]) circle(0.45 * r);
      translate([-0.45 * r, -0.52 * r]) square([0.9 * r, 0.42 * r]);
    }
    translate([-r, -0.5 * r]) square([2 * r, 2 * r]);
  }
}

module mongolfiera2d(r) {
  w = max(0.06 * r, 0.9);
  // Pallone con due spicchi scavati: la lettera si vede tra le strisce
  difference() {
    hull() {
      translate([0, 0.25 * r]) circle(0.62 * r);
      translate([0, -0.42 * r]) circle(0.14 * r);
    }
    for (s = [-1, 1])
      translate([s * 0.24 * r, 0.12 * r]) difference() {
        scale([0.32, 1]) circle(0.78 * r);
        scale([0.32, 1]) circle(0.78 * r - w / 0.32);
      }
  }
  // Corde e cesto
  for (s = [-1, 1])
    hull() {
      translate([s * 0.12 * r, -0.48 * r]) circle(w / 2);
      translate([s * 0.13 * r, -0.72 * r]) circle(w / 2);
    }
  translate([-0.16 * r, -0.95 * r]) offset(r = 0.03 * r) offset(delta = -0.03 * r) square([0.32 * r, 0.24 * r]);
}

module luna2d(r) {
  difference() {
    circle(0.9 * r);
    translate([0.38 * r, 0.22 * r]) circle(0.78 * r);
  }
}

module fiore2d(r) {
  difference() {
    for (i = [0:4]) rotate(90 + i * 72) translate([0, 0.5 * r]) circle(0.42 * r);
    circle(0.27 * r);
  }
  circle(0.17 * r);
}

module farfalla2d(r) {
  g = max(0.06 * r, 0.8);
  for (s = [-1, 1]) {
    translate([s * (0.38 * r + g), 0.22 * r]) rotate(s * -20) scale([0.38, 0.5]) circle(r * 0.9);
    translate([s * (0.3 * r + g), -0.3 * r]) rotate(s * 25) scale([0.26, 0.34]) circle(r * 0.9);
  }
  scale([0.11, 0.62]) circle(r);
}

module cuore2d(d) {
  r = d * 0.3;
  for (s = [-1, 1])
    hull() {
      translate([s * r * 0.7, r * 0.35]) circle(r);
      translate([0, -d * 0.55]) circle(0.01);
    }
}

module decorazione2d(tipo, r) {
  if (tipo == "stella") stella2d(r);
  else if (tipo == "nuvola") nuvola2d(r);
  else if (tipo == "mongolfiera") mongolfiera2d(r);
  else if (tipo == "luna") luna2d(r);
  else if (tipo == "fiore") fiore2d(r);
  else if (tipo == "farfalla") farfalla2d(r);
}

module decorazioni2d() {
  for (d = decorazioni)
    translate([d[1] * W, d[2] * H]) rotate(d[4]) decorazione2d(d[0], d[3] * H);
}

// ---------------------------------------------------------------- Logo artigianidel3d

// Ricostruzione del logo (assets/logo-artigianidel3d.svg) con tratti più spessi,
// stampabili anche in piccolo. Coordinate SVG con l'asse y capovolto.
module tratto(p1, p2, w) {
  hull() {
    translate(p1) circle(w / 2);
    translate(p2) circle(w / 2);
  }
}

module contorno(w) {
  difference() {
    offset(r = w / 2) children();
    offset(delta = -w / 2) children();
  }
}

module logo2d_svg() {
  function p(x, y) = [x, 96 - y];
  // Riquadro arrotondato
  contorno(5) translate([32, 32]) offset(r = 24) square(32);
  // Cubo: esagono, spigoli interni e punto centrale
  contorno(5) polygon([p(48, 23), p(72, 37), p(72, 65), p(48, 79), p(24, 65), p(24, 37)]);
  tratto(p(24, 37), p(48, 52), 5);
  tratto(p(48, 52), p(72, 37), 5);
  tratto(p(48, 52), p(48, 79), 5);
  translate(p(48, 52)) circle(6.5);
  // Scritta
  translate([108, 96 - 60]) resize([287, 0], auto = true) scritta_logo();
}

// Logo centrato e specchiato, per leggerlo correttamente guardando il fondo
module logo2d() {
  s = larghezza_logo / 387;
  mirror([1, 0]) scale(s) translate([-(8 + 395) / 2, -48]) logo2d_svg();
}

// ---------------------------------------------------------------- Pezzi della lettera

// Impronta del nome sulla lettera (stesso sistema di coordinate della lettera)
module impronta_nome2d(margine = 0) {
  translate([W / 2, posizione_nome * H]) offset(r = margine) nome2d();
}

// Lettera con la scanalatura in cui si incastra il nome
module lettera3d() {
  difference() {
    linear_extrude(T) lettera2d();
    translate([0, 0, T - incasso_nome]) linear_extrude(incasso_nome + 1) impronta_nome2d(tolleranza_nome);
  }
}

module decorazioni3d() {
  if (decorata && len(decorazioni) > 0)
    translate([0, 0, T]) linear_extrude(spessore_decorazioni)
      difference() {
        intersection() {
          decorazioni2d();
          offset(delta = -0.4) lettera2d();
        }
        impronta_nome2d(1);
      }
}

module nome3d() linear_extrude(spessore_nome) nome2d();

// Porta un pezzo dal piano di stampa della lettera alla posizione in piedi sulla base
module in_piedi(z = Z_LETTERA) {
  translate([-W / 2, T / 2, z]) rotate([90, 0, 0]) children();
}

// ---------------------------------------------------------------- Base

module base2d() {
  translate([0, BASE_YC]) scale([BASE_A, BASE_B]) circle(r = 1, $fn = 160);
}

module impronta_lettera2d() {
  projection(cut = false)
    intersection() {
      in_piedi(0) lettera3d();
      translate([-1000, -1000, 0]) cube([2000, 2000, profondita_incastro]);
    }
}

module logo3d() {
  if (logo != "nessuno")
    translate([0, BASE_YC, -EPS]) linear_extrude(profondita_logo + EPS) logo2d();
}

module base3d() {
  difference() {
    hull() {
      linear_extrude(altezza_base - smusso_base) base2d();
      linear_extrude(altezza_base) offset(delta = -smusso_base) base2d();
    }
    translate([0, 0, Z_LETTERA])
      linear_extrude(profondita_incastro + 1) offset(r = tolleranza_incastro) impronta_lettera2d();
    logo3d();
  }
}

// ---------------------------------------------------------------- Personaggi
// Disegnati in unità native (altezza circa 100) e scalati con altezza_personaggio.
// Rivolti verso il fronte (-y), appoggiati su z = 0.

module ellissoide(c, r) translate(c) scale(r) sphere(1, $fn = 40);

module cuore3d(c, d) {
  translate(c) rotate([90, 0, 0]) linear_extrude(3, center = true) cuore2d(d);
}

module orsetto(gruppo) {
  if (gruppo == "corpo") {
    ellissoide([0, 0, 32], [26, 22, 30]);
    for (s = [-1, 1]) {
      ellissoide([s * 16, -12, 11], [11, 17, 11]);
      translate([s * 25, -6, 40]) rotate([0, s * -28, 0]) ellissoide([0, 0, 0], [8, 8, 15]);
      ellissoide([s * 16, 0, 90], [8.5, 6, 8.5]);
    }
    ellissoide([0, -2, 72], [23, 20, 21]);
  } else if (gruppo == "dettagli") {
    ellissoide([0, -18.5, 66], [10, 6, 7.5]);
    for (s = [-1, 1]) {
      ellissoide([s * 16, -5.2, 90], [5, 1.6, 5]);
      ellissoide([s * 16, -28.5, 11], [6.5, 1.5, 6.5]);
    }
  } else if (gruppo == "cuore") {
    cuore3d([0, -20.6, 34], 13);
  } else if (gruppo == "occhi") {
    ellissoide([0, -24.2, 69], [3.6, 2, 2.6]);
    for (s = [-1, 1]) ellissoide([s * 8.5, -18, 76.5], [2.6, 2, 2.6]);
  }
}

module elefantino(gruppo) {
  tronco = [[0, -19, 62, 7], [0, -25, 55, 6], [0, -28.5, 47.5, 5.5], [0, -30.5, 41, 5], [0, -34.5, 39.5, 4.5], [0, -37.5, 43, 4]];
  if (gruppo == "corpo") {
    ellissoide([0, 0, 30], [27, 23, 29]);
    for (s = [-1, 1]) {
      ellissoide([s * 14, -13, 10], [9.5, 15, 10]);
      translate([s * 25, 1, 70]) rotate([0, 0, s * -18]) ellissoide([0, 0, 0], [14, 4, 17]);
    }
    ellissoide([0, -4, 68], [23, 21, 22]);
    for (i = [0:len(tronco) - 2])
      hull() {
        translate([tronco[i][0], tronco[i][1], tronco[i][2]]) sphere(tronco[i][3], $fn = 28);
        translate([tronco[i + 1][0], tronco[i + 1][1], tronco[i + 1][2]]) sphere(tronco[i + 1][3], $fn = 28);
      }
  } else if (gruppo == "dettagli") {
    for (s = [-1, 1]) {
      translate([s * 25, -1.6, 70]) rotate([0, 0, s * -18]) ellissoide([0, 0, 0], [10, 2, 13]);
      ellissoide([s * 14, -27.6, 10], [6.5, 1.5, 6.5]);
    }
  } else if (gruppo == "cuore") {
    cuore3d([0, -21.3, 20], 12);
  } else if (gruppo == "occhi") {
    for (s = [-1, 1]) ellissoide([s * 9, -20.5, 74], [2.5, 2, 2.5]);
  }
}

module coniglietto(gruppo) {
  if (gruppo == "corpo") {
    ellissoide([0, 0, 28], [24, 21, 27]);
    ellissoide([0, 20, 16], [6, 6, 6]);
    for (s = [-1, 1]) {
      ellissoide([s * 14, -12, 9], [9, 16, 9]);
      translate([s * 22, -6, 35]) rotate([0, s * -25, 0]) ellissoide([0, 0, 0], [7, 7, 13]);
      translate([s * 8, 0, 94]) rotate([0, s * 10, 0]) ellissoide([0, 0, 0], [6.5, 4, 19]);
    }
    ellissoide([0, -3, 64], [21, 19, 19]);
  } else if (gruppo == "dettagli") {
    for (s = [-1, 1]) {
      translate([s * 8, -3.2, 95]) rotate([0, s * 10, 0]) ellissoide([0, 0, 0], [3.6, 1.4, 14]);
      ellissoide([s * 3.6, -19.6, 58.5], [4.6, 3, 4]);
      ellissoide([s * 14, -27.4, 9], [6, 1.5, 6]);
    }
  } else if (gruppo == "cuore") {
    cuore3d([0, -20.3, 29], 12);
  } else if (gruppo == "occhi") {
    ellissoide([0, -22, 62], [2.6, 1.5, 2]);
    for (s = [-1, 1]) ellissoide([s * 8, -16.8, 69], [2.4, 2, 2.4]);
  }
}

// Il fondo viene tagliato in piano per appoggiare bene sulla base
module personaggio3d(gruppo) {
  TAGLIO = 2;
  scale(sP) translate([0, 0, -TAGLIO]) intersection() {
    union() {
      if (personaggio == "orsetto") orsetto(gruppo);
      else if (personaggio == "elefantino") elefantino(gruppo);
      else if (personaggio == "coniglietto") coniglietto(gruppo);
    }
    translate([-200, -200, TAGLIO]) cube([400, 400, 400]);
  }
}

// Ogni gruppo esclude quelli che gli stanno sopra, così i pezzi non si sovrappongono
module personaggio_parte(gruppo) {
  if (gruppo == "corpo") difference() {
    personaggio3d("corpo");
    personaggio3d("dettagli");
    personaggio3d("cuore");
    personaggio3d("occhi");
  }
  else if (gruppo == "dettagli") difference() {
    personaggio3d("dettagli");
    personaggio3d("occhi");
  }
  else personaggio3d(gruppo);
}

module personaggio_completo() {
  color(colore_personaggio) render() personaggio_parte("corpo");
  color(colore_dettagli) render() personaggio_parte("dettagli");
  color(colore_lettera) personaggio_parte("cuore");
  color(colore_occhi) personaggio_parte("occhi");
}

// ---------------------------------------------------------------- Uscita

module anteprima() {
  color(colore_accenti) base3d();
  in_piedi() {
    color(colore_lettera) lettera3d();
    color(colore_accenti) decorazioni3d();
    color(colore_accenti) translate([W / 2, posizione_nome * H, T - incasso_nome]) nome3d();
  }
  if (con_personaggio)
    translate([PERS_X, PERS_Y, altezza_base]) personaggio_completo();
}

// Ogni pezzo è un'istruzione separata: esportando con --enable=lazy-union
// diventa un oggetto distinto nel 3MF, con il suo colore.
function mostra(nomi) = len([for (n = nomi) if (n == parte) n]) > 0;

if (parte == "anteprima") anteprima();
if (mostra(["lettera", "gruppo_lettera"])) color(colore_lettera) lettera3d();
if (mostra(["decorazioni", "gruppo_lettera"])) color(colore_accenti) decorazioni3d();
if (mostra(["nome", "gruppo_nome"])) color(colore_accenti) nome3d();
if (mostra(["base", "gruppo_base"])) color(colore_accenti) base3d();
if (logo == "intarsio" && mostra(["logo", "gruppo_base"])) color(colore_logo) logo3d();
if (con_personaggio && mostra(["personaggio", "gruppo_personaggio"])) color(colore_personaggio) personaggio_parte("corpo");
if (con_personaggio && mostra(["personaggio_dettagli", "gruppo_personaggio"])) color(colore_dettagli) personaggio_parte("dettagli");
if (con_personaggio && mostra(["personaggio_cuore", "gruppo_personaggio"])) color(colore_lettera) personaggio_parte("cuore");
if (con_personaggio && mostra(["personaggio_occhi", "gruppo_personaggio"])) color(colore_occhi) personaggio_parte("occhi");
