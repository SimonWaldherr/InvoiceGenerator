import { invoiceAmounts } from "./amounts.js";
import { normalizeInvoiceDraft } from "./draft.js";
import { endpointSchemes, isCountryCode, isVatCountryCode } from "./codes.js";
import { tr } from "../ui/i18n.js";

const currencies = new Set(["EUR", "CHF", "GBP", "USD"]);
const units = new Set([
  "C62",
  "H87",
  "EA",
  "HUR",
  "DAY",
  "MIN",
  "MON",
  "ANN",
  "KGM",
  "GRM",
  "LTR",
  "MTR",
  "MTK",
  "MTQ",
  "KWH",
  "TNE",
  "SET",
]);

function verifyDate(value, name, required = false) {
  if (!value && !required) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error(
      tr(`${name} fehlt oder ist ungültig.`, `${name} is missing or invalid.`),
    );
  const date = new Date(value + "T00:00:00Z");
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value ||
    value.startsWith("0000")
  ) {
    throw new Error(tr(`${name} ist ungültig.`, `${name} is invalid.`));
  }
}

function verifyParty(party, label, syntax) {
  for (const [value, field] of [
    [party.name, "Name"],
    [party.street, tr("Straße", "street")],
    [party.zip, tr("PLZ", "postal code")],
    [party.city, tr("Ort", "city")],
  ]) {
    if (!value)
      throw new Error(
        label + ": " + tr(`${field} fehlt.`, `missing ${field}.`),
      );
  }
  if (!isCountryCode(party.country, syntax)) {
    throw new Error(
      label +
        ": " +
        tr(
          "Bitte einen gültigen Ländercode angeben (z. B. DE).",
          "Enter a valid country code, for example DE.",
        ),
    );
  }
  if (
    party.vatId &&
    (party.vatId.length < 3 ||
      !isVatCountryCode(party.vatId.slice(0, 2), syntax))
  ) {
    throw new Error(
      label +
        ": " +
        tr(
          "Die USt-IdNr. benötigt ein gültiges Länderpräfix (z. B. DE).",
          "The VAT ID requires a valid country prefix, for example DE.",
        ),
    );
  }
  if (!party.endpointId && !party.endpointScheme) return;
  if (!party.endpointId || !party.endpointScheme) {
    throw new Error(
      label +
        ": " +
        tr(
          "Elektronische Adresse und Adressschema gehören zusammen.",
          "Enter both the electronic address and its scheme.",
        ),
    );
  }
  if (!endpointSchemes.has(party.endpointScheme)) {
    throw new Error(
      label +
        ": " +
        tr(
          "Bitte ein gültiges Adressschema (EAS) angeben, z. B. EM oder 0204.",
          "Enter a valid electronic address scheme (EAS), for example EM or 0204.",
        ),
    );
  }
  if (
    party.endpointScheme === "EM" &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(party.endpointId)
  ) {
    throw new Error(
      label +
        ": " +
        tr(
          "Für EM ist eine E-Mail-Adresse erforderlich.",
          "Scheme EM requires an email address.",
        ),
    );
  }
}

function xrechnungPaymentTerms(terms) {
  const text = terms.replace(/\r\n?/g, "\n");
  const skontoLine =
    /^#SKONTO#TAGE=\d+#PROZENT=\d+\.\d{2}(?:#BASISBETRAG=-?\d+\.\d{2})?#$/;
  const hashLines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("#"));
  if (!hashLines.length) return text;
  if (hashLines.some((line) => !skontoLine.test(line))) {
    throw new Error(
      tr(
        "Skonto für XRechnung im Format #SKONTO#TAGE=10#PROZENT=2.00# angeben.",
        "Enter XRechnung early payment discounts as #SKONTO#TAGE=10#PROZENT=2.00#.",
      ),
    );
  }

  // BR-DE-18 checks the text after the final hash-delimited block, even
  // when that block is part of an otherwise free-text payment term.
  const tail = text.split(/#[^\n]+#/).pop();
  if (tail === "") return text + "\n";
  if (!/^[ \t]*\n/.test(tail)) {
    throw new Error(
      tr(
        "Text mit #…# bitte vor die Skontozeilen schreiben oder nach dem letzten # eine neue Zeile beginnen.",
        "Place text with #…# before the discount lines, or start a new line after the last #.",
      ),
    );
  }
  return text;
}

