import fs from "fs";
import { ImageAnnotatorClient } from "@google-cloud/vision";

export const GOOGLE_VISION_MAX_BYTES = 20 * 1024 * 1024;

function loadCredentials(): object | undefined {
  const raw = process.env.GOOGLE_CLOUD_CREDENTIALS?.trim();
  if (!raw) return undefined;
  if (raw.startsWith("{")) {
    return JSON.parse(raw) as object;
  }
  if (fs.existsSync(raw)) {
    return JSON.parse(fs.readFileSync(raw, "utf8")) as object;
  }
  throw new Error(
    "GOOGLE_CLOUD_CREDENTIALS must be JSON or a path to a service account file"
  );
}

function adcFileExists(): boolean {
  const adc = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  return Boolean(adc && fs.existsSync(adc));
}

export function isGoogleVisionConfigured(): boolean {
  const raw = process.env.GOOGLE_CLOUD_CREDENTIALS?.trim();
  if (raw?.startsWith("{")) return true;
  if (raw && fs.existsSync(raw)) return true;
  return adcFileExists();
}

function createVisionClient(): ImageAnnotatorClient {
  const credentials = loadCredentials();
  if (credentials) {
    return new ImageAnnotatorClient({ credentials });
  }
  if (adcFileExists()) {
    return new ImageAnnotatorClient();
  }
  throw new Error(
    "Google Vision is not configured. Set GOOGLE_CLOUD_CREDENTIALS (JSON or file path) or a valid GOOGLE_APPLICATION_CREDENTIALS file path."
  );
}

/**
 * OCR a payroll PDF via Cloud Vision batchAnnotateFiles (PDF bytes in-request).
 */
export async function extractPdfTextWithGoogleVision(
  buffer: Buffer
): Promise<string> {
  if (!isGoogleVisionConfigured()) {
    throw new Error("Google Vision is not configured");
  }
  if (buffer.byteLength > GOOGLE_VISION_MAX_BYTES) {
    throw new Error(
      `PDF exceeds Google Vision limit (${Math.round(GOOGLE_VISION_MAX_BYTES / 1024 / 1024)} MB)`
    );
  }

  const client = createVisionClient();
  const [batch] = await client.batchAnnotateFiles({
    requests: [
      {
        inputConfig: {
          mimeType: "application/pdf",
          content: buffer.toString("base64"),
        },
        features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
      },
    ],
  });

  const fileResponse = batch.responses?.[0];
  const pages = fileResponse?.responses ?? [];
  const chunks = pages
    .map((page) => page.fullTextAnnotation?.text?.trim())
    .filter((t): t is string => Boolean(t));

  const combined = chunks.join("\n\n").trim();
  if (!combined) {
    const err = fileResponse?.error?.message;
    throw new Error(err || "Google Vision returned no text");
  }
  return combined;
}
