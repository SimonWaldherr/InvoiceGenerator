import { isCompany, isContact } from "./import-data.js";
import { recordLabel } from "./master-records.js";
import { tr } from "./i18n.js";
import { storageKeys } from "./storage.js";

export const masterCollections = {
  companies: { key: storageKeys.companies, accepts: isCompany },
  contacts: { key: storageKeys.contacts, accepts: isContact },
};

function requireRecords(records, kind) {
  const { accepts } = masterCollections[kind];
  if (
    !Array.isArray(records) ||
    !records.every((record) => accepts(record) && record.name.trim())
  ) {
    throw new Error(
      tr(
        "Die Stammdatenliste enthält ungültige Einträge.",
        "The master data list contains invalid records.",
      ),
    );
  }
  return records;
}

export function masterDataFile(kind, records) {
  return { format: "invoicegenerator-master-data", version: 1, kind, records };
}

export function readMasterDataFile(kind, file) {
  if (
    file?.format !== "invoicegenerator-master-data" ||
    file.version !== 1 ||
    file.kind !== kind
  ) {
    throw new Error(
      tr(
        "Dateiformat oder Stammdatenart stimmt nicht. Bitte die passende JSON-Sicherung wählen.",
        "The file format or record type does not match. Choose the matching JSON backup.",
      ),
    );
  }
  return requireRecords(file.records, kind);
}

export function storedMasterData(kind, raw) {
  return raw === null ? [] : requireRecords(JSON.parse(raw), kind);
}

function normalized(value) {
  return String(value ?? "")
    .trim()
    .normalize("NFC")
    .toLowerCase();
}

function identity(kind, record) {
  if (kind === "companies") return normalized(recordLabel(record));
  const reference = normalized(record.buyerRef);
  return reference
    ? JSON.stringify([normalized(record.name), reference])
    : addressKey(record);
}

function addressKey(record) {
  return JSON.stringify(
    [
      record.name,
      record.country ?? "DE",
      record.zip,
      record.city,
      record.street,
    ].map(normalized),
  );
}

function comparable(record) {
  return Object.fromEntries(
    Object.keys(record)
      .sort()
      .flatMap((key) => {
        const value = record[key];
        if (value == null || value === "") return [];
        if (typeof value !== "object") return [[key, value]];
        const nested = comparable(value);
        return Object.keys(nested).length ? [[key, nested]] : [];
      }),
  );
}

function fingerprint(kind, record) {
  const { label, ...fields } = { ...record, country: record.country ?? "DE" };
  if (kind === "contacts") fields.label = label;
  else if (label?.trim() && label.trim() !== record.name) {
    fields.label = label.trim();
  }
  return JSON.stringify(comparable(fields));
}

export function planMasterImport(kind, current, incoming) {
  const group = (records) => {
    const groups = new Map();
    for (const record of records) {
      const id = identity(kind, record);
      if (!groups.has(id)) groups.set(id, new Map());
      groups.get(id).set(fingerprint(kind, record), record);
    }
    return groups;
  };
  const existing = group(current);
  const batch = group(incoming);
  const referencedAddresses = new Set();
  const unreferencedAddresses = new Set();
  if (kind === "contacts") {
    for (const records of [current, incoming]) {
      for (const record of records) {
        (normalized(record.buyerRef)
          ? referencedAddresses
          : unreferencedAddresses
        ).add(addressKey(record));
      }
    }
  }
  const plan = { additions: [], duplicates: incoming.length, conflicts: [] };
  for (const [id, variants] of batch) {
    const previous = existing.get(id);
    const first = variants.values().next().value;
    const addressConflict =
      kind === "contacts" &&
      [...variants.values()].some((record) =>
        (normalized(record.buyerRef)
          ? unreferencedAddresses
          : referencedAddresses
        ).has(addressKey(record)),
      );
    if (variants.size === 1 && !previous && !addressConflict) {
      plan.additions.push(first);
      plan.duplicates--;
      continue;
    }
    for (const [content, record] of variants) {
      if (previous?.has(content)) continue;
      plan.conflicts.push(record);
      plan.duplicates--;
    }
  }
  return plan;
}
