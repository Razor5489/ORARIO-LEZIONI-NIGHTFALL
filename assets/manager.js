(function () {
  'use strict';
  // The GitHub token stays in memory only; it is never embedded in the public website or stored.
  const REPO = 'Razor5489/ORARIO-LEZIONI-NIGHTFALL';
  const API = 'https://api.github.com/repos/' + REPO + '/contents/orari.json';
  const DAYS = ['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì'];
  const HOUSES = {grifondoro:'Grifondoro',tassorosso:'Tassorosso',corvonero:'Corvonero',serpeverde:'Serpeverde'};
  const PERIODS = ['1-1','1-2','2-1','2-2'];
  const ROLE_NAMES = {primary:'Professore',secondary:'Secondo professore',staff:'Professore staff'};
  const $ = id => document.getElementById(id);
  const escapeHtml = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone = obj => JSON.parse(JSON.stringify(obj));
  const normal = value => (!String(value || '').trim() || /^(da programmare|tempo libero)$/i.test(String(value).trim())) ? 'Tempo libero' : String(value).trim();

  let token = '';
  let sha = '';
  let original = null;
  let draft = null;
  let period = '1-1';
  let day = DAYS[0];
  let page = 'orari';
  let busy = false;

  const dialog = document.createElement('dialog');
  dialog.id = 'nf-manage-dialog';
  dialog.className = 'nf-manager';
  dialog.setAttribute('aria-labelledby','nf-manager-heading');
  dialog.innerHTML = `
    <header class="nf-manager-head">
      <div><h2 id="nf-manager-heading">Gestisci orari</h2><p>Nightfall Roleplay · Programma scolastico di Hogwarts</p></div>
      <button type="button" class="nf-close" id="nf-close-manager" aria-label="Chiudi gestione">×</button>
    </header>
    <div class="nf-manager-main">
      <section id="nf-manager-login" class="nf-auth">
        <h3>Accesso alla gestione</h3>
        <p class="nf-help">Puoi modificare direttamente lezioni, fasce orarie e professori e pubblicare le modifiche per tutti gli studenti. L'accesso usa un <strong>token personale GitHub</strong> autorizzato per questo repository: la normale password GitHub non deve essere inserita qui.</p>
        <label for="nf-admin-token" class="nf-label">Token GitHub per pubblicare</label>
        <input type="password" id="nf-admin-token" placeholder="github_pat_… o ghp_…" autocomplete="off" spellcheck="false">
        <div class="nf-flex nf-gap"><button type="button" id="nf-login-btn" class="nf-btn primary">Accedi alla gestione</button>
          <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer">Crea un token su GitHub</a></div>
        <p class="nf-help">Per creare il token: seleziona il proprietario <strong>Razor5489</strong>, consenti l'accesso al solo repository <strong>ORARIO-LEZIONI-NIGHTFALL</strong> e abilita il permesso <strong>Contents: Read and write</strong>. Copia il token qui. Non sarà salvato nel browser né pubblicato nel repository.</p>
        <p id="nf-login-status" class="nf-status" role="status" aria-live="polite"></p>
      </section>
      <section id="nf-editor" hidden>
        <div class="nf-flex">
          <span class="nf-dirty" id="nf-dirty" hidden>Modifiche non pubblicate</span>
          <button type="button" class="nf-btn" id="nf-backup">Scarica backup JSON</button>
          <button type="button" class="nf-btn" id="nf-logout">Esci</button>
        </div>
        <nav class="nf-switcher" id="nf-editor-nav" aria-label="Sezione da modificare">
          <button type="button" data-page="orari" aria-pressed="true">Orario lezioni</button>
          <button type="button" data-page="docenti" aria-pressed="false">Corpo docenti</button>
        </nav>
        <div id="nf-editor-content"></div>
        <div class="nf-footerbar">
          <div><button type="button" class="nf-btn primary" id="nf-publish">Pubblica online</button>
          <button type="button" class="nf-btn" id="nf-discard">Scarta la bozza</button></div>
          <span class="nf-note">Le modifiche diventeranno pubbliche dopo l'aggiornamento di GitHub Pages.</span>
        </div>
        <p id="nf-editor-status" class="nf-status" role="status" aria-live="polite"></p>
      </section>
    </div>`;
  document.body.appendChild(dialog);

  function status(message, error=false, success=false, target='nf-editor-status') {
    const e = $(target);
    if (!e) return;
    e.textContent = message;
    e.className = 'nf-status' + (error ? ' error' : success ? ' success' : '');
  }
  function changed() {
    return !!(draft && original && JSON.stringify(draft) !== JSON.stringify(original));
  }
  function dirtyState() {
    $('nf-dirty').hidden = !changed();
  }
  function setBusy(next) {
    busy = next;
    for (const id of ['nf-login-btn','nf-publish','nf-discard']) {
      if ($(id)) $(id).disabled = next;
    }
  }
  function valid(source) {
    return source && typeof source === 'object' && source.teachers && typeof source.teachers === 'object'
      && source.schedules && PERIODS.every(key => Array.isArray(source.schedules[key]) &&
        source.schedules[key].length === 20 && source.schedules[key].every(row =>
          DAYS.includes(row.day) && row.subjects && typeof row.subjects === 'object'));
  }
  function decodeBase64(base64) {
    const binary = atob(String(base64).replace(/\s/g, ''));
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  function encodeBase64(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    return btoa(binary);
  }
  async function github(method='GET', payload) {
    const response = await fetch(API + (method === 'GET' ? '?ref=main&ts=' + Date.now() : ''), {
      method,
      cache:'no-store',
      headers:{
        'Accept':'application/vnd.github+json',
        'X-GitHub-Api-Version':'2022-11-28',
        'Authorization':'Bearer ' + token,
        ...(payload ? {'Content-Type':'application/json'} : {})
      },
      body: payload ? JSON.stringify(payload) : undefined
    });
    let result;
    try { result = await response.json(); } catch { result = {}; }
    if (!response.ok) {
      let message = result.message || 'Operazione non riuscita.';
      if (response.status === 401) message = 'Token non valido o scaduto.';
      if (response.status === 403) message = 'Accesso negato: verifica il permesso Contents: Read and write e il repository autorizzato.';
      if (response.status === 409 || response.status === 422) message = 'È stata rilevata una modifica concorrente. Ricarica la gestione prima di pubblicare.';
      throw new Error(message);
    }
    return result;
  }
  function setEditorState(loaded, newSha) {
    if (!valid(loaded)) throw new Error('Il file dati GitHub non ha il formato atteso.');
    sha = newSha;
    original = clone(loaded);
    draft = clone(loaded);
    period = '1-1';
    day = DAYS[0];
    page = 'orari';
    $('nf-manager-login').hidden = true;
    $('nf-editor').hidden = false;
    status('');
    render();
  }
  async function login() {
    if (busy) return;
    token = $('nf-admin-token').value.trim();
    if (!token) { status('Inserisci un token GitHub autorizzato.',true,false,'nf-login-status');return; }
    $('nf-admin-token').value = '';
    setBusy(true);
    status('Verifica autorizzazione GitHub…',false,false,'nf-login-status');
    try {
      const remote = await github();
      setEditorState(JSON.parse(decodeBase64(remote.content)),remote.sha);
      status('Accesso riuscito. Puoi modificare i dati e pubblicarli.',false,true);
    } catch (error) {
      token = '';
      status(error.message,true,false,'nf-login-status');
    } finally { setBusy(false); }
  }
  function periodLabel(key) {
    const [year,week] = key.split('-');
    return year + '° anno · Settimana ' + week;
  }
  function subjectsList() {
    const names = new Set(Object.keys(draft.teachers));
    for (const rows of Object.values(draft.schedules)) {
      for (const row of rows) {
        for (const subject of Object.values(row.subjects)) {
          if (normal(subject) !== 'Tempo libero') names.add(String(subject));
        }
      }
    }
    names.add('Tempo libero');
    return [...names].sort((a,b) => a.localeCompare(b,'it'));
  }
  function renderSchedule() {
    const rows = draft.schedules[period];
    const selections = PERIODS.map(p => '<option value="' + p + '"' + (period === p ? ' selected' : '') + '>' + periodLabel(p) + '</option>').join('');
    const dayOptions = DAYS.map(d => '<option value="' + escapeHtml(d) + '"' + (day === d ? ' selected' : '') + '>' + escapeHtml(d) + '</option>').join('');
    const hints = subjectsList().map(name => '<option value="' + escapeHtml(name) + '"></option>').join('');
    const found = rows.map((row,index) => ({row,index})).filter(entry => entry.row.day === day);
    const tableRows = found.map(({row,index}) => {
      const inputs = Object.entries(HOUSES).map(([key,label]) =>
        '<td><input type="text" list="nf-subject-options" maxlength="120" aria-label="' + label + ', lezione ' + (index+1) +
        '" data-row="' + index + '" data-field="subject" data-house="' + key + '" value="' + escapeHtml(normal(row.subjects[key])) + '"></td>'
      ).join('');
      return '<tr><td><input type="time" data-row="' + index + '" data-field="start" aria-label="Inizio lezione" value="' + escapeHtml(row.start) +
        '"></td><td><input type="time" data-row="' + index + '" data-field="end" aria-label="Fine lezione" value="' + escapeHtml(row.end) +
        '"></td>' + inputs + '</tr>';
    }).join('');
    return `<section class="nf-section">
      <h3>Orario delle lezioni</h3>
      <div class="nf-flex">
        <label>Anno e settimana<select id="nf-edit-period">${selections}</select></label>
        <label>Giorno scolastico<select id="nf-edit-day">${dayOptions}</select></label>
      </div>
      <p class="nf-help">Modifica direttamente le fasce orarie e la materia prevista per ciascuna Casa. Se una lezione non è assegnata, scrivi <strong>Tempo libero</strong>.</p>
      <datalist id="nf-subject-options">${hints}</datalist>
      <div class="nf-editor-table-wrap"><table class="nf-editor-table">
        <thead><tr><th>Inizio</th><th>Fine</th>${Object.values(HOUSES).map(h => '<th>' + h + '</th>').join('')}</tr></thead>
        <tbody>${tableRows}</tbody>
      </table></div>
      <div class="nf-flex nf-gap"><button type="button" class="nf-btn" id="nf-copy-week">Copia un'altra settimana</button>
      <button type="button" class="nf-btn danger" id="nf-reset-week">Imposta tutte le lezioni su Tempo libero</button></div>
      <p class="nf-note">Questi pulsanti agiscono soltanto sulla settimana selezionata. Le modifiche restano in bozza fino a «Pubblica online».</p>
    </section>`;
  }
  function renderTeachers() {
    const items = Object.entries(draft.teachers).map(([subject,people],i) => `
      <div class="nf-teacher-edit">
        <div class="nf-field"><label class="nf-label" for="nf-teach-name-${i}">Materia</label><input id="nf-teach-name-${i}" type="text" data-teacher="${escapeHtml(subject)}" data-role="subject-name" value="${escapeHtml(subject)}" maxlength="120"></div>
        ${Object.entries(ROLE_NAMES).map(([key,role]) => '<div class="nf-field"><label class="nf-label">' + role + '</label><input type="text" data-teacher="' + escapeHtml(subject) + '" data-role="' + key + '" maxlength="180" value="' + escapeHtml(people[key] || '') + '"></div>').join('')}
        <button class="nf-btn danger" type="button" data-remove-teacher="${escapeHtml(subject)}" aria-label="Rimuovi ${escapeHtml(subject)}">×</button>
      </div>`).join('');
    return `<section class="nf-section"><h3>Corpo docenti</h3>
      <label><input type="checkbox" id="nf-show-teachers" ${draft.show_teachers !== false ? 'checked' : ''}> Mostra l'elenco dei professori agli studenti</label>
      <p class="nf-help">Puoi cambiare le materie e assegnare o sostituire il professore principale, il secondo professore e quello staff. Lascia vuoti i posti non ancora assegnati.</p>
      <div id="nf-teachers-edit">${items}</div>
      <button type="button" class="nf-btn" id="nf-add-teacher">+ Aggiungi materia</button>
    </section>`;
  }
  function render() {
    $('nf-editor-nav').querySelectorAll('button').forEach(button =>
      button.setAttribute('aria-pressed',String(button.dataset.page === page)));
    $('nf-editor-content').innerHTML = page === 'orari' ? renderSchedule() : renderTeachers();
    dirtyState();
  }
  function teacherRename(oldName,newName) {
    const next = String(newName || '').trim();
    if (!next || next === oldName) {render();return;}
    if (Object.prototype.hasOwnProperty.call(draft.teachers,next)) {
      status('Esiste già una materia con questo nome.',true);
      render(); return;
    }
    const rewritten = {};
    for (const [name,people] of Object.entries(draft.teachers)) {
      rewritten[name === oldName ? next : name] = people;
    }
    draft.teachers = rewritten;
    // The name in timetable cells can remain different when subjects are intentionally named differently.
    dirtyState();render();
  }
  function onInput(event) {
    if (!draft) return;
    const element = event.target;
    const rowIndex = element.dataset.row;
    const field = element.dataset.field;
    if (rowIndex !== undefined && field) {
      const row = draft.schedules[period]?.[Number(rowIndex)];
      if (!row) return;
      if (field === 'subject') row.subjects[element.dataset.house] = element.value;
      else if (field === 'start' || field === 'end') row[field] = element.value;
      dirtyState();return;
    }
    const key = element.dataset.teacher;
    const role = element.dataset.role;
    if (key && role && role !== 'subject-name') {
      draft.teachers[key][role] = element.value;
      dirtyState();
    }
  }
  function onChange(event) {
    const element = event.target;
    if (element.id === 'nf-edit-period') {period = element.value; render();return;}
    if (element.id === 'nf-edit-day') {day = element.value; render();return;}
    if (element.id === 'nf-show-teachers') {draft.show_teachers = element.checked;dirtyState();return;}
    if (element.dataset.role === 'subject-name') {teacherRename(element.dataset.teacher,element.value);return;}
    if (element.dataset.field === 'subject') {
      const row = draft.schedules[period][Number(element.dataset.row)];
      row.subjects[element.dataset.house] = normal(element.value);
      element.value = row.subjects[element.dataset.house];
      dirtyState();
    }
  }
  function copyWeek() {
    const from = prompt('Da quale settimana vuoi copiare? Scrivi 1-1, 1-2, 2-1 oppure 2-2.',period);
    if (from === null) return;
    const key = from.trim();
    if (!PERIODS.includes(key)) {status('Settimana non valida. Usa ad esempio 1-2.',true);return;}
    if (!confirm('Sostituire tutte le lezioni di ' + periodLabel(period) + ' con quelle di ' + periodLabel(key) + '?')) return;
    draft.schedules[period] = clone(draft.schedules[key]);
    dirtyState();render();
    status('Settimana copiata nella bozza. Premi Pubblica online per renderla effettiva.');
  }
  function resetWeek() {
    if (!confirm('Impostare tutte le lezioni di ' + periodLabel(period) + ' su «Tempo libero», mantenendo gli orari?')) return;
    for (const row of draft.schedules[period]) {
      for (const house of Object.keys(HOUSES)) row.subjects[house] = 'Tempo libero';
    }
    dirtyState();render();status('Settimana svuotata nella bozza.');
  }
  function addTeacher() {
    const label = prompt('Nome della nuova materia:');
    if (label === null) return;
    const name = label.trim();
    if (!name || name.length > 120) {status('Il nome della materia non è valido.',true);return;}
    if (Object.prototype.hasOwnProperty.call(draft.teachers,name)) {status('Materia già presente.',true);return;}
    draft.teachers[name] = {primary:'',secondary:'',staff:''};
    dirtyState();render();status('Materia aggiunta nella bozza.');
  }
  function removeTeacher(name) {
    if (!confirm('Rimuovere la materia «' + name + '» dall’elenco docenti? Le lezioni già assegnate non verranno eliminate.')) return;
    delete draft.teachers[name];
    dirtyState();render();
  }
  function validateBeforePublish() {
    if (!valid(draft)) throw new Error('I dati degli orari non sono completi.');
    for (const key of PERIODS) {
      for (const row of draft.schedules[key]) {
        if (!/^\d{2}:\d{2}$/.test(row.start) || !/^\d{2}:\d{2}$/.test(row.end) || row.start >= row.end) {
          throw new Error('Controlla le fasce orarie in ' + periodLabel(key) + ': gli orari devono essere validi.');
        }
        for (const house of Object.keys(HOUSES)) row.subjects[house] = normal(row.subjects[house]);
      }
    }
    for (const [name,people] of Object.entries(draft.teachers)) {
      if (!name.trim()) throw new Error('Le materie dei docenti devono avere un nome.');
      for (const key of Object.keys(ROLE_NAMES)) people[key] = String(people[key] || '').trim();
    }
  }
  async function publish() {
    if (busy) return;
    try {validateBeforePublish();} catch(error) {status(error.message,true);return;}
    if (!changed()) {status('Nessuna modifica da pubblicare.');return;}
    if (!confirm('Pubblicare le modifiche degli orari e del corpo docenti per tutti gli studenti?')) return;
    setBusy(true);status('Controllo della versione e pubblicazione su GitHub…');
    try {
      const remote = await github();
      if (remote.sha !== sha) throw new Error('Qualcuno ha già modificato gli orari su GitHub. Scarica un backup della bozza ed esci, poi rientra per evitare sovrascritture.');
      draft.updated_at = new Date().toISOString();
      const result = await github('PUT',{
        message:'Aggiorna orari e corpo docenti dal pannello Nightfall',
        branch:'main',
        sha:sha,
        content:encodeBase64(JSON.stringify(draft,null,2) + '\n')
      });
      sha = result.content?.sha || sha;
      original = clone(draft);
      dirtyState();
      if (typeof window.nfUpdatePublic === 'function') window.nfUpdatePublic(clone(draft));
      status('Pubblicazione riuscita! Le modifiche sono state inviate a GitHub e appariranno a tutti dopo l’aggiornamento di Pages.',false,true);
    } catch(error) {
      status('Pubblicazione non riuscita: ' + (error.message || 'Errore sconosciuto') + '. La bozza è ancora disponibile.',true);
    } finally {setBusy(false);}
  }
  function backup() {
    if (!draft) return;
    const blob = new Blob([JSON.stringify(draft,null,2)+'\n'],{type:'application/json;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');link.href=url;link.download='nightfall-orari-backup.json';link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function discard() {
    if (!changed()) {status('La bozza è già aggiornata.');return;}
    if (!confirm('Scartare le modifiche non pubblicate?')) return;
    draft=clone(original);render();status('Bozza ripristinata.');
  }
  function closeManager() {
    if (busy) return;
    if (changed() && !confirm('Hai modifiche non pubblicate. Uscire e perderle?')) return;
    dialog.close();
    token = ''; sha = ''; draft = null; original = null;
    $('nf-admin-token').value = '';
    $('nf-editor').hidden = true;
    $('nf-manager-login').hidden = false;
    status('',false,false,'nf-login-status');
  }
  $('nf-manage').addEventListener('click', () => dialog.showModal());
  $('nf-close-manager').addEventListener('click', closeManager);
  dialog.addEventListener('cancel',event => {event.preventDefault();closeManager();});
  $('nf-login-btn').addEventListener('click',login);
  $('nf-admin-token').addEventListener('keydown',event => {if(event.key === 'Enter'){event.preventDefault();login();}});
  $('nf-logout').addEventListener('click',closeManager);
  $('nf-publish').addEventListener('click',publish);
  $('nf-discard').addEventListener('click',discard);
  $('nf-backup').addEventListener('click',backup);
  $('nf-editor-nav').addEventListener('click',event => {
    const button = event.target.closest('button[data-page]');
    if (!button) return;
    page = button.dataset.page;render();
  });
  $('nf-editor-content').addEventListener('input',onInput);
  $('nf-editor-content').addEventListener('change',onChange);
  $('nf-editor-content').addEventListener('click',event => {
    if (event.target.closest('#nf-copy-week')) copyWeek();
    if (event.target.closest('#nf-reset-week')) resetWeek();
    if (event.target.closest('#nf-add-teacher')) addTeacher();
    const remove = event.target.closest('[data-remove-teacher]');
    if (remove) removeTeacher(remove.dataset.removeTeacher);
  });
})();
