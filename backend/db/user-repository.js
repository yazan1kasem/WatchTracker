const { insert, queryAll, queryOne, buildColumnAssignments } = require('./connection');

const PUBLIC_USER_COLUMNS = 'id, username, role';

function findUserById(database, userId) {
  return queryOne(database, `SELECT ${PUBLIC_USER_COLUMNS} FROM users WHERE id = ?`, [userId]);
}

function findUserWithPasswordHash(database, username) {
  return queryOne(
    database,
    'SELECT id, username, password_hash, role FROM users WHERE username = ?',
    [username]
  );
}

function listUsers(database) {
  return queryAll(database, `SELECT ${PUBLIC_USER_COLUMNS} FROM users ORDER BY id ASC`);
}

function insertUser(database, { username, passwordHash, role }) {
  return insert(
    database,
    'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
    [username, passwordHash, role]
  );
}

function updateUserColumns(database, userId, columns) {
  database.run(
    `UPDATE users SET ${buildColumnAssignments(columns)} WHERE id = ?`,
    [...Object.values(columns), userId]
  );
}

function deleteUserById(database, userId) {
  database.run('DELETE FROM users WHERE id = ?', [userId]);
}

module.exports = {
  deleteUserById,
  findUserById,
  findUserWithPasswordHash,
  insertUser,
  listUsers,
  updateUserColumns
};
