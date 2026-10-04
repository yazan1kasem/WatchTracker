import { api } from "./apiClient.js";
import { cloneTemplate, fillMediaRow, showMessage } from "./uiHelpers.js";

export async function initPublicProfile() {
  const username = new URLSearchParams(window.location.search).get("username");
  const list = document.querySelector("#public-media-list");
  const filterButtons = document.querySelectorAll("[data-profile-filter]");
  let entries = [];
  let filter = "all";

  function render() {
    list.replaceChildren();
    const visibleEntries = entries.filter((entry) => filter === "all" || entry.media_type === filter);

    for (const entry of visibleEntries) {
      const row = cloneTemplate("#public-media-template");
      fillMediaRow(row, entry);
      list.append(row);
    }

    for (const button of filterButtons) {
      button.classList.toggle("selected", button.dataset.profileFilter === filter);
    }

    if (visibleEntries.length === 0) {
      showMessage("#profile-message", "Keine Titel in dieser Kategorie freigegeben.");
    } else {
      showMessage("#profile-message", "");
    }
  }

  if (!username) {
    showMessage("#profile-message", "Kein Benutzername angegeben.", true);
    return;
  }

  try {
    const profile = await api(`/users/${encodeURIComponent(username)}/profile`);
    entries = profile.entries;
    document.querySelector("#profile-username").textContent = profile.user.username;
    document.querySelector("#profile-summary").textContent =
      `Öffentliches Profil · ${entries.length} Titel`;
    render();
  } catch (error) {
    showMessage("#profile-message", error.message, true);
  }

  for (const button of filterButtons) {
    button.addEventListener("click", () => {
      filter = button.dataset.profileFilter;
      render();
    });
  }
}