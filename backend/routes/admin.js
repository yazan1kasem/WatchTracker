const express = require('express');
const { ROLES } = require('../constants');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/authorization');
const { HTTP_STATUS } = require('../middleware/errors');
const {
  createTrackedMedia,
  deleteTrackedMedia,
  listAllTrackedMedia,
  updateTrackedMedia
} = require('../services/tracked-media-service');
const { createUser, deleteUser, listUsers, updateUser } = require('../services/user-service');
const { parseId } = require('../validation/numbers');
const {
  validateNewTrackedMedia,
  validateTrackedMediaUpdates
} = require('../validation/tracked-media-validation');
const {
  validateRegistration,
  validateRole,
  validateUserUpdates
} = require('../validation/user-validation');

const router = express.Router();

router.use(requireAuth, requireRole(ROLES.ADMIN));

router.get('/users', async (_request, response) => {
  const users = await listUsers();
  response.json({ data: { users } });
});

router.post('/users', async (request, response) => {
  const credentials = validateRegistration(request.body);
  const role = request.body.role === undefined ? ROLES.USER : validateRole(request.body.role);
  const user = await createUser(credentials, role);
  response.status(HTTP_STATUS.CREATED).json({ data: { user } });
});

router.patch('/users/:id', async (request, response) => {
  const userId = parseId(request.params.id, 'User ID');
  const updates = validateUserUpdates(request.body ?? {});
  const user = await updateUser(userId, updates, request.user);
  response.json({ data: { user } });
});

router.patch('/users/:id/role', async (request, response) => {
  const userId = parseId(request.params.id, 'User ID');
  const role = validateRole(request.body?.role);
  const user = await updateUser(userId, { role }, request.user);
  response.json({ data: { user } });
});

router.delete('/users/:id', async (request, response) => {
  const user = await deleteUser(parseId(request.params.id, 'User ID'), request.user);
  response.json({ data: { user } });
});

router.get('/tracked-media', async (_request, response) => {
  const entries = await listAllTrackedMedia();
  response.json({ data: { entries } });
});

router.post('/tracked-media', async (request, response) => {
  const userId = parseId(request.body?.user_id, 'User ID');
  const { tmdbId, mediaType } = validateNewTrackedMedia(request.body);
  const entry = await createTrackedMedia(userId, tmdbId, mediaType);
  response.status(HTTP_STATUS.CREATED).json({ data: { entry } });
});

router.patch('/tracked-media/:id', async (request, response) => {
  const trackedMediaId = parseId(request.params.id, 'Tracked media ID');
  const body = request.body ?? {};
  const updates = validateTrackedMediaUpdates(body);

  if (Object.hasOwn(body, 'user_id')) {
    updates.user_id = parseId(body.user_id, 'User ID');
  }

  const entry = await updateTrackedMedia(trackedMediaId, updates);
  response.json({ data: { entry } });
});

router.delete('/tracked-media/:id', async (request, response) => {
  const entry = await deleteTrackedMedia(parseId(request.params.id, 'Tracked media ID'));
  response.json({ data: { entry } });
});

module.exports = router;
