import { $ } from "../utils.js";
import { downloadJSON } from "./download.js";
import { readJsonFile } from "./import-data.js";
import { localeChangeEvent, tr } from "./i18n.js";
import { recordLabel } from "./master-records.js";
import {
  masterCollections,
  masterDataFile,
  planMasterImport,
  readMasterDataFile,
  storedMasterData,
} from "./master-data-files.js";
import { replaceStored } from "./storage.js";

export function initMasterDataTransfer() {
  const dialog = $("#masterImportDialog");
  const summary = $("#masterImportSummary");
  const details = $("#masterImportConflicts");
  const list = $("#masterImportConflictList");
  const apply = $("#masterImportApply");
  let review;
  const messages = new Map();

  function report(kind, text, error = false) {
    messages.set(kind, text);
    const status = $(`#masterTransferStatus-${kind}`);
    status.textContent = text();
    status.dataset.error = String(error);
  }

  function fail(kind, error) {
    report(
      kind,
      () =>
        tr(
          "Stammdaten konnten nicht verarbeitet werden. ",
          "Unable to process master data. ",
        ) + error.message,
      true,
    );
  }

  function renderReview() {
    const { additions, duplicates, conflicts } = review.plan;
    summary.textContent = tr(
      `${additions.length} neu · ${duplicates} identisch · ${conflicts.length} ${conflicts.length === 1 ? "Konflikt" : "Konflikte"}`,
      `${additions.length} new · ${duplicates} identical · ${conflicts.length} ${conflicts.length === 1 ? "conflict" : "conflicts"}`,
    );
    details.hidden = !conflicts.length;
    list.replaceChildren();
    for (const record of conflicts.slice(0, 20)) {
      const item = document.createElement("li");
      item.textContent = [recordLabel(record), record.city, record.buyerRef]
        .filter(Boolean)
        .join(" · ");
      list.append(item);
    }
    $("#masterImportMore").hidden = conflicts.length <= 20;
    apply.disabled = additions.length === 0;
  }

  function prepare(kind, incoming) {
    const key = masterCollections[kind].key;
    const raw = localStorage.getItem(key);
    const current = storedMasterData(kind, raw);
    review = {
      kind,
      key,
      raw,
      current,
      incoming,
      plan: planMasterImport(kind, current, incoming),
    };
    renderReview();
  }

  for (const kind of Object.keys(masterCollections)) {
    const key = masterCollections[kind].key;
    const input = $(`#masterFile-${kind}`);
    $(`#masterExport-${kind}`).onclick = () => {
      try {
        const records = storedMasterData(kind, localStorage.getItem(key));
        const filename =
          kind === "companies"
            ? tr("firmenprofile.json", "company-profiles.json")
            : tr("kaeuferkontakte.json", "buyer-contacts.json");
        downloadJSON(masterDataFile(kind, records), filename);
        report(kind, () =>
          tr("JSON-Download gestartet.", "JSON download started."),
        );
      } catch (error) {
        fail(kind, error);
      }
    };
    $(`#masterImport-${kind}`).onclick = () => input.click();
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const json = await readJsonFile(file, 8);
        if (input.files?.[0] !== file || dialog.open) return;
        prepare(kind, readMasterDataFile(kind, json));
        $("#masterImportChanged").hidden = true;
        dialog.showModal();
      } catch (error) {
        if (input.files?.[0] === file) fail(kind, error);
      } finally {
        if (input.files?.[0] === file) input.value = "";
      }
    };
  }

  $("#masterImportClose").onclick = () => dialog.close();
  apply.onclick = () => {
    const { kind } = review;
    try {
      if (localStorage.getItem(review.key) !== review.raw) {
        prepare(review.kind, review.incoming);
        $("#masterImportChanged").hidden = false;
        return;
      }
      const count = review.plan.additions.length;
      if (!count) return;
      replaceStored([
        [review.key, [...review.current, ...review.plan.additions]],
      ]);
      dialog.close();
      document.dispatchEvent(new Event("invoice-drafts-change"));
      report(kind, () =>
        count === 1
          ? tr("Ein Datensatz importiert.", "Imported one record.")
          : tr(`${count} Datensätze importiert.`, `Imported ${count} records.`),
      );
    } catch (error) {
      dialog.close();
      fail(kind, error);
    }
  };
  document.addEventListener(localeChangeEvent, () => {
    for (const [kind, message] of messages)
      $(`#masterTransferStatus-${kind}`).textContent = message();
    if (dialog.open) renderReview();
  });
}
