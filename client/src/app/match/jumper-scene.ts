import Phaser from 'phaser';

export const WORLD_WIDTH = 992;
export const CANVAS_HEIGHT = 600;
const PLATFORM_WIDTH = 70;
const PLATFORM_HEIGHT = 14;
// Vertical gap range — widened for a more organic, less "staircase" layout
// (a narrow range made every step visually identical). Still comfortably
// under the ~137.5px apex of a full-height jump (jump velocity is never
// modifier-penalized — see SLOWDOWN_SPEED_MULTIPLIER below).
const PLATFORM_GAP_MIN = 25;
const PLATFORM_GAP_MAX = 85;
// Horizontal step is a bounded random walk from the PREVIOUS platform, not
// an independent random x — with a wide world (WORLD_WIDTH), picking x fully
// at random could place two vertically-close platforms almost a full world
// apart horizontally. The minimum is low enough to occasionally stack a
// platform almost straight above the last one; the actual per-platform max
// is computed in generatePlatformsUpTo() from that platform's own vertical
// gap (see reachableXBudget), since a bigger vertical gap leaves less
// hang-time to also travel sideways — a fixed max here would either be too
// tight for small gaps or unreachable for large ones.
const PLATFORM_X_GAP_MIN = 15;
const FLOOR_HEIGHT = 24;
// Extra, non-load-bearing platforms scattered into each row purely to fill
// out a wide canvas — the guaranteed-reachable "path" platform (bounded step
// from the previous one, see above) is still placed every row regardless;
// these are additional visual/optional density so a wide WORLD_WIDTH doesn't
// look sparse. One extra platform roughly every 260px of width.
const FILLER_PLATFORMS_PER_ROW = Math.max(0, Math.round(WORLD_WIDTH / 260) - 1);
const FILLER_MIN_SPACING = PLATFORM_WIDTH + 20;

const BASE_JUMP_VELOCITY = -550;
const BASE_MOVE_SPEED = 220;
const BASE_GRAVITY_Y = 1100;

const BOOST_JUMP_MULTIPLIER = 1.35;
const BOOST_SPEED_MULTIPLIER = 1.3;
// Slowdown never touches jump velocity — only ground speed. A weaker jump
// combined with gap sizes tuned around the *base* jump was still missing
// platforms in practice (jump arc is what actually clears a gap; walking
// speed only affects lining up with one beforehand). Keeping jump height
// constant regardless of modifier guarantees every platform stays reachable
// no matter what a player answered; the penalty is felt entirely as
// sluggish horizontal control.
const SLOWDOWN_SPEED_MULTIPLIER = 0.65;

// UCAB brand palette (see docs/design-system.md) — hardcoded as Phaser hex
// numbers since the canvas can't read CSS custom properties.
const UCAB_BLUE = 0x40b4e5;
const UCAB_GOLD = 0xffc526;
const UCAB_INK = 0x0b1b24;
const UCAB_INK_2 = 0x142430;
const UCAB_INK_3 = 0x1e3444;

export type Modifier = 'boost' | 'slowdown' | 'none';

type PlayerBody = Phaser.GameObjects.Rectangle & Phaser.Types.Physics.Arcade.GameObjectWithDynamicBody;
type PlatformBody = Phaser.GameObjects.Rectangle & Phaser.Types.Physics.Arcade.GameObjectWithStaticBody;

// Sprite sheet frames live at 1024x1024 with a lot of transparent padding
// around the pixel-art character — scaled down to roughly this display
// height so it reads at a similar size to the old blocky placeholder.
const CHARACTER_DISPLAY_HEIGHT = 80;
// Fraction of the 1024px frame height, from the top, where the character's
// feet sit — estimated from the source art (lots of empty padding above and
// below). Used as the sprite's vertical origin so it anchors on the ground
// instead of the frame's geometric center.
const CHARACTER_FEET_ORIGIN_Y = 0.9;
const PLAYER_WIDTH = 28;
// Measured the opaque-pixel bounding box of every frame: feet sit around
// y=0.90-0.91 of the 1024px frame, head/hair top around y=0.09-0.16 — so the
// visible body spans roughly 80% of CHARACTER_DISPLAY_HEIGHT. A shorter
// collider (previously 44) left the top ~20px of hair/head with no hitbox,
// so it visually clipped through a platform's underside instead of colliding.
const PLAYER_HEIGHT = Math.round(CHARACTER_DISPLAY_HEIGHT * 0.81);
const COLLIDER_HALF_HEIGHT = PLAYER_HEIGHT / 2;
const SPAWN_GAP_ABOVE_FLOOR = 18;

