const { insert, queryAll, queryOne, buildColumnAssignments } = require('./connection');

const TRACKED_MEDIA_COLUMNS = [
  'id',
  'user_id',
  'tmdb_id',
  'media_type',
  'title',
  'poster_path',
  'release_date',
  'total_runtime',
  'total_seasons',
  'total_episodes',
  'current_season',
  'current_episode',
  'progress',
  'rating',
  'notes',
  'is_public',
  'last_watched_at'
];
const SELECT_COLUMNS = TRACKED_MEDIA_COLUMNS.join(', ');
const USERNAME_POSITION = 2;

function findTrackedMediaById(database, trackedMediaId) {
  return queryOne(
    database,
    `SELECT ${SELECT_COLUMNS} FROM tracked_media WHERE id = ?`,
    [trackedMediaId]
  );
}

function findTrackedMediaByUser(database, userId) {
  return queryAll(
    database,
    `SELECT ${SELECT_COLUMNS} FROM tracked_media WHERE user_id = ? ORDER BY id DESC`,
    [userId]
  );
}

function listTrackedMediaWithUsernames(database) {
  const columns = TRACKED_MEDIA_COLUMNS.map((column) => `tracked_media.${column}`);
  // The admin table shows the owner right after user_id, so the API keeps that field order.
  columns.splice(USERNAME_POSITION, 0, 'users.username');

  return queryAll(database, `
    SELECT ${columns.join(', ')}
    FROM tracked_media
    INNER JOIN users ON users.id = tracked_media.user_id
    ORDER BY tracked_media.id DESC
  `);
}

function insertTrackedMedia(database, userId, details) {
  return insert(
    database,
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
}

function updateTrackedMediaColumns(database, trackedMediaId, columns) {
  database.run(
    `UPDATE tracked_media SET ${buildColumnAssignments(columns)} WHERE id = ?`,
    [...Object.values(columns), trackedMediaId]
  );
}

function deleteTrackedMediaById(database, trackedMediaId) {
  database.run('DELETE FROM tracked_media WHERE id = ?', [trackedMediaId]);
}

module.exports = {
  deleteTrackedMediaById,
  findTrackedMediaById,
  findTrackedMediaByUser,
  insertTrackedMedia,
  listTrackedMediaWithUsernames,
  updateTrackedMediaColumns
};
