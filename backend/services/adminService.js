const config = require('../config');
const { withDatabase } = require('../db/connection');
const { AppError } = require('../middleware/errors');
const { hashPassword } = require('./passwordService');
const {
  addCompletionStatus,
  deleteTrackedMedia,
  insertTrackedMedia,
  selectTrackedMedia,
  updateTrackedMedia
} = require('./trackedMediaService');
const {
  fetchTmdb,
  normalizeMovieDetails,
  normalizeTvDetails
} = require('./tmdbHelper');

function selectUsers(database) {
  const statement = database.prepare(
    'SELECT id, username, role FROM users ORDER BY id ASC'
  );

  try {
    const users = [];

    while (statement.step()) {
      users.push(statement.getAsObject());
    }

    return users;
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

function findTrackedMedia(database, trackedMediaId) {
  return selectTrackedMedia(database, 'id = ?', [trackedMediaId])[0] ?? null;
}

function ensureUserExists(database, userId) {
  if (!findUserById(database, userId)) {
    throw new AppError(404, 'NOT_FOUND', 'User not found.');
  }
}

function selectAllTrackedMedia(database) {
  const statement = database.prepare(`
    SELECT tracked_media.id, tracked_media.user_id, users.username,
           tracked_media.tmdb_id, tracked_media.media_type, tracked_media.title,
           tracked_media.poster_path, tracked_media.release_date,
           tracked_media.total_runtime, tracked_media.total_seasons,
           tracked_media.total_episodes, tracked_media.current_season,
           tracked_media.current_episode, tracked_media.progress,
           tracked_media.rating, tracked_media.notes, tracked_media.is_public,
           tracked_media.last_watched_at
    FROM tracked_media
    INNER JOIN users ON users.id = tracked_media.user_id
    ORDER BY tracked_media.id DESC
  `);

  try {
    const entries = [];

    while (statement.step()) {
      entries.push(addCompletionStatus(statement.getAsObject()));
    }

    return entries;
  } finally {
    statement.free();
  }
}

function mapDuplicateUsername(error) {
  if (String(error.message).includes('UNIQUE constraint failed: users.username')) {
    throw new AppError(409, 'DUPLICATE_RESOURCE', 'Username is already in use.');
  }
  throw error;
}

async function listUsers() {
  return withDatabase((database) => selectUsers(database));
}

async function createUser(credentials, role) {
  const passwordHash = await hashPassword(credentials.password);

  try {
    return await withDatabase((database) => {
      database.run(
        'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
        [credentials.username, passwordHash, role]
      );
      const userId = database.exec('SELECT last_insert_rowid()')[0].values[0][0];
      return findUserById(database, userId);
    }, true);
  } catch (error) {
    mapDuplicateUsername(error);
  }
}

async function updateUser(userId, updates, actor) {
  const databaseUpdates = { ...updates };

  if (databaseUpdates.role !== undefined && userId === actor.id && databaseUpdates.role !== actor.role) {
    throw new AppError(403, 'FORBIDDEN', 'You cannot change your own role.');
  }

  if (databaseUpdates.password !== undefined) {
    databaseUpdates.password_hash = await hashPassword(databaseUpdates.password);
    delete databaseUpdates.password;
  }

  if (Object.keys(databaseUpdates).length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'At least one user field must be updated.');
  }

  try {
    return await withDatabase((database) => {
      ensureUserExists(database, userId);
      const fields = [];
      const values = [];

      for (const field of ['username', 'role', 'password_hash']) {
        if (databaseUpdates[field] !== undefined) {
          fields.push(`${field} = ?`);
          values.push(databaseUpdates[field]);
        }
      }

      database.run(
        `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
        [...values, userId]
      );
      return findUserById(database, userId);
    }, true);
  } catch (error) {
    mapDuplicateUsername(error);
  }
}

async function updateUserRole(userId, role, actor) {
  if (userId === actor.id && role !== actor.role) {
    throw new AppError(403, 'FORBIDDEN', 'You cannot change your own role.');
  }

  return withDatabase((database) => {
    if (!findUserById(database, userId)) {
      throw new AppError(404, 'NOT_FOUND', 'User not found.');
    }

    database.run('UPDATE users SET role = ? WHERE id = ?', [role, userId]);
    return findUserById(database, userId);
  }, true);
}

async function deleteUser(userId, actor) {
  if (userId === actor.id) {
    throw new AppError(403, 'FORBIDDEN', 'You cannot delete your own account.');
  }

  return withDatabase((database) => {
    const existingUser = findUserById(database, userId);

    if (!existingUser) {
      throw new AppError(404, 'NOT_FOUND', 'User not found.');
    }

    database.run('DELETE FROM users WHERE id = ?', [userId]);
    return existingUser;
  }, true);
}

async function listAllTrackedMedia() {
  return withDatabase((database) => selectAllTrackedMedia(database));
}

async function createTrackedMedia(userId, tmdbId, mediaType) {
  const pathname = mediaType === 'movie' ? `/movie/${tmdbId}` : `/tv/${tmdbId}`;
  const tmdbDetails = await fetchTmdb(pathname, config.TMDB_DETAILS_CACHE_MS);
  const details = mediaType === 'movie'
    ? normalizeMovieDetails(tmdbDetails)
    : normalizeTvDetails(tmdbDetails);

  try {
    return await withDatabase((database) => {
      ensureUserExists(database, userId);
      const entryId = insertTrackedMedia(database, userId, details);
      return addCompletionStatus(findTrackedMedia(database, entryId));
    }, true);
  } catch (error) {
    if (String(error.message).includes('UNIQUE constraint failed')) {
      throw new AppError(409, 'DUPLICATE_RESOURCE', 'Media is already tracked for this user.');
    }
    throw error;
  }
}

async function updateTrackedMediaEntry(trackedMediaId, body, updates) {
  try {
    const entry = await withDatabase(async (database) => {
      const existingEntry = findTrackedMedia(database, trackedMediaId);
      if (!existingEntry) {
        throw new AppError(404, 'NOT_FOUND', 'Tracked media entry not found.');
      }
      if (updates.user_id !== undefined) {
        ensureUserExists(database, updates.user_id);
      }

      return updateTrackedMedia(database, trackedMediaId, body, updates);
    }, true);

    return addCompletionStatus(entry);
  } catch (error) {
    if (String(error.message).includes('UNIQUE constraint failed')) {
      throw new AppError(409, 'DUPLICATE_RESOURCE', 'User already tracks this media.');
    }
    throw error;
  }
}

async function deleteTrackedMediaEntry(trackedMediaId) {
  return withDatabase(
    (database) => deleteTrackedMedia(database, trackedMediaId),
    true
  );
}

module.exports = {
  createTrackedMedia,
  createUser,
  deleteTrackedMediaEntry,
  deleteUser,
  listAllTrackedMedia,
  listUsers,
  updateTrackedMediaEntry,
  updateUser,
  updateUserRole
};