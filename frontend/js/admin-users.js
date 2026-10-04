import { callApi } from "./api-client.js";
import { cloneTemplate, showError, showMessage } from "./dom.js";

const ROLE_LABELS = { admin: "Admin", user: "Nutzer" };
const LIST_MESSAGE = "#admin-user-message";
const EDIT_MESSAGE = "#admin-user-edit-message";
const CREATE_MESSAGE = "#admin-user-create-message";

const elements = {};
let currentUser = null;
let accountListeners = null;
let accounts = [];
let editingAccount = null;

// onAccountsLoaded receives the account list, onAccountDeleted reloads dependent data.
export function initUserAdmin(user, listeners) {
  currentUser = user;
  accountListeners = listeners;
  Object.assign(elements, {
    filterForm: document.querySelector("#admin-filter"),
    createForm: document.querySelector("#admin-user-create"),
    editDialog: document.querySelector("#admin-user-dialog"),
    editForm: document.querySelector("#admin-user-edit"),
  });

  elements.filterForm.addEventListener("input", render);
  elements.filterForm.addEventListener("submit", (event) => event.preventDefault());
  elements.createForm.addEventListener("submit", create);
  elements.editForm.addEventListener("submit", save);
  document.querySelector("[data-close-user]").addEventListener("click", () => elements.editDialog.close());

  return { load };
}

async function load() {
  try {
    accounts = (await callApi("/admin/users")).users;
    render();
    accountListeners.onAccountsLoaded(accounts);
  } catch (error) {
    showError(LIST_MESSAGE, error.message);
  }
}

function render() {
  const query = document.querySelector("#admin-query").value.trim().toLowerCase();
  const role = document.querySelector("#admin-role").value;
  const matches = accounts.filter((account) => {
    const isNameMatch = account.username.toLowerCase().includes(query);
    return isNameMatch && (role === "all" || account.role === role);
  });

  document.querySelector("#admin-users").replaceChildren(...matches.map(createRow));
  showMessage(LIST_MESSAGE, `${matches.length} von ${accounts.length} Konten`);
}

function createRow(account) {
  const row = cloneTemplate("#admin-user-template");
  const deleteButton = row.querySelector("[data-delete]");
  const isCurrentUser = account.id === currentUser.id;

  row.querySelector("[data-username]").textContent = account.username;
  row.querySelector("[data-user-id]").textContent = `#${account.id}`;
  row.querySelector("[data-role]").textContent = ROLE_LABELS[account.role] ?? ROLE_LABELS.user;

  deleteButton.disabled = isCurrentUser;
  deleteButton.title = isCurrentUser ? "Das eigene Konto kann hier nicht gelöscht werden." : "Nutzer löschen";
  row.querySelector("[data-edit]").addEventListener("click", () => openEditDialog(account));
  deleteButton.addEventListener("click", () => remove(account));

  return row;
}

function openEditDialog(account) {
  const { editForm } = elements;
  editingAccount = account;
  editForm.elements.username.value = account.username;
  editForm.elements.password.value = "";
  editForm.elements.role.value = account.role;
  editForm.elements.role.disabled = account.id === currentUser.id;
  showMessage(EDIT_MESSAGE, "");
  elements.editDialog.showModal();
}

// The own role is never sent: the server refuses self-demotion anyway.
async function save(event) {
  event.preventDefault();
  const { editForm } = elements;
  const body = { username: editForm.elements.username.value };
  const password = editForm.elements.password.value;

  if (password) body.password = password;
  if (editingAccount.id !== currentUser.id) body.role = editForm.elements.role.value;

  try {
    await callApi(`/admin/users/${editingAccount.id}`, "PATCH", body);
    elements.editDialog.close();
    await load();
  } catch (error) {
    showError(EDIT_MESSAGE, error.message);
  }
}

async function remove(account) {
  if (!window.confirm(`Konto ${account.username} und die zugehörigen Listen endgültig löschen?`)) return;

  try {
    await callApi(`/admin/users/${account.id}`, "DELETE");
    await Promise.all([load(), accountListeners.onAccountDeleted()]);
  } catch (error) {
    showError(LIST_MESSAGE, error.message);
  }
}

async function create(event) {
  event.preventDefault();
  const body = Object.fromEntries(new FormData(elements.createForm));

  try {
    await callApi("/admin/users", "POST", body);
    elements.createForm.reset();
    showMessage(CREATE_MESSAGE, "Nutzerkonto angelegt.");
    await load();
  } catch (error) {
    showError(CREATE_MESSAGE, error.message);
  }
}
