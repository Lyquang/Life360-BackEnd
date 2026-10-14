const { z } = require('zod');

const emptyToUndefined = (schema) => z.preprocess((v) => (v === '' ? undefined : v), schema);
const optionalString = emptyToUndefined(z.string().trim().min(1).optional());
const optionalUrl = emptyToUndefined(z.url().optional());

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().int().min(0).max(65535).default(3000),
  MONGODB_URI: optionalString,
  JWT_SECRET: optionalString,
  JWT_ACCESS_EXPIRES_IN: optionalString,
  JWT_EXPIRES_IN: optionalString,
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  AUTH_MAX_ACTIVE_SESSIONS: z.coerce.number().int().min(1).max(100).default(10),
  CORS_ORIGIN: z.string().default('*'),
  PUBLIC_URL: optionalUrl,
  RENDER_EXTERNAL_URL: optionalUrl,
  AUTH_RATE_LIMIT: z.coerce.number().int().positive().default(20),
  REFRESH_RATE_LIMIT: z.coerce.number().int().positive().default(60),
  LOCATION_BATCH_RATE_LIMIT: z.coerce.number().int().positive().default(30),
  LOCATION_BATCH_MAX_POINTS: z.coerce.number().int().min(1).max(1000).default(100),
  LOCATION_BATCH_MAX_AGE_HOURS: z.coerce.number().int().min(1).max(168).default(24),
  GOOGLE_CLIENT_ID: optionalString,

  REDIS_ENABLED: z.enum(['true', 'false']).default('false'),
  REDIS_URL: optionalString,
  REDIS_KEY_PREFIX: z.string().default('familytracker:'),
  REDIS_DEFAULT_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  REDIS_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  REDIS_MAX_RETRIES_PER_REQUEST: z.coerce.number().int().min(0).max(10).default(2),
  REDIS_LOCATION_TTL_SECONDS: z.coerce.number().int().positive().default(300),

  S3_BUCKET: optionalString,
  S3_REGION: z.string().default('auto'),
  S3_ENDPOINT: optionalUrl,
  S3_ACCESS_KEY_ID: optionalString,
  S3_SECRET_ACCESS_KEY: optionalString,
  S3_PUBLIC_BASE_URL: optionalUrl,
  S3_FORCE_PATH_STYLE: z.enum(['true', 'false']).default('false'),
  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  UPLOAD_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(300),

  R2_ACCOUNT_ID: optionalString,
  R2_ACCESS_KEY_ID: optionalString,
  R2_SECRET_ACCESS_KEY: optionalString,
  R2_BUCKET_NAME: optionalString,
  R2_PUBLIC_DOMAIN: optionalUrl,
  R2_REGION: z.string().default('auto'),
  R2_UPLOAD_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(300),
  R2_IMAGE_MAX_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  R2_VOICE_MAX_BYTES: z.coerce.number().int().positive().default(25 * 1024 * 1024),
});

const STORAGE_KEYS = ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_PUBLIC_BASE_URL'];
const R2_STORAGE_KEYS = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_PUBLIC_DOMAIN'];

class ConfigError extends Error {}

