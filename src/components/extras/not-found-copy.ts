// Kept beside the 404 cloth, not in content/copy.ts, so the home page's bundle doesn't carry it.
/** The 404 page (src/app/not-found.tsx), a blank cloth to draw on in wax and dip in dye. */
export const notFoundCopy = {
  title: "Not found",
  eyebrow: "404",
  /** The path goes after this, in mono. Before the page knows it, `pathFallback` stands in. */
  heading: "Nothing in the index matches",
  pathFallback: "that path",
  lede: "That address isn't one of my notes. Here's a blank cloth instead.",
  canvasLabel: "A blank cloth. Draw on it with the pointer, then press Dip.",
  hint: {
    blank: "Press and drag to draw in wax.",
    waxed: "Wax keeps the dye out. Dip when you're ready.",
    dipping: "The cloth is in the dye.",
    dyed: "The dye took everywhere except under the wax.",
    plain: "No wax, so the dye took all of it.",
  },
  dip: "Dip",
  kawung: "Draw a kawung for me",
  again: "Wax again",
  home: "Back to the start",
  announcePlain: "No wax, so the whole cloth took the dye.",
  announceDyed: "The cloth is dyed. The wax lines stayed pale.",
} as const;
