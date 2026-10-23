import { Chess } from 'chess.js';

const key = (fen) => fen.split(' ').slice(0, 4).join(' ');
export const colorName = (color) => color === 'w' ? 'White' : 'Black';

/** Keep claimable draws distinct from automatic termination (FIDE 9.2–9.6). */
export function repetitionCount(chess) {
  const history = chess.history({ verbose: true });
  const position = key(chess.fen());
  if (!history.length) return 1;
  return Number(key(history[0].before) === position) + history.reduce((count, move) => count + Number(key(move.after) === position), 0);
}

export function drawClaim(chess) {
  if (chess.isThreefoldRepetition()) return 'Threefold repetition';
  if (chess.isDrawByFiftyMoves()) return 'Fifty-move rule';
  return null;
}

export function automaticResult(chess) {
  if (chess.isCheckmate()) return { winner: chess.turn() === 'w' ? 'b' : 'w', reason: 'Checkmate' };
  if (chess.isStalemate()) return { winner: null, reason: 'Stalemate' };
  if (chess.isInsufficientMaterial()) return { winner: null, reason: 'Insufficient material' };
  if (repetitionCount(chess) >= 5) return { winner: null, reason: 'Fivefold repetition' };
  if (Number(chess.fen().split(' ')[4]) >= 150) return { winner: null, reason: 'Seventy-five-move rule' };
  return null;
}

export class Game {
  constructor(fen) { this.chess = new Chess(fen); this.result = automaticResult(this.chess); }
  move(from, to, promotion = 'q') {
    if (this.result) return null;
    let move;
    try { move = this.chess.move({ from, to, promotion }); } catch { return null; }
    this.result = automaticResult(this.chess);
    return move;
  }
  undo() { const move = this.chess.undo(); this.result = automaticResult(this.chess); return move; }
  claim(intendedMove) {
    if (this.result) return false;
    let reason = drawClaim(this.chess);
    if (!reason && intendedMove) {
      try { this.chess.move(intendedMove); } catch { return false; }
      reason = drawClaim(this.chess);
      this.chess.undo();
    }
    if (reason) this.result = { winner: null, reason };
    return Boolean(reason);
  }
  resign(color = this.chess.turn()) {
    if (this.result) return;
    const opponent = color === 'w' ? 'b' : 'w';
    const opponentHasPiece = this.chess.board().flat().some(piece => piece && piece.color === opponent && piece.type !== 'k');
    this.result = opponentHasPiece
      ? { winner: opponent, reason: 'Resignation' }
      : { winner: null, reason: 'No possible checkmate' };
  }
  agreeDraw() { if (!this.result) this.result = { winner: null, reason: 'Draw by agreement' }; }
  serialize() { return { pgn: this.chess.pgn(), fen: this.chess.fen(), result: this.result }; }
  static restore(data) {
    const game = new Game();
    if (data.pgn) game.chess.loadPgn(data.pgn);
    else if (data.fen) game.chess.load(data.fen);
    game.result = automaticResult(game.chess) || data.result || null;
    return game;
  }
  pgn() {
    const result = !this.result ? '*' : this.result.winner === 'w' ? '1-0' : this.result.winner === 'b' ? '0-1' : '1/2-1/2';
    const copy = new Chess();
    copy.loadPgn(this.chess.pgn());
    copy.header('Event', 'Atelier · Local game', 'White', 'White', 'Black', 'Black', 'Result', result);
    return copy.pgn();
  }
}
