import { Client, type Room } from "@colyseus/sdk";
import { GameState, RESOURCE_KINDS, type ErrorMessage, type Resources } from "@ee/shared";
import { useGame } from "./store";

const serverUrl = import.meta.env.VITE_SERVER_URL ?? `ws://${location.hostname}:2567`;
const client = new Client(serverUrl);

export async function createGame(name: string) {
  attach(await client.create("province", { name }, GameState));
}

export async function joinGame(code: string, name: string) {
  attach(await client.joinById(code.trim(), { name }, GameState));
}

export function leaveGame() {
  useGame.getState().room?.leave();
}

function attach(room: Room<any, GameState>) {
  const store = useGame.getState();

  room.onStateChange((state) => {
    // Only push to React when something it shows actually changed.
    const { resources, players } = useGame.getState();
    if (RESOURCE_KINDS.some((k) => resources[k] !== state[k])) {
      const next = {} as Resources;
      for (const k of RESOURCE_KINDS) next[k] = state[k];
      store.setResources(next);
    }
    const names = [...state.players.values()].map((p) => p.name);
    if (names.join("\n") !== players.join("\n")) store.setPlayers(names);
  });

  room.onMessage("error", (msg: ErrorMessage) => store.showToast(msg.message));
  room.onLeave(() => {
    store.setRoom(null);
    store.selectBuild(null);
  });

  store.setRoom(room);
}
