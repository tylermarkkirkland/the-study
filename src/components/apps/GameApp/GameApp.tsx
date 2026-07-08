"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ARCADE_CHARACTERS } from "@/data/arcadeCharacters";
import { useWindowManager } from "@/components/WindowManager/WindowManagerContext";
import { markFound } from "@/lib/discovery/discoveryStore";

// Galaga-lite: a fixed shooter in a window. A swaying formation takes pot
// shots at you; clear it and a faster wave takes its place. All rendering is
// canvas + rAF; React only handles the shell (start/pause/game-over screens).
// Never auto-starts — the room stays calm until the player asks for chaos.

const W = 464;
const H = 300;
const PLAYER_Y = H - 22;
const PLAYER_SPEED = 220; // px/s
const BULLET_SPEED = 320;
const ENEMY_BULLET_SPEED = 140;
const MAX_PLAYER_BULLETS = 3;
const COLS = 8;
const HIT_RADIUS = 12;
// The formation creeps toward you the whole round — reaching your row is an
// instant game over, lives be damned. Base px/s, scaled up every wave.
const DESCENT_BASE = 3.2;
const BREACH_Y = PLAYER_Y - 16;
const HIGHSCORE_KEY = "classic-os:arcade-highscore";
const SHARE_URL = "https://x.com/intent/tweet";

type Enemy = { col: number; row: number; alive: boolean };
type Bullet = { x: number; y: number };

type Sim = {
  playerX: number;
  bullets: Bullet[];
  enemyBullets: Bullet[];
  enemies: Enemy[];
  wave: number;
  score: number;
  lives: number;
  swayT: number;
  /** How far the formation has crept down this wave, in px. */
  descent: number;
  fireCooldown: number;
  invulnT: number;
  keys: { left: boolean; right: boolean };
};

function newEnemies(): Enemy[] {
  const enemies: Enemy[] = [];
  for (let row = 0; row < ARCADE_CHARACTERS.enemyRows.length; row++) {
    for (let col = 0; col < COLS; col++) {
      enemies.push({ col, row, alive: true });
    }
  }
  return enemies;
}

function newSim(wave: number, score: number, lives: number): Sim {
  return {
    playerX: W / 2,
    bullets: [],
    enemyBullets: [],
    enemies: newEnemies(),
    wave,
    score,
    lives,
    swayT: 0,
    descent: 0,
    fireCooldown: 0,
    invulnT: 1.2,
    keys: { left: false, right: false },
  };
}

