/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

// Fixed ids — MUST match server/src/quizzes.ts exactly (that file is the
// source of truth for content; these rows exist purely so match history can
// FK a played match to a real `quizzes` row — see design.md decision 6 and
// the comment atop quizzes.ts).
const CULTURA_GENERAL_QUIZ_ID = '4061f2ae-33bf-4583-ad4e-f66949f6fe6e';
const CIENCIAS_BASICAS_QUIZ_ID = 'c66bb43e-d219-4ab1-9e53-903d3dfaf0a4';

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.alterColumn('quizzes', 'author_id', { notNull: false });

  pgm.addColumn('quizzes', {
    // True only for the two built-in quizzes seeded below. author_id is
    // null for these too, but this flag is kept as an explicit,
    // self-documenting signal rather than relying on "author_id is null" to
    // implicitly mean "sample quiz" (see server/src/quiz-builder/quizzes.ts).
    is_sample: {
      type: 'boolean',
      notNull: true,
      default: false
    }
  });

  // Seeded as 'draft' (not 'published'): keeps them out of GET
  // /quizzes/published (the public Quiz Library) and out of GET /quizzes/:id
  // for anyone, exactly like today's in-memory-only behavior — they're only
  // ever reachable through resolveQuizForRoom()'s in-memory lookup
  // (server/src/quizzes.ts), never through the quiz-builder/library routes.
  pgm.sql(`
    INSERT INTO quizzes (id, title, author_id, status, is_sample) VALUES
      ('${CULTURA_GENERAL_QUIZ_ID}', 'Cultura General', NULL, 'draft', true),
      ('${CIENCIAS_BASICAS_QUIZ_ID}', 'Ciencias Básicas', NULL, 'draft', true)
    ON CONFLICT (id) DO NOTHING;
  `);

  pgm.sql(`
    INSERT INTO questions (quiz_id, question_text, choices, correct_choice, order_index) VALUES
      ('${CULTURA_GENERAL_QUIZ_ID}', '¿Cuál es la capital de Francia?', '["Berlín","Madrid","París","Roma"]', 2, 0),
      ('${CULTURA_GENERAL_QUIZ_ID}', '¿Qué planeta es conocido como el Planeta Rojo?', '["Venus","Marte","Júpiter","Saturno"]', 1, 1),
      ('${CULTURA_GENERAL_QUIZ_ID}', '¿Cuántos continentes hay en la Tierra?', '["5","6","7","8"]', 2, 2),
      ('${CULTURA_GENERAL_QUIZ_ID}', '¿Cuál es el océano más grande del mundo?', '["Atlántico","Índico","Ártico","Pacífico"]', 3, 3),
      ('${CULTURA_GENERAL_QUIZ_ID}', '¿Quién escribió "Romeo y Julieta"?', '["Charles Dickens","William Shakespeare","Mark Twain","Jane Austen"]', 1, 4),

      ('${CIENCIAS_BASICAS_QUIZ_ID}', '¿Qué gas absorben las plantas de la atmósfera para la fotosíntesis?', '["Oxígeno","Nitrógeno","Dióxido de carbono","Hidrógeno"]', 2, 0),
      ('${CIENCIAS_BASICAS_QUIZ_ID}', '¿Cuál es el símbolo químico del agua?', '["H2O","CO2","O2","NaCl"]', 0, 1),
      ('${CIENCIAS_BASICAS_QUIZ_ID}', '¿Cuántos huesos tiene el cuerpo humano adulto?', '["186","206","226","246"]', 1, 2),
      ('${CIENCIAS_BASICAS_QUIZ_ID}', '¿Qué fuerza atrae los objetos hacia el centro de la Tierra?', '["Magnetismo","Fricción","Gravedad","Inercia"]', 2, 3),
      ('${CIENCIAS_BASICAS_QUIZ_ID}', '¿Cuál es la central energética de la célula?', '["Núcleo","Ribosoma","Mitocondria","Aparato de Golgi"]', 2, 4);
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.sql(`DELETE FROM questions WHERE quiz_id IN ('${CULTURA_GENERAL_QUIZ_ID}', '${CIENCIAS_BASICAS_QUIZ_ID}');`);
  pgm.sql(`DELETE FROM quizzes WHERE id IN ('${CULTURA_GENERAL_QUIZ_ID}', '${CIENCIAS_BASICAS_QUIZ_ID}');`);
  pgm.dropColumn('quizzes', 'is_sample');
  pgm.alterColumn('quizzes', 'author_id', { notNull: true });
};
