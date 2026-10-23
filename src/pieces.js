export const pieceNames = { p: 'pawn', r: 'rook', n: 'knight', b: 'bishop', q: 'queen', k: 'king' };
const shapes = {
  p: '<circle cx="50" cy="27" r="12"/><path d="M41 40h18l-3 10 9 20H35l9-20z"/><path d="M32 73h36l5 10H27z"/>',
  r: '<path d="M27 17h11v10h8V17h9v10h8V17h10v23l-10 7 2 23H35l2-23-10-7z"/><path d="M32 73h36l5 10H27z"/><path class="detail" d="M37 41h26M37 63h26"/>',
  n: '<path d="M29 70c0-14 4-21 18-31l-10 3-9-6 6-13 14-6 6-9 6 13c17 8 19 26 12 49z"/><path class="detail" d="m34 30 8 1m12-9c-2 16-7 15-10 20M60 37c8 9 7 17 3 24"/><circle class="eye" cx="48" cy="26" r="2"/><path d="M30 73h40l4 10H26z"/>',
  b: '<path d="M50 12c-8 8-18 15-18 26 0 8 8 12 18 12s18-4 18-12c0-11-10-18-18-26z"/><path class="detail" d="m53 23-9 16"/><path d="M43 50h14l-1 9 10 11H34l10-11z"/><path d="M32 73h36l5 10H27z"/><circle cx="50" cy="10" r="4"/>',
  q: '<path d="m25 28 12 13 2-20 11 17 11-17 2 20 12-13-10 29H35z"/><path d="M37 60h26l-3 5 7 6H33l7-6z"/><path d="M30 74h40l4 9H26z"/><circle cx="24" cy="25" r="4"/><circle cx="39" cy="18" r="4"/><circle cx="61" cy="18" r="4"/><circle cx="76" cy="25" r="4"/><circle cx="50" cy="13" r="4"/>',
  k: '<path d="M46 8h8v8h9v7h-9v10h-8V23h-9v-7h9z"/><path d="M29 34c0-7 13-7 21 1 8-8 21-8 21-1 0 8-7 16-9 23H38c-2-7-9-15-9-23z"/><path d="M38 60h24l-2 6 8 5H32l8-5z"/><path d="M30 74h40l4 9H26z"/><path class="detail" d="M40 51h20"/>',
};
export function pieceSVG(type, color) {
  return `<svg class="piece piece-${color}" viewBox="0 0 100 100" aria-hidden="true"><g stroke-linecap="round" stroke-linejoin="round">${shapes[type]}</g></svg>`;
}
