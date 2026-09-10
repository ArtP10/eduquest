import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PixelPanel } from '../shared/pixel-ui/pixel-panel/pixel-panel';
import { PixelButton } from '../shared/pixel-ui/pixel-button/pixel-button';
import { PixelCard } from '../shared/pixel-ui/pixel-card/pixel-card';
import { QuizLibraryService, type PublishedQuizCard, type PublishedQuizSort, type Tag } from './quiz-library.service';
import { RoomCreationState } from './room-creation-state';

const PAGE_SIZE = 12;
const SEARCH_DEBOUNCE_MS = 300;

@Component({
  selector: 'app-quiz-library',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, PixelPanel, PixelButton, PixelCard],
  templateUrl: './quiz-library.html',
  styleUrl: './quiz-library.scss'
})
export class QuizLibrary {
  private readonly quizLibraryService = inject(QuizLibraryService);
  private readonly roomCreationState = inject(RoomCreationState);

  readonly searchTerm = signal('');
  readonly allTags = signal<Tag[]>([]);
  readonly selectedTags = signal<string[]>([]);
  readonly sort = signal<PublishedQuizSort>('newest');
  readonly page = signal(1);
  readonly total = signal(0);

  readonly quizzes = signal<PublishedQuizCard[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly creatingRoomFor = signal<string | null>(null);

  private searchDebounceHandle: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    void this.loadTags();
    void this.load();
  }

  get hasNextPage(): boolean {
    return this.page() * PAGE_SIZE < this.total();
  }

  get hasPrevPage(): boolean {
    return this.page() > 1;
  }

  private async loadTags(): Promise<void> {
    try {
      this.allTags.set(await this.quizLibraryService.listTags());
    } catch {
      // Non-critical: the filter chips row just stays empty.
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const result = await this.quizLibraryService.listPublished({
        page: this.page(),
        limit: PAGE_SIZE,
        search: this.searchTerm().trim() || undefined,
        tags: this.selectedTags(),
        sort: this.sort()
      });
      this.quizzes.set(result.quizzes);
      this.total.set(result.total);
    } catch {
      this.loadError.set('No se pudieron cargar los cuestionarios. Por favor, intenta de nuevo.');
    } finally {
      this.loading.set(false);
    }
  }

  onSearchInput(value: string): void {
    this.searchTerm.set(value);
    if (this.searchDebounceHandle) clearTimeout(this.searchDebounceHandle);
    this.searchDebounceHandle = setTimeout(() => {
      this.page.set(1);
      void this.load();
    }, SEARCH_DEBOUNCE_MS);
  }

  toggleTag(name: string): void {
    const current = this.selectedTags();
    this.selectedTags.set(current.includes(name) ? current.filter((t) => t !== name) : [...current, name]);
    this.page.set(1);
    void this.load();
  }

  isTagSelected(name: string): boolean {
    return this.selectedTags().includes(name);
  }

  setSort(sort: PublishedQuizSort): void {
    if (this.sort() === sort) return;
    this.sort.set(sort);
    this.page.set(1);
    void this.load();
  }

  nextPage(): void {
    if (!this.hasNextPage) return;
    this.page.set(this.page() + 1);
    void this.load();
  }

  prevPage(): void {
    if (!this.hasPrevPage) return;
    this.page.set(this.page() - 1);
    void this.load();
  }

  async selectQuiz(quiz: PublishedQuizCard): Promise<void> {
    if (this.creatingRoomFor()) return;
    this.creatingRoomFor.set(quiz.id);
    try {
      await this.roomCreationState.createRoomWithQuiz(quiz.id);
    } finally {
      this.creatingRoomFor.set(null);
    }
  }
}
