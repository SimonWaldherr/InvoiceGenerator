import assert from "node:assert/strict";
import test from "node:test";
import { buildLocalUBL } from "../src/invoice/ubl.js";

function exampleInvoice() {
  return {
    number: 'RE-1<&>"',
    date: "2026-11-20",
    dueDate: "2026-12-04",
    supplyDate: "2026-11-20",
    currency: "EUR",
    businessProcess: "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0",
    buyerRef: "TEST-ABTEILUNG",
    orderRef: "TEST-AUFTRAG",
    notes: "Prüfung & Beratung 😀",
    seller: {
      name: "Musterlabor Nord & Partner",
      street: "Prüfweg 2",
      zip: "20095",
      city: "Hamburg",
      country: "DE",
      vatId: "DE123456789",
      taxId: "123/456/78901",
      identifier: "LABOR-TEST",
      endpointScheme: "EM",
      endpointId: "seller@example.com",
      contactName: "Mara Beispiel",
      email: "seller@example.com",
      phone: "+49 40 123456",
    },
    buyer: {
      name: "Musterorganisation",
      street: "Campusallee 5",
      zip: "80339",
      city: "München",
      country: "DE",
      vatId: "DE987654321",
      endpointScheme: "EM",
      endpointId: "buyer@example.com",
    },
    payment: {
      typeCode: "58",
      iban: "DE89370400440532013000",
      bic: "COBADEFFXXX",
      account: "Musterlabor Nord & Partner",
      terms: "14 Tage netto",
      remittance: "RE-1",
    },
    lines: [
      {
        pos: 1,
        name: "Prüfdienstleistung",
        desc: "Messung > Bericht",
        qty: 2.5,
        unit: "HUR",
        price: 19.1234,
        vatCat: "S",
        vatRate: 19,
        lineNet: 41.91,
        netUnitPrice: "16.76357244",
        discountAmount: "2.35982756",
      },
    ],
    taxes: [{ cat: "S", rate: 19, base: 41.91, tax: 7.96 }],
    totals: { net: 41.91, tax: 7.96, gross: 49.87, due: 49.87 },
  };
}

test("writes an XRechnung UBL invoice with exact unit pricing and escaped text", () => {
  const xml = buildLocalUBL(exampleInvoice());
  assert.match(
    xml,
    /xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"/,
  );
  assert.match(
    xml,
    /<cbc:CustomizationID>urn:cen\.eu:en16931:2017#compliant#urn:xeinkauf\.de:kosit:xrechnung_3\.0<\/cbc:CustomizationID>/,
  );
  assert.ok(xml.includes("<cbc:ID>RE-1&lt;&amp;&gt;&quot;</cbc:ID>"));
  assert.ok(xml.includes("<cbc:Note>Prüfung &amp; Beratung 😀</cbc:Note>"));
  assert.ok(
    xml.includes(
      '<cbc:EndpointID schemeID="EM">seller@example.com</cbc:EndpointID>',
    ),
  );
  assert.ok(
    xml.includes(
      '<cbc:InvoicedQuantity unitCode="HUR">2.5000</cbc:InvoicedQuantity>',
    ),
  );
  assert.ok(
    xml.includes(
      '<cbc:PriceAmount currencyID="EUR">16.76357244</cbc:PriceAmount>',
    ),
  );
  assert.ok(
    xml.includes('<cbc:Amount currencyID="EUR">2.35982756</cbc:Amount>'),
  );
  assert.ok(
    xml.includes('<cbc:BaseAmount currencyID="EUR">19.1234</cbc:BaseAmount>'),
  );
  assert.ok(
    xml.includes('<cbc:TaxAmount currencyID="EUR">7.96</cbc:TaxAmount>'),
  );
  assert.ok(
    xml.includes(
      '<cbc:PayableAmount currencyID="EUR">49.87</cbc:PayableAmount>',
    ),
  );
});

test("omits the bank account for cash and supplies the tax exemption reason", () => {
  const invoice = exampleInvoice();
  invoice.payment.typeCode = "10";
  invoice.lines[0].vatCat = "E";
  invoice.lines[0].vatRate = 0;
  invoice.taxes = [
    { cat: "E", rate: 0, base: 41.91, tax: 0, exemptionReason: "§ 4 UStG" },
  ];
  invoice.totals = { net: 41.91, tax: 0, gross: 41.91, due: 41.91 };
  const xml = buildLocalUBL(invoice);
  assert.ok(xml.includes("<cbc:PaymentMeansCode>10</cbc:PaymentMeansCode>"));
  assert.doesNotMatch(xml, /PayeeFinancialAccount/);
  assert.ok(
    xml.includes("<cbc:TaxExemptionReason>§ 4 UStG</cbc:TaxExemptionReason>"),
  );
  assert.doesNotMatch(xml, /TaxExemptionReasonCode/);
});

test("preserves optional buyer contact details in the UBL customer party", () => {
  const invoice = exampleInvoice();
  const buyerXml = () =>
    buildLocalUBL(invoice).match(
      /<cac:AccountingCustomerParty>[\s\S]*?<\/cac:AccountingCustomerParty>/,
    )[0];
  assert.doesNotMatch(buyerXml(), /<cac:Contact>/);

  invoice.buyer.email = "einkauf@example.com";
  invoice.buyer.phone = "+49 89 123456";
  const customer = buyerXml();
  assert.match(
    customer,
    /<cac:Contact>\s*<cbc:Telephone>\+49 89 123456<\/cbc:Telephone>/,
  );
  assert.ok(
    customer.includes(
      "<cbc:ElectronicMail>einkauf@example.com</cbc:ElectronicMail>",
    ),
  );
});

test("rejects unsupported XML characters and escapes quotes in attributes", () => {
  const invoice = exampleInvoice();
  invoice.buyer.endpointScheme = 'EM"';
  assert.ok(buildLocalUBL(invoice).includes('schemeID="EM&quot;"'));
  invoice.notes = "Kontrollzeichen \u0001";
  assert.throws(() => buildLocalUBL(invoice), /Zeichen.*XML/);
});
