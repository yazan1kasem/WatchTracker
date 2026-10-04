import { api } from "./apiClient.js";
import { showMessage } from "./uiHelpers.js";

// Wird für login.html und register.html verwendet (page = "login" oder "register").
export function initAuth(page) {
  const form = document.querySelector("#" + page + "-form");

  // Nach der Registrierung leitet register.html auf login.html?created=1 weiter.
  if (page === "login" && window.location.search.includes("created")) {
    showMessage("[data-form-error]", "Konto erstellt. Du kannst dich jetzt anmelden.");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = form.elements.username.value;
    const password = form.elements.password.value;

    if (page === "register" && password !== form.elements.password_confirmation.value) {
      showMessage("[data-form-error]", "Die Passwörter stimmen nicht überein.", true);
      return;
    }

    try {
      await api("/auth/" + page, "POST", { username: username, password: password });
      if (page === "login") {
        window.location.href = "/library.html";
      } else {
        window.location.href = "/login.html?created=1";
      }
    } catch (error) {
      showMessage("[data-form-error]", error.message, true);
    }
  });
}
