(function () {
  'use strict';
  const HOUSES = { grifondoro: 'Grifondoro', tassorosso: 'Tassorosso', corvonero: 'Corvonero', serpeverde: 'Serpeverde' };
  const DAYS = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì'];
  const names = Object.keys(HOUSES);
  const esc = (text) => String(text ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const normal = (value) => !value || /^(da programmare|tempo libero)$/i.test(String(value).trim()) ? 'Tempo libero' : String(value);
  const cell = (value, house) => {
    const v = normal(value);
    return `<td class="nf-cell-${house}"><span class="nf-lesson${v === 'Tempo libero' ? ' nf-free' : ''}">${esc(v)}</span></td>`;
  };

  function allHouses(rows) {
    return `<div class="nf-section-title"><h3>Programma settimanale</h3><span>Dal lunedì al venerdì · Quattro Case</span></div>` + DAYS.map(day => {
      const selection = rows.filter(row => row.day === day);
      return `<section class="nf-day"><div class="nf-day-title"><span>✧</span><h4>${day}</h4></div><div class="nf-table-wrap"><table class="nf-table"><thead><tr><th>FASCIA ORARIA</th>${names.map(h => `<th class="nf-th-${h}">${HOUSES[h]}</th>`).join('')}</tr></thead><tbody>${selection.map(row => `<tr><th>${esc(row.start)} – ${esc(row.end)}</th>${names.map(h => cell(row.subjects?.[h], h)).join('')}</tr>`).join('')}</tbody></table></div></section>`;
    }).join('');
  }

  function singleHouse(rows, house) {
    const firstDay = rows.filter(row => row.day === DAYS[0]);
    const byDay = DAYS.map(day => rows.filter(row => row.day === day));
    const tableRows = [0, 1, 2, 3].map(index => `<tr><th>Lezione ${index + 1}<span class="nf-cell-time">${esc(firstDay[index]?.start || '')} – ${esc(firstDay[index]?.end || '')}</span></th>${byDay.map(dayRows => {
      const row = dayRows[index];
      const subject = normal(row?.subjects?.[house]);
      return `<td class="nf-cell-${house}"><span class="nf-cell-time">${esc(row?.start || '')} – ${esc(row?.end || '')}</span><span class="nf-lesson${subject === 'Tempo libero' ? ' nf-free' : ''}">${esc(subject)}</span></td>`;
    }).join('')}</tr>`).join('');
    return `<div class="nf-house-ribbon nf-ribbon-${house}">◆ ${HOUSES[house]}</div><div class="nf-section-title"><h3>Orario della Casa</h3><span>Dal lunedì al venerdì</span></div><section class="nf-day nf-house-view"><div class="nf-table-wrap"><table class="nf-table"><thead><tr><th>FASCIA</th>${DAYS.map(d => `<th>${esc(d)}</th>`).join('')}</tr></thead><tbody>${tableRows}</tbody></table></div></section>`;
  }

  function teacherSection(teachers) {
    const roles = [
      {key: 'primary', label: 'Professore'},
      {key: 'secondary', label: 'Secondo professore'},
      {key: 'staff', label: 'Professore staff'}
    ];
    const items = Object.entries(teachers).map(([subject, people]) => {
      const assigned = roles.filter(role => String(people?.[role.key] || '').trim());
      const members = assigned.length
        ? assigned.map(role => `<li><span class="nf-teacher-role">${esc(role.label)}</span><span class="nf-teacher-name">${esc(people[role.key])}</span></li>`).join('')
        : '<li class="nf-teacher-empty">Da assegnare</li>';
      return `<article class="nf-teacher"><h4>${esc(subject)}</h4><ul>${members}</ul></article>`;
    }).join('');
    return `<div class="nf-section-title"><h3>Corpo docenti</h3><span>Elenco ufficiale · Aggiornabile dalla Presidenza</span></div><div class="nf-teachers-grid">${items}</div>`;
  }

  const HOUSE_POINTS_ORDER=['grifondoro','tassorosso','corvonero','serpeverde'];
  function renderPoints(points) {
    const values=HOUSE_POINTS_ORDER.map(h=>Number.isSafeInteger(points?.[h]) ? points[h] : 0);
    const best=Math.max(...values);
    const tied=values.filter(n=>n===best).length>1;
    return '<div class="nf-section-title nf-points-heading"><h3>✦ Punti Casa</h3><span>Classifica delle quattro Case di Hogwarts</span></div>' +
      '<div class="nf-points-grid">' + HOUSE_POINTS_ORDER.map((house,index)=>{
        const name=HOUSES[house];
        const score=values[index];
        const leader=!tied && score===best;
        return '<article class="nf-points-card nf-points-'+house+'" aria-label="'+esc(name)+': '+score+' punti">' +
          (leader?'<span class="nf-points-leader">✦ In testa</span>':'')+
          '<span class="nf-points-emblem nf-points-emblem-'+house+'" role="img" aria-label="Stemma di '+esc(name)+'"></span>' +
          '<h4>'+esc(name)+'</h4>'+
          '<div class="nf-points-number" aria-label="'+score+' punti">'+score.toLocaleString('it-IT')+'</div>'+
          '<span class="nf-points-caption">punti</span></article>';
      }).join('')+'</div>';
  }

  function spellNamesFromLesson(entry) {
    // Old logs may contain a full lesson title or multiple spells grouped
    // together. Only spell-related records enter the summary.
    const subject=String(entry.subject||'').toLocaleLowerCase('it-IT').trim();
    const topic=String(entry.topic||'').trim();
    const isIncantesimi=subject==='incantesimi' || subject==='incantesimo';
    const knownSpell=/\b(riddikulus|expelliarmus|protego|accio|levioso|alohomora|colloportus|verdimil+i?us|lumos|ferio|wingardium leviosa)\b/i;
    if(!isIncantesimi && !(topic && knownSpell.test(topic)))return [];
    const source=topic || (isIncantesimi ? entry.subject : '');
    if(!source)return [];
    return source
      .replace(/\bincantesimi?\s*(?:di\s+)?/gi,'')
      .split(/\s*(?:[,;]|\s+e\s+|\s*[–—-]\s*)\s*/i)
      .map(name=>name.trim().replace(/[.!]+$/,''))
      .filter(name=>name && !/^il molliccio$/i.test(name));
  }

  function renderDonePublic(data) {
    // Show all registered spells by year, without week or house filtering.
    // Grouped legacy entries are split, identical spells are shown once.
    const years=[1,2];
    const records=Object.values(data.lessons_done||{});
    const sections=years.map(year=>{
      const spells=new Map();
      for(const entry of records){
        if(!entry || !String(entry.period||'').startsWith(year+'-'))continue;
        for(const spell of spellNamesFromLesson(entry)){
          const key=spell.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
            .toLocaleLowerCase('it-IT').replace(/\s+/g,' ').trim();
          if(!spells.has(key))spells.set(key,spell);
        }
      }
      const names=[...spells.values()].sort((a,b)=>a.localeCompare(b,'it'));
      const items=names.map(name=>`<li class="nf-spell-item"><span class="nf-reminder-check" aria-hidden="true">✓</span><span>${esc(name)}</span></li>`).join('');
      return `<section class="nf-reminder-period nf-spell-year">
        <h4 class="nf-reminder-period-title">${year}° anno
          <span>${names.length} ${names.length===1?'incantesimo svolto':'incantesimi svolti'}</span>
        </h4>
        ${items?`<ul class="nf-spell-list">${items}</ul>`:'<p class="nf-log-public-empty">Nessun incantesimo ancora segnato.</p>'}
      </section>`;
    }).join('');
    return `<div class="nf-section-title"><h3>✓ Incantesimi svolti</h3>
      <span>Promemoria scolastico</span></div>
      <p class="nf-log-info">Gli incantesimi già svolti, divisi soltanto per anno scolastico.</p>
      ${sections}`;
  }

  document.querySelectorAll('.nf-app').forEach(async app => {
    let data;
    try {
      const response = await fetch('https://nightfall-regolamento-professori.vercel.app/api/orari-public?ts=' + Date.now(), {cache: 'no-store'});
      if (!response.ok) throw new Error('Dati non disponibili');
      data = await response.json();
    } catch (error) {
      const display = app.querySelector('.nf-display');
      if (display) display.textContent = "Non è stato possibile caricare gli orari. Aggiorna la pagina.";
      return;
    }
    const state = { year: Number(app.dataset.year) || 1, week: Number(app.dataset.week) || 1, house: app.dataset.house || 'tutte' };
    const display = app.querySelector('.nf-display');
    function renderCompleted() {
      const area = app.querySelector('.nf-completed-log');
      if (area) area.innerHTML = renderDonePublic(data);
    }

    function render() {
      const rows = data.schedules?.[`${state.year}-${state.week}`] || [];
      if (rows.length === 0) return;
      display.innerHTML = state.house === 'tutte' ? allHouses(rows) : singleHouse(rows, state.house);
      app.querySelectorAll('[data-filter="year"] button').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.value) === state.year)));
      app.querySelectorAll('[data-filter="week"] button').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.value) === state.week)));
      app.querySelectorAll('.nf-house-filters button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.house === state.house)));
      app.dataset.year = String(state.year);
      app.dataset.week = String(state.week);
      app.dataset.house = state.house;
    }
    app.querySelectorAll('[data-filter="year"] button').forEach(b => b.addEventListener('click', () => { state.year = Number(b.dataset.value); render(); }));
    app.querySelectorAll('[data-filter="week"] button').forEach(b => b.addEventListener('click', () => { state.week = Number(b.dataset.value); render(); }));
    app.querySelectorAll('.nf-house-filters button').forEach(b => b.addEventListener('click', () => { state.house = b.dataset.house; render(); }));
    app.querySelector('.nf-print')?.addEventListener('click', () => window.print());
    function renderHousePoints() {
      const area=app.querySelector('.nf-house-points');
      if (area) area.innerHTML=renderPoints(data.points||{});
    }
    function renderTeachers() {
      const area = app.querySelector('.nf-teachers');
      if (!area) return;
      area.hidden = data.show_teachers === false;
      area.innerHTML = data.show_teachers === false ? '' : teacherSection(data.teachers || {});
    }
    window.nfUpdatePublic = function(nextData) {
      data = nextData;
      renderTeachers();
      renderHousePoints();
      renderCompleted();
      render();
    };
    renderTeachers();
    renderHousePoints();
    renderCompleted();
    render();
  });
})();
