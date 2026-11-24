import {
  collect,
  initDraftForm,
  populate,
  recalc,
  validate,
} from "./ui/draft-form.js";
import { initBackups } from "./ui/backups.js";
import { initDraftFiles } from "./ui/draft-files.js";
import { restoreSelection } from "./ui/invoice-fields.js";
import { initInvoiceExport } from "./ui/invoice-export.js";
import { initDraftDefaults } from "./ui/draft-defaults.js";
import { initHistory } from "./ui/history-ui.js";
import { initCompanyUI } from "./ui/company-ui.js";
import { initContacts } from "./ui/contacts.js";
import { initMasterDataTransfer } from "./ui/master-data-transfer.js";
import { initTemplatesUI } from "./ui/templates-ui.js";
import { initLocale } from "./ui/i18n.js";
import { initSettings } from "./ui/settings.js";
import { initValidation } from "./ui/validation-ui.js";
import { initCompleteness } from "./ui/completeness.js";
import { initDateHelpers } from "./ui/date-helpers.js";
import { initDraftState } from "./ui/draft-state.js";
import { initIbanField } from "./ui/iban-field.js";
import { initTheme } from "./ui/theme.js";

initTheme();
initLocale();
initInvoiceExport();
initDraftForm();
initValidation();
initIbanField();
initDateHelpers();
initSettings();
initDraftFiles();
initDraftDefaults();
initHistory();
initBackups();
initTemplatesUI();
initCompanyUI();
initContacts();
initMasterDataTransfer();
initCompleteness();
initDraftState();

// Keep the existing browser hooks for older integrations.
Object.assign(window, {
  collect,
  populate,
  recalc,
  restoreSelection,
  validate,
});
