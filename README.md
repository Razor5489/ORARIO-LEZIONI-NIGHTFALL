# Nightfall RP — Orario delle Lezioni

Orari scolastici di Hogwarts, consultabili dagli studenti e modificabili da WordPress.

## Contenuto del repository

- `index.html`: anteprima statica interattiva per gli studenti (non salva modifiche).
- `nightfall-orari/nightfall-orari.php`: plugin WordPress.
- `nightfall-orari/assets/`: stile e funzionalità dell'interfaccia pubblica e di amministrazione.
- `nightfall-orari/data/seed.json`: quattro calendari iniziali e corpo docenti.
- `Nightfall-Orari-WordPress.zip`: plugin pronto da installare da WordPress.

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
