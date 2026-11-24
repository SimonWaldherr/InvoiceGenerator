export const settingsDefaults = Object.freeze({
  profile: "EN16931",
  syntax: "CII",
  currency: "EUR",
  company: "",
  paymentType: "",
  paymentTerms: "",
  businessProcess: "",
});

export function isSettings(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value.profile === "EN16931" || value.profile === "XRECHNUNG") &&
    (value.syntax === "CII" ||
      (value.profile === "XRECHNUNG" && value.syntax === "UBL")) &&
    ["EUR", "USD", "GBP", "CHF"].includes(value.currency) &&
    (["", "10", "30"].includes(value.paymentType) ||
      (value.currency === "EUR" && value.paymentType === "58")) &&
    [value.company, value.paymentTerms, value.businessProcess].every(
      (field) => typeof field === "string",
    )
  );
}
