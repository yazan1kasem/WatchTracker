const { createValidationError } = require('../middleware/errors');
const { parsePositiveInteger } = require('./numbers');

const MAX_TMDB_PAGE = 500;
const POSTER_PATH_PATTERN = /^\/[A-Za-z0-9_./-]+$/;

function validatePage(value) {
  const page = parsePositiveInteger(value);

  if (page === null || page > MAX_TMDB_PAGE) {
    throw createValidationError(`Page must be between 1 and ${MAX_TMDB_PAGE}.`);
  }

  return page;
}

function validatePosterPath(value) {
  const isSafePath =
    typeof value === 'string' && POSTER_PATH_PATTERN.test(value) && !value.includes('..');

  if (!isSafePath) {
    throw createValidationError('Poster path is invalid.');
  }

  return value;
}

function validateSearchQuery(value) {
  const query = typeof value === 'string' ? value.trim() : '';

  if (!query) {
    throw createValidationError('Search query is required.');
  }

  return query;
}

module.exports = { validatePage, validatePosterPath, validateSearchQuery };
