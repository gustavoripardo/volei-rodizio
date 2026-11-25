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
  const defaults = {players:[], teams:[], savedLineups:[], activeTeamId:'', activeLineupId:'', system:'5x1', lineups:{own:Array(6).fill(''),receive:Array(6).fill('')}, substitutions:{own:[],receive:[]}, activeSide:'own', generated:false};
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
      return {...structuredClone(defaults), ...saved, teams:Array.isArray(saved.teams)?saved.teams:[], savedLineups:Array.isArray(saved.savedLineups)?saved.savedLineups:[], lineups:{own:Array(6).fill(''),receive:Array(6).fill(''),...(saved.lineups || {})}, substitutions:{own:Array.isArray(saved.substitutions?.own)?saved.substitutions.own:[],receive:Array.isArray(saved.substitutions?.receive)?saved.substitutions.receive:[]}};
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
  function teamRosterPlayers() {
    const team = getTeam(state.activeTeamId);
    return team ? state.players.filter(player => (team.playerIds || []).includes(player.id)) : state.players;
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
    state.substitutions = {own:[],receive:[]};
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
    state.substitutions = {own:[],receive:[]}; state.generated = false; persist(); renderTeams(); renderCourts(); hideResults();
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
        state.substitutions[side] = [];
        if (state.system === '6x0 LF' && Number(select.dataset.position) === 3) {
          const other = side === 'own' ? 'receive' : 'own';
          state.lineups[other][2] = select.value;
          state.substitutions[other] = [];
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
    $$('input[name="primary"]').forEach(input => input.checked = input.value === player.primary);
    $$('input[name="secondary"]').forEach(input => input.checked = (player.secondary || []).includes(input.value));
    $('#form-title').textContent = 'Editar jogador';
    $('#save-player').innerHTML = 'Salvar alterações <span>✓</span>';
    $('#cancel-edit').classList.remove('hidden');
    $('#player-name').focus();
  }
  function resetForm({preserveRoles=false}={}) {
    const primary = preserveRoles ? $('input[name="primary"]:checked')?.value : '';
    const secondary = preserveRoles ? $$('input[name="secondary"]:checked').map(input => input.value) : [];
    editingId = null; $('#player-form').reset();
    if (preserveRoles && primary) $$('input[name="primary"]').forEach(input => input.checked = input.value === primary);
    if (preserveRoles) $$('input[name="secondary"]').forEach(input => input.checked = secondary.includes(input.value));
    $('#form-title').textContent = 'Novo jogador';
    $('#save-player').innerHTML = 'Adicionar jogador <span>＋</span>'; $('#cancel-edit').classList.add('hidden');
  }
  function deletePlayer(id) {
    state.players = state.players.filter(player => player.id !== id);
    for (const side of ['own','receive']) state.lineups[side] = state.lineups[side].map(value => value === id ? '' : value);
    for (const team of state.teams) team.playerIds = (team.playerIds || []).filter(value => value !== id);
    state.savedLineups = state.savedLineups.filter(lineup => ![...(lineup.own || []), ...(lineup.receive || [])].includes(id));
    for (const side of ['own','receive']) state.substitutions[side] = state.substitutions[side].filter(event => event.outId !== id && event.inId !== id);
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
  function orderedSubstitutions(side, events=state.substitutions[side]) {
    return events.map((event,index)=>({...event,_order:index})).sort((a,b)=>a.round-b.round || a._order-b._order);
  }
  function replaySubstitutions(side, events=state.substitutions[side]) {
    const lineup = [...state.lineups[side]];
    const starters = new Set(lineup);
    const roster = new Set(teamRosterPlayers().map(player=>player.id));
    const pairs = new Map();
    const usedSubstitutes = new Set();
    const rounds = [];
    const ordered = orderedSubstitutions(side,events);
    for (let round=1;round<=6;round++) {
      if (round>1) {
        const next = state.system === '6x0 LF' ? nextFixedSetter(lineup) : nextStandard(lineup);
        lineup.splice(0,lineup.length,...next);
      }
      for (const event of ordered.filter(item=>item.round===round)) {
        const outIndex=lineup.indexOf(event.outId);
        if (outIndex<0) return {valid:false,error:`${getPlayer(event.outId)?.name || 'O jogador'} não está em quadra na R${round}.`,rounds};
        const outgoing=getPlayer(event.outId), incoming=getPlayer(event.inId);
        if (!incoming || !roster.has(event.inId)) return {valid:false,error:'O jogador que entra precisa fazer parte do time selecionado.',rounds};
        if (event.outId===event.inId || lineup.includes(event.inId)) return {valid:false,error:'Escolha um reserva que esteja fora da quadra.',rounds};
        if (outgoing?.primary==='Líbero' || incoming.primary==='Líbero') return {valid:false,error:'A troca regular não inclui o líbero; o planejamento da troca específica do líbero ainda não está disponível.',rounds};
        const activePair=[...pairs.values()].find(pair=>pair.substituteId===event.outId && !pair.returned);
        if (activePair) {
          if (round<=activePair.entryRound) return {valid:false,error:'O titular só pode retornar depois de uma rodada completa.',rounds};
          if (event.inId!==activePair.starterId) return {valid:false,error:`${outgoing.name} só pode sair para ${getPlayer(activePair.starterId)?.name || 'o titular original'}.`,rounds};
          activePair.returned=true;
          lineup[outIndex]=event.inId;
          continue;
        }
        if (!starters.has(event.outId)) return {valid:false,error:'Somente um jogador da escalação inicial pode iniciar o par de substituição.',rounds};
        if (pairs.has(event.outId)) return {valid:false,error:`${outgoing.name} já usou sua substituição e retorno neste set.`,rounds};
        if (starters.has(event.inId)) return {valid:false,error:'O jogador que entra precisa ser um reserva da escalação inicial.',rounds};
        if (usedSubstitutes.has(event.inId)) return {valid:false,error:`${incoming.name} já participou de uma substituição neste set.`,rounds};
        pairs.set(event.outId,{starterId:event.outId,substituteId:event.inId,entryRound:round,returned:false});
        usedSubstitutes.add(event.inId);
        lineup[outIndex]=event.inId;
      }
      rounds.push([...lineup]);
    }
    return {valid:true,rounds};
  }
  function buildRounds(side) {
    const result=replaySubstitutions(side);
    if (result.valid) return result.rounds;
    const rounds=[]; let lineup=[...state.lineups[side]];
    for (let i=0;i<6;i++) { rounds.push([...lineup]); lineup=state.system==='6x0 LF'?nextFixedSetter(lineup):nextStandard(lineup); }
    return rounds;
  }
  function substitutionDisplayFor(side,round,playerId) {
    const events=orderedSubstitutions(side);
    for (const entry of events.filter(event=>event.kind==='entry')) {
      const returned=events.find(event=>event.kind==='return' && event.pairId===entry.pairId);
      if (round>=entry.round && (!returned || round<returned.round) && playerId===entry.inId) {
        return {outId:entry.outId,inId:entry.inId,label:round===entry.round?`ENTROU · R${entry.round}`:`EM QUADRA · R${entry.round}`};
      }
      if (returned && round===returned.round && playerId===returned.inId) {
        return {outId:returned.outId,inId:returned.inId,label:'RETORNO'};
      }
    }
    return null;
  }
  function substitutionRosterOptions(side,round,outId) {
    const current=buildRounds(side)[round-1] || [];
    const roster=teamRosterPlayers().filter(player=>player.primary!=='Líbero' && !current.includes(player.id));
    const entries=orderedSubstitutions(side).filter(event=>event.kind==='entry' && event.round<=round);
    const returnFor=entries.find(event=>event.inId===outId);
    if (returnFor) {
      const returned=orderedSubstitutions(side).some(event=>event.kind==='return' && event.pairId===returnFor.pairId && event.round<=round);
      if (returned || returnFor.round>=round) return [];
      return roster.filter(player=>player.id===returnFor.outId);
    }
    if (entries.some(event=>event.outId===outId)) return [];
    const used=new Set(entries.map(event=>event.inId));
    const starters=new Set(state.lineups[side]);
    return roster.filter(player=>!starters.has(player.id) && !used.has(player.id));
  }
  function renderSubstitutionChoices() {
    const side=state.activeSide, round=Number($('#substitution-round').value||1);
    const current=buildRounds(side)[round-1] || [];
    const events=orderedSubstitutions(side).filter(event=>event.round<=round);
    const selectedOut=$('#substitution-out').value;
    const outOptions=current.filter(id=>{
      const player=getPlayer(id); if (!player || player.primary==='Líbero') return false;
      const entry=events.find(event=>event.kind==='entry' && event.outId===id);
      if (entry) return false;
      const pairEntry=events.find(event=>event.kind==='entry' && event.inId===id);
      return !pairEntry || pairEntry.round<round;
    });
    $('#substitution-out').innerHTML=`<option value="">Escolha um jogador</option>${outOptions.map(id=>`<option value="${id}">${escapeHtml(getPlayer(id)?.name||'')}</option>`).join('')}`;
    if (outOptions.includes(selectedOut)) $('#substitution-out').value=selectedOut;
    renderSubstitutionInOptions();
  }
  function renderSubstitutionInOptions() {
    const side=state.activeSide, round=Number($('#substitution-round').value||1), outId=$('#substitution-out').value;
    const oldIn=$('#substitution-in').value;
    const options=outId?substitutionRosterOptions(side,round,outId):[];
    $('#substitution-in').innerHTML=`<option value="">${options.length?'Escolha um reserva':'Sem reserva elegível'}</option>${options.map(player=>`<option value="${player.id}">${escapeHtml(player.name)} · ${escapeHtml(player.primary)}</option>`).join('')}`;
    if (options.some(player=>player.id===oldIn)) $('#substitution-in').value=oldIn;
  }
  function renderSubstitutionPanel(side,rounds) {
    const events=orderedSubstitutions(side);
    $('#substitution-count').textContent=events.length;
    $('#substitution-form button[type="submit"]').disabled=events.length>=8;
    $('#substitution-list').innerHTML=events.length?events.map(event=>`<span class="substitution-item"><b>R${event.round}</b>${escapeHtml(getPlayer(event.outId)?.name||'Jogador')} → ${escapeHtml(getPlayer(event.inId)?.name||'Jogador')}<button type="button" data-remove-substitution="${event.pairId}" aria-label="Remover par de substituição" title="Remover par">×</button></span>`).join(''):'<span class="small-hint">Nenhuma substituição planejada nesta formação.</span>';
    $$('[data-remove-substitution]').forEach(button=>button.addEventListener('click',()=>{
      state.substitutions[side]=state.substitutions[side].filter(event=>event.pairId!==button.dataset.removeSubstitution);
      state.generated=false;persist();$('#substitution-message').textContent='Par removido.';renderResults();
    }));
    renderSubstitutionChoices();
  }
  function renderResults() {
    const side = state.activeSide;
    const rounds = buildRounds(side);
    $('#rotation-cards').innerHTML = rounds.map((lineup, index) => `
      <article class="rotation-card ${index === 0 ? 'current' : ''}"><div class="rotation-card-head"><div class="rotation-title"><h3>Rodada ${index + 1}</h3><span class="rotation-badge">R${index + 1}${index === 0 ? ' · INÍCIO' : ''}</span></div><a class="tactical-open" href="quadro-tatico.html?side=${side}&amp;round=${index+1}" target="_blank" rel="opener" aria-label="Abrir quadro tático da rodada ${index+1} em nova aba">Quadro tático <span>↗</span></a></div>
      <div class="mini-court">${courtLayout.map(position => { const playerId=lineup[position-1]; const player=getPlayer(playerId); const fixed=state.system==='6x0 LF'&&position===3; const sub=substitutionDisplayFor(side,index+1,playerId); const slotContent=sub?`<div class="mini-swap"><span class="player-out" title="Saiu da quadra">${escapeHtml(getPlayer(sub.outId)?.name||'—')}</span><span class="swap-arrow" aria-hidden="true">${sub.label==='RETORNO'?'↩':'↓'}</span><strong class="player-in" title="Está nesta posição">${escapeHtml(getPlayer(sub.inId)?.name||'—')}</strong></div><small class="substitution-label">${escapeHtml(sub.label)}${fixed?' · FIXO':''}</small>`:`<span>${player?escapeHtml(player.name):'—'}</span><small>${player?escapeHtml(player.primary):''}${fixed?' · FIXO':''}</small>`; return `<div class="mini-slot ${fixed?'fixed':''} ${sub?'has-substitution':''}" aria-label="Posição ${position}${sub?`, saiu ${getPlayer(sub.outId)?.name}, entrou ${getPlayer(sub.inId)?.name}`:player?`, ${player.name}`:''}"><b>${position}</b>${slotContent}</div>`; }).join('')}</div></article>`).join('');
    renderSubstitutionPanel(side,rounds);
    $$('.result-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.side === side));
    $('#result-subtitle').textContent = `${state.system} · ${side === 'own' ? 'Saque do time' : 'Saque adversário'} · Posição 1 = saque`;
  }
  function showResults() { $('#resultados').classList.remove('hidden'); renderResults(); $('#resultados').scrollIntoView({behavior:'smooth',block:'start'}); }
  function hideResults() { $('#resultados').classList.add('hidden'); }

  $('#player-form').addEventListener('submit', event => {
    event.preventDefault();
    const name = $('#player-name').value.trim(); const primary = $('input[name="primary"]:checked')?.value || '';
    const secondary = $$('input[name="secondary"]:checked').map(input => input.value).filter(role => role !== primary);
    if (!name || !primary) return;
    const wasEditing = Boolean(editingId);
    if (editingId) { const player = getPlayer(editingId); if (player) Object.assign(player,{name,primary,secondary}); }
    else state.players.push({id:globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,name,primary,secondary});
    if (wasEditing) state.substitutions = {own:[],receive:[]};
    state.generated = false; persist(); resetForm({preserveRoles:!wasEditing}); renderPlayers(); hideResults();
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
      state.substitutions = {own:[],receive:[]};
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
      state.substitutions = {own:[],receive:[]};
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
  $('#substitution-round').addEventListener('change', renderSubstitutionChoices);
  $('#substitution-out').addEventListener('change', renderSubstitutionInOptions);
  $('#substitution-form').addEventListener('submit', event => {
    event.preventDefault();
    const side=state.activeSide, round=Number($('#substitution-round').value);
    const outId=$('#substitution-out').value, inId=$('#substitution-in').value;
    if (!outId || !inId) { $('#substitution-message').textContent='Escolha quem sai e quem entra.'; return; }
    if (state.substitutions[side].length>=8) { $('#substitution-message').textContent='O limite de oito substituições neste set foi atingido.'; return; }
    const priorEntry=orderedSubstitutions(side).find(item=>item.kind==='entry' && item.inId===outId);
    const isReturn=Boolean(priorEntry);
    const pairId=isReturn?priorEntry.pairId:(globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const substitution={id:globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`,pairId,round,outId,inId,kind:isReturn?'return':'entry'};
    const proposed=[...state.substitutions[side],substitution];
    const result=replaySubstitutions(side,proposed);
    if (!result.valid) { $('#substitution-message').textContent=result.error; return; }
    state.substitutions[side]=orderedSubstitutions(side,proposed).map(({_order,...item})=>item);
    persist(); $('#substitution-message').textContent=`Troca registrada na R${round}.`;
    renderResults();
  });
  $('#copy-lineup').addEventListener('click', () => {
    state.lineups.receive = [...state.lineups.own];
    state.substitutions.receive = [];
    state.generated = false;
    persist(); renderCourts(); hideResults();
    $('#validation-message').textContent = '';
    $('#copy-lineup').textContent = 'Escalação copiada ✓';
    window.setTimeout(() => { const button = $('#copy-lineup'); if (button) button.innerHTML = 'Copiar escalação <span>←</span>'; }, 1600);
  });
  $$('input[name="system"]').forEach(input => input.addEventListener('change', () => {
    state.system = input.value;
    state.substitutions = {own:[],receive:[]};
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

  const tacticalTabs=new Set();
  window.addEventListener('message',event=>{
    if(event.data?.type!=='quadra:tactical-ready') return;
    const tab=[...tacticalTabs].find(candidate=>candidate===event.source);
    if(!tab) return;
    tab.postMessage({type:'quadra:tactical-state',state},'*');
  });
  document.addEventListener('click',event=>{
    const link=event.target.closest('a.tactical-open');
    if(!link) return;
    event.preventDefault();
    const tab=window.open(link.href,'_blank');
    if(tab) tacticalTabs.add(tab);
    else $('#validation-message').textContent='O navegador bloqueou a nova aba do quadro tático.';
  });

  renderPlayers(); renderSystem();
  if (state.generated && !validate('own') && !validate('receive')) { $('#resultados').classList.remove('hidden'); renderResults(); }
})();

