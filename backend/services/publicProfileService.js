const { withDatabase } = require('../db/connection');
const { AppError } = require('../middleware/errors');

async function searchPublicProfiles(query) {
  return withDatabase((database) => {
    const statement = database.prepare(`
      SELECT users.username, COUNT(tracked_media.id) AS public_title_count
      FROM users
      INNER JOIN tracked_media ON tracked_media.user_id = users.id
      WHERE users.username LIKE ? AND tracked_media.is_public = 1
      GROUP BY users.id
      ORDER BY users.username ASC
      LIMIT 50
    `);

    try {
      statement.bind([`%${query}%`]);
      const profiles = [];

      while (statement.step()) {
        profiles.push(statement.getAsObject());
      }

      return profiles;
    } finally {
      statement.free();
    }
  });
}

function findPublicProfile(database, username) {
  const userStatement = database.prepare(
    'SELECT id, username FROM users WHERE username = ?'
  );

  try {
    userStatement.bind([username]);

    if (!userStatement.step()) {
      return null;
    }

    const user = userStatement.getAsObject();
    const mediaStatement = database.prepare(`
      SELECT id, tmdb_id, media_type, title, poster_path, release_date,
             total_runtime, total_episodes, current_season, current_episode,
             progress, rating, is_public
      FROM tracked_media
      WHERE user_id = ? AND is_public = 1
      ORDER BY id DESC
    `);

    try {
      mediaStatement.bind([user.id]);
      const entries = [];

      while (mediaStatement.step()) {
        entries.push(mediaStatement.getAsObject());
      }

      return { user, entries };
    } finally {
      mediaStatement.free();
    }
  } finally {
    userStatement.free();
  }
}

async function getPublicProfile(username) {
  const profile = await withDatabase((database) => findPublicProfile(database, username));

  if (!profile) {
    throw new AppError(404, 'NOT_FOUND', 'Public profile not found.');
  }

  return profile;
}

module.exports = { getPublicProfile, searchPublicProfiles };