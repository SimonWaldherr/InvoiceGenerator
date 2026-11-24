import assert from "node:assert/strict";
import { test } from "node:test";
import {
  changeCompany,
  companyPayment,
  getCompanies,
} from "../src/ui/company-storage.js";
import { backupEntries } from "../src/ui/import-data.js";
import { masterRecordMatches, recordLabel } from "../src/ui/master-records.js";
import { settingsDefaults } from "../src/ui/settings-data.js";
import { newDraftDefaults } from "../src/ui/settings.js";
import { storageKeys } from "../src/ui/storage.js";

test("filters master data by label, address and buyer routing reference", () => {
  const contact = {
    name: "Müller GmbH",
    city: "München",
    buyerRef: "0204-12345",
  };
  assert.equal(recordLabel(contact), "Müller GmbH");
  assert.equal(masterRecordMatches(contact, "muller 12345 munchen"), true);
  assert.equal(masterRecordMatches(contact, "12346"), false);
  assert.equal(
    masterRecordMatches({ ...contact, label: "Vertrieb" }, "vertrieb muller"),
    true,
  );
});

test("updates a legacy company profile and its configured default together", (t) => {
  const legacy = {
    name: "Muster GmbH",
    city: "Bonn",
    payment: { type: "58", iban: "example" },
  };
  const settings = { ...settingsDefaults, company: legacy.name };
  const storage = new Map([
    [storageKeys.companies, JSON.stringify([legacy])],
    [storageKeys.settings, JSON.stringify(settings)],
  ]);
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
  });
  t.after(() => delete globalThis.localStorage);

  const named = { ...legacy, label: "Standort Bonn" };
  changeCompany(legacy, named);
  assert.equal(
    JSON.parse(storage.get(storageKeys.settings)).company,
    named.label,
  );
  assert.equal(newDraftDefaults().seller.name, legacy.name);
  assert.equal(newDraftDefaults().payment.iban, legacy.payment.iban);
  assert.throws(
    () => changeCompany(legacy, { ...legacy, city: "Köln" }),
    /inzwischen/,
  );
  assert.throws(() => changeCompany(undefined, named), /bereits vergeben/);
  const other = {
    ...named,
    label: "Standort Köln",
    city: "Köln",
    payment: null,
  };
  changeCompany(undefined, other);
  assert.deepEqual(getCompanies(), [named, other]);
  assert.deepEqual(companyPayment(other, "CHF"), {
    type: "30",
    iban: "",
    bic: "",
    holder: "",
    terms: "",
  });
  changeCompany(named);
  assert.deepEqual(getCompanies(), [other]);
  assert.equal(JSON.parse(storage.get(storageKeys.settings)).company, "");
});

test("restores legacy and current master data from the same backup format", () => {
  const contacts = [
    { name: "Alt" },
    { name: "Neu", buyerRef: "0204-12345", contactName: "Beispiel" },
  ];
  const companies = [{ name: "Alt" }, { name: "Neu", label: "Versand" }];
  assert.deepEqual(
    backupEntries({
      version: 1,
      data: {
        [storageKeys.contacts]: contacts,
        [storageKeys.companies]: companies,
      },
    }).length,
    2,
  );
  assert.throws(
    () =>
      backupEntries({
        version: 1,
        data: {
          [storageKeys.contacts]: [{ name: "Neu", buyerRef: 12345 }],
        },
      }),
    /Sicherung/,
  );
});
