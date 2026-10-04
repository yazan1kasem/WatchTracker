const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/authorization');
const {
  createTrackedMedia,
  createUser,
  deleteTrackedMediaEntry,
  deleteUser,
  listAllTrackedMedia,
  listUsers,
  updateTrackedMediaEntry,
  updateUser,
  updateUserRole
} = require('../services/adminService');
const { validateMediaId } = require('../services/tmdbHelper');
const { normalizeUsername, validateCredentials } = require('../validation/credentials');
const {
  validatePassword,
  validateRole,
  validateUserId
} = require('../validation/adminValidation');
const {
  validateMediaType,
  validateTrackedMediaUpdates
} = require('../validation/trackedMediaValidation');

const router = express.Router();

router.use(requireAuth);
router.use(requireRole('admin'));

router.get('/users', async (_request, response) => {
  const users = await listUsers();
  response.json({ data: { users } });
});

router.post('/users', async (request, response) => {
  const credentials = validateCredentials(request.body);
  const password = validatePassword(credentials.password);
  const role = request.body.role === undefined ? 'user' : validateRole(request.body.role);
  const user = await createUser({ ...credentials, password }, role);
  response.status(201).json({ data: { user } });
});

router.patch('/users/:id', async (request, response) => {
  const userId = validateUserId(request.params.id);
  const body = request.body ?? {};
  const updates = {};

  if (Object.prototype.hasOwnProperty.call(body, 'username')) {
    updates.username = normalizeUsername(body.username);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'role')) {
    updates.role = validateRole(body.role);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'password')) {
    updates.password = validatePassword(body.password);
  }

  const user = await updateUser(userId, updates, request.user);
  response.json({ data: { user } });
});

router.patch('/users/:id/role', async (request, response) => {
  const userId = validateUserId(request.params.id);
  const role = validateRole(request.body?.role);
  const user = await updateUserRole(userId, role, request.user);
  response.json({ data: { user } });
});

router.delete('/users/:id', async (request, response) => {
  const userId = validateUserId(request.params.id);
  const user = await deleteUser(userId, request.user);
  response.json({ data: { user } });
});

router.get('/tracked-media', async (_request, response) => {
  const entries = await listAllTrackedMedia();
  response.json({ data: { entries } });
});

router.post('/tracked-media', async (request, response) => {
  const userId = validateUserId(request.body?.user_id);
  const tmdbId = validateMediaId(String(request.body?.tmdb_id ?? ''));
  const mediaType = validateMediaType(request.body?.media_type);
  const entry = await createTrackedMedia(userId, tmdbId, mediaType);
  response.status(201).json({ data: { entry } });
});

router.patch('/tracked-media/:id', async (request, response) => {
  const trackedMediaId = validateUserId(request.params.id);
  const body = request.body ?? {};
  const updates = validateTrackedMediaUpdates(body);

  if (Object.prototype.hasOwnProperty.call(body, 'user_id')) {
    updates.user_id = validateUserId(body.user_id);
  }

  const entry = await updateTrackedMediaEntry(trackedMediaId, body, updates);
  response.json({ data: { entry } });
});

router.delete('/tracked-media/:id', async (request, response) => {
  const trackedMediaId = validateUserId(request.params.id);
  const entry = await deleteTrackedMediaEntry(trackedMediaId);
  response.json({ data: { entry } });
});

module.exports = router;
