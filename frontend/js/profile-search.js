import { callApi } from "./api-client.js";
import { cloneTemplate, showError, showMessage } from "./dom.js";

export function initProfileSearch() {
  const form = document.querySelector("#profile-search-form");
  const results = document.querySelector("#profile-results");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    results.replaceChildren();
    const query = form.elements.query.value.trim();
    showMessage("#profile-search-message", "Profile werden gesucht ...");

    try {
      const data = await callApi(`/users/search?query=${encodeURIComponent(query)}`);
      results.replaceChildren(...data.profiles.map(createProfileResult));
      showMessage("#profile-search-message", `${data.profiles.length} öffentliche Profile für „${query}“`);
    } catch (error) {
      showError("#profile-search-message", error.message);
    }
  });
}

function createProfileResult(profile) {
  const result = cloneTemplate("#profile-result-template");
  const profileUrl = `/u/${encodeURIComponent(profile.username)}`;

  result.querySelector("[data-username]").textContent = profile.username;
  result.querySelector("[data-title-count]").textContent = `${profile.public_title_count} öffentliche Titel`;
  for (const link of result.querySelectorAll("[data-profile-link]")) {
    link.href = profileUrl;
  }
  return result;
}
