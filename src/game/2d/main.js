import Phaser from 'phaser';
import { GameScene } from '@/game/2d/scenes/GameScene';

const config = {
  type: Phaser.AUTO,
  width: 1024,
  height: 576,
  parent: 'game-container',
  pixelArt: true,
  backgroundColor: '#0a0a0a',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 800 },
      debug: false
    }
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [GameScene]
};

const StartGame = (parent) => {
  return new Phaser.Game({ ...config, parent });
};

export default StartGame;