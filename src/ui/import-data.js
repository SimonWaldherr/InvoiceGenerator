import { supportedLogo } from "../invoice/draft.js";
import { tr } from "./i18n.js";
import { storageKeys } from "./storage.js";
import { isSettings } from "./settings-data.js";

const MiB = 1024 * 1024;
export const maxDraftLines = 5000;
const draftSections = [
  "header",
  "seller",
  "buyer",
  "payment",
  "lines",
  "items",
  "meta",
];

export function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function readJsonFile(file, limitMiB) {
  if (file.size > limitMiB * MiB) {
    throw new Error(
      tr(
        `Die Datei ist größer als ${limitMiB} MiB.`,
        `The file exceeds ${limitMiB} MiB.`,
      ),
    );
  }
  try {
    return JSON.parse((await file.text()).replace(/^\uFEFF/, ""));
  } catch {
    throw new Error(
      tr("Keine lesbare JSON-Datei.", "Unable to read the JSON file."),
    );
  }
}

function isScalar(value) {
  return (
    value == null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    Number.isFinite(value)
  );
}

function scalarFields(value, excluded = []) {
  return (
    isRecord(value) &&
    Object.entries(value).every(
      ([key, field]) => excluded.includes(key) || isScalar(field),
    )
  );
}

function validateDraft(draft, { requireContent, limitLines }) {
  const invalid = () =>
    new Error(tr("Ungültige Entwurfsdaten.", "Invalid draft data."));
  if (
    !isRecord(draft) ||
    (requireContent &&
      !draftSections.some((key) =>
        Object.prototype.hasOwnProperty.call(draft, key),
      ))
  ) {
    throw invalid();
  }
  for (const key of ["header", "seller", "buyer", "payment"]) {
    if (draft[key] != null && !scalarFields(draft[key])) throw invalid();
  }
  const meta = draft.meta;
  if (
    meta != null &&
    (!scalarFields(meta, ["logo", "pdf"]) ||
      (meta.pdf != null && !scalarFields(meta.pdf)))
  )
    throw invalid();
  const usesLegacyItems = draft.lines == null && draft.items != null;
  const lines = usesLegacyItems ? draft.items : draft.lines;
  if (lines != null && !Array.isArray(lines)) throw invalid();
  if (limitLines && lines?.length > maxDraftLines) {
    throw new Error(
      tr(
        `Ein Entwurf darf höchstens ${maxDraftLines} Positionen enthalten.`,
        `A draft can contain up to ${maxDraftLines} line items.`,
      ),
    );
  }
  if (lines?.some((line) => !scalarFields(line))) throw invalid();
  return usesLegacyItems;
}

export function normalizeDraft(draft, { requireContent = false } = {}) {
  const usesLegacyItems = validateDraft(draft, {
    requireContent,
    limitLines: true,
  });
  const { meta } = draft;

  // Retain the invoice even if it came with a logo that this version cannot open.
  const normalizedMeta =
    meta?.logo && !supportedLogo(meta.logo) ? { ...meta, logo: null } : meta;
  if (!usesLegacyItems) {
    return normalizedMeta === meta ? draft : { ...draft, meta: normalizedMeta };
  }
  const { items, ...currentDraft } = draft;
  return {
    ...currentDraft,
    meta: normalizedMeta,
    header: {
      ...draft.header,
      number: draft.header?.number ?? draft.header?.invnum,
      date: draft.header?.date ?? draft.header?.invdate,
      dueDate: draft.header?.dueDate ?? draft.header?.duedate,
    },
    payment: {
      ...draft.payment,
      terms: draft.payment?.terms ?? draft.payment?.paymentText,
    },
    lines: items.map((line) => ({
      pos: line.pos,
      name: line.name ?? line.desc,
      desc: line.name === undefined ? "" : line.desc,
      qty: parseLegacyNumber(line.qty),
      price: parseLegacyNumber(line.price ?? line.rate),
      unit: line.unit,
      rate: parseLegacyNumber(line.vatrate),
      cat: line.vatcat || "S",
    })),
  };
}

