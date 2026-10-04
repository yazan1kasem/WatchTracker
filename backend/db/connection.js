const fs = require('node:fs');
const path = require('node:path');
const initSqlJs = require('sql.js');
const config = require('../config');

const UNIQUE_VIOLATION_MESSAGE = 'UNIQUE constraint failed';

let databasePromise;

async function openDatabase() {
  const SQL = await initSqlJs({
    locateFile: (fileName) => require.resolve(`sql.js/dist/${fileName}`)
  });
  const database = fs.existsSync(config.DB_FILE)
    ? new SQL.Database(fs.readFileSync(config.DB_FILE))
    : new SQL.Database();

  database.run('PRAGMA foreign_keys = ON');
  return database;
}

function saveDatabase(database) {
  fs.mkdirSync(path.dirname(config.DB_FILE), { recursive: true });
  fs.writeFileSync(config.DB_FILE, Buffer.from(database.export()));
}

// The server shares one in-memory database. Before, every request worked on its own copy of the
// file and the last writer silently overwrote everyone else's changes.
function getDatabase() {
  databasePromise ??= openDatabase();
  return databasePromise;
}

async function readDatabase(callback) {
  return callback(await getDatabase());
}

// The callback must be synchronous: JavaScript cannot interleave other requests inside it,
// which makes the transaction atomic. Load TMDB data before calling this function.
async function writeDatabase(callback) {
  const database = await getDatabase();
  let result;
  database.run('BEGIN');

  try {
    result = callback(database);
    if (typeof result?.then === 'function') {
      throw new Error('writeDatabase callbacks must be synchronous.');
    }
    database.run('COMMIT');
  } catch (error) {
    database.run('ROLLBACK');
    throw error;
  }

  saveDatabase(database);
  return result;
}

function queryAll(database, sql, parameters = []) {
  const statement = database.prepare(sql);

  try {
    statement.bind(parameters);
    const rows = [];

    while (statement.step()) {
      rows.push(statement.getAsObject());
    }

    return rows;
  } finally {
    statement.free();
  }
}

function queryOne(database, sql, parameters) {
  return queryAll(database, sql, parameters)[0] ?? null;
}

function insert(database, sql, parameters) {
  database.run(sql, parameters);
  return database.exec('SELECT last_insert_rowid()')[0].values[0][0];
}

function buildColumnAssignments(columns) {
  return Object.keys(columns).map((column) => `${column} = ?`).join(', ');
}

function isUniqueViolation(error) {
  return String(error?.message).includes(UNIQUE_VIOLATION_MESSAGE);
}

module.exports = {
  insert,
  isUniqueViolation,
  openDatabase,
  queryAll,
  queryOne,
  readDatabase,
  saveDatabase,
  buildColumnAssignments,
  writeDatabase
};
