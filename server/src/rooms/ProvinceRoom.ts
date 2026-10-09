import { Room, type Client } from "colyseus";
import {
  BUILDINGS,
  Building,
  GameState,
  MAP_SIZE,
  MAX_PLAYERS,
  Player,
  PRODUCTION_TICK_MS,
  RESOURCE_KINDS,
  STARTING_RESOURCES,
  generateMap,
  isBuildingType,
  placementError,
  buildingTiles,
  planBuildLine,
  removalError,
  clearTerrainError,
  Terrain,
  type TileActionMessage,
  type BuildLineMessage,
  type BuildMessage,
  type BuildingType,
  type ErrorMessage,
  type Resources,
  type TileMap,
} from "@ee/shared";

interface JoinOptions {
  name?: string;
}

export class ProvinceRoom extends Room<{ state: GameState }> {
  maxClients = MAX_PLAYERS;
  state = new GameState();

  private map!: TileMap;
  /** "x,y" → building id, for fast occupancy checks. */
  private occupied = new Map<string, string>();
  private nextId = 1;

  onCreate() {
    this.state.seed = Math.floor(Math.random() * 2 ** 31);
    this.map = generateMap(this.state.seed);
    Object.assign(this.state, STARTING_RESOURCES);

    const center = Math.floor(MAP_SIZE / 2);
    this.addBuilding("keep", center, center);

    this.onMessage("build", (client, msg: BuildMessage) => this.handleBuild(client, msg));
    this.onMessage("buildLine", (client, msg: BuildLineMessage) => this.handleBuildLine(client, msg));
    this.onMessage("removeBuilding", (client, msg: TileActionMessage) => this.handleRemoveBuilding(client, msg));
    this.onMessage("clearTerrain", (client, msg: TileActionMessage) => this.handleClearTerrain(client, msg));
    this.clock.setInterval(() => this.produce(), PRODUCTION_TICK_MS);
  }

  onJoin(client: Client, options: JoinOptions = {}) {
    const name = String(options.name ?? "").trim().slice(0, 20) || `Lord ${this.clients.length}`;
    this.state.players.set(client.sessionId, new Player({ name }));
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
  }

  private handleBuild(client: Client, msg: BuildMessage) {
    if (!msg || !isBuildingType(msg.type) || !Number.isInteger(msg.x) || !Number.isInteger(msg.y)) {
      return this.reject(client, "Invalid build command");
    }
    const buildingTypeAt = (x: number, y: number): BuildingType | undefined => {
      const id = this.occupied.get(`${x},${y}`);
      return id === undefined ? undefined : this.state.buildings.get(id)?.type as BuildingType | undefined;
    };
    const error = placementError(this.map, (x, y) => this.occupied.has(`${x},${y}`), buildingTypeAt, this.resources(), msg.type, msg.x, msg.y);
    if (error) return this.reject(client, error);

    const cost = BUILDINGS[msg.type].cost;
    for (const k of RESOURCE_KINDS) this.state[k] -= cost[k] ?? 0;
    this.addBuilding(msg.type, msg.x, msg.y);
  }

  private handleBuildLine(client: Client, msg: BuildLineMessage) {
    if (!msg || (msg.type !== "road" && msg.type !== "wall") || !msg.start || !msg.end) {
      return this.reject(client, "Invalid build line command");
    }
    const lookup = (x: number, y: number): BuildingType | undefined => {
      const id = this.occupied.get(`${x},${y}`);
      return id === undefined ? undefined : this.state.buildings.get(id)?.type as BuildingType | undefined;
    };
    const plan = planBuildLine(this.map, lookup, this.resources(), msg.type, msg.start, msg.end);
    if (plan.error) return this.reject(client, plan.error);

    // Validate the entire route first, so a rejected route spends nothing.
    const cost = BUILDINGS[msg.type].cost;
    for (const resource of RESOURCE_KINDS) this.state[resource] -= (cost[resource] ?? 0) * plan.tiles.length;
    for (const tile of plan.tiles) this.addBuilding(msg.type, tile.x, tile.y);
  }

  private validTileAction(msg: TileActionMessage): boolean {
    return !!msg && Number.isInteger(msg.x) && Number.isInteger(msg.y)
      && msg.x >= 0 && msg.y >= 0 && msg.x < MAP_SIZE && msg.y < MAP_SIZE;
  }

  private handleRemoveBuilding(client: Client, msg: TileActionMessage) {
    if (!this.validTileAction(msg)) return this.reject(client, "Invalid removal command");
    const id = this.occupied.get(`${msg.x},${msg.y}`);
    const building = id === undefined ? undefined : this.state.buildings.get(id);
    const error = removalError(building?.type as BuildingType | undefined);
    if (error) return this.reject(client, error);
    if (!building || id === undefined) return;
    for (const tile of buildingTiles(building.type as BuildingType, building.x, building.y)) {
      this.occupied.delete(`${tile.x},${tile.y}`);
    }
    this.state.buildings.delete(id);
  }

  private handleClearTerrain(client: Client, msg: TileActionMessage) {
    if (!this.validTileAction(msg)) return this.reject(client, "Invalid clearing command");
    const error = clearTerrainError(this.map, (x, y) => this.occupied.has(`${x},${y}`), msg.x, msg.y);
    if (error) return this.reject(client, error);
    this.map[msg.y * MAP_SIZE + msg.x] = Terrain.Grass;
    this.state.terrainOverrides.set(`${msg.x},${msg.y}`, Terrain.Grass);
  }

  private addBuilding(type: BuildingType, x: number, y: number) {
    const id = String(this.nextId++);
    this.state.buildings.set(id, new Building({ id, type, x, y, hp: BUILDINGS[type].hp }));
    for (const tile of buildingTiles(type, x, y)) {
      this.occupied.set(`${tile.x},${tile.y}`, id);
    }
  }

  private produce() {
    for (const b of this.state.buildings.values()) {
      const produces = BUILDINGS[b.type as BuildingType].produces;
      for (const k of RESOURCE_KINDS) this.state[k] += produces[k] ?? 0;
    }
  }

  private resources(): Resources {
    const { food, wood, stone, gold } = this.state;
    return { food, wood, stone, gold };
  }

  private reject(client: Client, message: string) {
    client.send("error", { message } satisfies ErrorMessage);
  }
}
