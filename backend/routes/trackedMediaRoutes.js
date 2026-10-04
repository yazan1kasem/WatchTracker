const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireOwnership } = require('../middleware/authorization');
const {
  addCompletionStatus,
  createTrackedMediaForUser,
  deleteTrackedMediaEntry,
  getTrackedMediaEntry,
  listTrackedMediaForUser,
  updateTrackedMediaEntry
} = require('../services/trackedMediaService');
const { validateMediaId } = require('../services/tmdbHelper');
const {
  validateMediaType,
  validateTrackedMediaUpdates
} = require('../validation/trackedMediaValidation');

const router = express.Router();

router.use(requireAuth);

router.get('/', async (request, response) => {
  const entries = await listTrackedMediaForUser(request.user.id);
  response.json({ data: { entries } });
});

router.post('/', async (request, response) => {
  const body = request.body;
  const tmdbId = validateMediaId(String(body?.tmdb_id ?? ''));
  const mediaType = validateMediaType(body?.media_type);
  const entry = await createTrackedMediaForUser(request.user.id, tmdbId, mediaType);
  response.status(201).json({ data: { entry } });
});

router.get('/:id', requireOwnership, async (request, response) => {
  const entry = await getTrackedMediaEntry(Number(request.params.id));
  response.json({ data: { entry } });
});

router.patch('/:id', requireOwnership, async (request, response) => {
  const trackedMediaId = Number(request.params.id);
  const body = request.body ?? {};
  const allowedUpdates = validateTrackedMediaUpdates(body);

  const hasUpdates = Object.values(allowedUpdates).some((value) => value !== undefined);
  if (!hasUpdates) {
    response.json({
      data: {
        entry: addCompletionStatus(request.trackedMedia)
      }
    });
    return;
  }

  const entry = await updateTrackedMediaEntry(trackedMediaId, body, allowedUpdates);
  response.json({ data: { entry } });
});

router.delete('/:id', requireOwnership, async (request, response) => {
  const trackedMediaId = Number(request.params.id);
  const entry = await deleteTrackedMediaEntry(trackedMediaId);

  response.json({ data: { entry } });
});

module.exports = router;