import assert from "node:assert/strict";
import test from "node:test";
import { maxDraftLines } from "../src/ui/import-data.js";
import {
  parseLineCsv,
  readLineCsv,
  serializeLineCsv,
} from "../src/ui/line-csv.js";

const required = "Produkt;Menge;Einheit;Einzelpreis;USt-Kat;USt-%";
const validLine = "Testartikel;1;C62;4,99;S;19";

test("reads a UTF-8 BOM, Excel-style decimal commas, reordered columns and quoted line breaks", async () => {
  const file = new Blob([
    "\ufeffEinheit;VAT rate;Discount%;Description;Quantity;Produkt;VAT category;Unit price;Net\r\n" +
      'HUR;19;2,75;"Zeile 1; mit ""Zitat""\r\nZeile 2";1,2345;Beratung;s;12,50;9999\r\n',
  ]);
  assert.deepEqual(await readLineCsv(file), [
    {
      pos: "1",
      name: "Beratung",
      desc: 'Zeile 1; mit "Zitat"\nZeile 2',
      qty: 1.2345,
      unit: "HUR",
      price: 12.5,
      cat: "S",
      rate: 19,
      vatExemptionReason: "",
      disc: 2.75,
    },
  ]);
});

test("imports the legacy comma format and treats its apostrophes as literal text", () => {
  const legacy = [
    "Pos,Produkt,Beschreibung,Menge,Einheit,Einzelpreis,USt-Kat,USt-%,Rabatt%,Netto,Steuer,Brutto",
    `"A2","'=Handarbeit","Beschreibung","1","C62","2,50","E","0","","999","999","999"`,
  ].join("\n");
  assert.deepEqual(parseLineCsv(legacy), [
    {
      pos: "A2",
      name: "'=Handarbeit",
      desc: "Beschreibung",
      qty: 1,
      unit: "C62",
      price: 2.5,
      cat: "E",
      rate: 0,
      vatExemptionReason: "",
      disc: 0,
    },
  ]);
});

test("round trips newly exported German and English positions with formula-like text and VAT reasons", () => {
  const line = {
    pos: "1",
    name: "=1+1",
    desc: '\'Beginn, mit "Zitat"\nZeile 2',
    qty: 1.2345,
    unit: "C62",
    price: 4.99,
    cat: "E",
    rate: 0,
    vatExemptionReason: "@Begründung",
    disc: 10,
  };
  for (const locale of ["de", "en"]) {
    const csv = serializeLineCsv(
      [{ ...line, lineNet: 997, lineTax: 0, lineGross: 997 }],
      locale,
    );
    assert.match(csv, /"\x27=1\+1"/);
    assert.match(csv, /"\x27\x27Beginn,/);
    assert.match(csv, /"\x27@Begründung"$/);
    assert.deepEqual(parseLineCsv(csv), [line]);
  }
});

test("rejects wrong columns, malformed quotes and rows with invalid values", () => {
  assert.throws(() => parseLineCsv("Artikel;Einheit\nTest;C62"), /Kopfzeile/);
  assert.throws(
    () => parseLineCsv(required + ";Produkt\n" + validLine),
    /Kopfzeile/,
  );
  assert.throws(
    () => parseLineCsv(required + "\nTest;1;C62;20;S"),
    /Spaltenzahl/,
  );
  assert.throws(
    () => parseLineCsv(required + '\n"Test;1;C62;20;S;19'),
    /nicht geschlossen/,
  );
  assert.throws(
    () => parseLineCsv(required + '\n"Test"x;1;C62;20;S;19'),
    /Ungültige Anführungszeichen/,
  );
  assert.throws(
    () => parseLineCsv(required + "\nTest;1;C62;1.000,00;S;19"),
    /ungültige Zahl/,
  );
  assert.throws(
    () => parseLineCsv(required + "\nTest;1;C62;=12;S;19"),
    /ungültige Zahl/,
  );
  assert.throws(
    () => parseLineCsv(required + "\nTest;1;C62;20;S;0"),
    /USt-Satz/,
  );
  assert.throws(
    () => parseLineCsv(required + "\nTest;1;C62;20;Z;19"),
    /USt-Satz/,
  );
  assert.throws(
    () =>
      parseLineCsv(
        required + ";USt-Befreiungsgrund\nTest;1;C62;20;S;19;Befreiungsgrund",
      ),
    /Befreiungsgrund/,
  );
  assert.throws(
    () => parseLineCsv(required + '\n"Name\nFortsetzung";1;C62;20;S;19'),
    /Zeilenumbrüche/,
  );
  assert.throws(() => parseLineCsv(required + "\n\n"), /keine Positionen/);
});

test("enforces the line count, file size and character encoding limits", async () => {
  const lines = Array(maxDraftLines + 1).fill(validLine);
  assert.throws(
    () => parseLineCsv(required + "\n" + lines.join("\n")),
    /höchstens/,
  );
  await assert.rejects(
    readLineCsv({
      size: 8 * 1024 * 1024 + 1,
      arrayBuffer: () => assert.fail("oversized files are never read"),
    }),
    /8 MiB/,
  );
  await assert.rejects(
    readLineCsv(new Blob([new Uint8Array([0xff])])),
    /UTF-8/,
  );
});
