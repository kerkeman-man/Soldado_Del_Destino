import { useEffect, useRef } from 'react';
import StartGame from '@/game/2d/main';

// Module-level singleton — survives React StrictMode's double-invoke
let _phaserInstance = null;

export default function Game({ onReady }) {
  const gameRef = useRef(null);
  const readyCalled = useRef(false);

  useEffect(() => {
    // If a previous instance is still around, destroy it
    if (_phaserInstance) {
      try {
        _phaserInstance.destroy(true);
      } catch (_) {}
      _phaserInstance = null;
    }

    // Start Phaser and attach it to our specific div ref
    const instance = StartGame(gameRef.current);
    _phaserInstance = instance;

    if (typeof onReady === 'function' && !readyCalled.current) {
      readyCalled.current = true;
      onReady(instance);
    }

    return () => {
      if (_phaserInstance) {
        try {
          _phaserInstance.destroy(true);
        } catch (_) {}
        _phaserInstance = null;
      }
      readyCalled.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Return a div that fills the parent and acts as the Phaser container.
  // When this component unmounts in StrictMode, React removes this div,
  // taking any late-appended canvas with it.
  return <div ref={gameRef} style={{ width: '100%', height: '100%' }} />;
}
