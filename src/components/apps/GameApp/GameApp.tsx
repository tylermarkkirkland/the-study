"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  SPRITES,
  SPRITES_CONFIGURED,
  SPRITE_SHEET_SRC,
  ENEMIES,
  WAVE_KINDS,
  PLAYER_SPRITE,
  PLAYER_THROW_SPRITE,
  PLAYER_EMOJI,
  PLAYER_SIZE,
  KNIFE_SPRITE,
  KNIFE_SIZE,
  KNIFE_FALLBACK_COLOR,
  BOSS_SPRITE,
  BOSS_EMOJI,
  ENEMY_BULLET_COLOR,
  type EnemyKind,
  type SpriteName,
} from "@/data/arcadeCharacters";
import { useWindowManager } from "@/components/WindowManager/WindowManagerContext";
import { markFound } from "@/lib/discovery/discoveryStore";

// Galaga-lite in a window, with an arc: four growing waves of a descending
// formation, then a wave-5 boss with three fire points. Beat it and you've
// beaten the game. Hold space (or the pointer) to keep firing. All rendering
// is canvas + rAF; React only handles the shell screens. Never auto-starts.
//
// The cast is sprite-driven (see src/data/arcadeCharacters.ts): The Silent
// throws knives at slimes, gremlins, sentries, and a final Heart boss. Until
// the packed sheet is wired up there, everything falls back to emoji so the
// game stays playable.

const W = 464;
const H = 300;
const PLAYER_Y = H - 22;
// The Silent's sprite frame has empty headroom above the body (for the raised
// throwing arm), so we anchor its bottom near the floor and let it grow upward
// as PLAYER_SIZE increases, instead of centering (which would clip the cloak).
const PLAYER_BASELINE = H - 2;
const PLAYER_SPEED = 220; // px/s
const BULLET_SPEED = 320;
// Park a spent knife off-screen (below the −10 cull threshold) so it's filtered
// out next frame instead of hitting a second target this frame.
const CONSUMED_Y = -100;
const ENEMY_BULLET_SPEED = 140;
const ENEMY_BULLET_RADIUS = 4.5;
const FIRE_INTERVAL = 0.3; // s between held-fire shots
const THROW_POSE_TIME = 0.12; // s the throwing pose shows after a knife leaves
const ENEMY_SPACING = 48;
const HIT_RADIUS = 12;
const FLASH_TIME = 0.18; // s a 2-hit enemy glows red after a non-lethal hit
// The formation creeps toward you the whole round — reaching your row is an
// instant game over, lives be damned. Base px/s, scaled up every wave.
const DESCENT_BASE = 3.2;
const BREACH_Y = PLAYER_Y - 16;
const BOSS_WAVE = 5;
const BOSS_HP = 30;
const BOSS_Y = 64;
const BOSS_RADIUS = 30;
const BOSS_SIZE = 68;
const HIGHSCORE_KEY = "classic-os:arcade-highscore";

type Enemy = {
  col: number;
  row: number;
  alive: boolean;
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  /** Seconds left on the red hit-flash (2-hit kinds after a non-lethal hit). */
  flashT: number;
};
type Bullet = { x: number; y: number; vx?: number };
type Boss = { x: number; hp: number; t: number; fireCooldown: number; flashT: number };

// Fewer enemies to start, growing every wave until the boss. Wave 4 gets a
// fourth row so all four enemy kinds (slime → red slime → gremlin → sentry)
// each get their own tier — see kindForRow.
function formationFor(wave: number): { cols: number; rows: number } {
  const spec = [
    { cols: 4, rows: 2 },
    { cols: 6, rows: 2 },
    { cols: 6, rows: 3 },
    { cols: 7, rows: 4 },
  ][wave - 1];
  return spec ?? { cols: 8, rows: 3 };
}

