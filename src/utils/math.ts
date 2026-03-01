import { Math as PMath } from 'phaser';

export function angleBetween(x1: number, y1: number, x2: number, y2: number): number {
  return PMath.Angle.Between(x1, y1, x2, y2);
}

export function velocityFromAngle(angle: number, speed: number): { x: number; y: number } {
  return {
    x: Math.cos(angle) * speed,
    y: Math.sin(angle) * speed,
  };
}

export function distanceBetween(x1: number, y1: number, x2: number, y2: number): number {
  return PMath.Distance.Between(x1, y1, x2, y2);
}

export function clamp(value: number, min: number, max: number): number {
  return PMath.Clamp(value, min, max);
}

export function randomInRange(min: number, max: number): number {
  return PMath.Between(min, max);
}
