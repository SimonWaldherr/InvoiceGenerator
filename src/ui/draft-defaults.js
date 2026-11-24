import { $, nextInvoiceNumber } from "../utils.js";
import { collect, notifyDraftChange, recalc } from "./draft-form.js";
import {
  restoreSelection,
  writeParty,
  writeBankDetails,
} from "./invoice-fields.js";
import { setUnitDefault } from "./line-items.js";
import {
  readStored,
  removeStored,
  storageKeys,
  writeStored,
} from "./storage.js";
import { isDefaults } from "./import-data.js";
import { tr } from "./i18n.js";

function getLastNr() {
  return readStored(storageKeys.lastNr, "");
}
function setLastNr(nr) {
  return writeStored(storageKeys.lastNr, nr);
}

export function initDraftDefaults() {
  $("#btnSaveDefaults").onclick = () => {
    const draft = collect();
    const saved = writeStored(storageKeys.defaults, {
      seller: draft.seller,
      payment: draft.payment,
      currency: draft.header.currency,
      unitDefault: draft.meta.unitDefault,
    });
    if (saved)
      alert(tr("Standard gespeichert (lokal).", "Defaults saved locally."));
  };
  $("#btnLoadDefaults").onclick = () => {
    const defaults = readStored(storageKeys.defaults, null);
    if (!defaults) {
      alert(tr("Kein Standard gespeichert.", "No saved defaults."));
      return;
    }
    if (!isDefaults(defaults)) {
      alert(
        tr(
          "Die gespeicherten Standardwerte sind ungültig.",
          "The saved defaults are invalid.",
        ),
      );
      return;
    }
    $("#currency").value = defaults.currency || "EUR";
    if (defaults.unitDefault) setUnitDefault(defaults.unitDefault);
    writeParty("seller", defaults.seller || {});
    restoreSelection("payType", defaults.payment?.type, "58");
    writeBankDetails(defaults.payment || {});
    recalc();
  };
  $("#btnClearDefaults").onclick = () => {
    if (removeStored(storageKeys.defaults))
      alert(tr("Standard gelöscht.", "Defaults deleted."));
  };

  $("#btnRememberNr").onclick = () => {
    const nr = $("#invNumber").value.trim();
    if (!nr) {
      alert(tr("Keine Nummer eingetragen.", "Enter an invoice number."));
      return;
    }
    if (!setLastNr(nr)) return;
    alert(tr("Rechnungsnummer gemerkt.", "Invoice number saved."));
  };
  $("#btnNextNr").onclick = () => {
    const cur = $("#invNumber").value.trim() || getLastNr();
    const nxt = nextInvoiceNumber(cur || "");
    $("#invNumber").value = nxt;
    setLastNr(nxt);
    notifyDraftChange();
  };
}
