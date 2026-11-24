import { pdfFontEngine } from "./font-engine.js";
import { PDFDocument, PDFName, rgb } from "pdf-lib";
import { addArchivalMetadata } from "./metadata.js";
import { pdfLabels } from "./labels.js";

const pageWidth = 595.28;
const pageHeight = 841.89;
const margin = 42;
const rightEdge = pageWidth - margin;
const lineHeight = 13;
const ink = rgb(0.1, 0.14, 0.19);
const muted = rgb(0.31, 0.35, 0.4);
const rule = rgb(0.8, 0.83, 0.86);
const band = rgb(0.94, 0.95, 0.96);

function partyDetails(party, labels) {
  return [
    party.street,
    `${party.zip} ${party.city} · ${party.country}`,
    party.contactName,
    party.email,
    party.phone,
    party.identifier && `${labels.identifier} ${party.identifier}`,
    party.registrationId && `${labels.registration} ${party.registrationId}`,
    party.vatId && `${labels.vatId} ${party.vatId}`,
    party.taxId && `${labels.taxId} ${party.taxId}`,
    party.endpointId &&
      `${labels.endpoint} ${party.endpointId} (${party.endpointScheme})`,
  ].filter(Boolean);
}

export async function buildLocalPDF(
  invoice,
  xml,
  { regularFont, boldFont, icc },
  locale = "de",
) {
  const pdfError = (german, english) => new Error(locale === "en" ? english : german);
  if (invoice.profile !== "EN16931" || invoice.syntax !== "CII") {
    throw pdfError(
      "Für ein lokales ZUGFeRD-PDF bitte EN 16931 und CII wählen.",
      "Choose EN 16931 and CII to generate a ZUGFeRD PDF.",
    );
  }
  const pdf = await PDFDocument.create({ updateMetadata: false });
  pdf.registerFontkit(pdfFontEngine);
  const regular = await pdf.embedFont(regularFont, { subset: true });
  const bold = await pdf.embedFont(boldFont, { subset: true });
  const characterSets = new Map([
    [regular, new Set(regular.getCharacterSet())],
    [bold, new Set(bold.getCharacterSet())],
  ]);
  const textWidths = new Map([
    [regular, new Map()],
    [bold, new Map()],
  ]);
  const { accentColor, logoDataURL, language } = invoice.appearance ?? {};
  const contentLanguage = language === "en" ? "en" : "de";
  const labels = pdfLabels[contentLanguage];
  pdf.setLanguage(contentLanguage);
  const accent = /^#[0-9a-f]{6}$/i.test(accentColor)
    ? rgb(
        ...accentColor
          .slice(1)
          .match(/../g)
          .map((value) => parseInt(value, 16) / 255),
      )
    : rgb(0.06, 0.3, 0.4);
  const groupSeparator = contentLanguage === "en" ? "," : ".";
  const decimalSeparator = contentLanguage === "en" ? "." : ",";
  const dateSeparator = contentLanguage === "en" ? "/" : ".";
  function formatDecimal(value, minimumDigits = 0) {
    const [whole, fraction = ""] = String(value).split(".");
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, groupSeparator);
    const decimals = fraction.replace(/0+$/, "").padEnd(minimumDigits, "0");
    return decimals ? grouped + decimalSeparator + decimals : grouped;
  }
  const dateLabel = (value) => value.split("-").reverse().join(dateSeparator);
  const money = (value) => formatDecimal(value.toFixed(2), 2);
  let page;
  let y;

  function measure(text, size, font) {
    // Shape repeated labels and wrap candidates once per font and size.
    // Keep each invoice's cache bounded, including long user fields.
    if (text.length > 256) return font.widthOfTextAtSize(text, size);
    const widths = textWidths.get(font);
    const key = `${size}\0${text}`;
    const cached = widths.get(key);
    if (cached !== undefined) return cached;
    const width = font.widthOfTextAtSize(text, size);
    if (widths.size < 4096) widths.set(key, width);
    return width;
  }

  function wrap(value, width, size = 10, font = regular) {
    const text = String(value).normalize("NFC").replace(/\t/g, " ");
    for (const character of text.replace(/[\r\n]/g, "")) {
      if (!characterSets.get(font).has(character.codePointAt(0))) {
        throw pdfError(
          `Das Zeichen „${character}“ kann mit der lokalen PDF-Schrift nicht dargestellt werden.`,
          `The PDF font cannot display “${character}”.`,
        );
      }
    }
    const result = [];
    for (const paragraph of text.split(/\r\n|\r|\n/)) {
      let line = "";
      for (let word of paragraph.trim().split(/ +/)) {
        const candidate = line ? `${line} ${word}` : word;
        if (measure(candidate, size, font) <= width) {
          line = candidate;
          continue;
        }
        if (line) result.push(line);
        while (measure(word, size, font) > width) {
          let end = 0;
          for (const character of word) {
            const next = end + character.length;
            if (measure(word.slice(0, next), size, font) > width)
              break;
            end = next;
          }
          if (!end)
            throw pdfError("Ein Textfeld ist für das lokale PDF zu breit.", "A text field is too wide for the PDF.");
          result.push(word.slice(0, end));
          word = word.slice(end);
        }
        line = word;
      }
      result.push(line);
    }
    return result;
  }

  function draw(
    text,
    x,
    baseline,
    { size = 10, font = regular, color = ink } = {},
  ) {
    if (text) page.drawText(text, { x, y: baseline, size, font, color });
  }

  function drawRight(text, edge, width, baseline, font = regular) {
    const size = Math.min(10, (10 * width) / measure(text, 10, font));
    if (size < 7)
      throw pdfError("Ein Zahlenfeld ist für das lokale PDF zu breit.", "A number is too wide for the PDF.");
    draw(text, edge - measure(text, size, font), baseline, {
      size,
      font,
    });
  }

  function startPage() {
    const continuation = page !== undefined;
    page = pdf.addPage([pageWidth, pageHeight]);
    page.drawRectangle({
      x: margin,
      y: 807,
      width: rightEdge - margin,
      height: 3,
      color: accent,
    });
    y = 785;
    if (continuation) {
      const [first, rest] = wrap(
        `${labels.invoice} ${invoice.number}`,
        rightEdge - margin - 12,
        10,
        bold,
      );
      draw(rest === undefined ? first : `${first} …`, margin, y, {
        font: bold,
      });
      y -= 24;
    }
  }

  function separate(baseline = y) {
    page.drawLine({
      start: { x: margin, y: baseline },
      end: { x: rightEdge, y: baseline },
      thickness: 0.6,
      color: rule,
    });
  }

  function ensure(height) {
    if (y - height >= 58) return false;
    startPage();
    return true;
  }

  function paragraph(
    text,
    {
      size = 10,
      font = regular,
      color = ink,
      x = margin,
      width = rightEdge - x,
    } = {},
  ) {
    for (const line of wrap(text, width, size, font)) {
      ensure(lineHeight);
      draw(line, x, y, { size, font, color });
      y -= lineHeight;
    }
  }

  function heading(text) {
    ensure(32);
    paragraph(text, { size: 12, font: bold });
    y -= 5;
  }

  function drawTwoColumns(blocks, firstRowHeight = lineHeight) {
    const gap = 30;
    const width = (rightEdge - margin - gap) / 2;
    const wrapped = blocks.map((block) =>
      block.flatMap(({ text, ...style }) =>
        wrap(text, width, style.size, style.font).map((line) => ({
          ...style,
          text: line,
        })),
      ),
    );
    const rows = Math.max(...wrapped.map((column) => column.length));
    for (let row = 0; row < rows; row += 1) {
      const height = row === 0 ? firstRowHeight : lineHeight;
      ensure(height);
      for (const [column, entries] of wrapped.entries()) {
        const entry = entries[row];
        if (entry) draw(entry.text, margin + column * (width + gap), y, entry);
      }
      y -= height;
    }
  }

  const columns = {
    position: margin + 8,
    description: margin + 42,
    quantity: 356,
    price: 455,
    net: rightEdge - 8,
  };
  function tableHeader() {
    page.drawRectangle({
      x: margin,
      y: y - 10,
      width: rightEdge - margin,
      height: 24,
      color: band,
    });
    draw(labels.position, columns.position, y, { font: bold });
    draw(labels.item, columns.description, y, { font: bold });
    drawRight(labels.quantity, columns.quantity, 90, y, bold);
    drawRight(labels.unitPrice, columns.price, 94, y, bold);
    drawRight(labels.net, columns.net, 86, y, bold);
    y -= 25;
  }

  startPage();
  draw(labels.invoice, margin, y - 9, { font: bold, size: 27 });
  y -= 39;
  if (logoDataURL) {
    const logo = logoDataURL.startsWith("data:image/png;")
      ? await pdf.embedPng(logoDataURL)
      : await pdf.embedJpg(logoDataURL);
    await logo.embed();
    const colorSpace = pdf.context
      .lookup(logo.ref)
      .dict.lookup(PDFName.of("ColorSpace"));
    if (colorSpace === PDFName.of("DeviceCMYK")) {
      throw pdfError(
        "Bitte ein RGB- oder Graustufenlogo für den lokalen PDF-Export verwenden.",
        "Use an RGB or greyscale logo for PDF export.",
      );
    }
    const size = logo.scaleToFit(130, 38);
    page.drawImage(logo, {
      x: rightEdge - size.width,
      y: 788 - size.height,
      ...size,
    });
  }
  paragraph(`${labels.number}  ${invoice.number}`);
  const invoiceDatesAndReferences = [
    [
      `${labels.date}  ${dateLabel(invoice.date)}`,
      invoice.buyerRef && `${labels.buyerRef}  ${invoice.buyerRef}`,
    ],
    [
      invoice.supplyDate && `${labels.supply}  ${dateLabel(invoice.supplyDate)}`,
      invoice.orderRef && `${labels.orderRef}  ${invoice.orderRef}`,
    ],
  ];
  drawTwoColumns(
    invoiceDatesAndReferences.map((column) =>
      column.filter(Boolean).map((text) => ({ text })),
    ),
  );
  y -= 12;
  const parties = [
    [labels.seller, invoice.seller],
    [labels.buyer, invoice.buyer],
  ].map(([label, party]) => [
    { text: label, font: bold, size: 12 },
    { text: party.name, font: bold },
    ...partyDetails(party, labels).map((text) => ({ text, color: muted })),
  ]);
  ensure(32);
  drawTwoColumns(parties, 20);
  y -= 16;

  ensure(80);
  tableHeader();
  for (const [index, item] of invoice.lines.entries()) {
    const itemWidth = 198;
    const description = [
      ...wrap(item.name, itemWidth, 10, bold).map((line) => [line, bold]),
      ...[
        item.desc,
        item.disc ? `${labels.discount} ${formatDecimal(item.disc)} %` : "",
        `${labels.vat} ${formatDecimal(item.vatRate)} % (${item.vatCat})`,
      ]
        .filter(Boolean)
        .flatMap((value) =>
          wrap(value, itemWidth).map((line) => [line, regular]),
        ),
    ];
    if (ensure(Math.min(description.length, 3) * lineHeight + 13))
      tableHeader();
    for (const [lineIndex, [line, font]] of description.entries()) {
      if (ensure(lineHeight + 5)) {
        tableHeader();
        draw(String(index + 1), columns.position, y, { font: bold });
      }
      if (lineIndex === 0) {
        draw(String(index + 1), columns.position, y);
        drawRight(
          `${formatDecimal(item.qty)} ${item.unit}`,
          columns.quantity,
          67,
          y,
        );
        drawRight(formatDecimal(item.netUnitPrice, 2), columns.price, 94, y);
        drawRight(money(item.lineNet), columns.net, 86, y);
      }
      draw(line, columns.description, y, {
        font,
        color: font === regular ? muted : ink,
      });
      y -= lineHeight;
    }
    separate(y + 4);
    y -= 10;
  }

  function amount(label, value, font = regular) {
    ensure(lineHeight);
    draw(label, margin + 8, y, { font });
    drawRight(`${money(value)} ${invoice.currency}`, columns.net, 139, y, font);
    y -= lineHeight;
  }

  ensure(19 + (4 + invoice.taxes.length) * lineHeight);
  heading(labels.totals);
  amount(labels.netTotal, invoice.totals.net);
  for (const tax of invoice.taxes) {
    amount(
      `${labels.taxLabel[tax.cat]} ${formatDecimal(tax.rate)} % ${labels.on} ${money(tax.base)} ${invoice.currency}`,
      tax.tax,
    );
    if (tax.exemptionReason)
      paragraph(tax.exemptionReason, { color: muted, x: margin + 8 });
  }
  ensure(3 * lineHeight + 7);
  amount(labels.taxTotal, invoice.totals.tax);
  amount(labels.gross, invoice.totals.gross);
  ensure(lineHeight + 7);
  separate(y + 8);
  amount(labels.due, invoice.totals.due, bold);

  y -= 12;
  heading(labels.payment);
  const bankTransfer =
    invoice.payment.typeCode === "30" || invoice.payment.typeCode === "58";
  const payment = [
    [
      labels.paymentType[invoice.payment.typeCode],
      bankTransfer &&
        invoice.payment.account &&
        `${labels.account} ${invoice.payment.account}`,
      bankTransfer && invoice.payment.iban && `IBAN ${invoice.payment.iban}`,
      bankTransfer && invoice.payment.bic && `BIC ${invoice.payment.bic}`,
    ],
    [
      invoice.dueDate && `${labels.dueDate} ${dateLabel(invoice.dueDate)}`,
      invoice.payment.terms,
      invoice.payment.remittance &&
        `${labels.remittance} ${invoice.payment.remittance}`,
    ],
  ];
  drawTwoColumns(
    payment.map((column) => column.filter(Boolean).map((text) => ({ text }))),
  );
  if (invoice.notes) {
    y -= 10;
    heading(labels.notes);
    paragraph(invoice.notes);
  }
  const pages = pdf.getPages();
  for (const [index, currentPage] of pages.entries()) {
    page = currentPage;
    separate(42);
    drawRight(`${labels.page} ${index + 1} / ${pages.length}`, rightEdge, 78, 26);
  }
  await addArchivalMetadata(pdf, invoice, xml, icc, locale, contentLanguage);
  return pdf.save({ useObjectStreams: false });
}
