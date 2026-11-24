import { maxDraftLines } from "./import-data.js";
import { tr } from "./i18n.js";

const columns = [
  ["pos", "Pos", "Item"],
  ["name", "Produkt", "Product"],
  ["desc", "Beschreibung", "Description"],
  ["qty", "Menge", "Quantity"],
  ["unit", "Einheit", "Unit"],
  ["price", "Einzelpreis", "Unit price"],
  ["cat", "USt-Kat", "VAT category"],
  ["rate", "USt-%", "VAT rate"],
  ["disc", "Rabatt%", "Discount%"],
  ["lineNet", "Netto", "Net"],
  ["lineTax", "Steuer", "Tax"],
  ["lineGross", "Brutto", "Gross"],
  ["vatExemptionReason", "USt-Befreiungsgrund", "VAT exemption reason"],
];

const requiredColumns = ["name", "qty", "unit", "price", "cat", "rate"];
const numericColumns = new Set([
  "qty",
  "price",
  "rate",
  "disc",
  "lineNet",
  "lineTax",
  "lineGross",
]);
const columnByLabel = new Map(
  columns.flatMap(([name, german, english]) =>
    [german, english].map((label) => [label.toLowerCase(), name]),
  ),
);
const invalidTextCharacter =
  /[\x00-\x08\x0B\x0C\x0E-\x1F\u007f\uD800-\uDFFF\uFFFE\uFFFF]/u;
const maxCsvBytes = 8 * 1024 * 1024;

function needsFormulaGuard(text) {
  return (
    /^[\s\p{Cf}]*[=+@＝＋－＠-]/u.test(text) || /^[\x00-\x1f\x7f]/.test(text)
  );
}

export function csvCell(value, reversible = false) {
  const text = String(value ?? "");
  const guarded =
    needsFormulaGuard(text) || (reversible && text.startsWith("'"));
  const safe = guarded ? "'" + text : text;
  return '"' + safe.replace(/"/g, '""') + '"';
}

export function serializeLineCsv(lines, locale) {
  const header = columns.map(([, german, english]) =>
    locale === "en" ? english : german,
  );
  const records = lines.map((line) =>
    columns
      .map(([key]) => {
        const value = line[key];
        if (!numericColumns.has(key)) return csvCell(value, true);
        return Number.isFinite(value) ? value : "";
      })
      .join(","),
  );
  return [header.join(","), ...records].join("\n");
}

function csvError(row, german, english) {
  return new Error(
    tr(`CSV-Datensatz ${row}: ${german}`, `CSV record ${row}: ${english}`),
  );
}

function* readRecords(source, separator) {
  let row = [];
  let cell = "";
  let quoted = false;
  let closedQuote = false;
  let record = 1;

  for (let index = 0; index <= source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
        closedQuote = true;
      } else if (character === undefined) {
        throw csvError(
          record,
          "Anführungszeichen nicht geschlossen.",
          "Unclosed quoted field.",
        );
      } else {
        cell += character;
      }
    } else if (
      character === separator ||
      character === "\n" ||
      character === undefined
    ) {
      row.push(cell);
      if (row.length > columns.length) {
        throw csvError(record, "Zu viele Spalten.", "Too many columns.");
      }
      cell = "";
      closedQuote = false;
      if (character !== separator) {
        yield { cells: row, record };
        row = [];
        record += 1;
      }
    } else if (character === '"' && cell === "" && !closedQuote) {
      quoted = true;
    } else if (character === '"' || closedQuote) {
      throw csvError(
        record,
        "Ungültige Anführungszeichen.",
        "Invalid use of quotes.",
      );
    } else {
      cell += character;
    }
  }
}

function readHeader(source) {
  for (const separator of [",", ";"]) {
    const records = readRecords(source, separator);
    let labels;
    try {
      labels = records
        .next()
        .value.cells.map((value) => value.trim().toLowerCase());
    } catch {
      continue;
    }
    const fields = labels.map((label) => columnByLabel.get(label));
    if (
      fields.includes(undefined) ||
      new Set(fields).size !== fields.length ||
      !requiredColumns.every((key) => fields.includes(key))
    ) {
      continue;
    }
    // The extended native export marks protected text with an apostrophe and
    // doubles original leading apostrophes. Legacy and shortened CSVs keep them literal.
    const reversible =
      separator === "," &&
      fields.length === columns.length &&
      [1, 2].some((locale) =>
        columns.every(
          (column, i) => column[locale].toLowerCase() === labels[i],
        ),
      );
    return { fields, records, reversible };
  }
  throw new Error(
    tr(
      "Die CSV-Kopfzeile benötigt Produkt, Menge, Einheit, Einzelpreis, USt-Kat und USt-%. Verwenden Sie Komma oder Semikolon als Spaltentrenner.",
      "The CSV header needs Product, Quantity, Unit, Unit price, VAT category and VAT rate. Use a comma or semicolon between columns.",
    ),
  );
}

