import { callApi } from "./api-client.js";
import { cloneTemplate, showError, showMessage } from "./dom.js";
import { fillMediaRow, getWatchStatus } from "./media-presentation.js";
import {
  fillTrackedMediaForm,
  prepareTrackedMediaForm,
  readTrackedMediaForm,
} from "./tracked-media-form.js";

const MESSAGE = "#library-message";

let entries = [];

export async function initLibrary() {
  const filters = document.querySelector("#library-filters");
  // "input" fires for every keystroke in the search field and every dropdown change.
  filters.addEventListener("input", render);
  // Enter in the search field must not reload the page.
  filters.addEventListener("submit", (event) => event.preventDefault());

  await load();
}

async function load() {
  try {
    entries = (await callApi("/tracked-media")).entries;
    render();
  } catch (error) {
    showError(MESSAGE, error.message);
  }
}

function render() {
  const filters = readFilters();
  const visibleEntries = entries.filter((entry) => matchesFilters(entry, filters));
  document.querySelector("#library-list").replaceChildren(...visibleEntries.map(createRow));
  renderSummary();
  showMessage(MESSAGE, getEmptyListMessage(visibleEntries));
}

function readFilters() {
  return {
    query: document.querySelector("#library-query").value.trim().toLowerCase(),
    type: document.querySelector("#library-type").value,
    status: document.querySelector("#library-status").value,
  };
}

function matchesFilters(entry, { query, type, status }) {
  const isQueryMatch = entry.title.toLowerCase().includes(query);
  const isTypeMatch = type === "all" || entry.media_type === type;
  const isStatusMatch = status === "all" || getWatchStatus(entry) === status;
  return isQueryMatch && isTypeMatch && isStatusMatch;
}

function renderSummary() {
  const activeCount = entries.filter((entry) => getWatchStatus(entry) === "active").length;
  const completedCount = entries.filter((entry) => getWatchStatus(entry) === "completed").length;
  document.querySelector("#library-summary").textContent =
    `${entries.length} Titel · ${activeCount} laufend · ${completedCount} abgeschlossen`;
}

function getEmptyListMessage(visibleEntries) {
  if (entries.length === 0) return "Deine Liste ist noch leer.";
  if (visibleEntries.length === 0) return "Keine Titel für diese Suche gefunden.";
  return "";
}

function createRow(entry) {
  const row = cloneTemplate("#media-template");
  fillMediaRow(row, entry);
  setUpEditForm(row.querySelector("[data-edit-form]"), entry);
  row.querySelector("[data-edit]").addEventListener("click", () => toggleEditForm(row, entry));
  row.querySelector("[data-remove]").addEventListener("click", () => remove(entry));
  return row;
}

function setUpEditForm(form, entry) {
  prepareTrackedMediaForm(form, entry);

  if (entry.media_type === "tv") {
    form.elements.current_season.addEventListener("change", () => updateEpisodeLimit(form, entry));
  }

  form.querySelector("[data-cancel]").addEventListener("click", () => {
    form.hidden = true;
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    save(form, entry);
  });
}

// Opening the form always starts from the saved values.
function toggleEditForm(row, entry) {
  const form = row.querySelector("[data-edit-form]");
  form.hidden = !form.hidden;
  fillTrackedMediaForm(form, entry);
  if (entry.media_type === "tv") updateEpisodeLimit(form, entry);
}

async function save(form, entry) {
  try {
    const data = await callApi(`/tracked-media/${entry.id}`, "PATCH", readTrackedMediaForm(form, entry.media_type));
    entries = entries.map((candidate) => (candidate.id === data.entry.id ? data.entry : candidate));
    render();
  } catch (error) {
    showError(form.querySelector("[data-edit-message]"), error.message);
  }
}

async function remove(entry) {
  if (!window.confirm("Diesen Titel aus deiner Liste entfernen?")) return;

  try {
    await callApi(`/tracked-media/${entry.id}`, "DELETE");
    entries = entries.filter((candidate) => candidate.id !== entry.id);
    render();
  } catch (error) {
    showError(MESSAGE, error.message);
  }
}

async function updateEpisodeLimit(form, entry) {
  const seasonInput = form.elements.current_season;
  const episodeInput = form.elements.current_episode;
  const message = form.querySelector("[data-edit-message]");
  const seasonNumber = Number(seasonInput.value);

  episodeInput.removeAttribute("max");
  showMessage(message, "");
  if (!Number.isInteger(seasonNumber) || seasonNumber < 1) return;

  try {
    const season = await callApi(`/tmdb/tv-shows/${entry.tmdb_id}/seasons/${seasonNumber}`);
    // The user may have picked another season while this request was running.
    if (Number(seasonInput.value) !== seasonNumber) return;
    episodeInput.max = String(season.episodes.length);
  } catch (error) {
    if (Number(seasonInput.value) !== seasonNumber) return;
    showError(message, error.message);
  }
}
