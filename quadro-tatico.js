(() => {
  'use strict';

  const GAME_KEY='quadra-volei-v1';
  const LAYOUT_KEY='quadra-tactical-layout-v1';
  const params=new URLSearchParams(window.location.search);
  let side=params.get('side')==='receive'?'receive':'own';
  let round=Math.max(1,Math.min(6,Number(params.get('round'))||1));
  let game=readGame();
  let savedLayouts=readLayouts();
  let drag=null;
  const $=selector=>document.querySelector(selector);

  function readGame(){
    try { return JSON.parse(localStorage.getItem(GAME_KEY)||'null'); }
    catch { return null; }
  }
  function readLayouts(){
    try { return JSON.parse(localStorage.getItem(LAYOUT_KEY)||'{}')||{}; }
    catch { return {}; }
  }
  function getPlayer(id){ return game?.players?.find(player=>player.id===id); }
  function getTeam(){ return game?.teams?.find(team=>team.id===game.activeTeamId); }
  function roster(){
    const team=getTeam();
    return team?game.players.filter(player=>(team.playerIds||[]).includes(player.id)):(game?.players||[]);
  }
  function rotate(lineup){ return [lineup[1],lineup[2],lineup[3],lineup[4],lineup[5],lineup[0]]; }
  function rotateWithFixedSetter(lineup){ return [lineup[1],lineup[3],lineup[2],lineup[4],lineup[5],lineup[0]]; }
  function rotationAt(targetRound){
    const base=game?.lineups?.[side];
    if(!Array.isArray(base)||base.length!==6) return [];
    const lineup=[...base];
    const events=[...(game.substitutions?.[side]||[])].map((event,index)=>({...event,_index:index})).sort((a,b)=>a.round-b.round||a._index-b._index);
    for(let current=1;current<=targetRound;current++){
      if(current>1){const next=game.system==='6x0 LF'?rotateWithFixedSetter(lineup):rotate(lineup);lineup.splice(0,lineup.length,...next);}
      for(const event of events.filter(item=>item.round===current)){
        const index=lineup.indexOf(event.outId);
        if(index>=0&&!lineup.includes(event.inId)) lineup[index]=event.inId;
      }
    }
    return lineup;
  }
  function contextKey(){ return `${game?.activeTeamId||'todos'}|${side}|R${round}|${game?.system||'5x1'}`; }
  function defaultPoint(position){
    const points={4:{x:24,y:17},3:{x:50,y:17},2:{x:76,y:17},5:{x:24,y:67},6:{x:50,y:67},1:{x:76,y:67}};
    return points[position]||{x:50,y:50};
  }
  function roleClass(role=''){
    if(role.startsWith('Levantador')) return 'role-setter';
    if(role.startsWith('Ponteiro')) return 'role-outside';
    if(role==='Central') return 'role-middle';
    if(role.startsWith('Oposto')) return 'role-opposite';
    if(role==='Líbero') return 'role-libero';
    return 'role-other';
  }
  function createToken(player,place){
    const token=document.createElement('button');
    token.type='button'; token.className=`player-token ${roleClass(player.primary)} ${place.zone==='court'?'on-court':'in-bench'}`;
    token.dataset.playerId=player.id; token.textContent=player.name; token.title=`${player.name} · ${player.primary}`;
    token.setAttribute('aria-label',`${player.name}, ${player.primary}. Arraste para reposicionar.`);
    if(place.zone==='court'){
      token.style.left=`${place.x}%`; token.style.top=`${place.y}%`;
    }
    token.addEventListener('pointerdown',startDrag);
    return token;
  }
  function render(){
    $('#tactical-side').value=side; $('#tactical-round').value=String(round);
    const selected=rotationAt(round);
    const currentRoster=roster();
    const team=getTeam();
    const positions=savedLayouts[contextKey()]||{};
    const court=$('#court-players'), bench=$('#bench-list');
    court.replaceChildren(); bench.replaceChildren();
    if(!game||!Array.isArray(game.players)||!selected.length){
      $('#board-title').textContent=`Quadro tático · R${round}`;
      $('#board-subtitle').textContent='Gere uma rodada no planejador antes de abrir o quadro tático.';
      $('#system-pill').textContent='SEM ESCALAÇÃO';
      $('#bench-count').textContent='0'; $('#empty-bench').classList.remove('hidden');
      $('#board-status').textContent='Volte ao planejador, monte as seis posições e abra o quadro pelo cabeçalho da rodada.';
      $('#board-status').classList.add('error');
      return;
    }
    const activeIds=new Set(selected);
    const initialByPlayer=new Map(selected.map((id,index)=>[id,index+1]));
    for(const player of currentRoster){
      let place=positions[player.id];
      if(!place){
        const position=initialByPlayer.get(player.id);
        place=position?{zone:'court',...defaultPoint(position)}:{zone:'bench'};
      }
      if(place.zone==='court') court.append(createToken(player,place));
      else bench.append(createToken(player,{zone:'bench'}));
    }
    $('#board-title').textContent=`Quadro tático · R${round}`;
    $('#board-subtitle').textContent=`${team?.name||'Elenco completo'} · ${side==='own'?'Saque do time':'Saque adversário'}`;
    $('#system-pill').textContent=game.system||'5×1';
    $('#bench-count').textContent=bench.children.length;
    $('#empty-bench').classList.toggle('hidden',bench.children.length>0);
    $('#board-status').textContent='Arraste os círculos com mouse, toque ou caneta. A posição fica salva para esta rodada.';
    $('#board-status').classList.remove('error');
  }
  function startDrag(event){
    if(event.button!==undefined&&event.button!==0) return;
    event.preventDefault();
    const token=event.currentTarget, rect=token.getBoundingClientRect();
    drag={token,pointerId:event.pointerId,playerId:token.dataset.playerId,offsetX:event.clientX-rect.left,offsetY:event.clientY-rect.top};
    token.classList.add('dragging'); token.style.left=`${rect.left}px`; token.style.top=`${rect.top}px`;
    token.setPointerCapture(event.pointerId);
    token.addEventListener('pointermove',moveDrag);
    token.addEventListener('pointerup',endDrag,{once:true});
    token.addEventListener('pointercancel',cancelDrag,{once:true});
  }
  function moveDrag(event){
    if(!drag||event.pointerId!==drag.pointerId) return;
    event.preventDefault();
    drag.token.style.left=`${event.clientX-drag.offsetX}px`;
    drag.token.style.top=`${event.clientY-drag.offsetY}px`;
    const edge=54;
    if(event.clientY<edge) window.scrollBy(0,-18);
    else if(event.clientY>window.innerHeight-edge) window.scrollBy(0,18);
  }
  function endDrag(event){
    if(!drag||event.pointerId!==drag.pointerId) return;
    const courtRect=$('#half-court').getBoundingClientRect();
    const benchRect=$('#bench-panel').getBoundingClientRect();
    const inCourt=event.clientX>=courtRect.left&&event.clientX<=courtRect.right&&event.clientY>=courtRect.top&&event.clientY<=courtRect.bottom;
    const inBench=event.clientX>=benchRect.left&&event.clientX<=benchRect.right&&event.clientY>=benchRect.top&&event.clientY<=benchRect.bottom;
    if(inCourt){
      const layout=savedLayouts[contextKey()]||{};
      layout[drag.playerId]={zone:'court',x:Math.max(5,Math.min(95,(event.clientX-courtRect.left)/courtRect.width*100)),y:Math.max(5,Math.min(95,(event.clientY-courtRect.top)/courtRect.height*100))};
      savedLayouts[contextKey()]=layout; saveLayouts();
    }else if(inBench){
      const layout=savedLayouts[contextKey()]||{}; layout[drag.playerId]={zone:'bench'}; savedLayouts[contextKey()]=layout; saveLayouts();
    }
    if(drag.token.hasPointerCapture(event.pointerId)) drag.token.releasePointerCapture(event.pointerId);
    drag.token.removeEventListener('pointermove',moveDrag); drag=null; render();
  }
  function cancelDrag(){
    if(!drag) return;
    const token=drag.token; token.removeEventListener('pointermove',moveDrag); drag=null; render();
  }
  function saveLayouts(){
    try{localStorage.setItem(LAYOUT_KEY,JSON.stringify(savedLayouts));}
    catch{$('#board-status').textContent='Não foi possível salvar a posição neste navegador.';$('#board-status').classList.add('error');}
  }
  function updateContext(){
    side=$('#tactical-side').value==='receive'?'receive':'own';
    round=Math.max(1,Math.min(6,Number($('#tactical-round').value)||1));
    const url=new URL(window.location.href); url.searchParams.set('side',side); url.searchParams.set('round',String(round));
    try{window.history.replaceState({},'',url.toString());}catch{}
    render();
  }
  $('#tactical-side').addEventListener('change',updateContext);
  $('#tactical-round').addEventListener('change',updateContext);
  $('#reset-layout').addEventListener('click',()=>{
    delete savedLayouts[contextKey()]; saveLayouts(); render();
  });
  window.addEventListener('message',event=>{
    if(event.source!==window.opener||event.data?.type!=='quadra:tactical-state') return;
    if(event.data.state&&Array.isArray(event.data.state.players)){game=event.data.state;render();}
  });
  if(window.opener) window.opener.postMessage({type:'quadra:tactical-ready'},'*');
  render();
})();

