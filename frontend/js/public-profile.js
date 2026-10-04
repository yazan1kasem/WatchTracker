import { callApi } from "./api-client.js";
import { cloneTemplate, showError, showMessage } from "./dom.js";
import { fillMediaRow } from "./media-presentation.js";

const MESSAGE = "#profile-message";
const PROFILE_PATH_PREFIX = "/u/";

let entries = [];
let selectedType = "all";

export async function initPublicProfile() {
  const username = readUsernameFromPath();

  if (!username) {
    showError(MESSAGE, "Kein Benutzername angegeben.");
    return;
  }

  await loadProfile(username);
  for (const button of getFilterButtons()) {
    button.addEventListener("click", () => {
      selectedType = button.dataset.profileFilter;
      render();
    });
  }
}

async function loadProfile(username) {
  try {
    const profile = await callApi(`/users/${encodeURIComponent(username)}/profile`);
    entries = profile.entries;
    document.querySelector("#profile-username").textContent = profile.user.username;
    document.querySelector("#profile-summary").textContent = `Öffentliches Profil · ${entries.length} Titel`;
    render();
  } catch (error) {
    showError(MESSAGE, error.message);
  }
}

function render() {
  const visibleEntries = entries.filter((entry) => selectedType === "all" || entry.media_type === selectedType);
  document.querySelector("#public-media-list").replaceChildren(...visibleEntries.map(createProfileRow));

  for (const button of getFilterButtons()) {
    button.classList.toggle("selected", button.dataset.profileFilter === selectedType);
  }

  showMessage(MESSAGE, visibleEntries.length === 0 ? "Keine Titel in dieser Kategorie freigegeben." : "");
}

function createProfileRow(entry) {
  const row = cloneTemplate("#public-media-template");
  fillMediaRow(row, entry);

  const notes = row.querySelector("[data-notes]");
  if (entry.notes?.trim()) {
    notes.textContent = entry.notes;
    notes.hidden = false;
  }
  return row;
}

function getFilterButtons() {
  return document.querySelectorAll("[data-profile-filter]");
}

// Profile URLs look like /u/<username>.
function readUsernameFromPath() {
  const encodedUsername = window.location.pathname.slice(PROFILE_PATH_PREFIX.length).replace(/\/$/, "");
  return decodeURIComponent(encodedUsername);
}
