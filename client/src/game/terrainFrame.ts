import { MAP_SIZE, Terrain, type TileMap } from "@ee/shared";

/** Atlas layout: 4 grass, 4 forest, 4 mountain, then 4 × 16 river banks. */
export function terrainFrame(map: TileMap, x: number, y: number): number {
  const terrain = map[y * MAP_SIZE + x] as Terrain;
  const hash = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  const variant = Math.floor((hash - Math.floor(hash)) * 4);
  if (terrain !== Terrain.River) return terrain * 4 + variant;

  // Shorelines are cosmetic. The entire river tile remains impassable.
  const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
  let neighbors = 0;
  directions.forEach(([dx, dy], index) => {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= MAP_SIZE || ny >= MAP_SIZE
      || map[ny * MAP_SIZE + nx] === Terrain.River) neighbors |= 1 << index;
  });
  return 12 + variant * 16 + neighbors;
}
