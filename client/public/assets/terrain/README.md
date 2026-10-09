# Terrain sprites

`terrain.png` is the runtime atlas: 128 × 608 pixels, four columns of 32px tiles.
Its built-in imagegen source was styled against the building sheet, then cropped
and normalized with nearest-neighbor sampling. The source, generation prompt,
and enlarged sixteen-tile preview are kept alongside the atlas.

Frame layout:

- 0–3: four grass variants.
- 4–7: four tree-covered forest variants.
- 8–11: four rocky mountain variants.
- 12–75: four water variants, each with sixteen cosmetic riverbank masks.

The river mask uses connected neighbors: north = 1, east = 2, south = 4,
west = 8. Frame = 12 + variant × 16 + mask. Missing connections add a narrow
grass/earth bank sampled from the generated art. Connections outside the map
stay open, allowing the river to leave the world without an artificial end cap.
Opposite grass and water edge pixels match across variants for seamless repeats.

`client/src/game/terrainFrame.ts` selects variants deterministically from tile
coordinates and reads river neighbors from the existing map. The seeded map,
terrain enum, tile size and gameplay rules are unchanged. The whole river tile
still counts as river even where its artwork shows a cosmetic bank.

`WorldScene` renders the atlas through a normal Phaser TilemapLayer with camera
culling and keeps the existing faint grid above it. Terrain-clearing callbacks
replace a single tile in that layer; they do not accumulate Graphics overlays.
Joining an existing room applies its terrain overrides before creating the layer.

To rebuild the atlas, use a Python environment with Pillow, from the repo root:

```sh
python3 scripts/prepare-terrain-assets.py
```

Review the source grid and crop bounds before replacing the source image.
The source and preview images are not loaded by the game.
