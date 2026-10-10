const { z } = require('zod');

const emptyToUndefined = (schema) => z.preprocess((v) => (v === '' ? undefined : v), schema);
const optionalString = emptyToUndefined(z.string().trim().min(1).optional());
const optionalUrl = emptyToUndefined(z.url().optional());

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().int().min(0).max(65535).default(3000),
  MONGODB_URI: optionalString,
  JWT_SECRET: optionalString,
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  CORS_ORIGIN: z.string().default('*'),
  PUBLIC_URL: optionalUrl,
  RENDER_EXTERNAL_URL: optionalUrl,
  AUTH_RATE_LIMIT: z.coerce.number().int().positive().default(20),
  GOOGLE_CLIENT_ID: optionalString,

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
  if (isProduction && !e.MONGODB_URI) missing.push('MONGODB_URI');

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
    jwt: { secret: e.JWT_SECRET, expiresIn: e.JWT_EXPIRES_IN, refreshExpiresIn: e.JWT_REFRESH_EXPIRES_IN },
    oauth: {
      googleClientId: e.GOOGLE_CLIENT_ID,
    },
    corsOrigin,
    publicUrl: e.PUBLIC_URL || e.RENDER_EXTERNAL_URL || `http://localhost:${e.PORT}`,
    authRateLimit: e.AUTH_RATE_LIMIT,
    storage: r2Storage || legacyStorage,
  };
}

module.exports = { loadConfig, ConfigError };
