# Nightfall RP — Orario delle Lezioni

Orari scolastici di Hogwarts, consultabili dagli studenti e modificabili direttamente dal sito GitHub Pages tramite il pulsante **Gestisci orari**. Il plugin WordPress resta disponibile come versione separata.

## Contenuto del repository

- `index.html`: sito pubblico GitHub Pages con pulsante **Gestisci orari**.
- `orari.json`: programmi delle quattro settimane ed elenco modificabile dei professori.
- `assets/online.js`, `assets/manager.js` e `assets/online.css`: visualizzazione e pannello di gestione.
- `nightfall-orari/nightfall-orari.php`: plugin WordPress.
- `nightfall-orari/assets/`: stile e funzionalità dell'interfaccia pubblica e di amministrazione.
- `nightfall-orari/data/seed.json`: quattro calendari iniziali e corpo docenti.
- `Nightfall-Orari-WordPress.zip`: plugin pronto da installare da WordPress.

## Pubblicazione su GitHub Pages

Il sito pubblico si trova nel file `index.html` alla radice del repository.

**Attivazione iniziale (solo una volta, dall'account proprietario del repository):**

1. Apri [Settings → Pages](https://github.com/Razor5489/ORARIO-LEZIONI-NIGHTFALL/settings/pages).
2. In **Build and deployment**, seleziona **Source: Deploy from a branch**.
3. Seleziona **Branch: main** e **Folder: /(root)**, poi clicca **Save**.
4. GitHub pubblicherà il sito all'indirizzo **https://razor5489.github.io/ORARIO-LEZIONI-NIGHTFALL/**. L'indirizzo funziona solo dopo che GitHub Pages è attivo e la pubblicazione è riuscita.

Le successive modifiche al ramo `main`, incluso `orari.json`, aggiornano automaticamente la pagina. Il sito legge dinamicamente i dati da `orari.json`. La modifica del foglio Google o del plugin WordPress non aggiorna automaticamente il sito GitHub Pages: sono due sistemi indipendenti.

## Gestisci orari direttamente dal sito

Il pulsante **⚙ Gestisci orari** è presente nella pagina pubblica.

- **Accesso professori:** utilizza una password esclusiva del registro orari, distinta da quella del Regolamento scolastico. Consente di modificare materie e fasce orarie delle settimane del 1° e del 2° anno, ma non di cambiare l'elenco del corpo docenti. Le operazioni massive di copia e svuotamento della settimana non sono presentate ai professori.
- **Accesso amministratore:** continua a usare la password generale del Regolamento scolastico. Consente di gestire anche il corpo docenti, la loro visibilità e le operazioni massive.
- **Pubblica online:** salva le modifiche nel file `orari.json` del repository tramite il servizio protetto su Vercel. Gli studenti visualizzano gli aggiornamenti tramite GitHub Pages.
- **Backup:** permette di esportare il contenuto JSON prima di salvare.

La password dei professori è una variabile sensibile denominata `ORARI_DOCENTI_PASSWORD`, conservata sul server nel progetto Vercel **nightfall-regolamento-professori**, non pubblicata in GitHub né nella pagina degli studenti. Può essere cambiata dalle impostazioni Vercel, seguita da una nuova distribuzione del progetto. Il servizio utilizza inoltre la variabile privata `GITHUB_TOKEN` con permessi **Contents: Read and write** sul repository `Razor5489/ORARIO-LEZIONI-NIGHTFALL`.

**Nota sulla condivisione:** tutti coloro che ricevono la password dei professori possono cambiare gli orari di tutte le Case e settimane. Per revocare l'accesso a una persona è necessario cambiare la password condivisa. Il sistema non distingue automaticamente chi ha effettuato una modifica.

## Installazione WordPress

1. Scarica `Nightfall-Orari-WordPress.zip` dal repository.
2. In WordPress vai su **Plugin → Aggiungi nuovo → Carica plugin** e seleziona lo ZIP.
3. Attiva **Nightfall RP – Orari delle Lezioni**.
4. Vai su **Orari Nightfall → Strumenti e pubblicazione** e usa **Crea pagina pubblica automaticamente**, oppure inserisci lo shortcode `[nightfall_orari]` in una pagina.

## Funzioni

- Programmi distinti per **1° e 2° anno**, **settimana 1 e 2**.
- **Grifondoro, Tassorosso, Corvonero, Serpeverde** con materie per fascia.
- Fasce iniziali **21:30–23:00**, con 15 minuti di lezione e intervalli.
- Etichetta **«Tempo libero»** per lezioni non assegnate.
- **Corpo docenti** modificabile, mostrato agli studenti se l'opzione è abilitata.
- Pannello amministrativo WordPress con autorizzazione `manage_options`.
- Importazione ed esportazione CSV, duplicazione, azzeramento e ripristino settimane.

I dati iniziali sono una copia dal foglio Google dell'utente, non una sincronizzazione automatica. Le modifiche effettuate in WordPress sono salvate nel database del sito WordPress, non su GitHub Pages.

**Importante:** GitHub Pages può servire l'anteprima statica, ma non può eseguire PHP/WordPress: per il pannello amministrativo occorre un hosting WordPress.

Fonte: [foglio Google di Nightfall](https://docs.google.com/spreadsheets/d/1bAdULktWYNNLEwTDhGuNIwvoLWqDcLDFYwAUSm8NHPc/edit).
