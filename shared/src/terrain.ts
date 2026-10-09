import { MAP_SIZE, STARTING_FIELD_MARGIN } from "./config";
import { BUILDINGS } from "./buildings";
import { Terrain } from "./terrainTypes";
export { Terrain } from "./terrainTypes";

export const TERRAIN_COLORS: Record<Terrain, number> = {
  [Terrain.Grass]: 0x6a9c4a,
  [Terrain.Forest]: 0x2f5d2a,
  [Terrain.Mountain]: 0x7d7468,
  [Terrain.River]: 0x3a78b5,
};

/** Small seeded PRNG so server and clients generate the same map from a seed. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bilinear value noise sampled on a coarse random grid. */
function valueNoise(rand: () => number, size: number, cell: number): number[] {
  const g = Math.ceil(size / cell) + 2;
  const grid = Array.from({ length: g * g }, rand);
  const out = new Array<number>(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const gx = x / cell, gy = y / cell;
      const x0 = Math.floor(gx), y0 = Math.floor(gy);
      const fx = gx - x0, fy = gy - y0;
      const a = grid[y0 * g + x0], b = grid[y0 * g + x0 + 1];
      const c = grid[(y0 + 1) * g + x0], d = grid[(y0 + 1) * g + x0 + 1];
      out[y * size + x] = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
    }
  }
  return out;
}

export type TileMap = Uint8Array;

export function generateMap(seed: number, size = MAP_SIZE): TileMap {
  const rand = mulberry32(seed);
  const tiles = new Uint8Array(size * size);
  const forest = valueNoise(rand, size, 8);
  const rock = valueNoise(rand, size, 10);

  for (let i = 0; i < tiles.length; i++) {
    if (rock[i] > 0.72) tiles[i] = Terrain.Mountain;
    else if (forest[i] > 0.6) tiles[i] = Terrain.Forest;
  }

  // A river wanders top to bottom, kept off to one side of the Keep.
  const side = rand() < 0.5 ? 0.2 : 0.75;
  let rx = Math.floor(size * side + rand() * size * 0.1);
  for (let y = 0; y < size; y++) {
    rx = Math.max(1, Math.min(size - 3, rx + Math.round(rand() * 2 - 1)));
    tiles[y * size + rx] = Terrain.River;
    tiles[y * size + rx + 1] = Terrain.River;
  }

  // Clear open ground around the Keep.
  const c = Math.floor(size / 2);
  const margin = STARTING_FIELD_MARGIN;
  const left = Math.max(0, c - margin);
  const top = Math.max(0, c - margin);
  const right = Math.min(size, c + BUILDINGS.keep.width + margin);
  const bottom = Math.min(size, c + BUILDINGS.keep.height + margin);
  
  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) {
      tiles[y * size + x] = Terrain.Grass;
    }
  }
  return tiles;
}

export function terrainAt(map: TileMap, x: number, y: number, size = MAP_SIZE): Terrain | undefined {
  if (x < 0 || y < 0 || x >= size || y >= size) return undefined;
  return map[y * size + x] as Terrain;
}
