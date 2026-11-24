import { AFRelationship, PDFHexString, PDFName, PDFString } from "pdf-lib";
import { pdfLabels } from "./labels.js";

const attachmentName = "factur-x.xml";
const facturXNamespace = "urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#";

function escapeXML(value) {
  const entities = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  };
  return value.replace(/[&<>"']/g, (character) => entities[character]);
}

function xmpMetadata(title, now) {
  const properties = [
    ["DocumentFileName", attachmentName, "Name of the invoice attachment"],
    ["DocumentType", "INVOICE", "Type of business document"],
    ["Version", "1.0", "Version of the invoice format"],
    ["ConformanceLevel", "EN 16931", "Invoice data profile"],
  ];
  const entries = properties
    .map(([name, value]) => `<fx:${name}>${value}</fx:${name}>`)
    .join("");
  const declarations = properties
    .map(
      ([name, , description]) => `
    <rdf:li rdf:parseType="Resource">
      <pdfaProperty:name>${name}</pdfaProperty:name>
      <pdfaProperty:valueType>Text</pdfaProperty:valueType>
      <pdfaProperty:category>external</pdfaProperty:category>
      <pdfaProperty:description>${description}</pdfaProperty:description>
    </rdf:li>`,
    )
    .join("");
  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
      <pdfaid:part>3</pdfaid:part><pdfaid:conformance>B</pdfaid:conformance>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
      <dc:format>application/pdf</dc:format>
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${escapeXML(title)}</rdf:li></rdf:Alt></dc:title>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/">
      <xmp:CreatorTool>InvoiceGenerator</xmp:CreatorTool><xmp:CreateDate>${now.toISOString()}</xmp:CreateDate>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:fx="${facturXNamespace}">${entries}</rdf:Description>
    <rdf:Description rdf:about=""
      xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/"
      xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#"
      xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">
      <pdfaExtension:schemas><rdf:Bag><rdf:li rdf:parseType="Resource">
        <pdfaSchema:schema>Factur-X Invoice</pdfaSchema:schema>
        <pdfaSchema:namespaceURI>${facturXNamespace}</pdfaSchema:namespaceURI>
        <pdfaSchema:prefix>fx</pdfaSchema:prefix>
        <pdfaSchema:property><rdf:Seq>${declarations}</rdf:Seq></pdfaSchema:property>
      </rdf:li></rdf:Bag></pdfaExtension:schemas>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

export async function addArchivalMetadata(pdf, invoice, xml, icc, locale, contentLanguage) {
  const profile = new Uint8Array(icc);
  const decoder = new TextDecoder();
  if (
    profile.length < 128 ||
    decoder.decode(profile.subarray(12, 20)) !== "mntrRGB " ||
    decoder.decode(profile.subarray(36, 40)) !== "acsp"
  ) {
    throw new Error(
      locale === "en" ? "The sRGB profile for PDF/A could not be read."
        : "Das lokale sRGB-Profil für PDF/A konnte nicht gelesen werden.",
    );
  }
  const now = new Date();
  const iccRef = pdf.context.register(
    pdf.context.flateStream(profile, { N: 3 }),
  );
  const intent = pdf.context.obj({
    Type: "OutputIntent",
    S: "GTS_PDFA1",
    OutputConditionIdentifier: PDFString.of("sRGB IEC61966-2.1"),
    DestOutputProfile: iccRef,
  });
  pdf.catalog.set(
    PDFName.of("OutputIntents"),
    pdf.context.obj([pdf.context.register(intent)]),
  );
  const title = `${pdfLabels[contentLanguage].invoice} ${invoice.number}`;
  const metadata = pdf.context.stream(
    new TextEncoder().encode(xmpMetadata(title, now)),
    {
      Type: "Metadata",
      Subtype: "XML",
    },
  );
  pdf.catalog.set(PDFName.of("Metadata"), pdf.context.register(metadata));
  const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  pdf.context.trailerInfo.ID = pdf.context.obj([
    PDFHexString.of(id),
    PDFHexString.of(id),
  ]);
  await pdf.attach(new TextEncoder().encode(xml), attachmentName, {
    mimeType: "text/xml",
    description: contentLanguage === "en" ? "Factur-X invoice data" : "Factur-X-Rechnungsdaten",
    afRelationship: AFRelationship.Alternative,
    creationDate: now,
    modificationDate: now,
  });
}
