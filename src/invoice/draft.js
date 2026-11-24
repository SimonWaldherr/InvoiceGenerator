import { tr } from "../ui/i18n.js";

const profiles = ["EN16931", "XRECHNUNG"];
const vatCategories = ["S", "Z", "E", "AE"];
const paymentTypes = ["10", "30", "58"];
const layouts = ["classic", "modern", "minimal", "corporate"];
export const maxLogoBytes = 192 * 1024;
const maxLogoEdge = 4096;
const maxLogoPixels = 4_000_000;

function text(value) {
  return String(value ?? "").trim();
}

function mapParty(party = {}) {
  return {
    name: text(party.name),
    street: text(party.street),
    zip: text(party.zip),
    city: text(party.city),
    country: text(party.country),
    vatId: text(party.vat),
    taxId: text(party.fc),
    registrationId: text(party.reg),
    email: text(party.email),
    phone: text(party.phone),
    contactName: text(party.contactName),
    identifier: text(party.identifier),
    endpointId: text(party.endpointId),
    endpointScheme: text(party.endpointScheme),
  };
}

function mapLine(line, index) {
  const vatCat = text(line.cat).toUpperCase();
  const qty = line.qty;
  const price = line.price;
  const vatRate = line.rate;
  const disc = line.disc ?? 0;
  const pos = index + 1;

  if (!vatCategories.includes(vatCat)) {
    throw new Error(tr(
      `Position ${pos}: Bitte eine unterstützte USt-Kategorie wählen (S, Z, E oder AE).`,
      `Line ${pos}: Choose a supported VAT category (S, Z, E or AE).`,
    ));
  }
  if (![qty, price, vatRate, disc].every(Number.isFinite)) {
    throw new Error(tr(
      `Position ${pos}: Menge, Preis, USt-Satz und Rabatt müssen gültige Zahlen sein.`,
      `Line ${pos}: Quantity, price, VAT rate and discount must be valid numbers.`,
    ));
  }

  return {
    pos,
    name: text(line.name),
    desc: text(line.desc),
    qty,
    unit: text(line.unit),
    price,
    vatCat,
    vatRate,
    disc,
    vatExemptionReason: text(line.vatExemptionReason),
  };
}

function logoDimensions(bytes, header) {
  const byte = (offset) => bytes.charCodeAt(offset);
  const uint16 = (offset) => byte(offset) * 256 + byte(offset + 1);
  if (header === "data:image/png;base64" && bytes.startsWith("\x89PNG\r\n\x1a\n\x00\x00\x00\x0dIHDR")) {
    const uint32 = (offset) => uint16(offset) * 65536 + uint16(offset + 2);
    return [uint32(16), uint32(20)];
  }
  if (header !== "data:image/jpeg;base64" || !bytes.startsWith("\xff\xd8")) return [];

  const frameMarkers = [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf];
  for (let offset = 2; offset < bytes.length && byte(offset++) === 0xff;) {
    while (byte(offset) === 0xff) offset++;
    const marker = byte(offset++);
    if (marker === 0xda || marker === 0xd9) break;
    const segmentLength = uint16(offset);
    if (segmentLength < 2 || !(offset + segmentLength <= bytes.length)) break;
    if (segmentLength >= 8 && frameMarkers.includes(marker)) {
      return [uint16(offset + 5), uint16(offset + 3)];
    }
    offset += segmentLength;
  }
  return [];
}

export function supportedLogo(logo) {
  const dataUrl = logo?.dataUrl;
  if (typeof dataUrl !== "string") return undefined;
  const separator = dataUrl.indexOf(",");
  if (separator === -1) return undefined;
  const header = dataUrl.slice(0, separator);
  const encoded = dataUrl.slice(separator + 1);
  if (
    !encoded ||
    encoded.length % 4 !== 0 ||
    encoded.length > (maxLogoBytes / 3) * 4 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)
  ) {
    return undefined;
  }
  const [width, height] = logoDimensions(atob(encoded), header);
  if (width > 0 && height > 0 && width <= maxLogoEdge && height <= maxLogoEdge &&
    width * height <= maxLogoPixels) {
    return dataUrl;
  }
}

export function normalizeInvoiceDraft(snapshot, kind) {
  if (kind !== "pdf" && kind !== "xml") {
    throw new Error(tr("Bitte ein verfügbares Exportformat wählen.", "Choose an available export format."));
  }

  const {
    header = {},
    seller,
    buyer,
    payment = {},
    lines = [],
    meta,
  } = snapshot;
  const profile = text(header.profile).toUpperCase() || "EN16931";
  const syntax = text(header.syntax).toUpperCase() || "CII";
  if (!profiles.includes(profile)) {
    throw new Error(tr(
      "Bitte EN 16931 oder XRechnung als Rechnungsprofil wählen.",
      "Choose EN 16931 or XRechnung as the invoice profile.",
    ));
  }
  if (syntax !== "CII" && (syntax !== "UBL" || profile !== "XRECHNUNG")) {
    throw new Error(tr("Bitte CII wählen. UBL steht für XRechnung zur Verfügung.", "Choose CII. UBL is available for XRechnung."));
  }
  if (kind === "pdf" && profile !== "EN16931") {
    throw new Error(tr(
      "XRechnung steht als XML bereit. Für ein ZUGFeRD-PDF bitte EN 16931 und CII wählen.",
      "XRechnung is available as XML. Choose EN 16931 and CII for a ZUGFeRD PDF.",
    ));
  }

  const typeCode = text(payment.type) || "58";
  if (!paymentTypes.includes(typeCode)) {
    throw new Error(tr(
      "Bitte SEPA-Überweisung, Überweisung oder Barzahlung als Zahlungsart wählen.",
      "Choose SEPA transfer, bank transfer or cash as the payment method.",
    ));
  }
  const invoice = {
    profile,
    syntax,
    number: text(header.number),
    date: text(header.date),
    dueDate: text(header.dueDate),
    supplyDate: text(header.supplyDate),
    currency: text(header.currency),
    orderRef: text(header.orderRef),
    buyerRef: text(header.buyerRef),
    notes: text(header.notes),
    businessProcess: text(header.businessProcess),
    seller: mapParty(seller),
    buyer: mapParty(buyer),
    payment: {
      typeCode,
      iban: text(payment.iban),
      bic: text(payment.bic),
      account: text(payment.holder),
      terms: text(payment.terms),
      remittance: text(payment.remittance),
    },
    lines: lines.map(mapLine),
  };

  if (kind === "pdf") {
    const { layout, accentColor, language } = meta?.pdf ?? {};
    const appearance = {};
    const logoDataURL = supportedLogo(meta?.logo);
    invoice.style = layouts.includes(layout) ? layout : "classic";
    if (/^#[0-9a-f]{6}$/i.test(accentColor))
      appearance.accentColor = accentColor;
    if (language === "en") appearance.language = language;
    if (logoDataURL) appearance.logoDataURL = logoDataURL;
    if (Object.keys(appearance).length > 0) invoice.appearance = appearance;
  }

  return invoice;
}