// "Tougher types up top": rank a wave's kinds easy→hard (fewer hits, then fewer
// points = easier) and place the easiest on the front (bottom) row, hardest on
// the back (top) row. With more rows than kinds the tiers simply spread out.
function kindForRow(row: number, rows: number, kinds: EnemyKind[]): EnemyKind {
  const ranked = [...kinds].sort(
    (a, b) => ENEMIES[a].hp - ENEMIES[b].hp || ENEMIES[a].score - ENEMIES[b].score,
  );
  if (rows <= 1) return ranked[0];
  const posFromBottom = rows - 1 - row; // 0 = closest/front row
  const idx = Math.round((posFromBottom / (rows - 1)) * (ranked.length - 1));
  return ranked[Math.max(0, Math.min(ranked.length - 1, idx))];
}

type Sim = {
  playerX: number;
  bullets: Bullet[];
  enemyBullets: Bullet[];
  enemies: Enemy[];
  cols: number;
  rows: number;
  boss: Boss | null;
  wave: number;
  score: number;
  lives: number;
  swayT: number;
  /** How far the formation has crept down this wave, in px. */
  descent: number;
  fireCooldown: number;
  playerFireCooldown: number;
  /** Seconds left showing the throwing pose. */
  throwT: number;
  invulnT: number;
  keys: { left: boolean; right: boolean; fire: boolean };
};

function newSim(wave: number, score: number, lives: number): Sim {
  const isBoss = wave >= BOSS_WAVE;
  const { cols, rows } = formationFor(wave);
  const enemies: Enemy[] = [];
  if (!isBoss) {
    const kinds = WAVE_KINDS[wave - 1] ?? WAVE_KINDS[WAVE_KINDS.length - 1];
    for (let row = 0; row < rows; row++) {
      const kind = kindForRow(row, rows, kinds);
      const def = ENEMIES[kind];
      for (let col = 0; col < cols; col++) {
        enemies.push({ col, row, alive: true, kind, hp: def.hp, maxHp: def.hp, flashT: 0 });
      }
    }
  }
  return {
    playerX: W / 2,
    bullets: [],
    enemyBullets: [],
    enemies,
    cols,
    rows,
    boss: isBoss ? { x: W / 2, hp: BOSS_HP, t: 0, fireCooldown: 1.2, flashT: 0 } : null,
    wave,
    score,
    lives,
    swayT: 0,
    descent: 0,
    fireCooldown: 0,
    playerFireCooldown: 0,
    throwT: 0,
    invulnT: 1.2,
    keys: { left: false, right: false, fire: false },
  };
}

function enemyPos(e: Enemy, sim: Sim): { x: number; y: number } {
  const speed = 0.9 + sim.wave * 0.25;
  const sway = Math.sin(sim.swayT * speed) * 34;
  // Center whatever size the formation is this wave.
  const baseX = (W - (sim.cols - 1) * ENEMY_SPACING) / 2;
  return {
    x: baseX + e.col * ENEMY_SPACING + sway,
    y: 40 + e.row * 34 + sim.descent + Math.sin(sim.swayT * speed * 0.5 + e.col) * 4,
  };
}

function loadHighScore(): number {
  try {
    return Number(localStorage.getItem(HIGHSCORE_KEY)) || 0;
  } catch {
    return 0;
  }
}

