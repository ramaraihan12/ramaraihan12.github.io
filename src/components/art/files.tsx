import type { CSSProperties } from "react";
import { aiProjects, otherProjects, webProjects } from "@/content/projects";
import { stack } from "@/content/stack";
import { svgMarkup } from "./markup";
import { type BatikKind, type BatikUriOptions, batikSvg, batikTileSize } from "./patterns";
import { Postcard, type PostcardTone } from "./postcard";
import { hash } from "./rng";
import { CapFramePaths, capFrame } from "./stamp";

/*
  Art that ships as .svg files instead of inside the page. Anything React renders on the server
  is written into the HTML twice, once as markup and once in the payload the page hydrates from,
  so the big still pieces (the batik grounds, the postcards, the stamp frames) are drawn once
  at build time into /art/*.svg by src/app/art/[name]/route.ts and the page only points at them.

  Server and build only: this pulls in the drawing code, which must not reach the browser.
*/

const SVG_NS = 'xmlns="http://www.w3.org/2000/svg"';

/**
 * The page's dyes (tokens.css), for files that colour with var(--nila) and friends. A file
 * can't see the page's CSS, so it brings its own copy. Keep in step with tokens.css.
 */
const TOKENS = {
  "--nila": "#0f1a47",
  "--nila-2": "#16235c",
  "--mori": "#efe9dc",
  "--pudar": "#9aa3c7",
  "--kunyit": "#f4b223",
  "--soga": "#9c6633",
  "--soga-2": "#c4915a",
  "--malam": "#080e2b",
} as CSSProperties;

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

/* ---------- postcards ---------- */

/** Every project on the page gets a card, in the tones the page shows them in. */
const POSTCARDS: { name: string; tone: PostcardTone }[] = [...aiProjects, ...webProjects, ...otherProjects].map(({ name }) => ({
  name,
  tone: "mori",
}));

const postcardFile = (name: string, tone: PostcardTone) => `postcard-${tone}-${name}.svg`;

function postcardSvg(name: string, tone: PostcardTone) {
  // The page's own attributes (class, aria-hidden) mean nothing inside an image.
  return svgMarkup(<Postcard name={name} tone={tone} style={TOKENS} />).replace(
    /^<svg viewBox="([^"]*)"[^>]*? style=/,
    `<svg ${SVG_NS} width="240" height="180" viewBox="$1" style=`,
  );
}

export type PostcardImageProps = {
  name: string;
  tone?: PostcardTone;
  className?: string;
};

/**
 * A project's postcard as an image from /art. Decorative and lazy: every card sits below the
 * fold. Only names and tones in POSTCARDS have a file: every project, in mori.
 */
export function PostcardImage({ name, tone = "mori", className }: PostcardImageProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a static export has no image server, and this is an SVG
    <img
      src={`/art/${postcardFile(name, tone)}`}
      className={className ? `art-postcard ${className}` : "art-postcard"}
      data-tone={tone}
      alt=""
      aria-hidden="true"
      width={240}
      height={180}
      loading="lazy"
      decoding="async"
      draggable={false}
    />
  );
}

/* ---------- cap stamps ---------- */

/** Stamps whose frames live in the sprite: every tool on the stack. */
const STAMPS = stack.flatMap((group) => group.items);
const STAMP_SET = new Set(STAMPS);
const stampId = (seed: string) => `c${hash(seed).toString(36)}`;

/** The frame for a rect stamp with this seed, as a fragment of the shared sprite. Undefined if it isn't in it. */
export function capStampHref(seed: string) {
  return STAMP_SET.has(seed) ? `/art/cap-stamps.svg#${stampId(seed)}` : undefined;
}

function capStampSprite() {
  const frames = STAMPS.map((seed) => {
    const { outer, inner } = capFrame(seed, "rect");
    return (
      <g key={seed} id={stampId(seed)}>
        <CapFramePaths outer={outer} inner={inner} />
      </g>
    );
  });
  return `<svg ${SVG_NS} viewBox="0 0 100 40"><defs>${svgMarkup(frames)}</defs></svg>`;
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
  ...Object.fromEntries(POSTCARDS.map(({ name, tone }) => [postcardFile(name, tone), () => postcardSvg(name, tone)])),
  "cap-stamps.svg": capStampSprite,
};
