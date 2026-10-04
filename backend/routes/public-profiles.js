const express = require('express');
const { createValidationError } = require('../middleware/errors');
const { getPublicProfile, searchPublicProfiles } = require('../services/public-profile-service');

const router = express.Router();

router.get('/search', async (request, response) => {
  const query = request.query.query?.trim().toLowerCase();

  if (!query) {
    throw createValidationError('Username search query is required.');
  }

  const profiles = await searchPublicProfiles(query);
  response.json({ data: { profiles } });
});

router.get('/:username/profile', async (request, response) => {
  const username = request.params.username.trim().toLowerCase();

  if (!username) {
    throw createValidationError('Username is required.');
  }

  const profile = await getPublicProfile(username);
  response.json({ data: profile });
});

module.exports = router;
