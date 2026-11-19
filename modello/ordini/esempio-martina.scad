// Ordine lettera con nome — artigianidel3d, esempio
// Versione: Decorata (35 €) · Nome: Martina · Lettera: M, stile Morbida, colore Rosa · Scritta del nome: Tondo · Nome, base e decorazioni: Bianco · Decorazioni: Notte · Personaggio: Elefantino
include <../lettera-nome.scad>

nome = "Martina";
lettera = "M";
versione = "decorata";
font_lettera = "Titan One";
font_nome = "Pacifico";
tema = "notte";
personaggio = "elefantino";
colore_lettera = "#f4b6c6"; // Rosa
colore_accenti = "#f7f5f0"; // Bianco
colore_personaggio = "#f7f5f0";
lettera_bbox = [0.04, 0, 0.84, 0.71];
nome_bbox = [-0.001, -0.005, 3.767, 0.873];
decorazioni = [
  ["luna", 0.8218, 0.8786, 0.1067, 0],
  ["nuvola", 0.4877, 0.1221, 0.08, 0],
  ["nuvola", 0.0959, 0.7863, 0.08, 0],
  ["stella", 0.9537, 0.3161, 0.0367, -17],
  ["stella", 0.4103, 0.7213, 0.0367, 7],
  ["stella", 0.2509, 0.3393, 0.0367, -13],
  ["stella", 0.8175, 0.0655, 0.0367, 2],
  ["stella", 0.7329, 0.3523, 0.0367, 25],
  ["stella", 0.3152, 0.942, 0.0367, -21],
  ["stella", 0.606, 0.7053, 0.0367, -19]
];
