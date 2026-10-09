"""Crop and nearest-neighbor resize the checked-in generated art (requires Pillow)."""
from pathlib import Path
from PIL import Image, ImageDraw

ASSETS = Path(__file__).resolve().parents[1] / "client/public/assets/buildings"
SOURCE = Image.open(ASSETS / "buildings-sheet-v1.png").convert("RGBA")
# The generator did not honor cell sizes. These boxes follow the actual art.
BUILDINGS = {
    "keep": ((35, 45, 445, 485), 128),
    "farm": ((485, 80, 870, 485), 96),
    "lumberCamp": ((40, 570, 415, 935), 64),
    "quarry": ((445, 520, 882, 990), 96),
    "house": ((50, 995, 425, 1385), 64),
    "watchtower": ((530, 990, 825, 1400), 64),
}

for name, (box, size) in BUILDINGS.items():
    sprite = SOURCE.crop(box)
    bounds = sprite.getchannel("A").point(lambda a: 255 if a > 24 else 0).getbbox()
    sprite = sprite.crop(bounds)
    scale = min((size - 2) / sprite.width, (size - 2) / sprite.height)
    sprite = sprite.resize((round(sprite.width * scale), round(sprite.height * scale)), Image.Resampling.NEAREST)
    canvas = Image.new("RGBA", (size, size))
    canvas.alpha_composite(sprite, ((size - sprite.width) // 2, size - sprite.height - 1))
    canvas.save(ASSETS / f"{name}.png")

# Normalize the generated cross tiles into a shared material for all masks.
# Exact square masks guarantee centered, matching edges despite source padding.
connections = Image.open(ASSETS / "connections-source-v1.png").convert("RGBA")
for column, name in enumerate(("road", "wall")):
    box = (round(column * connections.width / 2), round(5 * connections.height / 6),
           round((column + 1) * connections.width / 2), connections.height)
    cross = connections.crop(box)
    bounds = cross.getchannel("A").point(lambda a: 255 if a > 24 else 0).getbbox()
    cross = cross.crop(bounds).resize((32, 32), Image.Resampling.NEAREST)
    # Fill irregular source edges with the same central material before masking.
    material = cross.crop((10, 10, 22, 22)).resize((32, 32), Image.Resampling.NEAREST)
    material.putalpha(255)
    material.alpha_composite(cross)
    material.putalpha(255)
    # Matching opposing edge pixels make every connection seamless.
    for i in range(32):
        material.putpixel((31, i), material.getpixel((0, i)))
        material.putpixel((i, 31), material.getpixel((i, 0)))
    atlas = Image.new("RGBA", (32 * 16, 32))
    for mask in range(16):
        alpha = Image.new("L", (32, 32))
        draw = ImageDraw.Draw(alpha)
        draw.rectangle((8, 8, 23, 23), fill=255)
        for bit, arm in ((1, (8, 0, 23, 7)), (2, (24, 8, 31, 23)),
                         (4, (8, 24, 23, 31)), (8, (0, 8, 7, 23))):
            if mask & bit:
                draw.rectangle(arm, fill=255)
        tile = material.copy()
        tile.putalpha(alpha)
        atlas.alpha_composite(tile, (mask * 32, 0))
    atlas.save(ASSETS / f"{name}.png")
