import { $, $$ } from "../utils.js";
import { invoiceAmounts } from "../invoice/amounts.js";
import { storageKeys, writeStored } from "./storage.js";
import { maxDraftLines } from "./import-data.js";
import { formatNumber, formatRate, localeChangeEvent, tr } from "./i18n.js";
import { notify } from "./notify.js";

const vatCategories = ["S", "Z", "E", "AE", "K"];
const defaultLine = { price: 100, qty: 1, rate: 19, cat: "S" };
let unitDefault = "C62";

const cellLabels = {
  pos: ["Position", "Line"],
  name: ["Produktname", "Item name"],
  qty: ["Menge", "Quantity"],
  unit: ["Einheit", "Unit"],
  price: ["Einzelpreis (netto)", "Unit price (excl. VAT)"],
  disc: ["Rabatt (%)", "Discount (%)"],
  desc: ["Beschreibung", "Description"],
  vatcat: ["USt-Kategorie", "VAT category"],
  vatrate: ["USt-Satz (%)", "VAT rate (%)"],
  vatexemption: ["USt-Befreiungsgrund", "VAT exemption reason"],
};

// Visible captions that need to be shorter than the accessible name.
const shortCaptions = {
  pos: ["Pos.", "No."],
  price: ["Einzelpreis (netto)", "Unit price (net)"],
};

const amountLabels = {
  net: ["Netto", "Net"],
  tax: ["MwSt", "VAT"],
  gross: ["Brutto", "Gross"],
};

