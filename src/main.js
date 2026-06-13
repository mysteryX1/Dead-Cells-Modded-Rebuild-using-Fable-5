import BootScene from './scenes/BootScene.js';
import GameScene from './scenes/GameScene.js';
import BossScene from './scenes/BossScene.js';
import ShopScene from './scenes/ShopScene.js';
import { GRAVITY } from './config.js';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 960,
  height: 540,
  backgroundColor: '#101018',
  pixelArt: true,
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: GRAVITY }, debug: false },
  },
  scene: [BootScene, GameScene, ShopScene, BossScene],
});
