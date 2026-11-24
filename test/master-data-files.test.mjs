import assert from "node:assert/strict";
import { test } from "node:test";
import {
  masterDataFile,
  planMasterImport,
  readMasterDataFile,
  storedMasterData,
} from "../src/ui/master-data-files.js";

test("round-trips each backup type and rejects wrong types or invalid records", () => {
  for (const kind of ["companies", "contacts"]) {
    const records = [{ name: "Muster AG" }];
    const json = JSON.parse(JSON.stringify(masterDataFile(kind, records)));
    assert.deepEqual(readMasterDataFile(kind, json), records);
    assert.throws(() =>
      readMasterDataFile(kind === "companies" ? "contacts" : "companies", json),
    );
    assert.throws(() =>
      readMasterDataFile(kind, { ...json, records: [{ name: "" }] }),
    );
    assert.throws(() => storedMasterData(kind, "{}"));
    assert.deepEqual(storedMasterData(kind, null), []);
  }
});

test("retains company data and skips contradictory variants within the same file", () => {
  const local = {
    name: "Muster AG",
    label: "Berlin",
    payment: { iban: "OLD", terms: "Netto" },
  };
  const same = {
    payment: { terms: "Netto", iban: "OLD" },
    label: "Berlin",
    name: "Muster AG",
    country: "DE",
  };
  const changed = { ...same, label: " berlin ", payment: { iban: "NEW" } };
  const newProfile = { name: "Muster AG", label: "Bonn" };
  const ambiguous = [
    { name: "Köln", city: "Köln" },
    { name: "Köln", city: "Berlin" },
  ];
  const plan = planMasterImport(
    "companies",
    [local],
    [same, changed, newProfile, newProfile, ...ambiguous],
  );
  assert.deepEqual(plan, {
    additions: [newProfile],
    duplicates: 2,
    conflicts: [changed, ...ambiguous],
  });
  assert.equal(local.payment.iban, "OLD");
});

test("keeps separate buyer branches and recognises a conflicting fixed reference", () => {
  const buyer = {
    name: "Universität",
    city: "München",
    buyerRef: "1234-A",
    email: "old@example.com",
  };
  const changed = { ...buyer, email: "new@example.com" };
  const otherDepartment = { ...changed, buyerRef: "1234-B" };
  const legacy = { name: "Andere", city: "Berlin", street: "Test 1" };
  const sameAddress = { ...legacy, country: "DE", buyerRef: "" };
  assert.deepEqual(
    planMasterImport(
      "contacts",
      [buyer, legacy],
      [buyer, changed, otherDepartment, sameAddress],
    ),
    {
      additions: [otherDepartment],
      duplicates: 2,
      conflicts: [changed],
    },
  );
  const upgradedLegacy = { ...legacy, buyerRef: "1234-C" };
  assert.deepEqual(
    planMasterImport("contacts", [legacy], [upgradedLegacy]).conflicts,
    [upgradedLegacy],
  );
});
