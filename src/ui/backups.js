import { $ } from "../utils.js";
import { recalc, resetDraft } from "./draft-form.js";
import { getUnitDefault, setUnitDefault } from "./line-items.js";
import { refreshHistory } from "./history-ui.js";
import { readStored, replaceStored, storageKeys } from "./storage.js";
import { downloadJSON } from "./download.js";
import { backupEntries, readJsonFile } from "./import-data.js";
import { tr } from "./i18n.js";
import { notify } from "./notify.js";

const backupArrayKeys = [
  storageKeys.contacts,
  storageKeys.history,
  storageKeys.companies,
  storageKeys.templates,
];

function refreshDraftStorage() {
  setUnitDefault(readStored(storageKeys.unit, "C62"));
  refreshHistory();
  recalc();
  document.dispatchEvent(new Event("invoice-drafts-change"));
}

export function initBackups() {
  $("#btnBackup").onclick = () => {
    const data = Object.fromEntries(
      Object.values(storageKeys).map((key) => [
        key,
        readStored(key, backupArrayKeys.includes(key) ? [] : null),
      ]),
    );
    data[storageKeys.unit] = getUnitDefault();
    const dump = { version: 1, ts: Date.now(), data };
    downloadJSON(dump, "invoicegenerator_backup.json");
  };

  $("#uploadBackup").addEventListener("change", async (event) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const dump = await readJsonFile(file, 16);
      if (input.files?.[0] !== file) return;
      const entries = backupEntries(dump);
      if (
        !confirm(
          tr(
            "Lokale Daten aus der Sicherung wiederherstellen? Vorhandene Daten der betroffenen Bereiche werden ersetzt.",
            "Restore local data from the backup? Existing data in the affected sections will be replaced.",
          ),
        )
      )
        return;
      replaceStored(entries);
      refreshDraftStorage();
      notify(tr("Sicherung importiert.", "Backup imported."));
    } catch (error) {
      if (input.files?.[0] === file) {
        notify(
          tr(
            "Import der Sicherung fehlgeschlagen.",
            "Unable to import the backup.",
          ) +
            "\n" +
            error.message,
          { error: true },
        );
      }
    } finally {
      if (input.files?.[0] === file) input.value = "";
    }
  });

  $("#btnWipeAll").onclick = () => {
    if (
      !confirm(
        tr(
          "Alle lokal gespeicherten Entwürfe, Kontakte, Firmenprofile, Vorlagen und Einstellungen löschen?",
          "Delete all locally stored drafts, contacts, company profiles, templates and settings?",
        ),
      )
    )
      return;
    try {
      replaceStored(Object.values(storageKeys).map((key) => [key, undefined]));
      refreshDraftStorage();
      resetDraft();
      notify(tr("Alle lokalen Daten gelöscht.", "All local data deleted."));
    } catch (error) {
      notify(
        tr(
          "Lokale Daten konnten nicht vollständig gelöscht werden.",
          "Unable to delete all local data.",
        ) +
          "\n" +
          error.message,
        { error: true },
      );
    }
  };
}
