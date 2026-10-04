// Alle Anfragen ans Backend laufen über diese Funktion.
// Beispiel: api("/tracked-media", "POST", { tmdb_id: 550, media_type: "movie" })
export async function api(path, method = "GET", body) {
  const options = { method: method };
  if (body) {
    options.headers = { "Content-Type": "application/json" };
    options.body = JSON.stringify(body);
  }

  const response = await fetch("/api" + path, options);
  if (response.status === 204) return null; // 204 = Erfolg ohne Inhalt (z. B. Logout)

  const json = await response.json();
  if (!response.ok) throw new Error(json.error.message);
  return json.data;
}