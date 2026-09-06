import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type PixelIconName =
  | 'boost'
  | 'slowdown'
  | 'correct'
  | 'incorrect'
  | 'host'
  | 'trophy'
  | 'timer'
  | 'player'
  | 'ucab-mark';

// Single-tone icons: each row is a string on an 8x8 grid, 'X' = filled cell
// (rendered in `currentColor`), '.' = empty. Keep every icon on this same
// grid so new icons drop in without inventing a new coordinate system.
const GRID_ICONS: Record<Exclude<PixelIconName, 'ucab-mark'>, string[]> = {
  boost: [
    '...XX...',
    '..XXXX..',
    '.XXXXXX.',
    'XX.XX.XX',
    '...XX...',
    '...XX...',
    '..XXXX..',
    '........'
  ],
  slowdown: [
    '........',
    '..XXXX..',
    '...XX...',
    '...XX...',
    'XX.XX.XX',
    '.XXXXXX.',
    '..XXXX..',
    '...XX...'
  ],
  correct: [
    '........',
    '.......X',
    '......XX',
    'XX...XX.',
    '.XX.XX..',
    '..XXX...',
    '...X....',
    '........'
  ],
  incorrect: [
    'XX....XX',
    '.XX..XX.',
    '..XXXX..',
    '...XX...',
    '..XXXX..',
    '.XX..XX.',
    'XX....XX',
    '........'
  ],
  host: [
    'X.X.X.X.',
    'XXXXXXX.',
    'XXXXXXX.',
    '.XXXXX..',
    '........',
    '........',
    '........',
    '........'
  ],
  trophy: [
    '.XXXXXX.',
    'XXXXXXXX',
    'XXXXXXXX',
    'X.XXXX.X',
    '..XXXX..',
    '..XXXX..',
    '.XXXXXX.',
    '........'
  ],
  timer: [
    'XXXXXXXX',
    '.XXXXXX.',
    '..XXXX..',
    '...XX...',
    '..XXXX..',
    '.XXXXXX.',
    'XXXXXXXX',
    '........'
  ],
  player: [
    '..XXXX..',
    '..XXXX..',
    '..XXXX..',
    '.XXXXXX.',
    'XXXXXXXX',
    'XXXXXXXX',
    'XX.XX.XX',
    '........'
  ]
};

const DIAMOND_MASK = [
  [0, 1, 0],
  [1, 1, 1],
  [1, 1, 1],
  [1, 1, 1],
  [0, 1, 0]
];

interface Cell {
  x: number;
  y: number;
  color?: string;
}

@Component({
  selector: 'app-pixel-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      [attr.viewBox]="'0 0 ' + gridWidth() + ' ' + gridHeight()"
      shape-rendering="crispEdges"
      aria-hidden="true"
    >
      @for (cell of cells(); track $index) {
        <rect [attr.x]="cell.x" [attr.y]="cell.y" width="1" height="1" [attr.fill]="cell.color ?? 'currentColor'" />
      }
    </svg>
  `
})
export class PixelIcon {
  readonly name = input.required<PixelIconName>();
  readonly size = input<number>(20);

  protected readonly gridWidth = computed(() => (this.name() === 'ucab-mark' ? 11 : 8));
  protected readonly gridHeight = computed(() => (this.name() === 'ucab-mark' ? 5 : 8));

  protected readonly cells = computed<Cell[]>(() => {
    const iconName = this.name();
    if (iconName === 'ucab-mark') {
      const colors = ['var(--ucab-blue)', 'var(--ucab-green)', 'var(--ucab-gold)'];
      const cells: Cell[] = [];
      colors.forEach((color, i) => {
        const offsetX = i * 4;
        DIAMOND_MASK.forEach((row, y) => {
          row.forEach((on, x) => {
            if (on) cells.push({ x: offsetX + x, y, color });
          });
        });
      });
      return cells;
    }

    const grid = GRID_ICONS[iconName];
    const cells: Cell[] = [];
    grid.forEach((row, y) => {
      [...row].forEach((char, x) => {
        if (char === 'X') cells.push({ x, y });
      });
    });
    return cells;
  });
}
