import * as Phaser from "phaser";
import { Callbacks, type Room } from "@colyseus/sdk";
import {
  BUILDINGS,
  MAP_SIZE,
  TILE_SIZE,
  generateMap,
  placementError,
  type Building,
  type BuildingType,
  type GameState,
  type TileMap,
  buildingTiles,
  buildLineTiles,
  planBuildLine,
  removalError,
  clearTerrainError,
  type LineBuildingType,
  type TilePosition,
} from "@ee/shared";
import { useGame } from "../store";
import { terrainFrame } from "./terrainFrame";

const PAN_SPEED = 600; // px per second at zoom 1
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;
const DRAG_THRESHOLD = 6;

/**
 * Renders the shared world. It never changes game state directly: it only
 * draws what the server says and sends commands back.
 */
export class WorldScene extends Phaser.Scene {
  private map!: TileMap;
  private sprites = new Map<string, Phaser.GameObjects.Container>();
  private lineSprites = new Map<string, Phaser.GameObjects.Image>();
  /** "x,y" → type of the building covering that tile. Kept in sync with state. */
  private occupied = new Map<string, BuildingType>();
  private ghost!: Phaser.GameObjects.Rectangle;
  private terrainLayer!: Phaser.Tilemaps.TilemapLayer;
  private linePreview!: Phaser.GameObjects.Graphics;
  private lineStart: { type: LineBuildingType; tile: TilePosition } | null = null;
  private keys!: Record<"up" | "down" | "left" | "right" | "w" | "a" | "s" | "d", Phaser.Input.Keyboard.Key>;
  private dragStart: { x: number; y: number; scrollX: number; scrollY: number } | null = null;
  private dragged = false;
  private unsubscribers: Array<() => void> = [];
  private detached = false;

  constructor(private room: Room<any, GameState>) {
    super("world");
  }

  preload() {
    this.load.image("terrain", `${import.meta.env.BASE_URL}assets/terrain/terrain.png`);
    for (const type of Object.keys(BUILDINGS) as BuildingType[]) {
      const url = `${import.meta.env.BASE_URL}assets/buildings/${type}.png`;
      if (type === "road" || type === "wall") {
        this.load.spritesheet(type, url, { frameWidth: TILE_SIZE, frameHeight: TILE_SIZE });
      } else {
        this.load.image(type, url);
      }
    }
  }

  create() {
    if (this.detached) return;
    const start = () => this.buildWorld();
    if (this.room.state?.seed) start();
    else {
      this.room.onStateChange.once(start);
      this.unsubscribers.push(() => this.room.onStateChange.remove(start));
    }
  }

  /**
   * Stop listening to the room. Called by React on unmount: Phaser destroys
   * games lazily (next frame), so scene events can come too late to rely on.
   */
  detach() {
    this.detached = true;
    this.unsubscribers.forEach((u) => u());
    this.unsubscribers = [];
  }

  private buildWorld() {
    this.map = generateMap(this.room.state.seed);
    this.room.state.terrainOverrides.forEach((terrain, key) => {
      const [x, y] = key.split(",").map(Number);
      this.map[y * MAP_SIZE + x] = terrain;
    });
    this.drawTerrain();
    this.setupCamera();
    this.setupInput();

    this.ghost = this.add.rectangle(0, 0, TILE_SIZE, TILE_SIZE).setOrigin(0).setDepth(10).setVisible(false);
    this.linePreview = this.add.graphics().setDepth(10);
    this.unsubscribers.push(useGame.subscribe((state, previous) => {
      if (state.selectedBuild !== previous.selectedBuild || state.selectedTool !== previous.selectedTool) this.cancelLine();
    }));

    const callbacks = Callbacks.get(this.room);
    this.unsubscribers.push(
      callbacks.onAdd("terrainOverrides", (terrain, key) => {
        const [x, y] = key.split(",").map(Number);
        this.map[y * MAP_SIZE + x] = terrain;
        this.terrainLayer.putTileAt(terrainFrame(this.map, x, y), x, y, false);
      }),
      callbacks.onAdd("buildings", (b, id) => {
        for (const tile of buildingTiles(b.type as BuildingType, b.x, b.y)) {
          this.occupied.set(`${tile.x},${tile.y}`, b.type as BuildingType);
        }
        this.addBuildingSprite(id, b);
        if (b.type === "road" || b.type === "wall") this.refreshLineSprites(b.x, b.y);
      }),
      callbacks.onRemove("buildings", (b, id) => {
        this.sprites.get(id)?.destroy();
        this.sprites.delete(id);
        for (const tile of buildingTiles(b.type as BuildingType, b.x, b.y)) {
          this.occupied.delete(`${tile.x},${tile.y}`);
        }
        if (b.type === "road" || b.type === "wall") {
          this.lineSprites.delete(`${b.x},${b.y}`);
          this.refreshLineSprites(b.x, b.y);
        }
      }),
    );
  }

