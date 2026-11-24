import assert from "node:assert/strict";
import { test } from "node:test";
import { isSettings, settingsDefaults } from "../src/ui/settings-data.js";
import { newDraftDefaults } from "../src/ui/settings.js";
import { storageKeys } from "../src/ui/storage.js";

function useStorage(t, values) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem(key) {
        return Object.hasOwn(values, key) ? JSON.stringify(values[key]) : null;
      },
    },
  });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else delete globalThis.localStorage;
  });
}

test("validates complete settings and compatible profile, syntax and payment options", () => {
  assert.equal(isSettings(settingsDefaults), true);
  assert.equal(isSettings({ ...settingsDefaults, syntax: "UBL" }), false);
  assert.equal(
    isSettings({ ...settingsDefaults, profile: "XRECHNUNG", syntax: "UBL" }),
    true,
  );
  assert.equal(
    isSettings({ ...settingsDefaults, currency: "CHF", paymentType: "58" }),
    false,
  );
  assert.equal(isSettings({ ...settingsDefaults, company: {} }), false);
  assert.equal(isSettings({ profile: "EN16931" }), false);
});

test("prefills a new draft from a company and applies explicit payment overrides", (t) => {
  useStorage(t, {
    [storageKeys.settings]: {
      ...settingsDefaults,
      profile: "XRECHNUNG",
      syntax: "UBL",
      currency: "CHF",
      company: "Beispiel Büro",
      paymentType: "10",
      paymentTerms: "Zahlbar bei Abholung",
      businessProcess: "urn:test:business-process",
    },
    [storageKeys.companies]: [
      {
        name: "Beispiel Büro",
        city: "Zürich",
        defaultTemplate: "Alte Vorlage",
        autoApplyTemplate: true,
        payment: {
          type: "58",
          terms: "30 Tage netto",
          iban: "CH9300762011623852957",
          holder: "Beispiel Büro",
          remittance: "Alte Rechnung",
        },
      },
    ],
  });
  assert.deepEqual(newDraftDefaults(), {
    header: {
      profile: "XRECHNUNG",
      syntax: "UBL",
      currency: "CHF",
      businessProcess: "urn:test:business-process",
    },
    seller: { name: "Beispiel Büro", city: "Zürich" },
    payment: {
      type: "10",
      iban: "CH9300762011623852957",
      bic: "",
      holder: "Beispiel Büro",
      terms: "Zahlbar bei Abholung",
    },
  });
});

test("uses payment terms from the selected company and falls back to transfer for non-EUR drafts", (t) => {
  useStorage(t, {
    [storageKeys.settings]: {
      ...settingsDefaults,
      currency: "USD",
      company: "Firma 1",
    },
    [storageKeys.companies]: [
      { name: "Firma 1", payment: { type: "58", terms: "14 Tage netto" } },
    ],
  });
  assert.equal(newDraftDefaults().payment.type, "30");
  assert.equal(newDraftDefaults().payment.terms, "14 Tage netto");
});

test("falls back safely after a company is removed without applying manual legacy defaults", (t) => {
  const values = {
    [storageKeys.settings]: { ...settingsDefaults, company: "Entfernt" },
    [storageKeys.defaults]: {
      seller: { name: "Manueller Standard" },
      currency: "CHF",
    },
  };
  useStorage(t, values);
  assert.deepEqual(newDraftDefaults().seller, {});
  assert.equal(newDraftDefaults().header.currency, "EUR");
  assert.equal(newDraftDefaults().payment.type, "58");
  values[storageKeys.settings] = { ...settingsDefaults, syntax: "UBL" };
  assert.equal(newDraftDefaults().header.syntax, "CII");
});
