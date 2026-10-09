import { schema, t, type SchemaType } from "@colyseus/schema";

export const Building = schema({
  id: t.string(),
  type: t.string(),
  x: t.uint8(),
  y: t.uint8(),
  hp: t.uint16(),
}, "Building");
export type Building = SchemaType<typeof Building>;

export const Player = schema({
  name: t.string(),
}, "Player");
export type Player = SchemaType<typeof Player>;

export const GameState = schema({
  seed: t.uint32(),
  food: t.number(),
  wood: t.number(),
  stone: t.number(),
  gold: t.number(),
  buildings: t.map(Building),
  /** Sparse edits to the seeded terrain, keyed by "x,y". */
  terrainOverrides: t.map("uint8"),
  players: t.map(Player),
}, "GameState");
export type GameState = SchemaType<typeof GameState>;
