import type { Quiz } from '@quizjumper/shared/quiz';

// Quiz data shape: see shared/quiz.ts (Quiz, QuizQuestion).
// Hardcoded here (not read from Postgres) so room creation keeps working —
// including its fallback to a random quiz when no id was selected — even
// when Postgres is unreachable (see quiz-content spec's DB-outage scenario).
// Content is in Spanish: that's the game's language.
//
// These two quizzes are ALSO seeded as real `quizzes`/`questions` rows (see
// migration 1788600000003_add-sample-quiz-support, is_sample = true) with
// the SAME ids as below — purely so match history can FK a played match to
// a real quiz row. The ids below are the source of truth: if you change one
// here, update the seed migration's INSERT to match, or match-history
// persistence for that quiz will start failing (fails soft — see
// design.md decision 4 — but silently, so don't rely on that).
const QUIZZES: Quiz[] = [
  {
    id: '4061f2ae-33bf-4583-ad4e-f66949f6fe6e',
    title: 'Cultura General',
    questions: [
      {
        text: '¿Cuál es la capital de Francia?',
        choices: ['Berlín', 'Madrid', 'París', 'Roma'],
        correctIndex: 2,
        seconds: 10
      },
      {
        text: '¿Qué planeta es conocido como el Planeta Rojo?',
        choices: ['Venus', 'Marte', 'Júpiter', 'Saturno'],
        correctIndex: 1,
        seconds: 10
      },
      {
        text: '¿Cuántos continentes hay en la Tierra?',
        choices: ['5', '6', '7', '8'],
        correctIndex: 2,
        seconds: 10
      },
      {
        text: '¿Cuál es el océano más grande del mundo?',
        choices: ['Atlántico', 'Índico', 'Ártico', 'Pacífico'],
        correctIndex: 3,
        seconds: 10
      },
      {
        text: '¿Quién escribió "Romeo y Julieta"?',
        choices: ['Charles Dickens', 'William Shakespeare', 'Mark Twain', 'Jane Austen'],
        correctIndex: 1,
        seconds: 10
      }
    ]
  },
  {
    id: 'c66bb43e-d219-4ab1-9e53-903d3dfaf0a4',
    title: 'Ciencias Básicas',
    questions: [
      {
        text: '¿Qué gas absorben las plantas de la atmósfera para la fotosíntesis?',
        choices: ['Oxígeno', 'Nitrógeno', 'Dióxido de carbono', 'Hidrógeno'],
        correctIndex: 2,
        seconds: 10
      },
      {
        text: '¿Cuál es el símbolo químico del agua?',
        choices: ['H2O', 'CO2', 'O2', 'NaCl'],
        correctIndex: 0,
        seconds: 10
      },
      {
        text: '¿Cuántos huesos tiene el cuerpo humano adulto?',
        choices: ['186', '206', '226', '246'],
        correctIndex: 1,
        seconds: 10
      },
      {
        text: '¿Qué fuerza atrae los objetos hacia el centro de la Tierra?',
        choices: ['Magnetismo', 'Fricción', 'Gravedad', 'Inercia'],
        correctIndex: 2,
        seconds: 10
      },
      {
        text: '¿Cuál es la central energética de la célula?',
        choices: ['Núcleo', 'Ribosoma', 'Mitocondria', 'Aparato de Golgi'],
        correctIndex: 2,
        seconds: 10
      }
    ]
  }
];

export function loadQuizzes(): Quiz[] {
  return QUIZZES;
}

export function pickRandomQuiz(): Quiz {
  const quizzes = loadQuizzes();
  return quizzes[Math.floor(Math.random() * quizzes.length)];
}

export function getQuizById(quizId: string): Quiz | null {
  return loadQuizzes().find((quiz) => quiz.id === quizId) ?? null;
}
