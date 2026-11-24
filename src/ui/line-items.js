import { $, $$ } from "../utils.js";
import { invoiceAmounts } from "../invoice/amounts.js";
import { storageKeys, writeStored } from "./storage.js";
import { maxDraftLines } from "./import-data.js";
import { formatNumber, localeChangeEvent, tr } from "./i18n.js";

const vatCategories = ["S", "Z", "E", "AE", "K"];
const defaultLine = { price: 100, qty: 1, rate: 19, cat: "S" };
let unitDefault = "C62";

const cellLabels = {
  pos: ["Position", "Line"],
  name: ["Produktname", "Item name"],
  desc: ["Beschreibung", "Description"],
  qty: ["Menge", "Quantity"],
  unit: ["Einheit", "Unit"],
  price: ["Einzelpreis (netto)", "Unit price (excl. VAT)"],
  vatcat: ["USt-Kategorie", "VAT category"],
  vatrate: ["USt-Satz (%)", "VAT rate (%)"],
  vatexemption: ["USt-Befreiungsgrund", "VAT exemption reason"],
  disc: ["Rabatt (%)", "Discount (%)"],
  lnet: ["Netto", "Net"],
  ltax: ["MwSt", "VAT"],
  lgross: ["Brutto", "Gross"],
};

function localizeRow(row) {
  for (const cell of row.querySelectorAll("[data-column]")) {
    const label = tr(...cellLabels[cell.dataset.column]);
    cell.querySelector(".mobile-cell-label").textContent = label;
    cell.querySelector("input,select,textarea")?.setAttribute("aria-label", label);
  }
  localizeRowActions(row);
}

function localizeRowActions(row) {
  const position = row.querySelector(".pos").value;
  for (const [selector, label] of [
    [
      ".dup",
      tr(`Position ${position} duplizieren`, `Duplicate line ${position}`),
    ],
    [".del", tr(`Position ${position} löschen`, `Delete line ${position}`)],
  ]) {
    const button = row.querySelector(selector);
    button.setAttribute("aria-label", label);
    button.title = label;
  }
}

export function getUnitDefault() {
  return unitDefault;
}

export function setUnitDefault(value) {
  unitDefault = value || "C62";
  $("#unitDefaultLbl").textContent = unitDefault;
}

function appendRow(body, pref) {
  const r = document.createElement("tr");
  r.setAttribute("role", "row");
  const exemption = $("#items [data-field=vatExemptionReason]")
    ? '<td><input class="vatexemption" aria-label="USt-Befreiungsgrund"/></td>'
    : "";
  r.innerHTML = `<td><input class="pos" aria-label="Position" style="width:64px"/></td>
  <td><input class="name" aria-label="Produktname" required/></td>
  <td><textarea class="desc" rows="1" aria-label="Beschreibung"></textarea></td>
  <td><input class="qty" aria-label="Menge" type="number" step="0.0001" min="0"/></td>
  <td><input class="unit" aria-label="Einheit"/></td>
  <td><input class="price" aria-label="Einzelpreis netto" type="number" step="0.0001" min="0"/></td>
  <td><select class="vatcat" aria-label="Umsatzsteuerkategorie">${vatCategories.map((category) => `<option value="${category}">${category}</option>`).join("")}</select></td>
  <td><input class="vatrate" aria-label="Umsatzsteuersatz in Prozent" type="number" step="0.01" min="0"/></td>
  ${exemption}
  <td><input class="disc" aria-label="Rabatt in Prozent" type="number" step="0.01" min="0" max="100"/></td>
  <td><span class="lnet"></span></td><td><span class="ltax"></span></td><td><span class="lgross"></span></td>
  <td class="line-actions">
    <div class="row">
      <button class="ghost dup" type="button">⧉</button>
      <button class="red del" type="button">✕</button>
    </div>
  </td>`;
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
  for (const cell of r.cells) {
    cell.setAttribute("role", "cell");
    if (cell.classList.contains("line-actions")) continue;
    cell.dataset.column = cell.firstElementChild.className;
    const caption = document.createElement("span");
    caption.className = "mobile-cell-label";
    caption.setAttribute("aria-hidden", "true");
    cell.prepend(caption);
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
    if (reason) reason.disabled = line.cat !== "E" && line.cat !== "AE";
  });
  $("#tNet").textContent = formatNumber(result.totals.net);
  $("#tTax").textContent = formatNumber(result.totals.tax);
  $("#tGross").textContent = formatNumber(result.totals.gross);
  $("#tCur").textContent = cur;
  $("#tCur2").textContent = cur;
  $("#tCur3").textContent = cur;
}

export function initLineItems(onChange) {
  const body = $("#items tbody");
  const addButton = $("#addRow");
  function canAddLine() {
    if (body.rows.length < maxDraftLines) return true;
    alert(
      tr(
        `Ein Entwurf darf höchstens ${maxDraftLines} Positionen enthalten.`,
        `A draft can contain up to ${maxDraftLines} line items.`,
      ),
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
    body.replaceChildren();
    addButton.focus();
    onChange();
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
      row.remove();
      (nextFocus || addButton).focus();
    }
    for (const [index, item] of Array.from(body.rows).entries()) {
      item.querySelector(".pos").value = String(index + 1);
      localizeRowActions(item);
    }
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
