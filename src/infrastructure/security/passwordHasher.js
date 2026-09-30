const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

module.exports = {
  hash(password) {
    return bcrypt.hash(password, SALT_ROUNDS);
  },
  compare(password, hash) {
    return bcrypt.compare(password, hash);
  },
};
