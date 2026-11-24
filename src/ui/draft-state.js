import { $ } from "../utils.js";
import {
  draftChangeEvent,
  draftSavedEvent,
  hasUnsavedChanges,
} from "./draft-form.js";
import { localeChangeEvent, tr } from "./i18n.js";

function render() {
  const hint = $("#draftState");
  if (!hint) return;
  const unsaved = hasUnsavedChanges();
  hint.hidden = !unsaved;
  hint.textContent = unsaved
    ? tr("Ungespeicherte Änderungen", "Unsaved changes")
    : "";
}

export function initDraftState() {
  document.addEventListener(draftChangeEvent, render);
  document.addEventListener(draftSavedEvent, render);
  document.addEventListener(localeChangeEvent, render);
  render();
}
