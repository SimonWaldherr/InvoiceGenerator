import assert from "node:assert/strict";
import test from "node:test";
import { validIBAN } from "../src/invoice/model.js";
import { formatIban, ibanProblem } from "../src/ui/iban-field.js";

test("groups an IBAN in blocks of four and ignores case and separators", () => {
  assert.equal(formatIban("DE89370400440532013000"), "DE89 3704 0044 0532 0130 00");
  assert.equal(formatIban(" de89-3704 0044/0532 0130 00 "), "DE89 3704 0044 0532 0130 00");
  assert.equal(formatIban("DE89"), "DE89");
  assert.equal(formatIban("DE891"), "DE89 1");
  assert.equal(formatIban(""), "");
  assert.equal(formatIban(undefined), "");
});

test("formatting keeps the value readable by the invoice model", () => {
  const formatted = formatIban("de89370400440532013000");
  assert.equal(validIBAN(formatted.replaceAll(" ", "")), true);
});

test("reports a checksum error but not an empty or cash payment", () => {
  assert.equal(ibanProblem("DE89 3704 0044 0532 0130 00", "58"), "");
  assert.match(ibanProblem("DE89 3704 0044 0532 0130 01", "58"), /IBAN/);
  assert.equal(ibanProblem("", "58"), "");
  assert.equal(ibanProblem("not an iban", "10"), "");
  assert.match(ibanProblem("DE89", "30"), /IBAN/);
});
