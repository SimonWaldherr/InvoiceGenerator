import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeInvoiceDraft, supportedLogo } from "../src/invoice/draft.js";

const logo =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX9sAAAAASUVORK5CYII=";

test("checks raster dimensions before passing imported logos to the PDF renderer", () => {
  assert.equal(supportedLogo({ dataUrl: logo }), logo);

  const bytes = Buffer.from(logo.split(",")[1], "base64");
  bytes.writeUInt32BE(2048, 16);
  bytes.writeUInt32BE(2048, 20);
  const oversized = `data:image/png;base64,${bytes.toString("base64")}`;
  assert.equal(supportedLogo({ dataUrl: oversized }), undefined);
  assert.equal(supportedLogo({ dataUrl: "data:image/jpeg;base64,/9j/2g==" }), undefined);
});
const snapshot = {
  header: {
    profile: "EN16931",
    syntax: "CII",
    number: "RE-42",
    date: "2026-11-20",
    dueDate: "2026-12-20",
    supplyDate: "2026-11-19",
    currency: "EUR",
    orderRef: "PO-14",
    buyerRef: "K-123",
    businessProcess: "urn:example:invoicing",
  },
  seller: {
    name: "Musterfirma",
    street: "Beispielweg 5",
    zip: "01234",
    city: "Musterstadt",
    country: "DE",
    vat: "DE123456789",
    fc: "123/456/78901",
    reg: "HRB 999",
    contactName: "Erika Musterfrau",
    identifier: "S-10",
    endpointId: "0100",
    endpointScheme: "0088",
  },
  buyer: { name: "Kunde", endpointId: "0200", endpointScheme: "0204" },
  payment: {
    type: "58",
    iban: "DE89370400440532013000",
    holder: "Musterfirma",
  },
  lines: [
    {
      pos: "10",
      name: "Beratung",
      qty: 8.125,
      unit: "HUR",
      price: 120.0075,
      cat: "E",
      rate: 0,
      disc: 10,
      vatExemptionReason: "Steuerbefreit",
      lineNet: 0,
    },
  ],
  totals: { net: 0 },
  meta: {
    logo: { dataUrl: logo, name: "logo.png" },
    pdf: { layout: "modern", accentColor: "#112233" },
  },
};

test("normalizes draft fields without reusing their stored totals", () => {
  const invoice = normalizeInvoiceDraft(snapshot, "pdf");
  assert.deepEqual(invoice, {
    profile: "EN16931",
    syntax: "CII",
    number: "RE-42",
    date: "2026-11-20",
    dueDate: "2026-12-20",
    supplyDate: "2026-11-19",
    currency: "EUR",
    orderRef: "PO-14",
    buyerRef: "K-123",
    notes: "",
    businessProcess: "urn:example:invoicing",
    seller: {
      name: "Musterfirma",
      street: "Beispielweg 5",
      zip: "01234",
      city: "Musterstadt",
      country: "DE",
      vatId: "DE123456789",
      taxId: "123/456/78901",
      registrationId: "HRB 999",
      email: "",
      phone: "",
      contactName: "Erika Musterfrau",
      identifier: "S-10",
      endpointId: "0100",
      endpointScheme: "0088",
    },
    buyer: {
      name: "Kunde",
      street: "",
      zip: "",
      city: "",
      country: "",
      vatId: "",
      taxId: "",
      registrationId: "",
      email: "",
      phone: "",
      contactName: "",
      identifier: "",
      endpointId: "0200",
      endpointScheme: "0204",
    },
    payment: {
      typeCode: "58",
      iban: "DE89370400440532013000",
      bic: "",
      account: "Musterfirma",
      terms: "",
      remittance: "",
    },
    lines: [
      {
        pos: 1,
        name: "Beratung",
        desc: "",
        qty: 8.125,
        unit: "HUR",
        price: 120.0075,
        vatCat: "E",
        vatRate: 0,
        disc: 10,
        vatExemptionReason: "Steuerbefreit",
      },
    ],
    style: "modern",
    appearance: { accentColor: "#112233", logoDataURL: logo },
  });
  const xmlInvoice = normalizeInvoiceDraft(snapshot, "xml");
  assert.equal(xmlInvoice.style, undefined);
  assert.equal(xmlInvoice.appearance, undefined);
});

test("requires supported profile, syntax, VAT and payment without coercing invalid amounts", () => {
  const withHeader = (header) => ({
    ...snapshot,
    header: { ...snapshot.header, ...header },
  });
  assert.throws(
    () => normalizeInvoiceDraft(withHeader({ profile: "BASIC" }), "xml"),
    /Rechnungsprofil/,
  );
  assert.throws(
    () => normalizeInvoiceDraft(withHeader({ syntax: "UBL" }), "xml"),
    /CII wählen/,
  );
  assert.throws(
    () => normalizeInvoiceDraft(withHeader({ profile: "XRECHNUNG" }), "pdf"),
    /als XML/,
  );
  assert.equal(
    normalizeInvoiceDraft(
      withHeader({ profile: "XRECHNUNG", syntax: "UBL" }),
      "xml",
    ).syntax,
    "UBL",
  );
  assert.throws(
    () =>
      normalizeInvoiceDraft(
        { ...snapshot, lines: [{ ...snapshot.lines[0], cat: "K" }] },
        "xml",
      ),
    /USt-Kategorie/,
  );
  assert.throws(
    () =>
      normalizeInvoiceDraft(
        { ...snapshot, lines: [{ ...snapshot.lines[0], rate: NaN }] },
        "xml",
      ),
    /gültige Zahlen/,
  );
  assert.throws(
    () =>
      normalizeInvoiceDraft({ ...snapshot, payment: { type: "59" } }, "xml"),
    /Zahlungsart/,
  );
});

test("ignores unsupported presentation settings from older drafts", () => {
  const invoice = normalizeInvoiceDraft(
    {
      ...snapshot,
      meta: {
        logo: { dataUrl: "data:image/png;base64,SGVsbG8=" },
        pdf: { layout: "sleek", accentColor: "red" },
      },
    },
    "pdf",
  );
  assert.equal(invoice.style, "classic");
  assert.equal(invoice.appearance, undefined);
});
