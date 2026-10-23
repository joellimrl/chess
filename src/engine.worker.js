import { Chess } from 'chess.js';

const values={p:100,n:320,b:335,r:500,q:900,k:0};
let deadline,nodes;
function evaluate(chess){
  let score=0;
  for(const row of chess.board())for(const p of row)if(p){
    const file=p.square.charCodeAt(0)-97,rank=Number(p.square[1])-1;
    const advance=p.color==='w'?rank:7-rank;
    const center=3.5-(Math.abs(file-3.5)+Math.abs(rank-3.5))/2;
    let positional=0;
    if(p.type==='p')positional=advance*8+center*7;
    if(p.type==='n')positional=center*28-(advance===0?15:0);
    if(p.type==='b')positional=center*12+(advance>0?12:0);
    if(p.type==='r')positional=advance===6?20:0;
    if(p.type==='q')positional=center*4;
    if(p.type==='k')positional=advance<2?(file===6||file===2?30:0):-advance*10;
    score+=(p.color==='w'?1:-1)*(values[p.type]+positional);
  }
  return score*(chess.turn()==='w'?1:-1);
}
function order(moves){return moves.sort((a,b)=>priority(b)-priority(a));}
function priority(m){return (m.captured?10*values[m.captured]-values[m.piece]:0)+(m.promotion?800:0)+(m.san.includes('+')?35:0);}
function search(chess,depth,alpha,beta,ply){
  if(++nodes%32===0&&performance.now()>deadline)throw new Error('time');
  if(chess.isCheckmate())return -100000+ply;
  if(chess.isDraw())return 0;
  if(depth<=0)return evaluate(chess);
  let best=-Infinity;
  for(const move of order(chess.moves({verbose:true}))){
    chess.move(move);
    let value;
    try{value=-search(chess,depth-1,-beta,-alpha,ply+1);}finally{chess.undo();}
    best=Math.max(best,value);alpha=Math.max(alpha,value);if(alpha>=beta)break;
  }
  return best;
}
self.onmessage=({data})=>{
  const chess=new Chess();
  if(data.pgn)chess.loadPgn(data.pgn);else chess.load(data.fen);
  const level=Number(data.difficulty),maxDepth=[0,2,3,4][level];
  deadline=performance.now()+[0,250,850,1800][level];nodes=0;
  const moves=order(chess.moves({verbose:true}));
  let best=moves[0],completedDepth=0;
  for(let depth=1;depth<=maxDepth;depth++){
    let iterationBest=best,score=-Infinity;
    try{
      for(const move of moves){
        chess.move(move);let value;
        try{value=-search(chess,depth-1,-Infinity,-score,1);}finally{chess.undo();}
        if(level===1)value+=Math.random()*28;
        if(value>score){score=value;iterationBest=move;}
      }
      best=iterationBest;completedDepth=depth;
      moves.sort((a,b)=>Number(b===best)-Number(a===best));
    }catch{break;}
  }
  self.postMessage({id:data.id,move:best?{from:best.from,to:best.to,promotion:best.promotion}:null,depth:completedDepth});
};
