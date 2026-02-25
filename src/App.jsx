import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ─── Utility helpers ──────────────────────────────────────────
function buildTree(depth, branching) {
  const nodes = [];
  let id = 0;
  function addNode(level, parentId) {
    const nodeId = id++;
    nodes.push({ id: nodeId, parent: parentId, level, children: [], users: [], pointer: null, replicas: [] });
    if (level < depth) {
      for (let i = 0; i < branching; i++) {
        const childId = addNode(level + 1, nodeId);
        nodes[nodeId].children.push(childId);
      }
    }
    return nodeId;
  }
  addNode(0, null);
  return nodes;
}

function getLeaves(nodes) {
  return nodes.filter(n => n.children.length === 0).map(n => n.id);
}

function getPath(nodes, from, to) {
  function ancestors(nid) {
    const path = [];
    let cur = nid;
    while (cur !== null) { path.push(cur); cur = nodes[cur].parent; }
    return path;
  }
  const pathA = ancestors(from);
  const pathB = ancestors(to);
  const setB = new Set(pathB);
  let lca = null;
  for (const n of pathA) { if (setB.has(n)) { lca = n; break; } }
  const up = [];
  let c = from;
  while (c !== lca) { up.push(c); c = nodes[c].parent; }
  up.push(lca);
  const down = [];
  c = to;
  while (c !== lca) { down.push(c); c = nodes[c].parent; }
  down.reverse();
  return { path: [...up, ...down], lca, upPath: up, downPath: down };
}

function getLCA(nodes, a, b) {
  function ancestors(nid) {
    const s = new Set();
    let c = nid;
    while (c !== null) { s.add(c); c = nodes[c].parent; }
    return s;
  }
  const aAnc = ancestors(a);
  let c = b;
  while (c !== null) { if (aAnc.has(c)) return c; c = nodes[c].parent; }
  return 0;
}

function getAncestorAtLevel(nodes, nodeId, level) {
  let c = nodeId;
  while (c !== null && nodes[c].level > level) c = nodes[c].parent;
  return c !== null && nodes[c].level === level ? c : null;
}

function pathBetween(nodes, a, b) {
  return getPath(nodes, a, b).path;
}

// ─── Tree layout engine ───────────────────────────────────────
function layoutTree(nodes, width, height) {
  if (!nodes.length) return [];
  const maxLevel = Math.max(...nodes.map(n => n.level));
  const levelHeight = height / (maxLevel + 1.5);
  const positions = new Array(nodes.length);
  const leafNodes = nodes.filter(n => n.children.length === 0);
  const leafSpacing = width / (leafNodes.length + 1);
  leafNodes.forEach((n, i) => {
    positions[n.id] = { x: leafSpacing * (i + 1), y: (n.level + 0.5) * levelHeight };
  });
  for (let level = maxLevel - 1; level >= 0; level--) {
    const levelNodes = nodes.filter(n => n.level === level);
    for (const n of levelNodes) {
      if (n.children.length > 0) {
        const childXs = n.children.map(cid => positions[cid]?.x || 0);
        const avgX = childXs.reduce((a, b) => a + b, 0) / childXs.length;
        positions[n.id] = { x: avgX, y: (n.level + 0.5) * levelHeight };
      }
    }
  }
  return positions;
}

// ─── Color palette ────────────────────────────────────────────
const COLORS = {
  bg: "#0a0e17",
  panel: "#111827",
  panelBorder: "#1e293b",
  accent: "#38bdf8",
  accentDim: "#0c4a6e",
  highlight: "#f472b6",
  success: "#34d399",
  warning: "#fbbf24",
  danger: "#f87171",
  text: "#e2e8f0",
  textDim: "#94a3b8",
  textMuted: "#475569",
  node: "#1e293b",
  nodeBorder: "#334155",
  nodeActive: "#38bdf8",
  edge: "#334155",
  edgeActive: "#38bdf8",
  pointer: "#f472b6",
  replica: "#a78bfa",
  user: "#fbbf24",
};

