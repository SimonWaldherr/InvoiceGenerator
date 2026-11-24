import { language, tr } from "./i18n.js";

export function recordLabel(record) {
  return typeof record.label === "string" && record.label.trim()
    ? record.label.trim()
    : record.name;
}

function searchText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/ß/g, "ss");
}

export function masterRecordMatches(record, query) {
  const fields = [
    recordLabel(record),
    record.name,
    record.street,
    record.zip,
    record.city,
    record.country,
    record.vat,
    record.endpointId,
    record.buyerRef,
    record.identifier,
    record.contactName,
    record.email,
  ];
  const text = searchText(fields.join("\n"));
  return searchText(query)
    .trim()
    .split(/\s+/)
    .every((term) => text.includes(term));
}

export function sameRecord(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function masterRecordOptions({ select, search, records, onSelection }) {
  let visible = [];
  const selected = () =>
    select.value === "" ? undefined : visible[Number(select.value)];
  function refresh(preferred = selected()) {
    const previouslySelected = selected();
    const list = records();
    visible = list
      .filter((record) => masterRecordMatches(record, search.value))
      .sort((a, b) => recordLabel(a).localeCompare(recordLabel(b), language()));
    select.replaceChildren(
      new Option(
        list.length && !visible.length
          ? tr("Keine Treffer", "No matches")
          : tr("— Bitte auswählen —", "— Choose a record —"),
        "",
      ),
    );
    visible.forEach((record, index) => {
      const label = [
        recordLabel(record),
        record.street,
        record.city,
        record.buyerRef,
      ]
        .filter(Boolean)
        .join(" · ");
      select.add(new Option(label, String(index)));
    });
    const index =
      preferred === undefined
        ? -1
        : visible.findIndex((record) => sameRecord(record, preferred));
    select.value = index < 0 ? "" : String(index);
    if (
      preferred !== previouslySelected ||
      !sameRecord(previouslySelected, selected())
    ) {
      onSelection(selected());
    }
  }
  search.addEventListener("input", () => refresh());
  select.addEventListener("change", () => onSelection(selected()));
  return { refresh, selected };
}
