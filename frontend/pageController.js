import { api } from "./js/apiClient.js";
import { initAuth } from "./js/auth.js";
import { initLibrary } from "./js/library.js";
import { initAddMedia } from "./js/addMedia.js";
import { initProfileSearch } from "./js/profileSearch.js";
import { initPublicProfile } from "./js/publicProfile.js";
import { initAdmin } from "./js/admin.js";
import { showMessage } from "./js/uiHelpers.js";

// Jede HTML-Seite sagt im <body data-page="..."> welche Seite sie ist.
const page = document.body.dataset.page;

async function currentUser() {
  try {
    const data = await api("/auth/me");
    return data.user;
  } catch (error) {
    return null; // nicht angemeldet
  }
}

// Die Topbar steht nur einmal in topbar.html und wird in jede Seite geladen.
async function loadTopbar(user) {
  const response = await fetch("/topbar.html");
  if (!response.ok) throw new Error("Topbar konnte nicht geladen werden.");
  const slot = document.querySelector("#topbar-slot");
  slot.innerHTML = await response.text();

  // Im HTML ist alles für Gäste eingestellt. Für angemeldete Nutzer schalten wir um.
  if (user) {
    slot.querySelector("[data-user-link]").hidden = false;
    slot.querySelector("[data-user-label]").hidden = false;
    slot.querySelector("[data-user-label]").textContent = "Angemeldet als " + user.username;
    slot.querySelector("[data-guest-actions]").hidden = true;
    slot.querySelector("[data-logout]").hidden = false;
  }
  if (user && user.role === "admin") {
    slot.querySelector("[data-admin-link]").hidden = false;
  }

  // Den Menüpunkt der aktuellen Seite hervorheben
  if (page === "library" || page === "add-media") {
    slot.querySelector("[data-user-link]").classList.add("active");
  }
  if (page === "profile-search" || page === "public-profile") {
    slot.querySelector("[data-profile-link]").classList.add("active");
  }
  if (page === "admin") {
    slot.querySelector("[data-admin-link]").classList.add("active");
  }

  slot.querySelector("[data-logout]").addEventListener("click", async () => {
    try {
      await api("/auth/logout", "POST");
    } catch (error) {
      // Auch wenn der Logout fehlschlägt, geht es zurück zur Startseite.
    }
    window.location.href = "/profile-search.html";
  });
}

async function start() {
  const user = await currentUser();
  await loadTopbar(user);

  if (["library", "add-media", "admin"].includes(page) && !user) {
    window.location.href = "/login.html";
    return;
  }
  if (page === "admin" && user.role !== "admin") {
    document.querySelector(".admin-page").hidden = true;
    showMessage("#admin-access-message", "Dieser Bereich ist nur für Admins.", true);
    return;
  }

  if (page === "login" || page === "register") initAuth(page);
  if (page === "library") await initLibrary();
  if (page === "add-media") await initAddMedia();
  if (page === "profile-search") initProfileSearch();
  if (page === "public-profile") await initPublicProfile();
  if (page === "admin") await initAdmin(user);
}

start().catch((error) => showMessage(".status-line", error.message, true));