import { useEffect, useRef } from 'react';
import StartGame from '@/game/2d/main';

// Module-level singleton — survives React StrictMode's double-invoke
let _phaserInstance = null;

function destroyExisting() {
  if (_phaserInstance) {
    try {
      _phaserInstance.destroy(true);
    } catch (_) {}
    _phaserInstance = null;
  }
  // Also nuke any leftover canvas nodes aggressively
  const c = document.getElementById('game-container');
  if (c) {
    c.innerHTML = '';
  }
}

/**
 * 2D (Phaser) flavor of the engine contract. Uses a module-level singleton
 * so that React 18 StrictMode double-effect never creates two Phaser instances.
 */
export default function Game({ onReady }) {
  const readyCalled = useRef(false);

  useEffect(() => {
    // Always wipe any previous instance first
    destroyExisting();

    const instance = StartGame('game-container');
    _phaserInstance = instance;

    if (typeof onReady === 'function' && !readyCalled.current) {
      readyCalled.current = true;
      onReady(instance);
    }

    return () => {
      destroyExisting();
      readyCalled.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

