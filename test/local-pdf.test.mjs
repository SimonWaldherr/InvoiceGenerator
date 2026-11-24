import assert from "node:assert/strict";
import { test } from "node:test";
import {
  decodePDFRawStream,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFRawStream,
  PDFString,
} from "pdf-lib";
import { buildLocalCII } from "../src/invoice/cii.js";
import { buildLocalPDF } from "../src/invoice/pdf/render.js";
import { loadPdfAssets } from "../tools/invoice-fixtures.mjs";

const assets = await loadPdfAssets();

function invoiceWithLines(count) {
  return {
    profile: "EN16931",
    syntax: "CII",
    number: "RE-42 & <Muster>",
    date: "2026-11-20",
    dueDate: "2026-12-04",
    supplyDate: "2026-11-19",
    currency: "EUR",
    notes: "Hinweis über zwei Zeilen.\nDies ist die zweite Zeile.",
    seller: {
      name: "Müller & Söhne",
      street: "Beispielstraße 1",
      zip: "10115",
      city: "Berlin",
      country: "DE",
      vatId: "DE123456789",
    },
    buyer: {
      name: "Beispiel AG",
      street: "Musterweg 5",
      zip: "80331",
      city: "München",
      country: "DE",
    },
    payment: { typeCode: "10" },
    lines: Array.from({ length: count }, (_, index) => ({
      pos: index + 1,
      name: `Leistung ${index + 1}`,
      desc: "Individuelle Beratung zu den vereinbarten Anforderungen.",
      qty: 1,
      unit: "HUR",
      price: 100,
      disc: 0,
      vatCat: "S",
      vatRate: 19,
      netUnitPrice: "100",
      lineNet: 100,
    })),
    taxes: [{ cat: "S", rate: 19, base: 100 * count, tax: 19 * count }],
    totals: {
      net: 100 * count,
      tax: 19 * count,
      gross: 119 * count,
      due: 119 * count,
    },
  };
}

test("writes PDF/A metadata, output intent, and exactly one associated Factur-X file", async () => {
  const invoice = invoiceWithLines(1);
  const xml = buildLocalCII(invoice);
  const pdf = await PDFDocument.load(await buildLocalPDF(invoice, xml, assets));

  assert.equal(pdf.getPageCount(), 1);
  assert.ok(pdf.context.trailerInfo.ID instanceof PDFArray);
  assert.equal(pdf.context.trailerInfo.ID.size(), 2);
  const metadata = pdf.catalog.lookup(PDFName.of("Metadata"), PDFRawStream);
  const xmp = new TextDecoder().decode(metadata.getContents());
  assert.match(xmp, /<pdfaid:part>3<\/pdfaid:part>/);
  assert.match(xmp, /<pdfaid:conformance>B<\/pdfaid:conformance>/);
  assert.match(xmp, /<fx:DocumentFileName>factur-x.xml<\/fx:DocumentFileName>/);
  assert.match(xmp, /<fx:ConformanceLevel>EN 16931<\/fx:ConformanceLevel>/);
  assert.match(xmp, /RE-42 &amp; &lt;Muster&gt;/);
  const outputIntents = pdf.catalog.lookup(
    PDFName.of("OutputIntents"),
    PDFArray,
  );
  const intent = outputIntents.lookup(0, PDFDict);
  const icc = intent.lookup(PDFName.of("DestOutputProfile"), PDFRawStream);
  assert.deepEqual(Buffer.from(decodePDFRawStream(icc).decode()), assets.icc);

  const files = pdf.catalog.lookup(PDFName.of("AF"), PDFArray);
  assert.equal(files.size(), 1);
  const file = files.lookup(0, PDFDict);
  assert.equal(
    file.lookup(PDFName.of("UF"), PDFHexString).decodeText(),
    "factur-x.xml",
  );
  assert.equal(
    file.lookup(PDFName.of("AFRelationship"), PDFName),
    PDFName.of("Alternative"),
  );
  const embedded = file.lookup(PDFName.of("EF"), PDFDict);
  const stream = embedded.lookup(PDFName.of("F"), PDFRawStream);
  assert.equal(
    new TextDecoder().decode(decodePDFRawStream(stream).decode()),
    xml,
  );
});

test("paginates many items and a long uninterrupted description", async () => {
  const invoice = invoiceWithLines(30);
  invoice.lines[0].desc = "Projektanforderung".repeat(80);
  const pdf = await PDFDocument.load(
    await buildLocalPDF(invoice, buildLocalCII(invoice), assets),
  );
  assert.ok(pdf.getPageCount() >= 3);
  assert.equal(
    pdf.getPages().every((page) => page.getWidth() === 595.28),
    true,
  );
});

test("localizes PDF metadata without changing the attached invoice", async () => {
  const invoice = { ...invoiceWithLines(1), appearance: { language: "en" } };
  const xml = buildLocalCII(invoice);
  const pdf = await PDFDocument.load(await buildLocalPDF(invoice, xml, assets));
  assert.equal(pdf.catalog.lookup(PDFName.of("Lang"), PDFString).decodeText(), "en");
  const metadata = pdf.catalog.lookup(PDFName.of("Metadata"), PDFRawStream);
  assert.match(new TextDecoder().decode(metadata.getContents()), /Invoice RE-42/);
  const file = pdf.catalog.lookup(PDFName.of("AF"), PDFArray).lookup(0, PDFDict);
  const stream = file.lookup(PDFName.of("EF"), PDFDict).lookup(PDFName.of("F"), PDFRawStream);
  assert.equal(new TextDecoder().decode(decodePDFRawStream(stream).decode()), xml);
});

test("reports unsupported glyphs and an unusable color profile", async () => {
  const invoice = invoiceWithLines(1);
  const xml = buildLocalCII(invoice);
  await assert.rejects(
    buildLocalPDF({ ...invoice, notes: "Rakete 🚀" }, xml, assets),
    /kann mit der lokalen PDF-Schrift nicht dargestellt werden/,
  );
  await assert.rejects(
    buildLocalPDF(invoice, xml, { ...assets, icc: new Uint8Array(40) }),
    /lokale sRGB-Profil/,
  );
});
