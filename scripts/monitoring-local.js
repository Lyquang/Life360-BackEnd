const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const directory = path.join(root, 'ops/monitoring/.local');
const args = ['compose', '--env-file', 'ops/monitoring/compose.env', '-f', 'ops/monitoring/compose.yml'];
const action = process.argv[2] || 'status';
if (action === 'init') {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  for (const name of ['jwt', 'metrics', 'grafana']) {
    try { fs.writeFileSync(path.join(directory, name), crypto.randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 }); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  try {
    fs.writeFileSync(path.join(directory, 'gmail-app-password'), 'REPLACE_WITH_GMAIL_APP_PASSWORD', { flag: 'wx', mode: 0o600 });
  } catch (error) { if (error.code !== 'EEXIST') throw error; }
  console.log('Local credentials initialized; existing values preserved. Grafana password: ops/monitoring/.local/grafana');
  console.log('Set ops/monitoring/.local/gmail-app-password to a Gmail App Password before testing email alerts.');
} else {
  const commands = { up: ['up', '-d', '--build', '--wait', '--wait-timeout', '240'], down: ['down'], status: ['ps'], validate: ['config', '--quiet'] };
  if (!commands[action]) throw new Error('Use init, up, down, status or validate.');
  const result = spawnSync('docker', [...args, ...commands[action]], { cwd: root, stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
}
