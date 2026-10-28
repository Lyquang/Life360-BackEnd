const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const directory = path.join(__dirname, '..', 'ops', 'monitoring', 'dashboards');
const dashboards = fs.readdirSync(directory)
  .filter((name) => name.endsWith('.json'))
  .map((name) => ({ name, dashboard: JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8')) }));

describe('provisioned Grafana dashboards', () => {
  it('use unique panel IDs, the local Prometheus datasource and valid PromQL fields', () => {
    assert.ok(dashboards.length >= 1);
    for (const { name, dashboard } of dashboards) {
      assert.ok(dashboard.uid, `${name} must define a UID`);
      assert.ok(dashboard.panels.length > 0, `${name} must contain panels`);
      const ids = dashboard.panels.map((panel) => panel.id);
      assert.equal(new Set(ids).size, ids.length, `${name} has duplicate panel IDs`);
      for (const panel of dashboard.panels) {
        assert.ok(panel.title, `${name} panel ${panel.id} must have a title`);
        assert.ok(panel.targets.length > 0, `${name} panel ${panel.id} must have a query`);
        for (const target of panel.targets) {
          assert.equal(panel.datasource.uid, 'familytracker-prometheus', `${name} panel ${panel.id} datasource`);
          assert.equal(typeof target.expr, 'string');
          assert.ok(target.expr.length > 0, `${name} panel ${panel.id} query`);
          assert.doesNotMatch(target.expr, /\b(user_id|group_id|conversation_id|email|latitude|longitude|token)\b/i);
        }
      }
    }
  });
});
