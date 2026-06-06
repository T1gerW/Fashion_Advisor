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
- Frontend: _undecided (leaning React)_
- 3D: _undecided (leaning Three.js / react-three-fiber)_
- Backend & recommendation logic: _undecided_

## Conventions

> Fill in as the codebase forms. Examples to decide on:
- Language: TypeScript vs JavaScript
- Component style (functional components + hooks assumed for React)
- Formatting/linting (Prettier, ESLint)
- Folder layout

## Commands

> Update once these exist.
- Install: `npm install`
- Dev server: `npm run dev`
- Tests: _TBD_
- Build: _TBD_

## Fragile / handle-with-care

> List anything risky to edit as it appears (e.g. 3D rendering code).
- _Nothing yet._

## ── WHERE WE LEFT OFF ──

> Keep this current. Update it at the END of every session before stopping.

**Current state:** Repo scaffolding only. README + this file created.

**Next steps:**
1. Lock the frontend + 3D library choice.
2. Scaffold a runnable app skeleton (blank page that loads).
3. Get a basic 3D scene rendering (a placeholder shape that rotates).
4. Then: replace placeholder with a basic avatar.

**Open questions:**
- How is the avatar generated — measurements form, photo-based, or a third-party
  avatar SDK? This is the biggest unknown and shapes everything.
- Where do fashion items / 3D garment assets come from?
