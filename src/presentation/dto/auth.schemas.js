const { z } = require('./common');

const email = z.string().trim().toLowerCase().pipe(z.email('Please provide a valid email.'));
const deviceName = z.string().trim().min(1).max(100).optional();

const registerBody = z.object({
  name: z.string().trim().min(2).max(50),
  email,
  password: z.string().min(6).max(128),
  deviceName,
});

const loginBody = z.object({
  email,
  password: z.string().min(1).max(128),
  deviceName,
});

const socialLoginBody = z.object({
  provider: z.enum(['google', 'apple', 'facebook']),
  token: z.string().trim().min(1).max(4096),
  deviceName,
});

const refreshBody = z.object({
  refreshToken: z.string().trim().min(32).max(512),
});

const logoutBody = z
  .object({
    refreshToken: z.string().trim().min(1).max(4096).optional(),
    allDevices: z.boolean().optional(),
  })
  .default({});

const changePasswordBody = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(6).max(128),
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    path: ['newPassword'],
    message: 'New password must be different from the current password.',
  });

module.exports = { registerBody, loginBody, socialLoginBody, refreshBody, logoutBody, changePasswordBody };
