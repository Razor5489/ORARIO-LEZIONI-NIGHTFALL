# Nightfall RP — Orario delle lezioni

Sito degli orari scolastici di Hogwarts, consultabile dagli studenti su GitHub Pages e modificabile dai professori tramite un pannello protetto da password.

## Sito pubblico

https://razor5489.github.io/ORARIO-LEZIONI-NIGHTFALL/

Il sito mostra i programmi di **1° e 2° anno**, **settimana 1 e 2**, dal lunedì al venerdì, per **Grifondoro, Tassorosso, Corvonero e Serpeverde**. Le lezioni non ancora assegnate sono chiamate **Tempo libero**.

I dati pubblici sono letti da `https://nightfall-regolamento-professori.vercel.app/api/orari-public`, che restituisce gli orari dall'archivio Vercel Blob privato. Le modifiche pubblicate sono visibili agli studenti senza effettuare commit a GitHub né attendere nuove distribuzioni GitHub Pages.

## Gestisci orari

Clicca sul pulsante **⚙ Gestisci orari** nella pagina pubblica. Sono disponibili due livelli di accesso:

- **Password professori**: consente di modificare gli orari, le materie e le fasce orarie di tutte le Case e le settimane; non consente di modificare l'elenco del personale scolastico.
- **Password amministratore**: conserva l'accesso alla gestione completa degli orari, del corpo docenti e delle operazioni massive.

Dopo le modifiche, clicca **Pubblica online**. Il pannello salva tramite `https://nightfall-regolamento-professori.vercel.app/api/orari` e unisce automaticamente le modifiche degli altri professori.

### Modifiche contemporanee

- Ogni salvataggio contiene solo le caselle realmente modificate rispetto alla bozza iniziale.
- Se due docenti modificano caselle differenti, entrambe le modifiche vengono mantenute, anche con salvataggi simultanei.
- Il server verifica la versione del file tramite ETag e riprova automaticamente quando un altro salvataggio arriva nello stesso istante; gli ETag `W/` vengono normalizzati per i file grandi.
- Se due utenti modificano **la stessa casella**, viene mantenuto l'ultimo valore salvato e il pannello segnala la sovrapposizione.
- Le modifiche al corpo docenti rimangono riservate all'amministratore.
- **Scarica backup JSON** consente di conservare una copia della bozza.

Le password e il token di accesso al Blob non sono presenti nel codice pubblico: Vercel li conserva in variabili d'ambiente protette. Non è necessario concedere ai professori accesso a GitHub, Vercel o Google.

## Amministrazione

Il backend si trova nel repository [Regolamento-scolastico](https://github.com/Razor5489/Regolamento-scolastico) ed è distribuito nel progetto Vercel `nightfall-regolamento-professori`. Per gli orari usa queste variabili d'ambiente:

- `ORARI_DOCENTI_PASSWORD`: password dedicata da condividere ai professori
- `ADMIN_PASSWORD`: password generale amministratore (già usata per il Regolamento scolastico)
- `BLOB_READ_WRITE_TOKEN`: credenziale del Blob privato `nightfall-orari-dati`, collegato al progetto

Quando un professore non deve più avere accesso, cambia `ORARI_DOCENTI_PASSWORD` su Vercel e ridistribuisci il progetto. La password condivisa non distingue i professori individualmente.

## Contenuto del repository

- `index.html`: sito pubblico su GitHub Pages
- `assets/online.js`: visualizzazione orari dal servizio pubblico
- `assets/manager.js`: pannello e gestione protetta
- `assets/online.css`: stile dell'amministrazione
- `orari.json`: copia iniziale di riferimento, non più usata come archivio modificabile
- `nightfall-orari/`: versione alternativa sotto forma di plugin WordPress
- `Nightfall-Orari-WordPress.zip`: plugin installabile separatamente

Il foglio Google [Orario Nightfall](https://docs.google.com/spreadsheets/d/1bAdULktWYNNLEwTDhGuNIwvoLWqDcLDFYwAUSm8NHPc/edit) e il plugin WordPress non sono sincronizzati automaticamente con questo portale.

> Il sito pubblico resta ospitato su GitHub Pages. Solo i dati modificabili vengono conservati in Vercel Blob, per consentire la pubblicazione online con password senza dipendere dai permessi di scrittura del token GitHub.
