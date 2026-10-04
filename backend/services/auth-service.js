const { readDatabase } = require('../db/connection');
const { findUserWithPasswordHash } = require('../db/user-repository');
const { AppError, HTTP_STATUS } = require('../middleware/errors');
const { registerLoginAttempt, resetLoginAttempts } = require('./login-rate-limiter');
const { verifyPassword } = require('./password-service');

async function authenticateUser({ username, password }) {
  registerLoginAttempt(username);

  const user = await readDatabase((database) => findUserWithPasswordHash(database, username));
  const isPasswordCorrect = user && (await verifyPassword(password, user.password_hash));

  if (!isPasswordCorrect) {
    throw new AppError(HTTP_STATUS.UNAUTHORIZED, 'INVALID_CREDENTIALS', 'Username or password is incorrect.');
  }

  resetLoginAttempts(username);
  return mapToPublicUser(user);
}

function mapToPublicUser(user) {
  return { id: user.id, username: user.username, role: user.role };
}

module.exports = { authenticateUser };
