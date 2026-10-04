const { AppError } = require('../middleware/errors');

const MEDIA_TYPES = new Set(['movie', 'tv']);

function validateMediaType(mediaType) {
  if (!MEDIA_TYPES.has(mediaType)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Media type must be movie or tv.');
  }

  return mediaType;
}

function validateRating(value) {
  if (value === undefined) {
    return undefined;
  }

  if (!Number.isInteger(value) || value < 1 || value > 10) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Rating must be an integer between 1 and 10.');
  }

  return value;
}

function validateNotes(value) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new AppError(400, 'VALIDATION_ERROR', 'Notes must be a string.');
  }

  return value;
}

function validateVisibility(value) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  if (value === 0 || value === 1) {
    return value;
  }

  throw new AppError(400, 'VALIDATION_ERROR', 'Visibility must be true or false.');
}

function validateProgressValue(value) {
  if (value === undefined) {
    return undefined;
  }

  if (!Number.isInteger(value) || value < 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Progress must be a non-negative integer.');
  }

  return value;
}

function validateSeasonNumber(value, fieldName) {
  if (value === undefined) {
    return undefined;
  }

  if (!Number.isInteger(value) || value < 1) {
    throw new AppError(400, 'VALIDATION_ERROR', `${fieldName} must be a positive integer.`);
  }

  return value;
}

function validateTrackedMediaUpdates(body) {
  return {
    rating: validateRating(body.rating),
    notes: validateNotes(body.notes),
    is_public: validateVisibility(body.is_public),
    progress: validateProgressValue(body.progress),
    current_season: validateSeasonNumber(body.current_season, 'Current season'),
    current_episode: validateSeasonNumber(body.current_episode, 'Current episode')
  };
}

module.exports = { validateMediaType, validateTrackedMediaUpdates };