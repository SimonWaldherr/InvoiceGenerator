import assert from "node:assert/strict";
import { test } from "node:test";
import { draftFromHistory, filterHistory, historyCsv, historySummary } from "../src/ui/history.js";

const savedDraft = {
  number: "R-100",
  date: "2026-11-24",
  buyer: "Müller Großhandel",
  gross: 42.5,
  currency: "EUR",
  snapshot: {
    header: {
      number: "R-100",
      date: "2026-11-24",
      dueDate: "2026-12-01",
      supplyDate: "2026-11-23",
      orderRef: "B-1",
      buyerRef: "ROUTING-42",
      profile: "XRECHNUNG",
      syntax: "UBL",
      currency: "EUR",
    },
    payment: { type: "58", iban: "DE00", remittance: "Zahlung R-100" },
    lines: [{ name: "Leistung", price: 42.5 }],
  },
};

test("finds history by invoice number and customer across old and new records", () => {
  const legacy = { snapshot: {
    header: { invnum: "R-200", invdate: "2026-04-01", currency: "CHF" },
    buyer: { name: "Alt AG" },
    totals: { gross: 100 },
  } };
  const entries = [savedDraft, legacy];
  assert.deepEqual(filterHistory(entries, "muller 100"), [savedDraft]);
  assert.deepEqual(filterHistory(entries, "grosshandel"), [savedDraft]);
  assert.deepEqual(filterHistory(entries, "  r-200   ALT  "), [legacy]);
  assert.deepEqual(filterHistory(entries, "absent"), []);
  assert.equal(filterHistory(entries, ""), entries);
  assert.equal(historySummary(legacy).currency, "CHF");
  assert.equal(historySummary(legacy).gross, 100);
});

test("copies a draft without reusing invoice and order references", () => {
  const original = JSON.stringify(savedDraft);
  const draft = draftFromHistory(savedDraft, true);
  assert.equal(draft.header.number, "");
  assert.equal(draft.header.date, "");
  assert.equal(draft.header.dueDate, "");
  assert.equal(draft.header.supplyDate, "");
  assert.equal(draft.header.orderRef, "");
  assert.equal(draft.payment.remittance, "");
  assert.equal(draft.header.buyerRef, "ROUTING-42");
  assert.equal(draft.payment.iban, "DE00");
  assert.deepEqual(draft.lines, savedDraft.snapshot.lines);
  assert.equal(JSON.stringify(savedDraft), original);
  assert.deepEqual(draftFromHistory(savedDraft), savedDraft.snapshot);
});

test("CSV contains all supplied history records and safely quotes customer text", () => {
  const other = { ...savedDraft, number: "R-200", buyer: ' + Partner, "AG"' };
  const lines = historyCsv([savedDraft, other]).split("\r\n");
  assert.equal(lines.length, 3);
  assert.match(lines[0], /^\uFEFF"Rechnungsnummer"/);
  assert.match(lines[1], /"R-100","2026-11-24","Müller Großhandel","42\.5","EUR","XRECHNUNG","UBL"/);
  assert.match(lines[2], /"R-200","2026-11-24","' \+ Partner, ""AG"""/);
  assert.match(historyCsv([{ ...savedDraft, buyer: "'t Huis" }]), /"'t Huis"/);
});