  private drawTerrain() {
    // TilemapLayer batches one atlas and culls offscreen tiles instead of
    // replaying the whole map as Graphics or allocating a world-sized texture.
    const data = Array.from({ length: MAP_SIZE }, (_, y) =>
      Array.from({ length: MAP_SIZE }, (_, x) => terrainFrame(this.map, x, y)));
    const tilemap = this.make.tilemap({ data, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tileset = tilemap.addTilesetImage("terrain", "terrain", TILE_SIZE, TILE_SIZE, 0, 0, 0)!;
    this.terrainLayer = tilemap.createLayer(0, tileset, 0, 0, false) as Phaser.Tilemaps.TilemapLayer;
    const worldSize = MAP_SIZE * TILE_SIZE;

    const releaseTilemap = () => {
      this.events.off(Phaser.Scenes.Events.SHUTDOWN, releaseTilemap);
      this.events.off(Phaser.Scenes.Events.DESTROY, releaseTilemap);
      tilemap.destroy();
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, releaseTilemap);
    this.events.once(Phaser.Scenes.Events.DESTROY, releaseTilemap);

    // Centered 1px rectangles match the old strokes, including the darker
    // intersections, without allocating stroke paths in Phaser's renderer.
    const grid = this.add.graphics().fillStyle(0x000000, 0.08);
    for (let i = 0; i <= MAP_SIZE; i++) {
      grid.fillRect(i * TILE_SIZE - 0.5, 0, 1, worldSize);
      grid.fillRect(0, i * TILE_SIZE - 0.5, worldSize, 1);
    }
  }

  private addBuildingSprite(id: string, b: Building) {
    const image = this.add.image(0, 0, b.type).setOrigin(0);
    const container = this.add.container(b.x * TILE_SIZE, b.y * TILE_SIZE, [image]).setDepth(5);
    this.sprites.set(id, container);
    if (b.type === "road" || b.type === "wall") this.lineSprites.set(`${b.x},${b.y}`, image);
  }

  private refreshLineSprites(x: number, y: number) {
    // Frames encode N=1, E=2, S=4, W=8. Only changed tiles and their
    // neighbors need refreshing; connections are entirely visual.
    const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
    for (const [dx, dy] of [[0, 0], ...directions]) {
      const tx = x + dx, ty = y + dy;
      const key = `${tx},${ty}`;
      const image = this.lineSprites.get(key);
      if (!image) continue;
      const type = this.occupied.get(key);
      let mask = 0;
      directions.forEach(([nx, ny], index) => {
        if (this.occupied.get(`${tx + nx},${ty + ny}`) === type) mask |= 1 << index;
      });
      image.setFrame(mask);
    }
  }

  private setupCamera() {
    const cam = this.cameras.main;
    const worldSize = MAP_SIZE * TILE_SIZE;
    cam.setBounds(-TILE_SIZE * 4, -TILE_SIZE * 4, worldSize + TILE_SIZE * 8, worldSize + TILE_SIZE * 8);
    cam.centerOn(worldSize / 2, worldSize / 2);
  }

  private setupInput() {
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys({
      up: "UP", down: "DOWN", left: "LEFT", right: "RIGHT", w: "W", a: "A", s: "S", d: "D",
    }) as typeof this.keys;
    kb.on("keydown-ESC", () => {
      this.cancelLine();
      useGame.getState().selectBuild(null);
    });

    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      const cam = this.cameras.main;
      cam.setZoom(Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.9 : 1.1), MIN_ZOOM, MAX_ZOOM));
    });

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown()) {
        this.cancelLine();
        this.dragStart = null;
        useGame.getState().selectBuild(null);
        return;
      }
      if (!p.leftButtonDown()) return;
      const cam = this.cameras.main;
      this.dragStart = { x: p.x, y: p.y, scrollX: cam.scrollX, scrollY: cam.scrollY };
      this.dragged = false;
    });

    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!this.dragStart || !p.isDown) return;
      const dx = p.x - this.dragStart.x, dy = p.y - this.dragStart.y;
      if (!this.dragged && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      this.dragged = true;
      const cam = this.cameras.main;
      cam.setScroll(this.dragStart.scrollX - dx / cam.zoom, this.dragStart.scrollY - dy / cam.zoom);
    });

    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      const wasClick = this.dragStart && !this.dragged;
      this.dragStart = null;
      if (!wasClick || p.rightButtonReleased()) return;
      const { selectedBuild: type, selectedTool: tool } = useGame.getState();
      const { x, y } = this.tileAt(p);
      if (tool) {
        this.room.send(tool, { x, y });
        return;
      }
      if (!type) return;
      if (type === "road" || type === "wall") {
        if (!this.lineStart || this.lineStart.type !== type) {
          if (x < 0 || y < 0 || x >= MAP_SIZE || y >= MAP_SIZE) {
            useGame.getState().showToast("Out of bounds");
            return;
          }
          this.lineStart = { type, tile: { x, y } };
        } else {
          const { food, wood, stone, gold } = this.room.state;
          const plan = planBuildLine(this.map, (bx, by) => this.occupied.get(`${bx},${by}`),
            { food, wood, stone, gold }, type, this.lineStart.tile, { x, y });
          if (plan.error) {
            useGame.getState().showToast(plan.error);
            return;
          }
          this.room.send("buildLine", { type, start: this.lineStart.tile, end: { x, y } });
          this.cancelLine();
        }
        return;
      }
      this.room.send("build", { type, x, y });
    });
  }

  private cancelLine() {
    this.lineStart = null;
    this.linePreview?.clear();
  }

  private tileAt(p: Phaser.Input.Pointer) {
    const world = this.cameras.main.getWorldPoint(p.x, p.y);
    return { x: Math.floor(world.x / TILE_SIZE), y: Math.floor(world.y / TILE_SIZE) };
  }

  update(_time: number, delta: number) {
    if (!this.map) return;
    const cam = this.cameras.main;
    const step = (PAN_SPEED * delta) / 1000 / cam.zoom;
    const k = this.keys;
    if (k.left.isDown || k.a.isDown) cam.scrollX -= step;
    if (k.right.isDown || k.d.isDown) cam.scrollX += step;
    if (k.up.isDown || k.w.isDown) cam.scrollY -= step;
    if (k.down.isDown || k.s.isDown) cam.scrollY += step;

    this.updateGhost();
  }

  private updateGhost() {
    const { selectedBuild: type, selectedTool: tool } = useGame.getState();
    this.linePreview.clear();
    if (tool) {
      const { x, y } = this.tileAt(this.input.activePointer);
      let targetX = x, targetY = y, width = 1, height = 1;
      let error: string | null;
      if (tool === "removeBuilding") {
        error = removalError(this.occupied.get(`${x},${y}`));
        const building = [...this.room.state.buildings.values()].find((b) => {
          const def = BUILDINGS[b.type as BuildingType];
          return x >= b.x && x < b.x + def.width && y >= b.y && y < b.y + def.height;
        });
        if (building) {
          const def = BUILDINGS[building.type as BuildingType];
          targetX = building.x;
          targetY = building.y;
          width = def.width;
          height = def.height;
        }
      } else {
        error = clearTerrainError(this.map, (bx, by) => this.occupied.has(`${bx},${by}`), x, y);
      }
      this.ghost.setVisible(true)
        .setPosition(targetX * TILE_SIZE, targetY * TILE_SIZE)
        .setSize(width * TILE_SIZE, height * TILE_SIZE)
        .setFillStyle(0xff5050, 0.3)
        .setStrokeStyle(2, error ? 0xff5050 : 0x7cff7c, 1);
      return;
    }
    if (!type) {
      this.ghost.setVisible(false);
      return;
    }
    const def = BUILDINGS[type];
    this.ghost.setSize(def.width * TILE_SIZE, def.height * TILE_SIZE);

    const { x, y } = this.tileAt(this.input.activePointer);
    const { food, wood, stone, gold } = this.room.state;
    if (this.lineStart && this.lineStart.type === type) {
      this.ghost.setVisible(false);
      const start = this.lineStart.tile;
      const plan = planBuildLine(this.map, (bx, by) => this.occupied.get(`${bx},${by}`),
        { food, wood, stone, gold }, this.lineStart.type, start, { x, y });
      // Avoid generating an unbounded preview when the pointer is outside the map.
      if ([start.x, start.y, x, y].some((v) => v < 0 || v >= MAP_SIZE)) return;
      this.linePreview.fillStyle(def.color, 0.5);
      this.linePreview.lineStyle(2, plan.error ? 0xff5050 : 0x7cff7c, 1);
      for (const tile of buildLineTiles(start, { x, y })) {
        this.linePreview.fillRect(tile.x * TILE_SIZE, tile.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        this.linePreview.strokeRect(tile.x * TILE_SIZE, tile.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
      return;
    }
    const valid = placementError(
      this.map,
      (bx, by) => this.occupied.has(`${bx},${by}`),
      (bx, by) => this.occupied.get(`${bx},${by}`),
      { food, wood, stone, gold },
      type,
      x,
      y,
    ) === null;

    this.ghost
      .setVisible(true)
      .setPosition(x * TILE_SIZE, y * TILE_SIZE)
      .setFillStyle(BUILDINGS[type].color, 0.5)
      .setStrokeStyle(2, valid ? 0x7cff7c : 0xff5050, 1);
  }
}
