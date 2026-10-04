const API_PREFIX = "/api";
const HTTP_NO_CONTENT = 204;

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// Example: callApi("/tracked-media", "POST", { tmdb_id: 550, media_type: "movie" })
export async function callApi(path, method = "GET", body) {
  const options = { method };
  if (body) {
    options.headers = { "Content-Type": "application/json" };
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_PREFIX}${path}`, options);
  if (response.status === HTTP_NO_CONTENT) return null;

  // Proxies and crashed servers can answer with HTML instead of JSON.
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    const message = json?.error?.message ?? `Anfrage fehlgeschlagen (HTTP ${response.status}).`;
    throw new ApiError(message, response.status);
  }
  return json.data;
}
