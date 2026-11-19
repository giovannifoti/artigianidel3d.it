# Lettera con nome: modello parametrico

`lettera-nome.scad` è il modello originale di artigianidel3d da cui escono sia
l'anteprima 3D del configuratore (`/lettera-personalizzata`) sia i file di stampa.
L'oggetto finito è alto 20 cm: base 17 mm, lettera 186 mm incastrata per 3 mm.

Il sorgente non viene pubblicato nel sito: lo usa solo la funzione Netlify
`netlify/functions/lettera.mjs`, con la build WebAssembly ufficiale di OpenSCAD
in `vendor/openscad-node/` (versione 2026.11.18, licenza GPL-2.0,
sorgenti su https://github.com/openscad/openscad).

## Dalla richiesta ai file da stampare

1. Il cliente invia la richiesta dal configuratore: ti arriva la notifica su
   Telegram e la richiesta compare nel pannello admin, scheda **Richieste lettere**.
2. Contatti il cliente dai pulsanti WhatsApp, Chiama o Email e aggiorni lo stato.
3. **Scarica 3MF** genera uno ZIP con un file per gruppo di stampa e un
   `LEGGIMI.txt` con i colori. **Scarica STL** dà invece i pezzi singoli.

In alternativa, sul Mac con OpenSCAD installato:

```bash
./modello/esporta.sh modello/ordini/esempio-salvatore.scad
```

La cartella `modello/ordini/` non va su git (conterrebbe nomi di clienti), tranne
gli esempi `esempio-*.scad`.

## Gruppi di stampa

In ogni 3MF i pezzi sono oggetti separati e già allineati: in Bambu Studio
conferma "oggetto singolo con più parti" e assegna i filamenti.

| File | Contenuto e stampa |
| --- | --- |
| `1-lettera-e-decorazioni` | Lettera sdraiata, con le decorazioni (1,2 mm) sulla faccia superiore. |
| `2-nome` | Nome in corsivo sdraiato, da incollare sulla lettera poco sopra metà altezza. |
| `3-base` | Base con la sede della lettera (3 mm, gioco 0,25 mm) e il logo inciso sotto, già specchiato. Con `logo = "intarsio"` il logo diventa un secondo oggetto a filo, per stamparlo in un altro colore. |
| `4-personaggio` | Corpo, dettagli bianchi, cuore e occhi. Serve il supporto ad albero sotto testa e braccia. Si incolla davanti alla lettera, a sinistra. |

Le lettere larghe (M, W) hanno basi lunghe fino a circa 30 cm: il pannello
avvisa quando la base va messa in diagonale sul piatto da 256 mm.

## Cosa modificare e dove

- **Misure**: in `lettera-nome.scad` (sezione *Dimensioni in mm*) e nell'oggetto
  `M` di `js/lettera-core.js`. Vanno cambiate insieme: il browser le usa per
  posizionare le decorazioni e disegnare l'anteprima immediata.
- **Font**: devono stare in `assets/fonts/` ed essere caricati con `use <...>`
  nel modello e con `@font-face` in `lettera-personalizzata.html`. Prima di
  aggiungerne uno, prova che la build WebAssembly lo legga: Titan One e
  Yellowtail, per esempio, la fanno andare in errore.
- **Scritta del logo sotto la base**: è in `logo-scritta.scad`, già convertita
  in contorni. Non dipende da nessun font.
