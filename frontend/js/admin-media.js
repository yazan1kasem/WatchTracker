import { callApi } from "./api-client.js";
import { cloneTemplate, showError, showMessage } from "./dom.js";
import { getMediaTypeLabel, formatProgress } from "./media-presentation.js";
import { TitleSuggestions } from "./title-suggestions.js";
import {
  fillTrackedMediaForm,
  prepareTrackedMediaForm,
  readTrackedMediaForm,
} from "./tracked-media-form.js";

const CREATE_MESSAGE = "#admin-media-create-message";
const LIST_MESSAGE = "#admin-media-message";
const EDIT_MESSAGE = "#admin-media-edit-message";

const elements = {};
let suggestions = null;
let accounts = [];
let entries = [];
let editingEntry = null;

export function initMediaAdmin() {
  Object.assign(elements, {
    createForm: document.querySelector("#admin-media-create"),
    editDialog: document.querySelector("#admin-media-dialog"),
    editForm: document.querySelector("#admin-media-edit"),
    userSelect: document.querySelector("#admin-edit-media-user"),
    filterForm: document.querySelector("#admin-media-filter"),
  });
  suggestions = new TitleSuggestions({
    input: document.querySelector("#admin-media-title-search"),
    container: document.querySelector("#admin-media-suggestions"),
    typeSelect: elements.createForm.elements.media_type,
    messageTarget: CREATE_MESSAGE,
  });

  elements.createForm.addEventListener("submit", create);
  elements.editForm.addEventListener("submit", save);
  elements.filterForm.addEventListener("input", render);
  elements.filterForm.addEventListener("submit", resetFilters);
  document.querySelector("[data-close-media]").addEventListener("click", () => elements.editDialog.close());

  return { load, setAccounts };
}

async function load() {
  try {
    entries = (await callApi("/admin/tracked-media")).entries;
    render();
  } catch (error) {
    showError(LIST_MESSAGE, error.message);
  }
}

function setAccounts(loadedAccounts) {
  const { userSelect } = elements;
  accounts = loadedAccounts;
  document.querySelector("#admin-media-user-options")
    .replaceChildren(...accounts.map((account) => new Option("", account.username)));
  userSelect.replaceChildren(...accounts.map((account) => new Option(`${account.username} (#${account.id})`, account.id)));
  userSelect.disabled = accounts.length === 0;
  if (editingEntry) userSelect.value = String(editingEntry.user_id);
}

function render() {
  const query = document.querySelector("#admin-media-query").value.trim().toLowerCase();
  const type = document.querySelector("#admin-media-type").value;
  const matches = entries.filter((entry) => {
    const isQueryMatch =
      entry.title.toLowerCase().includes(query) || entry.username.toLowerCase().includes(query);
    return isQueryMatch && (type === "all" || entry.media_type === type);
  });

  document.querySelector("#admin-media").replaceChildren(...matches.map(createRow));
  showMessage(LIST_MESSAGE, `${matches.length} von ${entries.length} Medieneinträgen`);
}

function resetFilters(event) {
  event.preventDefault();
  elements.filterForm.reset();
  render();
}

function createRow(entry) {
  const row = cloneTemplate("#admin-media-template");
  row.querySelector("[data-owner]").textContent = `${entry.username} (#${entry.user_id})`;
  row.querySelector("[data-title]").textContent = entry.title;
  row.querySelector("[data-media-type]").textContent = getMediaTypeLabel(entry.media_type);
  row.querySelector("[data-progress]").textContent = formatProgress(entry);
  row.querySelector("[data-rating]").textContent = entry.rating ? `${entry.rating} / 10` : "–";
  row.querySelector("[data-visibility]").textContent = entry.is_public ? "Ja" : "Nein";
  row.querySelector("[data-edit]").addEventListener("click", () => openEditDialog(entry));
  row.querySelector("[data-delete]").addEventListener("click", () => remove(entry));
  return row;
}

function openEditDialog(entry) {
  editingEntry = entry;
  elements.userSelect.value = String(entry.user_id);
  prepareTrackedMediaForm(elements.editForm, entry);
  fillTrackedMediaForm(elements.editForm, entry);
  document.querySelector("#admin-media-title").textContent = `${entry.title} · ${getMediaTypeLabel(entry.media_type)}`;
  showMessage(EDIT_MESSAGE, "");
  elements.editDialog.showModal();
}

async function save(event) {
  event.preventDefault();
  const body = {
    user_id: Number(elements.userSelect.value),
    ...readTrackedMediaForm(elements.editForm, editingEntry.media_type),
  };

  try {
    await callApi(`/admin/tracked-media/${editingEntry.id}`, "PATCH", body);
    elements.editDialog.close();
    await load();
  } catch (error) {
    showError(EDIT_MESSAGE, error.message);
  }
}

async function remove(entry) {
  if (!window.confirm(`„${entry.title}“ für ${entry.username} löschen?`)) return;

  try {
    await callApi(`/admin/tracked-media/${entry.id}`, "DELETE");
    await load();
  } catch (error) {
    showError(LIST_MESSAGE, error.message);
  }
}

async function create(event) {
  event.preventDefault();
  const account = findAccountByUsername(document.querySelector("#admin-media-username").value);
  const title = suggestions.getCurrentSelection();

  if (!account) {
    showError(CREATE_MESSAGE, "Bitte einen vorhandenen Nutzernamen auswählen.");
    return;
  }
  if (!title) {
    showError(CREATE_MESSAGE, "Bitte einen TMDB-Treffervorschlag auswählen.");
    return;
  }

  await submitNewEntry(account, title);
}

async function submitNewEntry(account, title) {
  const submitButton = elements.createForm.querySelector('[type="submit"]');
  submitButton.disabled = true;

  try {
    const body = { user_id: account.id, tmdb_id: title.id, media_type: title.media_type };
    const data = await callApi("/admin/tracked-media", "POST", body);
    suggestions.reset();
    showMessage(CREATE_MESSAGE, `${data.entry.title} wurde angelegt.`);
    await load();
  } catch (error) {
    showError(CREATE_MESSAGE, error.message);
  } finally {
    submitButton.disabled = false;
  }
}

function findAccountByUsername(value) {
  const username = value.trim().toLowerCase();
  return accounts.find((account) => account.username.toLowerCase() === username);
}
