export const COLS = 10;
export const ROWS = 20;
export const BLOCK_SIZE = 30;

export type TetrominoType = 'I' | 'J' | 'L' | 'O' | 'S' | 'T' | 'Z' | 'BOMB' | 'CHEST' | 'LOCK';

export interface Tetromino {
  shape: number[][];
  color: string;
  type: TetrominoType;
}

export const TETROMINOS: Record<TetrominoType, Tetromino> = {
  I: {
    shape: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    color: 'border-cyan-400 bg-cyan-400/20 shadow-[0_0_15px_rgba(34,211,238,0.6),inset_0_0_8px_rgba(34,211,238,0.3)]',
    type: 'I',
  },
  J: {
    shape: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    color: 'border-blue-500 bg-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.6),inset_0_0_8px_rgba(59,130,246,0.3)]',
    type: 'J',
  },
  L: {
    shape: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
    color: 'border-orange-500 bg-orange-500/20 shadow-[0_0_15px_rgba(249,115,22,0.6),inset_0_0_8px_rgba(249,115,22,0.3)]',
    type: 'L',
  },
  O: {
    shape: [
      [1, 1],
      [1, 1],
    ],
    color: 'border-yellow-400 bg-yellow-400/20 shadow-[0_0_15px_rgba(250,204,21,0.6),inset_0_0_8px_rgba(250,204,21,0.3)]',
    type: 'O',
  },
  S: {
    shape: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
    color: 'border-green-500 bg-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.6),inset_0_0_8px_rgba(34,197,94,0.3)]',
    type: 'S',
  },
  T: {
    shape: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    color: 'border-purple-500 bg-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.6),inset_0_0_8px_rgba(168,85,247,0.3)]',
    type: 'T',
  },
  Z: {
    shape: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
    color: 'border-red-500 bg-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.6),inset_0_0_8px_rgba(239,68,68,0.3)]',
    type: 'Z',
  },
  BOMB: {
    shape: [[1]],
    color: 'border-red-400 bg-red-600/40 shadow-[0_0_20px_rgba(220,38,38,0.8),inset_0_0_10px_rgba(220,38,38,0.5)] animate-pulse',
    type: 'BOMB',
  },
  CHEST: {
    shape: [[1]],
    color: 'border-yellow-400 bg-yellow-600/40 shadow-[0_0_20px_rgba(234,179,8,0.8),inset_0_0_10px_rgba(234,179,8,0.5)]',
    type: 'CHEST',
  },
  LOCK: {
    shape: [[1]],
    color: 'border-zinc-500 bg-zinc-800/90 shadow-[0_0_10px_rgba(255,255,255,0.2),inset_0_0_5px_rgba(0,0,0,0.5)]',
    type: 'LOCK',
  },
};

export const RANDOM_TETROMINO = () => {
  const types: TetrominoType[] = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
  const type = types[Math.floor(Math.random() * types.length)];
  return TETROMINOS[type];
};
