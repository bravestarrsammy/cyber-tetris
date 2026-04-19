export const COLS = 10;
export const ROWS = 20;
export const BLOCK_SIZE = 30;

export type TetrominoType = 'I' | 'J' | 'L' | 'O' | 'S' | 'T' | 'Z';

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
    color: 'bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.8)]',
    type: 'I',
  },
  J: {
    shape: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    color: 'bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.8)]',
    type: 'J',
  },
  L: {
    shape: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
    color: 'bg-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.8)]',
    type: 'L',
  },
  O: {
    shape: [
      [1, 1],
      [1, 1],
    ],
    color: 'bg-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.8)]',
    type: 'O',
  },
  S: {
    shape: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
    color: 'bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.8)]',
    type: 'S',
  },
  T: {
    shape: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    color: 'bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.8)]',
    type: 'T',
  },
  Z: {
    shape: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
    color: 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)]',
    type: 'Z',
  },
};

export const RANDOM_TETROMINO = () => {
  const types: TetrominoType[] = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
  const type = types[Math.floor(Math.random() * types.length)];
  return TETROMINOS[type];
};
