# Building sprites

These sprites are loaded by `WorldScene.preload()` and replace the building
placeholder rectangles. `PhaserGame` enables `pixelArt: true`. Footprints,
placement previews, server commands and gameplay rules are unchanged.

| Runtime file | Dimensions | Building footprint |
| --- | --- | --- |
| keep.png | 128 × 128 px | 4 × 4 tiles |
| farm.png | 96 × 96 px | 3 × 3 tiles |
| lumberCamp.png | 64 × 64 px | 2 × 2 tiles |
| quarry.png | 96 × 96 px | 3 × 3 tiles |
| house.png | 64 × 64 px | 2 × 2 tiles |
| watchtower.png | 64 × 64 px | 2 × 2 tiles |
| road.png | 512 × 32 px; sixteen 32px frames | 1 × 1 tile |
| wall.png | 512 × 32 px; sixteen 32px frames | 1 × 1 tile |

All images have transparency. Building art is cropped and resized with
nearest-neighbor sampling, preserving proportions inside the existing footprint.
The source is detailed AI-generated artwork, rather than hand-drawn native
32px pixel art; these PNGs can be replaced as better art becomes available.

## Road and wall connections

Frame numbers are four-bit neighbor masks: north = 1, east = 2, south = 4,
west = 8. Frame 0 is isolated; frame 15 connects in all four directions.
Only adjacent buildings of the same type connect. The renderer refreshes the
changed tile and its four neighbors on addition/removal, including initial room
state. Connections only affect appearance.

Connection PNGs use material from the generated cross tiles with exact masks
and matching opposite edge pixels so straight runs and corners join cleanly.

## Sources and rebuilding

`buildings-sheet-v1.png` (887 × 1774 px) and `connections-source-v1.png`
are the original transparent sheets produced with built-in imagegen. Their
generation prompts are saved in the matching `.prompt.txt` files. These source
sheets are kept for editing and are not loaded by Phaser.

To reproduce the runtime PNGs from the sources, run from the repository root
using a Python environment with Pillow installed:

```sh
python3 scripts/prepare-building-assets.py
```

The script contains the crop bounds for the actual building sheet, since the
generator did not follow the requested fixed cell dimensions. After changing
source art, review those bounds and inspect the resized results.
