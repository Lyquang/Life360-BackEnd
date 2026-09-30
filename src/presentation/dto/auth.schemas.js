const { z } = require('./common');

const email = z.string().trim().toLowerCase().pipe(z.email('Please provide a valid email.'));

const registerBody = z.object({
  name: z.string().trim().min(2).max(50),
  email,
  password: z.string().min(6).max(128),
});

const loginBody = z.object({
  email,
  password: z.string().min(1).max(128),
});

module.exports = { registerBody, loginBody };
