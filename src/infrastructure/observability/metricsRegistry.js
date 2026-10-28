const { createNoopMetrics } = require('../../application/ports/metrics');
const { MAX_SERIES, definitions, normalizeLabels, seriesCost } = require('./metricsPolicy');

function createMetrics({ enabled = false, maxSeries = MAX_SERIES, runtime = false } = {}) {
  if (!enabled) return createNoopMetrics();
  try {
    // Disabled mode does not load prom-client, start timers or allocate a registry.
    const { Registry, Counter, Histogram, Gauge } = require('prom-client');
    const registry = new Registry();
    const instruments = new Map();
    const seen = new Set();
    const collectors = new Set();
    const limit = Number.isInteger(maxSeries) && maxSeries > 0 ? Math.min(maxSeries, MAX_SERIES) : MAX_SERIES;
    let series = 0;
    let closed = false;
    let stopRuntime = () => {};
    let collectRuntime = () => {};
    for (const [name, definition] of Object.entries(definitions)) {
      const Constructor = definition.type === 'counter' ? Counter : definition.type === 'gauge' ? Gauge : Histogram;
      instruments.set(name, new Constructor({
        name: `familytracker_${name}`, help: definition.help,
        labelNames: Object.keys(definition.labels), buckets: definition.buckets, registers: [registry],
      }));
    }

    if (runtime && limit >= 16) {
      const { monitorEventLoopDelay, PerformanceObserver } = require('node:perf_hooks');
      const names = [
        'process_resident_memory_bytes', 'nodejs_heap_used_bytes', 'nodejs_heap_total_bytes',
        'nodejs_external_memory_bytes', 'nodejs_array_buffers_bytes', 'process_cpu_user_seconds_total',
        'process_cpu_system_seconds_total', 'process_uptime_seconds', 'process_start_time_seconds',
        'nodejs_active_resources', 'event_loop_delay_mean_seconds', 'event_loop_delay_max_seconds',
        'event_loop_delay_p99_seconds', 'nodejs_gc_duration_seconds_total', 'nodejs_gc_events_total',
        'telemetry_series',
      ];
      const gauges = names.map(name => new Gauge({ name: `familytracker_${name}`, help: name, registers: [registry] }));
      series += names.length;
      const delay = monitorEventLoopDelay({ resolution: 20 });
      let gcSeconds = 0;
      let gcCount = 0;
      const observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) { gcSeconds += entry.duration / 1000; gcCount++; }
      });
      stopRuntime = () => { delay.disable(); observer.disconnect(); };
      try {
        delay.enable();
        observer.observe({ entryTypes: ['gc'] });
      } catch { stopRuntime(); }
      collectRuntime = () => {
        const memory = process.memoryUsage();
        const cpu = process.cpuUsage();
        const uptime = process.uptime();
        const values = [memory.rss, memory.heapUsed, memory.heapTotal, memory.external,
          memory.arrayBuffers, cpu.user / 1e6, cpu.system / 1e6, uptime,
          Math.floor(Date.now() / 1000 - uptime), process.getActiveResourcesInfo().length,
          delay.mean / 1e9, delay.max / 1e9, delay.percentile(99) / 1e9, gcSeconds, gcCount, series];
        values.forEach((value, index) => gauges[index].set(Number.isFinite(value) ? value : 0));
        delay.reset();
      };
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
        else if (type === 'gauge') instrument.set(labels, value);
        else instrument.observe(labels, value);
      } catch { /* Telemetry must not affect requests, including malformed labels. */ }
    }

    return Object.freeze({
      enabled: true,
      increment(name, labels, value = 1) { record('counter', name, labels, value); },
      observe(name, labels, value) { record('histogram', name, labels, value); },
      set(name, labels, value) { record('gauge', name, labels, value); },
      addCollector(collector) { if (!closed && typeof collector === 'function' && collectors.size < 16) collectors.add(collector); },
      async snapshot() {
        try {
          if (closed) return { text: '', series: 0 };
          for (const collect of collectors) {
            try { collect(); } catch { /* A failed collector cannot block scraping. */ }
          }
          collectRuntime();
          return { text: await registry.metrics(), series, contentType: registry.contentType };
        } catch { return { text: '', series: 0, failed: true }; }
      },
      close() {
        closed = true;
        stopRuntime();
        registry.clear();
        seen.clear();
        collectors.clear();
        series = 0;
      },
    });
  } catch { return createNoopMetrics(); }
}

module.exports = { createMetrics };
