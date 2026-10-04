const POSTER_ENDPOINT = "/api/tmdb/images?path=";
const YEAR_LENGTH = 4;
const MAX_PERCENT = 100;
const STATUS_LABELS = {
  completed: "Abgeschlossen",
  active: "Läuft",
  planned: "Geplant",
};

export function getMediaTypeLabel(mediaType) {
  return mediaType === "tv" ? "Serie" : "Film";
}

export function getReleaseYear(releaseDate) {
  return releaseDate ? releaseDate.slice(0, YEAR_LENGTH) : null;
}

export function setPoster(image, posterPath, title) {
  if (!posterPath) {
    image.hidden = true;
    return;
  }
  image.src = `${POSTER_ENDPOINT}${encodeURIComponent(posterPath)}`;
  image.alt = `Poster: ${title}`;
}

export function getWatchStatus(entry) {
  if (entry.is_completed) return "completed";
  if (entry.progress > 0) return "active";
  return "planned";
}

export function formatProgress(entry) {
  if (entry.media_type === "movie") {
    if (!entry.progress) return "Noch nicht gesehen";
    return `${entry.progress} / ${entry.total_runtime || "?"} Min.`;
  }

  if (!entry.progress) return "Noch nicht begonnen";
  const episodes = `${entry.progress} / ${entry.total_episodes || "?"} Folgen`;

  // Public profiles do not include season and episode.
  if (!entry.current_season || !entry.current_episode) return episodes;

  return `${formatPosition("S", entry.current_season)} ${formatPosition("E", entry.current_episode)} · ${episodes}`;
}

export function fillMediaRow(row, entry) {
  const status = getWatchStatus(entry);
  const statusTag = row.querySelector("[data-status]");
  statusTag.textContent = STATUS_LABELS[status];
  statusTag.classList.toggle("status-complete", status === "completed");

  setPoster(row.querySelector("[data-poster]"), entry.poster_path, entry.title);
  row.querySelector("[data-title]").textContent = entry.title;
  row.querySelector("[data-type-year]").textContent = formatTypeAndYear(entry);
  row.querySelector("[data-progress]").textContent = formatProgress(entry);
  row.querySelector("[data-progress-bar]").style.width = `${calculateProgressPercent(entry)}%`;
  row.querySelector("[data-rating]").textContent = entry.rating ? `${entry.rating} / 10` : "–";
}

function formatTypeAndYear(entry) {
  const year = getReleaseYear(entry.release_date);
  const type = getMediaTypeLabel(entry.media_type);
  return year ? `${type} · ${year}` : type;
}

// Movies count minutes, series count episodes.
function calculateProgressPercent(entry) {
  const total = entry.media_type === "tv" ? entry.total_episodes : entry.total_runtime;
  if (!total) return 0;
  return Math.min(MAX_PERCENT, Math.round((entry.progress / total) * MAX_PERCENT));
}

function formatPosition(prefix, number) {
  return `${prefix}${String(number).padStart(2, "0")}`;
}
