import { $ } from "../utils.js";
import { createLocalInvoiceArtifact } from "../invoice/export.js";
import { renderPDF } from "./pdf-loader.js";
import { collect, validate, draftChangeEvent } from "./draft-form.js";
import { readField } from "./invoice-fields.js";
import { downloadArtifact } from "./download.js";
import { localeChangeEvent, tr } from "./i18n.js";

let exportRequest = null;
let xmlArtifact = null;
let pdfPreview = null;
let latestStatus = null;

function setExportStatus(message, error = false) {
  latestStatus = { message, error };
  renderStatus(error);
}

function renderStatus(focus = false) {
  if (!latestStatus) return;
  const { message, error } = latestStatus;
  const text = typeof message === "function" ? message() : message;
  const status = $("#exportStatus");
  if (status) {
    status.textContent = text;
    status.dataset.error = String(error);
    if (focus) status.focus();
  } else if (error && focus) {
    alert(text);
  }
}

function updateExportButtons() {
  const xml = $("#genXml");
  const pdf = $("#genPdf");
  const profile = $("#profile").value;
  if (xml) xml.disabled = Boolean(exportRequest);
  if (pdf) pdf.disabled = Boolean(exportRequest) || profile !== "EN16931";
  const hint = $("#exportProfileHelp");
  if (hint) {
    const syntax = readField("syntax") === "UBL" ? "UBL 2.1" : "CII";
    const text =
      profile === "XRECHNUNG"
        ? tr(
            `XRechnung 3.0 als XML (${syntax}).`,
            `XRechnung 3.0 as XML (${syntax}).`,
          )
        : tr(
            "EN 16931 als CII-XML oder ZUGFeRD-PDF. Für eine XRechnung zuerst das Rechnungsprofil wechseln.",
            "EN 16931 as CII XML or ZUGFeRD PDF. To export an XRechnung, change the invoice profile first.",
          );
    if (hint.textContent !== text) hint.textContent = text;
  }
}

function invalidateExports() {
  exportRequest?.controller.abort();
  exportRequest = null;
  xmlArtifact = null;
  if (pdfPreview) {
    URL.revokeObjectURL(pdfPreview.url);
    pdfPreview = null;
  }
  $("#pdfPreview")?.removeAttribute("src");
  const placeholder = $("#pdfPreviewPlaceholder");
  if (placeholder) placeholder.hidden = false;
  const download = $("#dlPdf");
  if (download) download.disabled = true;
  const xmlOutput = $("#xmlOut");
  if (xmlOutput) xmlOutput.textContent = "";
  const xmlPreview = $("#xmlPreview");
  if (xmlPreview) {
    xmlPreview.hidden = true;
    xmlPreview.open = false;
  }
  setExportStatus(() =>
    tr(
      "Erstellen Sie für die aktuellen Angaben einen neuen Export.",
      "Export again to include your changes.",
    ),
  );
}

function syncExports(signature) {
  const active = exportRequest ?? pdfPreview ?? xmlArtifact;
  if (active && active.signature !== (signature ?? JSON.stringify(collect()))) {
    invalidateExports();
  }
  updateExportButtons();
}

function downloadXml(artifact) {
  downloadArtifact(artifact.blob, artifact.filename);
  setExportStatus(() =>
    tr("XML-Download gestartet.", "XML download started."),
  );
}

async function exportInvoice(kind) {
  if (exportRequest) return;
  const snapshot = collect();
  const signature = JSON.stringify(snapshot);
  syncExports(signature);
  if (kind === "xml" && xmlArtifact) {
    downloadXml(xmlArtifact);
    return;
  }
  const errors = validate(snapshot);
  if (errors.length) {
    setExportStatus(
      () =>
        tr(
          "Bitte ausfüllen oder korrigieren – ",
          "Complete or correct these fields – ",
        ) + validate(snapshot).join(", "),
      true,
    );
    return;
  }
  const request = { signature, controller: new AbortController() };
  exportRequest = request;
  updateExportButtons();
  setExportStatus(() =>
    kind === "pdf"
      ? tr("ZUGFeRD-PDF wird erstellt …", "Creating ZUGFeRD PDF …")
      : tr("XML wird erstellt …", "Creating XML …"),
  );
  try {
    const blob = await createLocalInvoiceArtifact(
      snapshot,
      kind,
      (invoice, xml) => renderPDF(invoice, xml, request.controller.signal),
    );
    const xml = kind === "xml" ? await blob.text() : null;
    if (exportRequest !== request) return;
    if (JSON.stringify(collect()) !== signature) {
      invalidateExports();
      updateExportButtons();
      return;
    }
    const filename = snapshot.header.number + "." + kind;
    if (kind === "xml") {
      const output = $("#xmlOut");
      if (output) output.textContent = xml;
      const xmlPreview = $("#xmlPreview");
      if (xmlPreview) xmlPreview.hidden = false;
      xmlArtifact = { blob, filename, signature };
      downloadXml(xmlArtifact);
    } else {
      const iframe = $("#pdfPreview");
      const download = $("#dlPdf");
      if (iframe && download) {
        if (pdfPreview) URL.revokeObjectURL(pdfPreview.url);
        pdfPreview = {
          blob,
          filename,
          signature,
          url: URL.createObjectURL(blob),
        };
        iframe.src = pdfPreview.url;
        const placeholder = $("#pdfPreviewPlaceholder");
        if (placeholder) placeholder.hidden = true;
        download.disabled = false;
        setExportStatus(() =>
          tr(
            "ZUGFeRD-PDF ist fertig und kann heruntergeladen werden.",
            "The ZUGFeRD PDF is ready to download.",
          ),
        );
      } else {
        downloadArtifact(blob, filename);
        setExportStatus(() =>
          tr("ZUGFeRD-PDF wurde heruntergeladen.", "ZUGFeRD PDF downloaded."),
        );
      }
    }
  } catch (error) {
    if (exportRequest === request)
      setExportStatus(
        error.message ||
          (() => tr("Der Export ist fehlgeschlagen.", "Export failed.")),
        true,
      );
  } finally {
    if (exportRequest === request) {
      exportRequest = null;
      updateExportButtons();
    }
  }
}

export function initInvoiceExport() {
  document.addEventListener(draftChangeEvent, () => syncExports());
  document.addEventListener(localeChangeEvent, () => {
    updateExportButtons();
    renderStatus();
  });
  $("#genXml")?.addEventListener("click", () => exportInvoice("xml"));
  $("#genPdf")?.addEventListener("click", () => exportInvoice("pdf"));
  $("#dlPdf")?.addEventListener("click", () => {
    if (!pdfPreview) return;
    if (JSON.stringify(collect()) !== pdfPreview.signature) {
      invalidateExports();
      updateExportButtons();
      return;
    }
    downloadArtifact(pdfPreview.blob, pdfPreview.filename);
  });
}
