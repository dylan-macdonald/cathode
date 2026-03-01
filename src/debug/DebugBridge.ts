/**
 * Debug bridge for Playwright testing.
 * Exposes game state on window.__CATHODE__ so tests can inspect and mutate state.
 * Only loaded in non-production builds (dynamic import gated on import.meta.env.MODE).
 */
import Phaser from 'phaser';
import { ALL_ITEMS } from '../data/items';
import { ENEMY_CONFIGS } from '../data/enemies';
import { CHANNEL_REGISTRY } from '../data/channels';
import { BOSS_DEFS } from '../data/bosses';
import { SYNERGY_DEFS, checkSynergies } from '../systems/SynergySystem';
import { loadSave, saveToCurrent, resetSave } from '../systems/SaveManager';
import { getEventLog, clearEventLog, type GameEvent } from './EventLog';
import { _sfxPlayCounts, _lastPlayedKey } from '../audio/SFXGenerator';

interface CathodeBridge {
  activeScene: string;
  isSceneActive(key: string): boolean;
  game: Record<string, unknown>;
  commands: Record<string, (...args: unknown[]) => unknown>;
  data: Record<string, unknown>;
  perf: Record<string, unknown>;
  events: {
    log: readonly GameEvent[];
    clear(): void;
    since(ts: number): GameEvent[];
    ofType(type: string): GameEvent[];
  };
  camera: Record<string, unknown>;
  audio: {
    lastPlayedSFX: string | null;
    sfxPlayCounts: Record<string, number>;
    clearCounts(): void;
  };
  particles: Record<string, unknown>;
}

declare global {
  interface Window {
    __CATHODE__?: CathodeBridge;
  }
}

function getGameScene(game: Phaser.Game): Phaser.Scene | null {
  const scene = game.scene.getScene('GameScene');
  if (scene && game.scene.isActive('GameScene')) return scene;
  return null;
}

