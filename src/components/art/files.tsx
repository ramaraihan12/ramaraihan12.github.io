import { type BatikKind, type BatikUriOptions, batikSvg, batikTileSize } from "./patterns";

/*
  Art that ships as .svg files instead of inside the page. Anything React renders on the server
  is written into the HTML twice, once as markup and once in the payload the page hydrates from,
  so the big still pieces are drawn once at build time into /art/*.svg by
  src/app/art/[name]/route.ts and the page only points at them.

  Server and build only: this pulls in the drawing code, which must not reach the browser.
*/

/* ---------- batik grounds ---------- */

type TileSpec = BatikUriOptions & { kind: BatikKind; scale: number };

/** Every batik ground the page uses as a background. Literal colours only, the same as tokens.css. */
export const BATIK_TILES = {
  // The work rail: kawung cloth behind a postcard with no screenshot. Soga-2 lines, nila-2 petals.
  "run-cloth": { kind: "kawung", ink: "#c4915a", ground: "#0f1a47", tint: "#16235c", scale: 0.42 },
  // The kepala between the AI and the web apps: soga ground, mori blades, malam (wax) lines.
  "web-kepala": { kind: "parang", ink: "#080e2b", ground: "#9c6633", tint: "#efe9dc", scale: 0.5 },
  // Around the photo: parang in nila and soga, with a turmeric wax line.
  "photo-frame": { kind: "parang", ink: "#f4b223", ground: "#0f1a47", tint: "#9c6633", scale: 0.4 },
  // The turmeric flood: kawung lines a little deeper than kunyit, on nothing.
  "answer-ground": { kind: "kawung", ink: "#e3a21a", ground: "none", scale: 1.5 },
  // The footer's hem: parang in soga and kunyit on malam.
  "footer-hem": { kind: "parang", ink: "#f4b223", ground: "#080e2b", tint: "#9c6633", scale: 0.25 },
} as const satisfies Record<string, TileSpec>;

export type BatikTileName = keyof typeof BATIK_TILES;

/**
 * One of the batik grounds: `css` for background-image, `size` for background-size (px) and the
 * spec it was drawn from.
 */
export function batikTile(name: BatikTileName) {
  const spec: TileSpec = BATIK_TILES[name];
  const url = `/art/batik-${name}.svg`;
  return { url, css: `url("${url}")`, size: batikTileSize(spec.kind, spec.scale), spec };
}

/* ---------- the files ---------- */

/** File name (with .svg) to a function that draws it. */
export const ART_FILES: Record<string, () => string> = {
  ...Object.fromEntries(
    (Object.keys(BATIK_TILES) as BatikTileName[]).map((name) => {
      const { kind, ...options } = BATIK_TILES[name] as TileSpec;
      return [`batik-${name}.svg`, () => batikSvg(kind, options)];
    }),
  ),
};
