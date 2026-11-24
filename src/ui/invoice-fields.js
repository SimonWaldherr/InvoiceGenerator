import { $, ibanClean } from "../utils.js";
import { commonCountries, endpointSchemes } from "../invoice/codes.js";
import { language, tr, localeChangeEvent } from "./i18n.js";

const parties = {
  seller: {
    name: "sellerName",
    street: "sellerStreet",
    zip: "sellerZip",
    city: "sellerCity",
    country: "sellerCountry",
    vat: "sellerVAT",
    fc: "sellerFC",
    reg: "sellerReg",
    email: "sellerEmail",
    phone: "sellerPhone",
    contactName: "sellerContactName",
    identifier: "sellerIdentifier",
    endpointId: "sellerEndpointId",
    endpointScheme: "sellerEndpointScheme",
  },
  buyer: {
    name: "buyerName",
    street: "buyerStreet",
    zip: "buyerZip",
    city: "buyerCity",
    country: "buyerCountry",
    vat: "buyerVAT",
    fc: "buyerFC",
    reg: "buyerReg",
    identifier: "buyerIdentifier",
    contactName: "buyerContactName",
    email: "buyerEmail",
    phone: "buyerPhone",
    endpointId: "buyerEndpointId",
    endpointScheme: "buyerEndpointScheme",
  },
};

const paymentFields = {
  terms: "payTerms",
  iban: "iban",
  bic: "bic",
  holder: "accHolder",
};

export function readField(id) {
  return $("#" + id)?.value.trim() || "";
}

export function writeField(id, value) {
  const field = $("#" + id);
  if (field) field.value = value ?? "";
}

export function restoreSelection(id, value, fallback) {
  const select = $("#" + id);
  if (!select) return;
  select.querySelector("option[data-legacy]")?.remove();
  const saved = String(value || fallback);
  if (![...select.options].some((option) => option.value === saved)) {
    const option = new Option(
      saved + tr(" (Altwert)", " (legacy value)"),
      saved,
    );
    option.dataset.legacy = "true";
    select.add(option);
  }
  select.value = saved;
}

function refreshCodeSuggestions() {
  const locale = language();
  const names =
    typeof Intl.DisplayNames === "function"
      ? new Intl.DisplayNames(locale, { type: "region" })
      : null;
  const countries = [...commonCountries].map((code) => [
    code,
    /^[A-Z]{2}$/.test(code) ? (names?.of(code) ?? code) : code,
  ]);
  countries.sort((a, b) => a[1].localeCompare(b[1], locale));
  $("#countryCodes").replaceChildren(
    ...countries.map(([code, name]) => new Option(name, code)),
  );
  $("#addressSchemes").replaceChildren(
    ...[...endpointSchemes].map((code) => {
      const labels = { EM: tr("E-Mail", "Email"), "0204": "Leitweg-ID" };
      return new Option(labels[code] ?? code, code);
    }),
  );
}

export function initInvoiceFields() {
  refreshCodeSuggestions();
  document.addEventListener(localeChangeEvent, () => {
    refreshCodeSuggestions();
    for (const option of document.querySelectorAll("option[data-legacy]")) {
      option.textContent = option.value + tr(" (Altwert)", " (legacy value)");
    }
  });
}

function readFields(fields) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, id]) => [key, readField(id)]),
  );
}

function writeFields(fields, values) {
  for (const [key, id] of Object.entries(fields)) writeField(id, values[key]);
}

export function readParty(side) {
  const values = readFields(parties[side]);
  values.country = values.country.toUpperCase();
  return values;
}

export function writeParty(side, values) {
  writeFields(parties[side], { ...values, country: values.country ?? "DE" });
}

export function readPayment() {
  const values = readFields(paymentFields);
  return {
    type: $("#payType").value,
    ...values,
    iban: ibanClean(values.iban),
    remittance: readField("remittance"),
  };
}

export function writeBankDetails(values) {
  writeFields(paymentFields, values);
}
