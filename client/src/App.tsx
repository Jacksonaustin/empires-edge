import { useGame } from "./store";
import { Lobby } from "./ui/Lobby";
import { Hud } from "./ui/Hud";
import { PhaserGame } from "./game/PhaserGame";

export function App() {
  const room = useGame((s) => s.room);
  if (!room) return <Lobby />;
  return (
    <>
      <PhaserGame room={room} />
      <Hud />
    </>
  );
}
