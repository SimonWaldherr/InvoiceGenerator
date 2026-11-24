import { PDFContext, PDFRawStream, decodePDFRawStream } from "pdf-lib";

// The bundled files use the same zlib format as a PDF FlateDecode stream.
export function inflateFont(bytes) {
  const dict = PDFContext.create().obj({ Filter: "FlateDecode" });
  return decodePDFRawStream(PDFRawStream.of(dict, bytes)).decode();
}
