const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

/** S3-compatible object storage (AWS S3, Cloudflare R2, MinIO...). */
function createS3Storage(config) {
  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    // Otherwise the SDK adds CRC32 checksum params to presigned PUTs, which plain clients (and R2) reject.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });

  const publicPrefix = `${config.publicBaseUrl}/`;

  return {
    maxUploadBytes: config.maxUploadBytes,
    urlTtlSeconds: config.urlTtlSeconds,

    publicUrlFor(key) {
      return publicPrefix + key;
    },

    keyFromPublicUrl(url) {
      return typeof url === 'string' && url.startsWith(publicPrefix) ? url.slice(publicPrefix.length) : null;
    },

    async createPresignedUpload({ key, contentType, contentLength }) {
      const command = new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        ContentType: contentType,
        ContentLength: contentLength,
      });
      // Signing these headers makes the URL unusable for any other type or size.
      const url = await getSignedUrl(client, command, {
        expiresIn: config.urlTtlSeconds,
        signableHeaders: new Set(['content-type', 'content-length']),
      });
      return {
        url,
        headers: { 'Content-Type': contentType, 'Content-Length': String(contentLength) },
      };
    },
  };
}

module.exports = { createS3Storage };
