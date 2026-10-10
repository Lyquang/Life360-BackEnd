const { createS3Storage } = require('./s3Storage');

function createCloudflareR2StorageService(config) {
  return createS3Storage({
    bucket: config.bucket,
    region: config.region || 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    publicBaseUrl: config.publicBaseUrl,
    forcePathStyle: true,
    maxUploadBytes: Math.max(config.imageMaxBytes, config.voiceMaxBytes),
    imageMaxBytes: config.imageMaxBytes,
    voiceMaxBytes: config.voiceMaxBytes,
    urlTtlSeconds: config.urlTtlSeconds,
  });
}

module.exports = { createCloudflareR2StorageService };
