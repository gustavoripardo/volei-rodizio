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
  const defaults = {players:[], teams:[], savedLineups:[], activeTeamId:'', activeLineupId:'', system:'5x1', lineups:{own:Array(6).fill(''),receive:Array(6).fill('')}, activeSide:'own', generated:false};
  let state = readState();
  let editingId = null;
  let editingTeamId = null;

  const $ = (selector, root=document) => root.querySelector(selector);
  const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const getPlayer = id => state.players.find(player => player.id === id);
  const getTeam = id => state.teams.find(team => team.id === id);
  const getSavedLineup = id => state.savedLineups.find(lineup => lineup.id === id);

  function readState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (!saved || !Array.isArray(saved.players)) return structuredClone(defaults);
      return {...structuredClone(defaults), ...saved, teams:Array.isArray(saved.teams)?saved.teams:[], savedLineups:Array.isArray(saved.savedLineups)?saved.savedLineups:[], lineups:{own:Array(6).fill(''),receive:Array(6).fill(''),...(saved.lineups || {})}};
    } catch { return structuredClone(defaults); }
  }
  function persist() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  function initials(name) { return name.trim().split(/\s+/).slice(0,2).map(part => part[0]).join('').toUpperCase(); }
  function playerRoleText(player) { return [player.primary, ...(player.secondary || [])].join(' · '); }
  function eligiblePlayers() {
    const team = getTeam(state.activeTeamId);
    const lineup = getSavedLineup(state.activeLineupId);
    const ids = lineup ? [...new Set([...(lineup.own||[]),...(lineup.receive||[])].filter(Boolean))] : team ? team.playerIds : null;
    return ids ? state.players.filter(player => ids.includes(player.id)) : state.players;
  }

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
    renderTeams();
    renderCourts();
  }

  function renderTeams() {
    $('#team-count').textContent = state.teams.length;
    $('#team-total').textContent = `${state.teams.length} ${state.teams.length === 1 ? 'time' : 'times'}`;
    $('#empty-teams').classList.toggle('hidden', state.teams.length > 0);
    $('#team-list').innerHTML = state.teams.map(team => {
      const count = (team.playerIds || []).filter(id => getPlayer(id)).length;
      return `<article class="team-card ${state.activeTeamId === team.id ? 'active' : ''}"><span class="team-mark">♟</span><div class="team-info"><div class="team-name">${escapeHtml(team.name)}</div><div class="team-meta">${count} ${count === 1 ? 'jogador' : 'jogadores'} · ${state.savedLineups.filter(lineup => lineup.teamId === team.id).length} escalações</div></div><div class="team-actions"><button class="team-use" type="button" data-use-team="${team.id}">${state.activeTeamId === team.id ? 'Selecionado ✓' : 'Usar time'}</button><button class="icon-button" type="button" data-edit-team="${team.id}" aria-label="Editar ${escapeHtml(team.name)}" title="Editar">✎</button><button class="icon-button" type="button" data-delete-team="${team.id}" aria-label="Excluir ${escapeHtml(team.name)}" title="Excluir">×</button></div></article>`;
    }).join('');
    const editingTeam = getTeam(editingTeamId);
    const selectedMembers = new Set(editingTeam?.playerIds || []);
    $('#team-player-list').innerHTML = state.players.map(player => `<label class="team-player-option"><input type="checkbox" name="team-player" value="${player.id}" ${selectedMembers.has(player.id) ? 'checked' : ''}><span>${escapeHtml(player.name)} · ${escapeHtml(player.primary)}</span></label>`).join('');
    $('#no-players-hint').classList.toggle('hidden', state.players.length > 0);
    const activeTeam = getTeam(state.activeTeamId);
    if (!activeTeam) state.activeTeamId = '';
    $('#active-team').innerHTML = `<option value="">Todos os jogadores</option>${state.teams.map(team => `<option value="${team.id}" ${team.id === state.activeTeamId ? 'selected' : ''}>${escapeHtml(team.name)}</option>`).join('')}`;
    const teamLineups = activeTeam ? state.savedLineups.filter(lineup => lineup.teamId === activeTeam.id) : [];
    if (!teamLineups.some(lineup => lineup.id === state.activeLineupId)) state.activeLineupId = '';
    $('#active-lineup').innerHTML = `<option value="">${activeTeam ? 'Elenco completo do time' : 'Selecione um time primeiro'}</option>${teamLineups.map(lineup => `<option value="${lineup.id}" ${lineup.id === state.activeLineupId ? 'selected' : ''}>${escapeHtml(lineup.name)}</option>`).join('')}`;
    $('#active-lineup').disabled = !activeTeam || teamLineups.length === 0;
    $('#delete-saved-lineup').disabled = !state.activeLineupId;
    $('#save-lineup-form button[type="submit"]').disabled = !activeTeam;
    $$('[data-use-team]').forEach(button => button.addEventListener('click', () => setActiveTeam(button.dataset.useTeam)));
    $$('[data-edit-team]').forEach(button => button.addEventListener('click', () => startTeamEdit(button.dataset.editTeam)));
    $$('[data-delete-team]').forEach(button => button.addEventListener('click', () => deleteTeam(button.dataset.deleteTeam)));
  }

  function setActiveTeam(id) {
    state.activeTeamId = id || '';
    state.activeLineupId = '';
    const allowed = new Set(eligiblePlayers().map(player => player.id));
    for (const side of ['own','receive']) state.lineups[side] = state.lineups[side].map(playerId => allowed.has(playerId) ? playerId : '');
    state.generated = false; persist(); renderTeams(); renderCourts(); hideResults();
  }

  function startTeamEdit(id) {
    const team = getTeam(id); if (!team) return;
    editingTeamId = id; $('#team-name').value = team.name;
    $('#team-form-title').textContent = 'Editar time'; $('#save-team').innerHTML = 'Salvar time <span>✓</span>';
    $('#cancel-team-edit').classList.remove('hidden'); renderTeams(); $('#team-name').focus();
  }
  function resetTeamForm() {
    editingTeamId = null; $('#team-form').reset(); $('#team-form-title').textContent = 'Novo time';
    $('#save-team').innerHTML = 'Criar time <span>＋</span>'; $('#cancel-team-edit').classList.add('hidden'); renderTeams();
  }
  function deleteTeam(id) {
    state.teams = state.teams.filter(team => team.id !== id);
    state.savedLineups = state.savedLineups.filter(lineup => lineup.teamId !== id);
    if (state.activeTeamId === id) { state.activeTeamId = ''; state.activeLineupId = ''; }
    if (editingTeamId === id) resetTeamForm();
    state.generated = false; persist(); renderTeams(); renderCourts(); hideResults();
  }

  function renderCourts() {
    for (const side of ['own','receive']) {
      const court = $(`#court-${side}`);
      court.innerHTML = courtLayout.map(position => {
        const selected = state.lineups[side][position - 1] || '';
        const isPinned = state.system === '6x0 LF' && position === 3;
        const choices = eligiblePlayers().map(player => `<option value="${player.id}" ${selected === player.id ? 'selected' : ''}>${escapeHtml(player.name)}</option>`).join('');
        return `<div class="position-slot ${isPinned ? 'fixed' : ''}"><label for="${side}-pos-${position}" title="${roleLabels[position]}">${position}</label>${isPinned ? '<span class="slot-lock" title="Levantador fixo">◆</span>' : ''}<select id="${side}-pos-${position}" data-side="${side}" data-position="${position}" aria-label="Posição ${position} · ${roleLabels[position]}"><option value="">${eligiblePlayers().length ? 'Escolher' : 'Selecione um time com jogadores'}</option>${choices}</select></div>`;
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
    for (const team of state.teams) team.playerIds = (team.playerIds || []).filter(value => value !== id);
    state.savedLineups = state.savedLineups.filter(lineup => ![...(lineup.own || []), ...(lineup.receive || [])].includes(id));
    if (!getSavedLineup(state.activeLineupId)) state.activeLineupId = '';
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
  $('#team-form').addEventListener('submit', event => {
    event.preventDefault();
    const name = $('#team-name').value.trim();
    const playerIds = $$('input[name="team-player"]:checked').map(input => input.value);
    if (!name) return;
    let team;
    if (editingTeamId) { team = getTeam(editingTeamId); if (team) Object.assign(team,{name,playerIds}); }
    else { team = {id:globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,name,playerIds}; state.teams.push(team); state.activeTeamId = team.id; state.activeLineupId = ''; }
    if (team && state.activeTeamId === team.id) {
      const allowed = new Set(playerIds);
      state.activeLineupId = '';
      for (const side of ['own','receive']) state.lineups[side] = state.lineups[side].map(id => allowed.has(id) ? id : '');
    }
    state.generated = false; persist(); resetTeamForm(); renderCourts(); hideResults();
  });
  $('#cancel-team-edit').addEventListener('click', resetTeamForm);
  $('#active-team').addEventListener('change', event => setActiveTeam(event.target.value));
  $('#active-lineup').addEventListener('change', event => {
    const lineup = getSavedLineup(event.target.value);
    state.activeLineupId = lineup?.id || '';
    if (lineup) {
      state.system = lineup.system || state.system;
      state.lineups = {own:[...lineup.own],receive:[...lineup.receive]};
      if (state.system === '6x0 LF') { const fixed = state.lineups.own[2] || state.lineups.receive[2] || ''; state.lineups.own[2] = fixed; state.lineups.receive[2] = fixed; }
    }
    state.generated = false; persist(); renderTeams(); renderSystem(); hideResults();
    $('#validation-message').textContent = '';
  });
  $('#save-lineup-form').addEventListener('submit', event => {
    event.preventDefault();
    const team = getTeam(state.activeTeamId);
    const name = $('#saved-lineup-name').value.trim();
    if (!team) { $('#validation-message').textContent = 'Escolha um time antes de salvar uma escalação.'; return; }
    if (!name) { $('#saved-lineup-name').focus(); return; }
    const error = validate('own') || validate('receive');
    if (error) { $('#validation-message').textContent = error; return; }
    const memberIds = new Set(team.playerIds || []);
    if (['own','receive'].some(side => state.lineups[side].some(id => !memberIds.has(id)))) {
      $('#validation-message').textContent = 'As duas formações precisam usar jogadores do time selecionado.'; return;
    }
    let savedLineup = state.savedLineups.find(lineup => lineup.teamId === team.id && lineup.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    if (!savedLineup) { savedLineup = {id:globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,teamId:team.id,name}; state.savedLineups.push(savedLineup); }
    Object.assign(savedLineup,{name,system:state.system,own:[...state.lineups.own],receive:[...state.lineups.receive]});
    state.activeLineupId = savedLineup.id; state.generated = false; persist();
    renderTeams(); renderCourts(); $('#saved-lineup-name').value = ''; $('#validation-message').textContent = `Escalação “${name}” salva para ${team.name}.`;
  });
  $('#delete-saved-lineup').addEventListener('click', () => {
    const id = state.activeLineupId; if (!id) return;
    state.savedLineups = state.savedLineups.filter(lineup => lineup.id !== id);
    state.activeLineupId = ''; state.generated = false; persist(); renderTeams(); renderCourts(); hideResults();
  });
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

