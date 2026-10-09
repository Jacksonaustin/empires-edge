import { create } from "zustand";
import type { Room } from "@colyseus/sdk";
import { STARTING_RESOURCES, type BuildingType, type GameState, type Resources } from "@ee/shared";

/**
 * Bridge between React (HUD) and Phaser (world). Only put values here that
 * change occasionally — per-frame data like unit positions stays in Phaser.
 */
interface GameStore {
  room: Room<any, GameState> | null;
  resources: Resources;
  players: string[];
  /** Building the local player is about to place, if any. */
  selectedBuild: BuildingType | null;
  selectedTool: "removeBuilding" | "clearTerrain" | null;
  toast: string | null;

  setRoom: (room: Room<any, GameState> | null) => void;
  setResources: (resources: Resources) => void;
  setPlayers: (players: string[]) => void;
  selectBuild: (type: BuildingType | null) => void;
  selectTool: (tool: "removeBuilding" | "clearTerrain" | null) => void;
  showToast: (message: string) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useGame = create<GameStore>((set) => ({
  room: null,
  resources: { ...STARTING_RESOURCES },
  players: [],
  selectedBuild: null,
  selectedTool: null,
  toast: null,

  setRoom: (room) => set({ room }),
  setResources: (resources) => set({ resources }),
  setPlayers: (players) => set({ players }),
  selectBuild: (selectedBuild) => set({ selectedBuild, selectedTool: null }),
  selectTool: (selectedTool) => set({ selectedTool, selectedBuild: null }),
  showToast: (toast) => {
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => set({ toast: null }), 2500);
    set({ toast });
  },
}));
