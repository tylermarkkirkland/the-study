"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ARCADE_CHARACTERS } from "@/data/arcadeCharacters";
import { useWindowManager } from "@/components/WindowManager/WindowManagerContext";
import { markFound } from "@/lib/discovery/discoveryStore";

// Galaga-lite in a window, with an arc: four growing waves of a descending
// formation, then a wave-5 boss with three fire points. Beat it and you've
// beaten the game. Hold space (or the pointer) to keep firing. All rendering
// is canvas + rAF; React only handles the shell screens. Never auto-starts.

const W = 464;
const H = 300;
const PLAYER_Y = H - 22;
const PLAYER_SPEED = 220; // px/s
const BULLET_SPEED = 320;
const ENEMY_BULLET_SPEED = 140;
const FIRE_INTERVAL = 0.3; // s between held-fire shots
const ENEMY_SPACING = 48;
const HIT_RADIUS = 12;
// The formation creeps toward you the whole round — reaching your row is an
// instant game over, lives be damned. Base px/s, scaled up every wave.
const DESCENT_BASE = 3.2;
const BREACH_Y = PLAYER_Y - 16;
const BOSS_WAVE = 5;
const BOSS_HP = 30;
const BOSS_Y = 64;
const BOSS_RADIUS = 30;
const HIGHSCORE_KEY = "classic-os:arcade-highscore";
const SHARE_URL = "https://x.com/intent/tweet";

type Enemy = { col: number; row: number; alive: boolean };
type Bullet = { x: number; y: number; vx?: number };
type Boss = { x: number; hp: number; t: number; fireCooldown: number };

// Fewer enemies to start, growing every wave until the boss.
function formationFor(wave: number): { cols: number; rows: number } {
  const spec = [
    { cols: 4, rows: 2 },
    { cols: 6, rows: 2 },
    { cols: 6, rows: 3 },
    { cols: 8, rows: 3 },
  ][wave - 1];
  return spec ?? { cols: 8, rows: 3 };
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
  invulnT: number;
  keys: { left: boolean; right: boolean; fire: boolean };
};

