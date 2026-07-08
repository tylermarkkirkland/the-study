export type JournalEntry = {
  title: string;
  body: string;
};

export const journalEntries: JournalEntry[] = [
  {
    title: "The screen that wouldn't sit still",
    body: `Tried three different ways to put the desktop on the monitor's actual screen before one stuck.

First I projected the screen mesh's own corners through the camera and took the bounding box. Looked fine head-on, fell apart the second there was any tilt — a tilted rectangle projects to a trapezoid, and a box just can't hold that shape.

Next I tried anchoring real DOM content to the screen's 3D point and always facing it toward the camera, like a sticker. That fixed the "paper-thin sliver" problem, but a flat sticker can't lean back the way a real monitor does, so it never quite matched.

What finally worked: four draggable corner handles in plain 2D, with a proper homography (a "square to quad" projection) computed from wherever they land. It doesn't care what shape the quad is. Should've started there.`,
  },
  {
    title: "A glow that wouldn't glow",
    body: `Spent an embarrassing amount of time convinced my own state management was broken.

Wanted a soft halo to fade in when you hover the radio. Wired it up with the same animation library used everywhere else in this project. The state was updating correctly — I could see it in the logs — but the glow just sat there at zero opacity like nothing had happened.

Turns out the HTML-anchoring helper I'm using renders its content into a completely separate render tree, off on its own, disconnected from the rest of the app. My animation library never got a chance to see it change.

Fix was simpler than the debugging: stop trying to animate a flat overlay, and instead put a real glowing object in the 3D scene itself, right at the radio's own position. Now the radio's own body naturally hides the middle of the glow and only the edges peek out. Looks better than the overlay ever did anyway.`,
  },
  {
    title: "Graybox was never the plan",
    body: `Keep having to remind myself: flat gray shapes are the scaffolding, not the destination.

It's tempting to treat "graybox everything" as a permanent style decision, especially once it starts looking clean and intentional. But the actual goal here was always a real, lit, three-dimensional room — something you could believe was sitting on an actual desk.

Good news is the two don't conflict as long as the window manager and the room stay decoupled, which they have been from the start. Swapping flat shapes for a real model didn't touch a single line of the OS logic. That boundary was worth holding onto.`,
  },
];
