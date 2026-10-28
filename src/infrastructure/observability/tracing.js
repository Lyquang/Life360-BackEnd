const { context, trace, SpanStatusCode } = require('@opentelemetry/api');

const SERVICE_NAME = 'familytracker-backend';
const ATTRIBUTE_ALLOWLIST = new Set([
  'http.request.method', 'http.route.group', 'http.response.status_code',
  'messaging.system', 'messaging.operation.name',
]);
let sdk;
let initialized = false;

function initializeTracing(env = process.env) {
  if (env.OTEL_ENABLED !== 'true' || initialized) return false;
  try {
    const { NodeSDK } = require('@opentelemetry/sdk-node');
    const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
    const endpoint = env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'http://tempo:4318/v1/traces';
    sdk = new NodeSDK({
      serviceName: SERVICE_NAME,
      traceExporter: new OTLPTraceExporter({ url: endpoint }),
    });
    sdk.start();
    initialized = true;
    return true;
  } catch {
    sdk = undefined;
    initialized = false;
    return false;
  }
}

function safeAttributes(attributes = {}) {
  const output = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (ATTRIBUTE_ALLOWLIST.has(key) && (typeof value === 'string' || Number.isInteger(value))) output[key] = value;
  }
  return output;
}

function startSpan(name, attributes) {
  if (!initialized) return { run: (callback) => callback(), end: () => {} };
  const span = trace.getTracer(SERVICE_NAME).startSpan(name, { attributes: safeAttributes(attributes) });
  const spanContext = trace.setSpan(context.active(), span);
  let ended = false;
  return {
    run(callback) { return context.with(spanContext, callback); },
    end(statusCode) {
      if (ended) return;
      ended = true;
      if (Number.isInteger(statusCode) && statusCode >= 500) {
        span.setStatus({ code: SpanStatusCode.ERROR });
      }
      span.end();
    },
  };
}

function withSpan(name, attributes, callback) {
  const active = startSpan(name, attributes);
  let result;
  try {
    result = active.run(callback);
  } catch (error) {
    active.end(500);
    throw error;
  }
  return Promise.resolve(result).then(
    (value) => { active.end(); return value; },
    (error) => { active.end(500); throw error; },
  );
}

async function shutdownTracing() {
  if (!sdk) return;
  const activeSdk = sdk;
  sdk = undefined;
  initialized = false;
  await activeSdk.shutdown();
}

module.exports = { initializeTracing, startSpan, withSpan, shutdownTracing, SERVICE_NAME };
