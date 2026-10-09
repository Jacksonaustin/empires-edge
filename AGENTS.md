# Edge of Empire: AI Assistant Guide

Shared rules for every AI assistant on this repo (Claude Code, Codex, etc.).

## Project

2-player co-op frontier defense game for the browser, built for a one-month challenge. See `README.md` for the game design.

- `client/`: React (HUD/menus) + Phaser 4 (game world), Vite
- `server/`: Colyseus room, authoritative game state
- `shared/`: map generation, building data, placement rules, synced schema

Commands: `npm run dev` (server :2567 + client :5173), `npm run typecheck`, `npm run build -w client`.

## Architecture rules

- **Server is authoritative.** Clients only render state and send commands (`room.send(...)`). Never change game state on the client.
- **Validate on the server, reuse on the client.** Rules go in `shared/` so the server validates and the client can preview (e.g. `placementError`).
- **Tuning numbers live in `shared/src/config.ts` and `shared/src/buildings.ts`**, not hardcoded in logic.
- **React only gets slow-changing data** (resources, selection, menus) through the Zustand store. Per-frame data (unit positions) stays in Phaser.
- Server port env var is `SERVER_PORT`, not `PORT`.

## Scope: the developer is here to learn

The developer writes the core gameplay code themselves. Assistants **must not write implementation code** for these systems unless the developer explicitly asks ("just write it", "do this one"):

1. Combat, unit movement, and pathfinding
2. Barbarian waves and targeting
3. Empire requests and Imperial Favor
4. Balancing and game feel
5. Sprites and art (the developer draws them)
6. Deployment: Dockerfile, hosting, domains/TLS, cluster setup. Guide step by step; the developer runs the commands and writes the config.

For those areas:
- Explain concepts, point to relevant files, and suggest approaches.
- Review the developer's diffs for bugs and design problems.
- When they're stuck, **hint first**. Give the full answer only when asked.

Assistants **may write code directly** for plumbing: build/tooling config, networking/Colyseus issues, the asset-loading pipeline (spritesheets, atlases, animations), UI wiring, and bug fixes the developer asks for.

When unsure which side a task falls on, ask.

## Working alongside other assistants

- One assistant per task. Never have two assistants editing the same files at once.
- Don't commit or push unless the developer asks.
- Keep changes small and focused so the developer can review them.

## Art

- Current visuals are placeholders (colored tiles and squares). Keep sprite sizes compatible with `TILE_SIZE` (32px; 16px art scaled 2× also works).
- Pixel art must render crisp: use `pixelArt: true` in the Phaser config when sprites are added.
