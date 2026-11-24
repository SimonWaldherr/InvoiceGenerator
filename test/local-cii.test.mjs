import assert from "node:assert/strict";
import { test } from "node:test";
import { buildLocalCII } from "../src/invoice/cii.js";

export const xrechnung = {
  profile: "XRECHNUNG",
  syntax: "CII",
  number: "TEST-RE-42",
  date: "2026-11-20",
  dueDate: "2026-12-04",
  supplyDate: "2026-11-19",
  buyerRef: "K-42",
  orderRef: "PO-42",
  businessProcess: "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0",
  currency: "EUR",
  notes: 'Erste Zeile\n"Zusatz" & <Anhang> 👋',
  seller: {
    identifier: "SUPPLIER-EXAMPLE",
    name: "Müller & Söhne",
    street: "Beispielstraße 1",
    zip: "10115",
    city: "Berlin",
    country: "DE",
    contactName: "Erika Musterfrau",
    email: "rechnung@example.com",
    phone: "+49 30 123456",
    endpointId: "rechnung@example.com",
    endpointScheme: "EM",
    vatId: "DE123456789",
  },
  buyer: {
    name: "Beispiel AG",
    street: "Musterweg 5",
    zip: "80331",
    city: "München",
    country: "DE",
    endpointId: "einkauf@example.com",
    endpointScheme: "EM",
    email: "kontakt@example.com",
    phone: "+49 89 123456",
    vatId: "DE987654321",
  },
  payment: {
    typeCode: "58",
    iban: "DE89370400440532013000",
    bic: "COBADEFFXXX",
    account: "Müller & Söhne",
    terms: "14 Tage netto",
    remittance: "Rechnung TEST-RE-42",
  },
  lines: [
    {
      pos: 1,
      name: "Beratung",
      qty: 8.25,
      unit: "HUR",
      vatCat: "S",
      vatRate: 19,
      price: 120.0075,
      disc: 10,
      netUnitPrice: "108.00675",
      discountAmount: "12.00075",
      lineNet: 891.06,
    },
    {
      pos: 2,
      name: "Position mit Nullsatz",
      qty: 1,
      unit: "C62",
      vatCat: "Z",
      vatRate: 0,
      price: 100,
      disc: 0,
      netUnitPrice: "100.00",
      lineNet: 100,
    },
    {
      pos: 3,
      name: "Steuerbefreite Position",
      qty: 1,
      unit: "C62",
      vatCat: "E",
      vatRate: 0,
      price: 50,
      disc: 0,
      netUnitPrice: "50.00",
      lineNet: 50,
    },
    {
      pos: 4,
      name: "Reverse Charge",
      qty: 1,
      unit: "C62",
      vatCat: "AE",
      vatRate: 0,
      price: 75,
      disc: 0,
      netUnitPrice: "75.00",
      lineNet: 75,
    },
  ],
  taxes: [
    { cat: "S", rate: 19, base: 891.06, tax: 169.3 },
    { cat: "Z", rate: 0, base: 100, tax: 0 },
    { cat: "E", rate: 0, base: 50, tax: 0, exemptionReason: "Steuerbefreit" },
    { cat: "AE", rate: 0, base: 75, tax: 0, exemptionReason: "Reverse charge" },
  ],
  totals: { net: 1116.06, tax: 169.3, gross: 1285.36, due: 1285.36 },
};

export const en16931 = {
  ...xrechnung,
  profile: "EN16931",
  businessProcess: "",
  buyer: { ...xrechnung.buyer, endpointId: "", endpointScheme: "" },
  payment: { ...xrechnung.payment, typeCode: "10", terms: "" },
};

export const creditTransfer = {
  ...en16931,
  dueDate: "",
  payment: {
    typeCode: "30",
    iban: "DE89370400440532013000",
    terms: "Fällig innerhalb von 14 Tagen.",
  },
};

test("writes the XRechnung CII profile context and XML with escaped business data", () => {
  const xml = buildLocalCII(xrechnung);
  assert.match(
    xml,
    /<ram:ID>urn:cen\.eu:en16931:2017#compliant#urn:xeinkauf\.de:kosit:xrechnung_3\.0<\/ram:ID>/,
  );
  assert.match(
    xml,
    /<ram:ID>urn:fdc:peppol\.eu:2017:poacc:billing:01:1\.0<\/ram:ID>/,
  );
  assert.match(xml, /<ram:Name>Müller &amp; Söhne<\/ram:Name>/);
  assert.match(
    xml,
    /Erste Zeile&#10;&quot;Zusatz&quot; &amp; &lt;Anhang&gt; 👋/,
  );
  assert.match(
    xml,
    /<ram:URIID schemeID="EM">einkauf@example\.com<\/ram:URIID>/,
  );
  assert.match(xml, /<ram:TypeCode>380<\/ram:TypeCode>/);
  assert.ok(
    xml.indexOf("<ram:IncludedSupplyChainTradeLineItem>") <
      xml.indexOf("<ram:ApplicableHeaderTradeAgreement>"),
  );
});

