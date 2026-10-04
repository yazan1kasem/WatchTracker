const { queryAll, queryOne, readDatabase } = require('../db/connection');
const { createNotFoundError } = require('../middleware/errors');
const { isCompleted } = require('./progress');

const MAX_PROFILE_SEARCH_RESULTS = 50;
const LIKE_SPECIAL_CHARACTERS = /[\\%_]/g;
const PUBLIC_ENTRY_COLUMNS = `
  id, tmdb_id, media_type, title, poster_path, release_date,
  total_runtime, total_episodes, current_season, current_episode,
  progress, rating, notes, is_public
`;

async function searchPublicProfiles(query) {
  return readDatabase((database) => queryAll(database, `
    SELECT users.username, COUNT(tracked_media.id) AS public_title_count
    FROM users
    INNER JOIN tracked_media ON tracked_media.user_id = users.id
    WHERE users.username LIKE ? ESCAPE '\\' AND tracked_media.is_public = 1
    GROUP BY users.id
    ORDER BY users.username ASC
    LIMIT ?
  `, [`%${escapeLikePattern(query)}%`, MAX_PROFILE_SEARCH_RESULTS]));
}

async function getPublicProfile(username) {
  const profile = await readDatabase((database) => findPublicProfile(database, username));

  if (!profile) {
    throw createNotFoundError('Public profile not found.');
  }

  return profile;
}

function findPublicProfile(database, username) {
  const user = queryOne(database, 'SELECT id, username FROM users WHERE username = ?', [username]);

  if (!user) {
    return null;
  }

  const entries = queryAll(
    database,
    `SELECT ${PUBLIC_ENTRY_COLUMNS} FROM tracked_media WHERE user_id = ? AND is_public = 1 ORDER BY id DESC`,
    [user.id]
  );
  return { user, entries: entries.map((entry) => ({ ...entry, is_completed: isCompleted(entry) })) };
}

// "_" is allowed in usernames and must not act as a wildcard.
function escapeLikePattern(value) {
  return value.replace(LIKE_SPECIAL_CHARACTERS, '\\$&');
}

module.exports = { getPublicProfile, searchPublicProfiles };
