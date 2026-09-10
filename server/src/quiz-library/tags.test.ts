import { describe, expect, it, vi, beforeEach } from 'vitest';

const query = vi.fn();

vi.mock('../db.js', () => ({ getPool: () => ({ query }) }));

const { findOrCreateTag, listTags, listTagsForQuiz } = await import('./tags.js');

beforeEach(() => {
  query.mockReset();
});

describe('findOrCreateTag', () => {
  it('normalizes mixed-case and surrounding whitespace before insert', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'tag-1', name: 'math' }] });

    const tag = await findOrCreateTag(' Math ');

    expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO tags'), ['math']);
    expect(tag).toEqual({ id: 'tag-1', name: 'math' });
  });

  it('reuses an existing tag that only differs by case (insert conflict, fall back to select)', async () => {
    query
      .mockResolvedValueOnce({ rows: [] }) // INSERT ... ON CONFLICT DO NOTHING returns no row
      .mockResolvedValueOnce({ rows: [{ id: 'tag-1', name: 'math' }] }); // fallback SELECT

    const tag = await findOrCreateTag('MATH');

    expect(query).toHaveBeenNthCalledWith(1, expect.stringContaining('INSERT INTO tags'), ['math']);
    expect(query).toHaveBeenNthCalledWith(2, expect.stringContaining('SELECT * FROM tags'), ['math']);
    expect(tag).toEqual({ id: 'tag-1', name: 'math' });
  });

  it('does not create two rows when two concurrent first-uses race on the same new tag', async () => {
    // Simulates: both requests attempt the INSERT; only one wins the unique
    // constraint, the other's ON CONFLICT DO NOTHING returns no row and
    // falls back to SELECT, landing on the same row the winner created.
    query
      .mockResolvedValueOnce({ rows: [{ id: 'tag-1', name: 'science' }] }) // request A wins the insert
      .mockResolvedValueOnce({ rows: [] }) // request B's insert conflicts
      .mockResolvedValueOnce({ rows: [{ id: 'tag-1', name: 'science' }] }); // request B falls back to select

    const [tagA, tagB] = await Promise.all([findOrCreateTag('Science'), findOrCreateTag('science')]);

    expect(tagA.id).toBe('tag-1');
    expect(tagB.id).toBe('tag-1');
  });
});

describe('listTags', () => {
  it('returns all tags', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'tag-1', name: 'math' }, { id: 'tag-2', name: 'science' }] });
    const tags = await listTags();
    expect(tags).toHaveLength(2);
  });
});

describe('listTagsForQuiz', () => {
  it('returns only tags attached to the given quiz', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'tag-1', name: 'math' }] });
    const tags = await listTagsForQuiz('quiz-1');
    expect(query).toHaveBeenCalledWith(expect.stringContaining('quiz_tags.quiz_id = $1'), ['quiz-1']);
    expect(tags).toEqual([{ id: 'tag-1', name: 'math' }]);
  });
});
