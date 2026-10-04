import { callApi } from "./api-client.js";
import { cloneTemplate, showError, showMessage } from "./dom.js";
import { getMediaTypeLabel, getReleaseYear, setPoster } from "./media-presentation.js";

const ALL_MEDIA_TYPES = ["movie", "tv"];
const IN_LIST_LABEL = "In deiner Liste";
const MESSAGE = "#title-search-message";

let trackedEntries = [];

// Search is enabled only after the library is known, so tracked titles are marked correctly.
export async function initAddMedia() {
  try {
    trackedEntries = (await callApi("/tracked-media")).entries;
  } catch (error) {
    showError(MESSAGE, error.message);
  }

  document.querySelector("#title-search-form").addEventListener("submit", search);
}

async function search(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const results = document.querySelector("#title-results");
  const query = form.elements.query.value.trim();
  results.replaceChildren();
  showMessage(MESSAGE, "Suche in TMDB ...");

  try {
    const titles = await searchTitles(query, form.elements.type.value);
    results.replaceChildren(...titles.map(createRow));
    const summary = titles.length > 0
      ? `${titles.length} Treffer für „${query}“`
      : `Keine Filme oder Serien für „${query}“ gefunden.`;
    showMessage(MESSAGE, summary);
  } catch (error) {
    showError(MESSAGE, error.message);
  }
}

async function searchTitles(query, type) {
  const types = type === "all" ? ALL_MEDIA_TYPES : [type];
  const responses = await Promise.all(
    types.map((searchType) => callApi(`/tmdb/search?query=${encodeURIComponent(query)}&type=${searchType}`)),
  );
  return responses.flatMap((data) => data.results);
}

function createRow(title) {
  const row = cloneTemplate("#title-result-template");
  const button = row.querySelector("[data-add]");
  const year = getReleaseYear(title.release_date) ?? "Jahr unbekannt";

  setPoster(row.querySelector("[data-poster]"), title.poster_path, title.title);
  row.querySelector("[data-title]").textContent = title.title;
  row.querySelector("[data-type-year]").textContent = `${getMediaTypeLabel(title.media_type)} · ${year}`;
  row.querySelector("[data-overview]").textContent = title.overview || "Keine Beschreibung verfügbar.";

  if (isTracked(title)) {
    button.textContent = IN_LIST_LABEL;
    button.disabled = true;
  }
  button.addEventListener("click", () => add(title, button));

  return row;
}

function isTracked(title) {
  return trackedEntries.some((entry) => entry.tmdb_id === title.id && entry.media_type === title.media_type);
}

async function add(title, button) {
  button.disabled = true; // prevents double clicks while the request runs

  try {
    const data = await callApi("/tracked-media", "POST", { tmdb_id: title.id, media_type: title.media_type });
    trackedEntries.push(data.entry);
    button.textContent = IN_LIST_LABEL;
  } catch (error) {
    button.disabled = false;
    showError(MESSAGE, error.message);
  }
}
