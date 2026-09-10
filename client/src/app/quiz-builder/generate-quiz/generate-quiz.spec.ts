import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { GenerateQuiz } from './generate-quiz';
import { QuizBuilderService } from '../quiz-builder.service';

describe('GenerateQuiz', () => {
  let generateFromPdf: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    generateFromPdf = vi.fn();
    await TestBed.configureTestingModule({
      imports: [GenerateQuiz],
      providers: [provideRouter([]), { provide: QuizBuilderService, useValue: { generateFromPdf } }]
    }).compileComponents();
  });

  it('cannot submit without a selected file', () => {
    const fixture = TestBed.createComponent(GenerateQuiz);
    const component = fixture.componentInstance;
    expect(component.canSubmit()).toBe(false);
  });

  it('can submit once a file is selected', () => {
    const fixture = TestBed.createComponent(GenerateQuiz);
    const component = fixture.componentInstance;
    const file = new File(['content'], 'notes.pdf', { type: 'application/pdf' });
    component.selectedFile.set(file);
    expect(component.canSubmit()).toBe(true);
  });

  it('shows the returned error and stops the loading state on failure', async () => {
    generateFromPdf.mockResolvedValue({ ok: false, error: 'Algo salió mal. Por favor, intenta de nuevo.' });
    const fixture = TestBed.createComponent(GenerateQuiz);
    const component = fixture.componentInstance;
    component.selectedFile.set(new File(['content'], 'notes.pdf', { type: 'application/pdf' }));

    await component.generate();

    expect(component.generating()).toBe(false);
    expect(component.error()).toBe('Algo salió mal. Por favor, intenta de nuevo.');
  });

  it('clears the error when trying again', () => {
    const fixture = TestBed.createComponent(GenerateQuiz);
    const component = fixture.componentInstance;
    component.error.set('some error');
    component.tryAgain();
    expect(component.error()).toBeNull();
  });
});
