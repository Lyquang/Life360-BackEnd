const { Errors } = require('../../../domain/errors');
const { formatIssues } = require('../../dto/common');

const PARTS = ['params', 'query', 'body'];

/**
 * Validates req.params / req.query / req.body with Zod and exposes the parsed values as req.dto.
 * @param {{ params?: ZodType, query?: ZodType, body?: ZodType }} schemas
 */
function validate(schemas) {
  return (req, res, next) => {
    const dto = {};
    const issues = [];
    for (const part of PARTS) {
      if (!schemas[part]) continue;
      const result = schemas[part].safeParse(req[part] ?? {});
      if (result.success) dto[part] = result.data;
      else issues.push(...formatIssues(result.error, part));
    }
    if (issues.length > 0) return next(Errors.validation(issues));
    req.dto = dto;
    next();
  };
}

module.exports = { validate };
