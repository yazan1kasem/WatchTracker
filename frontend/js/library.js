import { api } from "./apiClient.js";
import { cloneTemplate, fillMediaRow, showMessage, statusOf } from "./uiHelpers.js";

async function updateEpisodeLimit(form, entry) {
  const seasonInput = form.elements.current_season;
  const episodeInput = form.elements.current_episode;
  const seasonNumber = Number(seasonInput.value);
  const message = form.querySelector("[data-edit-message]");

  episodeInput.removeAttribute("max");
  message.textContent = "";
  message.classList.remove("error-text");

  if (!Number.isInteger(seasonNumber) || seasonNumber < 1) return;

  try {
    const data = await api(`/tmdb/tv/${entry.tmdb_id}/seasons/${seasonNumber}`);
    if (Number(seasonInput.value) !== seasonNumber) return;

    episodeInput.max = String(data.episodes.length);
  } catch (error) {
    if (Number(seasonInput.value) !== seasonNumber) return;
    message.textContent = error.message;
    message.classList.add("error-text");
  }
}

export async function initLibrary() {
  const list = document.querySelector("#library-list");
  const filters = document.querySelector("#library-filters");
  let entries = [];

  async function load() {
    try {
      const data = await api("/tracked-media");
      entries = data.entries;
      render();
    } catch (error) {
      showMessage("#library-message", error.message, true);
    }
  }

  function render() {
    const query = document.querySelector("#library-query").value.trim().toLowerCase();
    const type = document.querySelector("#library-type").value;
    const status = document.querySelector("#library-status").value;

    const filtered = entries.filter((entry) => {
      const matchesQuery = entry.title.toLowerCase().includes(query);
      const matchesType = type === "all" || entry.media_type === type;
      const matchesStatus = status === "all" || statusOf(entry) === status;
      return matchesQuery && matchesType && matchesStatus;
    });

    list.replaceChildren(); // alte Zeilen entfernen
    for (const entry of filtered) {
      list.append(createRow(entry));
    }

    const active = entries.filter((entry) => statusOf(entry) === "active").length;
    const completed = entries.filter((entry) => statusOf(entry) === "completed").length;
    document.querySelector("#library-summary").textContent =
      `${entries.length} Titel · ${active} laufend · ${completed} abgeschlossen`;

    let message = "";
    if (entries.length === 0) message = "Deine Liste ist noch leer.";
    else if (filtered.length === 0) message = "Keine Titel für diese Suche gefunden.";
    showMessage("#library-message", message);
  }

  function createRow(entry) {
    const row = cloneTemplate("#media-template");
    const form = row.querySelector("[data-edit-form]");
    fillMediaRow(row, entry);

    if (entry.media_type === "movie" && entry.total_runtime) {
      form.elements.progress.max = String(entry.total_runtime);
    }

    // Im HTML sind die Film-Felder sichtbar. Bei Serien zeigen wir Staffel und Folge.
    if (entry.media_type === "tv") {
      form.querySelector(".movie-fields").hidden = true;
      form.querySelector(".tv-fields").hidden = false;
      if (entry.total_seasons) {
        form.elements.current_season.max = String(entry.total_seasons);
      }
      form.elements.current_season.addEventListener("change", () => {
        updateEpisodeLimit(form, entry);
      });
    }

    row.querySelector("[data-edit]").addEventListener("click", () => {
      form.hidden = !form.hidden;
      // Beim Öffnen immer die gespeicherten Werte eintragen
      form.elements.progress.value = entry.progress || 0;
      form.elements.current_season.value = entry.current_season || 1;
      form.elements.current_episode.value = entry.current_episode || 1;
      form.elements.rating.value = entry.rating || "";
      form.elements.is_public.checked = Boolean(entry.is_public);
      form.elements.notes.value = entry.notes || "";
      if (entry.media_type === "tv") updateEpisodeLimit(form, entry);
    });

    row.querySelector("[data-cancel]").addEventListener("click", () => {
      form.hidden = true;
    });

    row.querySelector("[data-remove]").addEventListener("click", () => remove(entry));

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      save(form, entry);
    });

    return row;
  }

  async function save(form, entry) {
    const body = {
      notes: form.elements.notes.value,
      is_public: form.elements.is_public.checked,
    };
    if (form.elements.rating.value) body.rating = Number(form.elements.rating.value);

    if (entry.media_type === "tv") {
      body.current_season = Number(form.elements.current_season.value);
      body.current_episode = Number(form.elements.current_episode.value);
    } else {
      body.progress = Number(form.elements.progress.value);
    }

    try {
      await api("/tracked-media/" + entry.id, "PATCH", body);
      await load();
    } catch (error) {
      const message = form.querySelector("[data-edit-message]");
      message.textContent = error.message;
      message.classList.add("error-text");
    }
  }

  async function remove(entry) {
    if (!window.confirm("Diesen Titel aus deiner Liste entfernen?")) return;

    try {
      await api("/tracked-media/" + entry.id, "DELETE");
      await load();
    } catch (error) {
      showMessage("#library-message", error.message, true);
    }
  }

  // "input" feuert bei jeder Eingabe im Suchfeld und bei jeder Auswahl im Dropdown.
  filters.addEventListener("input", render);
  filters.addEventListener("submit", (event) => event.preventDefault()); // Enter soll die Seite nicht neu laden

  await load();
}
