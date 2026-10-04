const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireOwnership } = require('../middleware/authorization');
const { HTTP_STATUS } = require('../middleware/errors');
const {
  createTrackedMedia,
  deleteTrackedMedia,
  listTrackedMedia,
  updateTrackedMedia
} = require('../services/tracked-media-service');
const {
  validateNewTrackedMedia,
  validateTrackedMediaUpdates
} = require('../validation/tracked-media-validation');

const router = express.Router();

router.use(requireAuth);

router.get('/', async (request, response) => {
  const entries = await listTrackedMedia(request.user.id);
  response.json({ data: { entries } });
});

router.post('/', async (request, response) => {
  const { tmdbId, mediaType } = validateNewTrackedMedia(request.body);
  const entry = await createTrackedMedia(request.user.id, tmdbId, mediaType);
  response.status(HTTP_STATUS.CREATED).json({ data: { entry } });
});

router.get('/:id', requireOwnership, (request, response) => {
  response.json({ data: { entry: request.trackedMedia } });
});

router.patch('/:id', requireOwnership, async (request, response) => {
  const updates = validateTrackedMediaUpdates(request.body ?? {});
  const entry = await updateTrackedMedia(request.trackedMedia.id, updates);
  response.json({ data: { entry } });
});

router.delete('/:id', requireOwnership, async (request, response) => {
  const entry = await deleteTrackedMedia(request.trackedMedia.id);
  response.json({ data: { entry } });
});

module.exports = router;
