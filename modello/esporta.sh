#!/bin/bash
# Esporta tutti i pezzi stampabili di un ordine.
#
# Uso:   ./esporta.sh ordini/lettera-salvatore.scad [3mf|stl]
# Esito: una cartella accanto al file (ordini/lettera-salvatore/) con un file per pezzo.
#
# Nello slicer importa insieme, come un unico oggetto multicolore:
#   - lettera + decorazioni
#   - personaggio + personaggio_dettagli + personaggio_cuore + personaggio_occhi
#   - base + logo (solo se logo = "intarsio")
# Il nome si stampa a parte e si incolla sulla lettera.

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Uso: $0 ordini/nome-ordine.scad [3mf|stl]" >&2
  exit 1
fi

ORDINE="$1"
FORMATO="${2:-3mf}"
OPENSCAD="${OPENSCAD:-$(command -v openscad || echo /Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD)}"

if [ ! -f "$ORDINE" ]; then
  echo "File non trovato: $ORDINE" >&2
  exit 1
fi

NOME="$(basename "$ORDINE" .scad)"
USCITA="$(dirname "$ORDINE")/$NOME"
mkdir -p "$USCITA"

PARTI="lettera decorazioni nome base logo personaggio personaggio_dettagli personaggio_cuore personaggio_occhi"

for PARTE in $PARTI; do
  FILE="$USCITA/$NOME-$PARTE.$FORMATO"
  rm -f "$FILE"
  LOG="$("$OPENSCAD" --backend=Manifold -D "parte=\"$PARTE\"" -o "$FILE" "$ORDINE" 2>&1 || true)"
  if [ -s "$FILE" ]; then
    echo "  ✓ $PARTE"
  elif echo "$LOG" | grep -q -i "empty"; then
    echo "  – $PARTE (non serve per questo ordine)"
  else
    echo "  ✗ $PARTE: errore di OpenSCAD" >&2
    echo "$LOG" | grep -i -E "error|warning" | grep -v -i "overwritten" >&2 || true
    exit 1
  fi
done

echo "Pezzi pronti in: $USCITA"