export default function GameApp() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<Sim>(newSim(1, 0, 3));
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // Sprite sheet: loaded once, only when configured. A shared offscreen buffer
  // lets us tint a single frame red (the hit-flash) without touching the rest
  // of the canvas.
  const sheetRef = useRef<HTMLImageElement | null>(null);
  const sheetReadyRef = useRef(false);
  const tintBufRef = useRef<HTMLCanvasElement | null>(null);

  const [phase, setPhase] = useState<"idle" | "playing" | "paused" | "gameover" | "victory">(
    "idle",
  );
  const [finalScore, setFinalScore] = useState(0);
  // Lazy init reads storage once on the client; the app only mounts inside a
  // window (post-interaction), so there's no SSR/hydration surface here.
  const [highScore, setHighScore] = useState(loadHighScore);

  useEffect(() => {
    if (!SPRITES_CONFIGURED) return;
    const img = new Image();
    img.onload = () => {
      sheetReadyRef.current = true;
    };
    img.src = SPRITE_SHEET_SRC;
    sheetRef.current = img;
  }, []);

  // Pause when this window is minimized (content stays mounted) or the tab
  // hides. Checked per-frame inside the loop (see step) rather than in an
  // effect, so the pause is a frame-callback state change, not a cascading
  // render — the ref just mirrors the latest value for the loop to read.
  const { windows } = useWindowManager();
  const isMinimized = windows.find((w) => w.appType === "game")?.isMinimized ?? false;
  const minimizedRef = useRef(isMinimized);
  useEffect(() => {
    minimizedRef.current = isMinimized;
  }, [isMinimized]);

  const finish = useCallback((score: number, outcome: "gameover" | "victory") => {
    setFinalScore(score);
    setPhase(outcome);
    setHighScore((prev) => {
      const next = Math.max(prev, score);
      try {
        localStorage.setItem(HIGHSCORE_KEY, String(next));
      } catch {
        // Storage unavailable — session high score still shows.
      }
      return next;
    });
  }, []);

  // The simulation + render loop. Runs only while `phase === "playing"`.
  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    // Draw a sprite frame centered at (cx, cy). Falls back to an emoji glyph
    // until the sheet is configured and loaded. `rot` rotates around the
    // center (the knife points up); `flash` tints it red (a wounded enemy).
    const drawSprite = (
      name: SpriteName,
      cx: number,
      cy: number,
      size: number,
      opts: { rot?: number; flash?: boolean; emoji?: string } = {},
    ) => {
      const { rot = 0, flash = false, emoji } = opts;
      const frame = SPRITES[name];
      const usable =
        SPRITES_CONFIGURED && sheetReadyRef.current && frame.w > 0 && frame.h > 0;

      if (usable) {
        const img = sheetRef.current!;
        const aspect = frame.w / frame.h;
        const dw = aspect >= 1 ? size : size * aspect;
        const dh = aspect >= 1 ? size / aspect : size;
        ctx.save();
        ctx.translate(cx, cy);
        if (rot) ctx.rotate(rot);
        if (flash) {
          const buf = tintBufRef.current ?? (tintBufRef.current = document.createElement("canvas"));
          buf.width = frame.w; // also resets the buffer's context state
          buf.height = frame.h;
          const bctx = buf.getContext("2d")!;
          bctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);
          bctx.globalCompositeOperation = "source-atop"; // tint only the sprite's pixels
          bctx.fillStyle = "rgba(255,64,64,0.72)";
          bctx.fillRect(0, 0, frame.w, frame.h);
          ctx.drawImage(buf, -dw / 2, -dh / 2, dw, dh);
        } else {
          ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, -dw / 2, -dh / 2, dw, dh);
        }
        ctx.restore();
        return;
      }

      if (!emoji) return; // e.g. the knife has a rect fallback, handled inline
      ctx.save();
      ctx.translate(cx, cy);
      if (rot) ctx.rotate(rot);
      ctx.font = `${size}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(emoji, 0, 0);
      ctx.restore();
      if (flash) {
        // Emoji can't be tinted cleanly; a translucent red disc reads as "hit".
        ctx.save();
        ctx.fillStyle = "rgba(255,64,64,0.42)";
        ctx.beginPath();
        ctx.arc(cx, cy, size * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    };
    const knifeReady =
      SPRITES_CONFIGURED && sheetReadyRef.current && SPRITES[KNIFE_SPRITE].w > 0;

    const step = (time: number) => {
      if (minimizedRef.current || document.hidden) {
        setPhase("paused");
        return;
      }
      const sim = simRef.current;
      const dt = Math.min((time - (lastTimeRef.current || time)) / 1000, 0.05);
      lastTimeRef.current = time;

      // — advance —
      sim.swayT += dt;
      sim.fireCooldown -= dt;
      sim.playerFireCooldown -= dt;
      sim.throwT = Math.max(0, sim.throwT - dt);
      sim.invulnT = Math.max(0, sim.invulnT - dt);
      for (const e of sim.enemies) {
        if (e.flashT > 0) e.flashT = Math.max(0, e.flashT - dt);
      }
      if (sim.keys.left) sim.playerX -= PLAYER_SPEED * dt;
      if (sim.keys.right) sim.playerX += PLAYER_SPEED * dt;
      sim.playerX = Math.max(16, Math.min(W - 16, sim.playerX));

      // Held fire: space or pointer down keeps throwing on a cooldown.
      if (sim.keys.fire && sim.playerFireCooldown <= 0) {
        sim.bullets.push({ x: sim.playerX, y: PLAYER_Y - 14 });
        sim.playerFireCooldown = FIRE_INTERVAL;
        sim.throwT = THROW_POSE_TIME;
      }

      sim.bullets.forEach((b) => (b.y -= BULLET_SPEED * dt));
      sim.bullets = sim.bullets.filter((b) => b.y > -10);
      sim.enemyBullets.forEach((b) => {
        b.y += ENEMY_BULLET_SPEED * dt;
        b.x += (b.vx ?? 0) * dt;
      });
      sim.enemyBullets = sim.enemyBullets.filter((b) => b.y < H + 10 && b.x > -10 && b.x < W + 10);

      const alive = sim.enemies.filter((e) => e.alive);

      if (sim.boss) {
        // — boss round (The Heart) —
        const boss = sim.boss;
        boss.t += dt;
        boss.fireCooldown -= dt;
        boss.flashT = Math.max(0, boss.flashT - dt);
        // Sweep the top of the field at a steady pace (constant frequency, so it
        // never jumps mid-sweep); it only fires faster as it takes damage.
        const rage = 1 + (1 - boss.hp / BOSS_HP) * 0.9;
        boss.x = W / 2 + Math.sin(boss.t * 0.8) * (W / 2 - 70);

        if (boss.fireCooldown <= 0) {
          // Three emitters: left wing, mouth, right wing. Patterns cycle:
          // aimed shot → 3-way spread → all-emitter volley.
          const emitters = [boss.x - 34, boss.x, boss.x + 34];
          const pattern = Math.floor(boss.t / 4) % 3;
          if (pattern === 0) {
            const from = emitters[Math.floor(Math.random() * emitters.length)];
            const dx = sim.playerX - from;
            sim.enemyBullets.push({ x: from, y: BOSS_Y + 20, vx: dx * 0.55 });
          } else if (pattern === 1) {
            for (const vx of [-70, 0, 70]) {
              sim.enemyBullets.push({ x: boss.x, y: BOSS_Y + 20, vx });
            }
          } else {
            for (const from of emitters) {
              sim.enemyBullets.push({ x: from, y: BOSS_Y + 20, vx: (Math.random() - 0.5) * 50 });
            }
          }
          boss.fireCooldown = Math.max(0.3, 0.62 / rage);
        }

        // Player knives vs boss.
        for (const bullet of sim.bullets) {
          if (Math.abs(bullet.x - boss.x) < BOSS_RADIUS && Math.abs(bullet.y - BOSS_Y) < BOSS_RADIUS) {
            bullet.y = CONSUMED_Y;
            boss.hp -= 1;
            boss.flashT = FLASH_TIME;
            sim.score += 5;
            if (boss.hp <= 0) {
              sim.score += 500;
              // Only beating the game (downing the boss) completes the note —
              // clearing an earlier wave no longer counts.
              markFound("game-beat");
              finish(sim.score, "victory");
              return;
            }
          }
        }
      } else {
        // — formation rounds —
        sim.descent += DESCENT_BASE * (1 + (sim.wave - 1) * 0.35) * dt;

        // Breach: the formation reaching your row ends the run outright.
        for (const enemy of alive) {
          if (enemyPos(enemy, sim).y >= BREACH_Y) {
            finish(sim.score, "gameover");
            return;
          }
        }

        // Enemy fire: one random shooter on a per-wave-shrinking interval.
        if (sim.fireCooldown <= 0 && alive.length > 0) {
          const shooter = alive[Math.floor(Math.random() * alive.length)];
          const pos = enemyPos(shooter, sim);
          sim.enemyBullets.push({ x: pos.x, y: pos.y + 12 });
          sim.fireCooldown = Math.max(0.35, 1.4 - sim.wave * 0.15);
        }

        // Player knives vs enemies. Gremlins/sentries take two hits and flash
        // red after the first; one knife strikes one enemy, then is consumed.
        for (const bullet of sim.bullets) {
          for (const enemy of alive) {
            if (!enemy.alive) continue;
            const pos = enemyPos(enemy, sim);
            if (Math.abs(bullet.x - pos.x) < HIT_RADIUS && Math.abs(bullet.y - pos.y) < HIT_RADIUS) {
              bullet.y = CONSUMED_Y;
              enemy.hp -= 1;
              if (enemy.hp <= 0) {
                enemy.alive = false;
                sim.score += ENEMIES[enemy.kind].score;
              } else {
                enemy.flashT = FLASH_TIME;
              }
              break;
            }
          }
        }

        // Wave cleared → next, bigger formation (same score/lives). This is
        // progress, not a win, so it no longer completes the Field Notes item.
        if (sim.enemies.every((e) => !e.alive)) {
          const next = newSim(sim.wave + 1, sim.score, sim.lives);
          next.playerX = sim.playerX;
          next.keys = sim.keys;
          simRef.current = next;
        }
      }

      // Enemy bullets vs player.
      if (sim.invulnT <= 0) {
        for (const bullet of sim.enemyBullets) {
          if (Math.abs(bullet.x - sim.playerX) < HIT_RADIUS && Math.abs(bullet.y - PLAYER_Y) < HIT_RADIUS) {
            sim.lives -= 1;
            sim.enemyBullets = [];
            sim.invulnT = 1.5;
            if (sim.lives <= 0) {
              finish(sim.score, "gameover");
              return;
            }
            break;
          }
        }
      }

      // — draw —
      ctx.fillStyle = "#0a0a10";
      ctx.fillRect(0, 0, W, H);

      const current = simRef.current; // wave rollover may have swapped sims
      if (current.boss) {
        drawSprite(BOSS_SPRITE, current.boss.x, BOSS_Y, BOSS_SIZE, {
          emoji: BOSS_EMOJI,
          flash: current.boss.flashT > 0,
        });
        // Health bar.
        const barW = 160;
        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.fillRect(W / 2 - barW / 2, 20, barW, 6);
        ctx.fillStyle = ENEMY_BULLET_COLOR;
        ctx.fillRect(W / 2 - barW / 2, 20, barW * (current.boss.hp / BOSS_HP), 6);
      } else {
        for (const enemy of current.enemies) {
          if (!enemy.alive) continue;
          const pos = enemyPos(enemy, current);
          const def = ENEMIES[enemy.kind];
          drawSprite(def.sprite, pos.x, pos.y, def.size, {
            emoji: def.emoji,
            flash: enemy.flashT > 0,
          });
        }
      }

      // Player (The Silent). Blinks while invulnerable; switches to the
      // throwing pose for a beat after each knife leaves her hand.
      if (current.invulnT <= 0 || Math.floor(current.invulnT * 8) % 2 === 0) {
        const sprite = current.throwT > 0 ? PLAYER_THROW_SPRITE : PLAYER_SPRITE;
        // Bottom-anchored: the portrait frame's rendered height is PLAYER_SIZE,
        // so centering at (baseline − size/2) pins its bottom to PLAYER_BASELINE.
        drawSprite(sprite, current.playerX, PLAYER_BASELINE - PLAYER_SIZE / 2, PLAYER_SIZE, {
          emoji: PLAYER_EMOJI,
        });
      }

      // Player knives — the source dagger already points up (toward the
      // enemies). Fallback while the sheet is unconfigured is a slim bar.
      for (const b of current.bullets) {
        if (knifeReady) {
          drawSprite(KNIFE_SPRITE, b.x, b.y, KNIFE_SIZE);
        } else {
          ctx.fillStyle = KNIFE_FALLBACK_COLOR;
          ctx.fillRect(b.x - 1.5, b.y - 6, 3, 12);
        }
      }

      // Enemy fire is round now.
      ctx.fillStyle = ENEMY_BULLET_COLOR;
      for (const b of current.enemyBullets) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, ENEMY_BULLET_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }

      // HUD.
      ctx.fillStyle = "#f5f5f7";
      ctx.font = "11px monospace";
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";
      ctx.fillText(`SCORE ${current.score}`, 8, 12);
      ctx.textAlign = "right";
      const waveLabel = current.boss ? "BOSS" : `WAVE ${current.wave}/${BOSS_WAVE}`;
      ctx.fillText(`${waveLabel}   LIVES ${"♥".repeat(Math.max(0, current.lives))}`, W - 8, 12);

      rafRef.current = requestAnimationFrame(step);
    };

    lastTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase, finish]);

  const start = () => {
    simRef.current = newSim(1, 0, 3);
    setPhase("playing");
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      setPhase((p) => (p === "playing" ? "paused" : p === "paused" ? "playing" : p));
      return;
    }
    if (phase !== "playing") {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (phase === "paused") setPhase("playing");
        else start();
      }
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "a") simRef.current.keys.left = true;
    if (event.key === "ArrowRight" || event.key === "d") simRef.current.keys.right = true;
    if (event.key === " ") {
      event.preventDefault();
      simRef.current.keys.fire = true;
    }
  };

  const handleKeyUp = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowLeft" || event.key === "a") simRef.current.keys.left = false;
    if (event.key === "ArrowRight" || event.key === "d") simRef.current.keys.right = false;
    if (event.key === " ") simRef.current.keys.fire = false;
  };

  // Pointer/touch: slide to steer, hold to fire.
  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (phase !== "playing") return;
    const rect = event.currentTarget.getBoundingClientRect();
    simRef.current.playerX = ((event.clientX - rect.left) / rect.width) * W;
  };

  // Keep keyboard focus on the game so arrows/space work without clicking into
  // it — on open (the idle start screen) and whenever play (re)starts. The
  // Start / Resume / Play again buttons take focus when clicked and then
  // unmount, which would otherwise drop focus and break the controls. We don't
  // refocus on pause/gameover/victory, so the game never steals focus back if it
  // ends while the visitor is in another window.
  useEffect(() => {
    if (phase === "idle" || phase === "playing") {
      wrapperRef.current?.focus();
    }
  }, [phase]);

  const isVictory = phase === "victory";

  return (
    // The wrapper takes focus so arrows/space steer the game instead of the page.
    <div
      ref={wrapperRef}
      className="relative flex h-full flex-col items-center justify-center gap-2 bg-black/60 p-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      aria-label="Topple the Tower game. Arrow keys to move, hold space to throw knives, escape to pause."
    >
      <canvas
        ref={canvasRef}
        style={{ width: W, height: H, maxWidth: "100%" }}
        className="rounded-lg border border-[var(--glass-border)]"
        onPointerMove={handlePointerMove}
        onPointerDown={(e) => {
          (e.currentTarget.parentElement as HTMLElement)?.focus();
          e.currentTarget.setPointerCapture(e.pointerId);
          if (phase === "playing") simRef.current.keys.fire = true;
        }}
        onPointerUp={() => {
          simRef.current.keys.fire = false;
        }}
        onPointerCancel={() => {
          simRef.current.keys.fire = false;
        }}
      />

      {phase !== "playing" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 p-4 text-center">
          {phase === "idle" ? (
            <>
              <h2 className="text-lg font-semibold text-[var(--fg)]">Topple the Tower</h2>
              <p className="max-w-xs text-[13px] leading-relaxed text-[var(--fg-muted)]">
                ← → move · hold space to throw knives · esc pauses. On touch: slide to steer, hold
                to throw. Five waves — they descend faster each one, gremlins and sentries take two
                hits, and the fifth is the Heart. If they reach you, it&apos;s over.
              </p>
            </>
          ) : phase === "paused" ? (
            <h2 className="text-lg font-semibold text-[var(--fg)]">Paused</h2>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-[var(--fg)]">
                {isVictory ? "You Win!" : "Game over"}
              </h2>
              <p className="text-[14px] text-[var(--fg-muted)]">
                {isVictory ? "The desk is safe. " : ""}Score {finalScore} · Best {highScore}
              </p>
            </>
          )}
          <button
            type="button"
            onClick={phase === "paused" ? () => setPhase("playing") : start}
            className="min-h-11 rounded-lg bg-[var(--accent)] px-5 text-[15px] font-medium text-[var(--accent-fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            {phase === "idle" ? "Start" : phase === "paused" ? "Resume" : "Play again"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
