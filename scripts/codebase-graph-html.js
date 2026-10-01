#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const contextDir = path.join(root, 'codex', 'context');
const graphPath = path.join(contextDir, 'module-graph.json');
const outputPath = path.join(contextDir, 'graph.html');

function layerOf(file) {
  if (file.startsWith('src/presentation/')) return 'presentation';
  if (file.startsWith('src/application/')) return 'application';
  if (file.startsWith('src/infrastructure/')) return 'infrastructure';
  if (file.startsWith('src/domain/')) return 'domain';
  if (file.startsWith('src/config/')) return 'config';
  if (file.startsWith('tests/')) return 'tests';
  if (file.startsWith('scripts/')) return 'scripts';
  return 'root';
}

function labelOf(file) {
  return file.split('/').pop();
}

function buildGraph(rawGraph) {
  const files = Object.keys(rawGraph).sort();
  const nodes = files.map((file, index) => ({
    id: file,
    label: labelOf(file),
    layer: layerOf(file),
    imports: rawGraph[file].imports || [],
    importedBy: rawGraph[file].importedBy || [],
    signatures: rawGraph[file].signatures || [],
    x: Math.cos(index * 2.399963) * (140 + index * 3),
    y: Math.sin(index * 2.399963) * (140 + index * 3),
  }));

  const nodeSet = new Set(files);
  const edges = [];
  for (const [from, meta] of Object.entries(rawGraph)) {
    for (const item of meta.imports || []) {
      if (item.resolved && nodeSet.has(item.resolved)) {
        edges.push({ from, to: item.resolved, line: item.line });
      }
    }
  }

  return { nodes, edges };
}

