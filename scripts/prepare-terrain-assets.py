"""Normalize generated terrain tiles and derive cosmetic river banks; needs Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw

ASSETS = Path(__file__).resolve().parents[1] / "client/public/assets/terrain"
source = Image.open(ASSETS / "terrain-source-v1.png").convert("RGB")
tiles = []
for row in range(4):
    for column in range(4):
        # Trim the thin cell separators that the generator added.
        box = (round(column * source.width / 4) + 3, round(row * source.height / 4) + 3,
               round((column + 1) * source.width / 4) - 3,
               round((row + 1) * source.height / 4) - 3)
        tiles.append(source.crop(box).resize((32, 32), Image.Resampling.NEAREST))

def average(colors):
    return tuple(round(sum(c[channel] for c in colors) / len(colors)) for channel in range(3))

# Give all four variants the same opposing edge pixels for seamless repeats.
for start in (0, 12):
    base = tiles[start].copy()
    for i in range(32):
        horizontal = average((base.getpixel((0, i)), base.getpixel((31, i))))
        vertical = average((base.getpixel((i, 0)), base.getpixel((i, 31))))
        for tile in tiles[start:start + 4]:
            for x in (0, 31):
                tile.putpixel((x, i), horizontal)
            for y in (0, 31):
                tile.putpixel((i, y), vertical)
    corner = average([base.getpixel(p) for p in ((0, 0), (31, 0), (0, 31), (31, 31))])
    for tile in tiles[start:start + 4]:
        for p in ((0, 0), (31, 0), (0, 31), (31, 31)):
            tile.putpixel(p, corner)

# Sample exposed earth from the art itself for the narrow shore lip.
earth = [tiles[0].getpixel((x, y)) for y in range(32) for x in range(32)
         if tiles[0].getpixel((x, y))[0] > tiles[0].getpixel((x, y))[1]
         and tiles[0].getpixel((x, y))[2] < tiles[0].getpixel((x, y))[1]]
sand = average(earth) if earth else tiles[8].getpixel((16, 16))
frames = tiles[:12]
for variant in range(4):
    for neighbors in range(16):
        tile = tiles[12 + variant].copy()
        draw = ImageDraw.Draw(tile)
        grass = tiles[variant]
        for bit, shore, bank in (
            (1, (0, 0, 31, 2), (0, 0, 32, 2)),
            (2, (29, 0, 31, 31), (30, 0, 32, 32)),
            (4, (0, 29, 31, 31), (0, 30, 32, 32)),
            (8, (0, 0, 2, 31), (0, 0, 2, 32)),
        ):
            if not neighbors & bit:
                draw.rectangle(shore, fill=sand)
                tile.paste(grass.crop(bank), bank[:2])
        frames.append(tile)

# Four columns: 12 ground frames followed by 4 × 16 river masks = 76 frames.
atlas = Image.new("RGB", (128, 608))
for index, frame in enumerate(frames):
    atlas.paste(frame, ((index % 4) * 32, (index // 4) * 32))
atlas.save(ASSETS / "terrain.png")

# A larger nearest-neighbor preview of the sixteen source tiles for inspection.
preview = Image.new("RGB", (128, 128))
for index, tile in enumerate(tiles):
    preview.paste(tile, ((index % 4) * 32, (index // 4) * 32))
preview.resize((512, 512), Image.Resampling.NEAREST).save(ASSETS / "terrain-preview.png")
