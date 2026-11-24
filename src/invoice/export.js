import { prepareLocalInvoice } from "./model.js";
import { buildLocalCII } from "./cii.js";
import { buildLocalUBL } from "./ubl.js";

export async function createLocalInvoiceArtifact(snapshot, kind, renderPDF) {
  const invoice = prepareLocalInvoice(snapshot, kind);
  const xml = invoice.syntax === "UBL" ? buildLocalUBL(invoice) : buildLocalCII(invoice);
  if (kind === "xml") {
    return new Blob([xml], { type: "application/xml" });
  }
  const pdf = await renderPDF(invoice, xml);
  return new Blob([pdf], { type: "application/pdf" });
}
