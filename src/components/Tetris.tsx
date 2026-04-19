import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  COLS, 
  ROWS, 
  TETROMINOS, 
  RANDOM_TETROMINO, 
  Tetromino, 
  TetrominoType 
} from '@/src/constants';
import { useInterval } from '@/src/hooks/useInterval';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, Play, RotateCcw, Pause, ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';
import { sounds } from '@/src/utils/audio';

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  vx: number;
  vy: number;
  life: number;
}

// Initialize empty grid
const createGrid = () => Array.from({ length: ROWS }, () => Array(COLS).fill(0));

export default function Tetris() {
  const [grid, setGrid] = useState<(TetrominoType | 0)[][]>(createGrid());
  const [activePiece, setActivePiece] = useState<{
    pos: { x: number; y: number };
    tetromino: Tetromino;
    collided: boolean;
  } | null>(null);
  const [nextPiece, setNextPiece] = useState<Tetromino>(RANDOM_TETROMINO());
  const [score, setScore] = useState(0);
  const [rows, setRows] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [dropTime, setDropTime] = useState<number | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  // Dynamic cell size based on viewport height
  const getDynamicCellSize = () => {
    if (typeof window === 'undefined') return 30;
    const padding = window.innerWidth < 640 ? 10 : 80;
    const sizeByHeight = Math.floor((window.innerHeight - padding) / ROWS);
    const sizeByWidth = Math.floor((window.innerWidth - (window.innerWidth < 640 ? 120 : 300)) / COLS);
    return Math.min(sizeByHeight, sizeByWidth, window.innerWidth < 640 ? 35 : 45);
  };

  const [cellSize, setCellSize] = useState(getDynamicCellSize());

  useEffect(() => {
    const handleResize = () => {
      setCellSize(getDynamicCellSize());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const touchStartRef = useRef<{ x: number, y: number } | null>(null);
  const touchLastRef = useRef<{ x: number, y: number } | null>(null);
  const isMovingRef = useRef(false);

  const gameBoardRef = useRef<HTMLDivElement>(null);

  // Particle system logic
  useEffect(() => {
    if (particles.length === 0) return;

    const interval = setInterval(() => {
      setParticles(prev => 
        prev
          .map(p => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.vy + 0.2, // Gravity
            life: p.life - 0.02
          }))
          .filter(p => p.life > 0)
      );
    }, 16);

    return () => clearInterval(interval);
  }, [particles.length]);

  const createExplosion = (y: number, types: (TetrominoType | 0)[]) => {
    const newParticles: Particle[] = [];
    types.forEach((type, x) => {
      if (type === 0) return;
      const colorClass = TETROMINOS[type].color.split(' ')[0];
      
      // Create 5-8 particles per block
      const count = 5 + Math.floor(Math.random() * 4);
      for (let i = 0; i < count; i++) {
        newParticles.push({
          id: Math.random(),
          x: x * cellSize + cellSize / 2,
          y: y * cellSize + cellSize / 2,
          color: colorClass,
          vx: (Math.random() - 0.5) * 10,
          vy: (Math.random() - 0.5) * 10 - 5,
          life: 1.0
        });
      }
    });
    setParticles(prev => [...prev, ...newParticles]);
  };

  // Collision detection
  const checkCollision = useCallback((
    piece: Tetromino, 
    pos: { x: number; y: number }, 
    currentGrid: (TetrominoType | 0)[][]
  ) => {
    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (piece.shape[y][x] !== 0) {
          if (
            !currentGrid[y + pos.y] || 
            currentGrid[y + pos.y][x + pos.x] === undefined ||
            currentGrid[y + pos.y][x + pos.x] !== 0
          ) {
            return true;
          }
        }
      }
    }
    return false;
  }, []);

  // Spawn new piece
  const spawnPiece = useCallback(() => {
    const newPiece = nextPiece;
    setNextPiece(RANDOM_TETROMINO());
    
    const pos = { x: Math.floor(COLS / 2) - 1, y: 0 };
    
    if (checkCollision(newPiece, pos, grid)) {
      setGameOver(true);
      setDropTime(null);
      sounds.playGameOver();
    } else {
      setActivePiece({ pos, tetromino: newPiece, collided: false });
    }
  }, [nextPiece, grid, checkCollision]);

  // Start game
  const startGame = () => {
    setGrid(createGrid());
    setGameOver(false);
    setScore(0);
    setRows(0);
    setLevel(1);
    setPaused(false);
    setDropTime(1000);
    const firstPiece = RANDOM_TETROMINO();
    const next = RANDOM_TETROMINO();
    setNextPiece(next);
    setActivePiece({ 
      pos: { x: Math.floor(COLS / 2) - 1, y: 0 }, 
      tetromino: firstPiece, 
      collided: false 
    });
  };

  // Move piece
  const movePiece = (dir: { x: number; y: number }) => {
    if (!activePiece || gameOver || paused) return;
    
    const newPos = { 
      x: activePiece.pos.x + dir.x, 
      y: activePiece.pos.y + dir.y 
    };

    if (!checkCollision(activePiece.tetromino, newPos, grid)) {
      setActivePiece(prev => prev ? { ...prev, pos: newPos } : null);
      sounds.playMove();
    } else if (dir.y > 0) {
      // Collision below
      setActivePiece(prev => prev ? { ...prev, collided: true } : null);
    }
  };

  // Rotate piece
  const rotate = (piece: Tetromino): number[][] => {
    const rotated = piece.shape[0].map((_, index) =>
      piece.shape.map(col => col[index]).reverse()
    );
    return rotated;
  };

  const handleRotate = () => {
    if (!activePiece || gameOver || paused) return;
    const clonedPiece = JSON.parse(JSON.stringify(activePiece.tetromino));
    clonedPiece.shape = rotate(clonedPiece);
    
    // Wall kick simple implementation
    let pos = activePiece.pos.x;
    let offset = 1;
    while (checkCollision(clonedPiece, { x: pos, y: activePiece.pos.y }, grid)) {
      pos += offset;
      offset = -(offset + (offset > 0 ? 1 : -1));
      if (Math.abs(offset) > clonedPiece.shape[0].length) {
        return; // Cannot rotate
      }
    }
    
    setActivePiece(prev => prev ? { ...prev, pos: { ...prev.pos, x: pos }, tetromino: clonedPiece } : null);
    sounds.playRotate();
  };

  // Drop logic
  const drop = (isManual: boolean = false) => {
    if (gameOver || paused) return;

    // Increase level every 10 rows
    if (rows > level * 10) {
      setLevel(prev => prev + 1);
      setDropTime(1000 / (level + 1) + 200);
    }

    if (!activePiece) return;

    const newPos = { x: activePiece.pos.x, y: activePiece.pos.y + 1 };
    if (!checkCollision(activePiece.tetromino, newPos, grid)) {
      setActivePiece(prev => prev ? { ...prev, pos: newPos } : null);
      if (isManual) sounds.playMove();
    } else {
      // Merge piece into grid
      const newGrid = [...grid];
      activePiece.tetromino.shape.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value !== 0) {
            const gridY = y + activePiece.pos.y;
            const gridX = x + activePiece.pos.x;
            if (newGrid[gridY]) {
              newGrid[gridY][gridX] = activePiece.tetromino.type;
            }
          }
        });
      });

      // Clear lines
      let linesCleared = 0;
      const filteredGrid = newGrid.reduce((acc, row, y) => {
        if (row.every(cell => cell !== 0)) {
          linesCleared++;
          createExplosion(y, row);
          acc.unshift(Array(COLS).fill(0));
          return acc;
        }
        acc.push(row);
        return acc;
      }, [] as (TetrominoType | 0)[][]);

      if (linesCleared > 0) {
        setRows(prev => prev + linesCleared);
        setScore(prev => prev + [0, 40, 100, 300, 1200][linesCleared] * level);
        sounds.playClear();
      } else {
        sounds.playLand();
      }

      setGrid(filteredGrid);
      spawnPiece();
    }
  };

  const hardDrop = () => {
    if (!activePiece || gameOver || paused) return;
    let newY = activePiece.pos.y;
    while (!checkCollision(activePiece.tetromino, { x: activePiece.pos.x, y: newY + 1 }, grid)) {
      newY++;
    }
    
    // Merge immediately
    const newGrid = [...grid];
    activePiece.tetromino.shape.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          const gridY = y + newY;
          const gridX = x + activePiece.pos.x;
          if (newGrid[gridY]) {
            newGrid[gridY][gridX] = activePiece.tetromino.type;
          }
        }
      });
    });

    let linesCleared = 0;
    const filteredGrid = newGrid.reduce((acc, row, y) => {
      if (row.every(cell => cell !== 0)) {
        linesCleared++;
        createExplosion(y, row);
        acc.unshift(Array(COLS).fill(0));
        return acc;
      }
      acc.push(row);
      return acc;
    }, [] as (TetrominoType | 0)[][]);

    if (linesCleared > 0) {
      setRows(prev => prev + linesCleared);
      setScore(prev => prev + [0, 40, 100, 300, 1200][linesCleared] * level);
      sounds.playClear();
    } else {
      sounds.playDrop();
      sounds.playLand();
    }

    setGrid(filteredGrid);
    spawnPiece();
  };

  useInterval(() => {
    drop();
  }, dropTime);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameOver) return;
      
      switch(e.key) {
        case 'ArrowLeft':
          movePiece({ x: -1, y: 0 });
          break;
        case 'ArrowRight':
          movePiece({ x: 1, y: 0 });
          break;
        case 'ArrowDown':
          drop(true);
          break;
        case 'ArrowUp':
          handleRotate();
          break;
        case ' ':
          e.preventDefault();
          hardDrop();
          break;
        case 'p':
        case 'P':
          setPaused(prev => !prev);
          setDropTime(paused ? 1000 / level : null);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePiece, gameOver, paused, grid, level]);

  // Ghost piece calculation
  const getGhostPos = () => {
    if (!activePiece) return null;
    let ghostY = activePiece.pos.y;
    while (!checkCollision(activePiece.tetromino, { x: activePiece.pos.x, y: ghostY + 1 }, grid)) {
      ghostY++;
    }
    return { x: activePiece.pos.x, y: ghostY };
  };

  const ghostPos = getGhostPos();

  const handleTouchStart = (e: React.TouchEvent) => {
    if (gameOver || paused || !activePiece) return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    touchLastRef.current = { x: touch.clientX, y: touch.clientY };
    isMovingRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || !touchLastRef.current || gameOver || paused || !activePiece) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchLastRef.current.x;
    const deltaY = touch.clientY - touchLastRef.current.y;
    
    // Horizontal movement: move piece every 25px displacement
    if (Math.abs(deltaX) > 25) {
      movePiece({ x: deltaX > 0 ? 1 : -1, y: 0 });
      touchLastRef.current.x = touch.clientX;
      isMovingRef.current = true;
    }

    // Vertical movement (Soft Drop): move piece down every 20px displacement
    if (deltaY > 20) {
      drop(true);
      touchLastRef.current.y = touch.clientY;
      isMovingRef.current = true;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || gameOver || paused || !activePiece) return;
    const touch = e.changedTouches[0];
    const totalDeltaX = touch.clientX - touchStartRef.current.x;
    const totalDeltaY = touch.clientY - touchStartRef.current.y;

    // Determine action: Tap (minimal movement) -> Rotate
    if (!isMovingRef.current && Math.abs(totalDeltaX) < 15 && Math.abs(totalDeltaY) < 15) {
      handleRotate();
    } 
    // Downward swipe (large vertical displacement) -> Hard drop
    else if (totalDeltaY > 80 && Math.abs(totalDeltaX) < 60) {
      hardDrop();
    }

    touchStartRef.current = null;
    touchLastRef.current = null;
  };

  return (
    <div className="relative flex flex-row gap-2 sm:gap-4 items-center justify-center p-0 sm:p-4 h-screen max-h-screen bg-[#050505] text-white font-sans selection:bg-cyan-500/30 overflow-hidden">
      {/* Background Ambient Glow */}
      <div className="absolute top-0 left-1/4 w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-cyan-500/10 rounded-full blur-[100px] sm:blur-[120px] -z-10 animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-purple-600/10 rounded-full blur-[100px] sm:blur-[120px] -z-10" />
      
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 -z-20 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      {/* Left: Game Area */}
      <div className="flex flex-col items-center">
        <div className="relative group origin-center">
          {/* Neon Border Effect */}
          <div className="absolute -inset-[2px] bg-gradient-to-b from-cyan-500/50 via-purple-500/50 to-blue-500/50 rounded-xl blur-[2px]"></div>
          
          <div 
            ref={gameBoardRef}
            className="relative bg-neutral-900 border border-white/20 rounded-lg overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.8)] touch-none"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ 
              width: COLS * cellSize, 
              height: ROWS * cellSize,
              display: 'grid',
              gridTemplateColumns: `repeat(${COLS}, 1fr)`,
              gridTemplateRows: `repeat(${ROWS}, 1fr)`
            }}
          >
            {/* Board Pattern (Internal Grid) */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)]" style={{ backgroundSize: `${cellSize}px ${cellSize}px` }} />

            {/* Settled Blocks */}
            {grid.map((row, y) => 
              row.map((type, x) => {
                if (type === 0) return null;
                const tetromino = TETROMINOS[type];
                return (
                  <div 
                    key={`settled-${y}-${x}`}
                    className={`absolute border border-white/20 rounded-sm ${tetromino.color}`}
                    style={{ top: y * cellSize, left: x * cellSize, width: cellSize, height: cellSize }}
                  />
                );
              })
            )}

            {/* Ghost Piece */}
            {activePiece && ghostPos && !gameOver && !paused && (
              activePiece.tetromino.shape.map((row, y) => 
                row.map((value, x) => {
                  if (value === 0) return null;
                  return (
                    <div 
                      key={`ghost-${y}-${x}`}
                      className="absolute border-2 border-white/20 rounded-sm bg-white/5"
                      style={{ 
                        top: (y + ghostPos.y) * cellSize, 
                        left: (x + ghostPos.x) * cellSize,
                        width: cellSize, height: cellSize
                      }}
                    />
                  );
                })
              )
            )}

            {/* Active Piece */}
            {activePiece && !gameOver && !paused && (
              activePiece.tetromino.shape.map((row, y) => 
                row.map((value, x) => {
                  if (value === 0) return null;
                  return (
                    <motion.div 
                      key={`active-${y}-${x}`}
                      className={`absolute border border-white/30 rounded-sm ${activePiece.tetromino.color}`}
                      style={{ 
                        top: (y + activePiece.pos.y) * cellSize, 
                        left: (x + activePiece.pos.x) * cellSize,
                        width: cellSize, height: cellSize
                      }}
                    />
                  );
                })
              )
            )}

            {/* Particles */}
            {particles.map(p => (
              <div 
                key={p.id}
                className={`absolute w-2 h-2 rounded-full ${p.color} shadow-[0_0_8px_currentColor]`}
                style={{ 
                  left: p.x, 
                  top: p.y,
                  opacity: p.life,
                  transform: `scale(${p.life})`
                }}
              />
            ))}

            {/* Overlays */}
            <AnimatePresence>
              {gameOver && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm"
                >
                  <h2 className="text-2xl font-black text-red-500 mb-2 tracking-tighter italic text-center leading-none">GAME OVER</h2>
                  <p className="text-white/60 mb-4 text-sm font-mono">Score: {score}</p>
                  <Button onClick={startGame} variant="destructive" size="sm" className="rounded-full px-6">
                    <RotateCcw className="mr-2 h-3 w-3" /> Retry
                  </Button>
                </motion.div>
              )}

              {paused && !gameOver && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm"
                >
                  <h2 className="text-2xl font-black text-cyan-400 mb-4 tracking-tighter italic">PAUSED</h2>
                  <Button onClick={() => { setPaused(false); setDropTime(1000 / level); }} size="sm" className="rounded-full px-6 bg-cyan-500 hover:bg-cyan-600">
                    <Play className="mr-2 h-3 w-3" /> Resume
                  </Button>
                </motion.div>
              )}

              {!activePiece && !gameOver && !paused && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm"
                >
                  <Button onClick={startGame} size="sm" className="rounded-full px-8 py-6 text-lg font-bold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 shadow-[0_0_20px_rgba(6,182,212,0.4)]">
                    <Play className="mr-2 h-5 w-5" /> START
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Right: Scoreboard & Next Piece */}
      <div className="flex flex-col gap-2 w-[110px] sm:w-[200px] pt-1">
        {/* Next Piece Card */}
        <Card className="bg-black/40 border-white/10 backdrop-blur-md">
          <CardHeader className="p-2">
            <CardTitle className="text-[10px] uppercase tracking-wide text-white/40 font-mono text-center">Next</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center h-16 p-0 pb-2">
            <div className="relative" style={{ width: 40, height: 40 }}>
              {nextPiece.shape.map((row, y) => 
                row.map((value, x) => {
                  if (value === 0) return null;
                  return (
                    <div 
                      key={`next-${y}-${x}`}
                      className={`absolute w-3 h-3 border border-white/10 rounded-xs ${nextPiece.color}`}
                      style={{ 
                        top: y * 12 + (nextPiece.type === 'I' ? 5 : 10), 
                        left: x * 12 + (nextPiece.type === 'I' ? 0 : 5) 
                      }}
                    />
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats Card */}
        <Card className="bg-black/40 border-white/10 backdrop-blur-md overflow-hidden">
          <CardContent className="p-2 space-y-3">
            <div className="space-y-0.5">
              <span className="text-[9px] uppercase text-white/30 font-mono block">Score</span>
              <div className="text-sm font-bold font-mono tracking-tighter text-white tabular-nums leading-none truncate">
                {score.toLocaleString()}
              </div>
            </div>

            <div className="space-y-2 pt-1 border-t border-white/5">
              <div className="flex justify-between items-center">
                <span className="text-[9px] uppercase text-white/30 font-mono">Lv</span>
                <span className="text-xs font-mono text-cyan-400 font-bold">{level}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[9px] uppercase text-white/30 font-mono">Lines</span>
                <span className="text-xs font-mono text-white/80">{rows}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {activePiece && !gameOver && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => { setPaused(prev => !prev); setDropTime(paused ? 1000 / level : null); }}
            className="h-8 border-white/10 bg-white/5 hover:bg-white/10 text-white/60 text-[10px] uppercase tracking-tighter font-mono w-full px-1"
          >
            {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
            <span className="ml-1">{paused ? 'Res' : 'Pause'}</span>
          </Button>
        )}
      </div>
    </div>
  );
}
