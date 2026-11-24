import assert from "node:assert/strict";
import { test } from "node:test";
import {
  backupEntries,
  maxDraftLines,
  normalizeDraft,
  normalizeTemplates,
  readJsonFile,
} from "../src/ui/import-data.js";
import { replaceStored, storageKeys } from "../src/ui/storage.js";
import { safeFilename } from "../src/ui/download.js";
import { csvCell } from "../src/ui/draft-files.js";
import { settingsDefaults } from "../src/ui/settings-data.js";

test("accepts saved editor defaults in backups and rejects incompatible profile choices", () => {
  const key = storageKeys.settings;
  const settings = { ...settingsDefaults, profile: "XRECHNUNG", syntax: "UBL" };
  assert.deepEqual(backupEntries({ version: 1, data: { [key]: settings } }), [[key, settings]]);
  assert.throws(() => backupEntries({ version: 1, data: { [key]: { ...settings, profile: "EN16931" } } }), /Sicherung/);
});

test("reads a JSON file with a BOM and skips reading files beyond the size limit", async () => {
  assert.deepEqual(
    await readJsonFile(new Blob(['\ufeff{"header":{"number":"42"}}']), 1),
    { header: { number: "42" } },
  );
  await assert.rejects(
    readJsonFile(
      { size: 1024 ** 2 + 1, text: () => assert.fail("file read") },
      1,
    ),
    /größer/,
  );
});

test("opens older drafts and templates using the current field names", () => {
  const legacy = {
    header: { invnum: "TEST-42", invdate: "2026-01-01", duedate: "2026-01-14" },
    payment: { paymentText: "Netto" },
    items: [
      {
        desc: "Arbeitsstunde",
        qty: "1.25",
        rate: "30",
        vatrate: "19",
        unit: "HUR",
      },
    ],
  };
  const current = normalizeDraft(legacy);
  assert.equal(current.header.number, "TEST-42");
  assert.equal(current.header.dueDate, "2026-01-14");
  assert.equal(current.payment.terms, "Netto");
  assert.deepEqual(current.lines[0], {
    pos: undefined,
    name: "Arbeitsstunde",
    desc: "",
    qty: 1.25,
    price: 30,
    rate: 19,
    unit: "HUR",
    cat: "S",
  });
  assert.equal(normalizeDraft(current), current);
  assert.deepEqual(
    normalizeTemplates([{ name: "Vorlage", snapshot: legacy }])[0].snapshot,
    current,
  );
});

test("recognizes incomplete drafts but rejects malformed sections and oversized line lists", () => {
  const incomplete = { header: {}, lines: [{ name: "", qty: null }] };
  assert.equal(normalizeDraft(incomplete), incomplete);
  assert.throws(
    () => normalizeDraft({ other: true }, { requireContent: true }),
    /Entwurf/,
  );
  assert.throws(() => normalizeDraft({ header: { date: [] } }), /Entwurf/);
  assert.throws(() => normalizeDraft({ lines: [null] }), /Entwurf/);
  assert.throws(
    () =>
      normalizeDraft({
        lines: Array.from({ length: maxDraftLines + 1 }, () => ({})),
      }),
    /höchstens/,
  );
  const draftWithLegacyLogo = {
    ...incomplete,
    meta: { logo: { dataUrl: "unsupported" } },
  };
  assert.equal(normalizeDraft(draftWithLegacyLogo).meta.logo, null);
});

test("drafts above the invoice line limit can be reopened and backed up", () => {
  const draft = {
    header: { number: "1001" },
    lines: Array.from({ length: 1001 }, () => ({ name: "Stunde", qty: 1 })),
  };
  assert.equal(normalizeDraft(draft), draft);
  const old = {
    ...draft,
    lines: Array.from({ length: maxDraftLines + 1 }, () => ({
      name: "Alt",
      qty: 1,
    })),
  };
  const history = [
    { number: "1001", snapshot: draft },
    { number: "ALT", snapshot: old },
  ];
  assert.deepEqual(
    backupEntries({ version: 1, data: { [storageKeys.history]: history } }),
    [[storageKeys.history, history]],
  );
});

test("backup validation preserves original invoice and template logo bytes above the preview limit", () => {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6TEHdwAAAAASUVORK5CYII=",
    "base64",
  );
  const bytes = Buffer.alloc(193 * 1024);
  png.copy(bytes);
  const logo = { dataUrl: "data:image/png;base64," + bytes.toString("base64") };
  const draft = { header: { number: "42" }, meta: { logo } };
  assert.equal(normalizeDraft(draft).meta.logo, null);
  const data = {
    [storageKeys.history]: [{ number: "42", snapshot: draft }],
    [storageKeys.logo]: logo,
    [storageKeys.templates]: [{ name: "Alt", snapshot: draft }],
  };
  assert.deepEqual(backupEntries({ version: 1, data }), Object.entries(data));
  assert.throws(
    () =>
      backupEntries({
        version: 1,
        data: { [storageKeys.logo]: { dataUrl: "broken" } },
      }),
    /Ungültige Daten/,
  );
});

test("validates each backed-up collection and only restores recognized keys", () => {
  const snapshot = { header: { number: "42" }, lines: [] };
  const backup = {
    version: 1,
    data: {
      [storageKeys.history]: [{ number: "42", snapshot }],
      [storageKeys.unit]: "HUR",
      unrelated: true,
    },
  };
  assert.deepEqual(backupEntries(backup), [
    [storageKeys.history, [{ number: "42", snapshot }]],
    [storageKeys.unit, "HUR"],
  ]);
  assert.throws(
    () =>
      backupEntries({
        ...backup,
        data: {
          ...backup.data,
          [storageKeys.companies]: [{ name: "Muster", payment: [] }],
        },
      }),
    /Ungültige Daten/,
  );
});

function mockStorage(entries, maxLength) {
  const entriesByKey = new Map(entries);
  return {
    getItem: (key) => entriesByKey.get(key) ?? null,
    removeItem: (key) => entriesByKey.delete(key),
    setItem(key, value) {
      const next = new Map(entriesByKey).set(key, value);
      const length = [...next.values()].reduce(
        (total, item) => total + item.length,
        0,
      );
      if (length > maxLength) throw new Error("quota");
      entriesByKey.set(key, value);
    },
  };
}

test("applies shrinking storage updates first and rolls back when a later update exceeds quota", () => {
  const store = mockStorage(
    [
      ["a", '"short"'],
      ["b", '"old long"'],
    ],
    18,
  );
  replaceStored(
    [
      ["a", "now long"],
      ["b", "short"],
    ],
    store,
  );
  assert.equal(store.getItem("a"), '"now long"');
  assert.equal(store.getItem("b"), '"short"');

  assert.throws(
    () =>
      replaceStored(
        [
          ["a", "x"],
          ["b", "b".repeat(30)],
        ],
        store,
      ),
    /quota/,
  );
  assert.equal(store.getItem("a"), '"now long"');
  assert.equal(store.getItem("b"), '"short"');
});

test("sanitizes download filenames and keeps CSV data in its field", () => {
  assert.equal(safeFilename("München/42.xml"), "München-42.xml");
  assert.equal(safeFilename("CON.pdf"), "_CON.pdf");
  assert.equal(csvCell('C, "D"'), '"C, ""D"""');
  assert.equal(csvCell(" － Storno"), '"\' － Storno"');
  assert.equal(csvCell("\tHinweis"), '"\'\tHinweis"');
});
