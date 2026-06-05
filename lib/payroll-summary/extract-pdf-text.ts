import { createRequire } from "module";

const requirePdfParse = createRequire(__filename);

type PdfParseModule = {
  PDFParse: new (options: { data: Buffer }) => {
    getText(): Promise<{ text?: string }>;
    destroy(): Promise<void>;
  };
};

function loadPdfParse(): PdfParseModule {
  return requirePdfParse("pdf-parse") as PdfParseModule;
}

/**
 * Extract plain text from a PDF buffer (server-side only).
 * Uses runtime require so Next.js does not bundle pdfjs-dist.
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const { PDFParse } = loadPdfParse();
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text ?? "";
  } finally {
    await parser.destroy();
  }
}