// ─── SVG Tree Component ───────────────────────────────────────
function TreeVisualization({ nodes, positions, activePath, activeEdges, users, pointers, replicas, highlightNodes, animStep, width, height }) {
  if (!positions || !positions.length) return null;
  const maxLevel = Math.max(...nodes.map(n => n.level));

  return (
    <svg width={width} height={height} style={{ background: "transparent" }}>
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="glowStrong">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <marker id="arrowPointer" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill={COLORS.pointer} />
        </marker>
        <marker id="arrowActive" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill={COLORS.accent} />
        </marker>
      </defs>

      {/* Level labels */}
      {Array.from({ length: maxLevel + 1 }, (_, i) => {
        const y = positions.find(p => p && nodes.find(n => n.id === positions.indexOf(p))?.level === i);
        const levelY = nodes.find(n => n.level === i);
        if (!levelY || !positions[levelY.id]) return null;
        return (
          <text key={`lvl${i}`} x={12} y={positions[levelY.id].y + 4} fill={COLORS.textMuted} fontSize={10} fontFamily="'JetBrains Mono', monospace">
            L{i}
          </text>
        );
      })}

      {/* Edges */}
      {nodes.map(n => n.children.map(cid => {
        if (!positions[n.id] || !positions[cid]) return null;
        const isActive = activeEdges?.some(([a, b]) => (a === n.id && b === cid) || (a === cid && b === n.id));
        return (
          <line
            key={`e${n.id}-${cid}`}
            x1={positions[n.id].x} y1={positions[n.id].y}
            x2={positions[cid].x} y2={positions[cid].y}
            stroke={isActive ? COLORS.edgeActive : COLORS.edge}
            strokeWidth={isActive ? 2.5 : 1}
            opacity={isActive ? 1 : 0.5}
            filter={isActive ? "url(#glow)" : undefined}
          />
        );
      }))}

      {/* Forwarding pointers */}
      {pointers?.map((p, i) => {
        if (!p || !positions[p.from] || !positions[p.to]) return null;
        const dx = positions[p.to].x - positions[p.from].x;
        const dy = positions[p.to].y - positions[p.from].y;
        const cx = (positions[p.from].x + positions[p.to].x) / 2;
        const cy = (positions[p.from].y + positions[p.to].y) / 2 - 30;
        return (
          <g key={`ptr${i}`}>
            <path
              d={`M ${positions[p.from].x} ${positions[p.from].y} Q ${cx} ${cy} ${positions[p.to].x} ${positions[p.to].y}`}
              fill="none" stroke={COLORS.pointer} strokeWidth={2} strokeDasharray="6 3"
              markerEnd="url(#arrowPointer)" filter="url(#glow)" opacity={0.8}
            />
            <text x={cx} y={cy - 6} fill={COLORS.pointer} fontSize={9} textAnchor="middle" fontFamily="'JetBrains Mono', monospace">FWD</text>
          </g>
        );
      })}

      {/* Active path animation */}
      {activePath && activePath.length > 1 && (() => {
        const step = Math.min(animStep || 0, activePath.length - 1);
        const segments = [];
        for (let i = 0; i < step && i < activePath.length - 1; i++) {
          const a = activePath[i], b = activePath[i + 1];
          if (positions[a] && positions[b]) {
            segments.push(
              <line key={`ap${i}`} x1={positions[a].x} y1={positions[a].y} x2={positions[b].x} y2={positions[b].y}
                stroke={COLORS.accent} strokeWidth={3} filter="url(#glowStrong)" opacity={0.9} />
            );
          }
        }
        if (step < activePath.length && positions[activePath[step]]) {
          segments.push(
            <circle key="apulse" cx={positions[activePath[step]].x} cy={positions[activePath[step]].y}
              r={16} fill="none" stroke={COLORS.accent} strokeWidth={2} opacity={0.6}>
              <animate attributeName="r" from="12" to="22" dur="0.8s" repeatCount="indefinite" />
              <animate attributeName="opacity" from="0.6" to="0" dur="0.8s" repeatCount="indefinite" />
            </circle>
          );
        }
        return segments;
      })()}

      {/* Nodes */}
      {nodes.map(n => {
        if (!positions[n.id]) return null;
        const { x, y } = positions[n.id];
        const isHighlight = highlightNodes?.includes(n.id);
        const isOnPath = activePath?.includes(n.id);
        const hasUser = users?.some(u => u.location === n.id);
        const hasReplica = replicas?.includes(n.id);
        const isLeaf = n.children.length === 0;
        const r = isLeaf ? 14 : 17;
        let fillColor = COLORS.node;
        let borderColor = COLORS.nodeBorder;
        if (isHighlight) { fillColor = COLORS.accentDim; borderColor = COLORS.accent; }
        if (isOnPath) { borderColor = COLORS.accent; }
        if (hasReplica) { fillColor = "#2e1065"; borderColor = COLORS.replica; }

        return (
          <g key={`n${n.id}`}>
            <circle cx={x} cy={y} r={r} fill={fillColor} stroke={borderColor} strokeWidth={isOnPath ? 2.5 : 1.5}
              filter={isOnPath || isHighlight ? "url(#glow)" : undefined} />
            <text x={x} y={y + 4} textAnchor="middle" fill={isOnPath ? COLORS.accent : COLORS.text}
              fontSize={isLeaf ? 9 : 11} fontWeight={isOnPath ? "bold" : "normal"} fontFamily="'JetBrains Mono', monospace">
              {n.id}
            </text>
            {hasUser && (
              <g>
                <circle cx={x + r - 2} cy={y - r + 2} r={6} fill={COLORS.user} filter="url(#glow)" />
                <text x={x + r - 2} y={y - r + 5} textAnchor="middle" fill="#000" fontSize={7} fontWeight="bold">U</text>
              </g>
            )}
            {hasReplica && (
              <g>
                <circle cx={x - r + 2} cy={y - r + 2} r={5} fill={COLORS.replica} filter="url(#glow)" />
                <text x={x - r + 2} y={y - r + 5} textAnchor="middle" fill="#fff" fontSize={6} fontWeight="bold">R</text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Stats Panel ──────────────────────────────────────────────
function StatBox({ label, value, color, sub }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${COLORS.panelBorder}`, borderRadius: 8, padding: "10px 14px", minWidth: 100 }}>
      <div style={{ fontSize: 10, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 1, fontFamily: "'JetBrains Mono', monospace" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || COLORS.text, fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: COLORS.textDim, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ─── Log Panel ────────────────────────────────────────────────
function LogPanel({ logs }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [logs]);
  return (
    <div ref={ref} style={{
      background: "rgba(0,0,0,0.3)", border: `1px solid ${COLORS.panelBorder}`, borderRadius: 8,
      padding: 10, height: 160, overflowY: "auto", fontFamily: "'JetBrains Mono', monospace", fontSize: 11
    }}>
      {logs.map((l, i) => (
        <div key={i} style={{ color: l.color || COLORS.textDim, marginBottom: 3, lineHeight: 1.4 }}>
          <span style={{ color: COLORS.textMuted }}>[{l.time}]</span> {l.msg}
        </div>
      ))}
      {logs.length === 0 && <div style={{ color: COLORS.textMuted, fontStyle: "italic" }}>No events yet. Run a simulation to begin.</div>}
    </div>
  );
}

// ─── Bar Chart ────────────────────────────────────────────────
function BarChart({ data, width = 400, height = 200, xLabel, yLabel }) {
  if (!data || !data.length) return null;
  const maxVal = Math.max(...data.map(d => Math.max(d.search || 0, d.update || 0)), 1);
  const barW = Math.min(30, (width - 80) / (data.length * 2.5));
  const chartH = height - 50;
  const chartW = width - 60;

  return (
    <svg width={width} height={height} style={{ background: "transparent" }}>
      {/* Y axis */}
      <line x1={50} y1={10} x2={50} y2={chartH + 10} stroke={COLORS.textMuted} strokeWidth={1} />
      <text x={15} y={chartH / 2 + 10} fill={COLORS.textMuted} fontSize={9} textAnchor="middle" transform={`rotate(-90, 15, ${chartH / 2 + 10})`}
        fontFamily="'JetBrains Mono', monospace">{yLabel || "Cost (hops)"}</text>
      {[0, 0.25, 0.5, 0.75, 1].map(f => (
        <g key={f}>
          <line x1={48} y1={chartH + 10 - f * chartH} x2={width - 10} y2={chartH + 10 - f * chartH} stroke={COLORS.panelBorder} strokeWidth={0.5} />
          <text x={45} y={chartH + 14 - f * chartH} fill={COLORS.textMuted} fontSize={8} textAnchor="end" fontFamily="'JetBrains Mono', monospace">
            {Math.round(maxVal * f)}
          </text>
        </g>
      ))}
      {/* Bars */}
      {data.map((d, i) => {
        const x = 60 + i * (barW * 2.5);
        const sh = (d.search / maxVal) * chartH;
        const uh = (d.update / maxVal) * chartH;
        return (
          <g key={i}>
            <rect x={x} y={chartH + 10 - sh} width={barW} height={sh} fill={COLORS.accent} rx={2} opacity={0.85} />
            <rect x={x + barW + 2} y={chartH + 10 - uh} width={barW} height={uh} fill={COLORS.warning} rx={2} opacity={0.85} />
            <text x={x + barW} y={chartH + 24} fill={COLORS.textMuted} fontSize={8} textAnchor="middle" fontFamily="'JetBrains Mono', monospace">{d.label}</text>
          </g>
        );
      })}
      {/* X label */}
      <text x={width / 2} y={height - 4} fill={COLORS.textMuted} fontSize={9} textAnchor="middle" fontFamily="'JetBrains Mono', monospace">{xLabel || "CMR"}</text>
      {/* Legend */}
      <rect x={width - 120} y={4} width={10} height={10} fill={COLORS.accent} rx={2} />
      <text x={width - 106} y={13} fill={COLORS.textDim} fontSize={9} fontFamily="'JetBrains Mono', monospace">Search</text>
      <rect x={width - 62} y={4} width={10} height={10} fill={COLORS.warning} rx={2} />
      <text x={width - 48} y={13} fill={COLORS.textDim} fontSize={9} fontFamily="'JetBrains Mono', monospace">Update</text>
    </svg>
  );
}

// ─── Slider ───────────────────────────────────────────────────
function Slider({ label, value, onChange, min, max, step = 1, suffix = "" }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: COLORS.textDim, fontFamily: "'JetBrains Mono', monospace" }}>{label}</span>
        <span style={{ fontSize: 11, color: COLORS.accent, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{value}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: COLORS.accent, height: 4, cursor: "pointer" }} />
    </div>
  );
}

// ─── Button ───────────────────────────────────────────────────
function Btn({ children, onClick, color = COLORS.accent, disabled, small }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        background: disabled ? COLORS.panelBorder : color, color: disabled ? COLORS.textMuted : "#000",
        border: "none", borderRadius: 6, padding: small ? "5px 12px" : "8px 18px",
        fontSize: small ? 11 : 12, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "'JetBrains Mono', monospace", letterSpacing: 0.5,
        transition: "all 0.2s", opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={e => { if (!disabled) e.target.style.opacity = "0.85"; }}
      onMouseLeave={e => { e.target.style.opacity = disabled ? "0.5" : "1"; }}
    >
      {children}
    </button>
  );
}

// ─── Tab button ───────────────────────────────────────────────
function Tab({ active, children, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: active ? "rgba(56,189,248,0.12)" : "transparent",
      color: active ? COLORS.accent : COLORS.textDim,
      border: `1px solid ${active ? COLORS.accent : "transparent"}`,
      borderRadius: 6, padding: "8px 16px", fontSize: 11, fontWeight: active ? 700 : 500,
      cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", letterSpacing: 0.3,
      transition: "all 0.2s",
    }}>
      {children}
    </button>
  );
}

// ═════════════════════════════════════════════════════════════
// MAIN APP
// ═════════════════════════════════════════════════════════════
export default function App() {
  const [tab, setTab] = useState(0);
  const [depth, setDepth] = useState(3);
  const [branching, setBranching] = useState(3);
  const [nodes, setNodes] = useState([]);
  const [positions, setPositions] = useState([]);
  const [users, setUsers] = useState([]);
  const [numUsers, setNumUsers] = useState(3);
  const [callRate, setCallRate] = useState(5);
  const [moveRate, setMoveRate] = useState(2);
  const [fwdLevel, setFwdLevel] = useState(1);
  const [logs, setLogs] = useState([]);
  const [activePath, setActivePath] = useState(null);
  const [activeEdges, setActiveEdges] = useState([]);
  const [highlightNodes, setHighlightNodes] = useState([]);
  const [pointers, setPointers] = useState([]);
  const [replicaNodes, setReplicaNodes] = useState([]);
  const [animStep, setAnimStep] = useState(0);
  const [simRunning, setSimRunning] = useState(false);
  const [stats, setStats] = useState({ searches: 0, updates: 0, totalSearchCost: 0, totalUpdateCost: 0, fwdHits: 0 });
  const [chartData, setChartData] = useState([]);
  const animRef = useRef(null);
  const simRef = useRef(null);

  const treeW = 700;
  const treeH = Math.min(420, 100 + depth * 100);

  // Build tree
  const rebuildTree = useCallback(() => {
    const newNodes = buildTree(depth, branching);
    const pos = layoutTree(newNodes, treeW, treeH);
    setNodes(newNodes);
    setPositions(pos);
    const leaves = getLeaves(newNodes);
    const newUsers = [];
    for (let i = 0; i < Math.min(numUsers, leaves.length); i++) {
      newUsers.push({ id: i, location: leaves[i % leaves.length], name: `U${i}`, callCount: 0, moveCount: 0 });
    }
    setUsers(newUsers);
    setLogs([]);
    setActivePath(null);
    setActiveEdges([]);
    setHighlightNodes([]);
    setPointers([]);
    setReplicaNodes([]);
    setStats({ searches: 0, updates: 0, totalSearchCost: 0, totalUpdateCost: 0, fwdHits: 0 });
    setChartData([]);
    setAnimStep(0);
  }, [depth, branching, numUsers, treeW, treeH]);

  useEffect(() => { rebuildTree(); }, [rebuildTree]);

  const addLog = useCallback((msg, color) => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [...prev.slice(-80), { time, msg, color }]);
  }, []);

  const animatePath = useCallback((path, cb) => {
    let step = 0;
    setActivePath(path);
    setAnimStep(0);
    const edges = [];
    if (animRef.current) clearInterval(animRef.current);
    animRef.current = setInterval(() => {
      step++;
      setAnimStep(step);
      if (step > 0 && step <= path.length) {
        edges.push([path[step - 1], path[step] || path[step - 1]]);
        setActiveEdges([...edges]);
      }
      if (step >= path.length + 2) {
        clearInterval(animRef.current);
        setTimeout(() => { setActivePath(null); setActiveEdges([]); setAnimStep(0); cb?.(); }, 400);
      }
    }, 250);
  }, []);

  // ─── TAB 1: Basic Hierarchical Search/Update ───────────────
  const runBasicSearch = useCallback(() => {
    if (users.length < 2 || !nodes.length) return;
    const callerIdx = Math.floor(Math.random() * users.length);
    let calleeIdx = Math.floor(Math.random() * users.length);
    while (calleeIdx === callerIdx && users.length > 1) calleeIdx = Math.floor(Math.random() * users.length);
    const caller = users[callerIdx];
    const callee = users[calleeIdx];
    const { path, lca } = getPath(nodes, caller.location, callee.location);
    const cost = path.length - 1;
    addLog(`SEARCH: ${caller.name}@node${caller.location} → ${callee.name}@node${callee.location} | LCA=node${lca} | Cost=${cost} hops`, COLORS.accent);
    setHighlightNodes([caller.location, callee.location]);
    setStats(prev => ({ ...prev, searches: prev.searches + 1, totalSearchCost: prev.totalSearchCost + cost }));
    setUsers(prev => prev.map((u, i) => i === calleeIdx ? { ...u, callCount: u.callCount + 1 } : u));
    animatePath(path);
  }, [users, nodes, addLog, animatePath]);

  const runBasicUpdate = useCallback(() => {
    if (users.length === 0 || !nodes.length) return;
    const leaves = getLeaves(nodes);
    const uIdx = Math.floor(Math.random() * users.length);
    const user = users[uIdx];
    let newLeaf = leaves[Math.floor(Math.random() * leaves.length)];
    while (newLeaf === user.location && leaves.length > 1) newLeaf = leaves[Math.floor(Math.random() * leaves.length)];
    const { path, lca } = getPath(nodes, user.location, newLeaf);
    const cost = path.length - 1;
    addLog(`UPDATE: ${user.name} moves node${user.location} → node${newLeaf} | LCA=node${lca} | Cost=${cost} hops`, COLORS.warning);
    setHighlightNodes([user.location, newLeaf]);
    setStats(prev => ({ ...prev, updates: prev.updates + 1, totalUpdateCost: prev.totalUpdateCost + cost }));
    animatePath(path, () => {
      setUsers(prev => prev.map((u, i) => i === uIdx ? { ...u, location: newLeaf, moveCount: u.moveCount + 1 } : u));
    });
  }, [users, nodes, addLog, animatePath]);

  // ─── TAB 2: Forwarding Pointers ────────────────────────────
  const runFwdUpdate = useCallback(() => {
    if (users.length === 0 || !nodes.length) return;
    const leaves = getLeaves(nodes);
    const uIdx = Math.floor(Math.random() * users.length);
    const user = users[uIdx];
    let newLeaf = leaves[Math.floor(Math.random() * leaves.length)];
    while (newLeaf === user.location && leaves.length > 1) newLeaf = leaves[Math.floor(Math.random() * leaves.length)];

    const oldAncestor = getAncestorAtLevel(nodes, user.location, fwdLevel);
    const newAncestor = getAncestorAtLevel(nodes, newLeaf, fwdLevel);

    if (oldAncestor !== null && newAncestor !== null && oldAncestor !== newAncestor) {
      const newPtr = { from: oldAncestor, to: newAncestor, user: user.id };
      setPointers(prev => [...prev.filter(p => p.user !== user.id), newPtr]);
      const partialPath = pathBetween(nodes, user.location, newLeaf).filter(n => nodes[n].level >= fwdLevel);
      const cost = partialPath.length > 0 ? partialPath.length - 1 : 0;
      addLog(`FWD-UPDATE: ${user.name} moves node${user.location}→node${newLeaf} | Pointer: node${oldAncestor}→node${newAncestor} at L${fwdLevel} | Cost=${cost} (saved ${Math.max(0, pathBetween(nodes, user.location, newLeaf).length - 1 - cost)} hops)`, COLORS.pointer);
      setStats(prev => ({ ...prev, updates: prev.updates + 1, totalUpdateCost: prev.totalUpdateCost + cost }));
      animatePath(partialPath.length ? partialPath : [user.location, newLeaf], () => {
        setUsers(prev => prev.map((u, i) => i === uIdx ? { ...u, location: newLeaf, moveCount: u.moveCount + 1 } : u));
      });
    } else {
      const cost = 0;
      addLog(`FWD-UPDATE: ${user.name} moves node${user.location}→node${newLeaf} | Same subtree at L${fwdLevel}, no pointer needed | Cost=0`, COLORS.success);
      setStats(prev => ({ ...prev, updates: prev.updates + 1 }));
      setUsers(prev => prev.map((u, i) => i === uIdx ? { ...u, location: newLeaf, moveCount: u.moveCount + 1 } : u));
    }
  }, [users, nodes, fwdLevel, addLog, animatePath]);

  const runFwdSearch = useCallback(() => {
    if (users.length < 2 || !nodes.length) return;
    const callerIdx = Math.floor(Math.random() * users.length);
    let calleeIdx = Math.floor(Math.random() * users.length);
    while (calleeIdx === callerIdx && users.length > 1) calleeIdx = Math.floor(Math.random() * users.length);
    const caller = users[callerIdx];
    const callee = users[calleeIdx];
    const ptr = pointers.find(p => p.user === callee.id);
    let path, cost, usedFwd = false;
    if (ptr) {
      const pathToPtr = pathBetween(nodes, caller.location, ptr.from);
      const pathFromPtr = pathBetween(nodes, ptr.to, callee.location);
      path = [...pathToPtr, ...pathFromPtr.slice(1)];
      cost = path.length - 1;
      usedFwd = true;
      addLog(`FWD-SEARCH: ${caller.name}→${callee.name} | Used pointer node${ptr.from}→node${ptr.to} | Cost=${cost} hops`, COLORS.accent);
      setStats(prev => ({ ...prev, searches: prev.searches + 1, totalSearchCost: prev.totalSearchCost + cost, fwdHits: prev.fwdHits + 1 }));
    } else {
      const result = getPath(nodes, caller.location, callee.location);
      path = result.path;
      cost = path.length - 1;
      addLog(`FWD-SEARCH: ${caller.name}→${callee.name} | No pointer, standard search | Cost=${cost} hops`, COLORS.textDim);
      setStats(prev => ({ ...prev, searches: prev.searches + 1, totalSearchCost: prev.totalSearchCost + cost }));
    }
    setHighlightNodes([caller.location, callee.location]);
    animatePath(path);
  }, [users, nodes, pointers, addLog, animatePath]);

  // ─── TAB 3: Replication ────────────────────────────────────
  const runReplication = useCallback(() => {
    if (users.length < 2 || !nodes.length) return;
    const callerIdx = Math.floor(Math.random() * users.length);
    let calleeIdx = Math.floor(Math.random() * users.length);
    while (calleeIdx === callerIdx && users.length > 1) calleeIdx = Math.floor(Math.random() * users.length);
    const caller = users[callerIdx];
    const callee = users[calleeIdx];

    const alpha = callRate;
    const beta = moveRate;
    const calleeCopy = { ...callee, callCount: callee.callCount + 1 };

    // Check if replication is warranted: α·C >= β·U
    const shouldReplicate = alpha * calleeCopy.callCount >= beta * (calleeCopy.moveCount + 1);
    const callerAncestors = [];
    let c = caller.location;
    while (c !== null) { callerAncestors.push(c); c = nodes[c].parent; }

    if (shouldReplicate) {
      const newReplicas = [...new Set([...replicaNodes, ...callerAncestors.slice(0, 2)])];
      setReplicaNodes(newReplicas);
      addLog(`REPLICATE: ${callee.name}'s location replicated near ${caller.name} | α·C(${alpha}×${calleeCopy.callCount})=${alpha * calleeCopy.callCount} ≥ β·U(${beta}×${calleeCopy.moveCount + 1})=${beta * (calleeCopy.moveCount + 1)} ✓`, COLORS.replica);
    }

    // Search with replication check
    const replicaInPath = callerAncestors.find(a => replicaNodes.includes(a));
    let path, cost;
    if (replicaInPath !== undefined) {
      path = pathBetween(nodes, caller.location, replicaInPath);
      cost = path.length - 1;
      addLog(`REPLICA-SEARCH: ${caller.name}→${callee.name} | Found replica at node${replicaInPath} | Cost=${cost} hops (saved!)`, COLORS.success);
    } else {
      const result = getPath(nodes, caller.location, callee.location);
      path = result.path;
      cost = path.length - 1;
      addLog(`SEARCH: ${caller.name}→${callee.name} | No replica nearby | Cost=${cost} hops`, COLORS.accent);
    }
    setStats(prev => ({ ...prev, searches: prev.searches + 1, totalSearchCost: prev.totalSearchCost + cost }));
    setUsers(prev => prev.map((u, i) => i === calleeIdx ? calleeCopy : u));
    setHighlightNodes([caller.location, callee.location]);
    animatePath(path);
  }, [users, nodes, callRate, moveRate, replicaNodes, addLog, animatePath]);

  const runReplicationMove = useCallback(() => {
    if (users.length === 0 || !nodes.length) return;
    const leaves = getLeaves(nodes);
    const uIdx = Math.floor(Math.random() * users.length);
    const user = users[uIdx];
    let newLeaf = leaves[Math.floor(Math.random() * leaves.length)];
    while (newLeaf === user.location && leaves.length > 1) newLeaf = leaves[Math.floor(Math.random() * leaves.length)];

    // Invalidate replicas on move
    const alpha = callRate;
    const beta = moveRate;
    const newMoveCount = user.moveCount + 1;
    const keepReplicas = replicaNodes.filter(r => {
      return alpha * user.callCount >= beta * (newMoveCount + 1);
    });
    if (keepReplicas.length < replicaNodes.length) {
      addLog(`REPLICA-INVALIDATE: ${user.name} moved, ${replicaNodes.length - keepReplicas.length} replicas removed (α·C=${alpha * user.callCount} < β·U=${beta * (newMoveCount + 1)})`, COLORS.danger);
    }
    setReplicaNodes(keepReplicas);

    const { path } = getPath(nodes, user.location, newLeaf);
    const cost = path.length - 1;
    addLog(`UPDATE: ${user.name} moves node${user.location}→node${newLeaf} | Cost=${cost} hops`, COLORS.warning);
    setStats(prev => ({ ...prev, updates: prev.updates + 1, totalUpdateCost: prev.totalUpdateCost + cost }));
    animatePath(path, () => {
      setUsers(prev => prev.map((u, i) => i === uIdx ? { ...u, location: newLeaf, moveCount: newMoveCount } : u));
    });
  }, [users, nodes, callRate, moveRate, replicaNodes, addLog, animatePath]);

  // ─── TAB 4: Cost Comparison ────────────────────────────────
  const runCostComparison = useCallback(() => {
    if (!nodes.length) return;
    const leaves = getLeaves(nodes);
    const cmrValues = [0.5, 1, 2, 3, 5, 8, 10, 15];
    const results = [];
    addLog("Running cost comparison simulation...", COLORS.accent);

    for (const cmr of cmrValues) {
      const numTrials = 50;
      let totalSearch = 0, totalUpdate = 0;
      let totalSearchFwd = 0, totalUpdateFwd = 0;
      let totalSearchRep = 0, totalUpdateRep = 0;

      for (let t = 0; t < numTrials; t++) {
        const a = leaves[Math.floor(Math.random() * leaves.length)];
        const b = leaves[Math.floor(Math.random() * leaves.length)];
        if (a === b) continue;
        const { path } = getPath(nodes, a, b);
        totalSearch += path.length - 1;

        // Move cost
        const c = leaves[Math.floor(Math.random() * leaves.length)];
        const movePath = getPath(nodes, a, c);
        totalUpdate += movePath.path.length - 1;

        // Forwarding pointer approximation
        const fwdSavings = Math.min(fwdLevel, Math.floor((path.length - 1) * 0.3));
        totalSearchFwd += Math.max(1, path.length - 1 + 1);
        totalUpdateFwd += Math.max(1, movePath.path.length - 1 - fwdSavings);

        // Replication approximation (higher CMR = more replicas = cheaper search)
        const repSearchSavings = Math.min(path.length - 2, Math.floor(cmr * 0.5));
        totalSearchRep += Math.max(1, path.length - 1 - repSearchSavings);
        totalUpdateRep += movePath.path.length - 1 + Math.floor(cmr * 0.3);
      }

      results.push({
        label: `${cmr}`,
        search: Math.round(totalSearch / numTrials * 10) / 10,
        update: Math.round(totalUpdate / numTrials * 10) / 10,
        searchFwd: Math.round(totalSearchFwd / numTrials * 10) / 10,
        updateFwd: Math.round(totalUpdateFwd / numTrials * 10) / 10,
        searchRep: Math.round(totalSearchRep / numTrials * 10) / 10,
        updateRep: Math.round(totalUpdateRep / numTrials * 10) / 10,
      });
    }
    setChartData(results);
    addLog(`Comparison complete: ${cmrValues.length} CMR values × 50 trials each`, COLORS.success);
  }, [nodes, fwdLevel, addLog]);

  // ─── Auto simulation ───────────────────────────────────────
  const startSim = useCallback(() => {
    if (simRunning) { clearInterval(simRef.current); setSimRunning(false); return; }
    setSimRunning(true);
    simRef.current = setInterval(() => {
      const r = Math.random();
      const cmr = callRate / Math.max(moveRate, 0.1);
      if (tab === 0) {
        if (r < cmr / (cmr + 1)) runBasicSearch(); else runBasicUpdate();
      } else if (tab === 1) {
        if (r < cmr / (cmr + 1)) runFwdSearch(); else runFwdUpdate();
      } else if (tab === 2) {
        if (r < cmr / (cmr + 1)) runReplication(); else runReplicationMove();
      }
    }, 1800);
  }, [simRunning, tab, callRate, moveRate, runBasicSearch, runBasicUpdate, runFwdSearch, runFwdUpdate, runReplication, runReplicationMove]);

  useEffect(() => { return () => { clearInterval(simRef.current); clearInterval(animRef.current); }; }, []);

  const maxLevel = nodes.length ? Math.max(...nodes.map(n => n.level)) : 0;
  const nodesAtFwdLevel = nodes.filter(n => n.level === fwdLevel).length;

  const tabNames = ["Hierarchical Scheme", "Forwarding Pointers", "Replication", "Cost Comparison"];

  return (
    <div style={{
      minHeight: "100vh", background: COLORS.bg, color: COLORS.text, padding: "16px 20px",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", letterSpacing: -0.5 }}>
            <span style={{ color: COLORS.accent }}>▲</span> Hierarchical Location Management Simulator
          </h1>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: COLORS.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>
            CS 6604 — Mobile &amp; Distributed Computing
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {tabNames.map((name, i) => (
          <Tab key={i} active={tab === i} onClick={() => { setTab(i); clearInterval(simRef.current); setSimRunning(false); }}>
            {i + 1}. {name}
          </Tab>
        ))}
      </div>

      {/* Main layout */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {/* Left: Controls */}
        <div style={{ width: 230, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Tree config */}
          <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}`, borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 10, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, fontFamily: "'JetBrains Mono', monospace" }}>Tree Config</div>
            <Slider label="Depth" value={depth} onChange={setDepth} min={2} max={4} />
            <Slider label="Branching" value={branching} onChange={setBranching} min={2} max={4} />
            <Slider label="Users" value={numUsers} onChange={setNumUsers} min={2} max={8} />
            <Btn onClick={rebuildTree} color={COLORS.success} small>Rebuild Tree</Btn>
          </div>

          {/* Simulation params */}
          <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}`, borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 10, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, fontFamily: "'JetBrains Mono', monospace" }}>Parameters</div>
            <Slider label="Call Rate (λ)" value={callRate} onChange={setCallRate} min={1} max={20} />
            <Slider label="Move Rate (σ)" value={moveRate} onChange={setMoveRate} min={1} max={20} />
            <div style={{ fontSize: 10, color: COLORS.accent, fontFamily: "'JetBrains Mono', monospace", marginBottom: 8 }}>
              CMR = {(callRate / Math.max(moveRate, 0.1)).toFixed(2)}
            </div>
            {(tab === 1) && (
              <>
                <Slider label="Fwd Pointer Level" value={fwdLevel} onChange={setFwdLevel} min={1} max={maxLevel - 1 || 1} suffix={` (${nodesAtFwdLevel} nodes)`} />
                <div style={{ fontSize: 9, color: COLORS.textDim, marginTop: -6, marginBottom: 8 }}>
                  Pointers set at level {fwdLevel}. {nodesAtFwdLevel} nodes can benefit from shortcuts.
                </div>
              </>
            )}
          </div>

          {/* Actions */}
          <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}`, borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 10, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, fontFamily: "'JetBrains Mono', monospace" }}>Actions</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {tab === 0 && <>
                <Btn onClick={runBasicSearch} small>Search (Locate User)</Btn>
                <Btn onClick={runBasicUpdate} color={COLORS.warning} small>Update (Move User)</Btn>
              </>}
              {tab === 1 && <>
                <Btn onClick={runFwdSearch} small>Search (w/ Pointers)</Btn>
                <Btn onClick={runFwdUpdate} color={COLORS.warning} small>Move (Set Pointer)</Btn>
                <Btn onClick={() => { setPointers([]); addLog("All forwarding pointers purged", COLORS.danger); }} color={COLORS.danger} small>Purge Pointers</Btn>
              </>}
              {tab === 2 && <>
                <Btn onClick={runReplication} small>Call (Check Replicas)</Btn>
                <Btn onClick={runReplicationMove} color={COLORS.warning} small>Move (Invalidate)</Btn>
                <Btn onClick={() => { setReplicaNodes([]); addLog("All replicas cleared", COLORS.danger); }} color={COLORS.danger} small>Clear Replicas</Btn>
              </>}
              {tab === 3 && <>
                <Btn onClick={runCostComparison} small>Run Comparison</Btn>
              </>}
              {tab < 3 && (
                <Btn onClick={startSim} color={simRunning ? COLORS.danger : COLORS.success} small>
                  {simRunning ? "⏹ Stop Auto-Sim" : "▶ Auto-Simulate"}
                </Btn>
              )}
            </div>
          </div>

          {/* User table */}
          <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}`, borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 10, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontFamily: "'JetBrains Mono', monospace" }}>Users</div>
            <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}>
              {users.map(u => (
                <div key={u.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, padding: "3px 0", borderBottom: `1px solid ${COLORS.panelBorder}` }}>
                  <span style={{ color: COLORS.user }}>{u.name}</span>
                  <span style={{ color: COLORS.textDim }}>@{u.location} C:{u.callCount} M:{u.moveCount}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center: Tree + Stats + Logs */}
        <div style={{ flex: 1, minWidth: 500, display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Stats row */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <StatBox label="Searches" value={stats.searches} color={COLORS.accent} />
            <StatBox label="Updates" value={stats.updates} color={COLORS.warning} />
            <StatBox label="Avg Search" value={stats.searches > 0 ? (stats.totalSearchCost / stats.searches).toFixed(1) : "—"} color={COLORS.accent} sub="hops" />
            <StatBox label="Avg Update" value={stats.updates > 0 ? (stats.totalUpdateCost / stats.updates).toFixed(1) : "—"} color={COLORS.warning} sub="hops" />
            {tab === 1 && <StatBox label="Fwd Hits" value={stats.fwdHits} color={COLORS.pointer} sub="pointer redirects" />}
            {tab === 2 && <StatBox label="Replicas" value={replicaNodes.length} color={COLORS.replica} sub="active nodes" />}
          </div>

          {/* Tree visualization */}
          <div style={{
            background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}`, borderRadius: 10, padding: 10, overflow: "auto",
          }}>
            {tab < 3 ? (
              <TreeVisualization
                nodes={nodes} positions={positions}
                activePath={activePath} activeEdges={activeEdges}
                users={users} pointers={tab === 1 ? pointers : []}
                replicas={tab === 2 ? replicaNodes : []}
                highlightNodes={highlightNodes}
                animStep={animStep}
                width={treeW} height={treeH}
              />
            ) : (
              <div style={{ padding: 10 }}>
                <div style={{ fontSize: 12, color: COLORS.text, fontFamily: "'JetBrains Mono', monospace", marginBottom: 12, fontWeight: 600 }}>
                  Search vs Update Cost across CMR values
                </div>
                {chartData.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 10, color: COLORS.textDim, marginBottom: 6, fontFamily: "'JetBrains Mono', monospace" }}>Basic Hierarchical</div>
                      <BarChart data={chartData} width={340} height={200} xLabel="CMR (calls/moves)" yLabel="Avg hops" />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: COLORS.textDim, marginBottom: 6, fontFamily: "'JetBrains Mono', monospace" }}>With Forwarding Pointers (L={fwdLevel})</div>
                      <BarChart data={chartData.map(d => ({ label: d.label, search: d.searchFwd, update: d.updateFwd }))} width={340} height={200} xLabel="CMR (calls/moves)" yLabel="Avg hops" />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: COLORS.textDim, marginBottom: 6, fontFamily: "'JetBrains Mono', monospace" }}>With Replication</div>
                      <BarChart data={chartData.map(d => ({ label: d.label, search: d.searchRep, update: d.updateRep }))} width={340} height={200} xLabel="CMR (calls/moves)" yLabel="Avg hops" />
                    </div>
                  </div>
                ) : (
                  <div style={{ color: COLORS.textMuted, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", padding: 40, textAlign: "center" }}>
                    Click "Run Comparison" to generate cost analysis charts.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tab description */}
          <div style={{
            background: "rgba(56,189,248,0.05)", border: `1px solid rgba(56,189,248,0.15)`, borderRadius: 8,
            padding: "10px 14px", fontSize: 11, color: COLORS.textDim, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.6
          }}>
            {tab === 0 && <>
              <strong style={{ color: COLORS.accent }}>Hierarchical Scheme:</strong> Location databases form a tree. To find a user, the query goes up from the caller to the LCA (Least Common Ancestor) of caller and callee, then down to the callee. Updates propagate up from old location through LCA to new location. Cost = number of tree hops.
            </>}
            {tab === 1 && <>
              <strong style={{ color: COLORS.pointer }}>Forwarding Pointers:</strong> When a user moves, instead of updating all the way to the root, only update up to level {fwdLevel}. A forwarding pointer is set between ancestors at that level. This reduces update cost but may increase search cost if pointers chain. Currently {nodesAtFwdLevel} nodes at L{fwdLevel} can serve as pointer endpoints. Purge when chains grow too long.
            </>}
            {tab === 2 && <>
              <strong style={{ color: COLORS.replica }}>Replication:</strong> Location info is replicated at nodes that frequently call a user. Replication condition: α·C<sup>x,j</sup> ≥ β·U<sup>x</sup> (calls weighted by α={callRate} must exceed moves weighted by β={moveRate}). Currently {replicaNodes.length} replica nodes active. When users move, replicas may be invalidated.
            </>}
            {tab === 3 && <>
              <strong style={{ color: COLORS.success }}>Cost Comparison:</strong> Compares average search and update costs across different Call-to-Mobility Ratios (CMR). Higher CMR means more calls relative to moves. Basic scheme, forwarding pointers, and replication are compared side by side. Run the comparison to see how each scheme performs under different mobility patterns.
            </>}
          </div>

          {/* Event log */}
          <div>
            <div style={{ fontSize: 10, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, fontFamily: "'JetBrains Mono', monospace" }}>
              Event Log
            </div>
            <LogPanel logs={logs} />
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{
        marginTop: 14, display: "flex", gap: 16, flexWrap: "wrap", padding: "10px 14px",
        background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}`, borderRadius: 8,
        fontFamily: "'JetBrains Mono', monospace", fontSize: 10
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: COLORS.node, border: `1.5px solid ${COLORS.nodeBorder}` }} />
          <span style={{ color: COLORS.textDim }}>Tree Node</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: COLORS.user }} />
          <span style={{ color: COLORS.textDim }}>User (U)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: COLORS.replica }} />
          <span style={{ color: COLORS.textDim }}>Replica (R)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 30, height: 2, background: COLORS.accent }} />
          <span style={{ color: COLORS.textDim }}>Active Path</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 30, height: 2, background: COLORS.pointer, borderTop: "1px dashed" }} />
          <span style={{ color: COLORS.textDim }}>Forwarding Pointer</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ color: COLORS.textDim }}>CMR = λ/σ = Calls÷Moves</span>
        </div>
      </div>
    </div>
  );
}
