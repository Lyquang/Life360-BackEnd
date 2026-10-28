const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.GRAFANA_URL || 'http://localhost:3101';
const credentialPath = path.join(__dirname, '../ops/monitoring/.local/grafana');
const expectedUids = [
  'ft_backend_scrape_down',
  'ft_mongo_pool_checkout_failures',
  'ft_redis_connection_errors',
  'ft_digest_job_errors',
  'ft_http_5xx',
  'ft_socket_action_errors',
  'ft_backend_error_log',
];

async function main() {
  if (!fs.existsSync(credentialPath)) {
    throw new Error('Local Grafana credentials are missing; run npm run monitoring:init.');
  }
  const password = fs.readFileSync(credentialPath, 'utf8').trim();
  const authorization = `Basic ${Buffer.from(`admin:${password}`).toString('base64')}`;
  const response = await fetch(`${baseUrl}/api/v1/provisioning/alert-rules`, {
    headers: { authorization, accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Grafana alert API returned HTTP ${response.status}.`);

  const rules = await response.json();
  const byUid = new Map(rules.map(rule => [rule.uid, rule]));
  const missing = expectedUids.filter(uid => !byUid.has(uid));
  if (missing.length) {
    throw new Error(`Provisioned alert rules missing: ${missing.join(', ')}. Restart the local Grafana service.`);
  }

  for (const uid of expectedUids) {
    const rule = byUid.get(uid);
    if (!rule.title || !rule.labels?.severity || !rule.annotations?.runbook_url
      || rule.notification_settings?.receiver !== 'familytracker-gmail') {
      throw new Error(`Alert rule ${uid} is missing metadata or Gmail notification routing.`);
    }
  }

  const evaluationResponse = await fetch(`${baseUrl}/api/prometheus/grafana/api/v1/rules`, {
    headers: { authorization, accept: 'application/json' },
  });
  if (!evaluationResponse.ok) {
    throw new Error(`Grafana rule evaluation API returned HTTP ${evaluationResponse.status}.`);
  }
  const evaluation = await evaluationResponse.json();
  const evaluatedRules = (evaluation.data?.groups || [])
    .filter(group => group.name === 'familytracker-local-health')
    .flatMap(group => group.rules || []);
  const unhealthy = evaluatedRules.filter(rule => !['ok', 'nodata'].includes(rule.health));
  if (evaluatedRules.length !== expectedUids.length || unhealthy.length) {
    throw new Error(`Expected ${expectedUids.length} evaluated rules without query errors; got ${evaluatedRules.length}.`);
  }

  const contactResponse = await fetch(`${baseUrl}/api/v1/provisioning/contact-points`, {
    headers: { authorization, accept: 'application/json' },
  });
  if (!contactResponse.ok) throw new Error(`Grafana contact point API returned HTTP ${contactResponse.status}.`);
  const contactPoints = await contactResponse.json();
  if (!contactPoints.some(point => point.name === 'familytracker-gmail')) {
    throw new Error('Provisioned Gmail contact point is missing.');
  }

  const datasourceResponse = await fetch(`${baseUrl}/api/datasources`, {
    headers: { authorization, accept: 'application/json' },
  });
  if (!datasourceResponse.ok) throw new Error(`Grafana datasource API returned HTTP ${datasourceResponse.status}.`);
  const datasources = await datasourceResponse.json();
  for (const uid of ['familytracker-prometheus', 'familytracker-loki', 'familytracker-tempo']) {
    if (!datasources.some(datasource => datasource.uid === uid)) {
      throw new Error(`Provisioned datasource ${uid} is missing.`);
    }
  }

  const noDataCount = evaluatedRules.filter(rule => rule.health === 'nodata').length;
  process.stdout.write(`Validated ${expectedUids.length} local rules, Gmail contact point, and Prometheus/Loki/Tempo datasources; ${noDataCount} queries currently have no sample and none have query errors.\n`);
}

main().catch(error => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
