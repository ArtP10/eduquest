import type { Quiz } from '@quizjumper/shared/quiz';

// Quiz data shape: see shared/quiz.ts (Quiz, QuizQuestion).
// Hardcoded per multiplayer-jumper-core scope — no authoring UI, no persistence.
// Content is in Spanish: that's the game's language.

const QUIZZES: Quiz[] = [
  {
    id: 'cultura-general-1',
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
    id: 'ciencias-basicas-1',
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
