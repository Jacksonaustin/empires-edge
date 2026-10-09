import assert from "node:assert/strict";
import test from "node:test";
import { BUILDINGS, type BuildingType } from "../src/buildings";
import { buildLineTiles, planBuildLine } from "../src/construction";
import { MAP_SIZE } from "../src/config";
import { buildingTiles } from "../src/rules";
import { Terrain } from "../src/terrain";

function fixture() {
  const map = new Uint8Array(MAP_SIZE * MAP_SIZE);
  const occupied = new Map<string, BuildingType>();
  for (const tile of buildingTiles("keep", 10, 10)) occupied.set(`${tile.x},${tile.y}`, "keep");
  const resources = { food: 1000, wood: 1000, stone: 1000, gold: 1000 };
  const lookup = (x: number, y: number) => occupied.get(`${x},${y}`);
  return { map, occupied, resources, lookup };
}

test("routes include both ends, have one right-angle bend, and never skip tiles", () => {
  for (const end of [{ x: 5, y: 6 }, { x: 1, y: 1 }, { x: 3, y: 6 }, { x: 3, y: 4 }]) {
    const start = { x: 3, y: 4 };
    const tiles = buildLineTiles(start, end);
    assert.deepEqual(tiles[0], start);
    assert.deepEqual(tiles.at(-1), end);
    assert.equal(tiles.length, Math.abs(end.x - start.x) + Math.abs(end.y - start.y) + 1);
    assert.equal(new Set(tiles.map((t) => `${t.x},${t.y}`)).size, tiles.length);
    for (let i = 1; i < tiles.length; i++) {
      assert.equal(Math.abs(tiles[i].x - tiles[i - 1].x) + Math.abs(tiles[i].y - tiles[i - 1].y), 1);
    }
    assert.ok(tiles.some((t) => t.x === end.x && t.y === start.y));
  }
});

test("new roads connect to preceding planned tiles without mutating state", () => {
  const f = fixture();
  const before = new Map(f.occupied);
  const resourcesBefore = { ...f.resources };
  const plan = planBuildLine(f.map, f.lookup, f.resources, "road", { x: 14, y: 12 }, { x: 17, y: 15 });
  assert.equal(plan.error, null);
  assert.equal(plan.tiles.length, 7);
  assert.deepEqual(f.occupied, before);
  assert.deepEqual(f.resources, resourcesBefore);
});

test("an existing road can anchor the route and is not charged again", () => {
  const f = fixture();
  f.occupied.set("14,12", "road");
  const plan = planBuildLine(f.map, f.lookup, f.resources, "road", { x: 14, y: 12 }, { x: 16, y: 12 });
  assert.equal(plan.error, null);
  assert.deepEqual(plan.tiles, [{ x: 15, y: 12 }, { x: 16, y: 12 }]);
});

test("disconnected and diagonally connected roads are rejected", () => {
  const f = fixture();
  for (const start of [{ x: 30, y: 30 }, { x: 14, y: 14 }]) {
    const plan = planBuildLine(f.map, f.lookup, f.resources, "road", start, start);
    assert.match(plan.error!, /must touch/);
    assert.deepEqual(plan.tiles, []);
  }
});

test("a blocked tile rejects the entire route", () => {
  const f = fixture();
  f.map[12 * MAP_SIZE + 16] = Terrain.Forest;
  const plan = planBuildLine(f.map, f.lookup, f.resources, "road", { x: 14, y: 12 }, { x: 17, y: 12 });
  assert.equal(plan.error, "Must build on grass");
  assert.deepEqual(plan.tiles, []);
});

test("the entire route must be affordable", () => {
  const f = fixture();
  f.resources.wood = BUILDINGS.road.cost.wood! * 2;
  const plan = planBuildLine(f.map, f.lookup, f.resources, "road", { x: 14, y: 12 }, { x: 16, y: 12 });
  assert.equal(plan.error, "Not enough resources");
  assert.deepEqual(plan.tiles, []);
});

test("walls can be placed away from roads, but cannot cross other buildings", () => {
  const f = fixture();
  assert.equal(planBuildLine(f.map, f.lookup, f.resources, "wall", { x: 30, y: 30 }, { x: 32, y: 32 }).error, null);
  f.occupied.set("31,30", "house");
  assert.equal(planBuildLine(f.map, f.lookup, f.resources, "wall", { x: 30, y: 30 }, { x: 32, y: 32 }).error, "Tile is occupied");
});

test("invalid endpoints are rejected before route generation", () => {
  const f = fixture();
  for (const end of [{ x: Infinity, y: 0 }, { x: 1.5, y: 0 }, { x: MAP_SIZE, y: 0 }, { x: -1, y: 0 }]) {
    assert.equal(planBuildLine(f.map, f.lookup, f.resources, "wall", { x: 0, y: 0 }, end).error, "Out of bounds");
  }
});
