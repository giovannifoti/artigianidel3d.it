# artigianidel3d

Portfolio responsive per prodotti stampati in 3D con ordini via WhatsApp,
catalogo Supabase e pannello admin autenticato.

## Struttura

- `index.html` — vetrina pubblica;
- `admin.html` — login, aggiunta, modifica ed eliminazione prodotti;
- `assets/` — logo orizzontale, variante chiara, simbolo e avatar Instagram nei formati SVG e PNG;
- `supabase-schema.sql` — database, Storage e policy RLS;
- `supabase-migration-price-from.sql` — migrazione per la dicitura “A partire da”;
- `scripts/build.mjs` — build Netlify e generazione della configurazione;
- `netlify.toml` — comando di build e directory di pubblicazione;
- `_headers` — header HTTP di sicurezza;
- `.env.example` — nomi delle variabili richieste;
- `CONFIGURA-SITO.command` — configurazione e build guidate su macOS;
- `CONFIGURAZIONE.md` — guida completa dalla creazione alla verifica.

## Avvio rapido

Segui [CONFIGURAZIONE.md](CONFIGURAZIONE.md). Dopo aver creato Supabase:

```bash
cp .env.example .env
npm run build
python3 -m http.server 4173 --directory dist
```

Apri `http://127.0.0.1:4173` e
`http://127.0.0.1:4173/admin.html`.
