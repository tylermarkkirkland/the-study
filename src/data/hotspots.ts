export type HotspotConfig = {
  id: string;
  // One or more case-insensitive substrings matched against Object3D.name. A node counts as part
  // of the hotspot if its name contains ANY of them. Most objects are one contiguously-named mesh
  // (a single string is enough), but some are exported from Blender as several meshes split by
  // material with no shared prefix — those need a list so hover and the silhouette glow cover the
  // whole object, not just the sub-meshes that happen to share the object's name.
  nodeNameMatch: string | string[];
  // aria-label, phrased as an action.
  label: string;
};

export const hotspots: HotspotConfig[] = [
  // The radio is exported as separate meshes per material with no common prefix: the outer dome is
  // "Shell", the stand is "Base", the lit dial is "Light", the tuning knobs are "Button", plus the
  // "Antenna" — only the baffle/grille/screen are actually named "Radio". Each of these substrings
  // is unique to the radio elsewhere in office.glb (verified — nothing else is named shell/base/
  // light/button/antenna), so matching them all is safe and makes the whole radio hoverable and
  // outlined. NB: "screen" is intentionally omitted — it would also match the monitor's screen
  // planes; the radio's own screen is already covered by "radio".
  { id: "radio", nodeNameMatch: ["radio", "shell", "base", "light", "button", "antenna"], label: "Play radio" },
  { id: "journal", nodeNameMatch: "binder_notebook", label: "Sign the guestbook" },
  { id: "guitar", nodeNameMatch: "guitar", label: "Play the guitar" },
];
