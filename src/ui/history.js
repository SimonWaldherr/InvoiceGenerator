import { csvCell } from "./line-csv.js";
import { tr } from "./i18n.js";
import { copyDraftForNewInvoice, normalizeDraft } from "./import-data.js";

export function historySummary(entry) {
  const { header, buyer, totals } = entry.snapshot;
  return {
    number: entry.number ?? header?.number ?? header?.invnum,
    date: entry.date ?? header?.date ?? header?.invdate,
    buyer: entry.buyer ?? buyer?.name,
    gross: entry.gross ?? totals?.gross,
    currency: entry.currency ?? header?.currency,
    profile: header?.profile,
    syntax: header?.syntax,
  };
}

function searchable(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/ß/g, "ss");
}

export function filterHistory(entries, query) {
  const cleaned = searchable(query).trim();
  if (!cleaned) return entries;
  const terms = cleaned.split(/\s+/);
  return entries.filter((entry) => {
    const { number, buyer } = historySummary(entry);
    const content = searchable(number) + "\n" + searchable(buyer);
    return terms.every((term) => content.includes(term));
  });
}

export function historyCsv(entries) {
  const header = tr(
    [
      "Rechnungsnummer",
      "Rechnungsdatum",
      "Kunde",
      "Brutto",
      "Währung",
      "Profil",
      "Syntax",
    ],
    [
      "Invoice number",
      "Invoice date",
      "Customer",
      "Gross",
      "Currency",
      "Profile",
      "Syntax",
    ],
  );
  const rows = entries.map((entry) => Object.values(historySummary(entry)));
  // The BOM helps spreadsheets recognize the UTF-8 encoding.
  return (
    "\uFEFF" +
    [header, ...rows]
      .map((row) => row.map((value) => csvCell(value)).join(","))
      .join("\r\n")
  );
}

export function draftFromHistory(entry, asCopy = false) {
  const draft = normalizeDraft(entry.snapshot, { requireContent: true });
  return asCopy ? copyDraftForNewInvoice(draft) : draft;
}
