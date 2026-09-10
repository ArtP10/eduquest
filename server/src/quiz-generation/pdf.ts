import pdfParse from 'pdf-parse';
import { config } from '../config.js';

export type PdfTextResult = { ok: true; text: string } | { ok: false; error: string };

/**
 * Extracts plain text from a PDF buffer entirely in-process — the raw file
 * never leaves the server (see spec: "Local PDF Text Extraction"). Text-layer
 * PDFs only; a scanned/image PDF simply yields little or no text and is
 * rejected by the length check below, per this change's explicit non-goal
 * of OCR support.
 */
export async function extractPdfText(buffer: Buffer): Promise<PdfTextResult> {
  let text: string;
  try {
    const result = await pdfParse(buffer);
    text = result.text ?? '';
  } catch {
    return { ok: false, error: 'The uploaded file could not be read as a PDF.' };
  }

  const trimmed = text.trim();
  if (trimmed.length < config.pdfExtractedTextMinChars) {
    return {
      ok: false,
      error: 'The PDF did not contain enough readable text to generate questions from.'
    };
  }

  const truncated = trimmed.length > config.pdfExtractedTextMaxChars ? trimmed.slice(0, config.pdfExtractedTextMaxChars) : trimmed;
  return { ok: true, text: truncated };
}
