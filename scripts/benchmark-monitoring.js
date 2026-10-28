const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const { randomUUID } = require('node:crypto');
const { io } = require('socket.io-client');
const root = path.resolve(__dirname, '..');
const smoke = process.argv.includes('--smoke');
const warmup = smoke ? 3 : 30;
const duration = smoke ? 10 : 120;
const repeats = smoke ? 1 : 3;
const base = 'http://127.0.0.1:3100';
const composeArgs = ['compose', '--env-file', 'ops/monitoring/compose.env', '-f', 'ops/monitoring/compose.yml'];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function compose(args, enabled) {
  return execFileSync('docker', [...composeArgs, ...args], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, STACK_METRICS_ENABLED: String(enabled) }, timeout: 240000 });
}
function rss() {
  const text = compose(['exec', '-T', 'backend', 'cat', '/proc/1/status'], true);
  return Number(text.match(/^VmRSS:\s+(\d+)/m)[1]) * 1024;
}
async function ready() {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(base + '/api/health', { signal: AbortSignal.timeout(2000) })).ok) return; } catch {}
    await sleep(1000);
  }
  throw new Error('Local backend did not become ready');
}
async function request(endpoint, token, body) {
  let response;
  try {
    response = await fetch(base + '/api/v1' + endpoint, {
      method: body ? 'POST' : 'GET', signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
      ...(body && { body: JSON.stringify(body) }),
    });
  } catch (error) {
    throw new Error(`Synthetic request to ${endpoint} failed: ${error.message}`, { cause: error });
  }
  if (!response.ok) throw new Error(`Synthetic request failed: ${response.status}`);
  return (await response.json()).data;
}
async function connect(token) {
  const socket = io(base, { auth: { token }, transports: ['websocket'], reconnection: false });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Session initialization timed out')), 15000);
      socket.once('session:ready', () => { clearTimeout(timer); resolve(); });
      socket.once('connect_error', () => { clearTimeout(timer); reject(new Error('Synthetic Socket auth failed')); });
    });
    return socket;
  } catch (error) { socket.close(); throw error; }
}
function percentile(values, fraction) { return values.slice().sort((a,b) => a-b)[Math.min(values.length - 1, Math.ceil(values.length * fraction) - 1)]; }
async function scenario(enabled, repeat) {
  console.log(`Starting ${enabled ? 'enabled' : 'disabled'} repeat ${repeat}`);
  compose(['up', '-d', '--no-deps', '--force-recreate', 'backend'], enabled);
  await ready();
  const user = await request('/auth/register', null, { name: 'Synthetic monitor', email: `${randomUUID()}@example.invalid`, password: randomUUID() });
  const token = user.accessToken;
  await request('/groups', token, { name: 'Synthetic monitoring circle' });
  let sender, receiver;
  let sequence = 0;
  try {
    sender = await connect(token);
    receiver = await connect(token);
    async function round() {
      const start = performance.now();
      await request('/auth/me', token);
      const httpMs = performance.now() - start;
      const recordedAt = new Date().toISOString();
      const socketStart = performance.now();
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => { receiver.off('location_update', onLocation); reject(new Error('Location delivery timed out')); }, 15000);
        function onLocation(payload) { if (payload.recordedAt === recordedAt) { clearTimeout(timer); receiver.off('location_update', onLocation); resolve(); } }
        receiver.on('location_update', onLocation);
        sender.emit('update_location', { latitude: 10 + (sequence++ % 1000) * 0.0003, longitude: 106, recordedAt, accuracy: 5 });
      });
      const socketMs = performance.now() - socketStart;
      await sleep(200);
      return { httpMs, socketMs };
    }
    let until = performance.now() + warmup * 1000;
    while (performance.now() < until) await round();
    const rssBefore = rss();
    const samples = [];
    until = performance.now() + duration * 1000;
    while (performance.now() < until) samples.push(await round());
    return { enabled, repeat, samples: samples.length, httpP95Ms: percentile(samples.map(s => s.httpMs), .95),
      socketP95Ms: percentile(samples.map(s => s.socketMs), .95), rssBefore, rssAfter: rss() };
  } finally { sender?.close(); receiver?.close(); }
}
async function main() {
  const results = [];
  try {
    for (let repeat = 1; repeat <= repeats; repeat++) {
      for (const enabled of repeat % 2 ? [false, true] : [true, false]) results.push(await scenario(enabled, repeat));
    }
  } finally {
    compose(['up', '-d', '--no-deps', '--force-recreate', 'backend'], true);
    await ready();
  }
  const pairs = Array.from({ length: repeats }, (_, i) => {
    const off = results.find(r => r.repeat === i + 1 && !r.enabled);
    const on = results.find(r => r.repeat === i + 1 && r.enabled);
    const httpP95Overhead = on.httpP95Ms / off.httpP95Ms - 1;
    const socketP95Overhead = on.socketP95Ms / off.socketP95Ms - 1;
    const rssDelta = Math.max(on.rssBefore, on.rssAfter) - Math.max(off.rssBefore, off.rssAfter);
    return { repeat: i + 1, httpP95Overhead, socketP95Overhead, rssDelta,
      withinThreshold: httpP95Overhead <= .05 && socketP95Overhead <= .05 && rssDelta <= 20 * 1024 * 1024 };
  });
  const report = { mode: smoke ? 'smoke-not-acceptance' : 'paired-local-benchmark', warmup, duration, repeats,
    workload: 'One user, two sockets, one circle; sequential GET /auth/me and location delivery then 200ms pause; fresh backend process per case',
    limitations: 'RSS sampled before/after, not peak; Docker Desktop host contention; not production or multi-user capacity proof; safe logger enabled in both cases',
    results, pairs };
  const target = path.join(root, 'ops/monitoring/.local', smoke ? 'benchmark-smoke.json' : 'benchmark.json');
  fs.writeFileSync(target, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
main().catch(error => {
  const reason = error instanceof Error ? error.message : 'Unknown error';
  console.error(`Local benchmark failed: ${reason}. No credentials were printed.`);
  process.exitCode = 1;
});