function loadConfig(env = process.env) {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new ConfigError(`Invalid environment variables: ${details}`);
  }
  const e = parsed.data;
  const isProduction = e.NODE_ENV === 'production';

  const missing = [];
  if (!e.JWT_SECRET) missing.push('JWT_SECRET');
  if (isProduction && e.JWT_SECRET === 'change_me') {
    throw new ConfigError('JWT_SECRET must not use the default value in production.');
  }
  if (isProduction && !e.MONGODB_URI) missing.push('MONGODB_URI');
  if (e.REDIS_ENABLED === 'true' && !e.REDIS_URL) missing.push('REDIS_URL');

  const configuredStorageKeys = STORAGE_KEYS.filter((k) => e[k]);
  if (configuredStorageKeys.length > 0 && configuredStorageKeys.length < STORAGE_KEYS.length) {
    missing.push(...STORAGE_KEYS.filter((k) => !e[k]));
  }
  const configuredR2StorageKeys = R2_STORAGE_KEYS.filter((k) => e[k]);
  if (configuredR2StorageKeys.length > 0 && configuredR2StorageKeys.length < R2_STORAGE_KEYS.length) {
    missing.push(...R2_STORAGE_KEYS.filter((k) => !e[k]));
  }
  if (missing.length > 0) {
    throw new ConfigError(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const legacyStorage = configuredStorageKeys.length
    ? {
        bucket: e.S3_BUCKET,
        region: e.S3_REGION,
        endpoint: e.S3_ENDPOINT,
        accessKeyId: e.S3_ACCESS_KEY_ID,
        secretAccessKey: e.S3_SECRET_ACCESS_KEY,
        publicBaseUrl: e.S3_PUBLIC_BASE_URL.replace(/\/+$/, ''),
        forcePathStyle: e.S3_FORCE_PATH_STYLE === 'true',
        maxUploadBytes: e.UPLOAD_MAX_BYTES,
        urlTtlSeconds: e.UPLOAD_URL_TTL_SECONDS,
      }
    : null;

  const r2Storage = configuredR2StorageKeys.length
    ? {
        provider: 'cloudflare-r2',
        accountId: e.R2_ACCOUNT_ID,
        bucket: e.R2_BUCKET_NAME,
        region: e.R2_REGION,
        accessKeyId: e.R2_ACCESS_KEY_ID,
        secretAccessKey: e.R2_SECRET_ACCESS_KEY,
        publicBaseUrl: e.R2_PUBLIC_DOMAIN.replace(/\/+$/, ''),
        imageMaxBytes: e.R2_IMAGE_MAX_BYTES,
        voiceMaxBytes: e.R2_VOICE_MAX_BYTES,
        urlTtlSeconds: e.R2_UPLOAD_URL_TTL_SECONDS,
      }
    : null;

  const corsOrigin =
    e.CORS_ORIGIN.trim() === '*' ? '*' : e.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean);

  return {
    env: e.NODE_ENV,
    isProduction,
    port: e.PORT,
    mongodbUri: e.MONGODB_URI || 'mongodb://localhost:27017/location-sharing-app',
    // Only local development may silently fall back to an in-memory database.
    allowInMemoryDatabase: e.NODE_ENV === 'development',
    jwt: {
      secret: e.JWT_SECRET,
      accessExpiresIn: e.JWT_ACCESS_EXPIRES_IN || e.JWT_EXPIRES_IN || '15m',
      refreshTtlDays: e.REFRESH_TOKEN_TTL_DAYS,
    },
    oauth: {
      googleClientId: e.GOOGLE_CLIENT_ID,
    },
    corsOrigin,
    publicUrl: e.PUBLIC_URL || e.RENDER_EXTERNAL_URL || `http://localhost:${e.PORT}`,
    authRateLimit: e.AUTH_RATE_LIMIT,
    refreshRateLimit: e.REFRESH_RATE_LIMIT,
    locationBatch: {
      rateLimit: e.LOCATION_BATCH_RATE_LIMIT,
      maxPoints: e.LOCATION_BATCH_MAX_POINTS,
      maxAgeMs: e.LOCATION_BATCH_MAX_AGE_HOURS * 60 * 60 * 1000,
      maxFutureMs: 60 * 1000,
    },
    authMaxActiveSessions: e.AUTH_MAX_ACTIVE_SESSIONS,
    storage: r2Storage || legacyStorage,
    redis: {
      enabled: e.REDIS_ENABLED === 'true',
      url: e.REDIS_URL,
      keyPrefix: e.REDIS_KEY_PREFIX,
      defaultTtlSeconds: e.REDIS_DEFAULT_TTL_SECONDS,
      connectTimeoutMs: e.REDIS_CONNECT_TIMEOUT_MS,
      maxRetriesPerRequest: e.REDIS_MAX_RETRIES_PER_REQUEST,
      locationTtlSeconds: e.REDIS_LOCATION_TTL_SECONDS,
    },
  };
}

module.exports = { loadConfig, ConfigError };
