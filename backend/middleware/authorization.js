const { ROLES } = require('../constants');
const { getTrackedMedia } = require('../services/tracked-media-service');
const { parseId } = require('../validation/numbers');
const { createForbiddenError } = require('./errors');

function requireRole(...allowedRoles) {
  return (request, _response, next) => {
    next(allowedRoles.includes(request.user.role) ? undefined : createForbiddenError());
  };
}

async function requireOwnership(request, _response, next) {
  const trackedMedia = await getTrackedMedia(parseId(request.params.id, 'Tracked media ID'));
  const isOwner = trackedMedia.user_id === request.user.id;

  if (!isOwner && request.user.role !== ROLES.ADMIN) {
    next(createForbiddenError());
    return;
  }

  request.trackedMedia = trackedMedia;
  next();
}

module.exports = { requireOwnership, requireRole };
