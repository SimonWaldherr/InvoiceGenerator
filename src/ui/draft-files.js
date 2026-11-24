import { $ } from "../utils.js";
import { collect, openDraft, recalc } from "./draft-form.js";
import { downloadArtifact, downloadJSON } from "./download.js";
import { language, localeChangeEvent, tr } from "./i18n.js";
import { normalizeDraft, readJsonFile } from "./import-data.js";
import { readLineCsv, serializeLineCsv } from "./line-csv.js";
import { hasLineItemsToReplace, replaceLines } from "./line-items.js";

export { csvCell } from "./line-csv.js";

let csvStatus;

function renderCsvStatus() {
  if (!csvStatus) return;
  const status = $("#csvImportStatus");
  status.textContent = csvStatus.message();
  status.dataset.error = String(csvStatus.error);
}

function setCsvStatus(message, error = false) {
  csvStatus = { message, error };
  renderCsvStatus();
}

async function importCsv(event) {
  const input = event.target;
  const file = input.files?.[0];
  if (!file) return;
  setCsvStatus(() => tr("CSV-Datei wird gelesen …", "Reading CSV file …"));
  try {
    const lines = await readLineCsv(file);
    if (input.files?.[0] !== file) return;
    if (
      hasLineItemsToReplace() &&
      !confirm(
        tr(
          `Vorhandene Rechnungspositionen durch ${lines.length} Positionen aus der CSV-Datei ersetzen?`,
          `Replace the existing line items with ${lines.length} from the CSV file?`,
        ),
      )
    ) {
      setCsvStatus(() =>
        tr("CSV-Import abgebrochen.", "CSV import cancelled."),
      );
      return;
    }

    replaceLines(lines);
    recalc();
    const count = lines.length;
    const needsReason = lines.some(
      (line) => ["E", "AE"].includes(line.cat) && !line.vatExemptionReason,
    );
    const hasLegacyCategory = lines.some((line) => line.cat === "K");
    setCsvStatus(() => {
      const imported =
        count === 1
          ? tr("Eine Position importiert.", "Imported one line item.")
          : tr(
              `${count} Positionen importiert.`,
              `Imported ${count} line items.`,
            );
      const reasonHint = needsReason
        ? tr(
            " Bitte ergänzen Sie fehlende Befreiungsgründe.",
            " Fill in any missing VAT exemption reasons.",
          )
        : "";
      const categoryHint = hasLegacyCategory
        ? tr(
            " Bitte prüfen Sie die Altkategorie K vor dem Rechnungsexport.",
            " Review the legacy VAT category K before exporting the invoice.",
          )
        : "";
      return imported + reasonHint + categoryHint;
    });
  } catch (error) {
    if (input.files?.[0] === file) {
      const detail = error.message;
      setCsvStatus(
        () => tr("CSV-Import fehlgeschlagen. ", "CSV import failed. ") + detail,
        true,
      );
    }
  } finally {
    if (input.files?.[0] === file) input.value = "";
  }
}

export function initDraftFiles() {
  $("#dlJson").onclick = () => {
    const snapshot = collect();
    downloadJSON(
      snapshot,
      (snapshot.header.number || tr("entwurf", "draft")) + ".json",
    );
  };

  $("#dlCsv").onclick = () => {
    const snapshot = collect();
    if (!snapshot.lines.length) {
      alert(tr("Keine Positionen.", "There are no line items."));
      return;
    }
    const blob = new Blob([serializeLineCsv(snapshot.lines, language())], {
      type: "text/csv;charset=utf-8",
    });
    downloadArtifact(
      blob,
      (snapshot.header.number || tr("entwurf", "draft")) +
        tr("_positionen.csv", "_items.csv"),
    );
  };

  $("#uploadCsv").addEventListener("change", importCsv);
  document.addEventListener(localeChangeEvent, renderCsvStatus);

  /* JSON-Import einer einzelnen Rechnung */
  $("#uploadJson").addEventListener("change", async (event) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const draft = await readJsonFile(file, 8);
      if (input.files?.[0] === file) {
        openDraft(normalizeDraft(draft, { requireContent: true }));
      }
    } catch (error) {
      if (input.files?.[0] === file) {
        alert(
          tr("Import fehlgeschlagen.", "Import failed.") + "\n" + error.message,
        );
      }
    } finally {
      if (input.files?.[0] === file) input.value = "";
    }
  });
}
