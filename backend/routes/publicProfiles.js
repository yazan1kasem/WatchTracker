const express = require('express');
const { getPublicProfile, searchPublicProfiles } = require('../services/publicProfileService');
const { AppError } = require('../middleware/errors');

const router = express.Router();

router.get('/search', async (request, response) => {
  const query = request.query.query?.trim().toLowerCase();

  if (!query) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Username search query is required.');
  }

  const profiles = await searchPublicProfiles(query);
  response.json({ data: { profiles } });
});

router.get('/:username/profile', async (request, response) => {
  const username = request.params.username.trim().toLowerCase();

  if (!username) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Username is required.');
  }

  const profile = await getPublicProfile(username);
  response.json({ data: profile });
});

module.exports = router;