import { $, clamp, nextInvoiceNumber, today } from "../utils.js";
import {
  initInvoiceFields,
  readField,
  readParty,
  readPayment,
  restoreSelection,
  writeField,
  writeParty,
  writeBankDetails,
} from "./invoice-fields.js";
import {
  getUnitDefault,
  initLineItems,
  readLineAmounts,
  renderLineTotals,
  replaceLines,
  setUnitDefault,
} from "./line-items.js";
import { getLogo, getSavedLogo, initLogo, setLogo } from "./logo.js";
import { readStored, storageKeys } from "./storage.js";
import { createExampleDraft } from "./example-draft.js";
import { normalizeDraft } from "./import-data.js";
import { tr } from "./i18n.js";
import { newDraftDefaults } from "./settings.js";
import { clearValidation, revealRequiredDetails } from "./validation-ui.js";

export { revealRequiredDetails };
export const draftChangeEvent = "invoice-draft-updated";
export const draftSavedEvent = "invoice-draft-saved";
let cleanDraft = "";
let cleanSampleFields = "";
let lastRequirementState;

const xrechnungRequiredFields = [
  "buyerRef",
  "businessProcess",
  "sellerContactName",
  "sellerEmail",
  "sellerPhone",
  "sellerEndpointId",
  "sellerEndpointScheme",
  "buyerEndpointId",
  "buyerEndpointScheme",
];

const pdfFields = {
  layout: ["pdfLayout", "classic"],
  colorScheme: ["colorScheme", "default"],
  accentColor: ["accentColor", "#0066cc"],
  language: ["pdfLanguage", "de"],
  fontFamily: ["fontFamily", "helvetica"],
  logoPos: ["logoPos", "right"],
  logoWidth: ["logoWidth", 140, 40, 400],
  tableFontSize: ["tableFontSize", 10, 8, 14],
  headerFontSize: ["headerFontSize", 16, 12, 20],
  tableStyle: ["tableStyle", "simple"],
  pageMargin: ["pageMargin", 40, 20, 60],
  lineHeight: ["lineHeight", 14, 10, 20],
};

function collectPdfOptions() {
  const pdf = {};
  for (const [key, [id, fallback, min, max]] of Object.entries(pdfFields)) {
    const value = $("#" + id)?.value;
    pdf[key] =
      typeof fallback === "number"
        ? clamp(parseInt(value, 10) || fallback, min, max)
        : value || fallback;
  }
  pdf.logoAllPages = $("#logoAllPages")?.checked || false;
  pdf.compactTable =
    $("#pdfCompactTable")?.checked || $("#pdfMobileOptimize")?.checked || false;
  return pdf;
}

function restorePdfOptions(pdf) {
  for (const [key, [id, fallback]] of Object.entries(pdfFields)) {
    if (id === "pdfLanguage")
      writeField(id, pdf[key] === "en" ? "en" : fallback);
    else writeField(id, pdf[key] || fallback);
  }
  for (const [id, value] of [
    ["logoAllPages", pdf.logoAllPages],
    ["pdfCompactTable", pdf.compactTable],
    ["pdfMobileOptimize", pdf.compactTable],
  ]) {
    const field = $("#" + id);
    if (field) field.checked = Boolean(value);
  }
}

export function collect() {
  const profile = $("#profile").value;
  const header = {
    profile,
    syntax: profile === "XRECHNUNG" ? readField("syntax") || "CII" : "CII",
    businessProcess: readField("businessProcess"),
    number: readField("invNumber"),
    date: $("#invDate").value,
    dueDate: $("#dueDate").value,
    orderRef: $("#orderRef").value,
    buyerRef: $("#buyerRef").value,
    supplyDate: $("#supplyDate").value,
    notes: $("#notes").value,
    currency: $("#currency").value,
  };
  return {
    header,
    seller: readParty("seller"),
    buyer: readParty("buyer"),
    payment: readPayment(),
    ...readLineAmounts(),
    meta: {
      logo: getLogo(),
      unitDefault: getUnitDefault(),
      pdf: collectPdfOptions(),
    },
  };
}

export function populate(draft) {
  draft = normalizeDraft(draft);
  clearValidation();

  const { header = {}, seller, buyer, payment, meta } = draft;
  restoreSelection("profile", header?.profile, "EN16931");
  restoreSelection("syntax", header?.syntax, "CII");
  writeField("businessProcess", header?.businessProcess);
  writeField("invNumber", header?.number);
  writeField("invDate", header?.date || today());
  writeField("dueDate", header?.dueDate);
  writeField("currency", header?.currency || "EUR");
  writeField("orderRef", header?.orderRef);
  writeField("buyerRef", header?.buyerRef);
  writeField("supplyDate", header?.supplyDate);
  writeField("notes", header?.notes);
  writeParty("seller", seller || {});
  writeParty("buyer", buyer || {});
  restoreSelection("payType", payment?.type, "58");
  writeBankDetails(payment || {});
  writeField("remittance", payment?.remittance);
  setLogo(meta?.logo);
  if (meta?.unitDefault) setUnitDefault(meta.unitDefault);
  restorePdfOptions(meta?.pdf || {});
  replaceLines(draft.lines || []);
  recalc();
}

