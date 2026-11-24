import { tr } from "./i18n.js";
import { notify } from "./notify.js";

export const storageKeys = {
  defaults: "invgen_defaults",
  settings: "invgen_settings",
  contacts: "invgen_contacts",
  history: "invgen_history",
  lastNr: "invgen_lastNr",
  logo: "invgen_logo",
  unit: "invgen_unit",
  companies: "invgen_companies",
  templates: "invgen_templates",
};

export function readStored(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    const value = raw === null ? fallback : JSON.parse(raw);
    if (
      value == null ||
      (typeof fallback === "string" && typeof value !== "string")
    )
      return fallback;
    return value;
  } catch {
    return fallback;
  }
}

export function readStoredList(key, accepts) {
  const values = readStored(key, []);
  return Array.isArray(values) ? values.filter(accepts) : [];
}

export function writeStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    notify(
      tr(
        "Lokaler Speicher voll oder gesperrt.",
        "Local storage is full or unavailable.",
      ),
      { error: true },
    );
    return false;
  }
}
export function removeStored(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    notify(tr("Lokaler Speicher gesperrt.", "Local storage is unavailable."), {
      error: true,
    });
    return false;
  }
}

function setStoredRaw(store, key, value) {
  if (value === null) store.removeItem(key);
  else store.setItem(key, value);
}

export function replaceStored(entries, store = localStorage) {
  const operations = entries.map(([key, value]) => ({
    key,
    previous: store.getItem(key),
    next: value === undefined ? null : JSON.stringify(value),
  }));
  const growth = ({ previous, next }) =>
    (next?.length ?? 0) - (previous?.length ?? 0);
  operations.sort((left, right) => growth(left) - growth(right));

  let written = 0;
  try {
    for (const { key, next } of operations) {
      setStoredRaw(store, key, next);
      written++;
    }
  } catch (error) {
    let restored = true;
    while (written > 0) {
      const { key, previous } = operations[--written];
      try {
        setStoredRaw(store, key, previous);
      } catch {
        restored = false;
      }
    }
    if (!restored) {
      throw new Error(
        tr(
          "Der vorherige Speicherstand konnte nicht vollständig wiederhergestellt werden.",
          "The previous local storage state could not be fully restored.",
        ),
      );
    }
    throw error;
  }
}
