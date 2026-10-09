import { BUILDINGS, type BuildingType } from "./buildings";
import { canAfford, type Resources } from "./resources";
import { Terrain, terrainAt, type TileMap } from "./terrain";

/** Returns every footprint tile, with x and y as the building's top-left tile. */
export function buildingTiles(type: BuildingType, x: number, y: number): Array<{ x: number; y: number }> {
  const { width, height } = BUILDINGS[type];
  const tiles: Array<{ x: number; y: number }> = [];
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      tiles.push({ x: x + dx, y: y + dy });
    }
  }
  return tiles;
}

/**
 * Shared placement check: the server uses it to validate, the client uses it
 * to colour the placement ghost. Returns an error message, or null if valid.
 */
export function placementError(
  map: TileMap,
  isOccupied: (x: number, y: number) => boolean,
  buildingTypeAt: (x: number, y: number) => BuildingType | undefined,
  resources: Resources,
  type: BuildingType,
  x: number,
  y: number,
): string | null {
  const def = BUILDINGS[type];

  if (def.unbuildable) return `${def.name} can't be built`;

  const tiles = buildingTiles(type, x, y);

  for (const tile of tiles) {
    const terrain = terrainAt(map, tile.x, tile.y);
    if (terrain === undefined) return "Out of bounds";
    if (terrain !== Terrain.Grass) return "Must build on grass";
    if (isOccupied(tile.x, tile.y)) return "Tile is occupied";
  }

  const near = def.near;
  if (near !== undefined) {
    const hasNearbyTerrain = tiles.some((tile) => isNear(map, tile.x, tile.y, near, 2));
    if (!hasNearbyTerrain) return `Must be near ${Terrain[near].toLowerCase()}`;
  }

  // Only edge contact counts; diagonal neighbors don't connect roads.
  if (type !== "wall") {
    const touchesConnection = tiles.some((tile) => {
      const neighbors = [
        buildingTypeAt(tile.x - 1, tile.y),
        buildingTypeAt(tile.x + 1, tile.y),
        buildingTypeAt(tile.x, tile.y - 1),
        buildingTypeAt(tile.x, tile.y + 1),
      ];
      return neighbors.some((neighbor) =>
        neighbor === "road" || (type === "road" && neighbor === "keep")
      );
    });
    if (!touchesConnection) {
      return type === "road" ? "Road must touch the Keep or another road" : "Must touch a road";
    }
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
