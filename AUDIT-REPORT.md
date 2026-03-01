# CATHODE — Phase 6 Audit Report

## Overview
Phase 6 adds Playwright-based end-to-end test infrastructure with a debug bridge for game state inspection and mutation. This is the first systematic quality verification of all game systems.

## Results

**65 tests, 65 passed, 0 failed** (23.8 minutes)

## Infrastructure

### Debug Bridge (`src/debug/DebugBridge.ts`)
- Exposes `window.__CATHODE__` in non-production builds
- Scene-aware getters via Proxy for all game state
- Mutation commands: spawn enemies, give items, set HP, navigate scenes
- Synergy checking integrated into `giveItem` command
- Static data registry: all enemy types, items, channels, bosses, synergies
- Performance metrics: FPS, physics bodies, active sprites

### Test Helpers (`tests/helpers.ts`)
- `waitForBridge()` / `waitForScene()` — polls bridge state
- `navigateToGameScene()` — automated full navigation flow via bridge commands
- `getState()` — full game state snapshot
- `snap()` — categorized screenshots
- `clickGameAt()` — game-to-page coordinate mapping (Scale.FIT + CENTER_BOTH)
- Bridge command wrappers for all mutation commands
- `profileFrames()` — FPS sampling over N animation frames

## Bug Fixes
See [BUGS.md](./BUGS.md) for details.

| ID | Severity | Summary |
|----|----------|---------|
| BUG-001 | Critical | CRT Pipeline constructor incompatible with Phaser 3.90 |
| BUG-002 | Critical | SFX generation using wrong jsfxr API |
| BUG-003 | Medium | Enemy spawn cap checked array length instead of active count |

## Data Registry Audit

| Category | Count | Verified |
|----------|-------|----------|
| Enemy types | 39 | All 39 spawn and die correctly via bridge |
| Items | 50 | All apply without NaN, all stack simultaneously |
| Synergies | 10 | All 10 activate when required items given |
| Bosses | 10 | All registered, state accessible |
| Channels | 10 | All registered, default is 'static' |
| Characters | 5 | Select screen verified |

## Performance (Headless Chromium)

| Scenario | Avg FPS | Min FPS |
|----------|---------|---------|
| Normal gameplay | 8.6 | 8.1 |
| 25 enemies | 8.3 | 8.1 |
| All 50 items stacked | 8.2 | 8.1 |
| 30 enemies (cap) | 7.8 | 7.4 |
| All items + 10 enemies | 7.5 | 7.3 |
| Projectile flood | 8.1 | 7.9 |

Note: Headless Chromium uses software rendering (~8 FPS). Real browser performance is significantly higher.

## Test Suites

### Audit Tests (`tests/audit/`)
| File | Tests | Purpose |
|------|-------|---------|
| 01-boot-and-title | 6 | Game boot, canvas, bridge, menu |
| 02-navigation | 6 | Scene transitions, full flow |
| 03-player-movement | 7 | WASD, diagonal, surf, bounds |
| 04-combat | 5 | Spawn, kill, damage, room clear |
| 05-enemies-all-types | 4 | All enemy spawn/kill verification |
| 06-items-all | 4 | All items, NaN checks, stacking |
| 07-synergies | 3 | Synergy activation verification |
| 08-bosses | 4 | Boss state and data registry |
| 09-channels | 4 | Channel verification |
| 10-repair-shop | 4 | Station interaction, persistence |
| 11-accessibility | 4 | Practice mode, visual styles |
| 12-performance | 4 | FPS benchmarks, stability |

### Gallery Tests (`tests/gallery/`)
| File | Purpose |
|------|---------|
| channels | Channel visual screenshots |
| bosses | Boss registry screenshots |
| enemies | Enemy type batch screenshots |
| characters | Character select screenshots |
| synergies | Synergy activation screenshots |

### Stress Tests (`tests/stress/`)
| File | Purpose |
|------|---------|
| enemy-cap | 30-enemy cap enforcement |
| projectile-flood | Rapid fire stability |
| item-stack | All 50 items + combat |
| rapid-transitions | Repeated room clears |

## Running Tests
```bash
npm test              # Run all tests
npm run test:headed   # Run with visible browser
npx playwright test tests/audit/01-boot-and-title.spec.ts  # Run specific suite
```

## Architecture Decisions
1. **Bridge in main.ts, not per-scene** — Game object persists; scenes resolved dynamically
2. **Dynamic import gated on MODE** — Tree-shaken from production builds
3. **Private field access via `(scene as any)._field`** — Zero changes to game class interfaces
4. **Bridge navigation** — Phaser input doesn't receive synthetic events in headless Chromium; tests use `commands.startScene()` instead
5. **CRT pipeline fix** — Constructor now handles both `Game` instance and config object arguments
6. **Synergy integration** — Bridge `giveItem` calls `checkSynergies()` to mirror `_collectItem()` behavior
7. **Multi-pass kill for splitting enemies** — `spore` and `feedback_loop` spawn children on death; bridge `killAllEnemies` loops up to 3 passes, cleaning dead enemies and killing new split children each pass
