# CATHODE — Bug Tracker (Phase 6 Audit)

## Fixed During Audit

### BUG-001: CRT Pipeline crashes on boot (Phaser 3.90 constructor change)
- **Severity**: Critical (game won't start)
- **Root cause**: Phaser 3.90's `PipelineManager` passes `(game, config)` to PostFX pipeline constructors, but the CRTPipeline constructor expected only a config object. Also, registering the pipeline in the game config's `pipeline` property caused a crash because the renderer wasn't initialized yet.
- **Fix**:
  1. Moved pipeline registration from `main.ts` game config to `BootScene.create()` using `renderer.pipelines.addPostPipeline()`
  2. Updated `CRTPipeline` constructor to detect whether first arg is a `Game` instance
  3. Added null guard in `onPreRender()` for `this.renderer`
- **Files**: `src/rendering/CRTShader.ts`, `src/scenes/BootScene.ts`, `src/main.ts`

### BUG-002: SFX generation crashes — jsfxr API incompatibility
- **Severity**: Critical (game won't start)
- **Root cause**: Code used `import { jsfxr } from 'jsfxr'` and called `jsfxr(params)`, but jsfxr 1.4's named export `jsfxr` is an object (not a function). The presets were 24-element number arrays, but the jsfxr 1.4 API expects named Params objects.
- **Fix**:
  1. Changed import to `import { sfxr } from 'jsfxr'`
  2. Added `arrayToParams()` converter mapping array indices to Params field names
  3. Changed call to `sfxr.toWave(arrayToParams(params)).dataURI`
  4. Updated type declarations in `src/types/jsfxr.d.ts`
- **Files**: `src/audio/SFXGenerator.ts`, `src/types/jsfxr.d.ts`

### BUG-003: Enemy spawn cap checked array length instead of active count
- **Severity**: Medium (prevents spawning when dead enemies remain in array)
- **Root cause**: `_spawnEnemy()` in GameScene checked `this._enemies.length >= 30` instead of counting only active enemies. Dead enemies remain in the array until the update loop filters them, so the cap could trigger with 0 active enemies if 30+ dead ones hadn't been cleaned up yet.
- **Fix**: Changed to `this._enemies.filter(e => e.active).length >= 30`
- **Files**: `src/scenes/GameScene.ts`

## Known Issues

### ISSUE-001: Phaser input events not received in headless Chromium
- **Severity**: Test-only (not a game bug)
- **Description**: Playwright's synthetic keyboard/pointer events aren't received by Phaser's input system in headless Chromium. Tests use the debug bridge's `startScene()` and `pressKey()` commands to navigate instead.
- **Workaround**: Debug bridge provides `commands.startScene()`, `commands.pressKey()`, and `commands.clickCanvas()` for test automation.
