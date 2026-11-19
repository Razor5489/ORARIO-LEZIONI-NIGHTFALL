NIGHTFALL RP – ORARI DELLE LEZIONI
================================

Plugin WordPress indipendente per mostrare agli studenti gli orari delle lezioni di Hogwarts e aggiornarli dal pannello di amministrazione.

INSTALLAZIONE
1. Accedi al tuo WordPress come amministratore.
2. Apri Plugin → Aggiungi nuovo plugin → Carica plugin.
3. Carica il file Nightfall-Orari-WordPress.zip e attivalo.
4. Nel menu laterale trovi «Orari Nightfall».
5. Apri «Strumenti e pubblicazione» e clicca «Crea pagina pubblica automaticamente».
   In alternativa crea una pagina WordPress e inserisci lo shortcode [nightfall_orari].
6. Condividi con gli studenti il link della pagina pubblicata.

GESTIONE LEZIONI
• Programma lezioni → seleziona Anno 1/2 e Settimana 1/2.
• Ogni giornata ha quattro lezioni, ciascuna con orario di inizio, fine e materia per le quattro Case.
• Modifica una o più caselle, poi clicca «Salva programma». Le modifiche sono subito visibili online.
• «Tempo libero» indica una materia non ancora assegnata.
• Corpo docenti: modifica i nomi. I docenti sono visibili agli studenti per impostazione predefinita; puoi nasconderli da Strumenti e pubblicazione.

DATI INIZIALI
Sono stati preparati i quattro programmi del foglio Google condiviso il 19/11/2026:
• Anno 1, settimana 1: lezioni esistenti del foglio.
• Anno 1, settimana 2: tutte le materie «Tempo libero».
• Anno 2, settimana 1: lezioni esistenti del foglio.
• Anno 2, settimana 2: assegnazioni del lunedì, resto «Tempo libero».
• Le fasce iniziali sono 21:30–21:45, 21:55–22:10, 22:20–22:35 e 22:45–23:00.
I dati sono una copia iniziale: il plugin NON aggiorna automaticamente Google Sheets, né modifica il file Google.

IMPORTAZIONE CSV
• In Google Sheets seleziona esattamente il tab da importare.
• File → Scarica → Valori separati da virgola (.csv).
• In WordPress seleziona anno e settimana, apri «Strumenti e pubblicazione» e carica il CSV.
• Il plugin importa le colonne A–G (Giorno, Inizio, Fine, Grifondoro, Tassorosso, Corvonero, Serpeverde) e richiede 20 lezioni: quattro per giorno da lunedì a venerdì.
• Sono supportati delimitatori virgola, punto e virgola e tabulazione.
• Le etichette «Da programmare» e le celle vuote diventano «Tempo libero».
• Prima di importare, verifica la settimana di destinazione: viene sostituito il suo programma.

PERSONALIZZAZIONE PAGINA
Shortcode di base: [nightfall_orari]
Esempi:
  [nightfall_orari anno="2" settimana="1"]
  [nightfall_orari anno="1" settimana="2" casa="serpeverde"]
Le opzioni iniziali sono comunque modificabili dai visitatori tramite i pulsanti.

RUOLI E VISIBILITÀ
• Studenti: accesso in sola lettura alla pagina pubblica, senza login.
• Amministratori WordPress (manage_options): permesso di modificare orari, docenti e impostazioni.
• I nomi dei professori restano nascosti finché non attivi «Mostra i professori agli studenti».
• La pagina pubblica può essere stampata.

ALTRE NOTE
• Non occorre installare altre librerie o servizi di terzi.
• Non è incluso un dominio, un account hosting o un'installazione WordPress: il plugin si installa su un sito WordPress già attivo.
• Se il sito utilizza una cache, svuotala per visualizzare immediatamente i nuovi orari.
• Per modificare il design, puoi intervenire sul CSS in assets/public.css (le modifiche potrebbero essere sovrascritte reinstallando il plugin).
