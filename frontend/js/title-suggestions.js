import { callApi } from "./api-client.js";
import { showError, showMessage } from "./dom.js";
import { getMediaTypeLabel, getReleaseYear } from "./media-presentation.js";

const SEARCH_DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

// Debounced TMDB title search below a text input. Only the newest search may update the list.
export class TitleSuggestions {
  #selectedTitle = null;
  #searchTimer;
  #searchVersion = 0;

  constructor({ input, container, typeSelect, messageTarget }) {
    this.input = input;
    this.container = container;
    this.typeSelect = typeSelect;
    this.messageTarget = messageTarget;

    input.addEventListener("input", () => this.#scheduleSearch());
    typeSelect.addEventListener("change", () => {
      if (input.value.trim()) this.#scheduleSearch();
    });
  }

  // A selection only counts while the input still shows it and the type was not changed.
  getCurrentSelection() {
    const title = this.#selectedTitle;
    const isStillSelected =
      title?.title === this.input.value.trim() && title?.media_type === this.typeSelect.value;
    return isStillSelected ? title : null;
  }

  reset() {
    this.input.value = "";
    this.#selectedTitle = null;
    this.#clearSuggestions();
  }

  #scheduleSearch() {
    this.#selectedTitle = null;
    this.#clearSuggestions();
    clearTimeout(this.#searchTimer);

    const query = this.input.value.trim();
    const version = ++this.#searchVersion;
    if (query.length < MIN_QUERY_LENGTH) {
      showMessage(this.messageTarget, "Mindestens zwei Zeichen für die Titelsuche eingeben.");
      return;
    }

    showMessage(this.messageTarget, "Suche in TMDB ...");
    this.#searchTimer = setTimeout(() => this.#search(query, version), SEARCH_DEBOUNCE_MS);
  }

  async #search(query, version) {
    try {
      const data = await callApi(`/tmdb/search?query=${encodeURIComponent(query)}&type=${this.typeSelect.value}`);
      if (version === this.#searchVersion) this.#renderSuggestions(data.results);
    } catch (error) {
      if (version === this.#searchVersion) showError(this.messageTarget, error.message);
    }
  }

  #renderSuggestions(titles) {
    this.container.replaceChildren(...titles.map((title) => this.#createSuggestion(title)));
    this.container.hidden = titles.length === 0;
    const summary = titles.length ? `${titles.length} TMDB-Treffer gefunden.` : "Keine Treffer gefunden.";
    showMessage(this.messageTarget, summary);
  }

  #createSuggestion(title) {
    const button = document.createElement("button");
    const year = getReleaseYear(title.release_date) ?? "Jahr unbekannt";
    button.type = "button";
    button.className = "admin-media-suggestion";
    button.textContent = `${title.title} · ${getMediaTypeLabel(title.media_type)} · ${year}`;
    button.addEventListener("click", () => this.#select(title));
    return button;
  }

  #select(title) {
    this.#selectedTitle = title;
    this.input.value = title.title;
    this.#clearSuggestions();
    showMessage(this.messageTarget, `${title.title} ausgewählt.`);
    this.input.focus();
  }

  #clearSuggestions() {
    this.container.replaceChildren();
    this.container.hidden = true;
  }
}
