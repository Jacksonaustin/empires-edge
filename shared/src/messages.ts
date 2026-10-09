import type { BuildingType } from "./buildings";
import type { LineBuildingType, TilePosition } from "./construction";

/** Client → server commands. The server validates every one. */
export interface BuildMessage {
  type: BuildingType;
  x: number;
  y: number;
}

export interface BuildLineMessage {
  type: LineBuildingType;
  start: TilePosition;
  end: TilePosition;
}

/** Server → client notice when a command is rejected. */
export interface ErrorMessage {
  message: string;
}
