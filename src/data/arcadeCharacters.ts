// The Arcade cast. Swap any of these and the game re-skins itself — no game
// code changes needed. Emoji render directly; when Tyler's real characters are
// ready, this is the only file to touch (images would extend this to
// { kind: "emoji" | "image", src } — deliberately not built until needed).
export type ArcadeCharacters = {
  /** The ship you fly. */
  player: string;
  /** One emoji per formation row, top row first. Deeper waves use more rows. */
  enemyRows: string[];
  /** The wave-5 boss. Drawn big, takes a beating, shoots from three spots. */
  boss: string;
  playerBulletColor: string;
  enemyBulletColor: string;
};

export const ARCADE_CHARACTERS: ArcadeCharacters = {
  player: "🚀",
  enemyRows: ["👽", "🛸", "👾"],
  boss: "👹",
  playerBulletColor: "#4ade80",
  enemyBulletColor: "#ff5f57",
};
