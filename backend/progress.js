const { AppError } = require('./middleware/errors');

const MOVIE_TYPE = 'movie';
const TV_TYPE = 'tv';

function requireNonNegativeInteger(value, fieldName) {
  if (!Number.isInteger(value) || value < 0) {
    throw new AppError(400, 'VALIDATION_ERROR', `${fieldName} must be a non-negative integer.`);
  }
}

function requirePositiveInteger(value, fieldName) {
  if (!Number.isInteger(value) || value < 1) {
    throw new AppError(400, 'VALIDATION_ERROR', `${fieldName} must be a positive integer.`);
  }
}

function validateMovieProgress(progress, totalRuntime) {
  requireNonNegativeInteger(progress, 'Progress');
  requirePositiveInteger(totalRuntime, 'Total runtime');

  if (progress > totalRuntime) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Progress cannot exceed total runtime.');
  }

  return progress;
}

function findSeason(seasons, seasonNumber) {
  return seasons.find((season) => season.season_number === seasonNumber);
}

function calculateSeriesProgress(seasons, currentSeason, currentEpisode) {
  if (!Array.isArray(seasons)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Season data is required.');
  }

  requirePositiveInteger(currentSeason, 'Current season');
  requirePositiveInteger(currentEpisode, 'Current episode');

  const selectedSeason = findSeason(seasons, currentSeason);
  if (!selectedSeason || !Array.isArray(selectedSeason.episodes)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Current season does not exist.');
  }

  const selectedEpisode = selectedSeason.episodes.find(
    (episode) => episode.episode_number === currentEpisode
  );
  if (!selectedEpisode) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Current episode does not exist.');
  }

  let progress = 0;

  for (const season of seasons) {
    if (season.season_number > currentSeason || !Array.isArray(season.episodes)) {
      continue;
    }

    if (season.season_number < currentSeason) {
      progress += season.episodes.length;
      continue;
    }

    for (const episode of season.episodes) {
      if (episode.episode_number <= currentEpisode) {
        progress += 1;
      }
    }
  }

  return progress;
}

function calculateProgress(mediaType, values) {
  if (mediaType === MOVIE_TYPE) {
    return validateMovieProgress(values.progress, values.totalRuntime);
  }

  if (mediaType === TV_TYPE) {
    return calculateSeriesProgress(
      values.seasons,
      values.currentSeason,
      values.currentEpisode
    );
  }

  throw new AppError(400, 'VALIDATION_ERROR', 'Media type must be movie or tv.');
}

function calculateCompletion(mediaType, progress, totalRuntime, totalEpisodes) {
  requireNonNegativeInteger(progress, 'Progress');
  const total = mediaType === MOVIE_TYPE ? totalRuntime : totalEpisodes;

  if (!Number.isInteger(total) || total < 1) {
    return false;
  }

  return progress >= total;
}

module.exports = {
  calculateCompletion,
  calculateProgress,
  calculateSeriesProgress,
  validateMovieProgress
};
