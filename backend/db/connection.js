const fs = require('node:fs');
const path = require('node:path');
const initSqlJs = require('sql.js');
const config = require('../config');

fs.mkdirSync(path.dirname(config.DB_FILE), { recursive: true });

async function openDatabase() {
	const SQL = await initSqlJs({
		locateFile: (fileName) => require.resolve(`sql.js/dist/${fileName}`)
	});
	const databaseFile = fs.existsSync(config.DB_FILE)
		? fs.readFileSync(config.DB_FILE)
		: undefined;
	const database = databaseFile ? new SQL.Database(databaseFile) : new SQL.Database();

	database.run('PRAGMA foreign_keys = ON');
	return database;
}

function saveDatabase(database) {
	fs.writeFileSync(config.DB_FILE, Buffer.from(database.export()));
}

async function withDatabase(callback, saveChanges = false) {
	const database = await openDatabase();

	try {
		const result = await callback(database);
		if (saveChanges) {
			saveDatabase(database);
		}
		return result;
	} finally {
		database.close();
	}
}

module.exports = { openDatabase, saveDatabase, withDatabase };
