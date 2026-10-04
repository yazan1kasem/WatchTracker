const config = require('../config');
const { MEDIA_TYPES } = require('../constants');
const {
  AppError,
  HTTP_STATUS,
  createNotFoundError,
  createTmdbUnavailableError
} = require('../middleware/errors');

const REQUEST_TIMEOUT_MS = 10000;
const FIRST_SEASON = 1;
const DEFAULT_IMAGE_CONTENT_TYPE = 'image/jpeg';
const TRAILING_SLASH = /\/$/;
const LEADING_SLASH = /^\//;

const cache = new Map();

async function fetchTmdb(pathname, cacheDurationMs) {
  return readCache(buildTmdbUrl(pathname).toString()) ?? fetchTmdbFresh(pathname, cacheDurationMs);
}

// Skips the cached copy but stores the new answer for everyone else.
async function fetchTmdbFresh(pathname, cacheDurationMs) {
  const url = buildTmdbUrl(pathname);
  const data = await requestTmdbJson(url);
  writeCache(url.toString(), data, cacheDurationMs);
  return data;
}

function searchTmdb(mediaType, query, page) {
  const pathname = `/search/${mediaType}?query=${encodeURIComponent(query)}&page=${page}`;
  return fetchTmdb(pathname, config.TMDB_SEARCH_CACHE_MS);
}

async function fetchMediaDetails(mediaType, tmdbId) {
  if (mediaType === MEDIA_TYPES.MOVIE) {
    return normalizeMovieDetails(await fetchTmdb(`/movie/${tmdbId}`, config.TMDB_DETAILS_CACHE_MS));
  }

  return normalizeTvDetails(await fetchTmdb(`/tv/${tmdbId}`, config.TMDB_DETAILS_CACHE_MS));
}

async function fetchFreshTvDetails(tmdbId) {
  return normalizeTvDetails(await fetchTmdbFresh(`/tv/${tmdbId}`, config.TMDB_DETAILS_CACHE_MS));
}

async function fetchSeasonDetails(tmdbId, seasonNumber) {
  const season = await fetchTmdb(`/tv/${tmdbId}/season/${seasonNumber}`, config.TMDB_DETAILS_CACHE_MS);

  return {
    season_number: season.season_number,
    name: season.name,
    episodes: (season.episodes ?? []).map(normalizeEpisode)
  };
}

function fetchSeasonEpisodes(tmdbId, lastSeason) {
  return loadSeasonEpisodes(tmdbId, lastSeason, fetchTmdb);
}

function fetchFreshSeasonEpisodes(tmdbId, lastSeason) {
  return loadSeasonEpisodes(tmdbId, lastSeason, fetchTmdbFresh);
}

async function fetchTmdbImage(posterPath) {
  const imageBaseUrl = config.TMDB_IMAGE_BASE_URL.replace(TRAILING_SLASH, '');
  const response = await fetchWithTimeout(
    `${imageBaseUrl}${posterPath}`,
    'TMDB image service is currently unavailable.'
  );

  if (!response.ok) {
    throw createTmdbUnavailableError('TMDB image service returned an error.');
  }

  return {
    contentType: response.headers.get('content-type') || DEFAULT_IMAGE_CONTENT_TYPE,
    body: Buffer.from(await response.arrayBuffer())
  };
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
    media_type: MEDIA_TYPES.MOVIE,
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
    media_type: MEDIA_TYPES.TV,
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

function buildTmdbUrl(pathname) {
  const baseUrl = config.TMDB_BASE_URL.replace(TRAILING_SLASH, '');
  const url = new URL(`${baseUrl}/${pathname.replace(LEADING_SLASH, '')}`);
  url.searchParams.set('api_key', config.TMDB_API_KEY);
  url.searchParams.set('language', config.TMDB_LANGUAGE);
  return url;
}

async function requestTmdbJson(url) {
  const response = await fetchWithTimeout(url, 'TMDB is currently unavailable.');

  if (!response.ok) {
    throw createTmdbErrorForStatus(response.status);
  }

  try {
    return await response.json();
  } catch {
    throw createTmdbUnavailableError('TMDB returned invalid data.');
  }
}

async function fetchWithTimeout(url, unavailableMessage) {
  try {
    return await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch {
    throw createTmdbUnavailableError(unavailableMessage);
  }
}

function createTmdbErrorForStatus(status) {
  if (status === HTTP_STATUS.NOT_FOUND) {
    return createNotFoundError('TMDB resource not found.');
  }

  if (status === HTTP_STATUS.TOO_MANY_REQUESTS) {
    return new AppError(HTTP_STATUS.TOO_MANY_REQUESTS, 'TMDB_RATE_LIMITED', 'TMDB rate limit reached.');
  }

  return createTmdbUnavailableError('TMDB returned an error.');
}

async function loadSeasonEpisodes(tmdbId, lastSeason, fetchJson) {
  const seasonNumbers = Array.from({ length: lastSeason }, (_value, index) => FIRST_SEASON + index);

  return Promise.all(seasonNumbers.map(async (seasonNumber) => {
    const season = await fetchJson(`/tv/${tmdbId}/season/${seasonNumber}`, config.TMDB_DETAILS_CACHE_MS);
    const episodes = (season.episodes ?? []).map((episode) => ({ episode_number: episode.episode_number }));
    return { season_number: seasonNumber, episodes };
  }));
}

function readCache(cacheKey) {
  const entry = cache.get(cacheKey);

  if (entry && entry.expiresAt > Date.now()) {
    return entry.value;
  }

  cache.delete(cacheKey);
  return null;
}

// ponytail: full sweep on every write keeps memory bounded by the TTL; switch to an LRU if the cache grows large.
function writeCache(cacheKey, value, ttlMs) {
  const now = Date.now();

  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) {
      cache.delete(key);
    }
  }

  cache.set(cacheKey, { expiresAt: now + ttlMs, value });
}

module.exports = {
  fetchFreshSeasonEpisodes,
  fetchFreshTvDetails,
  fetchMediaDetails,
  fetchSeasonDetails,
  fetchSeasonEpisodes,
  fetchTmdbImage,
  normalizeSearchResult,
  searchTmdb
};
