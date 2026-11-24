import { $ } from "../utils.js";
import {
  changeCompany,
  companyPayment,
  companySeller,
  getCompanies,
} from "./company-storage.js";
import { notifyDraftChange, openDraft } from "./draft-form.js";
import {
  readField,
  readParty,
  readPayment,
  restoreSelection,
  writeParty,
  writeBankDetails,
} from "./invoice-fields.js";
import { copyDraftForNewInvoice, normalizeTemplate } from "./import-data.js";
import { localeChangeEvent, tr } from "./i18n.js";
import { masterRecordOptions, recordLabel } from "./master-records.js";
import { storageKeys } from "./storage.js";
import { getTemplates } from "./templates-storage.js";

export function initCompanyUI() {
  const labelField = $("#companyProfileName");
  const defaultTemplate = $("#companyDefaultTemplate");
  const autoApply = $("#companyAutoApplyTemplate");
  const status = $("#activeCompany");
  let message;

  function show(text) {
    message = text;
    status.textContent = text();
  }

  const picker = masterRecordOptions({
    select: $("#companySelect"),
    search: $("#companySearch"),
    records: getCompanies,
    onSelection(profile) {
      labelField.value = profile ? recordLabel(profile) : "";
      defaultTemplate.value = profile?.defaultTemplate || "";
      autoApply.checked = profile?.autoApplyTemplate === true;
      for (const id of [
        "#btnLoadCompany",
        "#btnUpdateCompany",
        "#btnDelCompany",
      ]) {
        $(id).disabled = !profile;
      }
    },
  });
  picker.refresh();

  function saveCompany(previous) {
    const seller = readParty("seller");
    if (!seller.name) {
      show(() =>
        tr(
          "Bitte den Firmennamen im Verkäuferfeld eintragen.",
          "Enter the legal company name in the seller field.",
        ),
      );
      $("#sellerName").focus();
      return;
    }
    const { remittance, ...payment } = readPayment();
    const profile = {
      ...previous,
      ...seller,
      label: labelField.value.trim() || seller.name,
      payment: { ...previous?.payment, ...payment },
      defaultTemplate: defaultTemplate.value,
      autoApplyTemplate: autoApply.checked && Boolean(defaultTemplate.value),
    };
    if (
      previous &&
      !confirm(
        tr(
          `Firmenprofil „${recordLabel(previous)}“ aktualisieren?`,
          `Update company profile “${recordLabel(previous)}”?`,
        ),
      )
    )
      return;
    try {
      changeCompany(previous, profile);
      $("#companySearch").value = "";
      picker.refresh(profile);
      document.dispatchEvent(new Event("invoice-drafts-change"));
      show(() => tr("Firmenprofil gespeichert.", "Company profile saved."));
    } catch (error) {
      show(
        () =>
          tr(
            "Firmenprofil konnte nicht gespeichert werden. ",
            "Could not save company profile. ",
          ) + error.message,
      );
    }
  }

  $("#btnSaveCompany").addEventListener("click", () => saveCompany());
  $("#btnUpdateCompany").addEventListener("click", () => {
    const profile = picker.selected();
    if (profile) saveCompany(profile);
  });
  $("#btnLoadCompany").addEventListener("click", () => {
    const profile = picker.selected();
    if (!profile) return;
    const template =
      profile.autoApplyTemplate &&
      getTemplates().find(({ name }) => name === profile.defaultTemplate);
    try {
      if (template) {
        const draft = copyDraftForNewInvoice(
          normalizeTemplate(template).snapshot,
        );
        const opened = openDraft(
          {
            ...draft,
            seller: companySeller(profile),
            payment: companyPayment(profile, draft.header.currency || "EUR"),
          },
          { asCopy: true },
        );
        if (!opened) return;
      } else {
        const payment = companyPayment(profile, readField("currency"));
        writeParty("seller", profile);
        restoreSelection("payType", payment.type, "58");
        writeBankDetails(payment);
        notifyDraftChange();
      }
      show(() =>
        tr(
          `Firmenprofil „${recordLabel(profile)}“ übernommen.`,
          `Applied company profile “${recordLabel(profile)}”.`,
        ),
      );
    } catch (error) {
      show(
        () =>
          tr(
            "Firmenprofil konnte nicht übernommen werden. ",
            "Could not apply company profile. ",
          ) + error.message,
      );
    }
  });
  $("#btnDelCompany").addEventListener("click", () => {
    const profile = picker.selected();
    if (
      !profile ||
      !confirm(
        tr(
          `Firmenprofil „${recordLabel(profile)}“ löschen?`,
          `Delete company profile “${recordLabel(profile)}”?`,
        ),
      )
    )
      return;
    try {
      changeCompany(profile);
      document.dispatchEvent(new Event("invoice-drafts-change"));
      show(() => tr("Firmenprofil gelöscht.", "Company profile deleted."));
    } catch (error) {
      show(
        () =>
          tr(
            "Firmenprofil konnte nicht gelöscht werden. ",
            "Could not delete company profile. ",
          ) + error.message,
      );
    }
  });
  document.addEventListener(localeChangeEvent, () => {
    picker.refresh();
    if (message) status.textContent = message();
  });
  document.addEventListener("invoice-drafts-change", () => picker.refresh());
  window.addEventListener("storage", (event) => {
    if (event.key === null || event.key === storageKeys.companies)
      picker.refresh();
  });
}