test("preserves precise discounted unit prices and explicit VAT breakdowns", () => {
  const xml = buildLocalCII(xrechnung);
  assert.match(
    xml,
    /<ram:GrossPriceProductTradePrice>\s+<ram:ChargeAmount>120\.0075<\/ram:ChargeAmount>/,
  );
  assert.match(
    xml,
    /<udt:Indicator>false<\/udt:Indicator>[\s\S]+?<ram:ActualAmount>12\.00075<\/ram:ActualAmount>/,
  );
  assert.match(
    xml,
    /<ram:NetPriceProductTradePrice>\s+<ram:ChargeAmount>108\.00675<\/ram:ChargeAmount>/,
  );
  assert.match(
    xml,
    /<ram:CalculatedAmount>0\.00<\/ram:CalculatedAmount>[\s\S]*?<ram:BasisAmount>100\.00<\/ram:BasisAmount>\s+<ram:CategoryCode>Z<\/ram:CategoryCode>/,
  );
  assert.match(
    xml,
    /<ram:ExemptionReason>Reverse charge<\/ram:ExemptionReason>\s+<ram:BasisAmount>75\.00<\/ram:BasisAmount>\s+<ram:CategoryCode>AE<\/ram:CategoryCode>/,
  );
  assert.match(
    xml,
    /<ram:ExemptionReason>Steuerbefreit<\/ram:ExemptionReason>\s+<ram:BasisAmount>50\.00<\/ram:BasisAmount>\s+<ram:CategoryCode>E<\/ram:CategoryCode>/,
  );
  assert.match(
    xml,
    /<ram:TaxTotalAmount currencyID="EUR">169\.30<\/ram:TaxTotalAmount>/,
  );
  assert.match(xml, /<ram:DuePayableAmount>1285\.36<\/ram:DuePayableAmount>/);
});

test("uses the core profile for EN 16931 and keeps a due date without payment text", () => {
  const xml = buildLocalCII(en16931);
  assert.match(xml, /<ram:ID>urn:cen\.eu:en16931:2017<\/ram:ID>/);
  assert.doesNotMatch(xml, /BusinessProcessSpecifiedDocumentContextParameter/);
  assert.match(
    xml,
    /<ram:SpecifiedTradePaymentTerms>\s+<ram:DueDateDateTime>\s+<udt:DateTimeString format="102">20261204<\/udt:DateTimeString>/,
  );
  assert.match(
    xml,
    /<ram:SpecifiedTradeSettlementPaymentMeans>\s+<ram:TypeCode>10<\/ram:TypeCode>/,
  );
  assert.doesNotMatch(xml, /<ram:IBANID>|<ram:BICID>/);
});

test("supports credit transfer without an optional account name, BIC or due date", () => {
  const xml = buildLocalCII(creditTransfer);
  assert.match(xml, /<ram:TypeCode>30<\/ram:TypeCode>/);
  assert.match(xml, /<ram:IBANID>DE89370400440532013000<\/ram:IBANID>/);
  assert.match(xml, /<ram:Description>Fällig innerhalb von 14 Tagen\.<\/ram:Description>/);
  assert.doesNotMatch(xml, /<ram:AccountName>|<ram:BICID>|<ram:DueDateDateTime>/);
});

test("rejects unsupported output requests and characters that are illegal in XML 1.0", () => {
  assert.throws(() => buildLocalCII({ ...xrechnung, syntax: "UBL" }), /CII/);
  assert.throws(
    () => buildLocalCII({ ...xrechnung, profile: "BASIC" }),
    /EN 16931/,
  );
  assert.throws(
    () => buildLocalCII({ ...xrechnung, notes: "Ungültig\u0001" }),
    /Steuerzeichen/,
  );
  assert.throws(
    () => buildLocalCII({ ...xrechnung, notes: "\uD800" }),
    /Steuerzeichen/,
  );
});
