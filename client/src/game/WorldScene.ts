import * as Phaser from "phaser";
import { Callbacks, type Room } from "@colyseus/sdk";
import {
  BUILDINGS,
  MAP_SIZE,
  TERRAIN_COLORS,
  TILE_SIZE,
  generateMap,
  placementError,
  type Building,
  type BuildingType,
  type GameState,
  type TileMap,
  Terrain,
} from "@ee/shared";
import { useGame } from "../store";

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
  private ghost!: Phaser.GameObjects.Rectangle;
  private keys!: Record<"up" | "down" | "left" | "right" | "w" | "a" | "s" | "d", Phaser.Input.Keyboard.Key>;
  private dragStart: { x: number; y: number; scrollX: number; scrollY: number } | null = null;
  private dragged = false;
  private unsubscribers: Array<() => void> = [];
  private detached = false;

  constructor(private room: Room<any, GameState>) {
    super("world");
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
    this.drawTerrain();
    this.setupCamera();
    this.setupInput();

    this.ghost = this.add.rectangle(0, 0, TILE_SIZE, TILE_SIZE).setOrigin(0).setDepth(10).setVisible(false);

    const callbacks = Callbacks.get(this.room);
    this.unsubscribers.push(
      callbacks.onAdd("buildings", (b, id) => this.addBuildingSprite(id, b)),
      callbacks.onRemove("buildings", (_b, id) => {
        this.sprites.get(id)?.destroy();
        this.sprites.delete(id);
      }),
    );
  }

  private drawTerrain() {
    const g = this.add.graphics();
    for (let y = 0; y < MAP_SIZE; y++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        const terrain = this.map[y * MAP_SIZE + x] as Terrain;
        // Subtle per-tile shade noise so the map doesn't look flat.
        const hash = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        const shade = (hash - Math.floor(hash)) * 6 - 3;
        g.fillStyle(Phaser.Display.Color.ValueToColor(TERRAIN_COLORS[terrain]).lighten(shade).color);
        g.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
    g.lineStyle(1, 0x000000, 0.08);
    for (let i = 0; i <= MAP_SIZE; i++) {
      g.lineBetween(i * TILE_SIZE, 0, i * TILE_SIZE, MAP_SIZE * TILE_SIZE);
      g.lineBetween(0, i * TILE_SIZE, MAP_SIZE * TILE_SIZE, i * TILE_SIZE);
    }
  }

  private addBuildingSprite(id: string, b: Building) {
    const def = BUILDINGS[b.type as BuildingType];
    const pad = 3;
    const rect = this.add.rectangle(pad, pad, TILE_SIZE - pad * 2, TILE_SIZE - pad * 2, def.color).setOrigin(0).setStrokeStyle(2, 0x000000, 0.5);
    const label = this.add.text(TILE_SIZE / 2, TILE_SIZE / 2, def.name[0], { fontSize: "14px", color: "#fff", fontStyle: "bold" }).setOrigin(0.5);
    const container = this.add.container(b.x * TILE_SIZE, b.y * TILE_SIZE, [rect, label]).setDepth(5);
    this.sprites.set(id, container);
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
    kb.on("keydown-ESC", () => useGame.getState().selectBuild(null));

    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      const cam = this.cameras.main;
      cam.setZoom(Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.9 : 1.1), MIN_ZOOM, MAX_ZOOM));
    });

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown()) {
        useGame.getState().selectBuild(null);
        return;
      }
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
      const type = useGame.getState().selectedBuild;
      if (!type) return;
      const { x, y } = this.tileAt(p);
      this.room.send("build", { type, x, y });
    });
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
    const type = useGame.getState().selectedBuild;
    if (!type) {
      this.ghost.setVisible(false);
      return;
    }
    const { x, y } = this.tileAt(this.input.activePointer);
    const state = this.room.state;
    const occupied = new Set<string>();
    state.buildings.forEach((b) => occupied.add(`${b.x},${b.y}`));
    const { food, wood, stone, gold } = state;
    const valid = placementError(this.map, (bx, by) => occupied.has(`${bx},${by}`), { food, wood, stone, gold }, type, x, y) === null;

    this.ghost
      .setVisible(true)
      .setPosition(x * TILE_SIZE, y * TILE_SIZE)
      .setFillStyle(BUILDINGS[type].color, 0.5)
      .setStrokeStyle(2, valid ? 0x7cff7c : 0xff5050, 1);
  }
}
