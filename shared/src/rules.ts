import { BUILDINGS, type BuildingType } from "./buildings";
import { canAfford, type Resources } from "./resources";
import { Terrain, terrainAt, type TileMap } from "./terrain";

/**
 * Shared placement check: the server uses it to validate, the client uses it
 * to colour the placement ghost. Returns an error message, or null if valid.
 */
export function placementError(
  map: TileMap,
  isOccupied: (x: number, y: number) => boolean,
  resources: Resources,
  type: BuildingType,
  x: number,
  y: number,
): string | null {
  const def = BUILDINGS[type];
  if (def.unbuildable) return `${def.name} can't be built`;
  const terrain = terrainAt(map, x, y);
  if (terrain === undefined) return "Out of bounds";
  if (terrain !== Terrain.Grass) return "Must build on grass";
  if (isOccupied(x, y)) return "Tile is occupied";
  if (def.near !== undefined && !isNear(map, x, y, def.near, 2)) {
    return `Must be near ${Terrain[def.near].toLowerCase()}`;
  }
  if (!canAfford(resources, def.cost)) return "Not enough resources";
  return null;
}

function isNear(map: TileMap, x: number, y: number, terrain: Terrain, radius: number): boolean {
  for (let dy = -radius; dy <= radius; dy++)
    for (let dx = -radius; dx <= radius; dx++)
      if (terrainAt(map, x + dx, y + dy) === terrain) return true;
  return false;
}