export function copyDraftForNewInvoice(draft) {
  return {
    ...draft,
    header: {
      ...draft.header,
      number: "",
      date: "",
      dueDate: "",
      supplyDate: "",
      orderRef: "",
    },
    payment: { ...draft.payment, remittance: "" },
  };
}

function parseLegacyNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function isNamedRecord(value) {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    !/[\ud800-\udfff]/u.test(value.name)
  );
}

function templateDraft(template) {
  if (!isNamedRecord(template) || !template.name.trim()) {
    throw new Error(
      tr("Eine Vorlage benötigt einen Namen.", "A template needs a name."),
    );
  }
  return template.snapshot ?? template;
}

export function normalizeTemplate(template) {
  const snapshot = normalizeDraft(templateDraft(template), {
    requireContent: true,
  });
  return { name: template.name, ts: template.ts, snapshot };
}

export function normalizeTemplates(templates) {
  if (!Array.isArray(templates)) {
    throw new Error(
      tr(
        "Die Datei enthält keine Vorlagenliste.",
        "The file contains no template list.",
      ),
    );
  }
  return templates.map(normalizeTemplate);
}

export function isContact(contact) {
  return isNamedRecord(contact) && scalarFields(contact) &&
    (contact.buyerRef == null || typeof contact.buyerRef === "string");
}

export function isCompany(company) {
  return (
    isNamedRecord(company) &&
    (company.label == null || (typeof company.label === "string" && !/[\ud800-\udfff]/u.test(company.label))) &&
    scalarFields(company, ["payment"]) &&
    (company.payment == null || scalarFields(company.payment))
  );
}

export function isHistoryEntry(entry) {
  return scalarFields(entry, ["snapshot"]) && isRecord(entry.snapshot);
}

export function isDefaults(value) {
  return (
    scalarFields(value, ["seller", "payment"]) &&
    (value.seller == null || scalarFields(value.seller)) &&
    (value.payment == null || scalarFields(value.payment))
  );
}

function isArchivedLogo(value) {
  return (
    value == null ||
    (scalarFields(value) &&
      typeof value.dataUrl === "string" &&
      /^data:image\/(?:png|jpe?g);base64,[a-z0-9+/]+={0,2}$/i.test(
        value.dataUrl,
      ))
  );
}

export function backupEntries(backup) {
  const invalid = () =>
    new Error(
      tr(
        "Ungültige Daten in der Sicherung.",
        "The backup contains invalid data.",
      ),
    );
  if (backup?.version !== 1 || !isRecord(backup.data)) {
    throw new Error(
      tr("Unbekanntes Sicherungsformat.", "Unknown backup format."),
    );
  }
  const validators = {
    [storageKeys.contacts]: (values) =>
      Array.isArray(values) && values.every(isContact),
    [storageKeys.companies]: (values) =>
      Array.isArray(values) && values.every(isCompany),
    [storageKeys.history]: (values) =>
      Array.isArray(values) && values.every(isHistoryEntry),
    [storageKeys.templates]: Array.isArray,
    [storageKeys.defaults]: (value) => value === null || isDefaults(value),
    [storageKeys.settings]: (value) => value === null || isSettings(value),
    [storageKeys.logo]: isArchivedLogo,
    [storageKeys.lastNr]: (value) =>
      value === null || typeof value === "string",
    [storageKeys.unit]: (value) => value === null || typeof value === "string",
  };
  const entries = [];
  for (const key of Object.values(storageKeys)) {
    if (!Object.prototype.hasOwnProperty.call(backup.data, key)) continue;
    const value = backup.data[key];
    if (!validators[key](value)) throw invalid();
    if (key === storageKeys.history || key === storageKeys.templates) {
      for (const entry of value) {
        const draft =
          key === storageKeys.history ? entry.snapshot : templateDraft(entry);
        validateDraft(draft, { requireContent: true, limitLines: false });
        if (!isArchivedLogo(draft.meta?.logo)) throw invalid();
      }
    }
    entries.push([key, value]);
  }
  if (!entries.length) throw invalid();
  return entries;
}
