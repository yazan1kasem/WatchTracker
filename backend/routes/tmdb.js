const express = require('express');
const config = require('../config');
const { requireAuth } = require('../middleware/auth');
const { AppError } = require('../middleware/errors');
const {
  fetchTmdb,
  fetchTmdbImage,
  normalizeEpisode,
  normalizeMovieDetails,
  normalizeSearchResult,
  normalizeTvDetails,
  validateMediaId,
  validatePage,
  validatePosterPath
} = require('../services/tmdbHelper');
const { validateMediaType } = require('../validation/trackedMediaValidation');

const router = express.Router();

router.get('/image', async (request, response) => {
  const posterPath = validatePosterPath(request.query.path);
  const image = await fetchTmdbImage(posterPath);
  response.setHeader('Content-Type', image.contentType);
  response.send(image.body);
});

router.use(requireAuth);

router.get('/search', async (request, response) => {
  const query = request.query.query?.trim();
  const mediaType = validateMediaType(request.query.type);
  const page = request.query.page ?? '1';

  if (!query) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Search query is required.');
  }

  validatePage(page);

  const data = await fetchTmdb(`/search/${mediaType}?query=${encodeURIComponent(query)}&page=${page}`, config.TMDB_SEARCH_CACHE_MS);
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
  const tmdbId = validateMediaId(request.params.tmdbId);
  const details = await fetchTmdb(`/movie/${tmdbId}`, config.TMDB_DETAILS_CACHE_MS);
  response.json({ data: normalizeMovieDetails(details) });
});

router.get('/tv/:tmdbId', async (request, response) => {
  const tmdbId = validateMediaId(request.params.tmdbId);
  const details = await fetchTmdb(`/tv/${tmdbId}`, config.TMDB_DETAILS_CACHE_MS);
  response.json({ data: normalizeTvDetails(details) });
});

router.get('/tv/:tmdbId/seasons/:seasonNumber', async (request, response) => {
  const tmdbId = validateMediaId(request.params.tmdbId);
  const seasonNumber = validateMediaId(request.params.seasonNumber, 'Season number');
  const season = await fetchTmdb(
    `/tv/${tmdbId}/season/${seasonNumber}`,
    config.TMDB_DETAILS_CACHE_MS
  );
  response.json({
    data: {
      season_number: season.season_number,
      name: season.name,
      episodes: (season.episodes ?? []).map(normalizeEpisode)
    }
  });
});

module.exports = router;
