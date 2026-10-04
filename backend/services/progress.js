const { MEDIA_TYPES } = require('../constants');
const { createValidationError } = require('../middleware/errors');
const { requireNonNegativeInteger, requirePositiveInteger } = require('../validation/numbers');

function validateMovieProgress(progress, totalRuntime) {
  requireNonNegativeInteger(progress, 'Progress');
  requirePositiveInteger(totalRuntime, 'Total runtime');

  if (progress > totalRuntime) {
    throw createValidationError('Progress cannot exceed total runtime.');
  }

  return progress;
}

// Series progress counts every episode up to and including the current one.
function calculateSeriesProgress(seasons, currentSeason, currentEpisode) {
  if (!Array.isArray(seasons)) {
    throw createValidationError('Season data is required.');
  }

  requirePositiveInteger(currentSeason, 'Current season');
  requirePositiveInteger(currentEpisode, 'Current episode');
  assertEpisodeExists(seasons, currentSeason, currentEpisode);

  return countWatchedEpisodes(seasons, currentSeason, currentEpisode);
}

function isCompleted(entry) {
  requireNonNegativeInteger(entry.progress, 'Progress');
  const total = entry.media_type === MEDIA_TYPES.MOVIE ? entry.total_runtime : entry.total_episodes;

  return Number.isInteger(total) && total >= 1 && entry.progress >= total;
}

function assertEpisodeExists(seasons, seasonNumber, episodeNumber) {
  const season = seasons.find((candidate) => candidate.season_number === seasonNumber);

  if (!season || !Array.isArray(season.episodes)) {
    throw createValidationError('Current season does not exist.');
  }

  if (!season.episodes.some((episode) => episode.episode_number === episodeNumber)) {
    throw createValidationError('Current episode does not exist.');
  }
}

function countWatchedEpisodes(seasons, currentSeason, currentEpisode) {
  let watchedEpisodes = 0;

  for (const season of seasons) {
    if (season.season_number > currentSeason || !Array.isArray(season.episodes)) {
      continue;
    }

    const watchedInSeason = season.season_number < currentSeason
      ? season.episodes
      : season.episodes.filter((episode) => episode.episode_number <= currentEpisode);
    watchedEpisodes += watchedInSeason.length;
  }

  return watchedEpisodes;
}

module.exports = { calculateSeriesProgress, isCompleted, validateMovieProgress };
