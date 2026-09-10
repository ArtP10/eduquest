/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.createTable('matches', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()')
    },
    // Every quiz — built-in "sample" quizzes included — is a real `quizzes`
    // row (see 1788600000003_add-sample-quiz-support, which seeds them with
    // fixed ids), so this is a straightforward FK, never null.
    quiz_id: {
      type: 'uuid',
      notNull: true,
      references: 'quizzes',
      onDelete: 'RESTRICT'
    },
    // Snapshot of the quiz's title at play time, so match history keeps
    // showing the title it was played under even if the quiz is later
    // renamed.
    quiz_title: {
      type: 'text',
      notNull: true
    },
    // Nullable: room creation has no auth requirement, so a guest can host a
    // room (see design.md decision 2).
    room_creator_id: {
      type: 'uuid',
      references: 'users',
      onDelete: 'SET NULL'
    },
    played_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()')
    }
  });

  pgm.createTable('match_players', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()')
    },
    match_id: {
      type: 'uuid',
      notNull: true,
      references: 'matches',
      onDelete: 'CASCADE'
    },
    // Nullable: guests are never linked to an account (see proposal).
    user_id: {
      type: 'uuid',
      references: 'users',
      onDelete: 'SET NULL'
    },
    nickname: {
      type: 'text',
      notNull: true
    },
    final_score: {
      type: 'integer',
      notNull: true
    },
    final_placement: {
      type: 'integer',
      notNull: true
    }
  });

  pgm.createTable('match_answers', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()')
    },
    match_id: {
      type: 'uuid',
      notNull: true,
      references: 'matches',
      onDelete: 'CASCADE'
    },
    // Position within the match's (shuffled) question order — not a
    // `questions` FK: QuizQuestion (shared/quiz.ts) carries no DB question id
    // for either a mock or a published quiz (see design.md decision 6).
    question_index: {
      type: 'integer',
      notNull: true
    },
    match_player_id: {
      type: 'uuid',
      notNull: true,
      references: 'match_players',
      onDelete: 'CASCADE'
    },
    // Full snapshot of the question as presented to this room — not a
    // `questions` FK, for the same reason as question_index above, and also
    // because a room's choice order is independently shuffled per room (see
    // shuffleQuizForRoom in rooms.ts), so the *authored* question/choices
    // wouldn't match what this player actually saw and answered.
    question_text: {
      type: 'text',
      notNull: true
    },
    choices: {
      type: 'jsonb',
      notNull: true
    },
    correct_choice_index: {
      type: 'smallint',
      notNull: true
    },
    // Null when the player didn't answer in time.
    selected_choice_index: {
      type: 'smallint'
    },
    is_correct: {
      type: 'boolean',
      notNull: true
    },
    answer_time_ms: {
      type: 'integer'
    }
  });

  pgm.createIndex('match_players', 'match_id');
  pgm.createIndex('match_answers', ['match_id', 'question_index']);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropTable('match_answers');
  pgm.dropTable('match_players');
  pgm.dropTable('matches');
};
