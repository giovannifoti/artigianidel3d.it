# Lettera con nome: modello parametrico

Il modello `lettera-nome.scad` è originale di artigianidel3d e genera tutti i
pezzi della lettera venduta su `/lettera-personalizzata`. Lettera, nome e
decorazioni usano gli stessi font del sito (`assets/fonts/`), quindi l'anteprima
che vede il cliente e i file da stampare coincidono.

## Dall'ordine WhatsApp ai file da stampare

1. Il messaggio del cliente termina con un link di riepilogo
   (`…/lettera-personalizzata#v=decorata&n=…`). Aprilo nel browser.
2. La prima volta su quel browser, apri
   `https://artigianidel3d.it/lettera-personalizzata#laboratorio`: compare il
   riquadro **Laboratorio** sotto il riepilogo, e resta attivo nelle visite
   successive (`#laboratorio=0` lo nasconde).
3. Premi **Scarica file .scad** e sposta il file in `modello/ordini/`.
4. Esporta i pezzi:

   ```bash
   ./modello/esporta.sh modello/ordini/lettera-salvatore.scad
   ```

   I file `.3mf` finiscono in `modello/ordini/lettera-salvatore/`. Per gli STL
   aggiungi `stl` in fondo al comando.

Puoi anche aprire il file dell'ordine con OpenSCAD per vedere l'anteprima a
colori. La cartella `modello/ordini/` non va su git (contiene i nomi dei
clienti), tranne gli esempi `esempio-*.scad`.

## Pezzi e stampa

| Pezzo | Come si stampa |
| --- | --- |
| `lettera` + `decorazioni` | Importali insieme come un unico oggetto con due parti: la lettera è sdraiata, le decorazioni (1,2 mm) stanno sulla faccia superiore, nel colore degli accenti. |
| `nome` | Sdraiato, colore degli accenti. Si incolla sulla lettera al centro, poco sopra metà altezza. |
| `base` | Così com'è. Il logo artigianidel3d è inciso sul fondo (0,8 mm, già specchiato per leggerlo girando la base). In alto c'è la sede della lettera, profonda 3 mm con 0,25 mm di gioco. |
| `logo` | Solo se nel file imposti `logo = "intarsio";`: il logo diventa un pezzo a filo del fondo, da stampare in un altro colore insieme alla base. |
| `personaggio` + `_dettagli` + `_cuore` + `_occhi` | Un unico oggetto multicolore, in piedi. Servono supporti ad albero sotto testa e braccia. Si incolla sulla base davanti alla lettera, a sinistra. |

Misure predefinite: lettera alta 150 mm e spessa 25 mm, nome alto al massimo
30 mm e spesso 5 mm, base alta 14 mm, personaggio alto 70 mm. Si cambiano nella
sezione *Dimensioni in mm* del file.

## Cosa modificare e dove

- **Prezzi, colori dei filamenti, temi, personaggi**: in cima a
  `js/configuratore.js`. Per un nuovo colore basta aggiungere una riga a
  `LETTER_COLORS` o `ACCENT_COLORS` (nome e codice esadecimale).
- **Misure del modello**: sono sia in `lettera-nome.scad` sia nell'oggetto `M`
  di `js/configuratore.js`. Se ne cambi una, cambiala in tutti e due i file,
  altrimenti l'anteprima del sito non corrisponde più al pezzo stampato.
- **Forme di decorazioni e personaggi**: sono disegnate due volte, in
  `lettera-nome.scad` (3D) e in `js/configuratore.js` (anteprima). Le misure sono
  le stesse nei due file.

## Requisiti

OpenSCAD 2026 o successivo (su Mac: `brew install --cask openscad@snapshot`).
Lo script usa il motore Manifold, che esporta un ordine completo in pochi
secondi. I font sono gratuiti anche per uso commerciale: le licenze sono in
`assets/fonts/licenze/`.
