const { z } = require('zod');

const objectId = z
  .string({ error: 'Must be a string.' })
  .regex(/^[a-f0-9]{24}$/i, 'Invalid ID format.')
  .transform((v) => v.toLowerCase());

const httpsUrl = z
  .string()
  .trim()
  .max(2048)
  .pipe(z.url({ protocol: /^https$/, error: 'Must be a valid https URL.' }));

/** [{ field: 'body.name', message }] */
function formatIssues(error, prefix) {
  return error.issues.map((issue) => ({
    field: [prefix, ...issue.path].filter((p) => p !== undefined && p !== '').join('.') || prefix || null,
    message: issue.message,
  }));
}

module.exports = { z, objectId, httpsUrl, formatIssues };
