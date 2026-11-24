import { $ } from "../utils.js";
import { createLocalInvoiceArtifact } from "../invoice/export.js";
import { renderPDF } from "./pdf-loader.js";
import { collect, validate, draftChangeEvent } from "./draft-form.js";
import { readField } from "./invoice-fields.js";
import { downloadArtifact } from "./download.js";
import { localeChangeEvent, tr } from "./i18n.js";
import {
  fieldProblems,
  focusField,
  invalidFields,
  showProblems,
} from "./validation-ui.js";

let exportRequest = null;
let xmlArtifact = null;
let pdfPreview = null;
let latestStatus = null;

function setExportStatus(message, error = false, problems = false) {
  latestStatus = { message, error, problems };
  renderStatus(error);
}

function renderStatus(focus = false) {
  if (!latestStatus) return;
  const { message, error, problems } = latestStatus;
  const text = typeof message === "function" ? message() : message;
  const status = $("#exportStatus");
  if (status) {
    status.textContent = text;
    status.dataset.error = String(error);
    renderProblems(problems);
    if (focus) status.focus();
  } else if (error && focus) {
    alert(text);
  }
}

function renderProblems(show) {
  const list = $("#exportProblems");
  if (!list) return;
  const problems = show ? fieldProblems() : [];
  list.replaceChildren(
    ...problems.map(({ field, label }) => {
      const item = document.createElement("li");
      const jump = document.createElement("button");
      jump.type = "button";
      jump.className = "link-button";
      jump.textContent = label;
      jump.addEventListener("click", () => focusField(field));
      item.append(jump);
      return item;
    }),
  );
  list.hidden = problems.length === 0;
}

function clearStatus() {
  latestStatus = null;
  const status = $("#exportStatus");
  if (status) {
    status.textContent = "";
    delete status.dataset.error;
  }
  renderProblems(false);
}

function refreshProblems() {
  if (!latestStatus?.problems) return;
  if (!invalidFields().length && !validate(collect()).length) clearStatus();
  else renderStatus();
}

function updateExportButtons() {
  const xml = $("#genXml");
  const pdf = $("#genPdf");
  const download = $("#dlPdf");
  const profile = $("#profile").value;
  const pdfProfile = profile === "EN16931";
  const pdfReady = Boolean(pdfPreview);
  const busy = exportRequest?.kind;
  for (const [button, kind] of [
    [xml, "xml"],
    [pdf, "pdf"],
  ]) {
    if (!button) continue;
    button.toggleAttribute("data-busy", busy === kind);
    button.setAttribute("aria-busy", String(busy === kind));
  }
  // Only EN 16931 can be exported as a PDF, so XRechnung hides those actions.
  if (xml) {
    xml.disabled = Boolean(exportRequest);
    xml.classList.toggle("ghost", pdfProfile);
  }
  if (pdf) {
    pdf.hidden = !pdfProfile;
    pdf.disabled = Boolean(exportRequest);
    pdf.classList.toggle("ghost", pdfReady);
  }
  if (download) {
    download.hidden = !pdfProfile;
    download.disabled = !pdfReady;
    download.classList.toggle("ghost", !pdfReady);
  }
  const hint = $("#exportProfileHelp");
  if (hint) {
    const syntax = readField("syntax") === "UBL" ? "UBL 2.1" : "CII";
    const text =
      profile === "XRECHNUNG"
        ? tr(
            `XRechnung 3.0 wird als XML (${syntax}) exportiert. Ein ZUGFeRD-PDF gibt es nur mit dem Profil EN 16931.`,
            `XRechnung 3.0 is exported as XML (${syntax}). A ZUGFeRD PDF is only available with the EN 16931 profile.`,
          )
        : tr(
            "EN 16931 als ZUGFeRD-PDF oder als CII-XML exportieren. Für eine XRechnung zuerst das Rechnungsprofil wechseln.",
            "Export EN 16931 as a ZUGFeRD PDF or as CII XML. To export an XRechnung, change the invoice profile first.",
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
  const preview = $("#pdfPreviewRow");
  if (preview) {
    preview.hidden = true;
    preview.open = false;
  }
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
    showProblems({ focus: false });
    setExportStatus(
      () =>
        fieldProblems().length
          ? tr(
              "Bitte diese Angaben ausfüllen oder korrigieren:",
              "Complete or correct these fields:",
            )
          : tr(
              "Bitte ausfüllen oder korrigieren – ",
              "Complete or correct these fields – ",
            ) + validate(snapshot).join(", "),
      true,
      true,
    );
    return;
  }
  const request = { kind, signature, controller: new AbortController() };
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
        const preview = $("#pdfPreviewRow");
        if (preview) {
          preview.hidden = false;
          preview.open = true;
        }
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
    if (exportRequest === request) {
      showProblems({ focus: false });
      setExportStatus(
        error.message ||
          (() => tr("Der Export ist fehlgeschlagen.", "Export failed.")),
        true,
        fieldProblems().length > 0,
      );
    }
  } finally {
    if (exportRequest === request) {
      exportRequest = null;
      updateExportButtons();
    }
  }
}

export function initInvoiceExport() {
  document.addEventListener(draftChangeEvent, () => {
    syncExports();
    refreshProblems();
  });
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
