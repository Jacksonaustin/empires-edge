# Edge of Empire

A 2-player cooperative frontier defense game for the browser. Build up a shared province, keep the distant Empire satisfied, and hold the Keep against escalating barbarian raids.

> 🚧 Early development. Built for a one-month game challenge.

## Gameplay

- **Build** a Keep, Farms, Lumber Camps, Quarries, Houses, Walls, and Watchtowers
- **Gather** food, wood, stone, and gold from a shared economy
- **Serve the Empire** by fulfilling resource requests to earn Imperial Favor and unlock stronger troops
- **Defend** with Levies, walls, and towers against barbarian waves that grow stronger over time

**Win:** survive the final major attack. **Lose:** the Keep is destroyed.

## Multiplayer

Two players join the same game and share one province. Either player can build and command troops. The server is authoritative over game state.

## Getting Started

Requires Node 20+.

```bash
npm install
npm run dev
```

Open http://localhost:5173, click **Create game**, then open a second window and join with the code shown in the top bar.

## Project Layout

| Folder | What it is |
|--------|------------|
| `client/` | React HUD + Phaser world (Vite) |
| `server/` | Colyseus game server, the source of truth |
| `shared/` | Map generation, building data, rules, and synced state used by both |

Gameplay numbers live in `shared/src/config.ts` and `shared/src/buildings.ts`.

## License

[MIT](LICENSE)
