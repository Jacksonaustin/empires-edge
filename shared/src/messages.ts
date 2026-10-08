import type { BuildingType } from "./buildings";

/** Client → server commands. The server validates every one. */
export interface BuildMessage {
  type: BuildingType;
  x: number;
  y: number;
}

/** Server → client notice when a command is rejected. */
export interface ErrorMessage {
  message: string;
}
