import { $ } from "../utils.js";
import { companyPayment, companySeller, getCompanies } from "./company-storage.js";
import { recordLabel } from "./master-records.js";
import { localeChangeEvent, tr } from "./i18n.js";
import { isSettings, settingsDefaults } from "./settings-data.js";
import { readStored, storageKeys, writeStored } from "./storage.js";

function readSettings() {
  const saved = readStored(storageKeys.settings, null);
  return isSettings(saved) ? saved : settingsDefaults;
}

export function newDraftDefaults() {
  const settings = readSettings();
  const company = settings.company
    ? getCompanies().find((record) => recordLabel(record) === settings.company)
    : undefined;
  return {
    header: {
      profile: settings.profile,
      syntax: settings.syntax,
      currency: settings.currency,
      businessProcess: settings.businessProcess,
    },
    seller: companySeller(company),
    payment: companyPayment(company, settings.currency, {
      type: settings.paymentType,
      terms: settings.paymentTerms,
    }),
  };
}

export function initSettings() {
  const dialog = $("#settingsDialog");
  const form = $("#settingsForm");
  const status = $("#settingsStatus");
  const fields = {
    profile: $("#settingsProfile"),
    syntax: $("#settingsSyntax"),
    currency: $("#settingsCurrency"),
    company: $("#settingsCompany"),
    paymentType: $("#settingsPaymentType"),
    paymentTerms: $("#settingsPaymentTerms"),
    businessProcess: $("#settingsBusinessProcess"),
  };
  let message;

  function setStatus(text) {
    message = text;
    status.textContent = message ? message() : "";
  }

  function refreshCompanies(selected) {
    fields.company.replaceChildren(
      new Option(tr("Kein Firmenprofil", "No company profile"), ""),
    );
    for (const company of getCompanies()) {
      if (!company.name) continue;
      const key = recordLabel(company);
      const label = company.city ? `${key} — ${company.city}` : key;
      fields.company.add(new Option(label, key));
    }
    if (
      selected &&
      ![...fields.company.options].some(({ value }) => value === selected)
    ) {
      fields.company.add(
        new Option(
          tr(`${selected} (nicht verfügbar)`, `${selected} (unavailable)`),
          selected,
        ),
      );
    }
    fields.company.value = selected;
  }

  function syncAvailableChoices() {
    fields.syntax.disabled = fields.profile.value !== "XRECHNUNG";
    if (fields.syntax.disabled) fields.syntax.value = "CII";
    const sepa = fields.paymentType.querySelector('option[value="58"]');
    sepa.disabled = fields.currency.value !== "EUR";
    if (sepa.disabled && fields.paymentType.value === "58") {
      fields.paymentType.value = "30";
    }
  }

  function fillForm(values) {
    refreshCompanies(values.company);
    for (const [name, field] of Object.entries(fields)) field.value = values[name];
    syncAvailableChoices();
  }

  $("#btnSettings").addEventListener("click", () => {
    fillForm(readSettings());
    setStatus();
    dialog.showModal();
  });
  $("#btnCloseSettings").addEventListener("click", () => dialog.close());
  $("#btnResetSettings").addEventListener("click", () => {
    fillForm(settingsDefaults);
    setStatus(() =>
      tr(
        "Standardwerte eingesetzt. Speichern, um sie zu übernehmen.",
        "Default values filled in. Save to apply them.",
      ),
    );
  });
  fields.profile.addEventListener("change", syncAvailableChoices);
  fields.currency.addEventListener("change", syncAvailableChoices);
  form.addEventListener("input", () => setStatus());
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = Object.fromEntries(
      Object.entries(fields).map(([name, field]) => [name, field.value]),
    );
    values.paymentTerms = values.paymentTerms.trim();
    values.businessProcess = values.businessProcess.trim();
    if (!isSettings(values)) {
      setStatus(() =>
        tr("Bitte die Einstellungen prüfen.", "Check the settings."),
      );
      return;
    }
    if (writeStored(storageKeys.settings, values)) {
      setStatus(() =>
        tr(
          "Gespeichert. Die Einstellungen gelten für neue Entwürfe.",
          "Saved. The settings apply to new drafts.",
        ),
      );
    }
  });
  document.addEventListener(localeChangeEvent, () => {
    if (!dialog.open) return;
    refreshCompanies(fields.company.value);
    if (message) status.textContent = message();
  });
  const refreshOpenCompanies = () => {
    if (dialog.open) refreshCompanies(fields.company.value);
  };
  document.addEventListener("invoice-drafts-change", refreshOpenCompanies);
  window.addEventListener("storage", (event) => {
    if (event.key === storageKeys.companies || event.key === null) {
      refreshOpenCompanies();
    }
  });
}
