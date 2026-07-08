export type DiscoveryConfig = {
  id: string;
  // The mysterious, in-voice teaser shown while undiscovered.
  hint: string;
  // What the line becomes once found — plain past-tense, the mystery resolved.
  foundLabel: string;
  // Hidden entries render as "???" until found — pure bait for completionists.
  hidden?: boolean;
};

// The Field Notes checklist. Order is display order: approachable mysteries
// first, hidden ones sunk to the bottom. Every id here must have a matching
// markFound(id) call at the moment the interaction actually happens — grep for
// the id string to find the wiring site.
export const discoveries: DiscoveryConfig[] = [
  {
    id: "radio-play",
    hint: "Something on the shelf still hums when it thinks no one's listening.",
    foundLabel: "The radio works. Keep clicking — it knows more than one station.",
  },
  {
    id: "guestbook-sign",
    hint: "There's a book on the desk. People keep leaving marks in it.",
    foundLabel: "Signed the book on the desk.",
  },
  {
    id: "guitar-play",
    hint: "Six strings in the corner, probably still in tune. Probably.",
    foundLabel: "Played the guitar. The neighbors have opinions.",
  },
  {
    id: "game-wave",
    hint: "Someone installed a game on this computer. The high score is still standing.",
    foundLabel: "Cleared a wave. The high score is nervous.",
  },
  {
    id: "terminal-secret",
    hint: "The computer answers to more commands than it admits to.",
    foundLabel: "Found one of the terminal's secrets.",
  },
  {
    id: "icon-trash",
    hint: "???",
    foundLabel: "Threw something away. (It can come back — check the Trash.)",
    hidden: true,
  },
];
