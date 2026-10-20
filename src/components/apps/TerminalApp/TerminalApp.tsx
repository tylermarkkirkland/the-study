"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useWindowManager } from "@/components/WindowManager/WindowManagerContext";
import type { AppType } from "@/lib/windowManager/windowReducer";
import { markFound, resetDiscoveries, hasFound } from "@/lib/discovery/discoveryStore";
import { setPartyMode } from "@/lib/party/partyStore";
import { getMySignature } from "@/lib/guestbook/guestbookStore";
import { HACK_PASSCODE } from "@/lib/hackPasscode";

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
  // Animated commands reveal their output one line at a time, like a real
  // terminal printing — falls back to all-at-once under reduced motion.
  animated?: boolean;
  // Display name for the `hack` reveal list, for a multi-word command whose key
  // is only its first word (e.g. `party` → "party mode").
  label?: string;
  // "CLEAR" wipes the screen; "PASSCODE" puts the prompt into passcode-entry
  // mode (see runCommand) instead of printing a normal response.
  run: (ctx: CommandContext) => string[] | "CLEAR" | "PASSCODE";
};

// The line-by-line "access granted" reveal, shared so the passcode-success path
// can print it. Reads the command table live, so any secret added later shows
// up here automatically.
function revealSecrets(): string[] {
  // `hack` hides itself. `matrix` and the `????` placeholder share the final
  // slot: until you've found matrix on your own it shows as "????" (its Field
  // Notes item stays un-spoiled); once found, that slot resolves to `matrix`.
  const secrets = Object.entries(COMMANDS)
    .filter(([name, cmd]) => cmd.hidden && name !== "hack" && name !== "matrix" && name !== "????")
    .map(([name, cmd]) => cmd.label ?? name);
  secrets.push(hasFound("terminal-matrix") ? "matrix" : "????");
  return [
    "> breaching mainframe…",
    "> [██████████] 100%",
    "> access granted.",
    "",
    "Hidden commands on this machine:",
    ...secrets.map((name) => `  ${name}`),
    "",
    "You didn't hear it from me.",
  ];
}

const OPENABLE: Partial<Record<string, AppType>> = {
  about: "about",
  notes: "notebook",
  "field-notes": "notebook",
  arcade: "game",
  topple: "game",
  tower: "game",
  game: "game",
  terminal: "terminal",
  trash: "trash",
};

// Things that exist in the room, not on this computer — `open` redirects
// people out into the 3D scene instead of failing.
const ROOM_THINGS = new Set(["guestbook", "journal", "guitar", "radio"]);

