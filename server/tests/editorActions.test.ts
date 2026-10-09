import assert from "node:assert/strict";
import test from "node:test";
import { Decoder, Encoder } from "@colyseus/schema";
import { GameState, MAP_SIZE, STARTING_RESOURCES, Terrain, buildingTiles, generateMap, type BuildingType, type TileActionMessage } from "@ee/shared";
import { ProvinceRoom } from "../src/rooms/ProvinceRoom";

interface Harness {
  state: GameState;
  map: Uint8Array;
  occupied: Map<string, string>;
  addBuilding(type: BuildingType, x: number, y: number): void;
  handleRemoveBuilding(client: unknown, message: TileActionMessage): void;
  handleClearTerrain(client: unknown, message: TileActionMessage): void;
  produce(): void;
}

function fixture() {
  // Exercise room handlers without starting Colyseus timers or networking.
  const target = Object.create(ProvinceRoom.prototype);
  Object.defineProperty(target, "state", { value: new GameState(), writable: true });
  const room = Object.assign(target, {
    map: new Uint8Array(MAP_SIZE * MAP_SIZE),
    occupied: new Map<string, string>(), nextId: 1,
  }) as Harness;
  Object.assign(room.state, STARTING_RESOURCES);
  const errors: string[] = [];
  const client = { send: (_type: string, message: { message: string }) => errors.push(message.message) };
  return { room, client, errors };
}

test("clicking a far footprint tile removes the whole building and stops production", () => {
  const { room, client, errors } = fixture();
  room.addBuilding("house", 10, 10);
  room.handleRemoveBuilding(client, { x: 11, y: 11 });
  assert.equal(room.state.buildings.size, 0);
  for (const tile of buildingTiles("house", 10, 10)) assert.equal(room.occupied.has(`${tile.x},${tile.y}`), false);
  room.produce();
  assert.equal(room.state.gold, 0);
  assert.deepEqual(errors, []);
});

test("the Keep is protected and empty or invalid removal commands are rejected", () => {
  const { room, client, errors } = fixture();
  room.addBuilding("keep", 10, 10);
  room.handleRemoveBuilding(client, { x: 13, y: 13 });
  assert.equal(room.state.buildings.size, 1);
  assert.equal(room.occupied.size, 16);
  room.handleRemoveBuilding(client, { x: 30, y: 30 });
  room.handleRemoveBuilding(client, { x: -1, y: 0 });
  assert.deepEqual(errors, ["The Keep can't be removed", "No building here", "Invalid removal command"]);
});

test("forest and mountain clearing is synced, spends nothing, and cannot repeat", () => {
  const { room, client, errors } = fixture();
  room.state.wood = 42;
  for (const [x, terrain] of [[5, Terrain.Forest], [6, Terrain.Mountain]]) {
    room.map[5 * MAP_SIZE + x] = terrain;
    room.handleClearTerrain(client, { x, y: 5 });
    assert.equal(room.map[5 * MAP_SIZE + x], Terrain.Grass);
    assert.equal(room.state.terrainOverrides.get(`${x},5`), Terrain.Grass);
  }
  assert.equal(room.state.wood, 42);
  room.handleClearTerrain(client, { x: 5, y: 5 });
  assert.deepEqual(errors, ["This tile is already clear"]);

  // The same schema snapshot is used by new clients when joining a room.
  const decoder = new Decoder(new GameState());
  decoder.decode(new Encoder(room.state).encodeAll());
  assert.equal(decoder.state.terrainOverrides.get("5,5"), Terrain.Grass);
  assert.equal(decoder.state.terrainOverrides.get("6,5"), Terrain.Grass);
});

test("rivers, occupied tiles, and invalid terrain coordinates cannot be cleared", () => {
  const { room, client, errors } = fixture();
  room.map[5 * MAP_SIZE + 5] = Terrain.River;
  room.addBuilding("house", 10, 10);
  room.handleClearTerrain(client, { x: 5, y: 5 });
  room.handleClearTerrain(client, { x: 11, y: 11 });
  room.handleClearTerrain(client, { x: 0.5, y: 0 });
  assert.equal(room.state.terrainOverrides.size, 0);
  assert.equal(room.map[5 * MAP_SIZE + 5], Terrain.River);
  assert.deepEqual(errors, ["Rivers can't be cleared", "Remove the building first", "Invalid clearing command"]);
});

test("terrain overrides survive both subsequent patches and late joins", () => {
  const { room, client } = fixture();
  room.state.seed = 123;
  room.map = generateMap(room.state.seed);
  const index = room.map.findIndex((terrain) => terrain === Terrain.Forest);
  assert.ok(index >= 0);
  const tile = { x: index % MAP_SIZE, y: Math.floor(index / MAP_SIZE) };
  const encoder = new Encoder(room.state);
  const decoder = new Decoder(new GameState());
  decoder.decode(encoder.encodeAll());
  encoder.discardChanges();
  room.handleClearTerrain(client, tile);
  decoder.decode(encoder.encode());
  assert.equal(decoder.state.terrainOverrides.get(`${tile.x},${tile.y}`), Terrain.Grass);
  const lateJoin = new Decoder(new GameState());
  lateJoin.decode(encoder.encodeAll());
  const map = generateMap(lateJoin.state.seed);
  lateJoin.state.terrainOverrides.forEach((terrain, key) => {
    const [x, y] = key.split(",").map(Number);
    map[y * MAP_SIZE + x] = terrain;
  });
  assert.equal(map[index], Terrain.Grass);
});