export function validate(draft) {
  const errors = [];
  if (!draft.header.number)
    errors.push(tr("Rechnungsnummer", "Invoice number"));
  if (!draft.header.date) errors.push(tr("Rechnungsdatum", "Invoice date"));
  if (!draft.header.currency) errors.push(tr("Währung", "Currency"));
  if (!draft.seller.name) errors.push(tr("Verkäufername", "Seller name"));
  if (!draft.seller.country) errors.push(tr("Verkäuferland", "Seller country"));
  if (!draft.buyer.name) errors.push(tr("Käufername", "Buyer name"));
  if (!draft.buyer.country) errors.push(tr("Käuferland", "Buyer country"));
  if (!draft.lines.length)
    errors.push(tr("Mindestens eine Position", "At least one line item"));
  draft.lines.forEach((line, index) => {
    const position = tr("Pos. ", "Line ") + (index + 1) + " – ";
    if (!line.name) errors.push(position + tr("Produktname", "Item name"));
    if (!(line.qty > 0)) errors.push(position + tr("Menge", "Quantity"));
    if (!(line.price >= 0)) errors.push(position + tr("Preis", "Price"));
    if (!Number.isFinite(line.rate))
      errors.push(position + tr("USt-Satz", "VAT rate"));
    const discount = line.disc ?? 0;
    if (!Number.isFinite(discount) || discount < 0 || discount > 100)
      errors.push(
        position + tr("Rabatt (0 bis 100 %)", "Discount (0 to 100%)"),
      );
    if (!line.unit) errors.push(position + tr("Einheit", "Unit"));
  });
  return errors;
}

export function notifyDraftChange() {
  const isXRechnung = $("#profile").value === "XRECHNUNG";
  const requiresIban = ["30", "58"].includes($("#payType").value);
  const profileChanged = lastRequirementState?.isXRechnung !== isXRechnung;
  if (profileChanged || lastRequirementState?.requiresIban !== requiresIban) {
    lastRequirementState = { isXRechnung, requiresIban };
    const syntax = $("#syntax");
    if (syntax) syntax.disabled = !isXRechnung;
    for (const [field, required] of [
      ...xrechnungRequiredFields.map((id) => [id, isXRechnung]),
      ["iban", requiresIban],
    ]) {
      const input = document.getElementById(field);
      if (input) input.required = required;
      document
        .querySelector(`label[for="${field}"]`)
        ?.classList.toggle("conditionally-required", required);
    }
    if (profileChanged && isXRechnung) {
      revealRequiredDetails("[data-xrechnung-fields]");
    }
  }
  document.dispatchEvent(new Event(draftChangeEvent));
}

export function recalc() {
  renderLineTotals();
  notifyDraftChange();
}

function sampleFieldsSignature(snapshot) {
  const {
    header: { profile, syntax, ...header },
    ...draft
  } = snapshot;
  return JSON.stringify({ header, ...draft });
}

function confirmReplacingDraft(message) {
  return JSON.stringify(collect()) === cleanDraft || confirm(message);
}

export function markDraftSaved() {
  const snapshot = collect();
  cleanDraft = JSON.stringify(snapshot);
  cleanSampleFields = sampleFieldsSignature(snapshot);
  document.dispatchEvent(new Event(draftSavedEvent));
}

/** True while the form differs from the last saved or opened state. */
export function hasUnsavedChanges() {
  return JSON.stringify(collect()) !== cleanDraft;
}

export function openDraft(draft, { asCopy = false } = {}) {
  if (
    !confirmReplacingDraft(
      tr(
        "Änderungen am aktuellen Entwurf verwerfen?",
        "Discard changes to the current draft?",
      ),
    )
  )
    return false;
  populate(draft);
  if (!asCopy) markDraftSaved();
  return true;
}

export function resetDraft() {
  populate({ ...newDraftDefaults(), meta: { logo: getSavedLogo() } });
  markDraftSaved();
}

export function initDraftForm() {
  setUnitDefault(readStored(storageKeys.unit, "C62"));
  initLineItems(recalc);
  initInvoiceFields();
  initLogo(notifyDraftChange);
  resetDraft();
  const lastNumber = readStored(storageKeys.lastNr, "");
  if (lastNumber) {
    $("#invNumber").value = nextInvoiceNumber(lastNumber);
    recalc();
    markDraftSaved();
  }
  document.addEventListener("input", (event) => {
    const field = event.target;
    if (
      !(field instanceof HTMLElement) ||
      !field.matches("input, select, textarea") ||
      !field.closest("[data-invoice-fields]") ||
      field.closest("[data-master-data]") ||
      field.type === "file" ||
      field.closest("#items")
    )
      return;
    if (field.id === "currency") recalc();
    else notifyDraftChange();
  });
  // Drafts only live in this page until they are saved to the history.
  window.addEventListener("beforeunload", (event) => {
    if (!hasUnsavedChanges()) return;
    event.preventDefault();
    event.returnValue = "";
  });
  $("#btnSample").onclick = () => {
    const snapshot = collect();
    if (
      sampleFieldsSignature(snapshot) !== cleanSampleFields &&
      !confirm(
        tr(
          "Den aktuellen Entwurf durch Beispieldaten ersetzen?",
          "Replace the current draft with the example?",
        ),
      )
    )
      return;
    const { header, meta } = snapshot;
    populate({ ...createExampleDraft(header.profile, header.syntax), meta });
  };
  $("#btnReset").onclick = () => {
    if (
      confirmReplacingDraft(
        tr("Den aktuellen Entwurf zurücksetzen?", "Reset the current draft?"),
      )
    )
      resetDraft();
  };
}
