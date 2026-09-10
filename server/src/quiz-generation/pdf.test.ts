import { describe, expect, it, vi } from 'vitest';

vi.mock('../config.js', () => ({
  config: {
    pdfExtractedTextMinChars: 10,
    pdfExtractedTextMaxChars: 40
  }
}));

const pdfParseMock = vi.fn();
vi.mock('pdf-parse', () => ({ default: (...args: unknown[]) => pdfParseMock(...args) }));

const { extractPdfText } = await import('./pdf.js');

describe('extractPdfText', () => {
  it('extracts text from a valid text-layer PDF', async () => {
    pdfParseMock.mockResolvedValueOnce({ text: 'This is enough readable text for a question.' });
    const result = await extractPdfText(Buffer.from('%PDF-1.4 fake'));
    expect(result).toEqual({ ok: true, text: 'This is enough readable text for a question.'.slice(0, 40) });
  });

  it('rejects a PDF with too little text (e.g. empty/scanned PDF)', async () => {
    pdfParseMock.mockResolvedValueOnce({ text: '  hi  ' });
    const result = await extractPdfText(Buffer.from('%PDF-1.4 fake'));
    expect(result.ok).toBe(false);
  });

  it('rejects a corrupt/non-PDF buffer', async () => {
    pdfParseMock.mockRejectedValueOnce(new Error('invalid PDF structure'));
    const result = await extractPdfText(Buffer.from('not a pdf at all'));
    expect(result.ok).toBe(false);
  });

  it('truncates text longer than the configured max length', async () => {
    const longText = 'word '.repeat(20).trim();
    pdfParseMock.mockResolvedValueOnce({ text: longText });
    const result = await extractPdfText(Buffer.from('%PDF-1.4 fake'));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text.length).toBeLessThanOrEqual(40);
    }
  });
});
