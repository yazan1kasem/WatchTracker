const { isUniqueViolation, readDatabase, writeDatabase } = require('../db/connection');
const {
  deleteUserById,
  findUserById,
  insertUser,
  listUsers: selectUsers,
  updateUserColumns
} = require('../db/user-repository');
const {
  createConflictError,
  createForbiddenError,
  createNotFoundError,
  createValidationError
} = require('../middleware/errors');
const { hashPassword } = require('./password-service');

const USERNAME_TAKEN_MESSAGE = 'Username is already in use.';

function ensureUserExists(database, userId) {
  const user = findUserById(database, userId);

  if (!user) {
    throw createNotFoundError('User not found.');
  }

  return user;
}

async function listUsers() {
  return readDatabase(selectUsers);
}

async function createUser({ username, password }, role) {
  const passwordHash = await hashPassword(password);

  return writeUserChange((database) => {
    const userId = insertUser(database, { username, passwordHash, role });
    return findUserById(database, userId);
  });
}

async function updateUser(userId, updates, actor) {
  assertMayChangeRole(userId, updates.role, actor);
  const columns = await buildUserColumns(updates);

  if (Object.keys(columns).length === 0) {
    throw createValidationError('At least one user field must be updated.');
  }

  return writeUserChange((database) => {
    ensureUserExists(database, userId);
    updateUserColumns(database, userId, columns);
    return findUserById(database, userId);
  });
}

async function deleteUser(userId, actor) {
  if (userId === actor.id) {
    throw createForbiddenError('You cannot delete your own account.');
  }

  return writeDatabase((database) => {
    const user = ensureUserExists(database, userId);
    deleteUserById(database, userId);
    return user;
  });
}

// Admins must not lock themselves out by removing their own admin role.
function assertMayChangeRole(userId, role, actor) {
  if (role !== undefined && userId === actor.id && role !== actor.role) {
    throw createForbiddenError('You cannot change your own role.');
  }
}

async function buildUserColumns({ password, ...columns }) {
  if (password === undefined) {
    return columns;
  }

  return { ...columns, password_hash: await hashPassword(password) };
}

async function writeUserChange(change) {
  try {
    return await writeDatabase(change);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw createConflictError(USERNAME_TAKEN_MESSAGE);
    }
    throw error;
  }
}

module.exports = {
  createUser,
  deleteUser,
  ensureUserExists,
  listUsers,
  updateUser
};
