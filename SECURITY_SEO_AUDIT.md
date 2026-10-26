# Audit sicurezza, SEO e prestazioni — artigianidel3d.it

Data: 26 ottobre 2026
Punto di ripristino: tag Git `pre-audit-2026-10-26` (commit `14fb577`, stato precedente a queste modifiche).

## Panoramica del progetto

- **Stack:** sito statico HTML/CSS/JavaScript vanilla, nessuna dipendenza npm. Catalogo prodotti, login admin e immagini su Supabase (PostgreSQL + Auth + Storage con Row Level Security). Statistiche con GoatCounter.
- **Build:** `npm run build` (Node 22 su Netlify) → cartella `dist/`. Lo script genera `config.js` dalle variabili d'ambiente `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`.
- **Deploy:** repository `github.com/giovannifoti/artigianidel3d.it`, branch di produzione `main`, deploy automatico Netlify.
- **Dominio ufficiale:** `https://artigianidel3d.it` (verificato: `www` e `http` reindirizzano con 301 al dominio principale, HSTS attivo).
- **Pagine:** `/` (vetrina pubblica, pagina singola) e `/admin.html` (pannello riservato, `noindex`).

### Problemi trovati, per gravità

| Gravità | Problema |
|---|---|
| Critico (SEO) | Nessun riferimento a "stampa 3D" o "Reggio Calabria" in title, H1 e testi. Il sito non poteva posizionarsi per le ricerche locali. |
| Critico (prestazioni) | Le 24 foto prodotto sono PNG da circa 2 MB l'una (circa 38 MB in totale scorrendo la pagina). |
| Importante | `robots.txt` e `sitemap.xml` assenti (404). |
| Importante | Catalogo visibile solo dopo l'esecuzione di JavaScript: l'HTML iniziale non conteneva prodotti. |
| Importante | Nessun dato strutturato Schema.org e nessuna immagine Open Graph. |
| Importante (sicurezza) | CSP con `'unsafe-inline'` per gli script; script di terze parti senza verifica di integrità (SRI); CSP aperta a qualsiasi `*.supabase.co`. |
| Importante (accessibilità) | Pulsanti rosa con testo bianco sotto la soglia di contrasto WCAG AA (3,2:1); etichette accessibili dei pulsanti WhatsApp non coerenti con il testo visibile. |
| Minore | Nessuna pagina 404 personalizzata; nessuna icona per iOS; link interni a `index.html` (URL duplicato di `/`); pagina vetrina che andava in errore se il CDN di Supabase non rispondeva. |

## 1. Sicurezza: problemi e correzioni

**Esito generale:** non sono emerse vulnerabilità sfruttabili. Il codice esistente era già impostato bene: tutto il testo proveniente dal database viene inserito con `textContent` (nessun XSS DOM), le policy RLS limitano scrittura e cancellazione agli utenti nella tabella `admin_users`, il bucket immagini accetta solo JPEG/PNG/WebP fino a 5 MB e non permette il listing pubblico.

**Segreti:** analizzata l'intera cronologia Git. Nessuna chiave segreta, `service_role` o password è mai stata committata. `.env`, `config.js`, `dist/` e `*.zip` sono esclusi da `.gitignore`. La chiave `sb_publishable_…` è pubblica per progetto (sta nel browser di ogni visitatore) e non va revocata. **Non serve rigenerare nessuna credenziale.**

**Dipendenze:** l'unica libreria esterna è `@supabase/supabase-js@2.108.2`; `npm audit` riporta 0 vulnerabilità note. Esiste una versione più recente (2.118.0) senza correzioni di sicurezza rilevanti per questo uso: l'aggiornamento è facoltativo.

Correzioni implementate:

