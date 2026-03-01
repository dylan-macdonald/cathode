import { Physics, Scene } from 'phaser';
import { PICKUP_BOB_AMPLITUDE, PICKUP_BOB_SPEED } from '../utils/constants';

export type PickupType = 'hp' | 'tube' | 'fragment';

export class Pickup extends Physics.Arcade.Sprite {
  pickupType: PickupType;
  private _baseY: number;
  private _timer = Math.random() * 1000; // randomize bob phase

  constructor(scene: Scene, x: number, y: number, type: PickupType) {
    const textureMap: Record<PickupType, string> = {
      hp: 'pickup_hp',
      tube: 'pickup_tube',
      fragment: 'pickup_fragment',
    };
    super(scene, x, y, textureMap[type]);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.pickupType = type;
    this._baseY = y;

    const body = this.body as Physics.Arcade.Body;
    body.setCircle(8, this.width / 2 - 8, this.height / 2 - 8);
    body.setImmovable(true);
    body.setAllowGravity(false);
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    this._timer += delta;

    // Gentle bob
    this.y = this._baseY + Math.sin(this._timer * PICKUP_BOB_SPEED) * PICKUP_BOB_AMPLITUDE;
  }

  magnetToward(px: number, py: number, range: number, delta: number): void {
    const dx = px - this.x;
    const dy = py - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < range && dist > 5) {
      const strength = (1 - dist / range) * 0.15;
      this.x += dx * strength;
      this._baseY += dy * strength;
    }
  }
}
