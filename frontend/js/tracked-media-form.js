const DEFAULT_POSITION = 1;

// Shows the movie or series fields and limits the inputs to the stored totals.
export function prepareTrackedMediaForm(form, entry) {
  const isSeries = entry.media_type === "tv";
  form.querySelector(".movie-fields").hidden = isSeries;
  form.querySelector(".tv-fields").hidden = !isSeries;
  form.elements.progress.max = entry.total_runtime ? String(entry.total_runtime) : "";
  form.elements.current_season.max = entry.total_seasons ? String(entry.total_seasons) : "";
}

export function fillTrackedMediaForm(form, entry) {
  form.elements.progress.value = entry.progress ?? 0;
  form.elements.current_season.value = entry.current_season ?? DEFAULT_POSITION;
  form.elements.current_episode.value = entry.current_episode ?? DEFAULT_POSITION;
  form.elements.rating.value = entry.rating ?? "";
  form.elements.is_public.checked = Boolean(entry.is_public);
  form.elements.notes.value = entry.notes ?? "";
}

// An empty rating field sends null, which removes the rating.
export function readTrackedMediaForm(form, mediaType) {
  const body = {
    notes: form.elements.notes.value,
    is_public: form.elements.is_public.checked,
    rating: form.elements.rating.value ? Number(form.elements.rating.value) : null,
  };

  if (mediaType === "tv") {
    body.current_season = Number(form.elements.current_season.value);
    body.current_episode = Number(form.elements.current_episode.value);
  } else {
    body.progress = Number(form.elements.progress.value);
  }

  return body;
}
