import { tr } from "./i18n.js";

const invalidSelector =
  ":is([data-invoice-fields], #items) :is(input, select, textarea):invalid";

function labelText(field) {
  const label = field.id
    ? document.querySelector(`label[for="${CSS.escape(field.id)}"]`)
    : null;
  const text = label?.textContent ?? field.getAttribute("aria-label") ?? "";
  return text.replace(/\s*\*\s*$/, "").trim();
}

function describeField(field) {
  const row = field.closest("#items tbody tr");
  if (row) {
    const position = Array.from(row.parentElement.rows).indexOf(row) + 1;
    return tr("Pos. ", "Line ") + position + " – " + labelText(field);
  }
  const heading = field
    .closest("[data-label-prefix]")
    ?.querySelector(":scope > h2");
  return heading
    ? heading.textContent.trim() + " – " + labelText(field)
    : labelText(field);
}

export function revealRequiredDetails(selector = ".form-details") {
  for (const group of document.querySelectorAll(selector)) {
    if (group.querySelector(":invalid")) group.open = true;
  }
}

export function invalidFields() {
  return Array.from(document.querySelectorAll(invalidSelector));
}

export function fieldProblems() {
  return invalidFields().map((field) => ({
    field,
    label: describeField(field),
  }));
}

export function focusField(field) {
  for (
    let group = field.closest("details");
    group;
    group = group.parentElement?.closest("details")
  ) {
    group.open = true;
  }
  field.focus();
}

function markField(field) {
  if (field.matches(":invalid")) field.setAttribute("aria-invalid", "true");
  else field.removeAttribute("aria-invalid");
}

/** Highlights every field that currently fails its constraints. */
export function markValidation() {
  document.body.dataset.validated = "true";
  for (const field of document.querySelectorAll("[aria-invalid='true']")) {
    markField(field);
  }
  for (const field of invalidFields()) markField(field);
}

export function clearValidation() {
  delete document.body.dataset.validated;
  for (const field of document.querySelectorAll("[aria-invalid]")) {
    field.removeAttribute("aria-invalid");
  }
}

/**
 * Opens collapsed sections that hide problems, highlights the affected fields
 * and moves the focus to the first one.
 */
export function showProblems({ focus = true } = {}) {
  revealRequiredDetails();
  markValidation();
  const [first] = invalidFields();
  if (focus && first) focusField(first);
  return first ?? null;
}

export function initValidation() {
  const recheck = (event) => {
    const field = event.target;
    if (
      document.body.dataset.validated &&
      field instanceof HTMLElement &&
      field.matches("input, select, textarea")
    )
      if (field.id === "profile" || field.id === "payType") markValidation();
      else markField(field);
  };
  document.addEventListener("input", recheck);
  document.addEventListener("change", recheck);
}
