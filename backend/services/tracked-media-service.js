const { MEDIA_TYPES } = require('../constants');
const { isUniqueViolation, readDatabase, writeDatabase } = require('../db/connection');
const {
  deleteTrackedMediaById,
  findTrackedMediaById,
  findTrackedMediaByUser,
  insertTrackedMedia,
  listTrackedMediaWithUsernames,
  updateTrackedMediaColumns
} = require('../db/tracked-media-repository');
const { createConflictError, createNotFoundError, createValidationError } = require('../middleware/errors');
const { calculateSeriesProgress, isCompleted, validateMovieProgress } = require('./progress');
const { refreshSeriesEntry } = require('./series-refresh-service');
const { fetchMediaDetails, fetchSeasonEpisodes } = require('./tmdb-client');
const { ensureUserExists } = require('./user-service');

const NOT_FOUND_MESSAGE = 'Tracked media entry not found.';
const ALREADY_TRACKED_MESSAGE = 'Media is already tracked for this user.';
const FIRST_POSITION = 1;
const POSITION_COLUMNS = ['progress', 'current_season', 'current_episode'];

function addCompletionStatus(entry) {
  return {
    ...entry,
    is_public: Boolean(entry.is_public),
    is_completed: isCompleted(entry)
  };
}

async function getTrackedMedia(trackedMediaId) {
  const entry = await readDatabase((database) => requireTrackedMedia(database, trackedMediaId));
  return addCompletionStatus(entry);
}

async function listTrackedMedia(userId) {
  const entries = await readDatabase((database) => findTrackedMediaByUser(database, userId));
  // ponytail: one TMDB request per series in parallel; add a concurrency limit if libraries outgrow TMDB's rate limit.
  const changes = await Promise.all(entries.map(refreshSeriesEntry));
  const refreshes = entries
    .map((entry, index) => ({ entry, changes: changes[index] }))
    .filter((refresh) => Object.keys(refresh.changes).length > 0);

  if (refreshes.length === 0) {
    return entries.map(addCompletionStatus);
  }

  const refreshedEntries = await writeDatabase((database) => {
    refreshes.forEach((refresh) => applySeriesRefresh(database, refresh));
    return findTrackedMediaByUser(database, userId);
  });
  return refreshedEntries.map(addCompletionStatus);
}

async function listAllTrackedMedia() {
  const entries = await readDatabase(listTrackedMediaWithUsernames);
  return entries.map(addCompletionStatus);
}

async function createTrackedMedia(userId, tmdbId, mediaType) {
  const details = await fetchMediaDetails(mediaType, tmdbId);

  const entry = await writeTrackedMediaChange((database) => {
    ensureUserExists(database, userId);
    const trackedMediaId = insertTrackedMedia(database, userId, details);
    return findTrackedMediaById(database, trackedMediaId);
  });
  return addCompletionStatus(entry);
}

async function updateTrackedMedia(trackedMediaId, updates) {
  const entry = await readDatabase((database) => {
    const existingEntry = requireTrackedMedia(database, trackedMediaId);
    if (updates.user_id !== undefined) {
      ensureUserExists(database, updates.user_id);
    }
    return existingEntry;
  });
  const columns = buildUpdateColumns(updates, await resolveProgress(entry, updates));

  if (Object.keys(columns).length === 0) {
    return addCompletionStatus(entry);
  }

  const updatedEntry = await writeTrackedMediaChange((database) => {
    requireTrackedMedia(database, trackedMediaId);
    updateTrackedMediaColumns(database, trackedMediaId, columns);
    return findTrackedMediaById(database, trackedMediaId);
  });
  return addCompletionStatus(updatedEntry);
}

async function deleteTrackedMedia(trackedMediaId) {
  return writeDatabase((database) => {
    const entry = requireTrackedMedia(database, trackedMediaId);
    deleteTrackedMediaById(database, trackedMediaId);
    return entry;
  });
}

async function resolveProgress(entry, updates) {
  if (entry.media_type === MEDIA_TYPES.MOVIE) {
    return resolveMovieProgress(entry, updates);
  }

  return resolveSeriesProgress(entry, updates);
}

function resolveMovieProgress(entry, updates) {
  if (updates.progress === undefined) {
    return undefined;
  }

  return validateMovieProgress(updates.progress, entry.total_runtime);
}

// Series progress is derived from season and episode whenever one of them is sent.
async function resolveSeriesProgress(entry, updates) {
  if (updates.current_season === undefined && updates.current_episode === undefined) {
    return validateSeriesProgress(entry, updates.progress);
  }

  const season = updates.current_season ?? entry.current_season ?? FIRST_POSITION;
  const episode = updates.current_episode ?? entry.current_episode ?? FIRST_POSITION;

  // Also stops a huge season number from triggering one TMDB request per season.
  if (entry.total_seasons !== null && season > entry.total_seasons) {
    throw createValidationError('Current season does not exist.');
  }

  const seasons = await fetchSeasonEpisodes(entry.tmdb_id, season);
  return calculateSeriesProgress(seasons, season, episode);
}

function validateSeriesProgress(entry, progress) {
  if (progress === undefined) {
    return undefined;
  }

  if (entry.total_episodes !== null && progress > entry.total_episodes) {
    throw createValidationError('Progress cannot exceed total episodes.');
  }

  return progress;
}

function buildUpdateColumns(updates, progress) {
  const columns = { ...updates };

  if (progress !== undefined) {
    columns.progress = progress;
  }

  // last_watched_at tracks watching progress, not edits to notes, rating or visibility.
  if (POSITION_COLUMNS.some((column) => Object.hasOwn(columns, column))) {
    columns.last_watched_at = new Date().toISOString();
  }

  return columns;
}

// A PATCH may have moved the position while TMDB was queried; the user's change wins.
function applySeriesRefresh(database, { entry, changes }) {
  const currentEntry = findTrackedMediaById(database, entry.id);

  if (!currentEntry) {
    return;
  }

  const { progress, ...metadata } = changes;
  const isPositionUnchanged = POSITION_COLUMNS.every((column) => currentEntry[column] === entry[column]);
  const columns = progress !== undefined && isPositionUnchanged ? { ...metadata, progress } : metadata;

  if (Object.keys(columns).length > 0) {
    updateTrackedMediaColumns(database, entry.id, columns);
  }
}

function requireTrackedMedia(database, trackedMediaId) {
  const entry = findTrackedMediaById(database, trackedMediaId);

  if (!entry) {
    throw createNotFoundError(NOT_FOUND_MESSAGE);
  }

  return entry;
}

async function writeTrackedMediaChange(change) {
  try {
    return await writeDatabase(change);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw createConflictError(ALREADY_TRACKED_MESSAGE);
    }
    throw error;
  }
}

module.exports = {
  createTrackedMedia,
  deleteTrackedMedia,
  getTrackedMedia,
  listAllTrackedMedia,
  listTrackedMedia,
  updateTrackedMedia
};