const icons = {
  dup: '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false"><rect x="7" y="7" width="9" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M13 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  del: '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false"><path d="M4 6h12M8 6V4h4v2m-6 0 .6 9.2a1 1 0 0 0 1 .8h4.8a1 1 0 0 0 1-.8L14 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

function localizeRow(row) {
  for (const cell of row.querySelectorAll("[data-column]")) {
    const column = cell.dataset.column;
    const label = tr(...cellLabels[column]);
    cell.querySelector(".cell-label").textContent = shortCaptions[column]
      ? tr(...shortCaptions[column])
      : label;
    cell.querySelector("input,select,textarea")?.setAttribute("aria-label", label);
  }
  for (const label of row.querySelectorAll("[data-amount]")) {
    label.textContent = tr(...amountLabels[label.dataset.amount]);
  }
  localizeRowActions(row);
}

function localizeRowActions(row) {
  const position = row.querySelector(".pos").value;
  for (const [selector, label, text] of [
    [
      ".dup",
      tr(`Position ${position} duplizieren`, `Duplicate line ${position}`),
      tr("Duplizieren", "Duplicate"),
    ],
    [
      ".del",
      tr(`Position ${position} löschen`, `Delete line ${position}`),
      tr("Löschen", "Delete"),
    ],
  ]) {
    const button = row.querySelector(selector);
    button.setAttribute("aria-label", label);
    button.title = label;
    button.querySelector(".btn-text").textContent = text;
  }
}

export function getUnitDefault() {
  return unitDefault;
}

export function setUnitDefault(value) {
  unitDefault = value || "C62";
  $("#unitDefaultLbl").textContent = unitDefault;
}

function cell(column, control) {
  return `<td data-column="${column}" role="cell"><span class="cell-label" aria-hidden="true"></span>${control}</td>`;
}

function appendRow(body, pref) {
  const r = document.createElement("tr");
  r.setAttribute("role", "row");
  const exemption = $("#items [data-field=vatExemptionReason]")
    ? cell("vatexemption", '<input class="vatexemption" autocomplete="off"/>')
    : "";
  // The cell order is the keyboard order, so it follows the visual order.
  r.innerHTML = [
    cell("pos", '<input class="pos" inputmode="numeric" autocomplete="off"/>'),
    cell("name", '<input class="name" autocomplete="off" required/>'),
    cell(
      "qty",
      '<input class="qty" type="number" inputmode="decimal" step="0.0001" min="0.0001" required/>',
    ),
    cell("unit", '<input class="unit" autocomplete="off"/>'),
    cell(
      "price",
      '<input class="price" type="number" inputmode="decimal" step="0.0001" min="0" required/>',
    ),
    cell(
      "disc",
      '<input class="disc" type="number" inputmode="decimal" step="0.01" min="0" max="100"/>',
    ),
    cell("desc", '<textarea class="desc" rows="1"></textarea>'),
    cell(
      "vatcat",
      `<select class="vatcat">${vatCategories.map((category) => `<option value="${category}">${category}</option>`).join("")}</select>`,
    ),
    cell(
      "vatrate",
      '<input class="vatrate" type="number" inputmode="decimal" step="0.01" min="0" required/>',
    ),
    exemption,
    `<td class="line-amounts" role="cell">
      <div class="amount"><span class="amount-label" data-amount="net"></span><span class="lnet"></span></div>
      <div class="amount"><span class="amount-label" data-amount="tax"></span><span class="ltax"></span></div>
      <div class="amount amount-gross"><span class="amount-label" data-amount="gross"></span><span class="lgross"></span></div>
    </td>`,
    `<td class="line-actions" role="cell">
      <button class="ghost icon-button dup" type="button">${icons.dup}<span class="btn-text"></span></button>
      <button class="red icon-button del" type="button">${icons.del}<span class="btn-text"></span></button>
    </td>`,
  ].join("");
  const defaults = {
    pos: pref?.pos || body.children.length + 1,
    name: pref?.name ?? "",
    desc: pref?.desc ?? "",
    qty: pref?.qty ?? 1,
    unit: pref?.unit ?? unitDefault,
    price: pref?.price ?? 0,
    vatcat: pref?.cat || "S",
    vatrate: pref?.rate ?? 19,
    vatexemption: pref?.vatExemptionReason ?? "",
    disc: pref?.disc ?? 0,
  };
  for (const [field, value] of Object.entries(defaults)) {
    const input = r.querySelector("." + field);
    if (input) input.value = value;
  }
  localizeRow(r);
  body.append(r);
  return r;
}

function readRow(tr) {
  const category = tr.querySelector(".vatcat").value;
  const discount = tr.querySelector(".disc");
  return {
    pos: tr.querySelector(".pos").value,
    name: tr.querySelector(".name").value.trim(),
    desc: tr.querySelector(".desc").value.trim(),
    qty: tr.querySelector(".qty").valueAsNumber,
    unit: tr.querySelector(".unit").value.trim() || unitDefault,
    price: tr.querySelector(".price").valueAsNumber,
    cat: category,
    rate: tr.querySelector(".vatrate").valueAsNumber,
    disc:
      discount.value === "" && !discount.validity.badInput
        ? 0
        : discount.valueAsNumber,
    vatExemptionReason:
      category === "E" || category === "AE"
        ? tr.querySelector(".vatexemption")?.value.trim() || ""
        : "",
  };
}

export function readLineAmounts(rows = $$("#items tbody tr")) {
  return invoiceAmounts(rows.map(readRow));
}

export function replaceLines(lines) {
  const body = $("#items tbody");
  body.replaceChildren();
  if (!lines.length) {
    appendRow(body, defaultLine).dataset.placeholder = "true";
    return;
  }
  for (const line of lines) appendRow(body, line);
}

export function hasLineItemsToReplace() {
  return Boolean($("#items tbody tr:not([data-placeholder])"));
}

function totalRow(label, amount, currency) {
  const row = document.createElement("div");
  row.className = "total-row";
  const name = document.createElement("span");
  name.textContent = label;
  const value = document.createElement("span");
  value.className = "total-amount";
  value.textContent = amount + " " + currency;
  row.append(name, value);
  return row;
}

// Mixed rates are the usual case, so each taxed rate gets its own row.
function renderTaxRows({ taxBreakdown, totals }, currency) {
  const container = $("#taxRows");
  if (!container) return;
  const taxed =
    totals.tax === null
      ? []
      : taxBreakdown
          .filter((group) => group.cat === "S")
          .sort((left, right) => right.rate - left.rate);
  const rows = taxed.length
    ? taxed.map(({ rate, tax }) => [
        tr(`USt ${formatRate(rate)} %`, `VAT ${formatRate(rate)}%`),
        formatNumber(tax),
      ])
    : [[tr("Steuern", "VAT"), formatNumber(totals.tax)]];
  container.replaceChildren(
    ...rows.map(([label, amount]) => totalRow(label, amount, currency)),
  );
}

export function renderLineTotals() {
  const cur = $("#currency").value;
  const rows = $$("#items tbody tr");
  const result = readLineAmounts(rows);
  rows.forEach((row, index) => {
    const line = result.lines[index];
    row.querySelector(".lnet").textContent = formatNumber(line.lineNet);
    row.querySelector(".ltax").textContent = formatNumber(line.lineTax);
    row.querySelector(".lgross").textContent = formatNumber(line.lineGross);
    const reason = row.querySelector(".vatexemption");
    if (reason) {
      // Only exempt and reverse-charge lines need a reason, so hide it otherwise.
      const needed = line.cat === "E" || line.cat === "AE";
      reason.disabled = !needed;
      reason.required = needed;
      reason.closest("td").hidden = !needed;
    }
  });
  const gross = formatNumber(result.totals.gross);
  $("#tNet").textContent = formatNumber(result.totals.net);
  renderTaxRows(result, cur);
  $("#tGross").textContent = gross;
  for (const id of ["#tCur", "#tCur3", "#barCur"]) {
    const unit = $(id);
    if (unit) unit.textContent = cur;
  }
  const barTotal = $("#barGross");
  if (barTotal) barTotal.textContent = gross;
  const empty = $("#noLines");
  if (empty) empty.hidden = rows.length > 0;
}

export function initLineItems(onChange) {
  const body = $("#items tbody");
  const addButton = $("#addRow");

  function renumber() {
    for (const [index, item] of Array.from(body.rows).entries()) {
      item.querySelector(".pos").value = String(index + 1);
      localizeRowActions(item);
    }
  }

  // Puts deleted lines back where they were, even after other edits.
  function restoreLines(removed) {
    if (body.rows.length + removed.length > maxDraftLines) {
      notify(
        tr(
          `Ein Entwurf darf höchstens ${maxDraftLines} Positionen enthalten.`,
          `A draft can contain up to ${maxDraftLines} line items.`,
        ),
        { error: true },
      );
      return;
    }
    let restored;
    for (const { index, line } of removed) {
      restored = appendRow(body, line);
      body.insertBefore(restored, body.rows[index] ?? null);
    }
    renumber();
    restored?.querySelector(".name").focus();
    onChange();
  }

  function offerUndo(message, removed) {
    notify(message, {
      action: {
        label: tr("Rückgängig", "Undo"),
        run: () => restoreLines(removed),
      },
    });
  }

  function canAddLine() {
    if (body.rows.length < maxDraftLines) return true;
    notify(
      tr(
        `Ein Entwurf darf höchstens ${maxDraftLines} Positionen enthalten.`,
        `A draft can contain up to ${maxDraftLines} line items.`,
      ),
      { error: true },
    );
    return false;
  }

  addButton.onclick = () => {
    if (!canAddLine()) return;
    appendRow(body).querySelector(".name").focus();
    onChange();
  };
  $("#clearRows").onclick = () => {
    if (
      Array.from(body.rows).some((row) =>
        row.querySelector(".name").value.trim(),
      ) &&
      !confirm(
        tr("Alle Rechnungspositionen löschen?", "Delete all line items?"),
      )
    )
      return;
    const removed = Array.from(body.rows, (row, index) => ({
      index,
      line: readRow(row),
    }));
    body.replaceChildren();
    addButton.focus();
    onChange();
    if (removed.some(({ line }) => line.name))
      offerUndo(
        tr("Alle Positionen gelöscht.", "All line items deleted."),
        removed,
      );
  };
  body.addEventListener("click", (event) => {
    const button = event.target.closest("button.dup, button.del");
    if (!button) return;
    const row = button.closest("tr");
    if (button.matches(".dup")) {
      if (!canAddLine()) return;
      appendRow(body, readRow(row)).querySelector(".name").focus();
    } else {
      const nextFocus = (
        row.nextElementSibling || row.previousElementSibling
      )?.querySelector(".del");
      const removed = [
        { index: Array.from(body.rows).indexOf(row), line: readRow(row) },
      ];
      const position = row.querySelector(".pos").value;
      row.remove();
      (nextFocus || addButton).focus();
      renumber();
      onChange();
      const { name } = removed[0].line;
      if (name) {
        const label = name.length > 28 ? name.slice(0, 27) + "…" : name;
        offerUndo(
          tr(
            `Position ${position} „${label}“ gelöscht.`,
            `Line ${position} “${label}” deleted.`,
          ),
          removed,
        );
      }
      return;
    }
    renumber();
    onChange();
  });
  body.addEventListener("input", (event) => {
    event.target.closest("tr")?.removeAttribute("data-placeholder");
    if (event.target.matches(".pos"))
      localizeRowActions(event.target.closest("tr"));
    if (event.target.matches(".unit")) {
      const value = event.target.value.trim();
      if (value) {
        setUnitDefault(value);
        writeStored(storageKeys.unit, value);
      }
    }
    onChange();
  });
  document.addEventListener(localeChangeEvent, () => {
    for (const row of body.rows) localizeRow(row);
    renderLineTotals();
  });
}
