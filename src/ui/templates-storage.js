import { readStoredList, storageKeys } from "./storage.js";
import { downloadJSON } from "./download.js";
import { isNamedRecord } from "./import-data.js";

const TEMPLATES_KEY = storageKeys.templates;

export function getTemplates() {
  return readStoredList(TEMPLATES_KEY, isNamedRecord);
}

function setTemplates(list) {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(list));
}

export function saveTemplate(name, snapshot) {
  const list = getTemplates();
  const item = { name, ts: Date.now(), snapshot };
  const idx = list.findIndex((t) => t.name === name);
  if (idx >= 0) list[idx] = item;
  else list.push(item);
  setTemplates(list);
}

export function deleteTemplate(name) {
  const list = getTemplates().filter((t) => t.name !== name);
  setTemplates(list);
}

export function exportTemplates() {
  downloadJSON(getTemplates(), "invoice_templates.json");
}

export function importTemplates(templates, { replace }) {
  if (replace) {
    setTemplates(templates);
    return;
  }
  const byName = new Map(
    getTemplates().map((template) => [template.name, template]),
  );
  for (const template of templates) byName.set(template.name, template);
  setTemplates([...byName.values()]);
}
