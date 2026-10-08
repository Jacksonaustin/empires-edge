import { useState } from "react";
import { createGame, joinGame } from "../net";

export function Lobby() {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="lobby">
      <h1>Edge of Empire</h1>
      <p className="subtitle">Hold the frontier. Serve the Empire. Survive.</p>

      <label>
        Your name
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="Lord of the Marches" />
      </label>

      <button disabled={busy} onClick={() => run(() => createGame(name))}>Create game</button>

      <div className="divider">or join a friend</div>

      <label>
        Game code
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. sTxARL4xd" />
      </label>
      <button disabled={busy || !code.trim()} onClick={() => run(() => joinGame(code, name))}>Join game</button>

      {error && <p className="error">{error}</p>}
    </div>
  );
}
