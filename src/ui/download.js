export function safeFilename(filename) {
  const cleaned = filename
    .normalize("NFC")
    .replace(
      /[<>:"/\\|?*\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,
      "-",
    )
    .replace(/^[. ]+|[. ]+$/g, "");
  if (/^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(cleaned)) {
    return "_" + cleaned;
  }
  return cleaned || "invoice";
}

export function downloadArtifact(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = safeFilename(filename);
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadJSON(value, filename) {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json",
  });
  downloadArtifact(blob, filename);
}
