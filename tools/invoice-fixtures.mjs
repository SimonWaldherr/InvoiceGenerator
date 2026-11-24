import { readFile } from "node:fs/promises";
import { inflateFont } from "../src/invoice/pdf/inflate-font.js";

export const draft = {
  header: {
    profile: "EN16931",
    syntax: "CII",
    number: "TEST-1",
    date: "2026-10-15",
    supplyDate: "2026-10-10",
    dueDate: "2026-10-30",
    currency: "EUR",
  },
  seller: {
    name: "Muster & Partner",
    street: "Ring 1",
    zip: "10115",
    city: "Berlin",
    country: "DE",
    vat: "DE123456789",
  },
  buyer: {
    name: "Beispiel AG",
    street: "Ring 2",
    zip: "10115",
    city: "Berlin",
    country: "DE",
  },
  payment: { type: "58", iban: "DE89370400440532013000" },
  lines: [
    {
      name: "Dienstleistung",
      qty: 1.2345,
      price: 4.99,
      disc: 12.34,
      cat: "Z",
      rate: 0,
      unit: "HUR",
    },
  ],
};

export async function loadPdfAssets() {
  const [regularDeflate, boldDeflate, icc] = await Promise.all(
    [
      "../assets/fonts/NotoSans-Regular.ttf.deflate",
      "../assets/fonts/NotoSans-Bold.ttf.deflate",
      "../assets/sRGB2014.icc",
    ].map((path) => readFile(new URL(path, import.meta.url))),
  );
  return {
    regularFont: inflateFont(regularDeflate),
    boldFont: inflateFont(boldDeflate),
    icc,
  };
}
