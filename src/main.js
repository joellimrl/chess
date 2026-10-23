import './style.css';
import { Game, colorName, drawClaim } from './rules.js';
import { pieceSVG, pieceNames } from './pieces.js';
import { themes } from './themes.js';

const $=(selector)=>document.querySelector(selector);
const $$=(selector)=>[...document.querySelectorAll(selector)];
const storageKey='atelier-chess-v1';
const defaults={view:'3d',theme:'atelier',opponent:'local',humanColor:'w',difficulty:'2',flipped:false,hints:true,sound:true,coordinates:true};
let prefs={...defaults},game=new Game();
try{
  const saved=JSON.parse(localStorage.getItem(storageKey));
  if(saved){
    for(const key of Object.keys(defaults))if(typeof saved.prefs?.[key]===typeof defaults[key])prefs[key]=saved.prefs[key];
    if(!themes[prefs.theme])prefs.theme='atelier';
    if(!['2d','3d'].includes(prefs.view))prefs.view='3d';
    if(!['local','computer'].includes(prefs.opponent))prefs.opponent='local';
    if(!['w','b'].includes(prefs.humanColor))prefs.humanColor='w';
    if(!['1','2','3'].includes(prefs.difficulty))prefs.difficulty='2';
    if(saved.game)game=Game.restore(saved.game);
  }
}catch{/* Corrupt or unavailable browser storage must not prevent a new game. */}
let selected=null,legal=[],board3d=null,loading3d=null,thinking=false,worker=null,job=0,promotionMove=null,claimMode=false,resultTimer,toastTimer,audioContext,confirmAction;
let lastMove=game.chess.history({verbose:true}).at(-1);
const gear='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 3-.5 2.1-2 .9-1.9-.6-2 3.3 1.6 1.5-.1 2.4-1.5 1.5 2 3.4 2-.6 2 .9.5 2.2h4l.5-2.2 2-.9 2 .6 2-3.4-1.5-1.5-.1-2.4 1.6-1.5-2-3.3-1.9.6-2-.9L14 3Z"/><circle cx="12" cy="11.8" r="3.1"/></svg>';
$('#settings-toggle').innerHTML=gear;
$('.close-dialog').innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';

