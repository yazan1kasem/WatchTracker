const { ROLES } = require('../constants');
const { createValidationError } = require('../middleware/errors');

const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 30;
const MIN_PASSWORD_LENGTH = 8;
const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;
const VALID_ROLES = new Set(Object.values(ROLES));

function requireObjectBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createValidationError('Request body must be an object.');
  }

  return body;
}

function validateUsername(value) {
  const username = typeof value === 'string' ? value.trim() : value;
  const isValid =
    typeof username === 'string' &&
    username.length >= MIN_USERNAME_LENGTH &&
    username.length <= MAX_USERNAME_LENGTH &&
    USERNAME_PATTERN.test(username);

  if (!isValid) {
    throw createValidationError('Username is invalid.');
  }

  return username.toLowerCase();
}

function validatePassword(value) {
  if (typeof value !== 'string' || value.length < MIN_PASSWORD_LENGTH) {
    throw createValidationError(`Password must contain at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  return value;
}

function validateRole(value) {
  if (!VALID_ROLES.has(value)) {
    throw createValidationError('Role must be user or admin.');
  }

  return value;
}

function validateRegistration(body) {
  requireObjectBody(body);

  return {
    username: validateUsername(body.username),
    password: validatePassword(body.password)
  };
}

// Login only requires a password: accounts created before the length rule must still sign in.
function validateLoginCredentials(body) {
  requireObjectBody(body);
  const username = validateUsername(body.username);

  if (typeof body.password !== 'string' || body.password === '') {
    throw createValidationError('Password is required.');
  }

  return { username, password: body.password };
}

function validateUserUpdates(body) {
  const updates = {};

  if (Object.hasOwn(body, 'username')) {
    updates.username = validateUsername(body.username);
  }
  if (Object.hasOwn(body, 'role')) {
    updates.role = validateRole(body.role);
  }
  if (Object.hasOwn(body, 'password')) {
    updates.password = validatePassword(body.password);
  }

  return updates;
}

module.exports = {
  validateLoginCredentials,
  validatePassword,
  validateRegistration,
  validateRole,
  validateUserUpdates,
  validateUsername
};
