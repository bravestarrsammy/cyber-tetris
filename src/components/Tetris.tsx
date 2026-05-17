import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { App } from '@capacitor/app';
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
import { Slider } from '@/components/ui/slider';
import { Trophy, Play, RotateCcw, Pause, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Settings, Volume2, VolumeX, Music, Home, X, ChevronsDown } from 'lucide-react';
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
  const [gameMode, setGameMode] = useState<'CLASSIC' | 'TIME_TRIAL' | 'INVADER'>('CLASSIC');
  const [timeLeft, setTimeLeft] = useState(120); // 120 seconds for Time Trial
  const [highScores, setHighScores] = useState({ CLASSIC: 0, TIME_TRIAL: 0, INVADER: 0 });
  const [timeBonusActive, setTimeBonusActive] = useState(false);
  const [lastWarningTime, setLastWarningTime] = useState<number | null>(null);

  const [grid, setGrid] = useState<(TetrominoType | 0)[][]>(createGrid());
  const gridRef = useRef(grid);
  const [turretX, setTurretX] = useState(Math.floor(COLS / 2) - 1);
  const turretXRef = useRef(turretX);
  const [bullets, setBullets] = useState<{ id: number, x: number, y: number, type: TetrominoType }[]>([]);
  const nextBulletId = useRef(0);
  const [lockHealth, setLockHealth] = useState<Record<string, number>>({});
  const [showRewardDialog, setShowRewardDialog] = useState(false);
  const [rewardChoices, setRewardChoices] = useState<string[]>([]);
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
  const [musicVolume, setMusicVolume] = useState(0.5);
  const [sfxVolume, setSfxVolume] = useState(1.0);
  // Dynamic cell size based on viewport height
  const getDynamicCellSize = () => {
    if (typeof window === 'undefined') return 30;
    // Increased padding to account for the large neural control panel (approx 180-220px)
    const padding = window.innerWidth < 640 ? 260 : 300; 
    const sizeByHeight = Math.floor((window.innerHeight - padding) / ROWS);
    const sidebarWidth = window.innerWidth < 640 ? 95 : 170; 
    const horizontalMargin = window.innerWidth < 640 ? 30 : 80; 
    const sizeByWidth = Math.floor((window.innerWidth - sidebarWidth - horizontalMargin) / COLS);
    return Math.max(15, Math.min(sizeByHeight, sizeByWidth, window.innerWidth < 640 ? 22 : 28)); 
  };

  const [cellSize, setCellSize] = useState(getDynamicCellSize());
  const cellSizeRef = useRef(cellSize);
  const repeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [sessionToRestore, setSessionToRestore] = useState<any | null>(null);

  type RepeatActionType = 'MOVE_LEFT' | 'MOVE_RIGHT' | 'ROTATE' | 'TURRET_LEFT' | 'TURRET_RIGHT' | 'FIRE' | 'HARD_DROP';
  const activeRepeatTypeRef = useRef<RepeatActionType | null>(null);
  const actionsMapRef = useRef<Record<RepeatActionType, () => void> | null>(null);

  const startRepeat = useCallback((type: RepeatActionType) => {
    if (repeatIntervalRef.current) clearInterval(repeatIntervalRef.current);
    activeRepeatTypeRef.current = type;
    
    // Execute immediately on press
    if (actionsMapRef.current) {
      actionsMapRef.current[type]();
    }
    
    repeatIntervalRef.current = setInterval(() => {
      if (activeRepeatTypeRef.current && actionsMapRef.current) {
        actionsMapRef.current[activeRepeatTypeRef.current]();
      }
    }, 100);
  }, []);

  const stopRepeat = useCallback(() => {
    if (repeatIntervalRef.current) {
      clearInterval(repeatIntervalRef.current);
      repeatIntervalRef.current = null;
    }
    activeRepeatTypeRef.current = null;
  }, []);

  // Cleanup repeat interval on unmount
  useEffect(() => {
    return () => {
      if (repeatIntervalRef.current) clearInterval(repeatIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    gridRef.current = grid;
  }, [grid]);

  useEffect(() => {
    turretXRef.current = turretX;
  }, [turretX]);

  useEffect(() => {
    cellSizeRef.current = cellSize;
  }, [cellSize]);

  const currentHighScore = highScores[gameMode];

  useEffect(() => {
    const savedClassic = localStorage.getItem('cyber-tetris-highscore-classic');
    const savedTimeTrial = localStorage.getItem('cyber-tetris-highscore-timetrial');
    const savedInvader = localStorage.getItem('cyber-tetris-highscore-invader');
    // Migration from old single score
    const oldSaved = localStorage.getItem('cyber-tetris-highscore');
    
    setHighScores({
      CLASSIC: savedClassic ? parseInt(savedClassic, 10) : (oldSaved ? parseInt(oldSaved, 10) : 0),
      TIME_TRIAL: savedTimeTrial ? parseInt(savedTimeTrial, 10) : 0,
      INVADER: savedInvader ? parseInt(savedInvader, 10) : 0
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

    const savedMusicVolume = localStorage.getItem('cyber-tetris-music-volume');
    if (savedMusicVolume !== null) {
      const vol = parseFloat(savedMusicVolume);
      if (!isNaN(vol)) {
        setMusicVolume(vol);
        sounds.setMusicVolume(vol);
      }
    }

    const savedSFXVolume = localStorage.getItem('cyber-tetris-sfx-volume');
    if (savedSFXVolume !== null) {
      const vol = parseFloat(savedSFXVolume);
      if (!isNaN(vol)) {
        setSfxVolume(vol);
        sounds.setSFXVolume(vol);
      }
    }

    try {
      const saved = localStorage.getItem('cyber-tetris-saved-session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.grid && parsed.score !== undefined) {
          setSessionToRestore(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to parse saved session:", e);
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

  // Autosave game state dynamically when any key gameplay state updates
  useEffect(() => {
    if (gameState === 'PLAYING' && !gameOver) {
      const session = {
        gameMode,
        grid,
        timeLeft,
        activePiece,
        nextPiece,
        score,
        rows,
        level,
        lockHealth,
        turretX,
        bullets
      };
      localStorage.setItem('cyber-tetris-saved-session', JSON.stringify(session));
    }
  }, [gameState, gameOver, gameMode, grid, timeLeft, activePiece, nextPiece, score, rows, level, lockHealth, turretX, bullets]);

  // Clear autosave once the game is over
  useEffect(() => {
    if (gameOver) {
      localStorage.removeItem('cyber-tetris-saved-session');
    }
  }, [gameOver]);

  // Level System: Increase level every 10 rows and adjust falling speed
  useEffect(() => {
    if (gameState === 'PLAYING' && !gameOver) {
      const calculatedLevel = Math.floor(rows / 10) + 1;
      if (calculatedLevel !== level) {
        setLevel(calculatedLevel);
        // Each level reduces drop time. Speed formula: 1000ms base, decreasing.
        // We ensure a minimum speed of 100ms for playability.
        const newSpeed = Math.max(100, 1000 - (calculatedLevel - 1) * 100);
        
        if (!paused) {
          setDropTime(newSpeed);
          if (musicEnabled) {
            sounds.startGameMusic(calculatedLevel);
          }
        }
      }
    }
  }, [rows, gameState, gameOver, paused, musicEnabled, level]);

  useEffect(() => {
    const handleResize = () => {
      setCellSize(getDynamicCellSize());
    };

    if (gameState === 'MENU') {
      sounds.startMenuMusic();
    }

    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [gameState]);

  // Handle app lifecycle (background/foreground) using both Capacitor native events and Web API
  useEffect(() => {
    const stopAppActivity = () => {
      sounds.stopMusic();
      if (gameState === 'PLAYING' && !gameOver && !paused) {
        setPaused(true);
        setDropTime(null);
      }
    };

    // Capacitor listener for native app states
    const subscription = App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        stopAppActivity();
      }
    });

  // Web standard listener for tab switching/minimizing in browsers
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        stopAppActivity();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      subscription.then(unsub => unsub.remove());
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [gameState, gameOver, paused]);

  // Handle Android Back Button conventional behavior
  useEffect(() => {
    const handleBackButton = async () => {
      if (showSettings) {
        setShowSettings(false);
      } else if (showConfirmMenu) {
        setShowConfirmMenu(false);
      } else if (gameState === 'PLAYING') {
        if (gameOver) {
          setGameState('MENU');
          sounds.stopMusic();
        } else if (!paused) {
          // Auto pause on back button press
          setPaused(true);
          setDropTime(null);
          sounds.stopMusic();
        } else {
          // Already paused, show exit confirmation
          setShowConfirmMenu(true);
        }
      } else {
        // Main menu and no overlays -> Exit App
        App.exitApp();
      }
    };

    const subscription = App.addListener('backButton', handleBackButton);

    return () => {
      subscription.then(unsub => unsub.remove());
    };
  }, [gameState, gameOver, paused, showSettings, showConfirmMenu]);

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
      const colorClass = TETROMINOS[type]?.color?.split(' ')[0] || 'bg-white';
      
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

  const fireBullet = () => {
    if (gameOver || paused || gameMode !== 'INVADER') return;
    
    // Turret fires 
    sounds.playTone(400, 'square', 0.1, 0.05);
    
    // Choose bullet type
    const roll = Math.random();
    const type: TetrominoType = roll > 0.95 ? 'BOMB' : (['I', 'J', 'L', 'O', 'S', 'T', 'Z'][Math.floor(Math.random() * 7)] as TetrominoType);

    setBullets(prev => [...prev, {
      id: nextBulletId.current++,
      x: turretXRef.current + 1, // Use synchronized ref to avoid enclosure delay
      y: ROWS - 3,
      type
    }]);
  };

  const generateInvaderRow = () => {
    const gapIndex = Math.floor(Math.random() * COLS);
    return Array(COLS).fill(0).map((_, i) => {
      if (i === gapIndex) return 0;
      const roll = Math.random();
      if (roll > 0.98) return 'CHEST';
      if (roll > 0.93) return 'BOMB';
      if (roll > 0.88) return 'LOCK';
      return (['I', 'J', 'L', 'O', 'S', 'T', 'Z'][Math.floor(Math.random() * 7)] as TetrominoType);
    }) as (TetrominoType | 0)[];
  };

  const handleInvaderTick = () => {
    if (gameOver || paused || gameState !== 'PLAYING') return;

    setGrid(prev => {
      const invaderZone = prev.slice(0, ROWS - 3);
      const turretZone = prev.slice(ROWS - 3);
      
      // Check for lose condition: if the last row of the invader zone has blocks
      if (invaderZone[invaderZone.length - 1].some(cell => cell !== 0)) {
        setGameOver(true);
        setDropTime(null);
        sounds.playGameOver();
        return prev;
      }

      const nextInvaderZone = [...invaderZone.map(r => [...r])];
      nextInvaderZone.pop();
      nextInvaderZone.unshift(generateInvaderRow());
      
      return [...nextInvaderZone, ...turretZone];
    });
  };

  const handleInvaderLanding = (newGrid: (TetrominoType | 0)[][]) => {
    let linesCleared = 0;
    const invaderZone = newGrid.slice(0, ROWS - 3);
    const turretZone = newGrid.slice(ROWS - 3);

    const filteredInvaderZone = invaderZone.filter((row, y) => {
      const isFull = row.every(cell => cell !== 0);
      if (isFull) {
        linesCleared++;
        createExplosion(y, row);
      }
      return !isFull;
    });

    if (linesCleared > 0) {
      // Consistently push back (recede) in Invader Mode:
      // Remove cleared lines and add blanks at the BOTTOM of the zone.
      const blankRows = Array.from({ length: linesCleared }, () => Array(COLS).fill(0));
      const nextInvaderZone = [...filteredInvaderZone, ...blankRows];
      
      setGrid([...nextInvaderZone, ...turretZone]);
      setRows(prev => prev + linesCleared);
      setScore(prev => prev + [0, 40, 100, 300, 1200][linesCleared] * level);
      sounds.playClear();
    } else {
      setGrid(newGrid);
    }
  };

  // Bullet movement and collision handling
  useEffect(() => {
    if (gameMode !== 'INVADER' || gameOver || paused || gameState !== 'PLAYING') return;

    let lastTime = performance.now();
    let frameId: number;

    const update = (currentTime: number) => {
      const deltaTime = currentTime - lastTime;
      // Cap delta time to avoid physics tunneling if there's a long hang
      const dt = Math.min(deltaTime, 33);
      lastTime = currentTime;

      // Speed: ~11 cells per second
      const step = 0.011 * dt;
      
      setBullets(prev => {
        if (prev.length === 0) return prev;
        
        const nextBullets: typeof prev = [];
        const currentGrid = gridRef.current;

        prev.forEach(bullet => {
          const nextY = bullet.y - step; 
          const gy = Math.floor(nextY);
          const gx = Math.floor(bullet.x);

            // Raycast/Step collision: check if it hit a block or reached top
            let hit = false;
            const checkY = Math.floor(nextY); 
            
            if (nextY < 0) {
              hit = true;
              setGrid(currentBoard => {
                const newGrid = currentBoard.map(r => [...r]);
                if (newGrid[0][gx] === 0) {
                  newGrid[0][gx] = bullet.type;
                  setTimeout(() => handleInvaderLanding(newGrid), 0);
                }
                return newGrid;
              });
            } else if (checkY >= 0 && checkY < ROWS && currentGrid[checkY][gx] !== 0) {
              hit = true;
              const targetY = checkY + 1; // Settle in the empty cell just below the hit block (y increases downward)
              
              // Only settle if it's within the invader zone (0 to ROWS-4)
              if (targetY < ROWS - 3) { 
                setGrid(currentBoard => {
                  const newGrid = currentBoard.map(r => [...r]);
                  // Only place if the target cell is actually empty
                  if (newGrid[targetY][gx] === 0) {
                    newGrid[targetY][gx] = bullet.type;
                    setTimeout(() => handleInvaderLanding(newGrid), 0);
                  }
                  return newGrid;
                });
                sounds.playLand();
              }
            }

            if (!hit) {
              nextBullets.push({ ...bullet, y: nextY });
            }
          });

          return nextBullets;
        });
      frameId = requestAnimationFrame(update);
    };

    frameId = requestAnimationFrame(update);

    return () => cancelAnimationFrame(frameId);
  }, [gameMode, gameOver, paused, gameState]);

  const handleLanding = (newGrid: (TetrominoType | 0)[][]) => {
    let linesCleared = 0;
    const finalGrid = newGrid.reduce((acc, row, y) => {
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

    setGrid(finalGrid);
    spawnPiece();
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

  const handleMusicVolumeChange = (values: any) => {
    const val = Array.isArray(values) ? values[0] : values;
    const volNum = parseFloat(val);
    if (!isNaN(volNum) && isFinite(volNum)) {
      const volume = Math.max(0, Math.min(1, volNum / 100));
      setMusicVolume(volume);
      sounds.setMusicVolume(volume);
      localStorage.setItem('cyber-tetris-music-volume', volume.toString());
    }
  };

  const handleSFXVolumeChange = (values: any) => {
    const val = Array.isArray(values) ? values[0] : values;
    const volNum = parseFloat(val);
    if (!isNaN(volNum) && isFinite(volNum)) {
      const volume = Math.max(0, Math.min(1, volNum / 100));
      setSfxVolume(volume);
      sounds.setSFXVolume(volume);
      localStorage.setItem('cyber-tetris-sfx-volume', volume.toString());
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

  const startGame = (mode: 'CLASSIC' | 'TIME_TRIAL' | 'INVADER' = 'CLASSIC') => {
    let initialGrid = createGrid();
    if (mode === 'INVADER') {
      // Fill the first 6 rows with exactly one random gap per row
      for (let y = 0; y < 6; y++) {
        initialGrid[y] = generateInvaderRow();
        // Initialize lock health for initial rows
        initialGrid[y].forEach((type, x) => {
          if (type === 'LOCK') {
            setLockHealth(prev => ({ ...prev, [`${y}-${x}`]: 3 }));
          }
        });
      }
    }
    
    setGrid(initialGrid);
    setGameMode(mode);
    setGameOver(false);
    setScore(0);
    setRows(0);
    setLevel(1);
    setTimeLeft(120);
    setPaused(false);
    setDropTime(1000);
    setBullets([]);
    setTurretX(Math.floor(COLS / 2) - 1);
    recordTriggeredRef.current = false;
    startingHighScoreRef.current = highScores[mode];
    setIsNewRecord(false);
    
    if (mode !== 'INVADER') {
      const firstPiece = RANDOM_TETROMINO();
      const next = RANDOM_TETROMINO();
      setNextPiece(next);
      setActivePiece({ 
        pos: { x: Math.floor(COLS / 2) - 1, y: 0 }, 
        tetromino: firstPiece, 
        collided: false 
      });
    } else {
      setActivePiece(null);
    }
    
    setGameState('PLAYING');
    sounds.startGameMusic(1);
  };

  const createCyberFireworks = () => {
    sounds.playTone(600, 'sine', 0.5, 0.4);
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

    if (!activePiece) return;

    const newPos = { x: activePiece.pos.x, y: activePiece.pos.y + 1 };
    if (!checkCollision(activePiece.tetromino, newPos, grid)) {
      setActivePiece(prev => prev ? { ...prev, pos: newPos } : null);
      if (isManual) sounds.playMove();
    } else {
      // Merge piece into grid
      const newGrid = grid.map(row => [...row]);
      activePiece.tetromino.shape.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value !== 0) {
            const gridY = y + activePiece.pos.y;
            const gridX = x + activePiece.pos.x;
            if (newGrid[gridY]) newGrid[gridY][gridX] = activePiece.tetromino.type;
          }
        });
      });

      handleLanding(newGrid);
    }
  };

  const hardDrop = () => {
    if (!activePiece || gameOver || paused) return;
    let newY = activePiece.pos.y;
    while (!checkCollision(activePiece.tetromino, { x: activePiece.pos.x, y: newY + 1 }, grid)) {
      newY++;
    }
    
    // Merge immediately
    const newGrid = grid.map(row => [...row]);
    activePiece.tetromino.shape.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          const gridY = y + newY;
          const gridX = x + activePiece.pos.x;
          if (newGrid[gridY]) newGrid[gridY][gridX] = activePiece.tetromino.type;
        }
      });
    });

    handleLanding(newGrid);
  };

  // Create actions map that fetches the absolute freshest handler closure from each render
  const actionsMap: Record<RepeatActionType, () => void> = {
    MOVE_LEFT: () => { movePiece({ x: -1, y: 0 }); },
    MOVE_RIGHT: () => { movePiece({ x: 1, y: 0 }); },
    ROTATE: () => { handleRotate(); },
    TURRET_LEFT: () => { setTurretX(prev => Math.max(-1, prev - 1)); sounds.playMove(); },
    TURRET_RIGHT: () => { setTurretX(prev => Math.min(COLS - 2, prev + 1)); sounds.playMove(); },
    FIRE: () => { fireBullet(); },
    HARD_DROP: () => { hardDrop(); }
  };
  actionsMapRef.current = actionsMap;

  // Game Loop
  useInterval(() => {
    if (gameMode === 'INVADER') {
      handleInvaderTick();
    } else {
      drop();
    }
  }, gameMode === 'INVADER' ? (dropTime || 1000) * 5 : dropTime);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameOver) return;
      
      switch(e.key) {
        case 'ArrowLeft':
          if (gameMode === 'INVADER') {
            setTurretX(prev => Math.max(-1, prev - 1));
            sounds.playMove();
          } else {
            movePiece({ x: -1, y: 0 });
          }
          break;
        case 'ArrowRight':
          if (gameMode === 'INVADER') {
            setTurretX(prev => Math.min(COLS - 2, prev + 1));
            sounds.playMove();
          } else {
            movePiece({ x: 1, y: 0 });
          }
          break;
        case 'ArrowDown':
          if (gameMode !== 'INVADER') drop(true);
          break;
        case 'ArrowUp':
          if (gameMode === 'INVADER') {
            fireBullet();
          } else {
            handleRotate();
          }
          break;
        case ' ':
          e.preventDefault();
          if (gameMode === 'INVADER') {
            fireBullet();
          } else {
            hardDrop();
          }
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
    if (gameOver || paused) return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    touchLastRef.current = { x: touch.clientX, y: touch.clientY };
    isMovingRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || !touchLastRef.current || gameOver || paused) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchLastRef.current.x;
    const deltaY = touch.clientY - touchLastRef.current.y;
    
    // Horizontal movement: move piece every 25px displacement
    if (Math.abs(deltaX) > 25) {
      if (gameMode === 'INVADER') {
        setTurretX(prev => {
          const next = prev + (deltaX > 0 ? 1 : -1);
          return Math.max(-1, Math.min(COLS - 2, next));
        });
        sounds.playMove();
      } else if (activePiece) {
        movePiece({ x: deltaX > 0 ? 1 : -1, y: 0 });
      }
      touchLastRef.current.x = touch.clientX;
      isMovingRef.current = true;
    }

    // Vertical movement (Soft Drop): move piece down every 20px displacement
    if (deltaY > 20 && gameMode !== 'INVADER' && activePiece) {
      drop(true);
      touchLastRef.current.y = touch.clientY;
      isMovingRef.current = true;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || gameOver || paused) return;
    const touch = e.changedTouches[0];
    const totalDeltaX = touch.clientX - touchStartRef.current.x;
    const totalDeltaY = touch.clientY - touchStartRef.current.y;

    // Determine action: Tap (minimal movement) -> Rotate or Fire
    if (!isMovingRef.current && Math.abs(totalDeltaX) < 15 && Math.abs(totalDeltaY) < 15) {
      if (gameMode === 'INVADER') {
        fireBullet();
      } else {
        handleRotate();
      }
    } 
    // Downward swipe (large vertical displacement) -> Hard drop
    else if (totalDeltaY > 80 && Math.abs(totalDeltaX) < 60 && gameMode !== 'INVADER') {
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
      {/* Digital Circuit Background with Data Streams */}
      <div className="absolute inset-0 -z-20 bg-[#050505] overflow-hidden">
        {/* Base Circuit Grid */}
        <div className="absolute inset-0 opacity-[0.15] circuit-pattern" />
        
        {/* Animated Data Streams */}
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={`stream-h-${i}`}
            className="absolute h-[1px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-20"
            style={{ 
              top: `${(i * 9) + 4}%`, 
              left: 0, 
              right: 0,
              width: '100px'
            }}
            animate={{ 
              left: ['-20%', '120%'],
            }}
            transition={{ 
              duration: 3 + (i % 4), 
              repeat: Infinity, 
              delay: i * 0.7,
              ease: "linear"
            }}
          />
        ))}

        {[...Array(10)].map((_, i) => (
          <motion.div
            key={`stream-v-${i}`}
            className="absolute w-[1px] bg-gradient-to-b from-transparent via-purple-500 to-transparent opacity-20"
            style={{ 
              left: `${(i * 11) + 5}%`, 
              top: 0, 
              bottom: 0,
              height: '100px'
            }}
            animate={{ 
              top: ['-20%', '120%'],
            }}
            transition={{ 
              duration: 4 + (i % 3), 
              repeat: Infinity, 
              delay: i * 1.2,
              ease: "linear"
            }}
          />
        ))}

        {/* Static decorative joints */}
        {[...Array(20)].map((_, i) => (
          <div 
            key={`joint-${i}`}
            className="circuit-joint"
            style={{ 
              left: `${(Math.sin(i) * 50 + 50)}%`, 
              top: `${(Math.cos(i * 1.3) * 50 + 50)}%` 
            }}
          />
        ))}
      </div>

      {/* Background Ambient Glow */}
      <div className="absolute top-0 left-1/4 w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-cyan-500/10 rounded-full blur-[100px] sm:blur-[120px] -z-10 animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-purple-600/10 rounded-full blur-[100px] sm:blur-[120px] -z-10" />
      
      {/* Background Grid Pattern (Modified to be more subtle with circuit) */}
      <div className="absolute inset-0 -z-20 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      {/* Persistent Global Cyber Framing */}
      <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-cyan-500/10 to-transparent pointer-events-none z-40">
        <div className="absolute top-0 inset-x-0 h-[1px] bg-cyan-500/20" />
        <div className="flex justify-between px-6 pt-2">
          <div className="flex items-center gap-3">
             <div className="w-1 h-3 bg-cyan-400 animate-pulse" />
             <div className="text-[10px] font-mono tracking-[0.4em] text-cyan-400/60 uppercase">System_Active // Port: 8080</div>
          </div>
          <div className="text-[10px] font-mono tracking-[0.2em] text-white/20 uppercase hidden sm:block">Neural_Interface_v0.9.4</div>
        </div>
      </div>

      <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-purple-500/10 to-transparent pointer-events-none z-40">
        <div className="absolute bottom-0 inset-x-0 h-[1px] bg-purple-500/20" />
        <div className="flex justify-between px-6 pb-2 items-end h-full">
          <div className="flex gap-4">
             <div className="flex flex-col gap-1">
                <div className="w-32 h-[1px] bg-white/10" />
                <div className="text-[7px] font-mono text-white/30 tracking-widest uppercase italic">Sub_Relay_042</div>
             </div>
             <div className="flex gap-1 h-3 items-end">
                {[...Array(8)].map((_, i) => (
                  <motion.div 
                    key={i}
                    animate={{ height: [2, 10, 4, 8, 2] }}
                    transition={{ duration: 0.8 + Math.random(), repeat: Infinity, ease: "linear" }}
                    className="w-[1.5px] bg-purple-500/40"
                  />
                ))}
             </div>
          </div>
          <div className="text-[10px] font-mono text-purple-400/40 uppercase tracking-[0.5em] hidden sm:block">Deep_Dive_Sequence</div>
        </div>
      </div>

      {/* Screen Corner Brackets */}
      <div className="absolute top-6 left-6 w-12 h-12 border-t border-l border-white/10 z-30 pointer-events-none" />
      <div className="absolute top-6 right-6 w-12 h-12 border-t border-r border-white/10 z-30 pointer-events-none" />
      <div className="absolute bottom-6 left-6 w-12 h-12 border-b border-l border-white/10 z-30 pointer-events-none" />
      <div className="absolute bottom-6 right-6 w-12 h-12 border-b border-r border-white/10 z-30 pointer-events-none" />

      {/* Subtle Scanlines Overlay */}
      <div className="absolute inset-0 z-30 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />

      <AnimatePresence mode="wait">
        {gameState === 'MENU' ? (
          <motion.div 
            key="menu"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
            className="flex flex-col items-center justify-center z-10 text-center -translate-y-12"
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
                  onClick={() => startGame('INVADER')}
                  className="group relative overflow-hidden bg-transparent border-2 border-green-500/50 hover:border-green-400 text-green-400 px-12 py-8 text-xl font-black uppercase tracking-widest rounded-none transform transition-transform hover:scale-105 active:scale-95"
                >
                  <div className="absolute inset-0 bg-green-500/10 group-hover:bg-green-500/20 transition-colors" />
                  <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-green-400" />
                  <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-green-400" />
                  INVADER MODE
                </Button>

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
              </div>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div 
            key="game"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-row gap-3 sm:gap-6 items-start justify-center w-full max-w-5xl relative px-4 -translate-y-12 sm:-translate-y-16"
          >
            {/* Horizontal Decorative Bars for Game View */}
            <div className="absolute top-[-40px] inset-x-0 flex items-center justify-center pointer-events-none">
              <div className="w-16 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
              <div className="mx-4 text-[9px] font-mono tracking-[0.6em] text-cyan-400/40 font-bold uppercase italic">Neural_Dive_Engaged</div>
              <div className="w-16 h-[1px] bg-gradient-to-l from-transparent via-cyan-400/40 to-transparent" />
            </div>

            {/* Decorative Panel / Control Panel */}
            <div className="absolute bottom-[-135px] sm:bottom-[-150px] inset-x-0">
               <div className="flex gap-2 items-center mb-5 px-6 sm:px-10">
                  <div className="text-[8px] font-mono tracking-[0.3em] text-white/20 uppercase">Security_Protocol_Active</div>
                  <div className="w-1 h-1 rounded-full bg-cyan-500/40 animate-pulse" />
                  <div className="w-full h-[1px] bg-white/5" />
               </div>

               {!gameOver && !paused && (
                 <>
                   {gameMode === 'INVADER' ? (
                     <motion.div 
                       initial={{ opacity: 0, y: 20 }}
                       animate={{ opacity: 1, y: 0 }}
                       className="flex items-center justify-between w-full px-6 sm:px-[60px] md:px-[100px] pointer-events-auto"
                     >
                       {/* Movement Group - Shifted left */}
                       <div className="flex gap-4 sm:gap-8">
                         <Button 
                           onPointerDown={(e) => { e.preventDefault(); startRepeat('TURRET_LEFT'); }}
                           onPointerUp={stopRepeat}
                           onPointerLeave={stopRepeat}
                           onPointerCancel={stopRepeat}
                           variant="outline"
                           className="w-14 h-14 sm:w-24 sm:h-24 rounded-none border-cyan-500/30 bg-cyan-500/5 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-400 active:scale-90 transition-all touch-none shadow-[inset_0_0_20px_rgba(34,211,238,0.05)]"
                         >
                           <ArrowLeft className="h-9 w-9 sm:h-14 sm:w-14" />
                         </Button>
                         <Button 
                           onPointerDown={(e) => { e.preventDefault(); startRepeat('TURRET_RIGHT'); }}
                           onPointerUp={stopRepeat}
                           onPointerLeave={stopRepeat}
                           onPointerCancel={stopRepeat}
                           variant="outline"
                           className="w-14 h-14 sm:w-24 sm:h-24 rounded-none border-cyan-500/30 bg-cyan-500/5 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-400 active:scale-90 transition-all touch-none shadow-[inset_0_0_20px_rgba(34,211,238,0.05)]"
                         >
                           <ArrowRight className="h-9 w-9 sm:h-14 sm:w-14" />
                         </Button>
                       </div>

                       {/* Fire Button - Shifted right */}
                       <Button 
                         onPointerDown={(e) => { e.preventDefault(); startRepeat('FIRE'); }}
                         onPointerUp={stopRepeat}
                         onPointerLeave={stopRepeat}
                         onPointerCancel={stopRepeat}
                         className="px-10 sm:px-16 h-14 sm:h-24 rounded-none bg-cyan-500/20 border-2 border-cyan-400 text-cyan-400 hover:bg-cyan-400 hover:text-black font-black tracking-[0.4em] text-base sm:text-2xl transition-all active:scale-95 shadow-[0_0_30px_rgba(34,211,238,0.3),inset_0_0_20px_rgba(34,211,238,0.1)] touch-none"
                       >
                         FIRE
                       </Button>
                     </motion.div>
                   ) : (
                     <motion.div 
                       initial={{ opacity: 0, y: 20 }}
                       animate={{ opacity: 1, y: 0 }}
                       className="flex items-center justify-between w-full px-6 sm:px-[60px] md:px-[100px] pointer-events-auto"
                     >
                       {/* Movement Group */}
                       <div className="flex gap-4 sm:gap-6">
                         <Button 
                           onPointerDown={(e) => { e.preventDefault(); startRepeat('MOVE_LEFT'); }}
                           onPointerUp={stopRepeat}
                           onPointerLeave={stopRepeat}
                           onPointerCancel={stopRepeat}
                           variant="outline"
                           className="w-14 h-14 sm:w-20 sm:h-20 rounded-none border-cyan-500/30 bg-cyan-500/5 text-cyan-400 hover:border-cyan-400 active:scale-90 transition-all touch-none shadow-[inset_0_0_20px_rgba(34,211,238,0.05)]"
                         >
                           <ArrowLeft className="h-8 w-8 sm:h-12 sm:w-12" />
                         </Button>
                         <Button 
                           onPointerDown={(e) => { e.preventDefault(); startRepeat('MOVE_RIGHT'); }}
                           onPointerUp={stopRepeat}
                           onPointerLeave={stopRepeat}
                           onPointerCancel={stopRepeat}
                           variant="outline"
                           className="w-14 h-14 sm:w-20 sm:h-20 rounded-none border-cyan-500/30 bg-cyan-500/5 text-cyan-400 hover:border-cyan-400 active:scale-90 transition-all touch-none shadow-[inset_0_0_20px_rgba(34,211,238,0.05)]"
                         >
                           <ArrowRight className="h-8 w-8 sm:h-12 sm:w-12" />
                         </Button>
                       </div>

                       {/* Action Group */}
                       <div className="flex gap-3 sm:gap-6">
                         <Button 
                           onPointerDown={(e) => { e.preventDefault(); startRepeat('ROTATE'); }}
                           onPointerUp={stopRepeat}
                           onPointerLeave={stopRepeat}
                           onPointerCancel={stopRepeat}
                           variant="outline"
                           className="w-14 h-14 sm:w-20 sm:h-20 rounded-none border-purple-500/30 bg-purple-500/5 text-purple-400 hover:border-purple-400 active:scale-90 transition-all touch-none shadow-[inset_0_0_20px_rgba(168,85,247,0.05)]"
                         >
                           <RotateCcw className="h-8 w-8 sm:h-12 sm:w-12" />
                         </Button>
                         <Button 
                           onPointerDown={(e) => { e.preventDefault(); startRepeat('HARD_DROP'); }}
                           onPointerUp={stopRepeat}
                           onPointerLeave={stopRepeat}
                           onPointerCancel={stopRepeat}
                           variant="outline"
                           className="w-14 h-14 sm:w-20 sm:h-20 rounded-none border-yellow-500/30 bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 active:scale-90 transition-all touch-none shadow-[inset_0_0_20px_rgba(234,179,8,0.05)]"
                         >
                           <ChevronsDown className="h-8 w-8 sm:h-12 sm:w-12" />
                         </Button>
                       </div>
                     </motion.div>
                   )}
                 </>
               )}
            </div>

            {/* Left Decor: Vertical Scanning Line */}
            <div className="absolute -left-20 top-0 bottom-0 w-[1px] bg-white/5 hidden xl:block">
               <motion.div 
                 animate={{ top: ['0%', '100%'] }}
                 transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                 className="absolute top-0 left-0 w-full h-12 bg-gradient-to-b from-transparent via-cyan-500 to-transparent"
               />
               <div className="absolute top-1/2 -translate-y-1/2 -left-4 text-[8px] font-mono vertical-rl rotate-180 uppercase tracking-widest text-white/10">PERIPHERAL_SYNC</div>
            </div>

            {/* Right Decor */}
            <div className="absolute -right-20 top-0 bottom-0 w-[1px] bg-white/5 hidden xl:block">
               <motion.div 
                 animate={{ top: ['100%', '0%'] }}
                 transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                 className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-transparent via-purple-500/30 to-transparent"
               />
               <div className="absolute top-1/2 -translate-y-1/2 -right-4 text-[8px] font-mono vertical-rl uppercase tracking-widest text-white/10">BUFFER_v.9.9.2</div>
            </div>

            {/* Left: Game Area */}
            <div className="flex flex-col items-center">
              <div className="relative group origin-center">
                {/* Double Neon Frame Effect (Outside Play Area) */}
                {/* Outer Frame - Brightest */}
                <div className="absolute -inset-[10px] border-2 border-cyan-400/90 rounded-xl pointer-events-none shadow-[0_0_25px_rgba(34,211,238,0.5),inset_0_0_10px_rgba(34,211,238,0.2)]" />
                
                {/* Middle Frame */}
                <div className="absolute -inset-[6px] border border-cyan-500/60 rounded-lg pointer-events-none shadow-[0_0_15px_rgba(34,211,238,0.3)]" />
                
                {/* Inner Frame - Faintest */}
                <div className="absolute -inset-[2px] border border-cyan-600/30 rounded-md pointer-events-none" />
                
                <div 
                  ref={gameBoardRef}
                  className="relative bg-[#050a24] overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.9)] touch-none"
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
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(50,130,184,0.3)_1px,transparent_1px),linear-gradient(90deg,rgba(50,130,184,0.3)_1px,transparent_1px)]" style={{ backgroundSize: `${cellSize}px ${cellSize}px` }} />

                  {/* Settled Blocks */}
                  {grid.map((row, y) => (
                    <React.Fragment key={`row-${y}`}>
                      {row.map((type, x) => {
                        if (type === 0) return null;
                        const tetromino = TETROMINOS[type];
                        return (
                          <div 
                            key={`settled-${y}-${x}`}
                            className={`absolute border-2 rounded-none ${tetromino.color}`}
                            style={{ 
                              top: y * cellSize + 1, 
                              left: x * cellSize + 1, 
                              width: cellSize - 2, 
                              height: cellSize - 2
                            }}
                          />
                        );
                      })}
                    </React.Fragment>
                  ))}

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

                  {/* Ghost Piece */}
                  {activePiece && ghostPos && !gameOver && !paused && gameMode !== 'INVADER' && (
                    <React.Fragment key="ghost-container">
                      {activePiece.tetromino.shape.map((row, y) => (
                        <React.Fragment key={`ghost-row-${y}`}>
                          {row.map((value, x) => {
                            if (value === 0) return null;
                            const borderColorClass = activePiece.tetromino.color.split(' ')[0]; // first class is border-...
                            return (
                              <div 
                                key={`ghost-cell-${y}-${x}`}
                                className={`absolute border-2 border-dashed ${borderColorClass} opacity-40 rounded-none bg-white/5 shadow-[inset_0_0_4px_rgba(255,255,255,0.1)]`}
                                style={{ 
                                  top: (y + ghostPos.y) * cellSize + 1, 
                                  left: (x + ghostPos.x) * cellSize + 1,
                                  width: cellSize - 2, height: cellSize - 2
                                }}
                              />
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </React.Fragment>
                  )}

                  {/* Active Piece */}
                  {activePiece && !gameOver && !paused && gameMode !== 'INVADER' && (
                    <React.Fragment key="active-container">
                      {activePiece.tetromino.shape.map((row, y) => (
                        <React.Fragment key={`active-row-${y}`}>
                          {row.map((value, x) => {
                            if (value === 0) return null;
                            return (
                              <motion.div 
                                key={`active-cell-${activePiece.pos.x}-${activePiece.pos.y}-${y}-${x}`}
                                className={`absolute border-2 rounded-none ${activePiece.tetromino.color}`}
                                style={{ 
                                  top: (y + activePiece.pos.y) * cellSize + 1, 
                                  left: (x + activePiece.pos.x) * cellSize + 1,
                                  width: cellSize - 2, 
                                  height: cellSize - 2,
                                }}
                              />
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </React.Fragment>
                  )}

                  {/* Invader Mode: Turret & Bullets */}
                  {gameMode === 'INVADER' && !gameOver && !paused && (
                    <>
                      {/* Bullets */}
                      {bullets.map(bullet => (
                        <motion.div 
                          key={`bullet-${bullet.id}`}
                          className={`absolute ${TETROMINOS[bullet.type].color} border shadow-[0_0_10px_rgba(255,255,255,0.5)]`}
                          style={{
                            left: bullet.x * cellSize + 1,
                            top: bullet.y * cellSize + 1,
                            width: cellSize - 2,
                            height: cellSize - 2,
                          }}
                        />
                      ))}
                      
                      {/* Turret */}
                      <div className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ height: cellSize * 2 }}>
                        {/* Base */}
                        <div 
                          className="absolute bg-cyan-500 shadow-[0_0_15px_#22d3ee] border border-cyan-300 transition-all duration-75"
                          style={{ 
                            left: turretX * cellSize, 
                            bottom: 0, 
                            width: cellSize * 3, 
                            height: cellSize,
                            borderRadius: '4px 4px 0 0'
                          }} 
                        />
                        {/* Gun Head */}
                        <div 
                          className="absolute bg-cyan-400 shadow-[0_0_15px_#22d3ee] border border-cyan-200 transition-all duration-75"
                          style={{ 
                            left: (turretX + 1) * cellSize, 
                            bottom: cellSize, 
                            width: cellSize, 
                            height: cellSize,
                            borderRadius: '4px 4px 0 0'
                          }} 
                        />
                      </div>
                    </>
                  )}

                  {/* Particles */}
                  {particles.map(p => (
                    <div 
                      key={`particle-${p.id}`}
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
                              localStorage.removeItem('cyber-tetris-saved-session');
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

                    {showRewardDialog && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="absolute inset-0 z-[65] flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
                      >
                        <div className="bg-[#050a24] border-2 border-cyan-400 p-6 rounded-none shadow-[0_0_30px_rgba(34,211,238,0.4)] max-w-xs w-full text-center">
                          <div className="flex justify-center mb-4">
                             <div className="w-12 h-12 rounded-full bg-yellow-500/20 border-2 border-yellow-500 flex items-center justify-center shadow-[0_0_15px_#eab308]">
                                <Trophy className="text-yellow-500 h-6 w-6" />
                             </div>
                          </div>
                          <h3 className="text-cyan-400 font-black text-xl mb-1 italic tracking-tighter uppercase">Treasure Unlocked</h3>
                          <p className="text-[10px] text-white/40 mb-6 font-mono uppercase tracking-widest">Select your enhancement</p>
                          <div className="flex flex-col gap-3">
                            {rewardChoices.map((choice) => (
                              <Button 
                                key={choice}
                                onClick={() => {
                                  if (choice === '+500 SCORE') setScore(s => s + 500);
                                  if (choice === 'LEVEL DOWN') setLevel(l => Math.max(1, l - 1));
                                  if (choice === 'BOOST') setScore(s => Math.floor(s * 1.2));
                                  setShowRewardDialog(false);
                                  setPaused(false);
                                  sounds.playTone(600, 'sine', 0.2, 0.2);
                                }}
                                variant="outline"
                                className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-400 rounded-none uppercase font-mono text-[10px] h-10 tracking-widest group"
                              >
                                <span className="group-hover:animate-pulse">{choice}</span>
                              </Button>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Right: Scoreboard & Next Piece */}
            <div className="flex flex-col gap-2 w-[95px] sm:w-[170px] h-full max-h-[100%]">
              {/* Next Piece Card */}
              {gameMode !== 'INVADER' && (
                <Card className="bg-[#050a24]/60 border-white/10 backdrop-blur-md">
                  <CardHeader className="p-1 sm:p-2">
                    <CardTitle className="text-[10px] uppercase tracking-wide text-white/40 font-mono text-center">Next</CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center justify-center h-20 p-0 pb-1">
                    <div className="relative" style={{ width: 60, height: 60 }}>
                      {nextPiece.shape.map((row, y) => (
                        <React.Fragment key={`next-row-${y}`}>
                          {row.map((value, x) => {
                            if (value === 0) return null;
                            return (
                              <div 
                                key={`next-cell-${y}-${x}`}
                                className={`absolute border rounded-none ${nextPiece.color}`}
                                style={{ 
                                  width: 15,
                                  height: 15,
                                  top: y * 16 + (nextPiece.type === 'I' ? 10 : 15), 
                                  left: x * 16 + (nextPiece.type === 'I' ? 0 : 7),
                                }}
                              />
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Stats Card */}
              <Card className="bg-[#050a24]/60 border-white/10 backdrop-blur-md overflow-hidden flex-1 max-h-[240px]">
                <CardContent className="p-2 sm:p-3 space-y-3 sm:space-y-4">
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

                  <div className="space-y-2 pt-2 border-t border-white/5">
                    <div className="flex justify-between items-center text-[9px] font-mono">
                      <span className="uppercase text-white/30">Neural Level</span>
                      <span className="font-bold text-white leading-none">{level}</span>
                    </div>
                    <div className="flex justify-between items-center text-[9px] font-mono">
                      <span className="uppercase text-white/30">{gameMode === 'INVADER' ? 'Neural Hits' : 'Blocks Linked'}</span>
                      <span className="font-bold text-white leading-none">{rows}</span>
                    </div>
                  </div>

                  <div className="pt-1">
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
                      className="w-full h-8 border border-white/5 bg-white/5 hover:bg-white/10 text-white/60 text-[9px] uppercase tracking-tighter font-mono flex items-center justify-center gap-1"
                    >
                      {paused ? <Play className="h-3 w-3 fill-current" /> : <Pause className="h-3 w-3 fill-current" />}
                      <span>{paused ? 'Resume' : 'Pause'}</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isNewRecord && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.5 }}
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center pointer-events-none"
          >
            <motion.div 
              initial={{ y: 50 }}
              animate={{ y: 0 }}
              exit={{ y: -50 }}
              className="bg-cyan-500/20 backdrop-blur-xl border-2 border-cyan-400 px-12 py-6 rounded-none skew-x-[-12deg] shadow-[0_0_50px_rgba(34,211,238,0.6)] relative"
            >
              <div className="absolute -top-2 -left-2 w-4 h-4 border-t-2 border-l-2 border-cyan-400" />
              <div className="absolute -bottom-2 -right-2 w-4 h-4 border-b-2 border-r-2 border-cyan-400" />
              
              <h1 className="text-4xl sm:text-6xl font-black text-cyan-400 tracking-[0.4em] italic uppercase leading-none drop-shadow-[0_0_15px_rgba(34,211,238,1)] animate-pulse text-center">
                New Record!
              </h1>
              <p className="text-cyan-300/60 font-mono text-xs tracking-[0.5em] uppercase mt-4 text-center">Neural Link Synchronized</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Neural Link Recovery Overlay */}
      <AnimatePresence>
        {sessionToRestore && gameState === 'MENU' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -15 }}
              className="relative border-2 border-cyan-400 bg-cyan-950/40 p-6 sm:p-8 max-w-sm sm:max-w-md w-full shadow-[0_0_40px_rgba(34,211,238,0.3)] text-left"
            >
              {/* Decorative cyber corners */}
              <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-400" />
              <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-400" />
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-cyan-400" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyan-400" />

              <h3 className="text-cyan-400 font-black text-xl sm:text-2xl tracking-widest uppercase italic mb-3 flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-cyan-400 animate-ping rounded-full" />
                NEURAL RESTORE DETECTED
              </h3>
              
              <p className="text-white/80 text-xs sm:text-sm font-mono mb-5 leading-relaxed">
                A suspended link was cloned from the local network memory core. Synchronize now or overwrite slot?
              </p>

              <div className="p-3 bg-cyan-950/30 border border-cyan-500/20 rounded-sm text-xs space-y-2 mb-6 font-mono text-cyan-200">
                <div className="flex justify-between border-b border-cyan-500/10 pb-1">
                  <span className="text-cyan-400/60 uppercase">System Mode:</span> 
                  <span className="font-bold text-cyan-300">{sessionToRestore.gameMode}</span>
                </div>
                <div className="flex justify-between border-b border-cyan-500/10 pb-1">
                  <span className="text-cyan-400/60 uppercase">Sync Level:</span> 
                  <span className="font-bold text-cyan-300">LV.{sessionToRestore.level}</span>
                </div>
                <div className="flex justify-between border-b border-cyan-500/10 pb-1">
                  <span className="text-cyan-400/60 uppercase">Buffer Score:</span> 
                  <span className="font-bold text-cyan-300">{sessionToRestore.score}</span>
                </div>
                {sessionToRestore.gameMode === 'TIME_TRIAL' && (
                  <div className="flex justify-between">
                    <span className="text-cyan-400/60 uppercase">Time Left:</span> 
                    <span className="font-bold text-cyan-300">{sessionToRestore.timeLeft}s</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <Button
                  onClick={() => {
                    const s = sessionToRestore;
                    setGameMode(s.gameMode);
                    setGrid(s.grid);
                    setTimeLeft(s.timeLeft);
                    setActivePiece(s.activePiece);
                    setNextPiece(s.nextPiece);
                    setScore(s.score);
                    setRows(s.rows);
                    setLevel(s.level);
                    setLockHealth(s.lockHealth || {});
                    setTurretX(s.turretX !== undefined ? s.turretX : Math.floor(COLS / 2) - 1);
                    setBullets(s.bullets || []);
                    setGameOver(false);
                    setPaused(true); // Pause it on loading so they aren't caught off guard!
                    setDropTime(null);
                    setGameState('PLAYING');
                    setSessionToRestore(null);
                    sounds.playTone(600, 'sine', 0.2, 0.2);
                    if (musicEnabled) {
                      sounds.startGameMusic(s.level);
                    }
                  }}
                  className="w-full h-12 bg-cyan-400 hover:bg-cyan-300 text-black font-black uppercase rounded-none tracking-widest text-xs border border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.4)] transition-all cursor-pointer"
                >
                  [ RECONNECT LINK ]
                </Button>

                <Button
                  onClick={() => {
                    localStorage.removeItem('cyber-tetris-saved-session');
                    setSessionToRestore(null);
                    sounds.playTone(150, 'sawtooth', 0.2, 0.3);
                  }}
                  variant="outline"
                  className="w-full h-11 border-red-500/50 hover:border-red-500 hover:bg-red-500/10 text-red-400 bg-transparent font-black uppercase rounded-none tracking-widest text-[10px] mt-1 transition-all"
                >
                  [ OVERWRITE SLOT ]
                </Button>
              </div>
            </motion.div>
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
                {/* SFX Toggle */}
                <div className="space-y-4">
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
                  {sfxEnabled && (
                    <div className="px-1 pt-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-mono text-white/20 uppercase tracking-widest">Effect Volume</span>
                        <span className="text-[9px] font-mono text-cyan-500/50">{Math.round(sfxVolume * 100)}%</span>
                      </div>
                      <Slider 
                        value={[isNaN(sfxVolume) ? 100 : sfxVolume * 100]} 
                        onValueChange={handleSFXVolumeChange}
                        max={100} 
                        step={1}
                        className="[&_[data-slot=slider-range]]:bg-cyan-500/50"
                      />
                    </div>
                  )}
                </div>

                {/* Music Toggle */}
                <div className="space-y-4">
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
                  {musicEnabled && (
                    <div className="px-1 pt-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-mono text-white/20 uppercase tracking-widest">Master Volume</span>
                        <span className="text-[9px] font-mono text-purple-500/50">{Math.round(musicVolume * 100)}%</span>
                      </div>
                      <Slider 
                        value={[isNaN(musicVolume) ? 50 : musicVolume * 100]} 
                        onValueChange={handleMusicVolumeChange}
                        max={100} 
                        step={1}
                        className="[&_[data-slot=slider-range]]:bg-purple-500/50"
                      />
                    </div>
                  )}
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
