const { MEDIA_TYPES } = require('../constants');
const { createValidationError } = require('../middleware/errors');
const { parseId, requireNonNegativeInteger, requirePositiveInteger } = require('./numbers');

const VALID_MEDIA_TYPES = new Set(Object.values(MEDIA_TYPES));
const MIN_RATING = 1;
const MAX_RATING = 10;

function validateMediaType(mediaType) {
  if (!VALID_MEDIA_TYPES.has(mediaType)) {
    throw createValidationError('Media type must be movie or tv.');
  }

  return mediaType;
}

// null removes an existing rating.
function validateRating(value) {
  if (value === null) {
    return null;
  }

  if (!Number.isInteger(value) || value < MIN_RATING || value > MAX_RATING) {
    throw createValidationError(`Rating must be an integer between ${MIN_RATING} and ${MAX_RATING}.`);
  }

  return value;
}

function validateNotes(value) {
  if (typeof value !== 'string') {
    throw createValidationError('Notes must be a string.');
  }

  return value;
}

// The database stores visibility as 0/1.
function validateVisibility(value) {
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  if (value === 0 || value === 1) {
    return value;
  }

  throw createValidationError('Visibility must be true or false.');
}

function validateIfPresent(value, validate, fieldName) {
  return value === undefined ? undefined : validate(value, fieldName);
}

function removeUndefinedValues(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}

function validateTrackedMediaUpdates(body) {
  const updates = {
    rating: validateIfPresent(body.rating, validateRating),
    notes: validateIfPresent(body.notes, validateNotes),
    is_public: validateIfPresent(body.is_public, validateVisibility),
    progress: validateIfPresent(body.progress, requireNonNegativeInteger, 'Progress'),
    current_season: validateIfPresent(body.current_season, requirePositiveInteger, 'Current season'),
    current_episode: validateIfPresent(body.current_episode, requirePositiveInteger, 'Current episode')
  };

  return removeUndefinedValues(updates);
}

function validateNewTrackedMedia(body) {
  return {
    tmdbId: parseId(body?.tmdb_id ?? '', 'TMDB ID'),
    mediaType: validateMediaType(body?.media_type)
  };
}

module.exports = {
  validateMediaType,
  validateNewTrackedMedia,
  validateTrackedMediaUpdates
};
