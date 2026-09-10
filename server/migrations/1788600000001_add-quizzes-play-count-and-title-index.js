/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.addColumn('quizzes', {
    play_count: {
      type: 'integer',
      notNull: true,
      default: 0
    }
  });

  // Supports the Quiz Library's title keyword search (ILIKE) and general
  // title lookups. A plain b-tree index cannot serve a leading-wildcard
  // ILIKE efficiently at scale — acceptable for this phase, see design.md.
  pgm.createIndex('quizzes', 'title');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropIndex('quizzes', 'title');
  pgm.dropColumn('quizzes', 'play_count');
};
