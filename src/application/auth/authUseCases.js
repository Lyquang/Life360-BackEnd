const { Errors } = require('../../domain/errors');

function createAuthUseCases({ userRepo, passwordHasher, tokenService }) {
  async function register({ name, email, password }) {
    if (await userRepo.existsByEmail(email)) throw Errors.conflict('Email already registered.');

    const passwordHash = await passwordHasher.hash(password);
    let user;
    try {
      user = await userRepo.create({ name, email, passwordHash });
    } catch (error) {
      if (error.code === 11000) throw Errors.conflict('Email already registered.');
      throw error;
    }
    return { user, token: tokenService.sign(user) };
  }

  async function login({ email, password }) {
    const user = await userRepo.findByEmailWithPassword(email);
    if (!user || !(await passwordHasher.compare(password, user.password))) {
      throw Errors.unauthorized('Invalid email or password.');
    }
    await userRepo.markOnline(user._id);
    user.isOnline = true;
    return { user, token: tokenService.sign(user) };
  }

  async function getProfile(userId) {
    const user = await userRepo.findById(userId);
    if (!user) throw Errors.notFound('User not found.');
    return user;
  }

  /** Resolves a JWT to the current user or throws 401. */
  async function authenticateToken(token) {
    let payload;
    try {
      payload = tokenService.verify(token);
    } catch (error) {
      throw Errors.unauthorized(
        error.name === 'TokenExpiredError' ? 'Token has expired. Please login again.' : 'Invalid token.'
      );
    }
    const user = await userRepo.findById(payload.id);
    if (!user) throw Errors.unauthorized('Token is valid but user no longer exists.');
    return user;
  }

  return { register, login, getProfile, authenticateToken };
}

module.exports = { createAuthUseCases };
