import { Scene, Types } from 'phaser';

export function createMuzzleFlashConfig(): Types.GameObjects.Particles.ParticleEmitterConfig {
  return {
    texture: 'muzzle_flash',
    speed: { min: 50, max: 150 },
    scale: { start: 0.8, end: 0 },
    alpha: { start: 1, end: 0 },
    lifespan: 100,
    quantity: 4,
    emitting: false,
  };
}

export function createDeathBurstConfig(): Types.GameObjects.Particles.ParticleEmitterConfig {
  return {
    texture: 'static_particle',
    speed: { min: 80, max: 200 },
    scale: { start: 1, end: 0 },
    alpha: { start: 1, end: 0 },
    lifespan: 300,
    quantity: 12,
    emitting: false,
  };
}

export function createSurfTrailConfig(): Types.GameObjects.Particles.ParticleEmitterConfig {
  return {
    texture: 'surf_trail',
    speed: { min: 20, max: 60 },
    scale: { start: 0.6, end: 0 },
    alpha: { start: 0.8, end: 0 },
    lifespan: 400,
    quantity: 2,
    frequency: 30,
    emitting: false,
  };
}

export function emitBurst(
  scene: Scene,
  x: number,
  y: number,
  config: Types.GameObjects.Particles.ParticleEmitterConfig,
): void {
  const textureKey = (config.texture as string) ?? 'static_particle';
  const emitter = scene.add.particles(x, y, textureKey, {
    ...config,
    emitting: false,
  });
  emitter.explode(config.quantity as number ?? 8, 0, 0);
  scene.time.delayedCall(1000, () => emitter.destroy());
}
