import { useEffect, useRef } from "react";
import * as Phaser from "phaser";
import type { Room } from "@colyseus/sdk";
import type { GameState } from "@ee/shared";
import { WorldScene } from "./WorldScene";

/** Mounts the Phaser canvas; the React HUD sits on top of it. */
export function PhaserGame({ room }: { room: Room<any, GameState> }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scene = new WorldScene(room);
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: container.current!,
      backgroundColor: "#1b1b1b",
      scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
      scene: [scene],
    });
    if (import.meta.env.DEV) Object.assign(window, { __game: game, __room: room });
    return () => {
      scene.detach();
      game.destroy(true);
    };
  }, [room]);

  return <div ref={container} className="game" onContextMenu={(e) => e.preventDefault()} />;
}
