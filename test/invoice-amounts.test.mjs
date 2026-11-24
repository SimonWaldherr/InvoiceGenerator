import assert from "node:assert/strict";
import test from "node:test";
import { invoiceAmounts } from "../src/invoice/amounts.js";

const line = (fields) => ({ qty: 1, price: 0.03, disc: 0, rate: 19, cat: "S", ...fields });

test("rounds discounts exactly and groups VAT before rounding to cents", () => {
  const amounts = invoiceAmounts([
    line(), line(), line({ price: 1.005, rate: 7 }),
    line({ price: 4.99, qty: 1.2345, disc: 12.34, cat: "Z", rate: 0 }),
  ]);
  assert.deepEqual(amounts.lines.map((row) => row.lineTax), [0.01, 0, 0.07, 0]);
  assert.deepEqual(amounts.lines.map((row) => row.lineNet), [0.03, 0.03, 1.01, 5.4]);
  assert.deepEqual(amounts.totals, { net: 6.47, tax: 0.08, gross: 6.55, due: 6.55 });
  assert.equal(amounts.taxBreakdown.find(({ cat }) => cat === "Z").base, 5.4);
});

test("does not show a complete total for a malformed decimal or discount", () => {
  assert.equal(invoiceAmounts([line(), line({ qty: 1.00001 })]).totals.gross, null);
  assert.equal(invoiceAmounts([line({ disc: 100.01 })]).lines[0].lineNet, null);
});