function newSim(wave: number, score: number, lives: number): Sim {
  const isBoss = wave >= BOSS_WAVE;
  const { cols, rows } = formationFor(wave);
  const enemies: Enemy[] = [];
  if (!isBoss) {
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        enemies.push({ col, row, alive: true });
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
    boss: isBoss ? { x: W / 2, hp: BOSS_HP, t: 0, fireCooldown: 1.2 } : null,
    wave,
    score,
    lives,
    swayT: 0,
    descent: 0,
    fireCooldown: 0,
    playerFireCooldown: 0,
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

// Which emoji a formation row wears: use the LAST n of enemyRows so the
// closest (bottom) row looks the same on every wave.
function rowEmoji(row: number, rows: number): string {
  const all = ARCADE_CHARACTERS.enemyRows;
  return all[all.length - rows + row] ?? all[all.length - 1];
}

function loadHighScore(): number {
  try {
    return Number(localStorage.getItem(HIGHSCORE_KEY)) || 0;
  } catch {
    return 0;
  }
}

export default function GameApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<Sim>(newSim(1, 0, 3));
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const [phase, setPhase] = useState<"idle" | "playing" | "paused" | "gameover" | "victory">(
    "idle",
  );
  const [finalScore, setFinalScore] = useState(0);
  // Lazy init reads storage once on the client; the app only mounts inside a
  // window (post-interaction), so there's no SSR/hydration surface here.
  const [highScore, setHighScore] = useState(loadHighScore);

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
      sim.invulnT = Math.max(0, sim.invulnT - dt);
      if (sim.keys.left) sim.playerX -= PLAYER_SPEED * dt;
      if (sim.keys.right) sim.playerX += PLAYER_SPEED * dt;
      sim.playerX = Math.max(16, Math.min(W - 16, sim.playerX));

      // Held fire: space or pointer down keeps shooting on a cooldown.
      if (sim.keys.fire && sim.playerFireCooldown <= 0) {
        sim.bullets.push({ x: sim.playerX, y: PLAYER_Y - 14 });
        sim.playerFireCooldown = FIRE_INTERVAL;
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
        // — boss round —
        const boss = sim.boss;
        boss.t += dt;
        boss.fireCooldown -= dt;
        // Sweep the top of the field; speed up as it takes damage.
        const rage = 1 + (1 - boss.hp / BOSS_HP) * 0.9;
        boss.x = W / 2 + Math.sin(boss.t * 0.8 * rage) * (W / 2 - 70);

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

        // Player bullets vs boss.
        for (const bullet of sim.bullets) {
          if (Math.abs(bullet.x - boss.x) < BOSS_RADIUS && Math.abs(bullet.y - BOSS_Y) < BOSS_RADIUS) {
            bullet.y = -100; // consumed
            boss.hp -= 1;
            sim.score += 5;
            if (boss.hp <= 0) {
              sim.score += 500;
              markFound("game-wave");
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

        // Player bullets vs enemies.
        for (const bullet of sim.bullets) {
          for (const enemy of alive) {
            if (!enemy.alive) continue;
            const pos = enemyPos(enemy, sim);
            if (Math.abs(bullet.x - pos.x) < HIT_RADIUS && Math.abs(bullet.y - pos.y) < HIT_RADIUS) {
              enemy.alive = false;
              bullet.y = -100; // consumed
              sim.score += (sim.rows - enemy.row) * 10;
            }
          }
        }

        // Wave cleared → next, bigger formation (same score/lives).
        if (sim.enemies.every((e) => !e.alive)) {
          markFound("game-wave");
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
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const current = simRef.current; // wave rollover may have swapped sims
      if (current.boss) {
        ctx.font = "52px sans-serif";
        ctx.fillText(ARCADE_CHARACTERS.boss, current.boss.x, BOSS_Y);
        // Health bar.
        const barW = 160;
        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.fillRect(W / 2 - barW / 2, 20, barW, 6);
        ctx.fillStyle = ARCADE_CHARACTERS.enemyBulletColor;
        ctx.fillRect(W / 2 - barW / 2, 20, barW * (current.boss.hp / BOSS_HP), 6);
      } else {
        ctx.font = "20px sans-serif";
        for (const enemy of current.enemies) {
          if (!enemy.alive) continue;
          const pos = enemyPos(enemy, current);
          ctx.fillText(rowEmoji(enemy.row, current.rows), pos.x, pos.y);
        }
      }

      // Player blinks while invulnerable.
      if (current.invulnT <= 0 || Math.floor(current.invulnT * 8) % 2 === 0) {
        ctx.font = "22px sans-serif";
        ctx.fillText(ARCADE_CHARACTERS.player, current.playerX, PLAYER_Y);
      }

      ctx.fillStyle = ARCADE_CHARACTERS.playerBulletColor;
      for (const b of current.bullets) ctx.fillRect(b.x - 1.5, b.y - 5, 3, 10);
      ctx.fillStyle = ARCADE_CHARACTERS.enemyBulletColor;
      for (const b of current.enemyBullets) ctx.fillRect(b.x - 1.5, b.y - 5, 3, 10);

      ctx.fillStyle = "#f5f5f7";
      ctx.font = "11px monospace";
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

  const isVictory = phase === "victory";
  const shareText = isVictory
    ? `I beat the desk invasion — all 5 waves, ${finalScore} points. Your turn: `
    : `I scored ${finalScore} defending a desk. Beat me: `;
  const shareHref = `${SHARE_URL}?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(
    typeof window === "undefined" ? "" : window.location.origin,
  )}`;

  return (
    // The wrapper takes focus so arrows/space steer the game instead of the page.
    <div
      className="relative flex h-full flex-col items-center justify-center gap-2 bg-black/60 p-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      aria-label="Arcade game. Arrow keys to move, hold space to fire, escape to pause."
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
              <h2 className="text-lg font-semibold text-[var(--fg)]">Desk Defense</h2>
              <p className="max-w-xs text-[13px] leading-relaxed text-[var(--fg-muted)]">
                ← → move · hold space to fire · esc pauses. On touch: slide to steer, hold to
                fire. Five waves — they descend faster each one, and the fifth is angry. If they
                reach you, it&apos;s over.
              </p>
            </>
          ) : phase === "paused" ? (
            <h2 className="text-lg font-semibold text-[var(--fg)]">Paused</h2>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-[var(--fg)]">
                {isVictory ? "You beat it" : "Game over"}
              </h2>
              <p className="text-[14px] text-[var(--fg-muted)]">
                {isVictory ? "The desk is safe. " : ""}Score {finalScore} · Best {highScore}
              </p>
              <a
                href={shareHref}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-11 rounded-lg border border-[var(--glass-border)] px-4 leading-[44px] text-[14px] font-medium text-[var(--fg)] hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                Share score
              </a>
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
