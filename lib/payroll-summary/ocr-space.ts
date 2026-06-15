const OCR_SPACE_URL = "https://api.ocr.space/parse/image";
/** Free tier: 1 MB per file (https://ocr.space/OCRAPI) */
export const OCR_SPACE_MAX_BYTES = 1 * 1024 * 1024;

export interface OcrSpaceOptions {
  apiKey: string;
  language?: string;
  /** Engine 2 handles symbols and tables better than engine 1 */
  ocrEngine?: "1" | "2" | "3";
}

interface OcrSpaceParsedResult {
  ParsedText?: string;
  ErrorMessage?: string;
  ErrorDetails?: string;
}

interface OcrSpaceResponse {
  IsErroredOnProcessing?: boolean;
  ErrorMessage?: string | string[];
  ParsedResults?: OcrSpaceParsedResult[] | null;
}

export function isOcrSpaceConfigured(): boolean {
  return Boolean(process.env.OCR_SPACE_API_KEY?.trim());
}

export function shouldPreferOcrSpace(): boolean {
  return process.env.OCR_SPACE_PREFER === "true";
}

/**
 * Extract text via OCR.space API (Tesseract-based hosted OCR).
 * @see https://ocr.space/OCRAPI
 */
export async function extractPdfTextWithOcrSpace(
  buffer: Buffer,
  options?: Partial<OcrSpaceOptions>
): Promise<string> {
  const apiKey = options?.apiKey ?? process.env.OCR_SPACE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OCR_SPACE_API_KEY is not configured");
  }

  if (buffer.byteLength > OCR_SPACE_MAX_BYTES) {
    throw new Error(
      `PDF exceeds OCR.space free tier limit (${Math.round(OCR_SPACE_MAX_BYTES / 1024 / 1024)} MB)`
    );
  }

  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(buffer)], { type: "application/pdf" }),
    "payroll-summary.pdf"
  );
  form.append("apikey", apiKey);
  form.append("language", options?.language ?? "eng");
  form.append("isOverlayRequired", "false");
  form.append("OCREngine", options?.ocrEngine ?? "2");
  form.append("scale", "true");
  form.append("detectOrientation", "true");
  form.append("isTable", "true");

  const response = await fetch(OCR_SPACE_URL, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    throw new Error(`OCR.space HTTP ${response.status}: ${response.statusText}`);
  }

  const json = (await response.json()) as OcrSpaceResponse;

  if (json.IsErroredOnProcessing) {
    const msg = Array.isArray(json.ErrorMessage)
      ? json.ErrorMessage.join("; ")
      : json.ErrorMessage;
    throw new Error(msg || "OCR.space processing failed");
  }

  const parts =
    json.ParsedResults?.map((r) => r.ParsedText?.trim() ?? "").filter(Boolean) ??
    [];

  if (parts.length === 0) {
    throw new Error("OCR.space returned no text");
  }

  return parts.join("\n\n");
}
