import { tr } from "./i18n.js";

const maxToasts = 4;
const infoDuration = 5000;
const actionDuration = 9000;

function region() {
  let element = document.getElementById("toasts");
  if (!element) {
    element = document.createElement("div");
    element.id = "toasts";
    element.className = "toasts";
    element.setAttribute("aria-live", "polite");
    document.body.append(element);
  }
  return element;
}

/**
 * Shows a short, non-blocking message. Confirmations disappear on their own.
 * Errors stay until they are dismissed, so they cannot be missed.
 * An `action` adds a button such as "Undo" and keeps the message a bit longer.
 * Without a page (for example in unit tests) it falls back to `alert`.
 */
export function notify(message, { error = false, action } = {}) {
  if (typeof document === "undefined" || !document.body) {
    globalThis.alert?.(message);
    return null;
  }
  const container = region();
  // Repeating a plain message replaces it. Every undo stays available.
  if (!action) {
    for (const existing of container.children) {
      if (existing.dataset.message === message) existing.remove();
    }
  }
  while (container.children.length >= maxToasts) {
    container.firstElementChild.remove();
  }

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.dataset.kind = error ? "error" : "info";
  toast.dataset.message = message;
  toast.setAttribute("role", error ? "alert" : "status");

  const text = document.createElement("p");
  text.className = "toast-text";
  text.textContent = message;

  const close = document.createElement("button");
  close.type = "button";
  close.className = "toast-close";
  close.textContent = "×";
  close.setAttribute("aria-label", tr("Meldung schließen", "Dismiss message"));
  close.addEventListener("click", () => toast.remove());

  toast.append(text);
  if (action) {
    const run = document.createElement("button");
    run.type = "button";
    run.className = "toast-action";
    run.textContent = action.label;
    run.addEventListener("click", () => {
      toast.remove();
      action.run();
    });
    toast.append(run);
  }
  toast.append(close);
  container.append(toast);

  if (!error) {
    let timer;
    const start = () => {
      clearTimeout(timer);
      timer = setTimeout(
        () => toast.remove(),
        action ? actionDuration : infoDuration,
      );
    };
    const pause = () => clearTimeout(timer);
    toast.addEventListener("mouseenter", pause);
    toast.addEventListener("focusin", pause);
    toast.addEventListener("mouseleave", start);
    toast.addEventListener("focusout", start);
    start();
  }
  return toast;
}
