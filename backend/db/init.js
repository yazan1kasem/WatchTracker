const fs = require('node:fs');
const path = require('node:path');
const config = require('../config');
const { ROLES } = require('../constants');
const { hashPassword } = require('../services/password-service');
const { validatePassword, validateUsername } = require('../validation/user-validation');
const { openDatabase, saveDatabase } = require('./connection');
const { findUserWithPasswordHash, insertUser, updateUserColumns } = require('./user-repository');

const SCHEMA_FILE = path.resolve(__dirname, 'schema.sql');

async function initializeDatabase() {
  const database = await openDatabase();

  try {
    database.run(fs.readFileSync(SCHEMA_FILE, 'utf8'));
    await ensureAdminBootstrap(database);
    saveDatabase(database);
    console.log('Database schema initialized.');
  } finally {
    database.close();
  }
}

// Creates or promotes the admin from .env, using the same rules as every other account.
async function ensureAdminBootstrap(database) {
  if (!config.ADMIN_USERNAME || !config.ADMIN_PASSWORD) {
    return;
  }

  const { username, password } = readBootstrapCredentials();
  const existingUser = findUserWithPasswordHash(database, username);

  if (!existingUser) {
    insertUser(database, { username, passwordHash: await hashPassword(password), role: ROLES.ADMIN });
    console.log(`Admin bootstrap created: ${username}`);
    return;
  }

  if (existingUser.role !== ROLES.ADMIN) {
    updateUserColumns(database, existingUser.id, { role: ROLES.ADMIN });
    console.log(`Admin bootstrap promoted: ${username}`);
  }
}

function readBootstrapCredentials() {
  try {
    return {
      username: validateUsername(config.ADMIN_USERNAME),
      password: validatePassword(config.ADMIN_PASSWORD)
    };
  } catch (error) {
    throw new Error(`ADMIN_USERNAME/ADMIN_PASSWORD in .env are invalid: ${error.message}`);
  }
}

initializeDatabase().catch((error) => {
  console.error('Database initialization failed:', error);
  process.exitCode = 1;
});
