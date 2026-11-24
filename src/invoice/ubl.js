import { tr } from "../ui/i18n.js";

const customizationId =
  "urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0";

function escapeXml(value) {
  const text = String(value);
  if (
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\ud800-\udfff\ufffe\uffff]/u.test(
      text,
    )
  ) {
    throw new Error(
      tr(
        "Die Rechnung enthält Zeichen, die in XML nicht zulässig sind.",
        "The invoice contains characters that are invalid in XML.",
      ),
    );
  }
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\r/g, "&#13;");
}

function basic(name, value) {
  return value == null || value === ""
    ? ""
    : `<cbc:${name}>${escapeXml(value)}</cbc:${name}>`;
}

function taxScheme(id) {
  return `<cac:TaxScheme>${basic("ID", id)}</cac:TaxScheme>`;
}

function partyTax(id, scheme) {
  if (!id) return "";
  return `<cac:PartyTaxScheme>${basic("CompanyID", id)}${taxScheme(scheme)}</cac:PartyTaxScheme>`;
}

function party(party, seller) {
  return `<cac:Party>
    <cbc:EndpointID schemeID="${escapeXml(party.endpointScheme)}">${escapeXml(party.endpointId)}</cbc:EndpointID>
    ${party.identifier ? `<cac:PartyIdentification>${basic("ID", party.identifier)}</cac:PartyIdentification>` : ""}
    <cac:PostalAddress>
      ${basic("StreetName", party.street)}
      ${basic("CityName", party.city)}
      ${basic("PostalZone", party.zip)}
      <cac:Country>${basic("IdentificationCode", party.country)}</cac:Country>
    </cac:PostalAddress>
    ${partyTax(party.vatId, "VAT")}
    ${seller ? partyTax(party.taxId, "TAX") : ""}
    <cac:PartyLegalEntity>
      ${basic("RegistrationName", party.name)}
      ${basic("CompanyID", party.registrationId)}
    </cac:PartyLegalEntity>
    ${
      party.contactName || party.phone || party.email
        ? `<cac:Contact>
      ${basic("Name", party.contactName)}
      ${basic("Telephone", party.phone)}
      ${basic("ElectronicMail", party.email)}
    </cac:Contact>`
        : ""
    }
  </cac:Party>`;
}

function paymentMeans(payment) {
  const account =
    payment.typeCode === "30" || payment.typeCode === "58"
      ? `<cac:PayeeFinancialAccount>
      ${basic("ID", payment.iban)}
      ${basic("Name", payment.account)}
      ${payment.bic ? `<cac:FinancialInstitutionBranch>${basic("ID", payment.bic)}</cac:FinancialInstitutionBranch>` : ""}
    </cac:PayeeFinancialAccount>`
      : "";
  return `<cac:PaymentMeans>
    ${basic("PaymentMeansCode", payment.typeCode)}
    ${basic("PaymentID", payment.remittance)}
    ${account}
  </cac:PaymentMeans>`;
}

function taxCategory(cat, rate) {
  return basic("ID", cat) + basic("Percent", rate.toFixed(2));
}

export function buildLocalUBL(invoice) {
  const { seller, buyer, payment, lines, taxes, totals } = invoice;
  const currency = escapeXml(invoice.currency);
  const monetary = (name, value) =>
    `<cbc:${name} currencyID="${currency}">${escapeXml(value)}</cbc:${name}>`;
  const amount = (name, value) => monetary(name, value.toFixed(2));
  const breakdown = taxes.map(
    ({ cat, rate, base, tax, exemptionReason }) => `<cac:TaxSubtotal>
      ${amount("TaxableAmount", base)}
      ${amount("TaxAmount", tax)}
      <cac:TaxCategory>
        ${taxCategory(cat, rate)}
        ${cat === "AE" ? basic("TaxExemptionReasonCode", "VATEX-EU-AE") : ""}
        ${cat === "E" || cat === "AE" ? basic("TaxExemptionReason", exemptionReason) : ""}
        ${taxScheme("VAT")}
      </cac:TaxCategory>
    </cac:TaxSubtotal>`,
  );
  const positions = lines.map(
    (line) => `<cac:InvoiceLine>
    ${basic("ID", line.pos)}
    <cbc:InvoicedQuantity unitCode="${escapeXml(line.unit)}">${line.qty.toFixed(4)}</cbc:InvoicedQuantity>
    ${amount("LineExtensionAmount", line.lineNet)}
    <cac:Item>
      ${basic("Description", line.desc)}
      ${basic("Name", line.name)}
      <cac:ClassifiedTaxCategory>
        ${taxCategory(line.vatCat, line.vatRate)}
        ${taxScheme("VAT")}
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      ${monetary("PriceAmount", line.netUnitPrice)}
      ${
        Number(line.discountAmount) > 0
          ? `<cac:AllowanceCharge>
        <cbc:ChargeIndicator>false</cbc:ChargeIndicator>
        ${monetary("Amount", line.discountAmount)}
        ${monetary("BaseAmount", line.price.toFixed(4))}
      </cac:AllowanceCharge>`
          : ""
      }
    </cac:Price>
  </cac:InvoiceLine>`,
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  ${basic("CustomizationID", customizationId)}
  ${basic("ProfileID", invoice.businessProcess)}
  ${basic("ID", invoice.number)}
  ${basic("IssueDate", invoice.date)}
  ${basic("DueDate", invoice.dueDate)}
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  ${basic("Note", invoice.notes)}
  ${basic("DocumentCurrencyCode", invoice.currency)}
  ${basic("BuyerReference", invoice.buyerRef)}
  ${invoice.orderRef ? `<cac:OrderReference>${basic("ID", invoice.orderRef)}</cac:OrderReference>` : ""}
  <cac:AccountingSupplierParty>${party(seller, true)}</cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>${party(buyer, false)}</cac:AccountingCustomerParty>
  <cac:Delivery>${basic("ActualDeliveryDate", invoice.supplyDate)}</cac:Delivery>
  ${paymentMeans(payment)}
  ${payment.terms ? `<cac:PaymentTerms>${basic("Note", payment.terms)}</cac:PaymentTerms>` : ""}
  <cac:TaxTotal>
    ${amount("TaxAmount", totals.tax)}
    ${breakdown.join("\n    ")}
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    ${amount("LineExtensionAmount", totals.net)}
    ${amount("TaxExclusiveAmount", totals.net)}
    ${amount("TaxInclusiveAmount", totals.gross)}
    ${amount("PayableAmount", totals.due)}
  </cac:LegalMonetaryTotal>
  ${positions.join("\n  ")}
</Invoice>
`;
}
