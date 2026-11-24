import { $, ibanClean } from "../utils.js";
import { validIBAN } from "../invoice/model.js";
import { draftChangeEvent } from "./draft-form.js";
import { localeChangeEvent, tr } from "./i18n.js";

/** Groups an IBAN in blocks of four, the way it is printed on bank statements. */
export function formatIban(value) {
  return ibanClean(value)
    .replace(/[^A-Z0-9]/g, "")
    .replace(/(.{4})(?=.)/g, "$1 ");
}

/** Describes what is wrong with an entered IBAN, or returns "" if it is fine. */
export function ibanProblem(value, paymentType) {
  const iban = ibanClean(value);
  if (!iban || paymentType === "10" || validIBAN(iban)) return "";
  return tr(
    "Die IBAN ist ungültig. Bitte Ziffern und Prüfsumme kontrollieren.",
    "This IBAN is not valid. Check the digits and the checksum.",
  );
}

export function initIbanField() {
  const field = $("#iban");
  const message = $("#ibanError");
  if (!field || !message) return;

  function check() {
    const problem = ibanProblem(field.value, $("#payType").value);
    field.setCustomValidity(problem);
    if (problem) field.setAttribute("aria-invalid", "true");
    else if (!field.matches(":invalid")) field.removeAttribute("aria-invalid");
    message.textContent = problem;
    message.hidden = !problem;
  }

  function tidy() {
    const formatted = formatIban(field.value);
    if (formatted !== field.value) field.value = formatted;
    check();
  }

  // While someone is typing, a half-finished IBAN is not an error yet.
  field.addEventListener("input", () => {
    field.setCustomValidity("");
    message.hidden = true;
  });
  field.addEventListener("blur", tidy);
  // Loaded drafts and company profiles arrive without any typing.
  const update = () => {
    if (document.activeElement !== field) tidy();
  };
  document.addEventListener(draftChangeEvent, update);
  document.addEventListener(localeChangeEvent, update);
  update();
}
