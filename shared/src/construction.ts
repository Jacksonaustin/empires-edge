import { BUILDINGS, type BuildingType } from "./buildings";
import { MAP_SIZE } from "./config";
import { RESOURCE_KINDS, type Resources } from "./resources";
import { placementError } from "./rules";
import type { TileMap } from "./terrain";

export type LineBuildingType = "road" | "wall";
export interface TilePosition { x: number; y: number }

/** Horizontal leg first, then vertical; includes both ends and the corner once. */
export function buildLineTiles(start: TilePosition, end: TilePosition): TilePosition[] {
  const tiles = [{ ...start }];
  let { x, y } = start;
  while (x !== end.x) {
    x += Math.sign(end.x - x);
    tiles.push({ x, y });
  }
  while (y !== end.y) {
    y += Math.sign(end.y - y);
    tiles.push({ x, y });
  }
  return tiles;
}

/** Simulates a complete route without changing state. Existing matching tiles are free. */
export function planBuildLine(
  map: TileMap,
  buildingTypeAt: (x: number, y: number) => BuildingType | undefined,
  resources: Resources,
  type: LineBuildingType,
  start: TilePosition,
  end: TilePosition,
): { tiles: TilePosition[]; error: string | null } {
  // Bound the endpoints before generating a route, including untrusted server input.
  for (const point of [start, end]) {
    if (!Number.isInteger(point.x) || !Number.isInteger(point.y)
      || point.x < 0 || point.y < 0 || point.x >= MAP_SIZE || point.y >= MAP_SIZE) {
      return { tiles: [], error: "Out of bounds" };
    }
  }
  const planned = new Map<string, BuildingType>();
  const remaining = { ...resources };
  const tiles: TilePosition[] = [];
  const lookup = (x: number, y: number) => planned.get(`${x},${y}`) ?? buildingTypeAt(x, y);
  for (const tile of buildLineTiles(start, end)) {
    if (lookup(tile.x, tile.y) === type) continue;
    const error = placementError(map, (x, y) => lookup(x, y) !== undefined, lookup, remaining, type, tile.x, tile.y);
    if (error) return { tiles: [], error };
    planned.set(`${tile.x},${tile.y}`, type);
    for (const resource of RESOURCE_KINDS) remaining[resource] -= BUILDINGS[type].cost[resource] ?? 0;
    tiles.push(tile);
  }
  return { tiles, error: null };
}
