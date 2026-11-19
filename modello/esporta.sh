#!/bin/bash
# Esporta i file di stampa di un ordine, come il pulsante "Scarica 3MF" del pannello admin.
#
# Uso:   ./modello/esporta.sh modello/ordini/lettera-salvatore.scad
# Esito: una cartella accanto al file con un .3mf per gruppo di stampa:
#   1-lettera-e-decorazioni, 2-nome, 3-base, 4-personaggio (se c'è)
# In ogni 3MF i pezzi sono oggetti separati e già allineati: in Bambu Studio importali
# come "oggetto singolo con più parti" e assegna i filamenti.

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Uso: $0 modello/ordini/nome-ordine.scad" >&2
  exit 1
fi

ORDINE="$1"
OPENSCAD="${OPENSCAD:-$(command -v openscad || echo /Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD)}"
[ -f "$ORDINE" ] || { echo "File non trovato: $ORDINE" >&2; exit 1; }

NOME="$(basename "$ORDINE" .scad)"
USCITA="$(dirname "$ORDINE")/$NOME"
mkdir -p "$USCITA"

for VOCE in "gruppo_lettera:1-lettera-e-decorazioni" "gruppo_nome:2-nome" "gruppo_base:3-base" "gruppo_personaggio:4-personaggio"; do
  PARTE="${VOCE%%:*}"
  FILE="$USCITA/${VOCE##*:}.3mf"
  rm -f "$FILE"
  LOG="$("$OPENSCAD" --backend=Manifold --enable=lazy-union -D "parte=\"$PARTE\"" -o "$FILE" "$ORDINE" 2>&1 || true)"
  if [ -s "$FILE" ]; then
    echo "  ✓ ${VOCE##*:}"
  elif echo "$LOG" | grep -q -i "empty"; then
    echo "  – ${VOCE##*:} (non serve per questo ordine)"
  else
    echo "  ✗ ${VOCE##*:}: errore di OpenSCAD" >&2
    echo "$LOG" | grep -i -E "error|warning" | grep -v -i "overwritten" >&2 || true
    exit 1
  fi
done

echo "File pronti in: $USCITA"
