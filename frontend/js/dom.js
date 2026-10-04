// target is a CSS selector or an element. An empty text hides the element.
export function showMessage(target, text) {
  writeMessage(target, text)?.classList.remove("error-text");
}

export function showError(target, text) {
  writeMessage(target, text)?.classList.add("error-text");
}

export function cloneTemplate(selector) {
  return document.querySelector(selector).content.firstElementChild.cloneNode(true);
}

function writeMessage(target, text) {
  const element = typeof target === "string" ? document.querySelector(target) : target;
  if (!element) return null;

  element.textContent = text;
  element.hidden = !text;
  return element;
}