// How close two platform centers are allowed to get before they count as
// "overlapping" — a flat few px of breathing room beyond simply touching
// edges, so platforms never even visually kiss.
const PLATFORM_OVERLAP_MARGIN = 6;
const PLATFORM_MIN_SPACING_X = PLATFORM_WIDTH + PLATFORM_OVERLAP_MARGIN;
const PLATFORM_MIN_SPACING_Y = PLATFORM_HEIGHT + PLATFORM_OVERLAP_MARGIN;

interface PlatformPlacement {
  x: number;
  y: number;
}

export class JumperScene extends Phaser.Scene {
  private player!: PlayerBody;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;

  // Source art faces right by default, so moving left flips it.
  private facingRight = false;

  private modifier: Modifier = 'none';
  private frozen = true;
  private highestY = 0; // world-space highest point reached (smaller y = higher)
  private startY = 0;
  private lastReportedProgress = 0;
  private lastGeneratedY = 0;
  private lastGeneratedX = 0;
  // True only until the very first row of platforms above the floor has
  // been generated — forces that first row's gap to clear the character's
  // spawn zone entirely (see generatePlatformsUpTo).
  private firstRowPending = true;
  // Platforms placed in the row immediately below the one currently being
  // generated, checked so a new row's platforms don't overlap the row right
  // below them (see PLATFORM_MIN_SPACING_Y comment above).
  private previousRowPlacements: PlatformPlacement[] = [];

  onProgress: (progress: number) => void = () => {};

  constructor() {
    super('jumper');
  }

  preload(): void {
    for (const key of ['idle1', 'idle2', 'idle3', 'idle4', 'walk1', 'walk2', 'walk3', 'walk4', 'jump1', 'jump2', 'jump3', 'jump4']) {
      this.load.image(key, `sprites/${key}.png`);
    }
  }

  create(): void {
    this.drawBackground();

    this.physics.world.setBounds(0, -1_000_000, WORLD_WIDTH, 1_000_000 + FLOOR_HEIGHT);

    this.platforms = this.physics.add.staticGroup();

    const floorY = 0;
    this.addPlatformBlock(WORLD_WIDTH / 2, floorY, WORLD_WIDTH, FLOOR_HEIGHT, UCAB_INK_3, UCAB_GOLD, true);

    this.lastGeneratedY = floorY;
    this.lastGeneratedX = WORLD_WIDTH / 2;
    this.generatePlatformsUpTo(floorY - 800);

    // Invisible collider rectangle, tall enough to span roughly torso-to-head
    // so the sprite's upper body doesn't clip through a platform's underside
    // while jumping past it. The visible character is a separate sprite (see
    // playerSprite below) that just follows this box each frame, since it's
    // much bigger than the hitbox.
    // Spawn with the collider's bottom edge comfortably above the floor's
    // top surface (a small gap so it visibly drops onto it) — this used to
    // be a flat "floorY - 40" magic number, which was fine for the old 20px-
    // tall collider but put the bottom of the current, taller one already a
    // few pixels *inside* the floor, so it spawned overlapping and got
    // shoved back out on the first physics step.
    const spawnY = floorY - FLOOR_HEIGHT / 2 - COLLIDER_HALF_HEIGHT - SPAWN_GAP_ABOVE_FLOOR;
    this.player = this.add.rectangle(WORLD_WIDTH / 2, spawnY, PLAYER_WIDTH, PLAYER_HEIGHT, UCAB_GOLD, 0) as PlayerBody;
    this.physics.add.existing(this.player, false);

    this.createCharacterAnimations();
    this.playerSprite = this.add.sprite(this.player.x, this.player.y + COLLIDER_HALF_HEIGHT, 'idle1');
    // The character art sits inside a padded 1024x1024 frame with the feet
    // near the bottom rather than dead center — anchor the origin there so
    // the sprite's feet line up with the collider's bottom edge instead of
    // the sprite sinking into (or floating above) platforms.
    this.playerSprite.setOrigin(0.5, CHARACTER_FEET_ORIGIN_Y);
    this.playerSprite.setScale(CHARACTER_DISPLAY_HEIGHT / this.playerSprite.height);
    this.playerSprite.play('idle');
    // Default body (matches the player rectangle exactly, centered on the
    // object) — a previous manual setSize/setOffset here misaligned the
    // hitbox ~13px left of the visible sprite, so jumps that looked lined up
    // with a platform would silently miss it.
    this.player.body.setGravityY(BASE_GRAVITY_Y);
    this.player.body.setCollideWorldBounds(false);
    this.player.body.setMaxVelocity(600, 1200);

    // Plain collider (no custom callback): Arcade Physics resolves the
    // separation and sets body.touching.down for us, which drives grounded
    // detection in update(). Jumping only happens in response to Space.
    this.physics.add.collider(this.player, this.platforms);

    this.startY = this.player.y;
    this.highestY = this.player.y;

    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
      this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
      this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    }