function readText(raw = "", reversible) {
  if (reversible && raw.startsWith("'")) {
    const original = raw.slice(1);
    if (original.startsWith("'") || needsFormulaGuard(original))
      return original.trim();
  }
  return raw.trim();
}

function decimal(raw, min, max, places) {
  const value = raw?.trim();
  if (!/^\d*(?:[,.]\d+)?$/.test(value) || !value) return NaN;
  const fraction = value.split(/[,.]/)[1];
  const number = Number(value.replace(",", "."));
  return (fraction?.length ?? 0) <= places && number >= min && number <= max
    ? number
    : NaN;
}

function parseLine(fields, cells, record, index, reversible) {
  if (cells.length !== fields.length) {
    throw csvError(
      record,
      "Die Spaltenzahl muss der Kopfzeile entsprechen.",
      "The column count must match the header.",
    );
  }
  const values = Object.fromEntries(fields.map((key, i) => [key, cells[i]]));
  const name = readText(values.name, reversible);
  const pos = readText(values.pos, reversible) || String(index + 1);
  const desc = readText(values.desc, reversible);
  const unit = readText(values.unit, reversible).toUpperCase();
  const cat = readText(values.cat, reversible).toUpperCase();
  const vatExemptionReason = readText(values.vatExemptionReason, reversible);

  if (
    !name ||
    [pos, name, vatExemptionReason].some((text) => text.includes("\n")) ||
    [pos, name, desc, vatExemptionReason].some((text) =>
      invalidTextCharacter.test(text),
    )
  ) {
    throw csvError(
      record,
      "Produktname fehlt oder eine Textspalte enthält unzulässige Zeichen oder Zeilenumbrüche.",
      "The product name is missing or a text column contains unsupported characters or line breaks.",
    );
  }
  if (
    !/^[A-Z0-9]{2,3}$/.test(unit) ||
    !["S", "Z", "E", "AE", "K"].includes(cat)
  ) {
    throw csvError(
      record,
      "Einheit oder USt-Kategorie ist ungültig. Verwenden Sie beispielsweise C62 oder HUR und S, Z, E oder AE.",
      "Invalid unit or VAT category. For example, use C62 or HUR with S, Z, E or AE.",
    );
  }
  if (vatExemptionReason && cat !== "E" && cat !== "AE") {
    throw csvError(
      record,
      "Ein USt-Befreiungsgrund ist nur bei E oder AE zulässig.",
      "A VAT exemption reason is allowed only for E or AE.",
    );
  }

  const qty = decimal(values.qty, 0.0001, 1e6, 4);
  const price = decimal(values.price, 0, 1e9, 4);
  const rate = decimal(values.rate, 0, 100, 2);
  const disc = values.disc?.trim() ? decimal(values.disc, 0, 100, 2) : 0;
  if (![qty, price, rate, disc].every(Number.isFinite)) {
    throw csvError(
      record,
      "Menge, Einzelpreis, USt-Satz oder Rabatt enthält eine ungültige Zahl.",
      "Quantity, unit price, VAT rate or discount contains an invalid number.",
    );
  }
  if (cat === "S" ? rate === 0 : cat !== "K" && rate !== 0) {
    throw csvError(
      record,
      "USt-Satz passt nicht zur Steuerkategorie.",
      "The VAT rate does not match the VAT category.",
    );
  }
  return {
    pos,
    name,
    desc,
    qty,
    unit,
    price,
    cat,
    rate,
    vatExemptionReason,
    disc,
  };
}

export function parseLineCsv(text) {
  const source = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const { fields, records, reversible } = readHeader(source);
  const lines = [];
  for (const { cells, record } of records) {
    if (cells.every((cell) => !cell.trim())) continue;
    if (lines.length >= maxDraftLines) {
      throw new Error(
        tr(
          `Eine CSV-Datei darf höchstens ${maxDraftLines} Positionen enthalten.`,
          `A CSV file can contain up to ${maxDraftLines} line items.`,
        ),
      );
    }
    lines.push(parseLine(fields, cells, record, lines.length, reversible));
  }
  if (!lines.length) {
    throw new Error(
      tr(
        "Die CSV-Datei enthält keine Positionen.",
        "The CSV file contains no line items.",
      ),
    );
  }
  return lines;
}

export async function readLineCsv(file) {
  if (file.size > maxCsvBytes) {
    throw new Error(
      tr("Die CSV-Datei ist größer als 8 MiB.", "The CSV file exceeds 8 MiB."),
    );
  }
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(
      await file.arrayBuffer(),
    );
  } catch {
    throw new Error(
      tr(
        "Bitte eine lesbare UTF-8-CSV-Datei wählen.",
        "Choose a readable UTF-8 CSV file.",
      ),
    );
  }
  return parseLineCsv(text);
}
