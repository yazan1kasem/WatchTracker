const { MEDIA_TYPES } = require('../constants');
const { AppError } = require('../middleware/errors');
const { calculateSeriesProgress } = require('./progress');
const {
  fetchFreshSeasonEpisodes,
  fetchFreshTvDetails,
  fetchSeasonEpisodes
} = require('./tmdb-client');

const NO_CHANGES = Object.freeze({});

// Compares a series with TMDB's current data and returns only the columns that changed.
async function refreshSeriesEntry(entry) {
  if (entry.media_type !== MEDIA_TYPES.TV) {
    return NO_CHANGES;
  }

  const metadataChanges = await runWithFallback(entry, () => fetchMetadataChanges(entry), NO_CHANGES);
  const refreshedEntry = { ...entry, ...metadataChanges };

  if (refreshedEntry.progress !== 0 || !hasEpisodePosition(refreshedEntry)) {
    return metadataChanges;
  }

  // Repairs entries whose position is saved but whose progress was never calculated.
  const progress = await runWithFallback(
    entry,
    () => calculateProgressFromSeasons(refreshedEntry, fetchSeasonEpisodes),
    refreshedEntry.progress
  );
  return pickChangedColumns(entry, { ...metadataChanges, progress });
}

async function fetchMetadataChanges(entry) {
  const details = await fetchFreshTvDetails(entry.tmdb_id);
  const refreshed = {
    title: details.title || entry.title,
    poster_path: details.poster_path ?? entry.poster_path,
    release_date: details.release_date ?? entry.release_date,
    total_seasons: details.total_seasons ?? entry.total_seasons,
    total_episodes: details.total_episodes ?? entry.total_episodes
  };
  const hasChangedTotals =
    refreshed.total_seasons !== entry.total_seasons ||
    refreshed.total_episodes !== entry.total_episodes;

  if (hasChangedTotals && hasEpisodePosition(entry)) {
    refreshed.progress = await runWithFallback(
      entry,
      () => calculateProgressFromSeasons(entry, fetchFreshSeasonEpisodes),
      entry.progress
    );
  }

  return pickChangedColumns(entry, refreshed);
}

async function calculateProgressFromSeasons(entry, loadSeasons) {
  const seasons = await loadSeasons(entry.tmdb_id, entry.current_season);
  return calculateSeriesProgress(seasons, entry.current_season, entry.current_episode);
}

// The saved library stays usable when TMDB is unreachable or its data no longer matches the
// saved position. Anything that is not an expected AppError is a real bug and is rethrown.
async function runWithFallback(entry, task, fallback) {
  try {
    return await task();
  } catch (error) {
    if (!(error instanceof AppError)) {
      throw error;
    }

    console.warn(`Series refresh skipped for tracked media ${entry.id}: ${error.message}`);
    return fallback;
  }
}

function hasEpisodePosition(entry) {
  return Boolean(entry.current_season && entry.current_episode);
}

function pickChangedColumns(entry, candidate) {
  return Object.fromEntries(
    Object.entries(candidate).filter(([column, value]) => value !== entry[column])
  );
}

module.exports = { refreshSeriesEntry };
