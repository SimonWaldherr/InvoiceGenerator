import { $ } from "../utils.js";
import { collect, draftChangeEvent, validate } from "./draft-form.js";
import { localeChangeEvent, tr } from "./i18n.js";
import { invalidFields, showProblems } from "./validation-ui.js";

/** How many entries still block an export, as far as the form can tell. */
export function openItemCount() {
  const fields = invalidFields().length;
  // A rule the browser cannot attach to one field, such as "no line items".
  return fields || (validate(collect()).length ? 1 : 0);
}

function describe(count) {
  if (!count) return tr("Pflichtangaben vollständig", "Required fields complete");
  return tr(
    `${count} ${count === 1 ? "Angabe" : "Angaben"} offen`,
    `${count} ${count === 1 ? "item" : "items"} to complete`,
  );
}

function render() {
  const pill = $("#barStatus");
  if (!pill) return;
  const count = openItemCount();
  const text = describe(count);
  pill.dataset.state = count ? "open" : "ok";
  pill.disabled = count === 0;
  pill.setAttribute(
    "aria-label",
    count
      ? text + tr(". Zum ersten offenen Feld springen.", ". Go to the first one.")
      : text,
  );
  $("#barStatusDot").textContent = count ? String(count) : "✓";
  $("#barStatusText").textContent = text;
}

export function initCompleteness() {
  const pill = $("#barStatus");
  if (!pill) return;
  pill.addEventListener("click", () => {
    if (!showProblems()) $("#addRow")?.focus();
  });
  document.addEventListener(draftChangeEvent, render);
  document.addEventListener(localeChangeEvent, render);
  render();
}
