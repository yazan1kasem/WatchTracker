import { api } from "./apiClient.js";
import { cloneTemplate, showMessage } from "./uiHelpers.js";

export function initProfileSearch() {
  const form = document.querySelector("#profile-search-form");
  const results = document.querySelector("#profile-results");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    results.replaceChildren();
    const query = form.elements.query.value.trim();
    showMessage("#profile-search-message", "Profile werden gesucht ...");

    try {
      const data = await api("/users/search?query=" + encodeURIComponent(query));

      for (const profile of data.profiles) {
        const result = cloneTemplate("#profile-result-template");
        const profileUrl = "/public-profile.html?username=" + encodeURIComponent(profile.username);

        result.querySelector("[data-username]").textContent = profile.username;
        result.querySelector("[data-title-count]").textContent =
          `${profile.public_title_count} öffentliche Titel`;
        for (const link of result.querySelectorAll("[data-profile-link]")) {
          link.href = profileUrl;
        }
        results.append(result);
      }

      showMessage("#profile-search-message", `${data.profiles.length} öffentliche Profile für „${query}“`);
    } catch (error) {
      showMessage("#profile-search-message", error.message, true);
    }
  });
}