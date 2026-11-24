import { buildLocalPDF } from "./render.js";
import { getPdfAssets } from "./assets.js";

globalThis.invoiceGeneratorRenderPDF = (invoice, xml, locale) =>
  buildLocalPDF(invoice, xml, getPdfAssets(), locale);
