import { Scene } from 'phaser';
import { generateTextures } from '../rendering/SpriteFactory';
import { generateAllSFX } from '../audio/SFXGenerator';
import { CRTPipeline } from '../rendering/CRTShader';

export class BootScene extends Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    // Register CRT post-processing pipeline now that renderer is fully initialized
    const renderer = this.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
    if (renderer && renderer.pipelines) {
      renderer.pipelines.addPostPipeline('CRTPipeline', CRTPipeline);
    }

    // Generate all textures procedurally
    generateTextures(this);

    // Generate all SFX
    generateAllSFX();

    // Proceed to menu
    this.scene.start('MenuScene');
  }
}
