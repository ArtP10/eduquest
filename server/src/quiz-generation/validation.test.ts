import { describe, expect, it } from 'vitest';
import { validateQuestionCount } from './validation.js';

describe('validateQuestionCount', () => {
  it('accepts valid multiples of 5 within range', () => {
    for (const value of [5, 10, 25, 50]) {
      expect(validateQuestionCount(value)).toEqual({ ok: true, questionCount: value });
    }
  });

  it('rejects values that are not a multiple of 5', () => {
    const result = validateQuestionCount(12);
    expect(result.ok).toBe(false);
  });

  it('rejects values below the minimum', () => {
    const result = validateQuestionCount(0);
    expect(result.ok).toBe(false);
  });

  it('rejects values above the maximum', () => {
    const result = validateQuestionCount(55);
    expect(result.ok).toBe(false);
  });

  it('rejects non-numeric input', () => {
    const result = validateQuestionCount('twenty');
    expect(result.ok).toBe(false);
  });

  it('accepts numeric strings', () => {
    expect(validateQuestionCount('20')).toEqual({ ok: true, questionCount: 20 });
  });
});
