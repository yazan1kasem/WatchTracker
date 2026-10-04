import { callApi } from "./api-client.js";
import { showError, showMessage } from "./dom.js";

const PAGE_AFTER_LOGIN = "/library";
const PAGE_AFTER_REGISTRATION = "/login?created=1";

// Used by the login and register pages (page is "login" or "register").
export function initAuth(page) {
  const form = document.querySelector(`#${page}-form`);

  if (page === "login" && new URLSearchParams(window.location.search).has("created")) {
    showMessage("[data-form-error]", "Konto erstellt. Du kannst dich jetzt anmelden.");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = form.elements.username.value;
    const password = form.elements.password.value;

    if (page === "register" && password !== form.elements.password_confirmation.value) {
      showError("[data-form-error]", "Die Passwörter stimmen nicht überein.");
      return;
    }

    try {
      await callApi(`/auth/${page}`, "POST", { username, password });
      window.location.href = page === "login" ? PAGE_AFTER_LOGIN : PAGE_AFTER_REGISTRATION;
    } catch (error) {
      showError("[data-form-error]", error.message);
    }
  });
}