export function attachDebugBridge(game: Phaser.Game): void {
  const bridge: CathodeBridge = {
    get activeScene(): string {
      const scenes = game.scene.getScenes(true);
      return scenes.length > 0 ? scenes[scenes.length - 1].scene.key : 'none';
    },

    isSceneActive(key: string): boolean {
      return game.scene.isActive(key);
    },

    game: new Proxy({} as Record<string, unknown>, {
      get(_target, prop: string) {
        const gs = getGameScene(game) as Record<string, unknown> | null;
        if (!gs) return undefined;

        const player = gs._player as Record<string, unknown> | undefined;
        const items = gs._items as Record<string, unknown> | undefined;
        const enemies = gs._enemies as Array<{ active: boolean }> | undefined;
        const boss = gs._boss as Record<string, unknown> | null | undefined;

        switch (prop) {
          case 'transitioning':
            return gs._transitioning ?? false;
          case 'playerHP':
            return player?.hp ?? 0;
          case 'playerMaxHP':
            return player?.maxHp ?? 0;
          case 'playerX':
            return (player as Phaser.GameObjects.Sprite | undefined)?.x ?? 0;
          case 'playerY':
            return (player as Phaser.GameObjects.Sprite | undefined)?.y ?? 0;
          case 'playerIsInvulnerable':
            return player?.isInvulnerable ?? false;
          case 'playerIsSurfing':
            return player?.isSurfing ?? false;
          case 'playerDamage':
            return typeof (items as Record<string, unknown>)?.getEffectiveDamage === 'function'
              ? (items as { getEffectiveDamage(): number }).getEffectiveDamage()
              : 0;
          case 'playerWeaponType':
            return player?.weaponType ?? 'phosphor_beam';
          case 'score':
            return gs._score ?? 0;
          case 'tubes':
            return items?.tubes ?? 0;
          case 'bombs':
            return items?.bombs ?? 0;
          case 'enemyCount':
            return enemies?.filter(e => e.active).length ?? 0;
          case 'enemiesKilled':
            return gs._enemiesKilled ?? 0;
          case 'roomsCleared':
            return gs._roomsCleared ?? 0;
          case 'roomCleared':
            return gs._roomCleared ?? false;
          case 'channelId':
            return gs._channelId ?? 'static';
          case 'bossAlive':
            return (boss as Record<string, unknown>)?.isAlive ?? false;
          case 'bossHP':
            return (boss as Record<string, unknown>)?.hp ?? 0;
          case 'bossMaxHP':
            return (boss as Record<string, unknown>)?.maxHp ?? 0;
          case 'itemCount':
            return (items?.collectedItems as unknown[])?.length ?? 0;
          case 'collectedItemIds':
            return (items?.collectedItems as Array<{ id: string }>)?.map(i => i.id) ?? [];
          case 'currentRoomX':
            return gs._currentRoomX ?? 0;
          case 'currentRoomY':
            return gs._currentRoomY ?? 0;
          case 'ascensionLevel':
            return gs._ascension != null
              ? (gs._ascension as Record<string, unknown>).level ?? 0
              : 0;
          case 'activeSynergies':
            return Array.from((gs._activeSynergies as Set<string>) ?? new Set());
          case 'floorRoomCount':
            return (gs._floor as Map<string, unknown>)?.size ?? 0;
          case 'fps':
            return game.loop.actualFps;
          case 'practiceMode':
            return gs._practiceMode ?? false;
          case 'reduceMotion':
            return gs._reduceMotion ?? false;
          default:
            return undefined;
        }
      },
    }),

    commands: {
      /** Force-start a scene by key (bypasses input/transition). */
      startScene(key: unknown, data?: unknown) {
        game.scene.start(key as string, data as Record<string, unknown>);
      },

      /** Send a synthetic keyboard event that Phaser's keyboard plugin will receive. */
      pressKey(key: unknown) {
        const event = new KeyboardEvent('keydown', {
          key: key as string,
          code: key as string,
          bubbles: true,
          cancelable: true,
        });
        game.canvas.dispatchEvent(event);
        // Also dispatch keyup after a brief delay
        setTimeout(() => {
          game.canvas.dispatchEvent(new KeyboardEvent('keyup', {
            key: key as string,
            code: key as string,
            bubbles: true,
            cancelable: true,
          }));
        }, 50);
      },

      /** Simulate a pointer click on the game canvas at given page coordinates. */
      clickCanvas(x: unknown, y: unknown) {
        const rect = game.canvas.getBoundingClientRect();
        const opts = {
          bubbles: true,
          cancelable: true,
          clientX: rect.left + (x as number),
          clientY: rect.top + (y as number),
        };
        game.canvas.dispatchEvent(new PointerEvent('pointerdown', opts));
        game.canvas.dispatchEvent(new MouseEvent('mousedown', opts));
        setTimeout(() => {
          game.canvas.dispatchEvent(new PointerEvent('pointerup', opts));
          game.canvas.dispatchEvent(new MouseEvent('mouseup', opts));
        }, 50);
      },

      spawnEnemy(type: unknown, x: unknown, y: unknown) {
        const gs = getGameScene(game) as Record<string, (...args: unknown[]) => void> | null;
        if (!gs) return;
        gs._spawnEnemy(type as string, x as number, y as number);
      },

      giveItem(itemId: unknown) {
        const gs = getGameScene(game) as Record<string, unknown> | null;
        if (!gs) return;
        const def = ALL_ITEMS.find(i => i.id === itemId);
        if (!def) return;
        const items = gs._items as { applyItem(def: unknown): void; collectedItems: Array<{ id: string }>; stats: Record<string, number> };
        items.applyItem(def);
        const player = gs._player as { syncStats(): void };
        player.syncStats();
        // Check and activate synergies (mirrors GameScene._collectItem logic)
        const heldIds = items.collectedItems.map(i => i.id);
        const activeSynergies = gs._activeSynergies as Set<string>;
        const newSynergies = checkSynergies(heldIds, activeSynergies);
        for (const syn of newSynergies) {
          activeSynergies.add(syn.id);
          for (const [key, value] of Object.entries(syn.statMods)) {
            if (key in items.stats && typeof value === 'number') {
              (items.stats as Record<string, number>)[key] += value;
            }
          }
          player.syncStats();
        }
      },

      setPlayerHP(hp: unknown) {
        const gs = getGameScene(game) as Record<string, unknown> | null;
        if (!gs) return;
        (gs._player as Record<string, unknown>).hp = hp;
      },

      setPlayerPosition(x: unknown, y: unknown) {
        const gs = getGameScene(game) as Record<string, unknown> | null;
        if (!gs) return;
        (gs._player as Phaser.GameObjects.Sprite).setPosition(x as number, y as number);
      },

      setPlayerInvulnerable(v: unknown) {
        const gs = getGameScene(game) as Record<string, unknown> | null;
        if (!gs) return;
        (gs._player as Record<string, unknown>).isInvulnerable = v;
      },

      killAllEnemies() {
        const gs = getGameScene(game) as Record<string, unknown> | null;
        if (!gs) return;
        // Loop to handle split-on-death enemies (spore, feedback_loop spawn children)
        for (let pass = 0; pass < 3; pass++) {
          const enemies = gs._enemies as Array<{ active: boolean; die(): void; scoreValue: number }>;
          let hadActive = false;
          for (const e of [...enemies]) {
            if (e.active) {
              e.die();
              (gs._enemiesKilled as number)++;
              (gs._score as number) += e.scoreValue;
              hadActive = true;
            }
          }
          // Clean up dead enemies from array (game's update loop does this but may not run between bridge calls)
          gs._enemies = (gs._enemies as Array<{ active: boolean }>).filter(e => e.active);
          if (!hadActive) break;
        }
      },

      clearRoom() {
        const gs = getGameScene(game) as Record<string, unknown> | null;
        if (!gs) return;
        for (let pass = 0; pass < 3; pass++) {
          const enemies = gs._enemies as Array<{ active: boolean; die(): void; scoreValue: number }>;
          let hadActive = false;
          for (const e of [...enemies]) {
            if (e.active) {
              e.die();
              (gs._enemiesKilled as number)++;
              (gs._score as number) += e.scoreValue;
              hadActive = true;
            }
          }
          gs._enemies = (gs._enemies as Array<{ active: boolean }>).filter(e => e.active);
          if (!hadActive) break;
        }
        gs._roomCleared = true;
      },

      setScore(n: unknown) {
        const gs = getGameScene(game) as Record<string, unknown> | null;
        if (!gs) return;
        gs._score = n;
      },

      giveTubes(n: unknown) {
        const gs = getGameScene(game) as Record<string, unknown> | null;
        if (!gs) return;
        const items = gs._items as Record<string, unknown>;
        items.tubes = (items.tubes as number) + (n as number);
      },

      setSaveData(partial: unknown) {
        const save = loadSave();
        Object.assign(save, partial);
        saveToCurrent(save);
      },

      resetSave() {
        resetSave();
      },
    },

    data: {
      get allEnemyTypes() {
        return Object.keys(ENEMY_CONFIGS);
      },
      get allItemIds() {
        return ALL_ITEMS.map(i => i.id);
      },
      get allChannelIds() {
        return Object.keys(CHANNEL_REGISTRY);
      },
      get allBossIds() {
        return Object.keys(BOSS_DEFS);
      },
      get allSynergyIds() {
        return SYNERGY_DEFS.map(s => s.id);
      },
    },

    perf: new Proxy({} as Record<string, unknown>, {
      get(_target, prop: string) {
        switch (prop) {
          case 'fps':
            return game.loop.actualFps;
          case 'bodies': {
            const gs = getGameScene(game) as Phaser.Scene | null;
            if (!gs) return 0;
            return gs.physics.world.bodies.size;
          }
          case 'activeSprites': {
            const gs = getGameScene(game) as Phaser.Scene | null;
            if (!gs) return 0;
            return gs.children.list.filter(c => (c as Phaser.GameObjects.Sprite).active).length;
          }
          default:
            return undefined;
        }
      },
    }),

    // ── Phase 7: Event Recording ──────────────────────────────────

    events: {
      get log() { return getEventLog(); },
      clear() { clearEventLog(); },
      since(ts: number) { return getEventLog().filter(e => e.timestamp >= ts); },
      ofType(type: string) { return getEventLog().filter(e => e.type === type); },
    },

    // ── Phase 7: Camera State ─────────────────────────────────────

    camera: new Proxy({} as Record<string, unknown>, {
      get(_target, prop: string) {
        const gs = getGameScene(game) as Phaser.Scene | null;
        if (!gs) return undefined;
        const cam = gs.cameras.main as unknown as Record<string, unknown>;
        switch (prop) {
          case 'scrollX': return gs.cameras.main.scrollX;
          case 'scrollY': return gs.cameras.main.scrollY;
          case 'zoom': return gs.cameras.main.zoom;
          case 'shakeIntensity': return cam._shakeIntensity ?? 0;
          case 'shakeDuration': return cam._shakeDuration ?? 0;
          case 'flashAlpha': return cam._flashAlpha ?? 0;
          default: return undefined;
        }
      },
    }),

    // ── Phase 7: Audio Tracking ───────────────────────────────────

    audio: {
      get lastPlayedSFX() { return _lastPlayedKey; },
      get sfxPlayCounts() {
        const obj: Record<string, number> = {};
        _sfxPlayCounts.forEach((v, k) => { obj[k] = v; });
        return obj;
      },
      clearCounts() {
        _sfxPlayCounts.clear();
        // reset _lastPlayedKey handled via module export
      },
    },

    // ── Phase 7: Particle State ───────────────────────────────────

    particles: new Proxy({} as Record<string, unknown>, {
      get(_target, prop: string) {
        const gs = getGameScene(game) as Phaser.Scene | null;
        if (!gs) return undefined;
        switch (prop) {
          case 'activeEmitterCount': {
            let count = 0;
            gs.children.list.forEach(c => {
              if ((c as { type?: string }).type === 'ParticleEmitter' && (c as { active?: boolean }).active) count++;
            });
            return count;
          }
          case 'totalAliveParticles': {
            let total = 0;
            gs.children.list.forEach(c => {
              if ((c as { type?: string }).type === 'ParticleEmitter') {
                total += (c as { getAliveParticleCount?: () => number }).getAliveParticleCount?.() ?? 0;
              }
            });
            return total;
          }
          default: return undefined;
        }
      },
    }),
  };

  // ── Phase 7: Additional Commands ────────────────────────────────

  bridge.commands.triggerShoot = () => {
    const gs = getGameScene(game) as Record<string, unknown> | null;
    if (!gs) return;
    const player = gs._player as Record<string, () => void>;
    player._tryShoot?.();
  };

  bridge.commands.triggerSurf = () => {
    const gs = getGameScene(game) as Record<string, unknown> | null;
    if (!gs) return;
    const player = gs._player as Record<string, () => void>;
    player._tryChannelSurf?.();
  };

  bridge.commands.triggerBomb = () => {
    const gs = getGameScene(game) as Record<string, unknown> | null;
    if (!gs) return;
    const player = gs._player as Record<string, () => void>;
    player._tryBomb?.();
  };

  bridge.commands.triggerPlayerDamage = (amount: unknown) => {
    const gs = getGameScene(game) as Record<string, unknown> | null;
    if (!gs) return;
    const player = gs._player as { takeDamage(n: number): void };
    player.takeDamage(amount as number);
  };

  bridge.commands.triggerEnemyDamage = (amount: unknown) => {
    const gs = getGameScene(game) as Record<string, unknown> | null;
    if (!gs) return;
    const enemies = gs._enemies as Array<{ active: boolean; takeDamage(n: number): boolean }>;
    const first = enemies.find(e => e.active);
    if (first) first.takeDamage(amount as number);
  };

  bridge.commands.getHitStopTimer = () => {
    const gs = getGameScene(game) as Record<string, unknown> | null;
    if (!gs) return 0;
    return gs._hitStopTimer ?? 0;
  };

  window.__CATHODE__ = bridge;
}
