// The "files" that live in the Trash. Each is a plain text document opened by
// the generic DocumentViewer app. The `id` matches the document's desktop-icon
// id in desktopIcons.ts (appType "document"), so the same id threads through the
// window (as documentId), the Trash list, and restore/trash state.
//
// Documents default to sitting in the Trash (see DesktopIconsContext's
// restoredDocs model) and are all restorable to the desktop via "Put Back".
export type TrashDocument = {
  id: string;
  // Shown as the window title and the desktop/Trash label.
  fileName: string;
  // Body paragraphs, rendered monospace like a .txt file.
  body: string[];
  // Optional closing line (e.g. a signature), shown pushed to the bottom.
  signoff?: string;
  // Optional discovery id marked found when this document is opened. Only the
  // DO_NOT_OPEN.txt easter egg sets this; the boring filler files leave it off.
  discovery?: string;
};

export const trashDocuments: TrashDocument[] = [
  {
    id: "doc-grocery",
    fileName: "grocery_list.txt",
    body: [
      "milk",
      "eggs",
      "bread (the gluten free kind)",
      "fruit",
      "chocolate peanut butter ice cream",
      "pens",
    ],
  },
  {
    id: "doc-standup",
    fileName: "standup_notes.txt",
    body: [
      "Standup — Tuesday",
      "Yesterday: moved the button three pixels. Moved it back.",
      "Today: meetings about the meeting.",
      "Blockers: the meeting.",
      "Action item: schedule a follow-up to discuss the action items.",
    ],
  },
  {
    id: "doc-donotopen",
    fileName: "DO_NOT_OPEN.txt",
    discovery: "trash-file",
    signoff: "— the desk",
    body: [
      "Oh. You actually opened it.",
      "You went through my Trash, found the one file labeled DO_NOT_OPEN, and opened it. Bold.",
      "There's nothing in here. A grocery list. A failed resume. Some useless notes I took. Nothing worth deleting twice.",
      "...fine. You found something anyway. Check your Notes. That's on you now.",
    ],
  },
  {
    id: "doc-resume",
    fileName: "resume_draft_v2.txt",
    body: [
      "TYLER KIRKLAND — draft 2",
      "UX Product Designer",
      "Objective: Build more cool stuff",
      "Experience: yes.",
      "Skills: Building cool stuff",
      "Summary: come back and finish this part",
    ],
  },
];

export function getTrashDocument(id: string | undefined): TrashDocument | undefined {
  if (!id) return undefined;
  return trashDocuments.find((doc) => doc.id === id);
}