// Shown whenever party mode turns on, with the reminder for how to end it.
const PARTY_ON_LINES = [
  "Party mode on. The room is feeling something.",
  'When you\'re done vibing, type "party mode off".',
];
const PARTY_OFF_LINE = "Party mode off. The lights settle down.";

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
    run: () => {
      const me = getMySignature();
      if (!me) return ["guest. But the guestbook on the desk can fix that."];
      const name = me.text?.value.trim();
      const handle = me.xHandle;
      if (name && handle) return [`${name} (@${handle}). The guestbook remembers you.`];
      if (name) return [`${name}. The guestbook remembers you.`];
      if (handle) return [`@${handle}. The guestbook remembers you.`];
      // Signed in ink only — nothing machine-readable, but they did sign.
      return ["You signed the book — in ink I can't quite read, but it remembers you."];
    },
  },
  ls: {
    description: "List what's installed.",
    run: () => ["About    Notes    Terminal    Topple the Tower    Trash"],
  },
  open: {
    description: "Open something. Try `open topple`.",
    run: ({ args, openWindow }) => {
      const target = args[0]?.toLowerCase();
      if (!target) return ["Usage: open <about|notes|topple|trash>"];
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
  reset: {
    description: "Reset progress. Try `reset notes`.",
    run: ({ args }) => {
      const target = args[0]?.toLowerCase();
      if (target === "notes" || target === "field-notes" || target === "notebook") {
        resetDiscoveries();
        setPartyMode(false); // a reset returns the room to normal too
        return ["Notes reset — every discovery is a mystery again."];
      }
      if (target === "party") {
        setPartyMode(false);
        return [PARTY_OFF_LINE];
      }
      if (!target) return ["Usage: reset <notes>"];
      return [`reset: ${target}: nothing to reset there. Try \`reset notes\`.`];
    },
  },
  // ——— easter eggs (hidden from help + tab-complete) ———
  sudo: {
    description: "",
    hidden: true,
    run: ({ args }) => {
      return args.length
        ? ["Nice try. This desk answers to no one — not even you, root."]
        : ["sudo: think about what you're asking."];
    },
  },
  matrix: {
    description: "",
    hidden: true,
    run: () => {
      markFound("terminal-matrix");
      return [
        "01001000 01101001 00101110",
        "ﾊ ﾐ ﾋ ｰ ｳ ｼ ﾅ ﾓ ﾆ ｻ",
        "ﾜ ﾂ ｵ ﾘ ｱ ﾎ ﾃ ﾏ ｹ ﾒ",
        "Wake up. The room is watching you back.",
      ];
    },
  },
  pixel: {
    description: "",
    hidden: true,
    run: () => {
      return [
        "     /\\",
        "    /  \\",
        "   /____\\",
        "  /\\    /\\",
        " /  \\  /  \\",
        "/____\\/____\\",
        "It's dangerous to go alone! Take this.",
      ];
    },
  },
  credits: {
    description: "",
    hidden: true,
    run: () => {
      return [
        "THE STUDY",
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
  party: {
    description: "",
    hidden: true,
    // Listed and typed as "party mode" (the parser keys on the first word, so
    // "mode" arrives as an arg). "party mode" turns it on, "party mode off"
    // turns it off; anything else nudges toward "party mode". The effect lives
    // in the 3D room (PartyLights), with a faint colored rim on the monitor bezel.
    label: "party mode",
    run: ({ args }) => {
      const rest = args.map((a) => a.toLowerCase());
      if (rest[0] !== "mode") {
        return ['Try "party mode" — and "party mode off" when you\'re done.'];
      }
      if (rest.includes("off")) {
        setPartyMode(false);
        return [PARTY_OFF_LINE];
      }
      setPartyMode(true);
      return PARTY_ON_LINES;
    },
  },
  // Shows up in the hack reveal as the one command left unnamed. Before matrix
  // is found it refuses to spoil it; once it's been found there's nothing left
  // to protect, so it just gets cheeky.
  "????": {
    description: "",
    hidden: true,
    run: () =>
      hasFound("terminal-matrix")
        ? ["What? You wanted even more?!"]
        : [
            "Ha — no. There's one more secret on this machine,",
            "and it wouldn't be much of a secret if I just handed it over.",
            "You'll want to find that one yourself. Your Notes have a hint —",
            "and if you're stuck, tap the ? next to it.",
          ],
  },
  // The master key — but it's locked. Running it drops into passcode-entry
  // mode; the code is on a sticky note out on the desk. Cracking it (see
  // submitPasscode) is what completes the "someone tried to hack" note and
  // reveals the map of every other hidden command.
  hack: {
    description: "",
    hidden: true,
    run: () => {
      return "PASSCODE";
    },
  },
};

// Anyone who gets the "There is no spoon?" reference but guesses a different
// word than `matrix` still solved it — these phrases all run `matrix`. Kept out
// of COMMANDS so they never surface in help, tab-complete, or the hack reveal.
// Matched against the whole input (lowercased, punctuation stripped), so
// multi-word guesses like "there is no spoon" work too.
const MATRIX_ALIASES = new Set([
  "the matrix",
  "there is no spoon",
  "neo",
  "wake up neo",
  "knock knock neo",
  "morpheus",
  "trinity",
  "agent smith",
  "mr anderson",
  "red pill",
  "redpill",
  "take the red pill",
]);

const normalizeGuess = (raw: string) =>
  raw.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();

const WELCOME: Line[] = [
  { text: "The Study Terminal — type `help` to get your bearings.", kind: "output" },
];

export default function TerminalApp() {
  const { openWindow } = useWindowManager();
  const [lines, setLines] = useState<Line[]>(WELCOME);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState<number | null>(null);
  // When true, the next line entered is checked against the `hack` passcode
  // rather than parsed as a command.
  const [awaitingPasscode, setAwaitingPasscode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Keep the latest output on screen, like a real terminal.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  // Focus the prompt as soon as the window opens, so you can type without a
  // second click.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Clear any in-flight line-reveal timers if the window closes mid-animation.
  useEffect(
    () => () => {
      timersRef.current.forEach(clearTimeout);
    },
    [],
  );

  // Append the echoed input line plus its output. When `animate` is set (and the
  // user hasn't asked for reduced motion), the output prints one line at a time
  // like a real terminal; otherwise it all appears at once.
  const appendLines = (echoed: Line[], output: Line[], animate: boolean) => {
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (animate && !prefersReducedMotion) {
      setLines((prev) => [...prev, ...echoed]);
      output.forEach((line, i) => {
        const timer = setTimeout(() => {
          setLines((prev) => [...prev, line]);
        }, (i + 1) * 90);
        timersRef.current.push(timer);
      });
      return;
    }

    setLines((prev) => [...prev, ...echoed, ...output]);
  };

  const runCommand = (raw: string) => {
    const trimmed = raw.trim();
    const echoed: Line[] = [{ text: `> ${raw}`, kind: "input" }];
    if (!trimmed) {
      setLines((prev) => [...prev, ...echoed]);
      return;
    }

    const [name, ...args] = trimmed.split(/\s+/);
    const command = MATRIX_ALIASES.has(normalizeGuess(trimmed))
      ? COMMANDS.matrix
      : COMMANDS[name.toLowerCase()];

    // Remember every non-empty entry for ArrowUp/Down history.
    setHistory((prev) => [...prev, raw]);
    setHistoryIdx(null);

    if (!command) {
      setLines((prev) => [
        ...prev,
        ...echoed,
        { text: `${name}: command not found. Try \`help\`.`, kind: "output" },
      ]);
      return;
    }

    const result = command.run({ args, openWindow });
    if (result === "CLEAR") {
      setLines([]);
      return;
    }
    if (result === "PASSCODE") {
      setAwaitingPasscode(true);
      appendLines(
        echoed,
        [
          { text: "RESTRICTED — this one's locked.", kind: "output" },
          { text: "Enter passcode (or leave it blank to back out):", kind: "output" },
        ],
        false,
      );
      return;
    }
    const output: Line[] = result.map((text) => ({ text, kind: "output" as const }));
    appendLines(echoed, output, !!command.animated);
  };

  // Handles a line typed while the prompt is in passcode-entry mode. The right
  // code plays the animated reveal; a wrong one denies access and nudges the
  // player back out to the room. Either way we leave passcode mode.
  const submitPasscode = (raw: string) => {
    const attempt = raw.trim();
    const echoed: Line[] = [{ text: `passcode> ${attempt}`, kind: "input" }];
    setAwaitingPasscode(false);

    if (!attempt) {
      appendLines(echoed, [{ text: "Cancelled.", kind: "output" }], false);
      return;
    }
    if (attempt === HACK_PASSCODE) {
      markFound("terminal-hack");
      const output: Line[] = revealSecrets().map((text) => ({ text, kind: "output" as const }));
      appendLines(echoed, output, true);
      return;
    }
    appendLines(echoed, [{ text: "ACCESS DENIED.", kind: "output" }], false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      if (awaitingPasscode) submitPasscode(input);
      else runCommand(input);
      setInput("");
      return;
    }
    // No history recall or tab-completion while typing a passcode — it would
    // leak command names into the passcode field.
    if (awaitingPasscode) return;
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
          {awaitingPasscode ? "passcode>" : ">"}
        </span>
        <label htmlFor="terminal-input" className="sr-only">
          {awaitingPasscode ? "Passcode" : "Terminal command"}
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
