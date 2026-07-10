// The Arcade cast, sprite-driven. Every frame lives on one packed, transparent
// sheet (SPRITE_SHEET_SRC); each entry below is a source rectangle into that sheet.
// If SPRITES_CONFIGURED is ever flipped back to false, the game renders the emoji
// fallbacks instead, so it stays playable. The game reads only from this file.

export type SpriteFrame = { x: number; y: number; w: number; h: number };

export const SPRITE_SHEET_SRC = "/images/sprites/arcade.png";

/** Flip to true once every frame below holds a real sheet coordinate. */
export const SPRITES_CONFIGURED = true;

export type SpriteName =
  | "silentUp" // The Silent, idle, facing up
  | "silentThrow" // The Silent, arm-raised throwing pose (shown briefly on fire)
  | "knife" // one frame; drawn rotated to point up (toward the enemies)
  | "greenSlime"
  | "redSlime"
  | "gremlin"
  | "sentry"
  | "heart"; // wave-5 boss

// Frame rects on public/images/sprites/arcade.png — cut from Tyler's sheet
// (background keyed out, trimmed to content, packed into one transparent strip).
export const SPRITES: Record<SpriteName, SpriteFrame> = {
  // silentUp and silentThrow share identical frame dims with bodies aligned, so
  // firing only raises the arm — the body never changes size (throw was scaled
  // up to match, and both bottom-aligned into a common canvas with arm headroom).
  silentUp: { x: 4, y: 4, w: 143, h: 259 },
  silentThrow: { x: 151, y: 4, w: 143, h: 259 },
  knife: { x: 298, y: 4, w: 42, h: 140 },
  greenSlime: { x: 344, y: 4, w: 117, h: 82 },
  redSlime: { x: 465, y: 4, w: 111, h: 83 },
  gremlin: { x: 580, y: 4, w: 110, h: 119 },
  sentry: { x: 694, y: 4, w: 149, h: 141 },
  heart: { x: 847, y: 4, w: 210, h: 215 },
};

export type EnemyKind = "greenSlime" | "redSlime" | "gremlin" | "sentry";

export type EnemyDef = {
  sprite: SpriteName;
  /** Fallback look until the sheet is configured. */
  emoji: string;
  /** Hits to kill. 2-hit kinds flash red after the first hit. */
  hp: number;
  /** Points awarded on kill. */
  score: number;
  /** Drawn size in px (longest side). */
  size: number;
};

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  greenSlime: { sprite: "greenSlime", emoji: "🟢", hp: 1, score: 10, size: 26 },
  redSlime: { sprite: "redSlime", emoji: "🔴", hp: 1, score: 15, size: 26 },
  gremlin: { sprite: "gremlin", emoji: "👺", hp: 2, score: 30, size: 28 },
  sentry: { sprite: "sentry", emoji: "🤖", hp: 2, score: 40, size: 28 },
};

// Which enemy kinds may appear on each formation wave (waves 1–4; wave 5 is the
// Heart boss). The game stacks the tougher kinds in the back (top) rows.
export const WAVE_KINDS: EnemyKind[][] = [
  ["greenSlime"], // 1: green slimes
  ["greenSlime", "redSlime"], // 2: green + red slimes
  ["greenSlime", "redSlime", "gremlin"], // 3: slimes + gremlins
  ["greenSlime", "redSlime", "gremlin", "sentry"], // 4: slimes + gremlins + sentries
];

// The Silent (player) and the knife she throws.
export const PLAYER_SPRITE: SpriteName = "silentUp";
export const PLAYER_THROW_SPRITE: SpriteName = "silentThrow";
export const PLAYER_EMOJI = "💀";
// Frame is taller than the body (arm headroom); the player is drawn
// bottom-anchored (see PLAYER_BASELINE) so this can grow without clipping.
export const PLAYER_SIZE = 52;
export const KNIFE_SPRITE: SpriteName = "knife";
export const KNIFE_SIZE = 22;

// The Heart, final boss.
export const BOSS_SPRITE: SpriteName = "heart";
export const BOSS_EMOJI = "🫀";

// Enemy fire is now round bullets; players throw knives.
export const ENEMY_BULLET_COLOR = "#ff5f57";
/** Fallback color for the knife when the sheet isn't configured yet. */
export const KNIFE_FALLBACK_COLOR = "#e5e7eb";
