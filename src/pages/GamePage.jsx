import { useState, useEffect, useCallback } from 'react';
import { GameContainer } from '@/components/game/GameContainer';
import { EventBus } from '@/game/EventBus';
import { base44 } from '@/api/base44Client';
import { HEROES, DIFFICULTIES, LEVELS, SUBLEVELS_PER_LEVEL } from '@/game/config';

export default function GamePage() {
  const [phase, setPhase] = useState('menu');
  const [hero, setHero] = useState('fufuruco');
  const [difficulty, setDifficulty] = useState('medium');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [health, setHealth] = useState(3);
  const [maxHealth, setMaxHealth] = useState(3);
  const [level, setLevel] = useState(1);
  const [subLevel, setSubLevel] = useState(1);
  const [levelName, setLevelName] = useState('');
  const [isBoss, setIsBoss] = useState(false);
  const [bossHealth, setBossHealth] = useState(0);
  const [bossMaxHealth, setBossMaxHealth] = useState(0);
  const [bossName, setBossName] = useState('');
  const [progress, setProgress] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [savedProgress, setSavedProgress] = useState(null);

  // Load save
  useEffect(() => {
    const load = async () => {
      try {
        const records = await base44.entities.GameProgress.list('-updated_date', 1);
        if (records.length > 0) {
          setSavedProgress(records[0]);
          setHighScore(records[0].high_score || 0);
        }
      } catch (e) { /* no save */ }
    };
    load();
  }, []);

  // EventBus subscriptions
  useEffect(() => {
    const handlers = {
      'game-init': (d) => {
        setScore(d.score); setLives(d.lives); setHealth(d.health);
        setMaxHealth(d.maxHealth || 3); setLevel(d.level);
        setSubLevel(d.subLevel); setLevelName(d.levelName);
        setIsBoss(d.isBoss); setProgress(0); setPhase('playing');
      },
      'score-changed': (s) => setScore(s),
      'health-changed': (d) => { setHealth(d.health); setMaxHealth(d.maxHealth); },
      'lives-changed': (l) => setLives(l),
      'level-complete': (d) => { setScore(d.score); setLives(d.lives); setPhase('level-complete'); },
      'game-over': (d) => { setScore(d.score); setPhase('game-over'); saveHighScore(d.score); },
      'game-won': (d) => { setScore(d.score); setPhase('victory'); saveHighScore(d.score); },
      'boss-appeared': (d) => {
        setIsBoss(true); setBossHealth(d.health);
        setBossMaxHealth(d.maxHealth); setBossName(d.name);
      },
      'boss-health-changed': (d) => setBossHealth(d.health),
      'progress-changed': (p) => setProgress(p),
    };
    Object.entries(handlers).forEach(([k, fn]) => EventBus.on(k, fn));
    return () => Object.entries(handlers).forEach(([k, fn]) => EventBus.off(k, fn));
  }, []);

  // Keyboard pause
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (phase === 'playing') { setPhase('paused'); EventBus.emit('pause-game'); }
        else if (phase === 'paused') { setPhase('playing'); EventBus.emit('resume-game'); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase]);

  const saveHighScore = async (s) => {
    try {
      const records = await base44.entities.GameProgress.list('-updated_date', 1);
      const newHigh = Math.max(highScore, s);
      if (records.length > 0) {
        await base44.entities.GameProgress.update(records[0].id, { high_score: Math.max(records[0].high_score || 0, s) });
      } else {
        await base44.entities.GameProgress.create({ high_score: s, difficulty, hero, level_reached: 1, sublevel_reached: 1 });
      }
      setHighScore(newHigh);
    } catch (e) { /* ignore */ }
  };

  const saveProgress = async (newLevel, newSubLevel) => {
    try {
      const records = await base44.entities.GameProgress.list('-updated_date', 1);
      if (records.length > 0) {
        const r = records[0];
        await base44.entities.GameProgress.update(r.id, {
          level_reached: Math.max(r.level_reached || 1, newLevel),
          sublevel_reached: Math.max(r.sublevel_reached || 1, newSubLevel),
          high_score: Math.max(r.high_score || 0, score),
          difficulty, hero,
        });
      } else {
        await base44.entities.GameProgress.create({
          level_reached: newLevel, sublevel_reached: newSubLevel,
          high_score: score, difficulty, hero,
        });
      }
    } catch (e) { /* ignore */ }
  };

  const startGame = useCallback((levelIdx = 0, subIdx = 0, scoreVal = 0, livesVal = null) => {
    const lv = livesVal ?? DIFFICULTIES[difficulty].playerLives;
    EventBus.emit('start-game', {
      levelIndex: levelIdx, subLevelIndex: subIdx,
      difficulty, hero, score: scoreVal, lives: lv,
    });
  }, [difficulty, hero]);

  const nextSubLevel = () => {
    const nextSub = subLevel;
    let nextLvl = level - 1;
    if (nextSub >= SUBLEVELS_PER_LEVEL) {
      nextLvl = level;
      if (nextLvl >= LEVELS.length) return;
      saveProgress(nextLvl + 1, 1);
      startGame(nextLvl, 0, score, lives);
    } else {
      saveProgress(level, nextSub + 1);
      startGame(level - 1, nextSub, score, lives);
    }
  };

  const retryLevel = () => {
    startGame(level - 1, subLevel - 1, 0, null);
  };

  const quitToMenu = () => {
    setPhase('menu');
    EventBus.emit('pause-game');
  };

  const touchCtrl = (action, pressed) => {
    EventBus.emit('touch-control', { action, pressed });
  };

  return (
    <main className="game-page bg-black">
      <div className="game-frame">
        <GameContainer />
        <div className="absolute inset-0 pointer-events-none select-none" style={{ fontFamily: "'Press Start 2P', monospace" }}>

          {/* ====== MENU ====== */}
          {phase === 'menu' && (
            <div className="absolute inset-0 pointer-events-auto flex flex-col items-center justify-center bg-gradient-to-b from-black via-purple-950/80 to-black overflow-y-auto py-8">
              <div className="text-center mb-6">
                <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-yellow-400 tracking-wider mb-2 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]">
                  FUFURUCO <span className="text-red-500">&</span> LULO
                </h1>
                <p className="text-xs sm:text-sm text-cyan-400 tracking-widest">ACCIÓN DE COMBATE</p>
                <p className="text-[8px] sm:text-[10px] text-gray-500 mt-1">10 NIVELES · 8 SUBNIVELES · 3 DIFICULTADES</p>
                {highScore > 0 && <p className="text-[10px] text-yellow-600 mt-2">RÉCORD: {highScore.toLocaleString()}</p>}
              </div>

              {/* Hero selection */}
              <div className="flex gap-3 sm:gap-6 mb-6">
                {Object.entries(HEROES).map(([key, h]) => (
                  <button
                    key={key}
                    onClick={() => setHero(key)}
                    className={`pointer-events-auto p-3 sm:p-4 border-2 transition-all w-32 sm:w-44 ${
                      hero === key
                        ? 'border-yellow-400 bg-yellow-400/10 scale-105'
                        : 'border-gray-700 bg-gray-900/50 opacity-60'
                    }`}
                  >
                    <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-2 bg-gradient-to-b from-green-700 to-green-900 rounded-sm flex items-center justify-center text-xl sm:text-2xl">
                      {key === 'fufuruco' ? '🟢' : '🔵'}
                    </div>
                    <div className={`text-xs sm:text-sm font-bold ${hero === key ? 'text-yellow-400' : 'text-gray-400'}`}>{h.name}</div>
                    <div className="text-[7px] sm:text-[9px] text-gray-500 mt-1 leading-tight">{h.description}</div>
                    <div className="text-[7px] sm:text-[9px] text-gray-400 mt-2 space-y-0.5">
                      <div>VEL: {'★'.repeat(Math.round(h.speed/50))}</div>
                      <div>VIDA: {'♥'.repeat(h.health)}</div>
                      <div>CAD: {'⚡'.repeat(Math.round(300/h.fireRate))}</div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Difficulty */}
              <div className="flex gap-2 sm:gap-3 mb-6">
                {Object.entries(DIFFICULTIES).map(([key, d]) => (
                  <button
                    key={key}
                    onClick={() => setDifficulty(key)}
                    className={`pointer-events-auto px-4 sm:px-6 py-2 sm:py-3 border-2 transition-all text-[10px] sm:text-xs ${
                      difficulty === key
                        ? key === 'easy' ? 'border-green-400 bg-green-400/10 text-green-400'
                          : key === 'medium' ? 'border-yellow-400 bg-yellow-400/10 text-yellow-400'
                          : 'border-red-400 bg-red-400/10 text-red-400'
                        : 'border-gray-700 text-gray-500 opacity-60'
                    }`}
                  >
                    {d.name}
                    <div className="text-[7px] mt-1 opacity-70">{d.playerLives} vidas</div>
                  </button>
                ))}
              </div>

              {/* Start / Continue */}
              <div className="flex flex-col gap-2 items-center">
                <button
                  onClick={() => startGame(0, 0, 0, null)}
                  className="pointer-events-auto px-8 sm:px-12 py-3 sm:py-4 bg-red-600 hover:bg-red-500 text-white text-sm sm:text-lg border-2 border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-all hover:scale-105"
                >
                  ▶ NUEVA MISIÓN
                </button>
                {savedProgress && savedProgress.level_reached > 1 && (
                  <button
                    onClick={() => startGame(savedProgress.level_reached - 1, savedProgress.sublevel_reached - 1, 0, null)}
                    className="pointer-events-auto px-6 py-2 bg-cyan-700 hover:bg-cyan-600 text-cyan-100 text-[10px] sm:text-xs border-2 border-cyan-400 transition-all hover:scale-105"
                  >
                    CONTINUAR · NIVEL {savedProgress.level_reached}-{savedProgress.sublevel_reached}
                  </button>
                )}
              </div>

              <div className="mt-6 text-center text-[7px] sm:text-[9px] text-gray-600 space-y-1">
                <div>TECLAS: ←→ MOVER · ↑ SALTAR · ↓ AGACHARSE · Z DISPARAR</div>
                <div>MÓVIL: BOTONES EN PANTALLA · ESC PAUSA</div>
              </div>
            </div>
          )}

          {/* ====== PLAYING HUD ====== */}
          {(phase === 'playing' || phase === 'paused') && (
            <>
              {/* Top bar */}
              <div className="absolute top-0 left-0 right-0 flex justify-between items-start p-2 sm:p-3">
                {/* Left: health + lives */}
                <div className="flex flex-col gap-1">
                  <div className="flex gap-1">
                    {Array.from({ length: maxHealth }).map((_, i) => (
                      <span key={i} className={`text-sm sm:text-lg ${i < health ? 'text-red-500' : 'text-gray-700'}`}>♥</span>
                    ))}
                  </div>
                  <div className="text-[8px] sm:text-[10px] text-yellow-400">VIDAS: {lives}</div>
                </div>

                {/* Center: level info */}
                <div className="text-center">
                  <div className="text-[10px] sm:text-sm text-white font-bold">{levelName}</div>
                  <div className="text-[8px] sm:text-[10px] text-cyan-400">NIVEL {level}-{subLevel}</div>
                </div>

                {/* Right: score + pause */}
                <div className="flex flex-col items-end gap-1">
                  <div className="text-[10px] sm:text-sm text-yellow-400">{score.toLocaleString().padStart(6, '0')}</div>
                  <button
                    onClick={() => { setPhase('paused'); EventBus.emit('pause-game'); }}
                    className="pointer-events-auto text-[8px] sm:text-[10px] text-gray-400 hover:text-white border border-gray-700 px-2 py-1"
                  >
                    ❚❚
                  </button>
                </div>
              </div>

              {/* Boss health bar */}
              {isBoss && bossMaxHealth > 0 && (
                <div className="absolute top-14 sm:top-16 left-1/2 -translate-x-1/2 w-[80%] max-w-lg">
                  <div className="text-center text-[8px] sm:text-[10px] text-red-500 mb-1 font-bold">{bossName}</div>
                  <div className="h-3 sm:h-4 bg-gray-900 border border-red-800">
                    <div
                      className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all"
                      style={{ width: `${(bossHealth / bossMaxHealth) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Progress bar */}
              {!isBoss && (
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-[60%] max-w-md">
                  <div className="h-2 bg-gray-900 border border-gray-700">
                    <div className="h-full bg-gradient-to-r from-cyan-500 to-green-400 transition-all" style={{ width: `${progress * 100}%` }} />
                  </div>
                </div>
              )}

              {/* Touch controls */}
              {phase === 'playing' && (
                <>
                  <div className="absolute bottom-3 left-3 flex gap-2 items-end">
                    <TouchBtn onDown={() => touchCtrl('left', true)} onUp={() => touchCtrl('left', false)} className="w-14 h-14 sm:w-16 sm:h-16 text-xl bg-gray-900/60 border-2 border-gray-600 text-white">◀</TouchBtn>
                    <TouchBtn onDown={() => touchCtrl('right', true)} onUp={() => touchCtrl('right', false)} className="w-14 h-14 sm:w-16 sm:h-16 text-xl bg-gray-900/60 border-2 border-gray-600 text-white">▶</TouchBtn>
                    <TouchBtn onDown={() => touchCtrl('duck', true)} onUp={() => touchCtrl('duck', false)} className="w-12 h-12 sm:w-14 sm:h-14 text-sm bg-gray-900/60 border-2 border-gray-600 text-white">▼</TouchBtn>
                  </div>
                  <div className="absolute bottom-3 right-3 flex gap-2 items-end">
                    <TouchBtn onDown={() => touchCtrl('shoot', true)} onUp={() => touchCtrl('shoot', false)} className="w-14 h-14 sm:w-16 sm:h-16 text-xs bg-red-900/60 border-2 border-red-500 text-red-200">🔥</TouchBtn>
                    <TouchBtn onDown={() => touchCtrl('jump', true)} onUp={() => touchCtrl('jump', false)} className="w-16 h-16 sm:w-20 sm:h-20 text-sm bg-cyan-900/60 border-2 border-cyan-500 text-cyan-200">⬆</TouchBtn>
                  </div>
                </>
              )}

              {/* Pause overlay */}
              {phase === 'paused' && (
                <div className="absolute inset-0 pointer-events-auto flex flex-col items-center justify-center bg-black/80">
                  <h2 className="text-lg sm:text-2xl text-white mb-6">PAUSA</h2>
                  <div className="flex flex-col gap-3">
                    <button onClick={() => { setPhase('playing'); EventBus.emit('resume-game'); }} className="px-8 py-3 bg-green-700 hover:bg-green-600 text-white text-xs border-2 border-green-400">CONTINUAR</button>
                    <button onClick={retryLevel} className="px-8 py-3 bg-yellow-700 hover:bg-yellow-600 text-white text-xs border-2 border-yellow-400">REINICIAR</button>
                    <button onClick={quitToMenu} className="px-8 py-3 bg-red-700 hover:bg-red-600 text-white text-xs border-2 border-red-400">SALIR AL MENÚ</button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ====== LEVEL COMPLETE ====== */}
          {phase === 'level-complete' && (
            <div className="absolute inset-0 pointer-events-auto flex flex-col items-center justify-center bg-black/85">
              <h2 className="text-xl sm:text-3xl text-green-400 mb-2">SUBNIVEL COMPLETO</h2>
              <div className="text-sm text-white mb-1">{levelName} · {level}-{subLevel}</div>
              <div className="text-[10px] text-yellow-400 mb-1">PUNTAJE: {score.toLocaleString()}</div>
              <div className="text-[10px] text-cyan-400 mb-1">VIDAS: {lives}</div>
              <div className="text-[8px] text-gray-500 mb-6">+500 BONUS</div>
              <button onClick={nextSubLevel} className="px-10 py-3 bg-green-600 hover:bg-green-500 text-white text-xs border-2 border-green-400">
                {subLevel >= SUBLEVELS_PER_LEVEL && level < LEVELS.length ? 'SIGUIENTE NIVEL →' : 'CONTINUAR →'}
              </button>
            </div>
          )}

          {/* ====== GAME OVER ====== */}
          {phase === 'game-over' && (
            <div className="absolute inset-0 pointer-events-auto flex flex-col items-center justify-center bg-black/85">
              <h2 className="text-2xl sm:text-4xl text-red-500 mb-4">GAME OVER</h2>
              <div className="text-sm text-yellow-400 mb-1">PUNTAJE: {score.toLocaleString()}</div>
              <div className="text-[10px] text-gray-500 mb-6">{levelName} · NIVEL {level}-{subLevel}</div>
              <div className="flex flex-col gap-3">
                <button onClick={retryLevel} className="px-10 py-3 bg-red-600 hover:bg-red-500 text-white text-xs border-2 border-red-400">REINTENTAR</button>
                <button onClick={() => setPhase('menu')} className="px-10 py-3 bg-gray-700 hover:bg-gray-600 text-white text-xs border-2 border-gray-500">MENÚ</button>
              </div>
            </div>
          )}

          {/* ====== VICTORY ====== */}
          {phase === 'victory' && (
            <div className="absolute inset-0 pointer-events-auto flex flex-col items-center justify-center bg-gradient-to-b from-yellow-950 via-black to-black">
              <h2 className="text-2xl sm:text-4xl text-yellow-400 mb-4 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]">¡VICTORIA!</h2>
              <p className="text-[10px] sm:text-sm text-cyan-400 mb-2 text-center px-4">Has derrotado al Cerebro Alien Supremo<br/>y salvado el mundo con {HEROES[hero].name}!</p>
              <div className="text-sm text-yellow-400 mb-1">PUNTAJE FINAL: {score.toLocaleString()}</div>
              <div className="text-[10px] text-gray-500 mb-6">Dificultad: {DIFFICULTIES[difficulty].name}</div>
              <button onClick={() => setPhase('menu')} className="px-10 py-3 bg-yellow-600 hover:bg-yellow-500 text-black text-xs font-bold border-2 border-yellow-400">MENÚ PRINCIPAL</button>
            </div>
          )}

        </div>
      </div>
    </main>
  );
}

function TouchBtn({ onDown, onUp, className, children }) {
  return (
    <button
      className={`pointer-events-auto select-none touch-none active:scale-95 active:bg-white/20 transition-transform rounded flex items-center justify-center ${className}`}
      onPointerDown={(e) => { e.preventDefault(); onDown(); }}
      onPointerUp={(e) => { e.preventDefault(); onUp(); }}
      onPointerLeave={() => onUp()}
      onPointerCancel={() => onUp()}
    >
      {children}
    </button>
  );
}