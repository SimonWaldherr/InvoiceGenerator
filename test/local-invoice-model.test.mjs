import assert from "node:assert/strict";
import test from "node:test";
import { createLocalInvoiceArtifact } from "../src/invoice/export.js";
import { prepareLocalInvoice } from "../src/invoice/model.js";
import { draft } from "../tools/invoice-fixtures.mjs";

test("calculates exact net unit prices and discounts before rounding the line", () => {
  const invoice = prepareLocalInvoice(draft, "xml");
  assert.equal(invoice.lines[0].netUnitPrice, "4.374234");
  assert.equal(invoice.lines[0].discountAmount, "0.615766");
  assert.equal(invoice.lines[0].lineNet, 5.4);
  assert.deepEqual(invoice.totals, { net: 5.4, gross: 5.4, due: 5.4, tax: 0 });
});

test("rejects invalid calendar dates, incomplete XRechnung and bad IBANs", () => {
  const updateHeader = (changes) => ({
    ...draft,
    header: { ...draft.header, ...changes },
  });
  assert.throws(
    () => prepareLocalInvoice(updateHeader({ date: "2026-02-30" }), "xml"),
    /Rechnungsdatum ist ungültig/,
  );
  assert.throws(
    () => prepareLocalInvoice(updateHeader({ profile: "XRECHNUNG" }), "xml"),
    /XRechnung benötigt/,
  );
  assert.throws(
    () =>
      prepareLocalInvoice(
        {
          ...draft,
          payment: { ...draft.payment, iban: "DE89370400440532013001" },
        },
        "xml",
      ),
    /gültige IBAN/,
  );
});

test("rejects unsupported country codes, EAS codes, and unprefixed VAT IDs", () => {
  const withBuyer = (changes) => ({
    ...draft,
    buyer: { ...draft.buyer, ...changes },
  });
  assert.throws(
    () => prepareLocalInvoice(withBuyer({ country: "ZZ" }), "xml"),
    /Ländercode/,
  );
  assert.throws(
    () => prepareLocalInvoice(withBuyer({ country: "EL" }), "xml"),
    /Ländercode/,
  );
  assert.equal(
    prepareLocalInvoice(withBuyer({ country: "GR", vat: "EL123456789" }), "xml")
      .buyer.vatId,
    "EL123456789",
  );
  assert.throws(
    () =>
      prepareLocalInvoice(
        withBuyer({ endpointId: "ID-1", endpointScheme: "9999" }),
        "xml",
      ),
    /Adressschema \(EAS\)/,
  );
  assert.throws(
    () => prepareLocalInvoice(withBuyer({ vat: "987654321" }), "xml"),
    /Länderpräfix/,
  );
  assert.equal(
    prepareLocalInvoice(
      withBuyer({ endpointId: "4001000-00001-67", endpointScheme: "0204" }),
      "xml",
    ).buyer.endpointScheme,
    "0204",
  );
});

test("ends structured XRechnung payment terms with a line break in either syntax", async () => {
  const skonto = "#SKONTO#TAGE=10#PROZENT=2.00#";
  const xrechnungDraft = {
    ...draft,
    header: {
      ...draft.header,
      profile: "XRECHNUNG",
      buyerRef: "TEST-K42",
      businessProcess: "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0",
    },
    seller: {
      ...draft.seller,
      contactName: "Erika Muster",
      email: "rechnung@example.com",
      phone: "+49 30 123456",
      endpointId: "rechnung@example.com",
      endpointScheme: "EM",
    },
    buyer: {
      ...draft.buyer,
      endpointId: "einkauf@example.com",
      endpointScheme: "EM",
    },
    payment: { ...draft.payment, terms: skonto },
  };
  assert.throws(
    () =>
      prepareLocalInvoice(
        {
          ...xrechnungDraft,
          payment: {
            ...xrechnungDraft.payment,
            terms: "#SKONTO#TAGE=10#PROZENT=2,00#",
          },
        },
        "xml",
      ),
    /Skonto für XRechnung/,
  );
  for (const [syntax, ending] of [
    ["CII", "&#10;</ram:Description>"],
    ["UBL", "\n</cbc:Note>"],
  ]) {
    const snapshot = {
      ...xrechnungDraft,
      header: { ...xrechnungDraft.header, syntax },
    };
    assert.equal(
      prepareLocalInvoice(snapshot, "xml").payment.terms,
      skonto + "\n",
    );
    assert.ok(
      (
        await (await createLocalInvoiceArtifact(snapshot, "xml")).text()
      ).includes(skonto + ending),
    );

    const withTerms = (terms) => ({
      ...snapshot,
      payment: { ...snapshot.payment, terms },
    });
    assert.throws(
      () =>
        prepareLocalInvoice(
          withTerms(skonto + "\nBitte #K-42# angeben."),
          "xml",
        ),
      /vor die Skontozeilen/,
    );
    const terms = "Bitte #K-42# angeben.\n" + skonto + "\n30 Tage netto.";
    assert.equal(
      prepareLocalInvoice(withTerms(terms), "xml").payment.terms,
      terms,
    );
    const endingWithHash = skonto + "\nBitte beachten: #K-42#";
    assert.equal(
      prepareLocalInvoice(withTerms(endingWithHash), "xml").payment.terms,
      endingWithHash + "\n",
    );
  }
});

test("exports CII using only local generation", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", () =>
    assert.fail("unexpected network request"),
  );
  const artifact = await createLocalInvoiceArtifact(draft, "xml");
  assert.equal(artifact.type, "application/xml");
  assert.match(
    await artifact.text(),
    /<ram:Name>Muster &amp; Partner<\/ram:Name>/,
  );
  assert.equal(fetch.mock.callCount(), 0);
});
