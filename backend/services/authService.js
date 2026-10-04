const config = require('../config');
const { withDatabase } = require('../db/connection');
const { AppError } = require('../middleware/errors');
const { hashPassword, verifyPassword } = require('./passwordService');

const USER_ROLE = 'user';
const failedLoginAttempts = new Map();

function findUserByUsername(database, username) {
  const statement = database.prepare(
    'SELECT id, username, password_hash, role FROM users WHERE username = ?'
  );

  try {
    statement.bind([username]);
    return statement.step() ? statement.getAsObject() : null;
  } finally {
    statement.free();
  }
}

function findUserById(database, userId) {
  const statement = database.prepare(
    'SELECT id, username, role FROM users WHERE id = ?'
  );

  try {
    statement.bind([userId]);
    return statement.step() ? statement.getAsObject() : null;
  } finally {
    statement.free();
  }
}

function toPublicUser(user) {
  return { id: user.id, username: user.username, role: user.role };
}

function checkLoginRateLimit(username) {
  const attempt = failedLoginAttempts.get(username);

  if (!attempt || Date.now() - attempt.startedAt >= config.LOGIN_WINDOW_MS) {
    failedLoginAttempts.delete(username);
    return;
  }

  if (attempt.count >= config.MAX_LOGIN_ATTEMPTS) {
    throw new AppError(429, 'LOGIN_RATE_LIMITED', 'Too many login attempts.');
  }
}

function recordFailedLogin(username) {
  const attempt = failedLoginAttempts.get(username);
  const currentAttempt =
    attempt && Date.now() - attempt.startedAt < config.LOGIN_WINDOW_MS
      ? attempt
      : { count: 0, startedAt: Date.now() };

  failedLoginAttempts.set(username, {
    count: currentAttempt.count + 1,
    startedAt: currentAttempt.startedAt
  });
}

async function registerUser(credentials) {
  const passwordHash = await hashPassword(credentials.password);

  try {
    return await withDatabase((database) => {
      database.run(
        'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
        [credentials.username, passwordHash, USER_ROLE]
      );
      const userId = database.exec('SELECT last_insert_rowid()')[0].values[0][0];
      return toPublicUser({ id: userId, role: USER_ROLE, username: credentials.username });
    }, true);
  } catch (error) {
    if (String(error.message).includes('UNIQUE constraint failed: users.username')) {
      throw new AppError(409, 'DUPLICATE_RESOURCE', 'Username is already in use.');
    }
    throw error;
  }
}

async function authenticateUser(credentials) {
  checkLoginRateLimit(credentials.username);

  const user = await withDatabase((database) =>
    findUserByUsername(database, credentials.username)
  );
  const passwordMatches = user && (await verifyPassword(credentials.password, user.password_hash));

  if (!passwordMatches) {
    recordFailedLogin(credentials.username);
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Username or password is incorrect.');
  }

  failedLoginAttempts.delete(credentials.username);
  return { id: user.id, username: user.username, role: user.role };
}

async function getUserById(userId) {
  const user = await withDatabase((database) => findUserById(database, userId));

  if (!user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required.');
  }

  return user;
}

module.exports = { authenticateUser, getUserById, registerUser };