import type { Cost, Resources } from "./resources";
import { Terrain } from "./terrain";

export type BuildingType = "keep" | "farm" | "lumberCamp" | "quarry" | "house" | "wall" | "watchtower";

export interface BuildingDef {
  name: string;
  cost: Cost;
  /** Resources produced every production tick. */
  produces: Partial<Resources>;
  hp: number;
  color: number;
  /** Players can't place it (e.g. the Keep, which the server spawns). */
  unbuildable?: boolean;
  /** Must be within 2 tiles of this terrain. */
  near?: Terrain;
}

export const BUILDINGS: Record<BuildingType, BuildingDef> = {
  keep:       { name: "Keep",        cost: {},                    produces: { food: 1, wood: 1 }, hp: 1000, color: 0xc9a227, unbuildable: true },
  farm:       { name: "Farm",        cost: { wood: 20 },          produces: { food: 2 },          hp: 100,  color: 0xe0c060 },
  lumberCamp: { name: "Lumber Camp", cost: { wood: 30 },          produces: { wood: 2 },          hp: 120,  color: 0x8b5a2b, near: Terrain.Forest },
  quarry:     { name: "Quarry",      cost: { wood: 40 },          produces: { stone: 1 },         hp: 150,  color: 0xa0a0a0, near: Terrain.Mountain },
  house:      { name: "House",       cost: { wood: 25, stone: 5 }, produces: { gold: 1 },         hp: 100,  color: 0xb5651d },
  wall:       { name: "Wall",        cost: { stone: 5 },          produces: {},                   hp: 300,  color: 0x55534e },
  watchtower: { name: "Watchtower",  cost: { wood: 30, stone: 30 }, produces: {},                 hp: 250,  color: 0x6b4f3a },
};

export const BUILDABLE_TYPES = (Object.keys(BUILDINGS) as BuildingType[]).filter((t) => !BUILDINGS[t].unbuildable);

export function isBuildingType(value: unknown): value is BuildingType {
  return typeof value === "string" && value in BUILDINGS;
}
