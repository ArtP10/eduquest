# QuizJumper Design System

QuizJumper's interface is a pixel-art arcade cabinet built on Universidad Católica Andrés Bello's real institutional colors. This document is the reference for every UI decision going forward — palette, type, iconography, layout, and motion — so the game reads as one coherent, professional identity instead of a pile of default component styles.

## Where the colors come from

UCAB's logo is three parallelogram "gems" (blue, green, gold) next to the wordmark. Those exact hexes were sampled directly from `ucab.edu.ve`'s own header SVG and confirmed against the live site's computed styles:

| Token | Hex | Source |
|---|---|---|
| `--ucab-blue` | `#40B4E5` | Logo gem 1 / dominant link & accent color across ucab.edu.ve |
| `--ucab-green` | `#047732` | Logo gem 2 |
| `--ucab-gold` | `#FFC526` | Logo gem 3 |
| `--ucab-ink` | `#0B1B24` | Derived: a near-black navy tinted from the blue, not flat `#000` |

We do not reuse UCAB's white/gray institutional page chrome — that's a document website, not a game. Instead we push the same three brand hues into a **dark arcade cabinet** background, which is where pixel-art palettes read best and where the gold and blue pop as light sources rather than sitting on white.

## Color tokens

```
--ucab-blue:    #40B4E5   primary interactive accent (buttons, links, focus)
--ucab-green:   #047732   success / correct-answer state
--ucab-gold:    #FFC526   score, host, 1st place, primary CTA fill
--ucab-ink:     #0B1B24   page background (deepest layer)
--ucab-ink-2:   #142430   panel / card background (one step up from ink)
--ucab-ink-3:   #1E3444   raised surface / hovered row
--ucab-paper:   #F4F1E8   primary text on dark (warm off-white, not pure #FFF —
                          pure white vibrates against saturated pixel color)
--ucab-paper-dim: #A9BAC4 secondary/muted text
--danger:       #E5484D   wrong-answer state (kept outside the brand triad
                          on purpose, so failure never gets confused with gold)
```

Every color is a CSS custom property on `:root`. Components reference tokens, never raw hex — this is what keeps a future re-theme (or a light-mode pass) a one-file change.

**Usage rules:**
- Gold is a *reward* color: score numbers, the host badge, 1st place, primary buttons. Don't spend it on decoration — if everything is gold, nothing reads as a reward.
- Blue is the *interactive* color: anything clickable that isn't the primary action, focus rings, links, secondary buttons.
- Green is reserved for *correctness* only (right answer, boost). It never appears as decoration, so a flash of green always means "you got it right."
- Red is reserved for *incorrectness* only (wrong answer, slowdown), same rule in reverse.

## Type

Three roles, each a different face — this is deliberate, not default:

| Role | Face | Used for |
|---|---|---|
| Display (pixel) | **Press Start 2P** | The game title, section headers, room code, button labels. Short strings only — this face is unreadable past ~4 words, so it never carries body copy. |
| Body | **Inter** | Question text, answer choices, lobby copy, error messages, anything a player has to actually read at length. |
| Data (pixel-mono) | **VT323** | Numbers that update live: the countdown, the score column, the height/progress stat. VT323 is a monospace pixel face — digits don't jitter in width as they change, which matters for a ticking timer. |

Never mix Press Start 2P into a sentence longer than a button label. Never use Inter for a number that needs to feel like an arcade score — that's what VT323 is for.

## Pixel-art iconography, not emoji

Emoji render inconsistently across platforms and read as casual/consumer-app, not as a designed game. Every icon in the UI is a hand-built pixel icon instead: a small SVG drawn on a fixed grid with `shape-rendering: crispEdges` and no anti-aliasing, so it looks like a NES-era sprite at any zoom level.

Current icon set (`PixelIcon` component, `client/src/app/shared/pixel-icon.ts`): `boost` (up chevron), `slowdown` (down chevron), `correct` (check), `incorrect` (cross), `host` (crown), `trophy` (1st place), `timer` (hourglass), `player` (blocky figure), `ucab-mark` (the three-diamond signature, see below).

Rule: if a new UI moment needs an icon, draw it on the same grid and add it to that one component — never reach for an emoji or an icon font as a shortcut.

## The signature: the pixel tri-diamond

The one element this UI is remembered by is `ucab-mark`: UCAB's three logo gems (blue/green/gold), redrawn as a blocky pixel icon. It appears three places only, deliberately restrained:
1. The title screen, next to the game name, standing in for a "studio mark."
2. The leaderboard's 1st-place row, as a quiet nod to "you're at the top."
3. The favicon-equivalent corner mark on the cabinet frame.

It does not appear as a repeating background pattern or a loading spinner — restraint is what makes it read as a mark rather than wallpaper.

## Layout: the arcade cabinet

Panels (the lobby card, the match HUD, the leaderboard) are drawn as **cabinet panels**: a flat `--ucab-ink-2` fill, a 4px solid pixel border in `--ucab-blue`, and a hard-edged offset shadow (`4px 4px 0 var(--ucab-ink)`, no blur) instead of a soft box-shadow. Corners are square — `border-radius: 0` everywhere. Soft rounded corners and blurred shadows are the one thing that would break the pixel-art illusion fastest, so neither is used anywhere in this UI.

Buttons follow the same logic: solid fill, square corners, a hard offset shadow that "presses in" (shadow shrinks and the button shifts down-right by the same amount) on `:active`, mimicking a physical arcade button.

## Motion

Minimal and functional only: the button-press shift described above, and the countdown/score digits updating in place (no animated tween — a jump-cut on each tick is more arcade-accurate than an eased transition). No page-load choreography, no hover glows, no parallax. This is a game whose motion budget is spent entirely inside the Phaser canvas — the surrounding chrome should feel static and sturdy by comparison, like a cabinet, not another moving layer.

## Game canvas (Phaser)

The jumper canvas follows the same rules as the surrounding chrome: solid pixel-block platforms with a lighter top edge (a 1-pixel highlight row, the classic "block" look), a blocky two-tone player sprite (gold torso, blue trim) instead of a flat rectangle, and a dark gradient + static starfield background rather than a flat fill, so the canvas reads as a level and not an empty box.
