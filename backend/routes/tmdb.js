const express = require('express');
const { MEDIA_TYPES } = require('../constants');
const { requireAuth } = require('../middleware/auth');
const {
  fetchMediaDetails,
  fetchSeasonDetails,
  fetchTmdbImage,
  normalizeSearchResult,
  searchTmdb
} = require('../services/tmdb-client');
const { parseId } = require('../validation/numbers');
const {
  validatePage,
  validatePosterPath,
  validateSearchQuery
} = require('../validation/tmdb-validation');
const { validateMediaType } = require('../validation/tracked-media-validation');

const DEFAULT_PAGE = 1;
// Poster paths never change their content, so browsers may keep them for a day.
const POSTER_CACHE_CONTROL = 'public, max-age=86400';

const router = express.Router();

// Public on purpose: guest profiles show posters too.
router.get('/images', async (request, response) => {
  const image = await fetchTmdbImage(validatePosterPath(request.query.path));
  response.setHeader('Content-Type', image.contentType);
  response.setHeader('Cache-Control', POSTER_CACHE_CONTROL);
  response.send(image.body);
});

router.use(requireAuth);

router.get('/search', async (request, response) => {
  const mediaType = validateMediaType(request.query.type);
  const query = validateSearchQuery(request.query.query);
  const page = validatePage(request.query.page ?? DEFAULT_PAGE);
  const data = await searchTmdb(mediaType, query, page);

  response.json({
    data: {
      page: data.page,
      total_pages: data.total_pages,
      total_results: data.total_results,
      results: data.results.map((result) => normalizeSearchResult(result, mediaType))
    }
  });
});

router.get('/movies/:tmdbId', async (request, response) => {
  const details = await fetchMediaDetails(MEDIA_TYPES.MOVIE, parseId(request.params.tmdbId, 'TMDB ID'));
  response.json({ data: details });
});

router.get('/tv-shows/:tmdbId', async (request, response) => {
  const details = await fetchMediaDetails(MEDIA_TYPES.TV, parseId(request.params.tmdbId, 'TMDB ID'));
  response.json({ data: details });
});

router.get('/tv-shows/:tmdbId/seasons/:seasonNumber', async (request, response) => {
  const tmdbId = parseId(request.params.tmdbId, 'TMDB ID');
  const seasonNumber = parseId(request.params.seasonNumber, 'Season number');
  const season = await fetchSeasonDetails(tmdbId, seasonNumber);
  response.json({ data: season });
});

module.exports = router;
