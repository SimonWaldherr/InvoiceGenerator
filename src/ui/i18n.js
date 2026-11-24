import english from "./messages-en.js";

const preferenceKey = "invoicegenerator-language";
const originalStrings = new WeakMap();
const attributes = ["aria-label", "placeholder", "title"];
let selectedLanguage = "de";
const numberFormats = {
  de: new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
  en: new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
};

const rateFormats = {
  de: new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }),
  en: new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }),
};

export const localeChangeEvent = "invoice-language-change";

export function language() {
  return selectedLanguage;
}

export function tr(german, translated) {
  return selectedLanguage === "en" ? translated : german;
}

export function formatNumber(value) {
  return value == null ? "–" : numberFormats[selectedLanguage].format(value);
}

export function formatRate(value) {
  return rateFormats[selectedLanguage].format(value);
}

function remember(element, name, value) {
  let strings = originalStrings.get(element);
  if (!strings) {
    strings = {};
    originalStrings.set(element, strings);
  }
  strings[name] ??= value;
  return strings[name];
}

function renderLocale() {
  document.documentElement.lang = selectedLanguage;
  for (const element of document.querySelectorAll("[data-i18n]")) {
    const german = remember(element, "text", element.textContent);
    element.textContent = tr(german, english[element.dataset.i18n] ?? german);
  }
  for (const name of attributes) {
    const marker = "data-i18n-" + name;
    for (const element of document.querySelectorAll("[" + marker + "]")) {
      const german = remember(element, name, element.getAttribute(name));
      element.setAttribute(
        name,
        tr(german, english[element.getAttribute(marker)] ?? german),
      );
    }
  }
}

export function initLocale() {
  const selector = document.getElementById("language");
  if (!selector) return;
  try {
    if (localStorage.getItem(preferenceKey) === "en") selectedLanguage = "en";
  } catch {
    // Changing the language does not require access to local storage.
  }
  selector.value = selectedLanguage;
  renderLocale();
  selector.addEventListener("change", () => {
    selectedLanguage = selector.value === "en" ? "en" : "de";
    try {
      localStorage.setItem(preferenceKey, selectedLanguage);
    } catch {
      // Keep the selection for the current session.
    }
    renderLocale();
    document.dispatchEvent(new Event(localeChangeEvent));
  });
}
