import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { QuizLibrary } from './quiz-library';
import { QuizLibraryService } from './quiz-library.service';
import { RoomCreationState } from './room-creation-state';

describe('QuizLibrary', () => {
  let listPublished: ReturnType<typeof vi.fn>;
  let listTags: ReturnType<typeof vi.fn>;
  let createRoomWithQuiz: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    listPublished = vi.fn().mockResolvedValue({ quizzes: [], page: 1, limit: 12, total: 0 });
    listTags = vi.fn().mockResolvedValue([]);
    createRoomWithQuiz = vi.fn().mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [QuizLibrary],
      providers: [
        provideRouter([]),
        { provide: QuizLibraryService, useValue: { listPublished, listTags } },
        { provide: RoomCreationState, useValue: { createRoomWithQuiz } }
      ]
    }).compileComponents();
  });

  it('loads published quizzes and tags on init', () => {
    TestBed.createComponent(QuizLibrary);
    expect(listPublished).toHaveBeenCalledWith(expect.objectContaining({ page: 1, sort: 'newest' }));
    expect(listTags).toHaveBeenCalled();
  });

  it('resets to page 1 and reloads when the sort changes', () => {
    const fixture = TestBed.createComponent(QuizLibrary);
    const component = fixture.componentInstance;
    component.page.set(3);
    listPublished.mockClear();

    component.setSort('popular');

    expect(component.page()).toBe(1);
    expect(listPublished).toHaveBeenCalledWith(expect.objectContaining({ page: 1, sort: 'popular' }));
  });

  it('toggles a tag filter on and off', () => {
    const fixture = TestBed.createComponent(QuizLibrary);
    const component = fixture.componentInstance;

    component.toggleTag('math');
    expect(component.selectedTags()).toEqual(['math']);
    expect(component.isTagSelected('math')).toBe(true);

    component.toggleTag('math');
    expect(component.selectedTags()).toEqual([]);
  });

  it('delegates card selection to RoomCreationState', async () => {
    const fixture = TestBed.createComponent(QuizLibrary);
    const component = fixture.componentInstance;

    await component.selectQuiz({ id: 'quiz-1', title: 'Algebra', authorUsername: 'ana', questionCount: 5, tags: [], playCount: 0, averageGrade: null });

    expect(createRoomWithQuiz).toHaveBeenCalledWith('quiz-1');
  });

  it('computes hasNextPage/hasPrevPage from total and page size', () => {
    const fixture = TestBed.createComponent(QuizLibrary);
    const component = fixture.componentInstance;
    component.total.set(25);
    component.page.set(1);
    expect(component.hasNextPage).toBe(true);
    expect(component.hasPrevPage).toBe(false);
  });
});
