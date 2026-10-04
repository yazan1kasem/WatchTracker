const fs = require('node:fs');
const path = require('node:path');
const config = require('../config');
const { hashPassword } = require('../services/passwordService');
const { openDatabase, saveDatabase } = require('./connection');

async function ensureAdminBootstrap(database) {
  if (!config.ADMIN_USERNAME || !config.ADMIN_PASSWORD) {
    return;
  }

  const username = config.ADMIN_USERNAME.trim().toLowerCase();
  if (!username) {
    return;
  }

  const existingUser = database.prepare(
    'SELECT id, username, role FROM users WHERE username = ?'
  );

  try {
    existingUser.bind([username]);

    if (existingUser.step()) {
      const user = existingUser.getAsObject();

      if (user.role !== 'admin') {
        database.run('UPDATE users SET role = ? WHERE username = ?', ['admin', username]);
        console.log(`Admin bootstrap promoted: ${username}`);
      }

      return;
    }
  } finally {
    existingUser.free();
  }

  const passwordHash = await hashPassword(config.ADMIN_PASSWORD);
  database.run(
    'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
    [username, passwordHash, 'admin']
  );
  console.log(`Admin bootstrap created: ${username}`);
}

async function initializeDatabase() {
  const database = await openDatabase();

  try {
    database.run(fs.readFileSync(path.resolve(__dirname, 'schema.sql'), 'utf8'));
    await ensureAdminBootstrap(database);
    saveDatabase(database);
    console.log('Database schema initialized.');
  } finally {
    database.close();
  }
}

initializeDatabase().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