function enemyPos(e: Enemy, sim: Sim): { x: number; y: number } {
  const speed = 0.9 + sim.wave * 0.25;
  const sway = Math.sin(sim.swayT * speed) * 34;
  return {
    x: 62 + e.col * 48 + sway,
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<Sim>(newSim(1, 0, 3));
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const [phase, setPhase] = useState<"idle" | "playing" | "paused" | "gameover">("idle");
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

  const endGame = useCallback((score: number) => {
    setFinalScore(score);
    setPhase("gameover");
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
      sim.descent += DESCENT_BASE * (1 + (sim.wave - 1) * 0.35) * dt;
      sim.fireCooldown -= dt;
      sim.invulnT = Math.max(0, sim.invulnT - dt);
      if (sim.keys.left) sim.playerX -= PLAYER_SPEED * dt;
      if (sim.keys.right) sim.playerX += PLAYER_SPEED * dt;
      sim.playerX = Math.max(16, Math.min(W - 16, sim.playerX));

      sim.bullets.forEach((b) => (b.y -= BULLET_SPEED * dt));
      sim.bullets = sim.bullets.filter((b) => b.y > -10);
      sim.enemyBullets.forEach((b) => (b.y += ENEMY_BULLET_SPEED * dt));
      sim.enemyBullets = sim.enemyBullets.filter((b) => b.y < H + 10);

      // Breach: the formation reaching your row ends the run outright.
      const alive = sim.enemies.filter((e) => e.alive);
      for (const enemy of alive) {
        if (enemyPos(enemy, sim).y >= BREACH_Y) {
          endGame(sim.score);
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
            sim.score += (ARCADE_CHARACTERS.enemyRows.length - enemy.row) * 10;
          }
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
              endGame(sim.score);
              return;
            }
            break;
          }
        }
      }

      // Wave cleared → faster formation, same score/lives.
      if (sim.enemies.every((e) => !e.alive)) {
        markFound("game-wave");
        simRef.current = newSim(sim.wave + 1, sim.score, sim.lives);
        simRef.current.playerX = sim.playerX;
      }

      // — draw —
      ctx.fillStyle = "#0a0a10";
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.font = "20px sans-serif";
      for (const enemy of sim.enemies) {
        if (!enemy.alive) continue;
        const pos = enemyPos(enemy, sim);
        ctx.fillText(ARCADE_CHARACTERS.enemyRows[enemy.row], pos.x, pos.y);
      }

      // Player blinks while invulnerable.
      if (sim.invulnT <= 0 || Math.floor(sim.invulnT * 8) % 2 === 0) {
        ctx.font = "22px sans-serif";
        ctx.fillText(ARCADE_CHARACTERS.player, sim.playerX, PLAYER_Y);
      }

      ctx.fillStyle = ARCADE_CHARACTERS.playerBulletColor;
      for (const b of sim.bullets) ctx.fillRect(b.x - 1.5, b.y - 5, 3, 10);
      ctx.fillStyle = ARCADE_CHARACTERS.enemyBulletColor;
      for (const b of sim.enemyBullets) ctx.fillRect(b.x - 1.5, b.y - 5, 3, 10);

      ctx.fillStyle = "#f5f5f7";
      ctx.font = "11px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`SCORE ${sim.score}`, 8, 12);
      ctx.textAlign = "right";
      ctx.fillText(`WAVE ${sim.wave}   LIVES ${"♥".repeat(Math.max(0, sim.lives))}`, W - 8, 12);

      rafRef.current = requestAnimationFrame(step);
    };

    lastTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase, endGame]);

  const fire = () => {
    const sim = simRef.current;
    if (sim.bullets.length < MAX_PLAYER_BULLETS) {
      sim.bullets.push({ x: sim.playerX, y: PLAYER_Y - 14 });
    }
  };

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
      fire();
    }
  };

  const handleKeyUp = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowLeft" || event.key === "a") simRef.current.keys.left = false;
    if (event.key === "ArrowRight" || event.key === "d") simRef.current.keys.right = false;
  };

  // Pointer/touch: slide to steer, tap to fire.
  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (phase !== "playing") return;
    const rect = event.currentTarget.getBoundingClientRect();
    simRef.current.playerX = ((event.clientX - rect.left) / rect.width) * W;
  };

  const shareHref = `${SHARE_URL}?text=${encodeURIComponent(
    `I scored ${finalScore} defending a desk. Beat me: `,
  )}&url=${encodeURIComponent(typeof window === "undefined" ? "" : window.location.origin)}`;

  return (
    // The wrapper takes focus so arrows/space steer the game instead of the page.
    <div
      className="relative flex h-full flex-col items-center justify-center gap-2 bg-black/60 p-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      aria-label="Arcade game. Arrow keys to move, space to fire, escape to pause."
    >
      <canvas
        ref={canvasRef}
        style={{ width: W, height: H, maxWidth: "100%" }}
        className="rounded-lg border border-[var(--glass-border)]"
        onPointerMove={handlePointerMove}
        onPointerDown={(e) => {
          (e.currentTarget.parentElement as HTMLElement)?.focus();
          if (phase === "playing") fire();
        }}
      />

      {phase !== "playing" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 p-4 text-center">
          {phase === "idle" ? (
            <>
              <h2 className="text-lg font-semibold text-[var(--fg)]">Desk Defense</h2>
              <p className="max-w-xs text-[13px] leading-relaxed text-[var(--fg-muted)]">
                ← → move · space fires · esc pauses. On touch: slide to steer, tap to fire.
                They descend faster every wave — if they reach you, it&apos;s over.
              </p>
            </>
          ) : phase === "paused" ? (
            <h2 className="text-lg font-semibold text-[var(--fg)]">Paused</h2>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-[var(--fg)]">Game over</h2>
              <p className="text-[14px] text-[var(--fg-muted)]">
                Score {finalScore} · Best {highScore}
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
