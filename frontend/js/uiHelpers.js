// Hilfsfunktionen, die von mehreren Seiten verwendet werden.

// Zeigt einen Text an. Ist der Text leer, wird das Element ausgeblendet.
export function showMessage(selector, text, isError = false) {
  const element = document.querySelector(selector);
  if (!element) return;

  element.textContent = text;
  element.hidden = !text;
  element.classList.toggle("error-text", isError);
}

// Erstellt eine Kopie vom Inhalt eines <template> aus dem HTML, z. B. eine neue Listenzeile.
export function cloneTemplate(selector) {
  return document.querySelector(selector).content.firstElementChild.cloneNode(true);
}

export function setPoster(image, path, title) {
  if (!path) {
    image.hidden = true;
    return;
  }
  image.src = "/api/tmdb/image?path=" + encodeURIComponent(path);
  image.alt = "Poster: " + title;
}

// Filme zählen Minuten, Serien zählen Folgen.
function totalOf(entry) {
  if (entry.media_type === "tv") return entry.total_episodes;
  return entry.total_runtime;
}

// Liefert "completed", "active" oder "planned".
// Öffentliche Profile schicken kein is_completed mit, darum rechnen wir es dann selbst aus.
export function statusOf(entry) {
  const total = totalOf(entry);
  if (entry.is_completed || (total && entry.progress >= total)) return "completed";
  if (entry.progress > 0) return "active";
  return "planned";
}

const STATUS_LABELS = {
  completed: "Abgeschlossen",
  active: "Läuft",
  planned: "Geplant",
};

function progressText(entry) {
  if (entry.media_type === "movie") {
    if (!entry.progress) return "Noch nicht gesehen";
    return `${entry.progress} / ${entry.total_runtime || "?"} Min.`;
  }

  if (!entry.progress) return "Noch nicht begonnen";
  const episodes = `${entry.progress} / ${entry.total_episodes || "?"} Folgen`;

  // Öffentliche Profile kennen Staffel und Folge nicht.
  if (!entry.current_season || !entry.current_episode) return episodes;

  const season = String(entry.current_season).padStart(2, "0"); // 3 -> "03"
  const episode = String(entry.current_episode).padStart(2, "0");
  return `S${season} E${episode} · ${episodes}`;
}

// Befüllt eine Zeile aus dem Template mit den Daten eines Titels.
export function fillMediaRow(row, entry) {
  const total = totalOf(entry);
  let percent = 0;
  if (total) percent = Math.min(100, Math.round((entry.progress / total) * 100));

  let typeAndYear = entry.media_type === "tv" ? "Serie" : "Film";
  if (entry.release_date) typeAndYear += " · " + entry.release_date.slice(0, 4);

  const status = statusOf(entry);
  const statusTag = row.querySelector("[data-status]");
  statusTag.textContent = STATUS_LABELS[status];
  if (status === "completed") statusTag.classList.add("status-complete");

  setPoster(row.querySelector("[data-poster]"), entry.poster_path, entry.title);
  row.querySelector("[data-title]").textContent = entry.title;
  row.querySelector("[data-type-year]").textContent = typeAndYear;
  row.querySelector("[data-progress]").textContent = progressText(entry);
  row.querySelector("[data-progress-bar]").style.width = percent + "%";
  row.querySelector("[data-rating]").textContent = entry.rating ? entry.rating + " / 10" : "–";
}