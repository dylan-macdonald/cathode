import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { GameOverScene } from './scenes/GameOverScene';
import { RepairShopScene } from './scenes/RepairShopScene';
import { WeaponSelectScene } from './scenes/WeaponSelectScene';
import { ChannelTransitionScene } from './scenes/ChannelTransitionScene';
import { CharacterSelectScene } from './scenes/CharacterSelectScene';
import { PauseOverlay } from './scenes/PauseOverlay';
import { CreditsScene } from './scenes/CreditsScene';
import { AttractScene } from './scenes/AttractScene';
import { GAME_WIDTH, GAME_HEIGHT, BACKGROUND_COLOR, PHYSICS_FPS } from './utils/constants';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,
  parent: 'game-container',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: BACKGROUND_COLOR,
  physics: {
    default: 'arcade',
    arcade: {
      fps: PHYSICS_FPS,
      debug: false,
    },
  },
  scene: [BootScene, MenuScene, GameScene, GameOverScene, RepairShopScene, WeaponSelectScene, ChannelTransitionScene, CharacterSelectScene, PauseOverlay, CreditsScene, AttractScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    keyboard: true,
    mouse: true,
  },
  render: {
    pixelArt: false,
    antialias: true,
  },
};

const game = new Phaser.Game(config);

// Debug bridge for Playwright testing (excluded from production builds)
if (import.meta.env.MODE !== 'production') {
  import('./debug/DebugBridge').then(({ attachDebugBridge }) => {
    attachDebugBridge(game);
  });
}
