import { api } from "./apiClient.js";
import { cloneTemplate, showMessage } from "./uiHelpers.js";

export async function initAdmin(currentUser) {
  const filterForm = document.querySelector("#admin-filter");
  const userList = document.querySelector("#admin-users");
  const mediaList = document.querySelector("#admin-media");
  const userCreateForm = document.querySelector("#admin-user-create");
  const userEditDialog = document.querySelector("#admin-user-dialog");
  const userEditForm = document.querySelector("#admin-user-edit");
  const mediaCreateForm = document.querySelector("#admin-media-create");
  const mediaEditDialog = document.querySelector("#admin-media-dialog");
  const mediaEditForm = document.querySelector("#admin-media-edit");
  const mediaFilterForm = document.querySelector("#admin-media-filter");
  let accounts = [];
  let entries = [];
  let editingUser = null;
  let editingEntry = null;

  async function loadUsers() {
    try {
      const data = await api("/admin/users");
      accounts = data.users;
      renderUsers();
      fillUserSelect(document.querySelector("#admin-media-user"));
      fillUserSelect(
        document.querySelector("#admin-edit-media-user"),
        editingEntry?.user_id
      );
    } catch (error) {
      showMessage("#admin-user-message", error.message, true);
    }
  }

  async function loadMedia() {
    try {
      const data = await api("/admin/tracked-media");
      entries = data.entries;
      renderMedia();
    } catch (error) {
      showMessage("#admin-media-message", error.message, true);
    }
  }

  async function loadDashboard() {
    await Promise.all([loadUsers(), loadMedia()]);
  }

  function fillUserSelect(select, selectedId) {
    select.replaceChildren();

    for (const account of accounts) {
      const option = document.createElement("option");
      option.value = account.id;
      option.textContent = `${account.username} (#${account.id})`;
      select.append(option);
    }

    select.disabled = accounts.length === 0;
    if (selectedId !== undefined) select.value = String(selectedId);
    if (select === document.querySelector("#admin-edit-media-user") && editingEntry) {
      select.value = String(editingEntry.user_id);
    }
  }

  function renderUsers() {
    const query = document.querySelector("#admin-query").value.trim().toLowerCase();
    const role = document.querySelector("#admin-role").value;

    const matches = accounts.filter((account) => {
      const matchesName = account.username.toLowerCase().includes(query);
      const matchesRole = role === "all" || account.role === role;
      return matchesName && matchesRole;
    });

    userList.replaceChildren();
    for (const account of matches) {
      userList.append(createUserRow(account));
    }
    showMessage("#admin-user-message", `${matches.length} von ${accounts.length} Konten`);
  }

  function createUserRow(account) {
    const row = cloneTemplate("#admin-user-template");
    const editButton = row.querySelector("[data-edit]");
    const deleteButton = row.querySelector("[data-delete]");
    const isMe = account.id === currentUser.id;

    row.querySelector("[data-username]").textContent = account.username;
    row.querySelector("[data-user-id]").textContent = `#${account.id}`;
    row.querySelector("[data-role]").textContent = account.role === "admin" ? "Admin" : "Nutzer";

    deleteButton.disabled = isMe;
    deleteButton.title = isMe ? "Das eigene Konto kann hier nicht gelöscht werden." : "Nutzer löschen";
    editButton.addEventListener("click", () => openUserDialog(account));
    deleteButton.addEventListener("click", () => deleteAccount(account));

    return row;
  }

  function renderMedia() {
    const query = document.querySelector("#admin-media-query").value.trim().toLowerCase();
    const type = document.querySelector("#admin-media-type").value;
    const matches = entries.filter((entry) => {
      const matchesQuery =
        entry.title.toLowerCase().includes(query) || entry.username.toLowerCase().includes(query);
      return matchesQuery && (type === "all" || entry.media_type === type);
    });

    mediaList.replaceChildren();
    for (const entry of matches) {
      mediaList.append(createMediaRow(entry));
    }
    showMessage("#admin-media-message", `${matches.length} von ${entries.length} Medieneinträgen`);
  }

  function progressLabel(entry) {
    if (entry.media_type === "movie") {
      return `${entry.progress} / ${entry.total_runtime ?? "?"} Min.`;
    }

    const position = entry.current_season && entry.current_episode
      ? `S${entry.current_season} E${entry.current_episode} · `
      : "";
    return `${position}${entry.progress} / ${entry.total_episodes ?? "?"} Folgen`;
  }

  function createMediaRow(entry) {
    const row = cloneTemplate("#admin-media-template");
    row.querySelector("[data-owner]").textContent = `${entry.username} (#${entry.user_id})`;
    row.querySelector("[data-title]").textContent = entry.title;
    row.querySelector("[data-media-type]").textContent = entry.media_type === "tv" ? "Serie" : "Film";
    row.querySelector("[data-progress]").textContent = progressLabel(entry);
    row.querySelector("[data-rating]").textContent = entry.rating ? `${entry.rating} / 10` : "–";
    row.querySelector("[data-visibility]").textContent = entry.is_public ? "Ja" : "Nein";
    row.querySelector("[data-edit]").addEventListener("click", () => openMediaDialog(entry));
    row.querySelector("[data-delete]").addEventListener("click", () => deleteMedia(entry));
    return row;
  }

  function openUserDialog(account) {
    editingUser = account;
    userEditForm.elements.username.value = account.username;
    userEditForm.elements.password.value = "";
    userEditForm.elements.role.value = account.role;
    userEditForm.elements.role.disabled = account.id === currentUser.id;
    showMessage("#admin-user-edit-message", "");
    userEditDialog.showModal();
  }

  async function saveUser(event) {
    event.preventDefault();
    const body = { username: userEditForm.elements.username.value };
    const password = userEditForm.elements.password.value;

    if (password) body.password = password;
    if (editingUser.id !== currentUser.id) body.role = userEditForm.elements.role.value;

    try {
      await api(`/admin/users/${editingUser.id}`, "PATCH", body);
      userEditDialog.close();
      await loadUsers();
    } catch (error) {
      showMessage("#admin-user-edit-message", error.message, true);
    }
  }

  async function deleteAccount(account) {
    if (!window.confirm(`Konto ${account.username} und die zugehörigen Listen endgültig löschen?`)) {
      return;
    }

    try {
      await api("/admin/users/" + account.id, "DELETE");
      await loadDashboard();
    } catch (error) {
      showMessage("#admin-user-message", error.message, true);
    }
  }

  async function createUser(event) {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(userCreateForm));

    try {
      await api("/admin/users", "POST", body);
      userCreateForm.reset();
      showMessage("#admin-user-create-message", "Nutzerkonto angelegt.");
      await loadUsers();
    } catch (error) {
      showMessage("#admin-user-create-message", error.message, true);
    }
  }

  async function createMedia(event) {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(mediaCreateForm));
    body.user_id = Number(body.user_id);
    body.tmdb_id = Number(body.tmdb_id);

    try {
      const data = await api("/admin/tracked-media", "POST", body);
      mediaCreateForm.reset();
      showMessage("#admin-media-create-message", `${data.entry.title} wurde angelegt.`);
      await loadMedia();
    } catch (error) {
      showMessage("#admin-media-create-message", error.message, true);
    }
  }

  function openMediaDialog(entry) {
    editingEntry = entry;
    const form = mediaEditForm;
    form.elements.user_id.value = String(entry.user_id);
    form.querySelector(".movie-fields").hidden = entry.media_type !== "movie";
    form.querySelector(".tv-fields").hidden = entry.media_type !== "tv";
    form.elements.progress.value = entry.progress ?? 0;
    form.elements.current_season.value = entry.current_season ?? 1;
    form.elements.current_episode.value = entry.current_episode ?? 1;
    form.elements.rating.value = entry.rating ?? "";
    form.elements.is_public.checked = Boolean(entry.is_public);
    form.elements.notes.value = entry.notes ?? "";
    document.querySelector("#admin-media-title").textContent =
      `${entry.title} · ${entry.media_type === "tv" ? "Serie" : "Film"}`;

    const progressInput = form.elements.progress;
    progressInput.max = entry.total_runtime ? String(entry.total_runtime) : "";
    form.elements.current_season.max = entry.total_seasons ? String(entry.total_seasons) : "";
    showMessage("#admin-media-edit-message", "");
    mediaEditDialog.showModal();
  }

  async function saveMedia(event) {
    event.preventDefault();
    const form = mediaEditForm;
    const body = {
      user_id: Number(form.elements.user_id.value),
      notes: form.elements.notes.value,
      is_public: form.elements.is_public.checked
    };

    if (form.elements.rating.value) body.rating = Number(form.elements.rating.value);
    if (editingEntry.media_type === "tv") {
      body.current_season = Number(form.elements.current_season.value);
      body.current_episode = Number(form.elements.current_episode.value);
    } else {
      body.progress = Number(form.elements.progress.value);
    }

    try {
      await api(`/admin/tracked-media/${editingEntry.id}`, "PATCH", body);
      mediaEditDialog.close();
      await loadMedia();
    } catch (error) {
      showMessage("#admin-media-edit-message", error.message, true);
    }
  }

  async function deleteMedia(entry) {
    if (!window.confirm(`„${entry.title}“ für ${entry.username} löschen?`)) return;

    try {
      await api(`/admin/tracked-media/${entry.id}`, "DELETE");
      await loadMedia();
    } catch (error) {
      showMessage("#admin-media-message", error.message, true);
    }
  }

  filterForm.addEventListener("input", renderUsers);
  filterForm.addEventListener("submit", (event) => event.preventDefault());
  userCreateForm.addEventListener("submit", createUser);
  userEditForm.addEventListener("submit", saveUser);
  mediaCreateForm.addEventListener("submit", createMedia);
  mediaEditForm.addEventListener("submit", saveMedia);
  mediaFilterForm.addEventListener("input", renderMedia);
  mediaFilterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    mediaFilterForm.reset();
    renderMedia();
  });
  document.querySelector("[data-close-user]").addEventListener("click", () => userEditDialog.close());
  document.querySelector("[data-close-media]").addEventListener("click", () => mediaEditDialog.close());

  await loadDashboard();
}
