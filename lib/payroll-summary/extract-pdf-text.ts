import { createRequire } from "module";
import {
  extractPdfTextWithOcrSpace,
  isOcrSpaceConfigured,
  OCR_SPACE_MAX_BYTES,
  shouldPreferOcrSpace,
} from "./ocr-space";
import {
  isPayrollPdfTextSufficient,
  scorePayrollPdfText,
} from "./pdf-text-quality";

const requirePdfParse = createRequire(__filename);

export type PdfTextSource = "pdf-parse" | "ocr-space";

export interface PdfTextExtractionResult {
  text: string;
  source: PdfTextSource;
  nativeScore: number;
  ocrScore: number | null;
  nativeText: string;
  ocrText: string | null;
}

type PdfParseModule = {
  PDFParse: new (options: {
    data: Buffer;
    CanvasFactory?: unknown;
  }) => {
    getText(): Promise<{ text?: string }>;
    destroy(): Promise<void>;
  };
  CanvasFactory: unknown;
};

let pdfParseModule: PdfParseModule | null = null;

function loadPdfParse(): PdfParseModule {
  if (pdfParseModule) return pdfParseModule;
  // Worker must load before pdf-parse — sets up DOMMatrix/ImageData for pdfjs-dist on Node.
  const { CanvasFactory } = requirePdfParse("pdf-parse/worker") as {
    CanvasFactory: unknown;
  };
  const { PDFParse } = requirePdfParse("pdf-parse") as {
    PDFParse: PdfParseModule["PDFParse"];
  };
  pdfParseModule = { PDFParse, CanvasFactory };
  return pdfParseModule;
}

async function extractWithPdfParse(buffer: Buffer): Promise<string> {
  const { PDFParse, CanvasFactory } = loadPdfParse();
  const parser = new PDFParse({ data: buffer, CanvasFactory });
  try {
    const result = await parser.getText();
    return result.text ?? "";
  } finally {
    await parser.destroy();
  }
}

function pickBestText(
  nativeText: string,
  ocrText: string | null
): { text: string; source: PdfTextSource } {
  const nativeScore = scorePayrollPdfText(nativeText);
  const ocrScore = ocrText != null ? scorePayrollPdfText(ocrText) : -1;

  if (ocrText == null) {
    return { text: nativeText, source: "pdf-parse" };
  }

  if (shouldPreferOcrSpace() && ocrScore > nativeScore) {
    return { text: ocrText, source: "ocr-space" };
  }

  if (ocrScore > nativeScore) {
    return { text: ocrText, source: "ocr-space" };
  }

  if (!isPayrollPdfTextSufficient(nativeText) && ocrScore >= nativeScore) {
    return { text: ocrText, source: "ocr-space" };
  }

  return { text: nativeText, source: "pdf-parse" };
}

/**
 * Extract plain text from a PDF buffer (server-side only).
 * Uses pdf-parse first; when OCR_SPACE_API_KEY is set, also calls OCR.space
 * and keeps whichever text scores better for payroll register parsing.
 */
export async function extractPdfTextResult(
  buffer: Buffer
): Promise<PdfTextExtractionResult> {
  const nativeText = await extractWithPdfParse(buffer);
  const nativeScore = scorePayrollPdfText(nativeText);

  let ocrText: string | null = null;
  let ocrScore: number | null = null;

  const ocrEnabled = isOcrSpaceConfigured();
  const withinSizeLimit = buffer.byteLength <= OCR_SPACE_MAX_BYTES;

  if (ocrEnabled && withinSizeLimit) {
    try {
      ocrText = await extractPdfTextWithOcrSpace(buffer);
      ocrScore = scorePayrollPdfText(ocrText);
    } catch (error) {
      console.warn(
        "OCR.space failed, using pdf-parse text:",
        error instanceof Error ? error.message : error
      );
    }
  } else if (ocrEnabled && !withinSizeLimit) {
    console.warn(
      `PDF size ${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB exceeds OCR.space free limit; using pdf-parse only`
    );
  }

  const picked = pickBestText(nativeText, ocrText);

  return {
    text: picked.text,
    source: picked.source,
    nativeScore,
    ocrScore,
    nativeText,
    ocrText,
  };
}

/** @deprecated Prefer extractPdfTextResult for source metadata */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const result = await extractPdfTextResult(buffer);
  return result.text;
}