function htmlEscapeJson(data) {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

function main() {
  if (!fs.existsSync(graphPath)) {
    console.error('No module graph found. Run: npm run context:skeleton');
    process.exit(1);
  }

  const graph = buildGraph(JSON.parse(fs.readFileSync(graphPath, 'utf8')));
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Codebase Graph</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #070808;
      --panel: #101415;
      --panel-2: #151b1d;
      --text: #f2f5f2;
      --muted: #9ba7a1;
      --line: #293234;
      --active: #f55f4e;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      overflow: hidden;
      background: var(--bg);
      color: var(--text);
      font: 13px/1.45 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .app {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 360px;
      height: 100vh;
    }
    .stage { position: relative; min-width: 0; }
    canvas { display: block; width: 100%; height: 100%; }
    .topbar {
      position: absolute;
      top: 16px;
      left: 16px;
      right: 16px;
      display: flex;
      gap: 12px;
      align-items: center;
      pointer-events: none;
    }
    .brand {
      padding: 10px 12px;
      border: 1px solid var(--line);
      background: rgba(16, 20, 21, 0.86);
      backdrop-filter: blur(10px);
      border-radius: 8px;
      pointer-events: auto;
    }
    h1 {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0;
    }
    .subtitle { color: var(--muted); font-size: 12px; margin-top: 2px; }
    .search {
      flex: 1;
      min-width: 160px;
      max-width: 520px;
      pointer-events: auto;
    }
    input {
      width: 100%;
      padding: 11px 12px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(16, 20, 21, 0.9);
      color: var(--text);
      outline: none;
    }
    input:focus { border-color: #55c8ac; }
    .legend {
      position: absolute;
      left: 16px;
      bottom: 16px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      max-width: calc(100% - 32px);
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 7px 9px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(16, 20, 21, 0.86);
      color: var(--muted);
      backdrop-filter: blur(10px);
    }
    .dot { width: 9px; height: 9px; border-radius: 50%; }
    aside {
      min-width: 0;
      border-left: 1px solid var(--line);
      background: linear-gradient(180deg, var(--panel), #0b0e0f);
      padding: 18px;
      overflow: auto;
    }
    .metric-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin: 16px 0;
    }
    .metric {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px;
      background: var(--panel-2);
    }
    .metric strong { display: block; font-size: 20px; }
    .metric span { color: var(--muted); font-size: 12px; }
    .section {
      border-top: 1px solid var(--line);
      padding-top: 14px;
      margin-top: 14px;
    }
    h2 {
      margin: 0 0 10px;
      font-size: 13px;
      text-transform: uppercase;
      color: var(--muted);
      letter-spacing: 0.08em;
    }
    .file-title {
      font-size: 16px;
      font-weight: 700;
      overflow-wrap: anywhere;
    }
    ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    li {
      padding: 7px 0;
      border-bottom: 1px solid rgba(41, 50, 52, 0.6);
      color: #d8dfdc;
      overflow-wrap: anywhere;
    }
    code {
      color: #81d9c2;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 12px;
    }
    .hint { color: var(--muted); }
    @media (max-width: 860px) {
      .app { grid-template-columns: 1fr; grid-template-rows: 62vh 38vh; }
      aside { border-left: 0; border-top: 1px solid var(--line); }
    }
  </style>
</head>
<body>
  <div class="app">
    <main class="stage">
      <canvas id="graph"></canvas>
      <div class="topbar">
        <div class="brand">
          <h1>Codebase Graph</h1>
          <div class="subtitle">Drag nodes, scroll to zoom, click to inspect</div>
        </div>
        <div class="search">
          <input id="search" placeholder="Search file, layer, function..." autocomplete="off">
        </div>
      </div>
      <div id="legend" class="legend"></div>
    </main>
    <aside>
      <div class="file-title" id="selectedTitle">Whole Codebase</div>
      <div class="hint" id="selectedPath">Click any node to inspect imports and signatures.</div>
      <div class="metric-grid">
        <div class="metric"><strong id="nodeCount">0</strong><span>files</span></div>
        <div class="metric"><strong id="edgeCount">0</strong><span>imports</span></div>
      </div>
      <div class="section">
        <h2>Imports</h2>
        <ul id="imports"><li class="hint">No node selected.</li></ul>
      </div>
      <div class="section">
        <h2>Imported By</h2>
        <ul id="importedBy"><li class="hint">No node selected.</li></ul>
      </div>
      <div class="section">
        <h2>Signatures</h2>
        <ul id="signatures"><li class="hint">No node selected.</li></ul>
      </div>
    </aside>
  </div>

  <script>
    const graph = ${htmlEscapeJson(graph)};
    const colors = {
      presentation: '#55c8ac',
      application: '#f0b84f',
      infrastructure: '#5a9df8',
      domain: '#e66e65',
      config: '#bd8cff',
      tests: '#d8dc6a',
      scripts: '#a1a8ad',
      root: '#ffffff'
    };

    const canvas = document.getElementById('graph');
    const ctx = canvas.getContext('2d');
    const search = document.getElementById('search');
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
    let width = 0;
    let height = 0;
    let scale = 1;
    let offsetX = 0;
    let offsetY = 0;
    let draggingNode = null;
    let panning = false;
    let lastPointer = null;
    let selected = null;
    let query = '';

    for (const node of graph.nodes) {
      node.vx = 0;
      node.vy = 0;
      node.radius = 4.5 + Math.min(8, (node.importedBy.length + node.imports.length) * 0.18);
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      width = Math.floor(rect.width * devicePixelRatio);
      height = Math.floor(rect.height * devicePixelRatio);
      canvas.width = width;
      canvas.height = height;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      offsetX = rect.width / 2;
      offsetY = rect.height / 2;
    }

    function worldToScreen(node) {
      return { x: node.x * scale + offsetX, y: node.y * scale + offsetY };
    }

    function screenToWorld(x, y) {
      return { x: (x - offsetX) / scale, y: (y - offsetY) / scale };
    }

    function matches(node) {
      if (!query) return true;
      const haystack = [
        node.id,
        node.label,
        node.layer,
        ...node.signatures.map((sig) => sig.text)
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    }

    function simulate() {
      const nodes = graph.nodes;
      const edges = graph.edges;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let distSq = dx * dx + dy * dy + 0.01;
          const force = Math.min(2.2, 420 / distSq);
          const dist = Math.sqrt(distSq);
          dx /= dist;
          dy /= dist;
          a.vx -= dx * force;
          a.vy -= dy * force;
          b.vx += dx * force;
          b.vy += dy * force;
        }
      }

      for (const edge of edges) {
        const a = nodeById.get(edge.from);
        const b = nodeById.get(edge.to);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const target = a.layer === b.layer ? 75 : 130;
        const force = (dist - target) * 0.004;
        a.vx += dx / dist * force;
        a.vy += dy / dist * force;
        b.vx -= dx / dist * force;
        b.vy -= dy / dist * force;
      }

      for (const node of nodes) {
        node.vx += -node.x * 0.0008;
        node.vy += -node.y * 0.0008;
        node.vx *= 0.82;
        node.vy *= 0.82;
        if (node !== draggingNode) {
          node.x += node.vx;
          node.y += node.vy;
        }
      }
    }

    function draw() {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.fillStyle = '#070808';
      ctx.fillRect(0, 0, rect.width, rect.height);

      const highlighted = selected
        ? new Set([selected.id, ...selected.imports.map((item) => item.resolved).filter(Boolean), ...selected.importedBy])
        : null;

      ctx.lineWidth = 1;
      for (const edge of graph.edges) {
        const a = nodeById.get(edge.from);
        const b = nodeById.get(edge.to);
        if (!a || !b) continue;
        const sa = worldToScreen(a);
        const sb = worldToScreen(b);
        const isActive = highlighted && highlighted.has(a.id) && highlighted.has(b.id);
        ctx.strokeStyle = isActive ? 'rgba(245, 95, 78, 0.8)' : 'rgba(112, 129, 128, 0.18)';
        ctx.globalAlpha = matches(a) || matches(b) ? 1 : 0.12;
        ctx.beginPath();
        ctx.moveTo(sa.x, sa.y);
        ctx.lineTo(sb.x, sb.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      for (const node of graph.nodes) {
        const pos = worldToScreen(node);
        const active = highlighted ? highlighted.has(node.id) : true;
        const found = matches(node);
        ctx.globalAlpha = found && active ? 1 : found ? 0.55 : 0.16;
        ctx.fillStyle = colors[node.layer] || colors.root;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, node.radius * scale, 0, Math.PI * 2);
        ctx.fill();
        if (node === selected) {
          ctx.strokeStyle = '#f55f4e';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, (node.radius + 5) * scale, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (scale > 0.95 || node === selected) {
          ctx.fillStyle = '#f2f5f2';
          ctx.font = '11px ui-sans-serif, system-ui';
          ctx.fillText(node.label, pos.x + 8, pos.y - 8);
        }
      }
      ctx.globalAlpha = 1;
    }

    function tick() {
      if (!draggingNode) {
        for (let i = 0; i < 2; i++) simulate();
      }
      draw();
      requestAnimationFrame(tick);
    }

    function hitTest(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      let best = null;
      let bestDist = Infinity;
      for (const node of graph.nodes) {
        const pos = worldToScreen(node);
        const dist = Math.hypot(pos.x - x, pos.y - y);
        if (dist < Math.max(10, node.radius * scale + 5) && dist < bestDist) {
          best = node;
          bestDist = dist;
        }
      }
      return best;
    }

    function renderList(elementId, items, mapper) {
      const element = document.getElementById(elementId);
      element.innerHTML = '';
      if (!items.length) {
        const li = document.createElement('li');
        li.className = 'hint';
        li.textContent = 'None';
        element.appendChild(li);
        return;
      }
      for (const item of items) {
        const li = document.createElement('li');
        li.innerHTML = mapper(item);
        element.appendChild(li);
      }
    }

    function selectNode(node) {
      selected = node;
      document.getElementById('selectedTitle').textContent = node ? node.label : 'Whole Codebase';
      document.getElementById('selectedPath').textContent = node ? node.id : 'Click any node to inspect imports and signatures.';
      if (!node) return;
      renderList('imports', node.imports, (item) => '<code>L' + item.line + '</code> ' + item.specifier + (item.resolved ? '<br>' + item.resolved : ''));
      renderList('importedBy', node.importedBy, (file) => file);
      renderList('signatures', node.signatures, (sig) => '<code>L' + sig.line + '</code> ' + sig.text.replace(/</g, '&lt;'));
    }

    canvas.addEventListener('pointerdown', (event) => {
      const node = hitTest(event.clientX, event.clientY);
      canvas.setPointerCapture(event.pointerId);
      lastPointer = { x: event.clientX, y: event.clientY };
      if (node) {
        draggingNode = node;
        selectNode(node);
        const rect = canvas.getBoundingClientRect();
        const world = screenToWorld(event.clientX - rect.left, event.clientY - rect.top);
        node.x = world.x;
        node.y = world.y;
      } else {
        panning = true;
      }
    });

    canvas.addEventListener('pointermove', (event) => {
      if (!lastPointer) return;
      if (draggingNode) {
        const rect = canvas.getBoundingClientRect();
        const world = screenToWorld(event.clientX - rect.left, event.clientY - rect.top);
        draggingNode.x = world.x;
        draggingNode.y = world.y;
        draggingNode.vx = 0;
        draggingNode.vy = 0;
      } else if (panning) {
        offsetX += event.clientX - lastPointer.x;
        offsetY += event.clientY - lastPointer.y;
      }
      lastPointer = { x: event.clientX, y: event.clientY };
    });

    canvas.addEventListener('pointerup', () => {
      draggingNode = null;
      panning = false;
      lastPointer = null;
    });

    canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      const before = screenToWorld(mouseX, mouseY);
      scale *= event.deltaY < 0 ? 1.08 : 0.92;
      scale = Math.max(0.25, Math.min(4, scale));
      offsetX = mouseX - before.x * scale;
      offsetY = mouseY - before.y * scale;
    }, { passive: false });

    search.addEventListener('input', () => {
      query = search.value.trim().toLowerCase();
    });

    function renderLegend() {
      const layers = [...new Set(graph.nodes.map((node) => node.layer))].sort();
      const legend = document.getElementById('legend');
      for (const layer of layers) {
        const item = document.createElement('div');
        item.className = 'pill';
        item.innerHTML = '<span class="dot" style="background:' + (colors[layer] || colors.root) + '"></span>' + layer;
        legend.appendChild(item);
      }
    }

    document.getElementById('nodeCount').textContent = graph.nodes.length;
    document.getElementById('edgeCount').textContent = graph.edges.length;
    renderLegend();
    resize();
    window.addEventListener('resize', resize);
    tick();
  </script>
</body>
</html>`;

  fs.writeFileSync(outputPath, html);
  console.log(`Wrote ${path.relative(root, outputPath)}`);
}

main();