export function validIBAN(iban) {
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  let remainder = 0;
  for (const char of iban.slice(4) + iban.slice(0, 4)) {
    const code = char.charCodeAt(0);
    remainder =
      (code >= 65 ? remainder * 100 + code - 55 : remainder * 10 + code - 48) %
      97;
  }
  return remainder === 1;
}

function verifyXMLText(value) {
  if (typeof value === "object" && value !== null) {
    for (const field of Object.values(value)) verifyXMLText(field);
  } else if (
    typeof value === "string" &&
    /[\x00-\x08\x0B\x0C\x0E-\x1F\uD800-\uDFFF\uFFFE\uFFFF]/u.test(value)
  ) {
    throw new Error(
      tr(
        "Eine Eingabe enthält ein in XML unzulässiges Zeichen.",
        "An entry contains a character that is invalid in XML.",
      ),
    );
  }
}

export function prepareLocalInvoice(snapshot, kind) {
  const invoice = normalizeInvoiceDraft(snapshot, kind);
  const { seller, buyer, payment } = invoice;
  if (!invoice.number || invoice.number.length > 80)
    throw new Error(
      tr(
        "Rechnungsnummer erforderlich (maximal 80 Zeichen).",
        "Enter an invoice number of up to 80 characters.",
      ),
    );
  verifyDate(invoice.date, tr("Rechnungsdatum", "Invoice date"), true);
  verifyDate(invoice.supplyDate, tr("Leistungsdatum", "Supply date"), true);
  verifyDate(invoice.dueDate, tr("Fälligkeitsdatum", "Due date"));
  if (invoice.dueDate && invoice.dueDate < invoice.date)
    throw new Error(
      tr(
        "Die Fälligkeit liegt vor dem Rechnungsdatum.",
        "The due date precedes the invoice date.",
      ),
    );
  if (!currencies.has(invoice.currency))
    throw new Error(
      tr(
        "Der lokale Export unterstützt EUR, CHF, GBP und USD.",
        "Local export supports EUR, CHF, GBP and USD.",
      ),
    );
  verifyParty(seller, tr("Verkäufer", "Seller"), invoice.syntax);
  verifyParty(buyer, tr("Käufer", "Buyer"), invoice.syntax);
  if (
    !seller.vatId &&
    (!seller.taxId || (!seller.identifier && !seller.registrationId))
  ) {
    throw new Error(
      tr(
        "Verkäufer: Bitte eine USt-IdNr. oder eine Steuernummer mit Verkäuferkennung oder Registerkennung angeben.",
        "Seller: enter a VAT ID, or a tax number together with a seller or registration identifier.",
      ),
    );
  }
  if (
    invoice.profile === "XRECHNUNG" &&
    (!invoice.buyerRef ||
      !invoice.businessProcess ||
      !seller.contactName ||
      !seller.email ||
      !seller.phone ||
      !seller.endpointId ||
      !buyer.endpointId)
  ) {
    throw new Error(
      tr(
        "XRechnung benötigt Käuferreferenz, Geschäftsprozess, Verkäuferkontakt mit Telefon und E-Mail sowie elektronische Adressen für beide Parteien.",
        "XRechnung requires a buyer reference, a business process, a seller contact with phone and email, and electronic addresses for both parties.",
      ),
    );
  }
  if (invoice.profile === "XRECHNUNG")
    payment.terms = xrechnungPaymentTerms(payment.terms);

  if (!invoice.dueDate && !payment.terms)
    throw new Error(
      tr(
        "Fälligkeitsdatum oder Zahlungsbedingungen erforderlich.",
        "Enter a due date or payment terms.",
      ),
    );
  if (payment.typeCode !== "10" && !validIBAN(payment.iban))
    throw new Error(
      tr(
        "Für eine Überweisung ist eine gültige IBAN erforderlich.",
        "A bank transfer requires a valid IBAN.",
      ),
    );
  if (payment.typeCode === "58" && invoice.currency !== "EUR")
    throw new Error(
      tr(
        "Für SEPA-Überweisung muss die Rechnung auf EUR lauten.",
        "A SEPA transfer requires an invoice in EUR.",
      ),
    );
  if (
    payment.typeCode !== "10" &&
    payment.bic &&
    !/^[A-Z]{6}[A-Z0-9]{2}(?:[A-Z0-9]{3})?$/.test(payment.bic)
  ) {
    throw new Error(
      tr(
        "BIC muss aus 8 oder 11 gültigen Zeichen bestehen.",
        "The BIC must contain 8 or 11 valid characters.",
      ),
    );
  }

  if (!invoice.lines.length || invoice.lines.length > 1000)
    throw new Error(
      tr(
        "Der lokale Export unterstützt 1 bis 1000 Positionen.",
        "Local export supports 1 to 1,000 invoice lines.",
      ),
    );
  const exemptions = new Map();
  for (const line of invoice.lines) {
    const prefix = tr(`Position ${line.pos}: `, `Line ${line.pos}: `);
    if (
      !line.name ||
      line.qty <= 0 ||
      line.qty > 1e6 ||
      line.price < 0 ||
      line.price > 1e9
    ) {
      throw new Error(
        prefix +
          tr(
            "Name, Menge oder Einzelpreis fehlen oder liegen außerhalb des zulässigen Bereichs.",
            "The name, quantity or unit price is missing or outside the supported range.",
          ),
      );
    }
    if (!units.has(line.unit))
      throw new Error(
        prefix +
          tr(
            "Einheit im lokalen Export nicht verfügbar. Übliche Einheiten sind C62, HUR, DAY und KGM.",
            "This unit is unavailable for local export. Common units are C62, HUR, DAY and KGM.",
          ),
      );
    const exempt = line.vatCat === "E" || line.vatCat === "AE";
    if (
      line.vatCat === "S"
        ? line.vatRate <= 0 || line.vatRate > 100
        : line.vatRate !== 0
    ) {
      throw new Error(
        prefix +
          tr(
            "USt-Satz passt nicht zur Steuerkategorie.",
            "The VAT rate does not match the VAT category.",
          ),
      );
    }
    if (exempt !== Boolean(line.vatExemptionReason)) {
      throw new Error(
        prefix +
          tr(
            "Steuerbefreiungsgründe sind bei E und AE erforderlich und bei anderen Kategorien unzulässig.",
            "A VAT exemption reason is required for E and AE, and disallowed for other categories.",
          ),
      );
    }
    if (line.vatCat === "AE" && (!seller.vatId || !buyer.vatId))
      throw new Error(
        prefix +
          tr(
            "Reverse Charge benötigt beide USt-IdNr.",
            "Reverse charge requires both parties’ VAT IDs.",
          ),
      );
    if (
      exempt &&
      exemptions.has(line.vatCat) &&
      exemptions.get(line.vatCat) !== line.vatExemptionReason
    ) {
      throw new Error(
        prefix +
          tr(
            "Pro Steuerkategorie ist derselbe Befreiungsgrund erforderlich.",
            "Use the same exemption reason for every line in this VAT category.",
          ),
      );
    }
    if (exempt) exemptions.set(line.vatCat, line.vatExemptionReason);
  }

  verifyXMLText(invoice);
  const { lines, taxBreakdown, totals } = invoiceAmounts(
    invoice.lines.map((line) => ({
      ...line,
      cat: line.vatCat,
      rate: line.vatRate,
    })),
  );
  if (totals.gross === null)
    throw new Error(
      tr(
        "Ungültige Beträge. Menge und Preis erlauben vier, USt-Satz und Rabatt zwei Nachkommastellen. Rabatt muss zwischen 0 und 100 liegen.",
        "Invalid amounts. Quantity and unit price allow four decimal places, VAT rate and discount allow two. The discount must be between 0 and 100.",
      ),
    );
  if (totals.gross <= 0 || totals.gross > 1e12)
    throw new Error(
      tr(
        "Der lokale Export benötigt einen positiven Rechnungsbetrag bis 1 Billion.",
        "Local export requires a positive invoice total up to one trillion.",
      ),
    );
  return {
    ...invoice,
    lines,
    taxes: taxBreakdown.map((tax) => ({
      ...tax,
      exemptionReason: exemptions.get(tax.cat) || "",
    })),
    totals,
  };
}