1. **CSP senza `'unsafe-inline'` per gli script.** Gli script inline di `index.html` e `admin.html` sono stati spostati in `js/site.js` e `js/admin.js`. Un'eventuale iniezione di HTML non può più eseguire JavaScript.
2. **Subresource Integrity (SRI)** su Supabase (`dist/umd/supabase.js`, hash verificato confrontandolo con il pacchetto npm ufficiale) e su GoatCounter (`count.v4.js`, versione fissa con l'hash pubblicato da GoatCounter). Se il CDN servisse un file alterato, il browser lo bloccherebbe.
3. **CSP ristretta al solo progetto Supabase del sito**, non più a qualsiasi `*.supabase.co`: la build sostituisce i segnaposto in `_headers` con l'origine reale.
4. **`Cross-Origin-Opener-Policy: same-origin`** aggiunto agli header esistenti (HSTS, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` erano già presenti; HSTS `max-age=31536000` è inviato da Netlify).
5. **Vetrina più robusta:** se la libreria Supabase non si carica (rete o SRI), la pagina non va più in errore e mostra comunque il catalogo pre-generato.
6. URL delle immagini prodotto accettati solo in `https:` (prima erano ammessi anche `http:` e `data:`).

## 2. SEO: problemi rilevati e risolti

- **Title:** da "artigianidel3d — Portfolio" a "Stampa 3D a Reggio Calabria su richiesta | artigianidel3d" (57 caratteri).
- **Meta description** nuova (152 caratteri) con servizio, città, tipo di lavori e invito al preventivo.
- **H1:** "Stampa 3D a Reggio Calabria — L'immaginazione prende forma in 3D." Lo slogan e l'aspetto restano gli stessi; la parte con la keyword occupa il posto della vecchia etichetta sopra il titolo.
- **Gerarchia dei titoli:** un H1 e cinque H2 descrittivi (servizi, collezione, preventivo, FAQ, invito finale), con gli H3 per servizi, passaggi e prodotti.
- **Nuove sezioni di contenuto** (scritte in modo naturale, senza ripetizioni forzate):
  - *Servizio di stampa 3D a Reggio Calabria:* stampa 3D personalizzata, stampa su richiesta, prototipazione 3D, piccole serie.
  - *Come richiedere un preventivo:* tre passaggi via WhatsApp.
  - *Domande frequenti:* costi, zona servita, partire da un'idea o da un file, prototipi, tempi, come ordinare.
  - Invito finale al preventivo e footer con città, contatto WhatsApp e link interni.
- **Catalogo pre-generato:** la build legge i prodotti da Supabase (sola lettura) e li scrive nell'HTML. Google e i crawler che non eseguono JavaScript vedono subito le 24 schede; nel browser JavaScript le aggiorna con i dati in tempo reale. Se Supabase non risponde durante la build, il deploy non fallisce e il catalogo viene caricato dal browser come prima.
- **Dati strutturati (JSON-LD):** `WebSite`, `ProfessionalService` (sottotipo di LocalBusiness: Reggio Calabria, area servita Reggio Calabria e Italia, telefono, servizi), `FAQPage` e `ItemList` di `Product` con prezzo (`AggregateOffer` per i prezzi "a partire da"). Tutti i blocchi sono JSON valido.
- **Open Graph / Twitter Card** complete, con una nuova immagine di anteprima 1200×630 (`assets/og-image.jpg`).
- **Canonical** `https://artigianidel3d.it/`; link interni puntati a `/` invece di `index.html`.
- **`robots.txt`** (accesso consentito a tutto, con riferimento alla sitemap). Il pannello admin resta fuori dall'indice grazie all'header `X-Robots-Tag: noindex` e non viene bloccato in robots.txt, altrimenti Google non potrebbe leggere quel `noindex`.
- **`sitemap.xml`** generata dalla build con la data di `lastmod`.
- **Pagina 404** personalizzata (`noindex`, link alla home e a WhatsApp).
- **Testo alternativo delle immagini prodotto:** "[nome prodotto], oggetto stampato in 3D da artigianidel3d".
- Il pulsante "Richiedi un preventivo" ora ha il link WhatsApp direttamente nell'HTML (prima era `#` fino all'esecuzione di JavaScript).

## 3. Prestazioni, accessibilità e UX

- **Ottimizzazione automatica delle immagini nel pannello admin:** le nuove foto vengono ridimensionate (massimo 1600 px) e convertite in WebP prima del caricamento (JPEG se il browser non supporta la codifica WebP). Test reale su una foto del catalogo: PNG da 1.699 KB → WebP da 40 KB. Ora si possono scegliere anche foto fino a 25 MB scattate col telefono.
- **Pulsante "Ottimizza immagini"** nel pannello admin, per convertire in un solo passaggio le foto già pubblicate (vedi le operazioni da completare).
- **Cache:** le nuove immagini su Supabase hanno cache di un anno (nomi univoci, mai sovrascritti). I file JS hanno l'hash nel nome (`site.<hash>.js`) e cache `immutable` di un anno; `assets/` ha cache di un giorno.
- **Script con `defer`** e `preconnect` verso Supabase; dimensioni fisse sulle immagini (CLS a 0).
- **Contrasto:** pulsanti principali da `#ff3cac` a `#d6157f` con testo bianco: contrasto da 3,2:1 a 4,9:1 (WCAG AA). Il rosa del brand resta invariato nel logo, nei gradienti e nei dettagli.
- **Accessibilità:** link "Vai al contenuto", focus visibile sui nuovi elementi, pulsanti "Ordina via WhatsApp" diventati link veri (funzionano anche se il browser blocca i popup) con etichetta coerente con il testo visibile, FAQ con `<details>` native e navigabili da tastiera.
- **Navigazione:** menu con Servizi, Collezione, Come funziona e FAQ, più il pulsante "Preventivo" sempre visibile (da smartphone resta solo il pulsante).

## 4. File modificati

| File | Modifica |
|---|---|
| `index.html` | Metadati SEO, JSON-LD, nuove sezioni, CSS, contrasto, script esterni con SRI e `defer` |
| `admin.html` | Script esterno con SRI, riquadro "Ottimizza immagini", contrasto pulsante |
| `js/site.js` (nuovo) | Logica della vetrina (prima inline), link WhatsApp reali, gestione del catalogo pre-generato |
| `js/admin.js` (nuovo) | Logica admin (prima inline), ottimizzazione WebP, conversione delle immagini esistenti |
| `scripts/build.mjs` | Pre-generazione del catalogo e dei dati strutturati, sitemap, CSP con l'origine Supabase, JS con hash |
| `_headers` | CSP più restrittiva, COOP, cache per `/js/*`, `/assets/*` e sitemap |
| `robots.txt`, `404.html` (nuovi) | Indicizzazione e pagina di errore |
| `assets/og-image.jpg`, `assets/apple-touch-icon.png` (nuovi) | Anteprima social e icona per iOS |
| `SECURITY_SEO_AUDIT.md` (nuovo) | Questo documento |

## 5. Test eseguiti e risultati

- `npm run build`: **superato** (24 prodotti pre-generati).
- `node --check` su `js/site.js`, `js/admin.js` e `scripts/build.mjs`: **superato**.
- Validazione HTML (`html-validate`): `index.html` e `404.html` **senza errori**. `admin.html` ha 5 segnalazioni minori già presenti prima (due `<main>`, un `for` ridondante, l'anteprima immagine senza `src` iniziale), senza effetti sul funzionamento.
- JSON-LD: tutti i blocchi letti correttamente come JSON (`WebSite`, `ProfessionalService`, `FAQPage`, `ItemList`).
- Test nel browser su un server locale che applica gli stessi header di `_headers` (CSP compresa):
  - vetrina desktop e mobile (375 px): nessun errore in console, nessuna violazione CSP, nessuno scroll orizzontale, 24 schede e immagini caricate, link WhatsApp corretti, FAQ apribili;
  - pannello admin: si carica senza errori e mostra il login. **Il login non è stato provato**, perché richiede le tue credenziali;
  - pagina 404 mostrata per gli URL inesistenti;
  - GoatCounter caricato con SRI (in locale non conta le visite, come previsto);
  - ottimizzazione immagini provata su foto reali del catalogo (solo lettura, nessun dato modificato).
- **Lighthouse** (mobile simulato):

| | Prestazioni | Accessibilità | Best practice | SEO |
|---|---|---|---|---|
| Sito online prima delle modifiche | 83 | 95 | 100 | 100 |
| Nuova versione (server locale) | 91–96 | 100 | 100 | 100 |
| **Sito online dopo il deploy** | **96** | **100** | **100** | **100** |

  Sul sito online dopo il deploy: LCP da 3,6 s a 2,5 s, CLS da 0,053 a 0. Le misure non includono ancora l'ottimizzazione delle foto già pubblicate.

  La misura locale è prudente: il server di prova non comprime i file, mentre Netlify sì. Il punteggio SEO era già 100 anche prima, perché Lighthouse controlla solo i requisiti tecnici di base, non la pertinenza dei contenuti per le ricerche locali.

## 6. Vulnerabilità e limiti ancora presenti

- **Foto già pubblicate:** restano PNG da circa 2 MB finché non usi "Ottimizza immagini" nel pannello admin. Non posso farlo io, perché serve il tuo accesso da amministratore.
- **`style-src 'unsafe-inline'`** resta nella CSP: serve ai blocchi `<style>` interni. Il rischio è basso, perché gli script inline sono ormai bloccati.
- **Google Fonts** blocca il primo rendering per circa 0,6 s. Si può eliminare ospitando il font sul sito (vedi raccomandazioni).
- **Scheda prodotto:** l'ID utente dell'admin compare nel percorso delle immagini. È un UUID non sfruttabile grazie a RLS, ma va segnalato.
- **Impostazioni Supabase che non posso verificare dal codice:**
  - in *Authentication → Sign In / Providers* tieni **disattivata la registrazione di nuovi utenti** ("Allow new users to sign up"). Anche se fosse attiva, RLS impedirebbe le modifiche, ma è meglio chiuderla;
  - valuta di attivare **MFA** e la **protezione dalle password compromesse** per il tuo account admin.
- Lo snapshot del catalogo nell'HTML si aggiorna a ogni deploy. Nel frattempo i visitatori vedono comunque i dati aggiornati, caricati dal browser. Per tenere aggiornato anche lo snapshot si può creare un *Build hook* Netlify (vedi raccomandazioni).

## 7. Stato del commit e del push

- Commit `e386d32` "Audit sicurezza, SEO locale e prestazioni" pubblicato su `origin/main` (push normale, senza force).
- Tag di ripristino `pre-audit-2026-10-26` pubblicato su GitHub. Per tornare alla versione precedente: `git revert e386d32` (oppure ripristina dal tag).

## 8. Stato del deploy Netlify

Deploy Netlify **completato e verificato** circa 30 secondi dopo il push. Controlli sul sito online:

- `/` → 200, nuovo title, 24 schede prodotto e 2 blocchi JSON-LD nell'HTML (la build su Netlify ha letto correttamente il catalogo);
- `/robots.txt` e `/sitemap.xml` → 200, con i tipi di contenuto corretti; `/pagina-inesistente` → 404 con la pagina personalizzata;
- header online: nuova CSP senza `'unsafe-inline'` per gli script e limitata al progetto Supabase, `Cross-Origin-Opener-Policy`, HSTS; `js/site.<hash>.js` con cache `immutable`; `/admin.html` con `X-Robots-Tag: noindex`;
- nel browser: nessun errore in console né violazione CSP, librerie Supabase e GoatCounter caricate con SRI, 24 immagini caricate, pannello admin funzionante fino alla schermata di login.

Non ho accesso alla dashboard Netlify: lo stato del deploy è verificato dal contenuto effettivamente servito dal dominio.

## 9. Google Search Console: operazioni da completare

Richiedono il tuo account Google e non posso eseguirle io:

1. Vai su <https://search.google.com/search-console> e aggiungi una proprietà di tipo **Dominio** per `artigianidel3d.it`.
2. Google ti fornisce un record **TXT**: aggiungilo al DNS del dominio, dal pannello Netlify DNS se il dominio è gestito da Netlify (*Domain management → artigianidel3d.it → DNS settings → Add new record*), altrimenti dal tuo registrar. Poi premi **Verifica**.
3. In **Sitemap** invia `https://artigianidel3d.it/sitemap.xml`.
4. In **Controllo URL** inserisci `https://artigianidel3d.it/` e premi **Richiedi indicizzazione**.
5. Dopo qualche giorno controlla i report **Pagine** e **Miglioramenti** (dati strutturati) per eventuali avvisi.
6. Facoltativo: verifica gli stessi dati strutturati con il test dei risultati multimediali (<https://search.google.com/test/rich-results>).

## 10. Raccomandazioni SEO future, per priorità

1. **Crea o completa il Profilo dell'attività su Google (Google Business Profile)** con categoria "Servizio di stampa 3D", zona servita Reggio Calabria e il link al sito. Per le ricerche locali come "stampa 3D Reggio Calabria" è il fattore che pesa di più. Se hai un indirizzo che può essere pubblico, aggiungi via e numero civico anche ai dati strutturati.
2. **Converti le foto esistenti** con "Ottimizza immagini" nel pannello admin.
3. **Raccogli recensioni reali** su Google dai clienti soddisfatti.
4. **Verifica i testi dei servizi** (in particolare "Prototipazione 3D" e "Piccole serie") e aggiungi dettagli concreti che puoi garantire: materiali usati, dimensioni massime di stampa, tempi medi, spedizione.
5. **Pagine dedicate** quando avrai contenuti sufficienti: per esempio `/stampa-3d-personalizzata/`, `/prototipazione-3d/` e una galleria di lavori su commissione con foto e descrizioni reali. Ogni pagina va aggiunta alla sitemap.
6. **Collega i profili social** (per esempio Instagram) dal footer e nel campo `sameAs` dei dati strutturati.
7. **Build hook Netlify** chiamato dopo le modifiche al catalogo (o una ricostruzione giornaliera), per tenere aggiornato lo snapshot dei prodotti nell'HTML.
8. **Font sul sito** (Manrope in WOFF2) per eliminare la dipendenza da Google Fonts e migliorare il primo rendering.
9. Valuta **pagine prodotto singole** con URL propri: oggi tutti i prodotti stanno nella home e non possono posizionarsi singolarmente.
