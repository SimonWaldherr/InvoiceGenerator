import assert from "node:assert/strict";
import { test } from "node:test";
import { validate } from "../src/ui/draft-form.js";
import { readParty, writeParty } from "../src/ui/invoice-fields.js";
import { readLineAmounts } from "../src/ui/line-items.js";

test("keeps a country deliberately cleared in the UI and defaults missing legacy countries", (t) => {
  const fields = {
    "#sellerCountry": { value: "DE" },
    "#buyerCountry": { value: "DE" },
  };
  Object.defineProperty(globalThis, "document", {
    value: { querySelector: (selector) => fields[selector] },
    configurable: true,
  });
  t.after(() => delete globalThis.document);
  for (const [side, field] of [
    ["seller", "sellerCountry"],
    ["buyer", "buyerCountry"],
  ]) {
    writeParty(side, { country: "" });
    assert.equal(fields["#" + field].value, "");
    assert.equal(readParty(side).country, "");
    writeParty(side, {});
    assert.equal(readParty(side).country, "DE");
    writeParty(side, { country: null });
    assert.equal(readParty(side).country, "DE");
  }
});

test("malformed number input for a discount cannot be treated as an omitted discount", () => {
  const fields = {
    ".pos": { value: "1" },
    ".name": { value: "Dienstleistung" },
    ".desc": { value: "" },
    ".qty": { valueAsNumber: 1 },
    ".unit": { value: "HUR" },
    ".price": { valueAsNumber: 25 },
    ".vatcat": { value: "S" },
    ".vatrate": { valueAsNumber: 19 },
    ".disc": { value: "", valueAsNumber: NaN, validity: { badInput: true } },
  };
  const readAmounts = () =>
    readLineAmounts([{ querySelector: (selector) => fields[selector] }]);
  const draft = {
    header: { number: "R-1", date: "2026-01-01", currency: "EUR" },
    seller: { name: "Verkäufer", country: "DE" },
    buyer: { name: "Käufer", country: "DE" },
    lines: readAmounts().lines,
  };
  assert(Number.isNaN(draft.lines[0].disc));
  assert.match(validate(draft).join(", "), /Rabatt/);
  assert.equal(readAmounts().totals.gross, null);

  fields[".disc"].validity.badInput = false;
  draft.lines = readAmounts().lines;
  assert.equal(draft.lines[0].disc, 0);
  assert.deepEqual(validate(draft), []);
});
