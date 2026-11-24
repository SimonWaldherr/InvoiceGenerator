import {
  readStored,
  readStoredList,
  replaceStored,
  storageKeys,
} from "./storage.js";
import { isCompany } from "./import-data.js";
import { isSettings } from "./settings-data.js";
import { recordLabel, sameRecord } from "./master-records.js";
import { tr } from "./i18n.js";

export function getCompanies() {
  return readStoredList(storageKeys.companies, isCompany);
}

export function companySeller(company) {
  const { payment, label, defaultTemplate, autoApplyTemplate, ...seller } =
    company ?? {};
  return seller;
}

export function companyPayment(company, currency, overrides = {}) {
  const saved = company?.payment;
  const type = overrides.type || saved?.type;
  return {
    type: ["10", "30"].includes(type) ? type : currency === "EUR" ? "58" : "30",
    iban: saved?.iban ?? "",
    bic: saved?.bic ?? "",
    holder: saved?.holder ?? "",
    terms: overrides.terms || saved?.terms || "",
  };
}

export function changeCompany(previous, company) {
  const list = getCompanies();
  const index = previous
    ? list.findIndex((record) => sameRecord(record, previous))
    : -1;
  if (previous && index < 0) {
    throw new Error(
      tr(
        "Das Firmenprofil wurde inzwischen geändert.",
        "The company profile has changed.",
      ),
    );
  }
  const key = company ? recordLabel(company) : "";
  const oldKey = previous ? recordLabel(previous) : "";
  if (company && (!isCompany(company) || !key.trim())) {
    throw new Error(
      tr(
        "Bitte Profilbezeichnung und Firmennamen prüfen.",
        "Check the profile label and legal name.",
      ),
    );
  }
  if (
    company &&
    list.some((record, i) => i !== index && recordLabel(record) === key)
  ) {
    throw new Error(
      tr(
        "Diese Profilbezeichnung ist bereits vergeben.",
        "This profile label is already in use.",
      ),
    );
  }
  if (index < 0) list.push(company);
  else if (company) list[index] = company;
  else list.splice(index, 1);

  const entries = [[storageKeys.companies, list]];
  const settings = readStored(storageKeys.settings, null);
  if (
    previous &&
    oldKey !== key &&
    isSettings(settings) &&
    settings.company === oldKey &&
    !list.some((record) => recordLabel(record) === oldKey)
  ) {
    entries.push([storageKeys.settings, { ...settings, company: key }]);
  }
  replaceStored(entries);
}
