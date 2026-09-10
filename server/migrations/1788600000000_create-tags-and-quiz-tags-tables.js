/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.createTable('tags', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()')
    },
    // Always stored trimmed + lowercased by the application (see
    // server/src/quiz-library/tags.ts#findOrCreateTag) so "Math" and "math"
    // collapse into one row. The unique constraint is a race-condition
    // backstop, not the sole dedup mechanism.
    name: {
      type: 'text',
      notNull: true,
      unique: true
    }
  });

  pgm.createTable('quiz_tags', {
    quiz_id: {
      type: 'uuid',
      notNull: true,
      references: 'quizzes',
      onDelete: 'CASCADE'
    },
    tag_id: {
      type: 'uuid',
      notNull: true,
      references: 'tags',
      onDelete: 'CASCADE'
    }
  });

  pgm.addConstraint('quiz_tags', 'quiz_tags_pkey', {
    primaryKey: ['quiz_id', 'tag_id']
  });

  // Unique constraint on tags.name already provides a lookup index; no
  // separate index needed there. quiz_tags is looked up by quiz_id (already
  // covered by the composite PK) and by tag_id (for the published-quiz
  // tag-filter join), so index that side explicitly.
  pgm.createIndex('quiz_tags', 'tag_id');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropTable('quiz_tags');
  pgm.dropTable('tags');
};
