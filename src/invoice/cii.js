import { tr } from "../ui/i18n.js";

const guideline = {
  EN16931: "urn:cen.eu:en16931:2017",
  XRECHNUNG:
    "urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0",
};
const namespaces = {
  "xmlns:rsm": "urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100",
  "xmlns:ram":
    "urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100",
  "xmlns:udt": "urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100",
};
const xmlEntities = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
  "\t": "&#9;",
  "\n": "&#10;",
  "\r": "&#13;",
};

function escapeXml(value) {
  const text = String(value);
  if (
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uD800-\uDFFF\uFFFE\uFFFF]/u.test(
      text,
    )
  ) {
    throw new Error(
      tr(
        "Bitte unzulässige Steuerzeichen aus den Rechnungsdaten entfernen.",
        "Remove invalid control characters from the invoice data.",
      ),
    );
  }
  return text.replace(/[&<>"'\t\n\r]/g, (character) => xmlEntities[character]);
}

function element(name, content, attributes = {}) {
  const attributeList = Object.entries(attributes)
    .map(([key, value]) => ` ${key}="${escapeXml(value)}"`)
    .join("");
  const start = `<${name}${attributeList}>`;
  const end = `</${name}>`;
  if (Array.isArray(content)) {
    const children = content.filter(Boolean).join("\n").replace(/^/gm, "  ");
    return `${start}\n${children}\n${end}`;
  }
  return start + escapeXml(content) + end;
}

function ram(name, content, attributes) {
  return element(`ram:${name}`, content, attributes);
}

function optional(name, value) {
  return value ? ram(name, value) : "";
}

function dateTime(name, value) {
  return ram(name, [
    element("udt:DateTimeString", value.replace(/-/g, ""), { format: "102" }),
  ]);
}

function decimal(value) {
  return value.toFixed(2);
}

function tradeParty(name, party, seller) {
  const { country, street, city, zip, identifier, contactName, email, phone } =
    party;
  const contact = [
    optional("PersonName", contactName),
    phone &&
      ram("TelephoneUniversalCommunication", [ram("CompleteNumber", phone)]),
    email && ram("EmailURIUniversalCommunication", [ram("URIID", email)]),
  ];
  return ram(name, [
    optional("ID", identifier),
    ram("Name", party.name),
    party.registrationId &&
      ram("SpecifiedLegalOrganization", [ram("ID", party.registrationId)]),
    contact.some(Boolean) && ram("DefinedTradeContact", contact),
    ram("PostalTradeAddress", [
      optional("PostcodeCode", zip),
      optional("LineOne", street),
      optional("CityName", city),
      ram("CountryID", country),
    ]),
    party.endpointId &&
      ram("URIUniversalCommunication", [
        ram("URIID", party.endpointId, { schemeID: party.endpointScheme }),
      ]),
    party.vatId &&
      ram("SpecifiedTaxRegistration", [
        ram("ID", party.vatId, { schemeID: "VA" }),
      ]),
    seller &&
      party.taxId &&
      ram("SpecifiedTaxRegistration", [
        ram("ID", party.taxId, { schemeID: "FC" }),
      ]),
  ]);
}

function tradeTax(category, rate, breakdown) {
  return ram("ApplicableTradeTax", [
    breakdown && ram("CalculatedAmount", decimal(breakdown.tax)),
    ram("TypeCode", "VAT"),
    breakdown && optional("ExemptionReason", breakdown.exemptionReason),
    breakdown && ram("BasisAmount", decimal(breakdown.base)),
    ram("CategoryCode", category),
    breakdown && category === "AE" && ram("ExemptionReasonCode", "VATEX-EU-AE"),
    ram("RateApplicablePercent", decimal(rate)),
  ]);
}

function tradeLine(line) {
  const grossPrice =
    line.disc > 0 && line.price > 0
      ? ram("GrossPriceProductTradePrice", [
          ram("ChargeAmount", line.price.toFixed(4)),
          ram("AppliedTradeAllowanceCharge", [
            ram("ChargeIndicator", [element("udt:Indicator", "false")]),
            ram("ActualAmount", line.discountAmount),
          ]),
        ])
      : "";
  return ram("IncludedSupplyChainTradeLineItem", [
    ram("AssociatedDocumentLineDocument", [ram("LineID", line.pos)]),
    ram("SpecifiedTradeProduct", [
      ram("Name", line.name),
      optional("Description", line.desc),
    ]),
    ram("SpecifiedLineTradeAgreement", [
      grossPrice,
      ram("NetPriceProductTradePrice", [
        ram("ChargeAmount", line.netUnitPrice),
      ]),
    ]),
    ram("SpecifiedLineTradeDelivery", [
      ram("BilledQuantity", line.qty.toFixed(4), { unitCode: line.unit }),
    ]),
    ram("SpecifiedLineTradeSettlement", [
      tradeTax(line.vatCat, line.vatRate),
      ram("SpecifiedTradeSettlementLineMonetarySummation", [
        ram("LineTotalAmount", decimal(line.lineNet)),
      ]),
    ]),
  ]);
}

function headerSettlement(invoice) {
  const { payment, dueDate, taxes, totals, currency } = invoice;
  const bankTransfer = payment.typeCode === "30" || payment.typeCode === "58";
  return ram("ApplicableHeaderTradeSettlement", [
    optional("PaymentReference", payment.remittance),
    ram("InvoiceCurrencyCode", currency),
    ram("SpecifiedTradeSettlementPaymentMeans", [
      ram("TypeCode", payment.typeCode),
      bankTransfer &&
        ram("PayeePartyCreditorFinancialAccount", [
          ram("IBANID", payment.iban),
          optional("AccountName", payment.account),
        ]),
      bankTransfer &&
        payment.bic &&
        ram("PayeeSpecifiedCreditorFinancialInstitution", [
          ram("BICID", payment.bic),
        ]),
    ]),
    ...taxes.map((tax) => tradeTax(tax.cat, tax.rate, tax)),
    (payment.terms || dueDate) &&
      ram("SpecifiedTradePaymentTerms", [
        optional("Description", payment.terms),
        dueDate && dateTime("DueDateDateTime", dueDate),
      ]),
    ram("SpecifiedTradeSettlementHeaderMonetarySummation", [
      ram("LineTotalAmount", decimal(totals.net)),
      ram("TaxBasisTotalAmount", decimal(totals.net)),
      ram("TaxTotalAmount", decimal(totals.tax), { currencyID: currency }),
      ram("GrandTotalAmount", decimal(totals.gross)),
      ram("DuePayableAmount", decimal(totals.due)),
    ]),
  ]);
}

// Serialize a normalized, positive invoice using the UN/CEFACT CII D16B binding.
export function buildLocalCII(invoice) {
  if (
    invoice.syntax !== "CII" ||
    !Object.prototype.hasOwnProperty.call(guideline, invoice.profile)
  ) {
    throw new Error(
      tr(
        "Für diesen XML-Export bitte CII und EN 16931 oder XRechnung wählen.",
        "Select CII and either EN 16931 or XRechnung for this XML export.",
      ),
    );
  }
  const root = element(
    "rsm:CrossIndustryInvoice",
    [
      element("rsm:ExchangedDocumentContext", [
        invoice.businessProcess &&
          ram("BusinessProcessSpecifiedDocumentContextParameter", [
            ram("ID", invoice.businessProcess),
          ]),
        ram("GuidelineSpecifiedDocumentContextParameter", [
          ram("ID", guideline[invoice.profile]),
        ]),
      ]),
      element("rsm:ExchangedDocument", [
        ram("ID", invoice.number),
        ram("TypeCode", "380"),
        dateTime("IssueDateTime", invoice.date),
        invoice.notes && ram("IncludedNote", [ram("Content", invoice.notes)]),
      ]),
      element("rsm:SupplyChainTradeTransaction", [
        ...invoice.lines.map(tradeLine),
        ram("ApplicableHeaderTradeAgreement", [
          optional("BuyerReference", invoice.buyerRef),
          tradeParty("SellerTradeParty", invoice.seller, true),
          tradeParty("BuyerTradeParty", invoice.buyer, false),
          invoice.orderRef &&
            ram("BuyerOrderReferencedDocument", [
              ram("IssuerAssignedID", invoice.orderRef),
            ]),
        ]),
        ram("ApplicableHeaderTradeDelivery", [
          invoice.supplyDate &&
            ram("ActualDeliverySupplyChainEvent", [
              dateTime("OccurrenceDateTime", invoice.supplyDate),
            ]),
        ]),
        headerSettlement(invoice),
      ]),
    ],
    namespaces,
  );
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + root + "\n";
}
