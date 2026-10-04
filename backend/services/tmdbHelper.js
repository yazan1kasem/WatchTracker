const config = require('../config');
const { AppError } = require('../middleware/errors');

const cache = new Map();
const REQUEST_TIMEOUT_MS = 10000;
const PAGE_PATTERN = /^\d+$/;
const MEDIA_ID_PATTERN = /^\d+$/;

function getCachedValue(cacheKey) {
  const entry = cache.get(cacheKey);

  if (!entry || entry.expiresAt <= Date.now()) {
    cache.delete(cacheKey);
    return null;
  }

  return entry.value;
}

function setCachedValue(cacheKey, value, ttlMilliseconds) {
  cache.set(cacheKey, { expiresAt: Date.now() + ttlMilliseconds, value });
}

async function fetchTmdb(pathname, cacheDuration) {
  const baseUrl = config.TMDB_BASE_URL.replace(/\/$/, '');
  const relativePath = pathname.replace(/^\//, '');
  const url = new URL(`${baseUrl}/${relativePath}`);
  url.searchParams.set('api_key', config.TMDB_API_KEY);
  url.searchParams.set('language', config.TMDB_LANGUAGE);
  const cacheKey = url.toString();
  const cachedValue = getCachedValue(cacheKey);

  if (cachedValue) {
    return cachedValue;
  }

  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (_error) {
    throw new AppError(502, 'TMDB_UNAVAILABLE', 'TMDB is currently unavailable.');
  }

  if (response.status === 404) {
    throw new AppError(404, 'NOT_FOUND', 'TMDB resource not found.');
  }

  if (response.status === 429) {
    throw new AppError(429, 'TMDB_RATE_LIMITED', 'TMDB rate limit reached.');
  }

  if (!response.ok) {
    throw new AppError(502, 'TMDB_UNAVAILABLE', 'TMDB returned an error.');
  }

  let data;
  try {
    data = await response.json();
  } catch (_error) {
    throw new AppError(502, 'TMDB_UNAVAILABLE', 'TMDB returned invalid data.');
  }

  setCachedValue(cacheKey, data, cacheDuration);
  return data;
}

async function fetchTmdbImage(posterPath) {
  const imageBaseUrl = config.TMDB_IMAGE_BASE_URL.replace(/\/$/, '');
  let response;

  try {
    response = await fetch(`${imageBaseUrl}${posterPath}`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
  } catch (_error) {
    throw new AppError(502, 'TMDB_UNAVAILABLE', 'TMDB image service is currently unavailable.');
  }

  if (!response.ok) {
    throw new AppError(502, 'TMDB_UNAVAILABLE', 'TMDB image service returned an error.');
  }

  return {
    contentType: response.headers.get('content-type') || 'image/jpeg',
    body: Buffer.from(await response.arrayBuffer())
  };
}

function validatePage(value) {
  if (!PAGE_PATTERN.test(value) || Number(value) < 1 || Number(value) > 500) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Page must be between 1 and 500.');
  }

  return value;
}

function validateMediaId(value, fieldName = 'TMDB ID') {
  const numericValue = Number(value);

  if (
    !MEDIA_ID_PATTERN.test(value) ||
    !Number.isSafeInteger(numericValue) ||
    numericValue < 1
  ) {
    throw new AppError(400, 'VALIDATION_ERROR', `${fieldName} is invalid.`);
  }

  return numericValue;
}

function validatePosterPath(value) {
  if (
    typeof value !== 'string' ||
    !/^\/[A-Za-z0-9_./-]+$/.test(value) ||
    value.includes('..')
  ) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Poster path is invalid.');
  }

  return value;
}

function normalizeSearchResult(result, mediaType) {
  return {
    id: result.id,
    media_type: mediaType,
    title: result.title ?? result.name ?? null,
    release_date: result.release_date ?? result.first_air_date ?? null,
    overview: result.overview ?? '',
    poster_path: result.poster_path ?? null
  };
}

function normalizeMovieDetails(details) {
  return {
    tmdb_id: details.id,
    media_type: 'movie',
    title: details.title,
    release_date: details.release_date || null,
    overview: details.overview || '',
    poster_path: details.poster_path || null,
    total_runtime: details.runtime ?? null
  };
}

function normalizeTvDetails(details) {
  return {
    tmdb_id: details.id,
    media_type: 'tv',
    title: details.name,
    release_date: details.first_air_date || null,
    overview: details.overview || '',
    poster_path: details.poster_path || null,
    total_seasons: details.number_of_seasons ?? null,
    total_episodes: details.number_of_episodes ?? null
  };
}

function normalizeEpisode(episode) {
  return {
    episode_number: episode.episode_number,
    name: episode.name,
    air_date: episode.air_date || null,
    overview: episode.overview || '',
    runtime: episode.runtime ?? null,
    still_path: episode.still_path || null
  };
}

module.exports = {
  fetchTmdb,
  fetchTmdbImage,
  normalizeEpisode,
  normalizeMovieDetails,
  normalizeSearchResult,
  normalizeTvDetails,
  validateMediaId,
  validatePage,
  validatePosterPath
};