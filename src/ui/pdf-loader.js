import { language, tr } from "./i18n.js";

// The UI is a classic script, so the downloaded release also works from file://.
const rendererURL = new URL("pdf-export.js", document.currentScript.src);
let rendererPromise;

export async function renderPDF(invoice, xml, signal) {
  rendererPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    function failed() {
      script.remove();
      reject(
        new Error(
          tr(
            "Das PDF-Modul konnte nicht geladen werden. Bitte laden Sie die Seite neu oder öffnen Sie das vollständige Offline-Paket.",
            "The PDF module could not be loaded. Reload the page or open the complete offline package.",
          ),
        ),
      );
    }
    script.onload = () => {
      const render = globalThis.invoiceGeneratorRenderPDF;
      if (typeof render === "function") resolve(render);
      else failed();
    };
    script.onerror = failed;
    script.src = rendererURL.href;
    document.head.appendChild(script);
  }).catch((error) => {
    rendererPromise = undefined;
    throw error;
  });
  const render = await rendererPromise;
  if (signal?.aborted) throw new DOMException("Export cancelled", "AbortError");
  return render(invoice, xml, language());
}
