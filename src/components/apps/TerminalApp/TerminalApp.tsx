"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useWindowManager } from "@/components/WindowManager/WindowManagerContext";
import type { AppType } from "@/lib/windowManager/windowReducer";
import { markFound } from "@/lib/discovery/discoveryStore";

type Line = { text: string; kind: "input" | "output" };

type CommandContext = {
  args: string[];
  openWindow: (appType: AppType) => void;
};

type Command = {
  description: string;
  // Hidden commands don't show in `help` or tab-complete — they're the easter
  // eggs people find by guessing. Running one marks the terminal discovery.
  hidden?: boolean;
  run: (ctx: CommandContext) => string[] | "CLEAR";
};

const OPENABLE: Partial<Record<string, AppType>> = {
  about: "about",
  notes: "notebook",
  "field-notes": "notebook",
  arcade: "game",
  game: "game",
  terminal: "terminal",
  trash: "trash",
};

// Things that exist in the room, not on this computer — `open` redirects
// people out into the 3D scene instead of failing.
const ROOM_THINGS = new Set(["guestbook", "journal", "guitar", "radio"]);

const COMMANDS: Record<string, Command> = {
  help: {
    description: "List commands. Well — most of them.",
    run: () => [
      "Commands:",
      ...Object.entries(COMMANDS)
        .filter(([, cmd]) => !cmd.hidden)
        .map(([name, cmd]) => `  ${name.padEnd(10)} ${cmd.description}`),
      "",
      "(This list is not exhaustive. Poke around.)",
    ],
  },
  about: {
    description: "Who made this?",
    run: () => [
      "Tyler Kirkland — UX product designer.",
      "Built this desk, the room it sits in, and the computer you're typing on.",
      "Double-click About on the desktop for the longer version.",
    ],
  },
  whoami: {
    description: "Identify yourself.",
    run: () => ["guest. But the guestbook on the desk can fix that."],
  },
  ls: {
    description: "List what's installed.",
    run: () => ["About    Field Notes    Terminal    Arcade    Trash"],
  },
  open: {
    description: "Open something. Try `open arcade`.",
    run: ({ args, openWindow }) => {
      const target = args[0]?.toLowerCase();
      if (!target) return ["Usage: open <about|notes|arcade|trash>"];
      const appType = OPENABLE[target];
      if (appType) {
        openWindow(appType);
        return [`Opening ${target}…`];
      }
      if (ROOM_THINGS.has(target)) {
        return [`The ${target} isn't on this computer — it's out in the room. Look around the desk.`];
      }
      return [`open: ${target}: not found. Try \`ls\`.`];
    },
  },
  date: {
    description: "What day is it, anyway?",
    run: () => [new Date().toString()],
  },
  echo: {
    description: "Repeat after me.",
    run: ({ args }) => [args.join(" ")],
  },
  clear: {
    description: "Wipe the screen.",
    run: () => "CLEAR",
  },
  // ——— easter eggs (hidden from help + tab-complete) ———
  sudo: {
    description: "",
    hidden: true,
    run: ({ args }) => {
      markFound("terminal-secret");
      return args.length
        ? ["Nice try. This desk answers to no one — not even you, root."]
        : ["sudo: think about what you're asking."];
    },
  },
  matrix: {
    description: "",
    hidden: true,
    run: () => {
      markFound("terminal-secret");
      return [
        "01001000 01101001 00101110",
        "ﾊ ﾐ ﾋ ｰ ｳ ｼ ﾅ ﾓ ﾆ ｻ",
        "ﾜ ﾂ ｵ ﾘ ｱ ﾎ ﾃ ﾏ ｹ ﾒ",
        "Wake up. The room is watching you back.",
      ];
    },
  },
  coffee: {
    description: "",
    hidden: true,
    run: () => {
      markFound("terminal-secret");
      return ["      ( (", "       ) )", "    ........", "    |      |]", "    \\      /", "     `----'", "Brewing. Designer fuel, 93% of this site by volume."];
    },
  },
  credits: {
    description: "",
    hidden: true,
    run: () => {
      markFound("terminal-secret");
      return [
        "CLASSIC-OS",
        "Design, Blender room, and questionable hours: Tyler Kirkland",
        "Window chrome inspired by a certain fruit company.",
        "No pixels were harmed. A few were strongly encouraged.",
      ];
    },
  },
  exit: {
    description: "",
    hidden: true,
    run: () => ["There's a red button in the corner of this window for that. It won't bite."],
  },
  hello: {
    description: "",
    hidden: true,
    run: () => ["Hi there. You talk to computers too, huh."],
  },
};

const WELCOME: Line[] = [
  { text: "Classic-OS Terminal — type `help` to get your bearings.", kind: "output" },
];

export default function TerminalApp() {
  const { openWindow } = useWindowManager();
  const [lines, setLines] = useState<Line[]>(WELCOME);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the latest output on screen, like a real terminal.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  const runCommand = (raw: string) => {
    const trimmed = raw.trim();
    const echoed: Line[] = [{ text: `> ${raw}`, kind: "input" }];
    if (!trimmed) {
      setLines((prev) => [...prev, ...echoed]);
      return;
    }

    const [name, ...args] = trimmed.split(/\s+/);
    const command = COMMANDS[name.toLowerCase()];
    let output: Line[];
    if (!command) {
      output = [{ text: `${name}: command not found. Try \`help\`.`, kind: "output" }];
    } else {
      const result = command.run({ args, openWindow });
      if (result === "CLEAR") {
        setLines([]);
        return;
      }
      output = result.map((text) => ({ text, kind: "output" as const }));
    }

    setLines((prev) => [...prev, ...echoed, ...output]);
    setHistory((prev) => [...prev, raw]);
    setHistoryIdx(null);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      runCommand(input);
      setInput("");
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (history.length === 0) return;
      const next = historyIdx === null ? history.length - 1 : Math.max(0, historyIdx - 1);
      setHistoryIdx(next);
      setInput(history[next]);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (historyIdx === null) return;
      const next = historyIdx + 1;
      if (next >= history.length) {
        setHistoryIdx(null);
        setInput("");
      } else {
        setHistoryIdx(next);
        setInput(history[next]);
      }
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      const partial = input.toLowerCase();
      if (!partial) return;
      // Hidden commands stay hidden — completing them would spoil the hunt.
      const match = Object.keys(COMMANDS).find(
        (name) => !COMMANDS[name].hidden && name.startsWith(partial),
      );
      if (match) setInput(match + " ");
    }
  };

  return (
    // Click anywhere in the terminal to focus the prompt, like a real one.
    <div
      className="flex h-full flex-col bg-black/70 p-3 font-mono text-[13px] leading-relaxed"
      onClick={() => inputRef.current?.focus()}
    >
      <div ref={scrollRef} className="flex-1 overflow-y-auto whitespace-pre-wrap" role="log" aria-live="polite">
        {lines.map((line, i) => (
          <div key={i} className={line.kind === "input" ? "text-[var(--fg-muted)]" : "text-[#4ade80]"}>
            {line.text}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 pt-2">
        <span aria-hidden="true" className="text-[#4ade80]">
          &gt;
        </span>
        <label htmlFor="terminal-input" className="sr-only">
          Terminal command
        </label>
        <input
          ref={inputRef}
          id="terminal-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className="min-h-11 w-full bg-transparent text-[13px] text-[var(--fg)] caret-[#4ade80] outline-none"
        />
      </div>
    </div>
  );
}
