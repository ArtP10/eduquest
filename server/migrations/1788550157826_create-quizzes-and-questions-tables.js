/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.createTable('quizzes', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()')
    },
    title: {
      type: 'text',
      notNull: true
    },
    author_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE'
    },
    // App-level enum (see server design.md decision 2): validated in the
    // application layer, not a Postgres enum type — matches this schema's
    // existing minimalism (the `users` table has no enum either).
    status: {
      type: 'text',
      notNull: true,
      default: 'draft'
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()')
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()')
    }
  });

  pgm.addConstraint('quizzes', 'quizzes_status_check', {
    check: "status in ('draft', 'published')"
  });

  pgm.createTable('questions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()')
    },
    quiz_id: {
      type: 'uuid',
      notNull: true,
      references: 'quizzes',
      onDelete: 'CASCADE'
    },
    question_text: {
      type: 'text',
      notNull: true
    },
    // 4-element JSON array of choice strings — mirrors the shared runtime
    // Quiz/QuizQuestion type (shared/quiz.ts) exactly, see design.md
    // decision 1, instead of four separate choice_a..d columns.
    choices: {
      type: 'jsonb',
      notNull: true
    },
    // 0-3 index into `choices`, mirroring QuizQuestion.correctIndex.
    correct_choice: {
      type: 'smallint',
      notNull: true
    },
    order_index: {
      type: 'integer',
      notNull: true
    }
  });

  pgm.createIndex('quizzes', 'author_id');
  pgm.createIndex('questions', 'quiz_id');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropTable('questions');
  pgm.dropTable('quizzes');
};
