export type DiscoveryConfig = {
  id: string;
  // The mysterious, in-voice teaser shown while undiscovered.
  hint: string;
  // What the line becomes once found — plain past-tense, the mystery resolved.
  foundLabel: string;
  // Hidden entries render as "???" until found — pure bait for completionists.
  hidden?: boolean;
};

// The Field Notes checklist. Order is display order. Every id here must have a
// matching markFound(id) call at the moment the interaction actually happens —
// grep for the id string to find the wiring site.
export const discoveries: DiscoveryConfig[] = [
  {
    id: "radio-play",
    hint: "There's something weird going on with my radio.",
    foundLabel: "It sounds like someone is trying to reach me.",
  },
  {
    id: "guitar-play",
    hint: "I really need to practice guitar more.",
    foundLabel: "Picked up the guitar and played a bit. The neighbors have opinions.",
  },
  {
    id: "game-beat",
    hint: "I still haven't been able to beat Topple the Tower.",
    foundLabel: "The heart has been slain!",
  },
  {
    id: "guestbook-sign",
    hint: "It looks like other people have been here! I should leave my mark.",
    foundLabel: "Signed the book on the desk. My mark's in there now, too.",
  },
  {
    id: "terminal-hack",
    hint: "I feel like someone tried to *hack* my computer.",
    foundLabel:
      "Cracked the passcode and ran hack in the terminal. Turns out the sticky note had the key all along.",
  },
  {
    id: "terminal-matrix",
    hint: "There is no spoon?",
    foundLabel: "Ran matrix in the terminal. There is no spoon.",
  },
  {
    id: "trash-file",
    hidden: true,
    hint: "I really should empty the Trash one of these days.",
    foundLabel: "You snoop.",
  },
];

// Shown when every discovery is found — used by both the Field Notes app and the
// completion popup, so the two never drift apart.
export const COMPLETION_TITLE = "You did it!";
export const COMPLETION_LINES = [
  "That's all of them. This room is out of mysteries.",
  "You explored more of this desk than most people explore their own.",
];
