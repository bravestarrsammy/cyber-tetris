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
import { Trophy, Play, RotateCcw, Pause, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Settings, Volume2, VolumeX, Music, Home, X } from 'lucide-react';
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
  const [gameState, setGameState] = useState<'MENU' | 'PLAYING'>('MENU');
  const [gameMode, setGameMode] = useState<'CLASSIC' | 'TIME_TRIAL'>('CLASSIC');
  const [timeLeft, setTimeLeft] = useState(120); // 120 seconds for Time Trial
  const [highScores, setHighScores] = useState({ CLASSIC: 0, TIME_TRIAL: 0 });
  const [timeBonusActive, setTimeBonusActive] = useState(false);
  const [lastWarningTime, setLastWarningTime] = useState<number | null>(null);

  const [grid, setGrid] = useState<(TetrominoType | 0)[][]>(createGrid());
  const [activePiece, setActivePiece] = useState<{
    pos: { x: number; y: number };
    tetromino: Tetromino;
    collided: boolean;
  } | null>(null);
  const [nextPiece, setNextPiece] = useState<Tetromino>(RANDOM_TETROMINO());
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const recordTriggeredRef = useRef(false);
  const startingHighScoreRef = useRef(0);
  const [rows, setRows] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [dropTime, setDropTime] = useState<number | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const nextParticleId = useRef(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showConfirmMenu, setShowConfirmMenu] = useState(false);
  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(true);
  // Dynamic cell size based on viewport height
  const getDynamicCellSize = () => {
    if (typeof window === 'undefined') return 30;
    const padding = window.innerWidth < 640 ? 10 : 80;
    const sizeByHeight = Math.floor((window.innerHeight - padding) / ROWS);
    const sizeByWidth = Math.floor((window.innerWidth - (window.innerWidth < 640 ? 120 : 300)) / COLS);
    return Math.min(sizeByHeight, sizeByWidth, window.innerWidth < 640 ? 35 : 45);
  };

  const [cellSize, setCellSize] = useState(getDynamicCellSize());

  const currentHighScore = highScores[gameMode];

  useEffect(() => {
    const savedClassic = localStorage.getItem('cyber-tetris-highscore-classic');
    const savedTimeTrial = localStorage.getItem('cyber-tetris-highscore-timetrial');
    // Migration from old single score
    const oldSaved = localStorage.getItem('cyber-tetris-highscore');
    
    setHighScores({
      CLASSIC: savedClassic ? parseInt(savedClassic, 10) : (oldSaved ? parseInt(oldSaved, 10) : 0),
      TIME_TRIAL: savedTimeTrial ? parseInt(savedTimeTrial, 10) : 0
    });

    const savedSFX = localStorage.getItem('cyber-tetris-sfx');
    if (savedSFX !== null) {
      const enabled = savedSFX === 'true';
      setSfxEnabled(enabled);
      sounds.setSFXEnabled(enabled);
    }

    const savedMusic = localStorage.getItem('cyber-tetris-music');
    if (savedMusic !== null) {
      const enabled = savedMusic === 'true';
      setMusicEnabled(enabled);
      sounds.setMusicEnabled(enabled);
    }
  }, []);

  useEffect(() => {
    if (score > highScores[gameMode] && gameState === 'PLAYING') {
      const newHighScores = { ...highScores, [gameMode]: score };
      setHighScores(newHighScores);
      localStorage.setItem(`cyber-tetris-highscore-${gameMode.toLowerCase().replace('_', '')}`, score.toString());
      
      if (!recordTriggeredRef.current && startingHighScoreRef.current > 0 && score > startingHighScoreRef.current) {
        setIsNewRecord(true);
        recordTriggeredRef.current = true;
        createCyberFireworks();
        setTimeout(() => setIsNewRecord(false), 4000);
      }
    }
  }, [score, highScores, gameState, gameMode]);

  useEffect(() => {
    const handleResize = () => {
      setCellSize(getDynamicCellSize());
    };
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && gameState === 'PLAYING' && !gameOver && !paused) {
        setPaused(true);
        setDropTime(null);
        sounds.stopMusic();
      }
    };

    if (gameState === 'MENU') {
      sounds.startMenuMusic();
    }

    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [gameState, gameOver, paused]);

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
          id: nextParticleId.current++,
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

  const toggleSFX = () => {
    const newState = !sfxEnabled;
    setSfxEnabled(newState);
    sounds.setSFXEnabled(newState);
    localStorage.setItem('cyber-tetris-sfx', newState.toString());
    if (newState) sounds.playMove();
  };

  const toggleMusic = () => {
    const newState = !musicEnabled;
    setMusicEnabled(newState);
    sounds.setMusicEnabled(newState);
    localStorage.setItem('cyber-tetris-music', newState.toString());
    
    if (newState) {
      if (gameState === 'MENU') sounds.startMenuMusic();
      else if (gameState === 'PLAYING') sounds.startGameMusic();
    } else {
      sounds.stopMusic();
    }
  };

  // Time Trial Timer
  useEffect(() => {
    let timerId: any;
    if (gameState === 'PLAYING' && gameMode === 'TIME_TRIAL' && !paused && !gameOver) {
      timerId = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setGameOver(true);
            setDropTime(null);
            sounds.playGameOver();
            clearInterval(timerId);
            return 0;
          }
          const nextTime = prev - 1;
          
          // Sound hints
          if (nextTime === 30) {
            sounds.playTone(440, 'triangle', 0.1, 0.2); // Noticeable beep
          } else if (nextTime <= 10 && nextTime > 0) {
            sounds.playTone(880, 'sine', 0.05, 0.1); // Tick beep
          }
          
          return nextTime;
        });
      }, 1000);
    }
    return () => clearInterval(timerId);
  }, [gameState, gameMode, paused, gameOver]);

  // Start game
  const startGame = (mode: 'CLASSIC' | 'TIME_TRIAL' = 'CLASSIC') => {
    setGrid(createGrid());
    setGameMode(mode);
    setGameOver(false);
    setScore(0);
    setRows(0);
    setLevel(1);
    setTimeLeft(120);
    setPaused(false);
    setDropTime(1000);
    recordTriggeredRef.current = false;
    startingHighScoreRef.current = highScores[mode];
    setIsNewRecord(false);
    const firstPiece = RANDOM_TETROMINO();
    const next = RANDOM_TETROMINO();
    setNextPiece(next);
    setActivePiece({ 
      pos: { x: Math.floor(COLS / 2) - 1, y: 0 }, 
      tetromino: firstPiece, 
      collided: false 
    });
    setGameState('PLAYING');
    sounds.startGameMusic(1);
  };

  const createCyberFireworks = () => {
    const newParticles: Particle[] = [];
    const colors = ['text-cyan-400', 'text-purple-400', 'text-blue-400', 'text-pink-400', 'text-yellow-400'];
    
    // Create 3 big explosions at the top
    for (let f = 0; f < 3; f++) {
      const startX = (COLS * cellSize) / 2 + (f - 1) * 60;
      const startY = 100;
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      for (let i = 0; i < 40; i++) {
        const angle = (Math.PI * 2 * i) / 40;
        const velocity = 5 + Math.random() * 8;
        newParticles.push({
          id: nextParticleId.current++,
          x: startX,
          y: startY,
          color: color,
          vx: Math.cos(angle) * velocity,
          vy: Math.sin(angle) * velocity,
          life: 1.0
        });
      }
    }
    setParticles(prev => [...prev, ...newParticles]);
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
      const nextLevel = level + 1;
      setLevel(nextLevel);
      setDropTime(1000 / (nextLevel + 1) + 200);
      // Dynamic music speed up on level gain
      if (musicEnabled) {
        sounds.startGameMusic(nextLevel);
      }
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
        
        // Time bonus for 3 or more lines
        if (gameMode === 'TIME_TRIAL' && linesCleared >= 3) {
          setTimeLeft(prev => prev + 10);
          setTimeBonusActive(true);
          setTimeout(() => setTimeBonusActive(false), 2000);
        }
        
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
      
      // Time bonus for 3 or more lines
      if (gameMode === 'TIME_TRIAL' && linesCleared >= 3) {
        setTimeLeft(prev => prev + 10);
        setTimeBonusActive(true);
        setTimeout(() => setTimeBonusActive(false), 2000);
      }
      
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
          const isPausing = !paused;
          setPaused(isPausing);
          setDropTime(isPausing ? null : 1000 / level);
          if (!isPausing && musicEnabled) {
            sounds.startGameMusic(level);
          }
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

  useEffect(() => {
    return () => sounds.stopMusic();
  }, []);

  // Update Tetris component's click handler to resume audio context
  const handleGlobalInteraction = () => {
    sounds.resume();
  };

  return (
    <div 
      onClick={handleGlobalInteraction}
      onMouseDown={handleGlobalInteraction}
      onTouchStart={handleGlobalInteraction}
      className="relative flex flex-row gap-2 sm:gap-4 items-center justify-center p-0 sm:p-4 h-screen max-h-screen bg-[#050505] text-white font-sans selection:bg-cyan-500/30 overflow-hidden"
    >
      {/* Background Ambient Glow */}
      <div className="absolute top-0 left-1/4 w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-cyan-500/10 rounded-full blur-[100px] sm:blur-[120px] -z-10 animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-purple-600/10 rounded-full blur-[100px] sm:blur-[120px] -z-10" />
      
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 -z-20 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      <AnimatePresence mode="wait">
        {gameState === 'MENU' ? (
          <motion.div 
            key="menu"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
            className="flex flex-col items-center justify-center z-10 text-center"
          >
            <div className="relative mb-12">
              <motion.div 
                animate={{ opacity: [1, 0.4, 1, 0.8, 1], filter: ['brightness(1)', 'brightness(1.5)', 'brightness(1)', 'brightness(2)', 'brightness(1)'] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
                className="flex flex-col gap-2"
              >
                <div className="flex gap-1.5 items-center justify-center">
                  {['C','Y','B','E','R'].map((l, i) => (
                    <div key={i} className="w-10 h-10 sm:w-16 sm:h-16 flex items-center justify-center bg-cyan-500/20 border-2 border-cyan-400/50 shadow-[0_0_15px_rgba(34,211,238,0.5)] rounded-md">
                      <span className="text-2xl sm:text-4xl font-black text-cyan-400">{l}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-1.5 items-center justify-center">
                  {['T','E','T','R','I','S'].map((l, i) => (
                    <div key={i} className="w-10 h-10 sm:w-16 sm:h-16 flex items-center justify-center bg-purple-600/20 border-2 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.5)] rounded-md">
                      <span className="text-2xl sm:text-4xl font-black text-purple-400">{l}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
              <div className="absolute -inset-4 bg-cyan-500/5 blur-3xl -z-10 animate-pulse" />
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-4">
                <Button 
                  onClick={() => startGame('CLASSIC')}
                  className="group relative overflow-hidden bg-transparent border-2 border-cyan-500/50 hover:border-cyan-400 text-cyan-400 px-12 py-8 text-xl font-black uppercase tracking-widest rounded-none transform transition-transform hover:scale-105 active:scale-95"
                >
                  <div className="absolute inset-0 bg-cyan-500/10 group-hover:bg-cyan-500/20 transition-colors" />
                  <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-cyan-400" />
                  <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-cyan-400" />
                  CLASSIC MODE
                </Button>

                <Button 
                  onClick={() => startGame('TIME_TRIAL')}
                  className="group relative overflow-hidden bg-transparent border-2 border-purple-500/50 hover:border-purple-400 text-purple-400 px-12 py-8 text-xl font-black uppercase tracking-widest rounded-none transform transition-transform hover:scale-105 active:scale-95"
                >
                  <div className="absolute inset-0 bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors" />
                  <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-purple-400" />
                  <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-purple-400" />
                  TIME TRIAL (2:00)
                </Button>
              </div>
              <div className="flex flex-col gap-4 mt-4">
                <Button 
                  onClick={() => setShowSettings(true)}
                  variant="ghost"
                  className="text-white/40 hover:text-white/80 font-mono text-[10px] tracking-widest uppercase flex items-center justify-center gap-2"
                >
                  <Settings className="h-4 w-4" /> System Settings
                </Button>
                <p className="text-white/20 font-mono text-[10px] tracking-[0.4em] uppercase">Neural Link Sync Status: Ready</p>
              </div>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div 
            key="game"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-row gap-2 sm:gap-4 items-center justify-center w-full max-w-5xl"
          >
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

                  {/* Time Trial Countdown */}
                  {gameMode === 'TIME_TRIAL' && !gameOver && (
                    <div className="absolute top-4 right-4 z-40 flex flex-col items-end">
                       <div className={`text-2xl font-black font-mono tracking-widest ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-cyan-400'}`}>
                          {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                       </div>
                       <AnimatePresence>
                          {timeBonusActive && (
                            <motion.div 
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, scale: 1.5 }}
                              className="text-xs font-bold text-green-400 font-mono"
                            >
                               +10s BONUS
                            </motion.div>
                          )}
                       </AnimatePresence>
                    </div>
                  )}

                  {/* New Record Toast */}
                  <AnimatePresence>
                    {isNewRecord && (
                      <motion.div 
                        initial={{ opacity: 0, y: 50, scale: 0.5 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -50, scale: 1.5 }}
                        className="absolute inset-x-0 top-1/4 z-[60] flex flex-col items-center justify-center pointer-events-none"
                      >
                        <div className="bg-cyan-500/20 backdrop-blur-md border-2 border-cyan-400 px-8 py-3 rounded-none skew-x-[-12deg] shadow-[0_0_30px_rgba(34,211,238,0.5)]">
                          <h3 className="text-2xl font-black text-cyan-400 tracking-[0.3em] italic uppercase leading-none drop-shadow-[0_0_8px_rgba(34,211,238,1)] animate-pulse">
                            New Record!
                          </h3>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

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
                        const baseColor = activePiece.tetromino.color.split(' ')[0].replace('bg-', 'border-');
                        return (
                          <div 
                            key={`ghost-${y}-${x}`}
                            className={`absolute border-2 ${baseColor} opacity-30 rounded-sm bg-transparent shadow-[0_0_10px_rgba(255,255,255,0.1)]`}
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
                        <div className="flex flex-col gap-2">
                          <Button onClick={() => startGame(gameMode)} variant="destructive" size="sm" className="rounded-full px-6">
                             <RotateCcw className="mr-2 h-3 w-3" /> Retry
                          </Button>
                          <Button 
                            onClick={() => { setGameState('MENU'); sounds.stopMusic(); }} 
                            variant="ghost" 
                            size="sm" 
                            className="text-white/40 hover:text-white text-[10px] uppercase font-mono tracking-widest"
                          >
                            Back to Menu
                          </Button>
                        </div>
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
                        <div className="flex flex-col gap-3 w-48">
                          <Button 
                            onClick={() => { 
                              setPaused(false); 
                              setDropTime(1000 / level); 
                              if (musicEnabled) {
                                sounds.startGameMusic(level);
                              }
                            }} 
                            size="sm" 
                            className="rounded-full px-6 bg-cyan-500 hover:bg-cyan-600 w-full animate-pulse"
                          >
                            <Play className="mr-2 h-3 w-3" /> Resume
                          </Button>
                          
                          <Button 
                            onClick={() => setShowConfirmMenu(true)} 
                            variant="ghost" 
                            size="sm" 
                            className="rounded-full text-white/40 hover:text-white/80 hover:bg-white/5 w-full h-8 text-[10px] tracking-widest uppercase font-mono mt-2"
                          >
                            <Home className="mr-2 h-3 w-3" /> Terminate Link
                          </Button>
                        </div>
                      </motion.div>
                    )}

                    {showConfirmMenu && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md px-6 text-center"
                      >
                        <h3 className="text-red-500 font-black text-xl italic mb-2 tracking-tighter">TERMINATE SESSION?</h3>
                        <p className="text-white/60 text-xs mb-6 font-mono">Current neural progress will be lost.</p>
                        
                        <div className="flex flex-col gap-2 w-full max-w-[180px]">
                          <Button 
                            onClick={() => {
                              setShowConfirmMenu(false);
                              setGameState('MENU');
                              sounds.stopMusic();
                            }} 
                            variant="destructive" 
                            size="sm" 
                            className="w-full rounded-full font-bold h-10"
                          >
                            CONFIRM TERMINATION
                          </Button>
                          <Button 
                            onClick={() => setShowConfirmMenu(false)} 
                            variant="ghost" 
                            size="sm" 
                            className="w-full text-white/60 hover:text-white h-9 text-[10px] tracking-widest font-mono"
                          >
                            CANCEL
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Right: Scoreboard & Next Piece */}
            <div className="flex flex-col gap-2 w-[110px] sm:w-[200px] pt-1 h-full max-h-[100%]">
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
              <Card className="bg-black/40 border-white/10 backdrop-blur-md overflow-hidden flex-1 max-h-[260px]">
                <CardContent className="p-2 sm:p-4 space-y-4">
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase text-white/30 font-mono block">Sync Score</span>
                    <div className="text-xl sm:text-2xl font-black font-mono tracking-tighter text-cyan-400 tabular-nums leading-none">
                      {score.toLocaleString()}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[9px] uppercase text-white/30 font-mono block">Neural Best</span>
                    <div className="text-lg font-bold font-mono tracking-tighter text-purple-400 tabular-nums leading-none">
                      {highScores[gameMode].toLocaleString()}
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-white/5">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] uppercase text-white/30 font-mono">Neural Level</span>
                      <span className="text-sm font-bold text-white leading-none">{level}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] uppercase text-white/30 font-mono">Blocks Linked</span>
                      <span className="text-sm font-bold text-white leading-none">{rows}</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => { 
                        const isPausing = !paused;
                        setPaused(isPausing); 
                        setDropTime(isPausing ? null : 1000 / level);
                        if (!isPausing && musicEnabled) {
                          sounds.startGameMusic(level);
                        }
                      }}
                      className="w-full h-8 border border-white/5 bg-white/5 hover:bg-white/10 text-white/60 text-[10px] uppercase tracking-tighter font-mono"
                    >
                      {paused ? <Play className="h-3 w-3 mr-1" /> : <Pause className="h-3 w-3 mr-1" />}
                      {paused ? 'RESUME' : 'PAUSE'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Global Overlays (Settings) */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="w-full max-w-sm bg-neutral-900/50 border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative"
            >
              <div className="p-6 border-b border-white/10 flex justify-between items-center">
                <h2 className="text-lg font-black italic tracking-tight text-white/90">SYSTEM_SETTINGS</h2>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setShowSettings(false)}
                  className="rounded-full h-8 w-8 text-white/40 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="p-6 space-y-6">
                {/* Music Toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/10 rounded-lg">
                      <Music className={`h-5 w-5 ${musicEnabled ? 'text-purple-400' : 'text-white/20'}`} />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-white/90">Atmospheric Audio</p>
                      <p className="text-[10px] text-white/30 font-mono tracking-widest uppercase">Music Link</p>
                    </div>
                  </div>
                  <Button
                    onClick={toggleMusic}
                    variant={musicEnabled ? "default" : "outline"}
                    className={`h-8 w-16 rounded-full transition-all duration-300 ${musicEnabled ? 'bg-purple-600 hover:bg-purple-700 border-none' : 'border-white/10 text-white/20'}`}
                  >
                    <div className={`h-4 w-4 bg-white rounded-full transition-all duration-300 transform ${musicEnabled ? 'translate-x-3' : '-translate-x-3'}`} />
                  </Button>
                </div>

                {/* SFX Toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-cyan-500/10 rounded-lg">
                      {sfxEnabled ? <Volume2 className="h-5 w-5 text-cyan-400" /> : <VolumeX className="h-5 w-5 text-white/20" />}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-white/90">Haptic Feedback</p>
                      <p className="text-[10px] text-white/30 font-mono tracking-widest uppercase">Sound Effects</p>
                    </div>
                  </div>
                  <Button
                    onClick={toggleSFX}
                    variant={sfxEnabled ? "default" : "outline"}
                    className={`h-8 w-16 rounded-full transition-all duration-300 ${sfxEnabled ? 'bg-cyan-500 hover:bg-cyan-600 border-none' : 'border-white/10 text-white/20'}`}
                  >
                    <div className={`h-4 w-4 bg-white rounded-full transition-all duration-300 transform ${sfxEnabled ? 'translate-x-3' : '-translate-x-3'}`} />
                  </Button>
                </div>
              </div>

              <div className="p-4 bg-white/[0.02] border-t border-white/5 flex justify-center">
                <Button 
                  onClick={() => setShowSettings(false)}
                  className="w-full bg-white/10 hover:bg-white/20 text-white font-bold h-10 rounded-xl tracking-widest text-xs"
                >
                  SAVE_CHANGES
                </Button>
              </div>

              {/* Decorative corners */}
              <div className="absolute top-0 right-0 w-8 h-8 pointer-events-none opacity-20 border-t border-r border-white/40" />
              <div className="absolute bottom-0 left-0 w-8 h-8 pointer-events-none opacity-20 border-b border-l border-white/40" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
