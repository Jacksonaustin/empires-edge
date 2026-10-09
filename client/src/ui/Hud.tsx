import { BUILDABLE_TYPES, BUILDINGS, RESOURCE_KINDS, type Cost } from "@ee/shared";
import { useGame } from "../store";
import { leaveGame } from "../net";

const ICONS = { food: "🌾", wood: "🪵", stone: "🪨", gold: "🪙" } as const;

function formatCost(cost: Cost) {
  return RESOURCE_KINDS.filter((k) => cost[k]).map((k) => `${cost[k]}${ICONS[k]}`).join(" ");
}

export function Hud() {
  const room = useGame((s) => s.room);
  const resources = useGame((s) => s.resources);
  const players = useGame((s) => s.players);
  const selected = useGame((s) => s.selectedBuild);
  const selectBuild = useGame((s) => s.selectBuild);
  const tool = useGame((s) => s.selectedTool);
  const selectTool = useGame((s) => s.selectTool);
  const toast = useGame((s) => s.toast);

  return (
    <div className="hud">
      <div className="topbar">
        {RESOURCE_KINDS.map((k) => (
          <span key={k} className="resource" title={k}>
            {ICONS[k]} {Math.floor(resources[k])}
          </span>
        ))}
        <span className="spacer" />
        <span className="players">{players.join(" & ")}</span>
        <span className="code" title="Share this code with your co-op partner">
          Code: <strong>{room?.roomId}</strong>
        </span>
        <button className="small" onClick={leaveGame}>Leave</button>
      </div>

      <div className="buildbar">
        {BUILDABLE_TYPES.map((type) => (
          <button
            key={type}
            className={selected === type ? "active" : ""}
            onClick={() => selectBuild(selected === type ? null : type)}
          >
            <span className="swatch" style={{ background: `#${BUILDINGS[type].color.toString(16).padStart(6, "0")}` }} />
            {BUILDINGS[type].name}
            <small>{formatCost(BUILDINGS[type].cost)}</small>
          </button>
        ))}
        <button className={tool === "removeBuilding" ? "active" : ""}
          onClick={() => selectTool(tool === "removeBuilding" ? null : "removeBuilding")}>
          Remove Building
          <small>No refund · Keep protected</small>
        </button>
        <button className={tool === "clearTerrain" ? "active" : ""}
          onClick={() => selectTool(tool === "clearTerrain" ? null : "clearTerrain")}>
          Clear Terrain
          <small>Forest / mountain · Free</small>
        </button>
      </div>

      {toast && <div className="toast">{toast}</div>}
      <div className="help">
        {selected === "road" || selected === "wall" ? "Click start, then click end to build · " : ""}
        {tool ? "Click to remove · " : ""}
        Drag or WASD to pan · scroll to zoom · Esc / right-click to cancel
      </div>
    </div>
  );
}
