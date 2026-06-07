# CLAUDE.md

Context and working instructions for Claude Code on this project.
Read this at the start of every session.

## Project goal

A web app that generates a **3D avatar** of the user and renders **recommended
fashion items and styles** on it, so the user can visualize looks before buying.
Three pillars: (1) avatar generation, (2) fashion recommendation, (3) 3D rendering
of items on the avatar.

## Owner context

- Developer has **some coding experience** — explain non-obvious choices, don't
  assume deep familiarity with 3D graphics or build tooling.
- Prefer simple, well-documented approaches over clever ones.
- When introducing a new library or pattern, briefly say why.

## Tech stack

> Update this section as decisions get locked. Right now most is undecided.

- **Visualization direction:** generated 3D avatar (NOT AI image-gen, NOT full
  cloth simulation). Rotation/viewing of a posed avatar is the target.
- **Avatar generation: parametric (measurements form).** User enters height,
  weight, chest/waist/hip, etc.; a body mesh is generated from those values.
  No photos in v1 (privacy-friendly, simpler). Photo-based realism is a possible
  v2, not now.
- Frontend: **React 19 + Vite 8 + TypeScript** (locked 2026-06-06).
- 3D: **Three.js + react-three-fiber (v9) + drei** (locked 2026-06-06).
- Realistic body: **SMPL** parametric human model (locked 2026-06-06). Offline numpy
  scripts (`tools/smpl/`) convert the licensed `.pkl` and calibrate a measurements→betas
  regressor into `public/smpl/`; the browser (`src/smpl/`, `src/SmplAvatar.tsx`) shapes the
  mesh at runtime. Falls back to the primitive `Avatar` when the assets are absent.
- Backend & recommendation logic: _undecided_

## Conventions

- Language: **TypeScript** (strict mode on).
- Component style: **functional components + hooks**.
- Formatting/linting: _not set up yet (Prettier/ESLint TBD)._
- Folder layout: app source in `src/`, one component per file
  (e.g. `src/SpinningCube.tsx`). Vite entry is `index.html` → `src/main.tsx`.

## Commands

- Install: `npm install`
- Dev server: `npm run dev` (Vite, http://localhost:5173)
- Build: `npm run build` (runs `tsc` type-check, then `vite build` → `dist/`)
- Preview built output: `npm run preview`
- SMPL body pipeline (one-time, after downloading the model — see `tools/smpl/README.md`):
  `pip install -r tools/smpl/requirements.txt`, then `python tools/smpl/convert_smpl.py`
  and `python tools/smpl/calibrate.py`.
- Tests: _TBD_

## Fragile / handle-with-care

> List anything risky to edit as it appears (e.g. 3D rendering code).
- `src/Avatar.tsx` — the humanoid's part sizes/positions are interlocking numbers
  derived from the measurements (retune one ratio and the body can visibly split
  apart). Change them in small steps and eyeball the result.
- Dev gotcha: after *many* hot-reloads in one session the browser can run out of
  WebGL contexts and the 3D view goes blank (console shows "Context Lost"). It is
  NOT a code bug — reload the page (or restart the dev server) for a fresh context.
- SMPL: the model and everything derived from it (`models/`, `public/smpl/`) is gitignored
  for licensing — never commit it. `FEATURES` order in `tools/smpl/calibrate.py` MUST match
  `FEATURE_ORDER` in `src/smpl/shape.ts`. The measurement heuristics in `calibrate.py` are
  approximate and may need tuning against the real model.

## ── WHERE WE LEFT OFF ──

> Keep this current. Update it at the END of every session before stopping.

**Current state:** SMPL realistic body is LIVE and verified end-to-end. User downloaded SMPL
v1.1.0 (neutral) to `SMPL_python_v.1.1.0/` (gitignored); the pipeline has been run, producing
`public/smpl/` (gitignored). `src/SmplAvatar.tsx` renders a real SMPL mesh shaped from the 6
measurements and replaces the primitive `Avatar` (which stays the automatic fallback via the
error boundary in `App.tsx`). Confirmed in-browser: body renders upright + proportional, reshapes
sensibly on Generate, betas stay plausible (no distortion). `npm run build` clean. A Play/Pause
overlay button toggles the turntable auto-rotation (`rotating` state in `App`, passed to both
avatars; gates the `useFrame` spin) — manual drag-to-orbit still works while paused. The body is
posed in a relaxed arms-at-sides stance (no longer a T-pose) via SMPL linear blend skinning.

Implementation notes (handle with care):
- Loader uses a chumpy-free custom unpickler (`tools/smpl/smpl_common.py`) — no chumpy needed.
- measurements→betas (`calibrate.py`): fit the FORWARD map betas→measurements, then invert with a
  *regularised* ridge pseudo-inverse → minimum-distortion betas (clamped ±4 in `src/smpl/shape.ts`).
  A plain fit or an unregularised inverse BOTH produce grossly distorted bodies — don't "simplify"
  back. λ is chosen by accuracy on REALISTIC anchor inputs, not training MAE (which picks a tiny λ
  that extrapolates to giant bodies for off-manifold inputs).
- Measurements use the vertical axis HARD-CODED to Y (`vertical_axis`→1). Do NOT pick the largest-
  extent axis — a T-pose's arm span ≈ height and mis-IDs it (this corrupted every measurement once).
- `inseam` = height of a fixed crotch LANDMARK vertex (`find_crotch_index`) above the floor — NOT a
  leg-gap scan (fails when thighs touch) and NOT a fraction of height (no leg-length signal). Both
  bugs were hit; inseam now drives leg length, not width.
- Shoulder breadth is measured just BELOW the arms (T-pose arms would otherwise read as arm span).
- SMPL is Y-up; `buildBodyGeometry` only recenters feet→y=0 (NO auto up-axis detect — a T-pose's
  arm span fooled it into tipping the body over).
- Accuracy at realistic inputs: height ~±4 cm, waist/hip ~±3 cm, inseam tracks leg length, shoulder
  ~±5 cm, chest ~6 cm low. Changing inseam alone also nudges total height (SMPL's 10 betas can't
  fully decouple leg vs torso length) — acceptable for v1; a nonlinear fit would tighten chest.
- Posing: `src/smpl/pose.ts` does SMPL linear blend skinning (shape → pose). The display uses one
  fixed relaxed pose (`relaxedPose()`: shoulders rotated ~1.2 rad about Z to drop the arms). Pose-
  corrective blend shapes (posedirs) are deliberately SKIPPED (saves a ~17 MB asset; negligible for
  a gentle pose). `calibrate.py` still measures the UNPOSED (rest) mesh, so its T-pose notes stand.

**Next steps:**
1. Decide backend / recommendation approach, and where 3D garment assets come from.
2. Optional: tighten fit (esp. chest) with polynomial features in `calibrate.py`.
3. Optional pose polish: more poses (the picker we discussed) and/or add posedirs if shoulders
   ever look pinched at stronger angles.

**Open questions:**
- Body model is decided: **SMPL** (commercial use needs a paid Meshcapade license — confirm
  before shipping).
- Where do fashion items / 3D garment assets come from?
