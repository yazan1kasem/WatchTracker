const { AppError } = require('../middleware/errors');

const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 30;

const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

function validateCredentials(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Request body must be an object.');
  }

  const username = normalizeUsername(body.username);
  const password = body.password;

  return { password, username };
}

function normalizeUsername(username) {
  const normalizedUsername = typeof username === 'string' ? username.trim() : username;

  if (
    typeof normalizedUsername !== 'string' ||
    normalizedUsername.length < MIN_USERNAME_LENGTH ||
    normalizedUsername.length > MAX_USERNAME_LENGTH ||
    !USERNAME_PATTERN.test(normalizedUsername)
  ) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Username is invalid.');
  }

  return normalizedUsername.toLowerCase();
}

module.exports = { normalizeUsername, validateCredentials };