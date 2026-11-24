import { $, today } from "../utils.js";

/** Adds whole days to a `YYYY-MM-DD` date. Returns null for anything else. */
export function addDays(isoDate, days) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate ?? "");
  if (!match || !Number.isInteger(days)) return null;
  const [year, month, day] = match.slice(1).map(Number);
  // UTC keeps daylight saving changes from shifting the result by a day.
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

function setDate(id, value) {
  const field = $("#" + id);
  if (!field || !value) return;
  field.value = value;
  // The shared input listener recalculates the draft and its requirements.
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

export function initDateHelpers() {
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const due = target?.closest("[data-add-days]");
    if (due) {
      const days = Number(due.dataset.addDays);
      setDate("dueDate", addDays($("#invDate").value || today(), days));
      return;
    }
    if (target?.closest("[data-copy-invoice-date]")) {
      const date = $("#invDate").value;
      if (date) setDate("supplyDate", date);
      else $("#invDate").focus();
    }
  });
}