    this.cameras.main.setBounds(0, -1_000_000, WORLD_WIDTH, 1_000_000 + FLOOR_HEIGHT);

    // setFrozen() may have run before the physics world existed (see the
    // guard there) — re-apply the pause now that it does.
    if (this.frozen) this.physics.world.pause();
  }

  override update(): void {
    const grounded = this.player.body.blocked.down || this.player.body.touching.down;

    if (!this.frozen) {
      const speed = BASE_MOVE_SPEED * this.speedMultiplier();
      const left = this.cursors?.left.isDown || this.keyA?.isDown;
      const right = this.cursors?.right.isDown || this.keyD?.isDown;

      if (left) {
        this.player.body.setVelocityX(-speed);
        this.facingRight = false;
      } else if (right) {
        this.player.body.setVelocityX(speed);
        this.facingRight = true;
      } else {
        this.player.body.setVelocityX(0);
      }

      const jumpPressed =
        (this.keySpace && Phaser.Input.Keyboard.JustDown(this.keySpace)) ||
        (this.cursors?.up && Phaser.Input.Keyboard.JustDown(this.cursors.up));
      if (jumpPressed && grounded) {
        this.player.body.setVelocityY(BASE_JUMP_VELOCITY * this.jumpMultiplier());
      }

      // Wrap horizontally, Doodle-Jump style.
      if (this.player.x < -20) this.player.x = WORLD_WIDTH + 20;
      if (this.player.x > WORLD_WIDTH + 20) this.player.x = -20;

      // Falling back to the starting floor never ends the run.
      if (this.player.y > this.startY + 60) {
        this.player.y = this.startY - 20;
        this.player.body.setVelocityY(0);
      }
    } else {
      this.player.body.setVelocityX(0);
    }

    this.playerSprite.x = this.player.x;
    this.playerSprite.y = this.player.y + COLLIDER_HALF_HEIGHT;
    this.playerSprite.setFlipX(!this.facingRight);

    const animKey = !grounded ? 'jump' : Math.abs(this.player.body.velocity.x) > 5 ? 'walk' : 'idle';
    if (this.playerSprite.anims.currentAnim?.key !== animKey) {
      this.playerSprite.play(animKey);
    }

    if (this.player.y < this.highestY) {
      this.highestY = this.player.y;
      this.generatePlatformsUpTo(this.highestY - 800);

      const progress = Math.max(0, this.startY - this.highestY);
      if (progress - this.lastReportedProgress >= 10) {
        this.lastReportedProgress = progress;
        this.onProgress(progress);
      }
    }

    // Camera follows the player both up (climbing) and down (falling), so
    // falling off a platform never leaves the player off-screen. Clamped so
    // it never scrolls low enough to reveal empty space below the floor.
    const desiredScrollY = this.player.y - CANVAS_HEIGHT * 0.55;
    const maxScrollY = FLOOR_HEIGHT / 2 + 40 - CANVAS_HEIGHT;
    this.cameras.main.scrollY = Math.min(desiredScrollY, maxScrollY);
  }

  setFrozen(frozen: boolean): void {
    this.frozen = frozen;
    // A question freezes the whole climb, not just input: pause the physics
    // world so gravity/velocity stop too, instead of the player silently
    // drifting or falling while the overlay is up.
    const world = this.physics?.world;
    if (!world) return;
    if (frozen) world.pause();
    else world.resume();
  }

  setModifier(modifier: Modifier): void {
    this.modifier = modifier;
  }

  private createCharacterAnimations(): void {
    this.anims.create({
      key: 'idle',
      frames: ['idle1', 'idle2', 'idle3', 'idle4'].map((key) => ({ key })),
      frameRate: 6,
      repeat: -1
    });
    this.anims.create({
      key: 'walk',
      frames: ['walk1', 'walk2', 'walk3', 'walk4'].map((key) => ({ key })),
      frameRate: 10,
      repeat: -1
    });
    this.anims.create({
      key: 'jump',
      frames: ['jump1', 'jump2', 'jump3', 'jump4'].map((key) => ({ key })),
      frameRate: 8,
      repeat: -1
    });
  }

  private jumpMultiplier(): number {
    // Boost still jumps higher; slowdown does NOT reduce jump height (see
    // the constant comment above) — only ground speed is penalized.
    if (this.modifier === 'boost') return BOOST_JUMP_MULTIPLIER;
    return 1;
  }

  private speedMultiplier(): number {
    if (this.modifier === 'boost') return BOOST_SPEED_MULTIPLIER;
    if (this.modifier === 'slowdown') return SLOWDOWN_SPEED_MULTIPLIER;
    return 1;
  }

  /** A pixel-block platform: solid base with a lighter top-edge highlight strip. */
  private addPlatformBlock(
    x: number,
    y: number,
    width: number,
    height: number,
    baseColor: number,
    highlightColor: number,
    isFloor = false
  ): void {
    const platform = this.add.rectangle(x, y, width, height, baseColor) as PlatformBody;
    platform.setStrokeStyle(2, UCAB_INK);
    this.physics.add.existing(platform, true);
    this.platforms.add(platform);

    const highlightHeight = isFloor ? 4 : 3;
    this.add.rectangle(x, y - height / 2 + highlightHeight / 2, width - 4, highlightHeight, highlightColor);
  }

  /** True if (x, y) is closer than the overlap margin to any already-placed platform, from either this row or the one directly below it. */
  private overlapsExisting(x: number, y: number, rowPlacements: PlatformPlacement[]): boolean {
    const isTooClose = (p: PlatformPlacement) =>
      Math.abs(p.x - x) < PLATFORM_MIN_SPACING_X && Math.abs(p.y - y) < PLATFORM_MIN_SPACING_Y;
    return rowPlacements.some(isTooClose) || this.previousRowPlacements.some(isTooClose);
  }

  private generatePlatformsUpTo(targetY: number): void {
    let y = this.lastGeneratedY;
    while (y > targetY) {
      let gap = Phaser.Math.Between(PLATFORM_GAP_MIN, PLATFORM_GAP_MAX);
      // The very first row generated sits close enough to the floor that it
      // can otherwise land directly on top of where the character spawns —
      // force enough clearance to fully clear the spawned character's
      // height, plus a bit more margin, this one time only.
      if (this.firstRowPending) {
        const minFirstRowGap = SPAWN_GAP_ABOVE_FLOOR + PLAYER_HEIGHT + PLATFORM_HEIGHT / 2 + 20;
        gap = Math.max(gap, minFirstRowGap);
        this.firstRowPending = false;
      }
      y -= gap;

      // How far sideways can a jump of this specific height still travel?
      // hangFraction is the fraction of the jump's total airtime (as a 0-1
      // ratio of "time to full apex and back") during which the player is at
      // or above `gap` — derived from y(t) = V*t - 0.5*g*t² solved for the
      // two times y(t) = gap. A taller gap leaves a smaller window, so a
      // fixed x-step cap would either be unreachable for tall gaps or overly
      // conservative for short ones.
      const hangFraction = Math.sqrt(Math.max(0, 1 - (4 * gap) / Math.abs(BASE_JUMP_VELOCITY)));
      const worstCaseGroundSpeed = BASE_MOVE_SPEED * SLOWDOWN_SPEED_MULTIPLIER;
      // 0.75 safety margin below the theoretical limit, plus a flat overlap
      // allowance (you only need the platforms' edges to overlap, not their
      // centers to coincide).
      const reachableXBudget = Math.round(worstCaseGroundSpeed * hangFraction * 0.75 + PLATFORM_WIDTH);
      const xGapMax = Math.max(PLATFORM_X_GAP_MIN, reachableXBudget);

      // x is a bounded step from the PREVIOUS platform (not independently
      // random) so the horizontal distance between vertically-adjacent
      // platforms is always jumpable.
      const minX = PLATFORM_WIDTH / 2;
      const maxX = WORLD_WIDTH - PLATFORM_WIDTH / 2;
      const direction = Phaser.Math.Between(0, 1) === 0 ? -1 : 1;
      const dx = Phaser.Math.Between(PLATFORM_X_GAP_MIN, xGapMax) * direction;
      let x = Phaser.Math.Clamp(this.lastGeneratedX + dx, minX, maxX);
      // The path platform's position is load-bearing for reachability (its x
      // is a bounded step, its y is the exact computed gap), so it can't be
      // freely re-rolled like a filler — instead nudge it sideways in small
      // steps until it clears the row below, still within the reachable
      // bound. In practice this rarely triggers: adjacent rows are already
      // PLATFORM_GAP_MIN(25) apart vertically, comfortably more than
      // PLATFORM_HEIGHT(14), so only a previous row's *filler* (which does
      // jitter vertically) can ever be close enough to collide with a path
      // platform's exact row height.
      for (let nudge = 0; this.overlapsExisting(x, y, /* nothing placed in this row yet */ []) && nudge < 8; nudge++) {
        x = Phaser.Math.Clamp(x + (nudge % 2 === 0 ? 1 : -1) * (nudge + 1) * 6, minX, maxX);
      }
      this.lastGeneratedX = x;

      this.addPlatformBlock(x, y, PLATFORM_WIDTH, PLATFORM_HEIGHT, UCAB_INK_3, UCAB_BLUE);
      const rowPlacements: PlatformPlacement[] = [{ x, y }];

      // Filler platforms: pure visual/optional density, not part of the
      // guaranteed path, so they don't need the strict reachability step —
      // just avoid overlapping the path platform, each other, or the row
      // below, jittering their height slightly so the row doesn't look like
      // a perfectly straight rung. Skipped (not force-placed) if no
      // non-overlapping spot is found — a slightly sparser row beats a
      // visibly overlapping one.
      for (let f = 0; f < FILLER_PLATFORMS_PER_ROW; f++) {
        let placed = false;
        for (let attempt = 0; attempt < 8; attempt++) {
          const fx = Phaser.Math.Between(minX, maxX);
          const fy = y + Phaser.Math.Between(-8, 8);
          const farEnoughInRow = rowPlacements.every((p) => Math.abs(p.x - fx) >= FILLER_MIN_SPACING);
          if (farEnoughInRow && !this.overlapsExisting(fx, fy, rowPlacements)) {
            this.addPlatformBlock(fx, fy, PLATFORM_WIDTH, PLATFORM_HEIGHT, UCAB_INK_3, UCAB_BLUE);
            rowPlacements.push({ x: fx, y: fy });
            placed = true;
            break;
          }
        }
        if (!placed) continue;
      }

      this.previousRowPlacements = rowPlacements;

      // A couple of dim pixel "stars" per row for depth, world-space so
      // they scroll in lockstep with the platforms (no gaps as we climb).
      for (let i = 0; i < 2; i++) {
        const starX = Phaser.Math.Between(4, WORLD_WIDTH - 4);
        const starY = y - Phaser.Math.Between(10, gap - 10);
        this.add.rectangle(starX, starY, 2, 2, UCAB_INK_2).setAlpha(0.8);
      }
    }
    this.lastGeneratedY = y;
  }

  private drawBackground(): void {
    const bg = this.add.graphics();
    bg.fillGradientStyle(UCAB_INK, UCAB_INK, UCAB_INK_2, UCAB_INK_2, 1);
    bg.fillRect(0, 0, WORLD_WIDTH, CANVAS_HEIGHT);
    bg.setScrollFactor(0);
    bg.setDepth(-10);
  }
}
