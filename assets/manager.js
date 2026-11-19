(function () {
  'use strict';
  // La password resta in memoria soltanto durante la gestione, senza archiviazione locale.
  const REPO = 'Razor5489/ORARIO-LEZIONI-NIGHTFALL';
  const API = 'https://nightfall-regolamento-professori.vercel.app/api/orari';
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
  let accessRole = 'admin';
  let lastLogTeacher = '';

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
        <p class="nf-help">Inserisci la <strong>password riservata ai professori</strong> per modificare gli orari. La password di amministrazione resta valida e consente anche di gestire il corpo docenti. Nessuna password è pubblicata nel sito.</p>
        <label for="nf-admin-password" class="nf-label">Password docenti o amministratore</label>
        <input type="password" id="nf-admin-password" placeholder="Inserisci la password" autocomplete="current-password" maxlength="256">
        <div class="nf-flex nf-gap"><button type="button" id="nf-login-btn" class="nf-btn primary">Accedi alla gestione</button></div>
        <p class="nf-help">I professori possono aggiornare materie e fasce orarie, senza accedere alla gestione del corpo docenti. Premi <strong>Pubblica online</strong> per salvare nel registro protetto e aggiornare gli orari visibili agli studenti.</p>
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
          <button type="button" data-page="punti" aria-pressed="false">Punti Casa</button>
          <button type="button" data-page="registro" aria-pressed="false">Lezioni svolte</button>
        </nav>
        <div id="nf-editor-content"></div>
        <div class="nf-footerbar">
          <div><button type="button" class="nf-btn primary" id="nf-publish">Pubblica online</button>
          <button type="button" class="nf-btn" id="nf-discard">Scarta la bozza</button></div>
          <span class="nf-note">Le modifiche salvate saranno visibili agli studenti sul sito GitHub Pages.</span>
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
    const fields = $('nf-editor-content');
    if (fields) fields.inert = next;
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
    const response = await fetch(API, {
      method,
      cache:'no-store',
      headers:{
        'Accept':'application/json',
        'Authorization':'Bearer ' + encodeBase64(token),
        ...(payload ? {'Content-Type':'application/json'} : {})
      },
      body: payload ? JSON.stringify(payload) : undefined
    });
    let result;
    try { result = await response.json(); } catch { result = {}; }
    if (!response.ok) {
      let message = result.error || 'Operazione non riuscita.';
      if (response.status === 401) message = 'Password di gestione errata.';
      if (response.status === 503) message = 'Servizio non ancora configurato.';
      if (response.status === 428) message = 'Questa scheda usa una versione precedente. Esporta la bozza e aggiorna la pagina.';
      if (response.status === 409 && !result.error) message = 'Impossibile unire le modifiche, riprova.';
      throw new Error(message);
    }
    return result;
  }
  function setEditorState(loaded, newSha, role) {
    if (!valid(loaded)) throw new Error('Il file dati GitHub non ha il formato atteso.');
    sha = newSha;
    accessRole = role === "docente" ? "docente" : "admin";
    const teacherNav = $('nf-editor-nav').querySelector('[data-page="docenti"]');
    if (teacherNav) teacherNav.hidden = accessRole !== "admin";
    original = clone(loaded);
    draft = clone(loaded);
    period = '1-1';
    day = DAYS[0];
    page = 'orari';
    if(!draft.points)draft.points={grifondoro:0,tassorosso:0,corvonero:0,serpeverde:0};
    if(!original.points)original.points=clone(draft.points);
    if(!draft.lessons_done)draft.lessons_done={};
    if(!original.lessons_done)original.lessons_done={};
    $('nf-manager-login').hidden = true;
    $('nf-editor').hidden = false;
    status('');
    render();
  }
  async function login() {
    if (busy) return;
    token = $('nf-admin-password').value;
    if (!token) { status('Inserisci la password di gestione.',true,false,'nf-login-status');return; }
    $('nf-admin-password').value = '';
    setBusy(true);
    status('Verifica della password…',false,false,'nf-login-status');
    try {
      const remote = await github();
      setEditorState(remote.document,remote.sha,remote.role);
      status(accessRole === 'docente' ? 'Accesso docenti riuscito: puoi modificare e pubblicare gli orari.' : 'Accesso amministratore riuscito: gestione completa attiva.',false,true);
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
      <div class="nf-flex nf-gap">${accessRole === 'admin' ? '<button type="button" class="nf-btn" id="nf-copy-week">Copia un\'altra settimana</button><button type="button" class="nf-btn danger" id="nf-reset-week">Imposta tutte le lezioni su Tempo libero</button>' : ''}</div>
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
  function renderPointsEditor() {
    const names = Object.entries(HOUSES);
    const cards = names.map(([house, name]) => {
      const n = Number(draft.points?.[house] ?? 0);
      return `<div class="nf-points-editor-card nf-pe-${house}">
        <strong>${escapeHtml(name)}</strong>
        <div class="nf-points-editor-score" data-score-for="${house}">${n.toLocaleString('it-IT')} punti</div>
        <label for="nf-points-amount-${house}">Punti da assegnare o sottrarre</label>
        <input id="nf-points-amount-${house}" type="number" min="1" max="10000" step="1" value="5" data-amount-for="${house}">
        <div class="nf-flex">
          <button type="button" class="nf-btn primary" data-points-house="${house}" data-points-action="add">+ Assegna</button>
          <button type="button" class="nf-btn" data-points-house="${house}" data-points-action="subtract">− Sottrai</button>
        </div>
      </div>`;
    }).join('');
    return `<section class="nf-section">
      <h3>Coppa delle Case — Punti Casa</h3>
      <p class="nf-help">Assegna o sottrai punti a ciascuna Casa. Puoi registrare più variazioni prima di pubblicare. Quando due professori assegnano punti contemporaneamente, le variazioni vengono sommate senza cancellarsi.</p>
      <div class="nf-points-editor-grid">${cards}</div>
      <p class="nf-help">I punteggi visualizzati comprendono le modifiche ancora in bozza. Clicca <strong>Pubblica online</strong> per renderli visibili agli studenti. Non vengono modificati gli orari delle lezioni.</p>
    </section>`;
  }
  function adjustPoints(house, sign) {
    if(!Object.prototype.hasOwnProperty.call(HOUSES,house))return;
    const field=$('nf-editor-content').querySelector('[data-amount-for="'+house+'"]');
    if(!field)return;
    const amount=Number(field.value);
    if(!Number.isSafeInteger(amount)||amount<1||amount>10000){
      status('Inserisci un numero intero di punti da 1 a 10.000.',true);return;
    }
    const old=Number(draft.points?.[house]??0);
    const next=old+sign*amount;
    if(!Number.isSafeInteger(next)||Math.abs(next)>1000000){
      status('Il punteggio risultante deve essere compreso tra -1.000.000 e 1.000.000.',true);return;
    }
    draft.points[house]=next;
    const score=$('nf-editor-content').querySelector('[data-score-for="'+house+'"]');
    if(score)score.textContent=next.toLocaleString('it-IT')+' punti';
    dirtyState();
    status('Variazione aggiunta alla bozza: '+HOUSES[house]+(sign>0?' +':' −')+amount+' punti.');
  }
  function nfLogSlotsHtml(p,d){
    const rows=(draft.schedules?.[p]||[]).filter(row=>row.day===d);
    return rows.map((row,i)=>`<option value="${i}">${i+1}ª lezione · ${escapeHtml(row.start)}–${escapeHtml(row.end)}</option>`).join('');
  }

  function renderDoneEditor(){
    const opts=PERIODS.map(p=>`<option value="${p}" ${p===period?'selected':''}>${periodLabel(p)}</option>`).join('');
    const days=DAYS.map(d=>`<option value="${escapeHtml(d)}" ${d===day?'selected':''}>${escapeHtml(d)}</option>`).join('');
    const houses=Object.entries(HOUSES).map(([h,name])=>`<label class="nf-log-house-option"><input type="checkbox" name="nf-log-house" value="${h}"> ${name}</label>`).join('');
    const entries=Object.entries(draft.lessons_done||{}).sort((a,b)=>(b[1].date+' '+b[1].recorded_at).localeCompare(a[1].date+' '+a[1].recorded_at));
    const rows=entries.slice(0,40).map(([id,r])=>{
      const housenames=(r.houses||[]).map(h=>HOUSES[h]||h).join(', ');
      const summary=`${r.topic?'<strong>'+escapeHtml(r.topic)+'</strong> · ':''}${escapeHtml(r.subject)} · ${escapeHtml(r.professor)}`;
      return `<li class="nf-log-editor-item"><div><strong>${escapeHtml(r.date)}</strong> · ${escapeHtml(periodLabel(r.period))} · ${escapeHtml(r.day)} · ${Number(r.slot)+1}ª lezione
        <span class="nf-log-editor-details">${summary}</span>
        <small>${escapeHtml(housenames)}${r.notes?' · '+escapeHtml(r.notes):''}</small></div>
        ${accessRole==='admin'?`<button type="button" class="nf-btn danger" data-delete-log="${escapeHtml(id)}">Rimuovi</button>`:''}</li>`;
    }).join('');
    const subjects=subjectsList().filter(x=>x!=='Tempo libero').map(x=>`<option value="${escapeHtml(x)}"></option>`).join('');
    return `<section class="nf-section nf-log-section"><h3>Registro delle lezioni svolte</h3>
      <p class="nf-help">Registra le lezioni effettivamente tenute. Puoi scegliere più Case se hanno seguito la stessa lezione. Gli studenti vedranno la registrazione dopo <strong>Pubblica online</strong>.</p>
      <form id="nf-log-form" class="nf-log-form">
        <div class="nf-log-fields">
          <label>Data effettiva della lezione <input id="nf-log-date" type="date" required value="${new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10)}"></label>
          <label>Anno e settimana <select id="nf-log-period">${opts}</select></label>
          <label>Giorno dell'orario <select id="nf-log-day">${days}</select></label>
          <label>Fascia oraria <select id="nf-log-slot">${nfLogSlotsHtml(period,day)}</select></label>
        </div>
        <fieldset class="nf-log-house-field"><legend>Case coinvolte (selezionane almeno una)</legend><div class="nf-log-house-choice">${houses}</div></fieldset>
        <div class="nf-log-fields">
          <label>Materia svolta <input id="nf-log-subject" type="text" list="nf-log-subjects" maxlength="120" required placeholder="Es. Incantesimi"><datalist id="nf-log-subjects">${subjects}</datalist></label>
          <label>Nome del professore <input id="nf-log-teacher" type="text" maxlength="100" required value="${escapeHtml(lastLogTeacher)}" placeholder="Professore che ha tenuto la lezione"></label>
          <label>Argomento (facoltativo) <input id="nf-log-topic" type="text" maxlength="130" placeholder="Es. Incantesimo Lumos"></label>
        </div>
        <label>Breve resoconto (facoltativo) <textarea id="nf-log-notes" rows="2" maxlength="400" placeholder="Cosa è stato spiegato durante la lezione"></textarea></label>
        <div class="nf-flex nf-log-actions"><button class="nf-btn" type="button" id="nf-log-autofill">Usa la materia dell'orario</button>
          <button class="nf-btn primary" type="submit">✓ Segna come svolta</button></div>
      </form>
      <h3 class="nf-log-history-heading">Lezioni registrate <span>(${entries.length})</span></h3>
      <p class="nf-help">Le nuove registrazioni rimangono in bozza fino alla pubblicazione.${accessRole==='admin'?' La Presidenza può rimuovere le registrazioni errate.':' Le eventuali correzioni o eliminazioni possono essere effettuate dalla Presidenza.'}</p>
      ${rows?`<ul class="nf-log-editor-list">${rows}</ul>${entries.length>40?'<p class="nf-note">Sono visualizzate le 40 registrazioni più recenti.</p>':''}`:'<p class="nf-log-empty">Non risultano ancora lezioni registrate.</p>'}
    </section>`;
  }

  function refreshLogSlots(){
    const form=$('nf-log-form');
    if(!form)return;
    const p=form.querySelector('#nf-log-period').value;
    const d=form.querySelector('#nf-log-day').value;
    period=p;day=d;
    const select=form.querySelector('#nf-log-slot');
    const previous=select.value;
    select.innerHTML=nfLogSlotsHtml(p,d);
    if([...select.options].some(o=>o.value===previous))select.value=previous;
  }

  function prefillLogSubject(){
    const form=$('nf-log-form');if(!form)return;
    const homes=[...form.querySelectorAll('input[name="nf-log-house"]:checked')].map(e=>e.value);
    if(!homes.length){status('Seleziona prima almeno una Casa.',true);return;}
    const p=form.querySelector('#nf-log-period').value;
    const d=form.querySelector('#nf-log-day').value;
    const slot=Number(form.querySelector('#nf-log-slot').value);
    const row=(draft.schedules[p]||[]).filter(r=>r.day===d)[slot];
    const subjects=[...new Set(homes.map(h=>normal(row?.subjects?.[h])).filter(x=>x!=='Tempo libero'))];
    if(subjects.length!==1){status(subjects.length?'Le Case selezionate hanno materie diverse: inserisci la materia manualmente.':'Nessuna materia prevista nell’orario: inseriscila manualmente.',true);return;}
    form.querySelector('#nf-log-subject').value=subjects[0];
    status('Materia inserita dall’orario: '+subjects[0]);
  }

  function addDoneLesson(){
    const form=$('nf-log-form');if(!form||!draft)return;
    const date=form.querySelector('#nf-log-date').value;
    const p=form.querySelector('#nf-log-period').value,d=form.querySelector('#nf-log-day').value;
    const slot=Number(form.querySelector('#nf-log-slot').value);
    const houses=[...form.querySelectorAll('input[name="nf-log-house"]:checked')].map(e=>e.value);
    const subject=form.querySelector('#nf-log-subject').value.trim();
    const professor=form.querySelector('#nf-log-teacher').value.trim();
    const topic=form.querySelector('#nf-log-topic').value.trim();
    const notes=form.querySelector('#nf-log-notes').value.trim();
    if(!date || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10)!==date){
      status('Inserisci una data valida per la lezione.',true);return;
    }
    if(!houses.length){status('Seleziona almeno una Casa.',true);return;}
    if(!subject||/^(tempo libero|da programmare)$/i.test(subject)){status('Indica la materia effettivamente svolta.',true);return;}
    if(!professor){status('Inserisci il nome del professore che ha tenuto la lezione.',true);return;}
    const row=(draft.schedules[p]||[]).filter(r=>r.day===d)[slot];
    if(!row){status('Seleziona una fascia oraria valida.',true);return;}
    if(Object.keys(draft.lessons_done||{}).length>=600){status('Il registro è pieno. Contatta la Presidenza per archiviare le registrazioni.',true);return;}
    const id=crypto.randomUUID();
    draft.lessons_done[id]={date,period:p,day:d,slot,houses,subject,professor,topic,notes,start:row.start,end:row.end,recorded_at:new Date().toISOString()};
    lastLogTeacher=professor;
    render();
    status('Lezione segnata come svolta nella bozza. Premi Pubblica online per renderla visibile agli studenti.',false,true);
  }

  function removeDoneLesson(id){
    if(accessRole!=='admin'||!Object.prototype.hasOwnProperty.call(draft.lessons_done||{},id))return;
    if(!confirm('Rimuovere questa lezione dal registro? La modifica sarà effettiva dopo Pubblica online.'))return;
    delete draft.lessons_done[id];
    render();
    status('Registrazione rimossa dalla bozza. Premi Pubblica online per confermare.');
  }
  function render() {
    $('nf-editor-nav').querySelectorAll('button').forEach(button =>
      button.setAttribute('aria-pressed',String(button.dataset.page === page)));
    if (accessRole !== 'admin' && page === 'docenti') page = 'orari';
    $('nf-editor-content').innerHTML = page === 'orari' ? renderSchedule() : page === 'punti' ? renderPointsEditor() : page === 'registro' ? renderDoneEditor() : renderTeachers();
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
    for (const house of Object.keys(HOUSES)) {
      if (!Number.isSafeInteger(draft.points?.[house]) || Math.abs(draft.points[house])>1000000)
        throw new Error('Il punteggio di '+HOUSES[house]+' non è valido.');
    }
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
    if (key && role && role !== 'subject-name' && accessRole === 'admin') {
      draft.teachers[key][role] = element.value;
      dirtyState();
    }
  }
  function onChange(event) {
    const element = event.target;
    if (element.id === 'nf-log-period' || element.id === 'nf-log-day'){refreshLogSlots();return;}
    if (element.id === 'nf-edit-period') {period = element.value; render();return;}
    if (element.id === 'nf-edit-day') {day = element.value; render();return;}
    if (element.id === 'nf-show-teachers') { if (accessRole !== 'admin') return; draft.show_teachers = element.checked;dirtyState();return;}
    if (element.dataset.role === 'subject-name') {if (accessRole !== 'admin') return;teacherRename(element.dataset.teacher,element.value);return;}
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
    const label = accessRole === 'admin' ? 'le modifiche del registro scolastico' : 'gli orari, i Punti Casa e le lezioni svolte';
    if (!confirm('Salvare e pubblicare ' + label + ' per tutti gli studenti? Le modifiche indipendenti degli altri professori verranno mantenute.')) return;
    setBusy(true);
    status('Salvataggio e unione delle modifiche dei professori in corso…');
    try {
      // The backend computes a precise diff against the snapshot used when
      // editing started; do not reject a stale version here.
      const result = await github('PUT',{base:clone(original),document:clone(draft),sha});
      if (!result.ok || !result.document) throw new Error('Il servizio non ha confermato il salvataggio.');
      sha = result.sha || sha;
      draft = clone(result.document);
      original = clone(result.document);
      render();
      if (typeof window.nfUpdatePublic === 'function') window.nfUpdatePublic(clone(result.document));
      const collisions = Number(result.overwritten || 0);
      if (collisions > 0) {
        status('Orari salvati! ' + collisions + ' caselle erano state modificate anche da altri: è stata applicata l’ultima modifica salvata per quelle caselle.',false,true);
      } else if (result.merged) {
        status('Orari salvati e uniti correttamente alle modifiche degli altri professori.',false,true);
      } else {
        status('Orari salvati correttamente e disponibili agli studenti.',false,true);
      }
    } catch(error) {
      status('Salvataggio non riuscito: ' + (error.message || 'Errore sconosciuto') + ' La tua bozza è ancora disponibile.',true);
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
    token = ''; sha = ''; draft = null; original = null; accessRole = 'admin'; lastLogTeacher = '';
    $('nf-admin-password').value = '';
    $('nf-editor').hidden = true;
    $('nf-manager-login').hidden = false;
    status('',false,false,'nf-login-status');
  }
  $('nf-manage').addEventListener('click', () => dialog.showModal());
  $('nf-close-manager').addEventListener('click', closeManager);
  dialog.addEventListener('cancel',event => {event.preventDefault();closeManager();});
  $('nf-login-btn').addEventListener('click',login);
  $('nf-admin-password').addEventListener('keydown',event => {if(event.key === 'Enter'){event.preventDefault();login();}});
  $('nf-logout').addEventListener('click',closeManager);
  $('nf-publish').addEventListener('click',publish);
  $('nf-discard').addEventListener('click',discard);
  $('nf-backup').addEventListener('click',backup);
  $('nf-editor-nav').addEventListener('click',event => {
    const button = event.target.closest('button[data-page]');
    if (!button) return;
    if (accessRole !== 'admin' && button.dataset.page === 'docenti') return;
    page = button.dataset.page;render();
  });
  $('nf-editor-content').addEventListener('input',onInput);
  $('nf-editor-content').addEventListener('change',onChange);
  $('nf-editor-content').addEventListener('submit',event=>{
    if(event.target?.id==='nf-log-form'){
      event.preventDefault();
      if(!busy)addDoneLesson();
    }
  });
  $('nf-editor-content').addEventListener('click',event => {
    if (event.target.closest('#nf-copy-week') && accessRole === 'admin') copyWeek();
    if (event.target.closest('#nf-reset-week') && accessRole === 'admin') resetWeek();
    if (event.target.closest('#nf-add-teacher') && accessRole === 'admin') addTeacher();
    const remove = event.target.closest('[data-remove-teacher]');
    if (remove && accessRole === 'admin') removeTeacher(remove.dataset.removeTeacher);
    if(event.target.closest('#nf-log-autofill'))prefillLogSubject();
    const deleteLog=event.target.closest('[data-delete-log]');
    if(deleteLog)removeDoneLesson(deleteLog.dataset.deleteLog);
    const pointButton=event.target.closest('[data-points-house][data-points-action]');
    if(pointButton){
      adjustPoints(pointButton.dataset.pointsHouse,pointButton.dataset.pointsAction==='add'?1:-1);
    }
  });
})();
