const { withDatabase } = require('../db/connection');
const { AppError } = require('./errors');

const USER_ROLE = 'user';
const ADMIN_ROLE = 'admin';
const TRACKED_MEDIA_ID_PATTERN = /^\d+$/;

function findUserRole(database, userId) {
  const statement = database.prepare('SELECT role FROM users WHERE id = ?');

  try {
    statement.bind([userId]);
    return statement.step() ? statement.getAsObject().role : null;
  } finally {
    statement.free();
  }
}

function findTrackedMedia(database, trackedMediaId) {
  const statement = database.prepare(
    'SELECT id, user_id, tmdb_id, media_type, title FROM tracked_media WHERE id = ?'
  );

  try {
    statement.bind([trackedMediaId]);
    return statement.step() ? statement.getAsObject() : null;
  } finally {
    statement.free();
  }
}

function requireRole(...allowedRoles) {
  return async (request, _response, next) => {
    const role = await withDatabase((database) => findUserRole(database, request.user.id));

    if (!role || !allowedRoles.includes(role)) {
      next(new AppError(403, 'FORBIDDEN', 'You do not have permission for this action.'));
      return;
    }

    request.user.role = role;
    next();
  };
}

async function requireOwnership(request, _response, next) {
  if (!TRACKED_MEDIA_ID_PATTERN.test(request.params.id)) {
    next(new AppError(400, 'VALIDATION_ERROR', 'Tracked media ID is invalid.'));
    return;
  }

  const authorizationData = await withDatabase((database) => ({
    role: findUserRole(database, request.user.id),
    trackedMedia: findTrackedMedia(database, Number(request.params.id))
  }));
  const { role, trackedMedia } = authorizationData;

  if (!role) {
    next(new AppError(401, 'UNAUTHENTICATED', 'Authentication required.'));
    return;
  }

  if (!trackedMedia) {
    next(new AppError(404, 'NOT_FOUND', 'Tracked media entry not found.'));
    return;
  }

  request.user.role = role;

  if (role !== ADMIN_ROLE && trackedMedia.user_id !== request.user.id) {
    next(new AppError(403, 'FORBIDDEN', 'You do not have permission for this action.'));
    return;
  }

  request.trackedMedia = trackedMedia;
  next();
}

module.exports = {
  ADMIN_ROLE,
  USER_ROLE,
  requireOwnership,
  requireRole
};
