const config = require('../config');
const { withDatabase } = require('../db/connection');
const { AppError } = require('../middleware/errors');
const { calculateCompletion, calculateProgress } = require('../progress');
const {
  fetchTmdb,
  normalizeMovieDetails,
  normalizeTvDetails
} = require('./tmdbHelper');

const PATCH_FIELDS = [
  ['user_id', 'user_id'],
  ['rating', 'rating'],
  ['notes', 'notes'],
  ['is_public', 'is_public'],
  ['progress', 'progress'],
  ['current_season', 'current_season'],
  ['current_episode', 'current_episode']
];

function selectTrackedMedia(database, whereClause, parameters) {
  const statement = database.prepare(`
    SELECT id, user_id, tmdb_id, media_type, title, poster_path, release_date,
           total_runtime, total_seasons, total_episodes, current_season,
           current_episode, progress, rating, notes, is_public, last_watched_at
    FROM tracked_media
    WHERE ${whereClause}
    ORDER BY id DESC
  `);

  try {
    statement.bind(parameters);
    const entries = [];

    while (statement.step()) {
      entries.push(statement.getAsObject());
    }

    return entries;
  } finally {
    statement.free();
  }
}

function addCompletionStatus(entry) {
  return {
    ...entry,
    is_public: Boolean(entry.is_public),
    is_completed: calculateCompletion(
      entry.media_type,
      entry.progress,
      entry.total_runtime,
      entry.total_episodes
    )
  };
}

