import { api } from "./apiClient.js";
import { cloneTemplate, setPoster, showMessage } from "./uiHelpers.js";

export async function initAddMedia() {
  const form = document.querySelector("#title-search-form");
  const results = document.querySelector("#title-results");
  let entries = []; // was schon in der eigenen Liste ist

  try {
    const data = await api("/tracked-media");
    entries = data.entries;
  } catch (error) {
    showMessage("#title-search-message", error.message, true);
  }

  function isInList(title) {
    return entries.some(
      (entry) => entry.tmdb_id === title.id && entry.media_type === title.media_type,
    );
  }

  function createRow(title) {
    const row = cloneTemplate("#title-result-template");
    const button = row.querySelector("[data-add]");
    const type = title.media_type === "tv" ? "Serie" : "Film";
    const year = title.release_date ? title.release_date.slice(0, 4) : "Jahr unbekannt";

    setPoster(row.querySelector("[data-poster]"), title.poster_path, title.title);
    row.querySelector("[data-title]").textContent = title.title;
    row.querySelector("[data-type-year]").textContent = `${type} · ${year}`;
    row.querySelector("[data-overview]").textContent =
      title.overview || "Keine Beschreibung verfügbar.";

    if (isInList(title)) {
      button.textContent = "In deiner Liste";
      button.disabled = true;
    }
    button.addEventListener("click", () => add(title, button));

    return row;
  }

  async function add(title, button) {
    button.disabled = true; // verhindert Doppelklicks

    try {
      const data = await api("/tracked-media", "POST", {
        tmdb_id: title.id,
        media_type: title.media_type,
      });
      entries.push(data.entry);
      button.textContent = "In deiner Liste";
    } catch (error) {
      button.disabled = false;
      showMessage("#title-search-message", error.message, true);
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    results.replaceChildren();
    const query = form.elements.query.value.trim();
    const type = form.elements.type.value;
    showMessage("#title-search-message", "Suche in TMDB ...");

    let types = [type];
    if (type === "all") types = ["movie", "tv"];

    try {
      // Filme und Serien nacheinander suchen; zwei Anfragen brauchen kaum länger.
      let titles = [];
      for (const searchType of types) {
        const data = await api(`/tmdb/search?query=${encodeURIComponent(query)}&type=${searchType}`);
        titles = titles.concat(data.results);
      }

      for (const title of titles) {
        results.append(createRow(title));
      }

      if (titles.length > 0) {
        showMessage("#title-search-message", `${titles.length} Treffer für „${query}“`);
      } else {
        showMessage("#title-search-message", `Keine Filme oder Serien für „${query}“ gefunden.`);
      }
    } catch (error) {
      showMessage("#title-search-message", error.message, true);
    }
  });
}