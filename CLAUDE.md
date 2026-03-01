# CATHODE — Project Bible

## Build Commands
- `npm run dev` — Start dev server (Vite)
- `npm run build` — Production build
- `npm run preview` — Preview production build

## Architecture
- **Engine**: Phaser 3.88+ with Arcade Physics
- **Language**: TypeScript strict mode
- **Bundler**: Vite
- **Art**: ALL sprites generated programmatically via Canvas API in BootScene. No image files.
- **Audio**: ALL sound effects generated via jsfxr (npm: jsfxr). No audio files. Music via Web Audio API oscillators.
- **Post-processing**: CRT shader pipeline (scanlines, bloom, barrel distortion, chromatic aberration) via Phaser's WebGL pipeline.

### Key Architecture Decisions
- **Room system**: 12x8 grid (80px cells) fills 960x640. Cell enum (EMPTY, WALL, PIT, COVER, SPAWN, DOOR_N/S/E/W). Templates are plain 2D arrays with utility functions for mirroring.
- **Dungeon generation**: Random walk algorithm places 8-12 rooms on a coordinate grid. FloorMap is a Map<string, RoomData> keyed by "x,y". Boss room = farthest from spawn. Item/shop rooms assigned by distance preference. Supports seeded RNG via optional `seed` parameter for daily runs.
- **Room transitions**: Camera fade in/out. Room geometry is cleared and rebuilt in-place -- no scene recreation. Player repositioned at opposite door.
- **Enemy system**: Config-driven via EnemyConfig records in data/enemies.ts. Enemy class reads config for behavior/attack pattern. Behaviors: chase, strafe, orbit, turret, teleport, zigzag, scroll, swarm, charge. Attack types: aimed, burst, beam, ring, tracking_beam.
- **Enemy projectiles**: Separate EnemyProjectile class and Physics group, visually distinct (red/orange vs player's white/green).
- **Item system**: Data-driven via ItemDef in data/items.ts. PlayerStats struct with 16 stat fields. ItemSystem applies additive stat mods. Event hooks (onKill, onHit, onPlayerHurt, onRoomClear, onShoot, onSurf) for behavioral items.
- **Boss system**: 7 boss implementations. Boss (sprite-based, Dead Channel), BossSMPTE, BossTone, BossOffer, BossLaughTrack, BossNarrator, BossSignalZero (all graphics-based). AnyBoss union type in GameScene.
- **Character system**: CharacterDef in data/characters.ts. Stat modifiers applied at run start. 5 characters with unique passives.
- **Ascension system**: 10 difficulty levels with progressive modifiers (enemy HP, speed, count, shop costs, etc.). Tracked per-save.
- **Seeded runs**: Mulberry32 PRNG in SeededRNG.ts. Threaded through DungeonGenerator for deterministic layouts. Daily seed from date string.
- **Save system**: localStorage persistence. SaveData includes unlocks, run history, daily runs, discovered items, ascension progress, boss-beaten tracking.
- **Minimap**: Graphics-drawn in top-right. Shows visited (green), current (white), unvisited adjacent (outline), room type indicators (boss=red, item=yellow, shop=blue).

## File Structure (key files)
- `src/main.ts` -- Game config and scene registration
- `src/scenes/` -- BootScene, MenuScene, GameScene, GameOverScene, RepairShopScene, WeaponSelectScene, CharacterSelectScene, ChannelTransitionScene, PauseOverlay
- `src/entities/` -- Player, Enemy, Projectile, Pickup, Boss, BossSMPTE, BossTone, BossOffer, BossLaughTrack, BossNarrator, BossSignalZero
- `src/systems/` -- ItemSystem, DungeonGenerator, WaveSpawner, SaveManager, AchievementSystem, AscensionSystem, SeededRNG, SettingsManager
- `src/data/` -- items.ts (50 items), enemies.ts (~20 types), weapons.ts (4 types), channels.ts (7 channels), bosses.ts (7 bosses), rooms.ts, characters.ts (5 characters)
- `src/rendering/` -- CRTShader, SpriteFactory, ParticlePresets
- `src/audio/` -- SFXGenerator, MusicManager, presets
- `src/utils/` -- constants, math

## Code Style
- ES modules, no CommonJS
- Prefer composition over inheritance for entities
- All magic numbers go in `src/utils/constants.ts`
- Each file has a single clear responsibility
- Use Phaser's built-in types, don't re-declare them
- Destructure imports: `import { Scene } from 'phaser'`

## Game Design Reference

### Player
- Top-down twin-stick movement (WASD + mouse aim + left click shoot)
- Health: starts at 5 HP (CRT hearts displayed as phosphor dots)
- Dodge: SPACE or right-click = "Channel Surf" -- brief invulnerability + static dissolve effect + damages enemies in trail
- Channel Surf has a cooldown (1.5s base, modified by ascension)
- Stats modified by item pickups via PlayerStats/ItemSystem
- Bomb (Q key): screen-clear ability from Degauss Coil item
- 5 playable characters with stat modifiers and passive abilities

### Characters
- **Standard**: Default signal. No modifiers.
- **Filament**: +1 max HP, -15 move speed. Passive: warm_start
- **Cathode Ray**: +0.3 damage, +1 fire rate, -1 max HP. Passive: overdrive
- **Ghost Signal**: +40 move speed, -0.15 damage. Passive: phase_shift
- **Dead Pixel**: +0.5 screen shake, +0.1 damage. Passive: static_cling

### Weapons (4 Signal Types)
- **Phosphor Beam** (default): focused dot projectile, modified by item stats
- **Scan Line**: wide sweep, pierces everything
- **Color Burst**: RGB spread, rapid fire, short range
- **Interference Pattern**: wavy homing signal, slow but relentless

### Enemies (~20 types across 7 channels)
- CH 2: static_mote, scanline_crawler, signal_ghost, tone_drone, bar_sentinel
- CH 4: grid_walker, calibration_ring, color_bar, feedback_loop, dead_pixel
- CH 11: siren_crawler, alert_text, tone_spike
- CH 7: pitchman, price_tag, infomercial_loop
- CH 9: bounce_blob, rubber_band, anvil, ink_blot
- CH 13: spore, tendril, swarm_unit, predator

### Bosses (7 total)
- **The Dead Channel** (CH 2): 100 HP, static noise body, scanline beams, 3 phases
- **SMPTE** (CH 4): 120 HP, color bar boss, rotating beams
- **The Tone** (CH 11): 110 HP, concentric ring boss, pulsing attacks
- **The Offer** (CH 7): 100 HP, infomercial boss
- **The Laugh Track** (CH 9): 130 HP, splitting circle boss (1->2->4 fragments)
- **The Narrator** (CH 13): 140 HP, stationary hexagon, shield windows, themed wave spawns
- **Signal Zero** (CH 0): 200 HP, final boss, gravity wells, HUD absorption, arena collapse

### Channels (7 + Off Air)
- CH 2 STATIC: white/gray palette, noise enemies, signal-loss hazard zones
- CH 4 TEST PATTERN: color bar palette, geometric enemies, beam grid hazards
- CH 11 EMERGENCY: red palette, siren enemies, scrolling text hazards
- CH 7 LATE NIGHT: amber palette, infomercial enemies, price ticker hazards
- CH 9 CARTOON: pink/yellow palette, bouncy enemies, painted tunnel hazards
- CH 13 NATURE DOC: green palette, organic enemies, overgrowth hazards
- CH 0 OFF AIR: void palette, max CRT distortion, final gauntlet (5 arenas)

### Items (50 total)
- 20 common, 18 uncommon, 12 rare
- Modify PlayerStats additively
- Event hook items: onKill, onHit, onPlayerHurt, onRoomClear, onShoot, onSurf
- Key items: Replacement Fuse (revive), Static Guard (retaliatory ring), Signal Cascade (chain kills), Time Base Corrector (bullet-time), Cross-Talk (splash damage)
- Item rooms: free pickup on pedestal
- Shop rooms: 3 items for Tube currency

### Ascension System
- 10 levels of progressive difficulty
- Modifiers: enemy HP/speed/count, projectile speed, shop costs, player damage taken, surf cooldown, item room reduction, boss extra phase
- Level 10: all modifiers maxed + mandatory Signal Zero fight
- Tube bonus per ascension level (+15% per level)

### Daily Seed Runs
- Mulberry32 PRNG for deterministic dungeon generation
- Daily seed from today's date (YYYY-MM-DD)
- One attempt per day tracked in save data
- Accessible from "Daily Signal" station in Repair Shop

### Meta-progression (Repair Shop)
- 7 stations: Antenna Array (channels), Component Shelf (items), Signal Tuner (weapons), Soldering Station (upgrades), The TV (start run), Ascension, Daily Signal
- Tube currency earned from runs
- Permanent upgrades: starting HP, damage, pickup range, move speed, surf cooldown
- Run history (last 5 runs)
- Boss-beaten tracking (unlocks Signal Zero when all bosses beaten)

### Scenes Flow
MenuScene -> RepairShopScene -> CharacterSelectScene -> WeaponSelectScene -> GameScene -> (ChannelTransitionScene ->) GameOverScene -> RepairShopScene
PauseOverlay launched as parallel scene from GameScene (ESC key)

### CRT Visual Pipeline
- Per-channel CRT presets (distortion, aberration, scanlines, flicker, tint)
- Scanline overlay, phosphor bloom, barrel distortion, chromatic aberration
- Screen shake on impacts (Vlambeer-style)
- Hit flash + hit stop
- Static noise in dark/empty areas

### Audio (19 SFX presets)
- player_shoot, enemy_hit, enemy_death_small/medium/large, player_hurt
- channel_surf, menu_select, enemy_shoot, pickup, item_pickup
- door_unlock, room_transition, boss_hit, boss_phase, boss_death
- wave_clear, bomb, teleport

## Current State
Phase 4 complete. Full roguelike with:
- 7 channels with unique enemies, bosses, CRT presets, and hazards
- 50 items with event hooks for behavioral effects
- 5 playable characters with stat modifiers
- 4 weapon types
- 7 bosses including Signal Zero final boss
- 10-level ascension system
- Daily seeded runs
- Pause menu with settings (screen shake, SFX/music volume)
- Run history, boss tracking, item discovery
- Achievement system with character/weapon/channel unlocks