function insertTrackedMedia(database, userId, details) {
  database.run(
    `INSERT INTO tracked_media
      (user_id, tmdb_id, media_type, title, poster_path, release_date,
       total_runtime, total_seasons, total_episodes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      details.tmdb_id,
      details.media_type,
      details.title,
      details.poster_path,
      details.release_date,
      details.total_runtime ?? null,
      details.total_seasons ?? null,
      details.total_episodes ?? null
    ]
  );

  return database.exec('SELECT last_insert_rowid()')[0].values[0][0];
}

async function resolveProgress(entry, updates) {
  const requestedProgress = updates.progress;
  const requestedSeason = updates.current_season;
  const requestedEpisode = updates.current_episode;

  if (entry.media_type === 'movie') {
    if (requestedProgress === undefined) {
      return undefined;
    }

    return calculateProgress('movie', {
      progress: requestedProgress,
      totalRuntime: entry.total_runtime
    });
  }

  if (entry.media_type === 'tv') {
    if (requestedSeason !== undefined || requestedEpisode !== undefined) {
      const currentSeason = requestedSeason ?? entry.current_season ?? 1;
      const currentEpisode = requestedEpisode ?? entry.current_episode ?? 1;
      const seasons = [];

      for (let seasonNumber = 1; seasonNumber <= currentSeason; seasonNumber += 1) {
        const seasonData = await fetchTmdb(
          `/tv/${entry.tmdb_id}/season/${seasonNumber}`,
          config.TMDB_DETAILS_CACHE_MS
        );
        seasons.push({
          season_number: seasonNumber,
          episodes: (seasonData.episodes ?? []).map((episode) => ({
            episode_number: episode.episode_number
          }))
        });
      }

      return calculateProgress('tv', {
        seasons,
        currentSeason,
        currentEpisode
      });
    }

    if (requestedProgress !== undefined) {
      if (entry.total_episodes !== null && requestedProgress > entry.total_episodes) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Progress cannot exceed total episodes.');
      }

      return requestedProgress;
    }

    return undefined;
  }

  return undefined;
}

async function listTrackedMedia(database, userId) {
  const entries = selectTrackedMedia(database, 'user_id = ?', [userId]);

  for (const entry of entries) {
    if (
      entry.media_type !== 'tv' ||
      entry.progress !== 0 ||
      !entry.current_season ||
      !entry.current_episode
    ) {
      continue;
    }

    const progress = await resolveProgress(entry, {
      current_season: entry.current_season,
      current_episode: entry.current_episode
    });

    if (progress !== undefined) {
      database.run('UPDATE tracked_media SET progress = ? WHERE id = ?', [progress, entry.id]);
      entry.progress = progress;
    }
  }

  return entries;
}

async function updateTrackedMedia(database, trackedMediaId, body, allowedUpdates) {
  const existingEntry = selectTrackedMedia(database, 'id = ?', [trackedMediaId])[0];

  if (!existingEntry) {
    throw new AppError(404, 'NOT_FOUND', 'Tracked media entry not found.');
  }

  const updatedValues = {
    ...existingEntry,
    ...allowedUpdates,
    progress: await resolveProgress(existingEntry, allowedUpdates)
  };
  const progressWasUpdated =
    Object.prototype.hasOwnProperty.call(body, 'progress') ||
    (existingEntry.media_type === 'tv' && (
      Object.prototype.hasOwnProperty.call(body, 'current_season') ||
      Object.prototype.hasOwnProperty.call(body, 'current_episode')
    ));
  const changeParts = [];
  const parameters = [];

  for (const [bodyField, columnName] of PATCH_FIELDS) {
    const fieldWasSubmitted = Object.prototype.hasOwnProperty.call(body, bodyField);
    if (!fieldWasSubmitted && !(bodyField === 'progress' && progressWasUpdated)) {
      continue;
    }

    changeParts.push(`${columnName} = ?`);
    parameters.push(updatedValues[bodyField] ?? (bodyField === 'notes' ? '' : null));
  }

  if (changeParts.length === 0) {
    return existingEntry;
  }

  changeParts.push('last_watched_at = ?');
  parameters.push(new Date().toISOString());
  database.run(
    `UPDATE tracked_media SET ${changeParts.join(', ')} WHERE id = ?`,
    [...parameters, trackedMediaId]
  );

  return selectTrackedMedia(database, 'id = ?', [trackedMediaId])[0];
}

function deleteTrackedMedia(database, trackedMediaId) {
  const existingEntry = selectTrackedMedia(database, 'id = ?', [trackedMediaId])[0];

  if (!existingEntry) {
    throw new AppError(404, 'NOT_FOUND', 'Tracked media entry not found.');
  }

  database.run('DELETE FROM tracked_media WHERE id = ?', [trackedMediaId]);
  return existingEntry;
}

async function listTrackedMediaForUser(userId) {
  const entries = await withDatabase(
    (database) => listTrackedMedia(database, userId),
    true
  );

  return entries.map(addCompletionStatus);
}

async function getTrackedMediaEntry(trackedMediaId) {
  const entry = await withDatabase((database) =>
    selectTrackedMedia(database, 'id = ?', [trackedMediaId])[0]
  );

  if (!entry) {
    throw new AppError(404, 'NOT_FOUND', 'Tracked media entry not found.');
  }

  return addCompletionStatus(entry);
}

async function createTrackedMediaForUser(userId, tmdbId, mediaType) {
  const pathname = mediaType === 'movie' ? `/movie/${tmdbId}` : `/tv/${tmdbId}`;
  const tmdbDetails = await fetchTmdb(pathname, config.TMDB_DETAILS_CACHE_MS);
  const details = mediaType === 'movie'
    ? normalizeMovieDetails(tmdbDetails)
    : normalizeTvDetails(tmdbDetails);

  try {
    const entryId = await withDatabase(
      (database) => insertTrackedMedia(database, userId, details),
      true
    );
    const entry = await withDatabase((database) =>
      selectTrackedMedia(database, 'id = ?', [entryId])[0]
    );

    return addCompletionStatus(entry);
  } catch (error) {
    if (String(error.message).includes('UNIQUE constraint failed')) {
      throw new AppError(409, 'DUPLICATE_RESOURCE', 'Media is already tracked.');
    }
    throw error;
  }
}

async function updateTrackedMediaEntry(trackedMediaId, body, allowedUpdates) {
  const entry = await withDatabase(
    (database) => updateTrackedMedia(database, trackedMediaId, body, allowedUpdates),
    true
  );

  return addCompletionStatus(entry);
}

async function deleteTrackedMediaEntry(trackedMediaId) {
  return withDatabase(
    (database) => deleteTrackedMedia(database, trackedMediaId),
    true
  );
}

module.exports = {
  addCompletionStatus,
  createTrackedMediaForUser,
  deleteTrackedMedia,
  deleteTrackedMediaEntry,
  getTrackedMediaEntry,
  insertTrackedMedia,
  listTrackedMediaForUser,
  listTrackedMedia,
  selectTrackedMedia,
  updateTrackedMediaEntry,
  updateTrackedMedia
};