const { createNoopMetrics } = require('../../application/ports/metrics');
const { MAX_SERIES, definitions, normalizeLabels, seriesCost } = require('./metricsPolicy');

function createMetrics({ enabled = false, maxSeries = MAX_SERIES } = {}) {
  if (!enabled) return createNoopMetrics();
  try {
    // Disabled mode does not load prom-client, start timers or allocate a registry.
    const { Registry, Counter, Histogram } = require('prom-client');
    const registry = new Registry();
    const instruments = new Map();
    const seen = new Set();
    const limit = Number.isInteger(maxSeries) && maxSeries > 0 ? Math.min(maxSeries, MAX_SERIES) : MAX_SERIES;
    let series = 0;
    let closed = false;
    for (const [name, definition] of Object.entries(definitions)) {
      const Constructor = definition.type === 'counter' ? Counter : Histogram;
      instruments.set(name, new Constructor({
        name: `familytracker_${name}`, help: definition.help,
        labelNames: Object.keys(definition.labels), buckets: definition.buckets, registers: [registry],
      }));
    }

    function record(type, name, input, value) {
      try {
        if (closed || !Number.isFinite(value) || value < 0) return;
        const definition = Object.hasOwn(definitions, name) ? definitions[name] : null;
        if (!definition || definition.type !== type) return;
        const labels = normalizeLabels(definition, input);
        const key = JSON.stringify([name, labels]);
        if (!seen.has(key)) {
          const cost = seriesCost(definition);
          if (series + cost > limit) return;
          seen.add(key);
          series += cost;
        }
        const instrument = instruments.get(name);
        if (type === 'counter') instrument.inc(labels, value);
        else instrument.observe(labels, value);
      } catch { /* Telemetry must not affect requests, including malformed labels. */ }
    }

    return Object.freeze({
      enabled: true,
      increment(name, labels, value = 1) { record('counter', name, labels, value); },
      observe(name, labels, value) { record('histogram', name, labels, value); },
      async snapshot() {
        try {
          if (closed) return { text: '', series: 0 };
          return { text: await registry.metrics(), series, contentType: registry.contentType };
        } catch { return { text: '', series: 0, failed: true }; }
      },
      close() {
        closed = true;
        registry.clear();
        seen.clear();
        series = 0;
      },
    });
  } catch { return createNoopMetrics(); }
}

module.exports = { createMetrics };
