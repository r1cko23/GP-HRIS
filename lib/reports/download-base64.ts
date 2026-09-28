/**
 * Shared browser helpers for downloading report Excel / PDF blobs.
 */

export function downloadBase64File(
  base64: string,
  filename: string,
  mime: string
): void {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadBase64Xlsx(base64: string, filename: string): void {
  downloadBase64File(
    base64,
    filename,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}

export function downloadBase64Pdf(base64: string, filename: string): void {
  downloadBase64File(base64, filename, "application/pdf");
}
