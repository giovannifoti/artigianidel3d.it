# Guida completa — artigianidel3d

Questa guida parte da zero. Al termine avrai:

- una vetrina pubblica su Netlify;
- un database PostgreSQL su Supabase;
- immagini conservate in Supabase Storage;
- un pannello admin accessibile con email e password;
- permessi RLS che consentono modifiche soltanto al tuo account.

Non servono server personali e non ci sono dipendenze npm da installare.

## 1. Crea il progetto Supabase

1. Vai su [supabase.com/dashboard](https://supabase.com/dashboard) e crea un
   account.
2. Premi **New project**.
3. Se richiesto, crea prima un'organizzazione.
4. Imposta questi dati:
   - **Name:** `artigianidel3d`;
   - **Database password:** genera una password forte e conservala nel tuo
     password manager. Non è la password del pannello admin;
   - **Region:** scegli una regione europea vicina, per esempio Frankfurt;
   - **Plan:** il piano gratuito è sufficiente per iniziare.
5. Premi **Create new project** e attendi che il database sia pronto.

## 2. Crea tabelle, permessi e archivio immagini

1. Nel menu Supabase apri **SQL Editor**.
2. Premi **New query**.
3. Apri il file `supabase-schema.sql` di questo progetto.
4. Copia tutto il contenuto, incollalo nell'editor e premi **Run**.
5. Controlla che l'operazione termini senza errori.

Lo script crea:

- `public.products`, con titolo, descrizione, prezzo e percorso immagine;
- `public.admin_users`, l'elenco degli account autorizzati;
- il bucket pubblico `product-images`;
- tutte le policy RLS per lettura pubblica e scrittura riservata.

Puoi verificare i risultati in **Table Editor** e **Storage**. In
**Database > Security Advisor** non dovrebbero comparire segnalazioni di RLS
mancante per queste tabelle.

Se il database era già stato creato con una versione precedente del progetto,
esegui anche `supabase-migration-price-from.sql` nel SQL Editor. La migrazione
aggiunge l'opzione “A partire da” senza modificare o eliminare i prodotti già
presenti.

### Adeguamento prezzi del 10% (ottobre 2026)

I prezzi del catalogo si trovano solo nella colonna `price` della tabella
`public.products`: homepage, schede, messaggi WhatsApp e dati strutturati per
Google li leggono da lì. Per applicare l'aumento del 10%:

1. apri **SQL Editor > New query**, incolla tutto
   `supabase-migration-prezzi-2026-10.sql` e premi **Run**;
2. controlla la tabella di riepilogo: ogni riga deve riportare “aggiornato”;
3. su Netlify avvia un nuovo deploy (**Deploys > Trigger deploy > Deploy site**)
   per aggiornare anche la copia del catalogo inclusa nell'HTML e nei dati per
   Google. Il sito mostra comunque i nuovi prezzi ai visitatori subito dopo il
   passaggio 1.

Il file si può eseguire più volte senza effetti: l'aumento resta registrato in
`public.price_adjustments` e ogni prodotto cambia solo se ha ancora il prezzo
di partenza previsto. In fondo al file c'è la query per annullarlo.

Dopo l'aumento, `supabase-migration-arrotondamento-2026-10.sql` porta ogni
prezzo al multiplo di 0,50 € successivo (4,40 → 4,50; 6,60 → 7,00). Si esegue
allo stesso modo, solo dopo il file dell'aumento, e anche questo non ha effetti
se ripetuto. Al termine avvia di nuovo un deploy su Netlify.

## 3. Crea il tuo account amministratore

1. Apri **Authentication > Users**.
2. Premi **Add user** e scegli la creazione di un nuovo utente.
3. Inserisci la tua email e una password forte e diversa da quella del
   database.
4. Se compare l'opzione, crea l'utente come già confermato/auto-confirmed.
5. Torna in **SQL Editor**, crea una nuova query e incolla:

```sql
insert into public.admin_users (user_id)
select id
from auth.users
where lower(email) = lower('LA-TUA-EMAIL@DOMINIO.IT')
on conflict (user_id) do nothing
returning user_id;
```

6. Sostituisci l'indirizzo di esempio con quello appena creato e premi **Run**.
7. Devi vedere un UUID restituito. Se non appare alcuna riga, l'email non
   corrisponde all'utente creato.

Infine apri la configurazione generale di **Authentication** e disattiva
**Allow new users to sign up**. In questo modo potranno accedere soltanto utenti
creati manualmente da te. Il frontend, comunque, non espone alcun modulo di
registrazione.

## 4. Recupera i due valori pubblici di connessione

Nel progetto Supabase premi **Connect**, oppure apri **Settings > API Keys**.
Recupera:

1. **Project URL**, simile a `https://abcdefgh.supabase.co`;
2. **Publishable key**, che inizia con `sb_publishable_`.

La Publishable Key è pensata per il codice eseguito nel browser. Non copiare e
non usare mai nel progetto una **Secret key**, una `service_role` o la password
del database.

## 5A. Pubblicazione semplice su Netlify, senza GitHub

Sul computer deve essere disponibile Node.js 20 o superiore.

### Metodo automatico su macOS

Fai doppio clic sul file visibile `CONFIGURA-SITO.command`, incolla Project URL
e Publishable Key quando richiesti e attendi la fine. Lo script crea `.env`,
esegue la build e apre automaticamente la cartella `dist`.

Se macOS blocca il primo avvio, fai clic destro sul file, scegli **Apri** e
conferma.

### Metodo manuale

1. Nella cartella del progetto duplica `.env.example` chiamando la copia `.env`.
2. Apri `.env` e inserisci i valori reali:

```env
SUPABASE_URL=https://abcdefgh.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxxx
```

3. Apri il Terminale nella cartella del progetto ed esegui:

```bash
npm run build
```

4. Verrà creata la cartella `dist`.
5. Vai su [app.netlify.com/drop](https://app.netlify.com/drop) e trascina
   **la cartella `dist`**, non l'intero progetto.
6. Netlify assegnerà un indirizzo simile a
   `https://nome-casuale.netlify.app`.

Il file `.env` è escluso da Git tramite `.gitignore`. La build inserisce nel
sito soltanto URL e Publishable Key, che sono valori pubblici.

## 5B. Pubblicazione consigliata con GitHub e deploy automatici

1. Crea un repository GitHub e carica questa cartella, senza `.env` e `dist`.
2. Su Netlify scegli **Add new site > Import an existing project**.
3. Collega GitHub e seleziona il repository.
4. Netlify leggerà automaticamente `netlify.toml`:
   - build command: `npm run build`;
   - publish directory: `dist`.
5. Prima del deploy definitivo apri le impostazioni del sito Netlify, quindi
   **Environment variables**.
6. Aggiungi due variabili disponibili almeno nello scope **Builds**:
   - `SUPABASE_URL`;
   - `SUPABASE_PUBLISHABLE_KEY`.
7. Avvia **Deploy site** oppure **Trigger deploy**.

Ogni modifica futura al repository genererà automaticamente un nuovo deploy.
I prodotti, invece, vengono aggiornati direttamente dal database e non
richiedono un nuovo deploy.

## 6. Prova completa prima della pubblicazione

1. Apri la home: con un database nuovo vedrai il catalogo vuoto.
2. Apri direttamente `https://artigianidel3d.it/admin.html`.
3. Accedi con l'email e la password create in Supabase.
4. Inserisci un prodotto con immagine JPG, PNG o WebP sotto i 5 MB.
5. Torna alla home e aggiorna la pagina: il prodotto deve comparire.
6. Prova il pulsante WhatsApp e controlla nome e prezzo nel messaggio.
7. Elimina il prodotto dall'admin e verifica che scompaia dalla home.
8. Prova credenziali errate: il pannello deve restare nascosto.

## Sicurezza: cosa è pubblico e cosa no

L'indirizzo di `admin.html` può essere conosciuto: su un hosting statico la
pagina di login non è un segreto. Ciò che conta è che il pannello e le operazioni
siano bloccati da autenticazione e policy RLS. Anche chiamando direttamente le
API, un visitatore anonimo può soltanto leggere i prodotti.

Il progetto include inoltre:

- nessun link pubblico verso l'admin;
- `noindex` e `no-store` per `admin.html`;
- Content Security Policy e altri header HTTP in `_headers`;
- whitelist dei soli formati JPG, PNG e WebP;
- limite immagini di 5 MB applicato sia nel browser sia in Storage;
- pulizia dell'immagine se il salvataggio del prodotto fallisce;
- chiavi segrete completamente assenti dal frontend.

## Utilizzo quotidiano

Per aggiungere o rimuovere prodotti visita `/admin.html`. Non devi aprire
Supabase o Netlify per la normale gestione del catalogo. Supabase servirà solo
per cambiare la password, autorizzare un altro amministratore o controllare il
database.
