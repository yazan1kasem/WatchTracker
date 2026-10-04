import { callApi } from "./api-client.js";
import { initAddMedia } from "./add-media.js";
import { initMediaAdmin } from "./admin-media.js";
import { initUserAdmin } from "./admin-users.js";
import { initAuth } from "./auth.js";
import { showError } from "./dom.js";
import { initLibrary } from "./library.js";
import { initProfileSearch } from "./profile-search.js";
import { initPublicProfile } from "./public-profile.js";

const ADMIN_ROLE = "admin";
const HTTP_UNAUTHORIZED = 401;
const PROTECTED_PAGES = ["library", "add-media", "admin"];
const ACTIVE_LINK_BY_PAGE = {
  library: "[data-user-link]",
  "add-media": "[data-user-link]",
  "profile-search": "[data-profile-link]",
  "public-profile": "[data-profile-link]",
  admin: "[data-admin-link]",
};
const PAGE_INITIALIZERS = {
  login: () => initAuth("login"),
  register: () => initAuth("register"),
  library: () => initLibrary(),
  "add-media": () => initAddMedia(),
  "profile-search": () => initProfileSearch(),
  "public-profile": () => initPublicProfile(),
  admin: (user) => initAdminDashboard(user),
};

// Every HTML page names itself in <body data-page="...">.
const page = document.body.dataset.page;

async function start() {
  const user = await fetchCurrentUser();
  await loadTopbar(user);

  if (PROTECTED_PAGES.includes(page) && !user) {
    window.location.href = "/login";
    return;
  }
  if (page === "admin" && user.role !== ADMIN_ROLE) {
    document.querySelector(".admin-page").hidden = true;
    showError("#admin-access-message", "Dieser Bereich ist nur für Admins.");
    return;
  }

  await PAGE_INITIALIZERS[page]?.(user);
}

async function fetchCurrentUser() {
  try {
    return (await callApi("/auth/me")).user;
  } catch (error) {
    // Public pages still work for guests when the session check fails; protected pages show the error.
    if (error.status === HTTP_UNAUTHORIZED || !PROTECTED_PAGES.includes(page)) return null;
    throw error;
  }
}

// Media administration needs the account list, and deleting an account also removes its media.
async function initAdminDashboard(user) {
  const mediaAdmin = initMediaAdmin();
  const userAdmin = initUserAdmin(user, {
    onAccountsLoaded: (accounts) => mediaAdmin.setAccounts(accounts),
    onAccountDeleted: () => mediaAdmin.load(),
  });

  await Promise.all([userAdmin.load(), mediaAdmin.load()]);
}

// The topbar lives once in topbar.html and is loaded into every page.
async function loadTopbar(user) {
  const response = await fetch("/topbar.html");
  if (!response.ok) throw new Error("Topbar konnte nicht geladen werden.");

  const slot = document.querySelector("#topbar-slot");
  slot.innerHTML = await response.text();
  if (user) renderAccountState(slot, user);
  if (ACTIVE_LINK_BY_PAGE[page]) slot.querySelector(ACTIVE_LINK_BY_PAGE[page]).classList.add("active");
  bindLogout(slot);
}

// topbar.html is written for guests; signed-in users get their links instead.
function renderAccountState(slot, user) {
  slot.querySelector("[data-user-link]").hidden = false;
  slot.querySelector("[data-user-label]").hidden = false;
  slot.querySelector("[data-user-label]").textContent = `Angemeldet als ${user.username}`;
  slot.querySelector("[data-guest-actions]").hidden = true;
  slot.querySelector("[data-logout]").hidden = false;
  slot.querySelector("[data-admin-link]").hidden = user.role !== ADMIN_ROLE;
}

function bindLogout(slot) {
  slot.querySelector("[data-logout]").addEventListener("click", async () => {
    try {
      await callApi("/auth/logout", "POST");
    } catch (error) {
      // Leaving the page is still the right outcome; the cookie expires on its own.
      console.warn("Logout fehlgeschlagen:", error);
    }
    window.location.href = "/";
  });
}

start().catch((error) => showError(".status-line", error.message));
