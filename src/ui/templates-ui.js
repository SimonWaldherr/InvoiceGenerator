import {
  getTemplates,
  saveTemplate,
  deleteTemplate,
  exportTemplates,
  importTemplates,
} from "./templates-storage.js";
import { collect, openDraft } from "./draft-form.js";
import {
  copyDraftForNewInvoice,
  normalizeTemplate,
  normalizeTemplates,
  readJsonFile,
} from "./import-data.js";
import { localeChangeEvent, tr } from "./i18n.js";
import { notify } from "./notify.js";

const field = (id) => document.getElementById(id);

function populateOptions(select, templates, label) {
  if (!select) return;
  const selected = select.value;
  select.replaceChildren(new Option(label, ""));
  for (const template of templates)
    select.add(new Option(template.name, template.name));
  if (templates.some(({ name }) => name === selected)) select.value = selected;
}

function refreshTemplateSelect() {
  const templates = getTemplates();
  populateOptions(
    field("templateSelect"),
    templates,
    tr("— Vorlage wählen —", "— Choose a template —"),
  );
  populateOptions(
    field("companyDefaultTemplate"),
    templates,
    tr("— kein Standard —", "— No default —"),
  );
}

function showPreview(template) {
  const modal = field("templatePreviewModal");
  const body = modal?.querySelector(".modal-body");
  if (!body) return;
  const { snapshot } = normalizeTemplate(template);
  const heading = document.createElement("h2");
  heading.id = "templatePreviewHeading";
  heading.className = "card-heading";
  heading.textContent = template.name;
  const parties = document.createElement("p");
  parties.textContent = [snapshot.seller?.name, snapshot.buyer?.name]
    .filter(Boolean)
    .join(" → ");
  const list = document.createElement("ol");
  for (const line of snapshot.lines || []) {
    const item = document.createElement("li");
    item.textContent = [line.name, line.qty, line.unit]
      .filter(Boolean)
      .join(" · ");
    list.append(item);
  }
  body.replaceChildren(heading, parties, list);
  if (!modal.open) modal.showModal();
}

export function initTemplatesUI() {
  const select = field("templateSelect");
  if (!select) return;
  const chosen = () => getTemplates().find(({ name }) => name === select.value);
  refreshTemplateSelect();
  document.addEventListener("invoice-drafts-change", refreshTemplateSelect);
  document.addEventListener(localeChangeEvent, refreshTemplateSelect);

  field("btnSaveTemplate")?.addEventListener("click", () => {
    const name = prompt(tr("Name der Vorlage", "Template name"))?.trim();
    if (!name) return;
    if (
      getTemplates().some((template) => template.name === name) &&
      !confirm(tr("Vorlage ersetzen?", "Replace this template?"))
    )
      return;
    try {
      saveTemplate(name, collect());
      refreshTemplateSelect();
      select.value = name;
      notify(tr("Vorlage gespeichert.", "Template saved."));
    } catch (error) {
      notify(
        tr(
          "Vorlage konnte nicht gespeichert werden.",
          "Unable to save the template.",
        ) +
          "\n" +
          error.message,
        { error: true },
      );
    }
  });
  field("btnLoadTemplate")?.addEventListener("click", () => {
    const template = chosen();
    if (!template) return;
    try {
      openDraft(copyDraftForNewInvoice(normalizeTemplate(template).snapshot), {
        asCopy: true,
      });
    } catch (error) {
      notify(
        tr(
          "Vorlage konnte nicht geladen werden.",
          "Unable to open the template.",
        ) +
          "\n" +
          error.message,
        { error: true },
      );
    }
  });
  field("btnPreviewTemplate")?.addEventListener("click", () => {
    const template = chosen();
    if (!template) return;
    try {
      showPreview(template);
    } catch (error) {
      notify(
        tr(
          "Vorlage konnte nicht angezeigt werden.",
          "Unable to preview the template.",
        ) +
          "\n" +
          error.message,
        { error: true },
      );
    }
  });
  field("btnDelTemplate")?.addEventListener("click", () => {
    const template = chosen();
    if (!template || !confirm(tr("Vorlage löschen?", "Delete this template?")))
      return;
    try {
      deleteTemplate(template.name);
      refreshTemplateSelect();
      notify(tr("Vorlage gelöscht.", "Template deleted."));
    } catch (error) {
      notify(
        tr(
          "Vorlage konnte nicht gelöscht werden.",
          "Unable to delete the template.",
        ) +
          "\n" +
          error.message,
        { error: true },
      );
    }
  });
  field("btnExportTemplates")?.addEventListener("click", exportTemplates);
  const upload = field("uploadTemplates");
  field("btnImportTemplates")?.addEventListener("click", () => upload?.click());
  upload?.addEventListener("change", async () => {
    const file = upload.files?.[0];
    if (!file) return;
    try {
      const parsed = await readJsonFile(file, 8);
      if (upload.files?.[0] !== file) return;
      const templates = normalizeTemplates(parsed);
      const replace = field("replaceTemplates").checked;
      const names = new Set(getTemplates().map(({ name }) => name));
      const replacesExisting = replace
        ? names.size > 0
        : templates.some(({ name }) => names.has(name));
      if (
        replacesExisting &&
        !confirm(
          replace
            ? tr(
                "Alle vorhandenen Vorlagen ersetzen?",
                "Replace all existing templates?",
              )
            : tr(
                "Gleichnamige Vorlagen ersetzen?",
                "Replace templates with matching names?",
              ),
        )
      )
        return;
      importTemplates(templates, { replace });
      refreshTemplateSelect();
      notify(tr("Vorlagen importiert.", "Templates imported."));
    } catch (error) {
      if (upload.files?.[0] === file) {
        notify(
          tr("Vorlagenimport fehlgeschlagen.", "Unable to import templates.") +
            "\n" +
            error.message,
          { error: true },
        );
      }
    } finally {
      if (upload.files?.[0] === file) upload.value = "";
    }
  });

  const modal = field("templatePreviewModal");
  modal?.querySelector(".modal-close")?.addEventListener("click", () => {
    modal.close();
  });
  modal?.addEventListener("click", (event) => {
    if (event.target === modal) modal.close();
  });
}
