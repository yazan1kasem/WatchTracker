const { createValidationError } = require('../middleware/errors');

const DIGITS_PATTERN = /^\d+$/;

function requireNonNegativeInteger(value, fieldName) {
  if (!Number.isInteger(value) || value < 0) {
    throw createValidationError(`${fieldName} must be a non-negative integer.`);
  }

  return value;
}

function requirePositiveInteger(value, fieldName) {
  if (!Number.isInteger(value) || value < 1) {
    throw createValidationError(`${fieldName} must be a positive integer.`);
  }

  return value;
}

// Accepts numbers and digit strings (route parameters, query strings); returns null otherwise.
function parsePositiveInteger(value) {
  const number = Number(value);
  const isPositiveInteger =
    DIGITS_PATTERN.test(String(value)) && Number.isSafeInteger(number) && number >= 1;

  return isPositiveInteger ? number : null;
}

function parseId(value, fieldName) {
  const id = parsePositiveInteger(value);

  if (id === null) {
    throw createValidationError(`${fieldName} is invalid.`);
  }

  return id;
}

module.exports = {
  parseId,
  parsePositiveInteger,
  requireNonNegativeInteger,
  requirePositiveInteger
};
