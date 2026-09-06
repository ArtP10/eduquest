export interface QuizQuestion {
  text: string;
  choices: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  seconds: number;
}

export interface Quiz {
  id: string;
  title: string;
  questions: QuizQuestion[];
}
