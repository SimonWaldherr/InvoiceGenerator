import { $ } from "../utils.js";
import { collect, markDraftSaved, openDraft, validate } from "./draft-form.js";
import {
  readStoredList,
  replaceStored,
  storageKeys,
  writeStored,
} from "./storage.js";
import { downloadArtifact, downloadJSON } from "./download.js";
import { isHistoryEntry } from "./import-data.js";
import { formatNumber, localeChangeEvent, tr } from "./i18n.js";
import { notify } from "./notify.js";
import { showProblems } from "./validation-ui.js";
import {
  draftFromHistory,
  filterHistory,
  historyCsv,
  historySummary,
} from "./history.js";

function getHistory() {
  return readStoredList(storageKeys.history, isHistoryEntry);
}
function setHistory(list) {
  return writeStored(storageKeys.history, list);
}
function pushHistory(entry) {
  const matchesNumber = (item) =>
    String(historySummary(item).number ?? "") === entry.number;
  let list = getHistory();
  let index = list.findIndex(matchesNumber);
  if (index >= 0) {
    const previous = JSON.stringify(list[index]);
    if (
      !confirm(
        tr(
          `Entwurf mit der Rechnungsnummer ${entry.number} ersetzen?`,
          `Replace the draft with invoice number ${entry.number}?`,
        ),
      )
    )
      return false;
    list = getHistory();
    index = list.findIndex(matchesNumber);
    if (index < 0 || JSON.stringify(list[index]) !== previous) {
      renderHistory();
      notify(
        tr(
          "Der gespeicherte Entwurf wurde inzwischen geändert. Bitte erneut speichern.",
          "The saved draft has changed. Save again to retry.",
        ),
        { error: true },
      );
      return false;
    }
  }
  const savedEntry = { ...entry, ts: Date.now() };
  if (index >= 0) list[index] = savedEntry;
  else list.unshift(savedEntry);
  try {
    replaceStored([
      [storageKeys.history, list],
      [storageKeys.lastNr, entry.number],
    ]);
  } catch (error) {
    notify(
      tr(
        "Entwurf konnte nicht gespeichert werden.",
        "Unable to save the draft.",
      ) +
        "\n" +
        error.message,
      { error: true },
    );
    return false;
  }
  renderHistory();
  return true;
}

function setHistoryStatus(message) {
  const status = $("#historyStatus");
  if (status) status.textContent = message;
}

function openHistoryEntry(entry, asCopy = false) {
  try {
    if (!openDraft(draftFromHistory(entry, asCopy), { asCopy })) return;
    setHistoryStatus(
      asCopy
        ? tr(
            "Neuer Entwurf aus der Historie erstellt.",
            "Created a new draft from history.",
          )
        : tr("Entwurf geöffnet.", "Draft opened."),
    );
    $(asCopy ? "#invNumber" : "#invoiceDetails")?.focus();
  } catch (error) {
    notify(
      tr("Entwurf konnte nicht geladen werden.", "Unable to open the draft.") +
        "\n" +
        error.message,
      { error: true },
    );
  }
}

function deleteHistoryEntry(item) {
  const { number } = historySummary(item);
  const message = number
    ? tr(
        `Entwurf ${number} aus der Historie löschen?`,
        `Delete draft ${number} from history?`,
      )
    : tr("Eintrag löschen?", "Delete this entry?");
  if (!confirm(message)) return;
  const current = getHistory();
  const original = JSON.stringify(item);
  const index = current.findIndex(
    (entry) =>
      entry.number === item.number &&
      entry.ts === item.ts &&
      JSON.stringify(entry) === original,
  );
  if (index < 0) {
    renderHistory(
      tr(
        "Der Eintrag wurde inzwischen geändert.",
        "This entry has already changed.",
      ),
    );
    return;
  }
  current.splice(index, 1);
  if (setHistory(current))
    renderHistory(tr("Eintrag gelöscht.", "Entry deleted."));
}

