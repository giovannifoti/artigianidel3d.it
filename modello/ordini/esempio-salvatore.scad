// Ordine lettera con nome — artigianidel3d, esempio
// Versione: Decorata (35 €) · Nome: Salvatore · Lettera: S, stile Classica, colore Azzurro · Scritta del nome: Tondo · Nome, base e decorazioni: Sabbia · Decorazioni: Cielo · Personaggio: Orsetto
include <../lettera-nome.scad>

nome = "Salvatore";
lettera = "S";
versione = "decorata";
font_lettera = "DM Serif Display";
font_nome = "Pacifico";
tema = "cielo";
personaggio = "orsetto";
colore_lettera = "#8fd3e0"; // Azzurro
colore_accenti = "#d8c3a0"; // Sabbia
colore_personaggio = "#d8c3a0";
lettera_bbox = [0.03, -0.018, 0.492, 0.678];
nome_bbox = [0.034, -0.008, 4.141, 0.94];
decorazioni = [
  ["mongolfiera", 0.8367, 0.3141, 0.08, 0],
  ["nuvola", 0.1542, 0.7433, 0.08, 0],
  ["nuvola", 0.8049, 0.1405, 0.0545, 0],
  ["stella", 0.2132, 0.8931, 0.0367, 5],
  ["stella", 0.8706, 0.8968, 0.0284, -10],
  ["stella", 0.6536, 0.3707, 0.025, -11]
];
