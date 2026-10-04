const { AppError } = require('../middleware/errors');

const VALID_ROLES = new Set(['user', 'admin']);
const USER_ID_PATTERN = /^\d+$/;
const MIN_PASSWORD_LENGTH = 8;

function validateUserId(value) {
  if (!USER_ID_PATTERN.test(String(value))) {
    throw new AppError(400, 'VALIDATION_ERROR', 'User ID is invalid.');
  }

  const numericValue = Number(value);

  if (!Number.isInteger(numericValue) || numericValue <= 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'User ID is invalid.');
  }

  return numericValue;
}

function validateRole(value) {
  if (typeof value !== 'string' || !VALID_ROLES.has(value)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Role must be user or admin.');
  }

  return value;
}

function validatePassword(value) {
  if (typeof value !== 'string' || value.length < MIN_PASSWORD_LENGTH) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Password must contain at least 8 characters.');
  }

  return value;
}

module.exports = { validatePassword, validateRole, validateUserId };