function renderHistory(message) {
  const body = $("#histBody");
  const list = getHistory();
  const visible = filterHistory(list, $("#historySearch")?.value);
  for (const selector of ["#btnExportHistory", "#btnClearHistory"]) {
    const button = $(selector);
    if (button) button.disabled = list.length === 0;
  }
  setHistoryStatus(
    message ??
      tr(
        `${visible.length} von ${list.length} ${list.length === 1 ? "Entwurf" : "Entwürfen"}`,
        `${visible.length} of ${list.length} ${list.length === 1 ? "draft" : "drafts"}`,
      ),
  );
  const count = $("#historyCount");
  if (count) {
    count.textContent = String(list.length);
    count.hidden = list.length === 0;
  }
  body.replaceChildren();
  if (!visible.length) {
    const cell = body.insertRow().insertCell();
    cell.colSpan = 6;
    cell.className = "small empty-cell";
    cell.textContent = list.length
      ? tr("Keine passenden Entwürfe.", "No matching drafts.")
      : tr(
          "Noch nichts gespeichert. Entwürfe lassen sich mit „In Historie speichern“ lokal ablegen.",
          "Nothing saved yet. Use “Save to history” to keep drafts on this device.",
        );
    return;
  }
  // The headings label each cell when the table turns into a card list.
  const headings = Array.from(
    document.querySelectorAll("#invoiceHistory thead th"),
    (heading) => heading.textContent,
  );
  visible.forEach((item) => {
    const { number, date, buyer, gross, currency } = historySummary(item);
    const row = body.insertRow();
    [number, date, buyer, formatNumber(gross), currency].forEach(
      (value, index) => {
        const cell = row.insertCell();
        cell.textContent = value ?? "";
        cell.dataset.label = headings[index] ?? "";
        if (index === 3) cell.className = "numeric";
      },
    );
    const cell = row.insertCell();
    cell.className = "history-cell-actions";
    const actions = document.createElement("div");
    actions.className = "history-actions";
    cell.append(actions);
    const addAction = (label, className, click) => {
      const button = document.createElement("button");
      button.textContent = label;
      if (number) button.setAttribute("aria-label", label + " · " + number);
      button.type = "button";
      button.className = className;
      button.addEventListener("click", click);
      actions.append(button);
    };
    addAction(tr("Laden", "Load"), "ghost", () => openHistoryEntry(item));
    addAction(tr("Kopieren", "Duplicate"), "ghost", () =>
      openHistoryEntry(item, true),
    );
    addAction("JSON", "ghost", () => {
      downloadJSON(item.snapshot, (number || tr("entwurf", "draft")) + ".json");
    });
    addAction(tr("Löschen", "Delete"), "red", () => deleteHistoryEntry(item));
  });
}

export { renderHistory as refreshHistory };

export function initHistory() {
  const history = $("#invoiceHistory");
  if (window.location.hash === "#invoiceHistory") history.open = true;
  $('a[href="#invoiceHistory"]')?.addEventListener("click", () => {
    history.open = true;
  });
  renderHistory();
  document.addEventListener(localeChangeEvent, () => renderHistory());
  window.addEventListener("storage", (event) => {
    if (event.key === null || event.key === storageKeys.history)
      renderHistory();
  });
  $("#historySearch")?.addEventListener("input", () => renderHistory());
  $("#btnExportHistory")?.addEventListener("click", () => {
    const list = getHistory();
    if (!list.length) return;
    const fileName = tr("rechnungshistorie.csv", "invoice-history.csv");
    downloadArtifact(
      new Blob([historyCsv(list)], { type: "text/csv;charset=utf-8" }),
      fileName,
    );
    setHistoryStatus(tr("CSV-Download gestartet.", "CSV download started."));
  });

  $("#btnSaveHistory").onclick = () => {
    const data = collect();
    const errs = validate(data);
    if (errs.length) {
      showProblems();
      notify(
        tr("Bitte diese Angaben prüfen: ", "Check these fields: ") +
          errs.join(", "),
        { error: true },
      );
      return;
    }
    if (
      !pushHistory({
        number: data.header.number,
        date: data.header.date,
        buyer: data.buyer.name,
        gross: data.totals.gross,
        currency: data.header.currency,
        snapshot: data,
      })
    )
      return;
    markDraftSaved();
    setHistoryStatus(tr("In Historie gespeichert.", "Draft saved to history."));
    notify(tr("In Historie gespeichert.", "Draft saved to history."));
  };
  $("#btnClearHistory").onclick = () => {
    if (!confirm(tr("Gesamte Historie löschen?", "Delete all saved drafts?")))
      return;
    if (setHistory([]))
      renderHistory(tr("Historie geleert.", "History cleared."));
  };
}