function save(){try{localStorage.setItem(storageKey,JSON.stringify({prefs,game:game.serialize()}));}catch{}}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4000);}
function state(){return {chess:game.chess,selected,legal,lastMove,hints:prefs.hints,coordinates:prefs.coordinates};}
function canPlay(){return !game.result&&!thinking&&!promotionMove;}
function canDrag(square){return canPlay()&&game.chess.get(square)?.color===game.chess.turn()&&(prefs.opponent!=='computer'||game.chess.turn()===prefs.humanColor);}
function clearSelection(){selected=null;legal=[];}
function choose(square){
  if(!canPlay())return;
  if(selected&&legal.some(m=>m.to===square)){requestMove(selected,square);return;}
  if(selected===square){clearSelection();render();return;}
  if(canDrag(square)){selected=square;legal=game.chess.moves({square,verbose:true});}
  else clearSelection();
  render();
}
function drop(from,to){if(!canDrag(from))return;selected=from;legal=game.chess.moves({square:from,verbose:true});if(legal.some(m=>m.to===to))requestMove(from,to);else render();}
function requestMove(from,to){
  const choices=game.chess.moves({square:from,verbose:true}).filter(m=>m.to===to);
  if(!choices.length)return;
  if(choices.some(m=>m.promotion)){
    promotionMove={from,to};
    $('#promotion-pieces').innerHTML=['q','r','b','n'].map(type=>`<button data-promote="${type}" aria-label="Promote to ${pieceNames[type]}">${pieceSVG(type,game.chess.turn())}<span>${pieceNames[type]}</span></button>`).join('');
    $('#promotion').showModal();
  }else makeMove(from,to);
}
function makeMove(from,to,promotion='q'){
  if(claimMode){
    claimMode=false;
    if(game.claim({from,to,promotion})){clearSelection();render();save();showResult();}
    else{toast('That move does not qualify for a draw claim.');clearSelection();render();}
    return;
  }
  const move=game.move(from,to,promotion);
  if(!move)return;
  lastMove=move;clearSelection();playSound(move);render(move);save();
  if(game.result)showResult();else queueComputer();
}
function render(move){
  render2D(move);
  board3d?.update(state(),move);
  const turn=game.chess.turn();
  let status=game.result?(game.result.winner?`${colorName(game.result.winner)} wins · ${game.result.reason}`:`Draw · ${game.result.reason}`):thinking?`${colorName(turn)} is considering`:claimMode?'Select your intended move to claim a draw':`${colorName(turn)} to move${game.chess.isCheck()?' · Check':''}`;
  $('#status').textContent=status;
  $('#turn-dot').classList.toggle('black',turn==='b');
  $('#table-status').classList.toggle('thinking',thinking);
  $('#table-status').classList.toggle('check',!game.result&&game.chess.isCheck());
  $('#undo-move').disabled=game.chess.history().length===0;
  $('#resign').disabled=Boolean(game.result)||thinking;
  $('#offer-draw').disabled=Boolean(game.result)||thinking;
  $('#claim-draw').disabled=Boolean(game.result)||thinking;
  $('#claim-draw').title=drawClaim(game.chess)||'Claim now, or nominate a move that would create a claimable draw';
  const history=game.chess.history();
  const count=Math.ceil(history.length/2);
  $('#move-count').textContent=`${count} ${count===1?'move':'moves'}`;
  $('#move-list').innerHTML=Array.from({length:Math.ceil(history.length/2)},(_,i)=>`<li class="history-row"><span class="number">${i+1}.</span><span>${history[i*2]}</span><span>${history[i*2+1]||'—'}</span></li>`).join('');
}
function render2D(move){
  const files=prefs.flipped?'hgfedcba':'abcdefgh',ranks=prefs.flipped?'12345678':'87654321';
  const oldFocus=document.activeElement?.dataset.square;
  const oldPositions=new Map();
  if(move&&!$('#board-2d').hidden)$$('.square .piece').forEach(p=>oldPositions.set(p.parentElement.dataset.square,p.getBoundingClientRect()));
  let html='';
  for(const rank of ranks)for(const file of files){
    const square=file+rank,piece=game.chess.get(square),available=legal.some(m=>m.to===square);
    const dark=(file.charCodeAt(0)-97+Number(rank))%2!==0;
    const check=piece?.type==='k'&&piece.color===game.chess.turn()&&game.chess.isCheck();
    const classes=['square',dark?'dark':'',selected===square?'selected':'',lastMove&&(lastMove.from===square||lastMove.to===square)?'last':'',available&&piece?'capture':'',check?'checked':''].filter(Boolean).join(' ');
    const name=piece?`${colorName(piece.color)} ${pieceNames[piece.type]}`:'empty';
    html+=`<button class="${classes}" data-square="${square}" aria-label="${square}, ${name}${available?', legal destination':''}" aria-pressed="${selected===square}">${piece?pieceSVG(piece.type,piece.color):''}${available&&prefs.hints?'<span class="hint"></span>':''}</button>`;
  }
  $('#squares').innerHTML=html;
  $('#file-labels').innerHTML=[...files].map(f=>`<span>${f.toUpperCase()}</span>`).join('');
  $('#rank-labels').innerHTML=[...ranks].map(r=>`<span>${r}</span>`).join('');
  $('#file-labels').hidden=!prefs.coordinates;$('#rank-labels').hidden=!prefs.coordinates;
  if(oldFocus&&document.activeElement===document.body)$(`[data-square="${oldFocus}"]`)?.focus({preventScroll:true});
  if(move&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
    const target=$(`[data-square="${move.to}"] .piece`),before=oldPositions.get(move.from);
    if(target&&before){const after=target.getBoundingClientRect();target.animate([{transform:`translate(${before.x-after.x}px,${before.y-after.y}px)`},{transform:'translate(0,0)'}],{duration:230,easing:'cubic-bezier(.2,.7,.2,1)'});}
  }
}
async function setView(view){
  prefs.view=view;
  $$('#settings [data-view]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.view===view));
  if(view==='3d'&&!board3d){
    if(!loading3d)loading3d=import('./board3d.js').then(({Board3D})=>{
      board3d=new Board3D($('#board-3d'),{onSquare:choose,onDrop:drop,canDrag,onFailure:()=>{setView('2d');toast('3D is unavailable on this device. The classic board is ready.');}});
      board3d.setTheme(prefs.theme);board3d.orient(prefs.flipped);board3d.update(state());
    }).catch(error=>{console.warn('3D unavailable:',error);prefs.view='2d';toast('3D is unavailable on this device. The classic board is ready.');}).finally(()=>{loading3d=null;});
    await loading3d;
  }
  const is3d=prefs.view==='3d'&&Boolean(board3d);
  $('#board-3d').hidden=!is3d;$('#board-2d').hidden=is3d;board3d?.setActive(is3d);
  $$('[data-view]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.view===prefs.view));
  save();
}
function applyTheme(){
  document.body.dataset.theme=prefs.theme;
  const theme=themes[prefs.theme];
  for(const prop of ['light','dark','frame','accent','ivory','ebony'])document.documentElement.style.setProperty(`--${prop}`,theme[prop]);
  $$('[data-theme]').filter(b=>b.tagName==='BUTTON').forEach(b=>b.setAttribute('aria-pressed',b.dataset.theme===prefs.theme));
  board3d?.setTheme(prefs.theme);board3d?.update(state());
}
function syncSettings(){
  $$('[data-opponent]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.opponent===prefs.opponent));
  $('#computer-options').hidden=prefs.opponent!=='computer';
  for(const key of ['hints','sound','coordinates'])$(`#${key}`).checked=prefs[key];
  $('#human-color').value=prefs.humanColor;$('#difficulty').value=prefs.difficulty;
}
function stopComputer(){job++;worker?.terminate();worker=null;thinking=false;}
function queueComputer(){
  if(prefs.opponent!=='computer'||game.result||game.chess.turn()===prefs.humanColor||thinking)return;
  if(game.claim()){render();save();showResult();return;}
  thinking=true;render();
  const id=++job;
  worker=new Worker(new URL('./engine.worker.js',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{
    if(data.id!==job)return;
    worker?.terminate();worker=null;thinking=false;
    if(data.move)makeMove(data.move.from,data.move.to,data.move.promotion);else render();
  };
  worker.onerror=()=>{stopComputer();prefs.opponent='local';syncSettings();render();save();toast('The computer is unavailable. You can continue with a friend.');};
  worker.postMessage({id,pgn:game.chess.pgn(),fen:game.chess.fen(),difficulty:prefs.difficulty});
}
function closeDialogs(){$$('dialog[open]').forEach(d=>d.close());}
function startNew(){
  clearTimeout(resultTimer);closeDialogs();stopComputer();promotionMove=null;claimMode=false;game=new Game();lastMove=null;clearSelection();render();save();queueComputer();
}
function undo(){
  if(!game.chess.history().length)return;
  clearTimeout(resultTimer);closeDialogs();stopComputer();promotionMove=null;claimMode=false;
  game.undo();
  if(prefs.opponent==='computer'&&game.chess.turn()!==prefs.humanColor&&game.chess.history().length)game.undo();
  lastMove=game.chess.history({verbose:true}).at(-1);clearSelection();render();save();queueComputer();
}
function flip(){prefs.flipped=!prefs.flipped;board3d?.orient(prefs.flipped);render();save();}
function confirm(title,detail,ok,action){
  $('#settings').close();$('#confirmation-title').textContent=title;$('#confirmation-detail').textContent=detail;$('#confirmation-ok').textContent=ok;confirmAction=action;$('#confirmation').showModal();
}
function showResult(){
  clearTimeout(resultTimer);
  resultTimer=setTimeout(()=>{
    if(!game.result)return;
    const {winner,reason}=game.result;
    $('#result-symbol').innerHTML=winner?pieceSVG('k',winner):'½';
    $('#result-reason').textContent=reason;
    $('#result-title').textContent=winner?`${colorName(winner)} takes the game.`:'An even ending.';
    $('#result-detail').textContent=`${game.chess.history().length} half-moves. ${winner?'A new game is a new possibility.':'Sometimes, balance is the outcome.'}`;
    closeDialogs();$('#result').showModal();
  },350);
}
function playSound(move){
  if(!prefs.sound)return;
  try{
    audioContext ||= new (window.AudioContext||window.webkitAudioContext)();
    audioContext.resume();
    const time=audioContext.currentTime,osc=audioContext.createOscillator(),gain=audioContext.createGain();
    osc.type='sine';osc.frequency.setValueAtTime(move.captured?310:510,time);osc.frequency.exponentialRampToValueAtTime(100,time+.08);
    gain.gain.setValueAtTime(.0001,time);gain.gain.exponentialRampToValueAtTime(.16,time+.006);gain.gain.exponentialRampToValueAtTime(.0001,time+.13);
    osc.connect(gain);gain.connect(audioContext.destination);osc.start(time);osc.stop(time+.14);
  }catch{/* Audio is optional; gameplay never depends on it. */}
}

// Pointer drag and keyboard/click selection share the same legal-move path.
let drag2d=null,suppressClick=false;
$('#squares').addEventListener('click',e=>{const cell=e.target.closest('[data-square]');if(cell&&!suppressClick)choose(cell.dataset.square);});
$('#squares').addEventListener('pointerdown',e=>{
  const cell=e.target.closest('[data-square]');if(e.button!==0||!cell||!canDrag(cell.dataset.square))return;
  drag2d={square:cell.dataset.square,x:e.clientX,y:e.clientY,cell,ghost:null};
});
window.addEventListener('pointermove',e=>{
  if(!drag2d)return;
  if(!drag2d.ghost&&Math.hypot(e.clientX-drag2d.x,e.clientY-drag2d.y)>7){
    const p=game.chess.get(drag2d.square),ghost=document.createElement('div');ghost.className='drag-ghost';ghost.style.width=`${drag2d.cell.clientWidth}px`;ghost.innerHTML=pieceSVG(p.type,p.color);document.body.append(ghost);drag2d.ghost=ghost;drag2d.cell.classList.add('drag-origin');
  }
  if(drag2d.ghost){drag2d.ghost.style.left=`${e.clientX}px`;drag2d.ghost.style.top=`${e.clientY}px`;}
});
function clearDrag(){drag2d?.ghost?.remove();drag2d?.cell.classList.remove('drag-origin');drag2d=null;}
window.addEventListener('pointerup',e=>{
  if(!drag2d)return;
  const drag=drag2d;
  if(drag.ghost){const cell=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-square]');suppressClick=true;clearDrag();if(cell)drop(drag.square,cell.dataset.square);setTimeout(()=>{suppressClick=false;},0);}else clearDrag();
});
window.addEventListener('pointercancel',clearDrag);
window.addEventListener('blur',clearDrag);
$('#squares').addEventListener('keydown',e=>{
  const keys={ArrowLeft:-1,ArrowRight:1,ArrowUp:-8,ArrowDown:8};if(!(e.key in keys))return;
  e.preventDefault();e.stopPropagation();const squares=$$('.square'),i=squares.indexOf(e.target);squares[Math.max(0,Math.min(63,i+keys[e.key]))]?.focus();
});
$('#settings-toggle').onclick=()=>$('#settings').showModal();
$('.close-dialog').onclick=()=>$('#settings').close();
$$('dialog').forEach(dialog=>dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}}));
$('#promotion').addEventListener('close',()=>{promotionMove=null;});
$('#promotion-pieces').onclick=e=>{const type=e.target.closest('[data-promote]')?.dataset.promote;if(!type||!promotionMove)return;const {from,to}=promotionMove;promotionMove=null;$('#promotion').close();makeMove(from,to,type);};
$('#cancel-promotion').onclick=()=>$('#promotion').close();
$$('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
$$('button[data-theme]').forEach(b=>b.onclick=()=>{prefs.theme=b.dataset.theme;applyTheme();save();});
$$('[data-opponent]').forEach(b=>b.onclick=()=>{stopComputer();prefs.opponent=b.dataset.opponent;clearSelection();syncSettings();render();save();queueComputer();});
$('#human-color').onchange=e=>{stopComputer();prefs.humanColor=e.target.value;prefs.flipped=prefs.humanColor==='b';board3d?.orient(prefs.flipped);clearSelection();render();save();queueComputer();};
$('#difficulty').onchange=e=>{stopComputer();prefs.difficulty=e.target.value;save();queueComputer();};
for(const key of ['hints','sound','coordinates'])$(`#${key}`).onchange=e=>{prefs[key]=e.target.checked;render();save();};
$('#flip-board').onclick=flip;$('#undo-move').onclick=undo;
$('#new-game').onclick=()=>game.chess.history().length&&!game.result?confirm('A fresh beginning?','Your current game will be replaced. Download its PGN first if you want to keep it.','New game',startNew):startNew();
$('#resign').onclick=()=>confirm('Leave this one here?',`${colorName(prefs.opponent==='computer'?prefs.humanColor:game.chess.turn())} will resign this game.`,'Resign',()=>{stopComputer();game.resign(prefs.opponent==='computer'?prefs.humanColor:game.chess.turn());render();save();showResult();});
$('#offer-draw').onclick=()=>{
  if(prefs.opponent==='computer'){if(drawClaim(game.chess)){game.claim();$('#settings').close();render();save();showResult();}else{$('#settings').close();toast('The computer would like to keep playing.');}return;}
  confirm('Shall we call it even?',`${colorName(game.chess.turn())} offers a draw. ${colorName(game.chess.turn()==='w'?'b':'w')}, do you accept?`,'Accept draw',()=>{game.agreeDraw();render();save();showResult();});
};
$('#claim-draw').onclick=()=>{
  $('#settings').close();
  if(game.claim()){render();save();showResult();}
  else{claimMode=true;clearSelection();render();toast('Choose a move that creates threefold repetition or 50 moves without a pawn move or capture. Esc cancels.');}
};
$('#confirmation-cancel').onclick=()=>$('#confirmation').close();
$('#confirmation-ok').onclick=()=>{const action=confirmAction;confirmAction=null;$('#confirmation').close();action?.();};
$('#review-board').onclick=()=>$('#result').close();$('#play-again').onclick=startNew;
$('#export-pgn').onclick=()=>{const url=URL.createObjectURL(new Blob([game.pgn()],{type:'application/x-chess-pgn'}));const a=document.createElement('a');a.href=url;a.download='atelier-chess.pgn';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
document.addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
  if(e.key==='Escape'){claimMode=false;clearSelection();render();return;}
  if($('dialog[open]'))return;
  if(e.key.toLowerCase()==='s')$('#settings').showModal();
  if(e.key.toLowerCase()==='f')flip();
  if(e.key.toLowerCase()==='v')setView(prefs.view==='2d'?'3d':'2d');
  if(e.key.toLowerCase()==='u'||(e.key==='ArrowLeft'&&!e.target.closest('#squares'))){e.preventDefault();undo();}
});
applyTheme();syncSettings();render();setView(prefs.view);queueComputer();
