# Repository Instructions (`alaskah-abraham`)

This file is the authoritative guidance for all coding agents working in `alaskah-abraham`.

## Project Overview

**Alaskah Abraham (`alaskah-abraham`)** is a 3D voxel narrative adventure game telling the complete story of Abraham (Genesis 9–25, enriched with Midrash, Talmud, Josephus, and Book of Jasher traditions across 6 Books / 46 Chapters).

It combines:
1. **The Engine & Visual/UI Architecture of [`../alaskah-noah/`](../alaskah-noah/)**:
   - Three.js + Vite + TypeScript + Vitest
   - 100% procedural 3D voxel geometry (`VoxelBuilder`, `TD=16` texels/unit) + orthographic pixel-art rendering pipeline (`pixelRenderer.ts`, 540px internal height, 50° default tilt / 4° `toVista` horizon tilt)
   - Single-canvas HUD (`src/ui/hud.ts` + `pixelText.ts`) for all UI panels, portraits, dialogues, choices, chapter select, and system menus
   - Multi-slot save/backup/migration (`src/systems/persist/`) and headless Puppeteer QA
2. **The Narrative, Choreography & Audio Assets of [`../alaskah-bibles/`](../alaskah-bibles/)**:
   - 6 Books (`abraham_1` to `abraham_6`) + `abraham_intro` / `abraham_outro` (46 chapters authored in `../alaskah-bibles/godot/tools/gen_abraham_*.gd`)
   - 16 custom BGM tracks + 5 stingers, 157 SFX, 14 ambience loops, TTS voice clips (`../alaskah-bibles/godot/assets/audio/`), and KO/EN translations (`../alaskah-bibles/godot/localization/translations/en/`)

## Authoritative Plan

Always read [`PLAN.md`](./PLAN.md) first. It defines:
- The protagonist switching design (Abram/Abraham primary, with Lot in Book 4, Eliezer in Book 6, and Esau in the Book 1 Coda)
- The chapter-by-chapter mapping of Playable Hubs, Interactive Loops, and 3D Voxel Cutscenes across all 6 Books
- The 4 core architectural extensions (`StageManager`, `Choreography`, `CastRegistry`, `BiblesAssetBridge`)
- The 10-stage implementation roadmap and QA loop

## Core Engineering Rules (Inherited from `alaskah-noah` & `alaskah-bibles`)

1. **Zero Per-Frame Allocations in `step()`**:
   - Never allocate new arrays, objects, or inline closures inside per-frame update loops. Reuse module-level buffers and `for` loops.
2. **Lazy Stage Memory Management (`StageManager`)**:
   - Unlike `alaskah-noah` (which built all 3 maps at boot), `alaskah-abraham` has 12+ locations across 6 books. Build only the active stage's `VoxelBuilder` meshes and dispose geometry cleanly on stage transitions while keeping shared textures/materials cached.
3. **Script & Translation Integrity**:
   - Keep Biblical text vs. Midrash/tradition markers clear in dialogue/narration (e.g., `"전해오는 이야기에 따르면…"`), preserving `alaskah-bibles`'s convention.
   - Korean strings serve as translation keys or mapped entries with `tests/i18n.test.ts` and `tests/content.test.ts` verifying 100% coverage.
   - Use `josa()` / `josaRo()` for dynamic Korean particles.
4. **Verification Before Completion**:
   - Every stage must pass `npm test` (Vitest) and `npm run build` (`tsc --noEmit && vitest run && vite build`), plus headless browser visual/flow QA in `docs/qa/`.
5. **No Automatic Commit / Push / Deploy**:
   - Do NOT commit, push, or deploy automatically upon task completion.
   - Always wait until the user explicitly gives the signal/instruction before performing `git commit`, `git push`, or deployment.
