(() => {
  'use strict';

  const STORE_KEY = 'quadra-volei-v1';
  const ROLE_SETTER = 'Levantador(a)';
  const positions = [1, 2, 3, 4, 5, 6];
  const courtLayout = [4, 3, 2, 5, 6, 1];
  const roleLabels = {1:'Saque · fundo direito',2:'Frente direita',3:'Frente central',4:'Frente esquerda',5:'Fundo esquerdo',6:'Fundo central'};
  const systemCopy = {
    '5x1': '5×1 · Escale um levantador em quadra. A infiltração é uma ação tática; as posições mostradas aqui representam o rodízio.',
    '4x2': '4×2 · Escale dois levantadores em quadra. As posições mostradas seguem o rodízio; a distribuição depende da formação escolhida.',
    '6x0': '6×0 · As funções não restringem a escalação. Os seis jogadores rodam juntos pelas posições.',
    '6x0 LF': '6×0 LF · Marque um levantador na posição 3. Ele fica fixo ali enquanto os outros cinco rodam pelas demais posições.'
  };
  const defaults = {players:[], system:'5x1', lineups:{own:Array(6).fill(''),receive:Array(6).fill('')}, activeSide:'own', generated:false};
  let state = readState();
  let editingId = null;

  const $ = (selector, root=document) => root.querySelector(selector);
  const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const getPlayer = id => state.players.find(player => player.id === id);

  function readState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (!saved || !Array.isArray(saved.players)) return structuredClone(defaults);
      return {...structuredClone(defaults), ...saved, lineups:{own:Array(6).fill(''),receive:Array(6).fill(''),...(saved.lineups || {})}};
    } catch { return structuredClone(defaults); }
  }
  function persist() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  function initials(name) { return name.trim().split(/\s+/).slice(0,2).map(part => part[0]).join('').toUpperCase(); }
  function playerRoleText(player) { return [player.primary, ...(player.secondary || [])].join(' · '); }

  function renderPlayers() {
    $('#player-count').textContent = state.players.length;
    $('#roster-total').textContent = `${state.players.length} ${state.players.length === 1 ? 'jogador' : 'jogadores'}`;
    $('#empty-roster').classList.toggle('hidden', state.players.length > 0);
    $('#player-list').innerHTML = state.players.map(player => `
      <article class="player-card">
        <span class="player-avatar">${escapeHtml(initials(player.name))}</span>
        <div class="player-details"><div class="player-name">${escapeHtml(player.name)}</div><div class="player-roles">${escapeHtml(playerRoleText(player))}</div></div>
        <div class="player-actions"><button class="icon-button" type="button" data-edit="${player.id}" aria-label="Editar ${escapeHtml(player.name)}" title="Editar">✎</button><button class="icon-button" type="button" data-delete="${player.id}" aria-label="Excluir ${escapeHtml(player.name)}" title="Excluir">×</button></div>
      </article>`).join('');
    $$('[data-edit]').forEach(button => button.addEventListener('click', () => startEdit(button.dataset.edit)));
    $$('[data-delete]').forEach(button => button.addEventListener('click', () => deletePlayer(button.dataset.delete)));
    renderCourts();
  }

  function renderCourts() {
    for (const side of ['own','receive']) {
      const court = $(`#court-${side}`);
      court.innerHTML = courtLayout.map(position => {
        const selected = state.lineups[side][position - 1] || '';
        const isPinned = state.system === '6x0 LF' && position === 3;
        const choices = state.players.map(player => `<option value="${player.id}" ${selected === player.id ? 'selected' : ''}>${escapeHtml(player.name)}</option>`).join('');
        return `<div class="position-slot ${isPinned ? 'fixed' : ''}"><label for="${side}-pos-${position}" title="${roleLabels[position]}">${position}</label>${isPinned ? '<span class="slot-lock" title="Levantador fixo">◆</span>' : ''}<select id="${side}-pos-${position}" data-side="${side}" data-position="${position}" aria-label="Posição ${position} · ${roleLabels[position]}"><option value="">${state.players.length ? 'Escolher' : 'Cadastre jogadores'}</option>${choices}</select></div>`;
      }).join('');
      $$('select', court).forEach(select => select.addEventListener('change', () => {
        state.lineups[side][Number(select.dataset.position) - 1] = select.value;
        if (state.system === '6x0 LF' && Number(select.dataset.position) === 3) {
          const other = side === 'own' ? 'receive' : 'own';
          state.lineups[other][2] = select.value;
        }
        state.generated = false;
        persist(); renderCourts(); hideResults();
      }));
    }
  }

  function renderSystem() {
    $$('input[name="system"]').forEach(input => {
      input.checked = input.value === state.system;
      input.closest('.system-card').classList.toggle('selected', input.checked);
    });
    $('#system-hint').textContent = systemCopy[state.system] || systemCopy['5x1'];
    renderCourts();
  }

  function startEdit(id) {
    const player = getPlayer(id); if (!player) return;
    editingId = id;
    $('#player-name').value = player.name;
    $('#player-primary').value = player.primary;
    $$('input[name="secondary"]').forEach(input => input.checked = (player.secondary || []).includes(input.value));
    $('#form-title').textContent = 'Editar jogador';
    $('#save-player').innerHTML = 'Salvar alterações <span>✓</span>';
    $('#cancel-edit').classList.remove('hidden');
    $('#player-name').focus();
  }
  function resetForm() {
    editingId = null; $('#player-form').reset(); $('#form-title').textContent = 'Novo jogador';
    $('#save-player').innerHTML = 'Adicionar jogador <span>＋</span>'; $('#cancel-edit').classList.add('hidden');
  }
  function deletePlayer(id) {
    state.players = state.players.filter(player => player.id !== id);
    for (const side of ['own','receive']) state.lineups[side] = state.lineups[side].map(value => value === id ? '' : value);
    if (editingId === id) resetForm();
    state.generated = false; persist(); renderPlayers(); hideResults();
  }

  function selectedPlayers(side) { return state.lineups[side].map(id => getPlayer(id)); }
  function validate(side) {
    const lineup = state.lineups[side];
    const missing = positions.filter(position => !lineup[position - 1]);
    if (missing.length) return `Preencha as posições ${missing.join(', ')} em ${side === 'own' ? 'Saque do time' : 'Saque adversário'}.`;
    if (new Set(lineup).size !== 6) return `Escolha seis jogadores diferentes em ${side === 'own' ? 'Saque do time' : 'Saque adversário'}.`;
    const selected = selectedPlayers(side);
    const setters = selected.filter(player => player && (player.primary === ROLE_SETTER || (player.secondary || []).includes(ROLE_SETTER)));
    if (state.system === '5x1' && setters.length !== 1) return `No 5×1, escolha exatamente um levantador em ${side === 'own' ? 'Saque do time' : 'Saque adversário'}.`;
    if (state.system === '4x2' && setters.length !== 2) return `No 4×2, escolha exatamente dois levantadores em ${side === 'own' ? 'Saque do time' : 'Saque adversário'}.`;
    if (state.system === '6x0 LF') {
      const fixed = selected[2];
      if (!fixed || !(fixed.primary === ROLE_SETTER || (fixed.secondary || []).includes(ROLE_SETTER))) return `No 6×0 LF, a posição 3 precisa ser ocupada por um levantador (${side === 'own' ? 'Saque do time' : 'Saque adversário'}).`;
    }
    return '';
  }

  function nextStandard(lineup) { return [lineup[1], lineup[2], lineup[3], lineup[4], lineup[5], lineup[0]]; }
  function nextFixedSetter(lineup) { return [lineup[1], lineup[3], lineup[2], lineup[4], lineup[5], lineup[0]]; }
  function buildRounds(side) {
    const rounds = []; let lineup = [...state.lineups[side]];
    for (let i=0;i<6;i++) { rounds.push([...lineup]); lineup = state.system === '6x0 LF' ? nextFixedSetter(lineup) : nextStandard(lineup); }
    return rounds;
  }
  function renderResults() {
    const side = state.activeSide;
    const rounds = buildRounds(side);
    $('#rotation-cards').innerHTML = rounds.map((lineup, index) => `
      <article class="rotation-card ${index === 0 ? 'current' : ''}"><div class="rotation-card-head"><h3>Rodada ${index + 1}</h3><span class="rotation-badge">R${index + 1}${index === 0 ? ' · INÍCIO' : ''}</span></div>
      <div class="mini-court">${courtLayout.map(position => { const player = getPlayer(lineup[position - 1]); const fixed = state.system === '6x0 LF' && position === 3; return `<div class="mini-slot ${fixed ? 'fixed' : ''}"><b>${position}</b><span>${player ? escapeHtml(player.name) : '—'}</span><small>${player ? escapeHtml(player.primary) : ''}${fixed ? ' · FIXO' : ''}</small></div>`; }).join('')}</div></article>`).join('');
    $$('.result-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.side === side));
    $('#result-subtitle').textContent = `${state.system} · ${side === 'own' ? 'Saque do time' : 'Saque adversário'} · Posição 1 = saque`;
  }
  function showResults() { $('#resultados').classList.remove('hidden'); renderResults(); $('#resultados').scrollIntoView({behavior:'smooth',block:'start'}); }
  function hideResults() { $('#resultados').classList.add('hidden'); }

  $('#player-form').addEventListener('submit', event => {
    event.preventDefault();
    const name = $('#player-name').value.trim(); const primary = $('#player-primary').value;
    const secondary = $$('input[name="secondary"]:checked').map(input => input.value).filter(role => role !== primary);
    if (!name || !primary) return;
    if (editingId) { const player = getPlayer(editingId); if (player) Object.assign(player,{name,primary,secondary}); }
    else state.players.push({id:globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,name,primary,secondary});
    state.generated = false; persist(); resetForm(); renderPlayers(); hideResults();
  });
  $('#cancel-edit').addEventListener('click', resetForm);
  $('#copy-lineup').addEventListener('click', () => {
    state.lineups.receive = [...state.lineups.own];
    state.generated = false;
    persist(); renderCourts(); hideResults();
    $('#validation-message').textContent = '';
    $('#copy-lineup').textContent = 'Escalação copiada ✓';
    window.setTimeout(() => { const button = $('#copy-lineup'); if (button) button.innerHTML = 'Copiar escalação <span>←</span>'; }, 1600);
  });
  $$('input[name="system"]').forEach(input => input.addEventListener('change', () => {
    state.system = input.value;
    if (state.system === '6x0 LF') { const fixed = state.lineups.own[2] || state.lineups.receive[2] || ''; state.lineups.own[2] = fixed; state.lineups.receive[2] = fixed; }
    state.generated = false; persist(); renderSystem(); hideResults();
  }));
  $('#generate').addEventListener('click', () => {
    const error = validate('own') || validate('receive');
    $('#validation-message').textContent = error;
    if (error) return;
    state.generated = true; persist(); showResults();
  });
  $$('.result-tab').forEach(tab => tab.addEventListener('click', () => { state.activeSide = tab.dataset.side; persist(); renderResults(); }));
  $('#clear-results').addEventListener('click', () => { state.generated = false; hideResults(); document.querySelector('#rodizio').scrollIntoView({behavior:'smooth',block:'start'}); });

  renderPlayers(); renderSystem();
  if (state.generated && !validate('own') && !validate('receive')) { $('#resultados').classList.remove('hidden'); renderResults(); }
})();

