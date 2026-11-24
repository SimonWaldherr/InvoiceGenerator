import assert from "node:assert/strict";
import test from "node:test";
import { addDays } from "../src/ui/date-helpers.js";

test("adds days across month, year and leap-day boundaries", () => {
  assert.equal(addDays("2026-11-24", 14), "2026-12-08");
  assert.equal(addDays("2026-12-20", 30), "2027-01-19");
  assert.equal(addDays("2028-02-15", 14), "2028-02-29");
  assert.equal(addDays("2027-02-15", 14), "2027-03-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
});

test("is not shifted by daylight saving time", () => {
  assert.equal(addDays("2026-03-20", 14), "2026-04-03");
  assert.equal(addDays("2026-10-20", 14), "2026-11-03");
});

test("returns null for empty, malformed or fractional input", () => {
  assert.equal(addDays("", 14), null);
  assert.equal(addDays(undefined, 14), null);
  assert.equal(addDays("24.11.2026", 14), null);
  assert.equal(addDays("2026-11-24", 1.5), null);
});
