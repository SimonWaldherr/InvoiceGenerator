import { $ } from "../utils.js";
import { maxLogoBytes, supportedLogo } from "../invoice/draft.js";
import { readStored, storageKeys, writeStored } from "./storage.js";
import { localeChangeEvent, tr } from "./i18n.js";
import { notify } from "./notify.js";

let draftLogo = null;
let logoRevision = 0;

export function getLogo() {
  return draftLogo ? { ...draftLogo } : null;
}

export function setLogo(obj) {
  const dataUrl = supportedLogo(obj);
  draftLogo = dataUrl ? { dataUrl } : null;
  if (draftLogo) {
    if (typeof obj.name === "string") draftLogo.name = obj.name;
    if (typeof obj.type === "string") draftLogo.type = obj.type;
  }
  logoRevision++;
  renderLogo();
}

function renderLogo() {
  const preview = $("#logoPreview");
  if (!draftLogo) {
    const placeholder = document.createElement("span");
    placeholder.className = "small";
    placeholder.textContent = tr("Kein Logo", "No logo");
    preview.replaceChildren(placeholder);
    return;
  }
  const img = document.createElement("img");
  img.alt = "Logo";
  img.src = draftLogo.dataUrl;
  preview.replaceChildren(img);
}
export function getSavedLogo() {
  const logo = readStored(storageKeys.logo, null);
  return supportedLogo(logo) ? logo : null;
}

export function initLogo(onChange) {
  document.addEventListener(localeChangeEvent, renderLogo);
  $("#logoFile").addEventListener("change", async (ev) => {
    const input = ev.target;
    const file = input.files?.[0];
    if (!file) return;
    const revision = logoRevision;
    const isCurrentFile = () =>
      input.files?.[0] === file && logoRevision === revision;
    try {
      if (!/^image\/(png|jpeg)$/.test(file.type) || file.size > maxLogoBytes) {
        throw new Error(
          tr(
            "Bitte ein PNG- oder JPEG-Logo mit maximal 192 KiB auswählen.",
            "Choose a PNG or JPEG logo of up to 192 KiB.",
          ),
        );
      }
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () =>
          reject(
            new Error(
              tr(
                "Die Logodatei konnte nicht gelesen werden.",
                "Could not read the logo file.",
              ),
            ),
          );
        reader.readAsDataURL(file);
      });
      if (isCurrentFile()) {
        const logo = { dataUrl, name: file.name, type: file.type };
        if (!supportedLogo(logo)) {
          throw new Error(
            tr(
              "Das Logo muss lesbar sein und darf höchstens 4.096 × 4.096 Pixel und 4 Millionen Bildpunkte haben.",
              "The logo must be readable and fit within 4,096 × 4,096 pixels and 4 million pixels total.",
            ),
          );
        }
        setLogo(logo);
        onChange();
      }
    } catch (error) {
      if (isCurrentFile()) notify(error.message, { error: true });
    } finally {
      if (input.files?.[0] === file) input.value = "";
    }
  });
  $("#btnSaveLogo").onclick = () => {
    const cur = getLogo();
    if (!cur) {
      notify(
        tr(
          "Bitte zuerst eine Bilddatei wählen.",
          "Choose an image file first.",
        ),
        { error: true },
      );
      return;
    }
    if (writeStored(storageKeys.logo, cur))
      notify(
        tr(
          "Logo als Standard gespeichert (lokal).",
          "Saved as the default logo on this device.",
        ),
      );
  };
  $("#btnClearLogo").onclick = () => {
    try {
      localStorage.removeItem(storageKeys.logo);
      setLogo(null);
      onChange();
    } catch {
      notify(
        tr(
          "Das gespeicherte Logo konnte nicht entfernt werden.",
          "Could not remove the saved logo.",
        ),
        { error: true },
      );
    }
  };
}
