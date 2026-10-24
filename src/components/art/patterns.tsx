import { dot, num, nums, petal, type Pt, smooth, taper, wavy } from "./draw";
import { hash, rng, wobble } from "./rng";

/*
  Three batik motifs, drawn from their real construction rather than traced:

  - kawung: four petals (the cross-section of an aren palm fruit) around a centre, laid on a
    square grid so each petal runs from a cell's centre to its corner. The corners become
    centres too, and the gaps between petals turn into four-pointed stars.
  - parang: diagonal bands of S-shaped blades, separated by a strip of mlinjon, the small
    diamonds named after melinjo seeds.
  - truntum: small star-flowers on a half-drop grid with dots scattered between them, like a
    night sky. Truntum means "to bloom again".

  Every line comes from a seeded jitter, so the motif has a hand in it but draws the same on
  the server and in the browser. Each tile repeats seamlessly: anything that crosses an edge is
  drawn again on the other side, with the same wobble.
*/

export type BatikKind = "kawung" | "parang" | "truntum";

export const BATIK_KINDS: readonly BatikKind[] = ["kawung", "parang", "truntum"];

export type BatikColors = {
  /** The wax line. Defaults to mori, the cotton. */
  ink?: string;
  /** The cloth behind the motif. "none" leaves it transparent. Defaults to nila. */
  ground?: string;
  /** Optional dye for the petal and blade bodies, e.g. soga or kunyit. Off by default. */
  tint?: string;
};

type Paint = "line" | "fine" | "fill" | "tint";
type Layer = { paint: Paint; d: string };
type Geometry = {
  /** Tile width and height, in tile units (1 unit = 1px at scale 1). */
  size: number;
  /** Shapes reused through <use>, keyed by a short name. */
  parts: Record<string, Layer[]>;
  /** <use> tags, with "#@" standing for the id prefix. */
  uses: string[];
  layers: Layer[];
};

const STROKE = { kawung: [1.5, 0.85], parang: [1.7, 0.9], truntum: [1.25, 0.8] } as const;

/* ---------- kawung ---------- */

function kawung(seed: number): Geometry {
  const C = 60;
  const P = C * 2;
  const r = rng(seed);
  const half = (C * Math.SQRT2) / 4; // centre to the middle of a petal
  const a = half * 0.86;
  const b = a * 0.62;
  let outer = "";
  let inner = "";
  let fill = "";

  for (let j = 0; j < 2; j++) {
    for (let i = 0; i < 2; i++) {
      const cx = i * C + C / 2;
      const cy = j * C + C / 2;
      for (let q = 0; q < 4; q++) {
        const ang = Math.PI / 4 + (q * Math.PI) / 2 + wobble(r, 0.035);
        const px = cx + Math.cos(ang) * half + wobble(r, 0.5);
        const py = cy + Math.sin(ang) * half + wobble(r, 0.5);
        outer += petal(px, py, a, b, ang, r, { drift: 0.045, tip: 0.4 });
        inner += petal(px, py, a * 0.56, b * 0.4, ang + wobble(r, 0.06), r, { drift: 0.07, tip: 0.34 });
        // One cecek near the outer tip of each petal, inside it.
        const t = half + a * 0.74;
        fill += dot(cx + Math.cos(ang) * t, cy + Math.sin(ang) * t, 0.9 + r() * 0.35);
      }
    }
  }

  // The meeting points (cell centres and corners) get a seed dot, the gaps a small star.
  // Both are seeded by their position modulo the tile, so copies across an edge match.
  let stars = "";
  for (let j = 0; j <= 4; j++) {
    for (let i = 0; i <= 4; i++) {
      const x = (i * C) / 2;
      const y = (j * C) / 2;
      const pr = rng(hash(`k${seed}:${x % P},${y % P}`));
      const ox = wobble(pr, 0.4);
      const oy = wobble(pr, 0.4);
      if ((i + j) % 2 === 0) {
        fill += dot(x + ox, y + oy, 1.7 + pr() * 0.4);
      } else {
        const s = 5.4 + pr() * 0.8;
        const k = 0.9;
        const tips: Pt[] = [
          [x + ox, y + oy - s],
          [x + ox + s, y + oy],
          [x + ox, y + oy + s],
          [x + ox - s, y + oy],
        ];
        stars += `M${nums(tips[0])}`;
        for (let n = 1; n <= 4; n++) {
          const tip = tips[n % 4];
          const cx = x + ox + Math.sign(tips[n - 1][0] + tip[0] - 2 * (x + ox)) * k;
          const cy = y + oy + Math.sign(tips[n - 1][1] + tip[1] - 2 * (y + oy)) * k;
          stars += `Q${nums([cx, cy, ...tip])}`;
        }
        stars += "Z";
        fill += dot(x + ox, y + oy, 0.95);
      }
    }
  }

  return {
    size: P,
    parts: {},
    uses: [],
    layers: [
      { paint: "tint", d: outer },
      { paint: "line", d: outer },
      { paint: "fine", d: inner + stars },
      { paint: "fill", d: fill },
    ],
  };
}

/* ---------- parang ---------- */

/*
  Drawn in band space, (u, v) from 0 to 100, u along the band and v across it, then laid on
  the page at 45 degrees. A 120 tile holds two cells: the lattice vectors are (60, 60) along
  the band and (-60, 60) across, so (120, 0) and (0, 120) land back on the lattice and the tile
  repeats. The two cells in a tile get different wobbles.
*/
function parangCell(r: ReturnType<typeof rng>): Layer[] {
  let outline = "";
  let spine = "";
  let body = "";
  let fill = "";
  const vc = 37;
  const h = 30;
  const w = 20;
  const lean = 0;
  for (const uc of [25, 75]) {
    const local: Pt[] = [
      [0.7, -0.55],
      [0.56, -0.92],
      [-0.12, -1],
      [-0.8, -0.72],
      [-0.6, -0.25],
      [0, 0],
      [0.6, 0.25],
      [0.8, 0.72],
      [0.12, 1],
      [-0.56, 0.92],
      [-0.7, 0.55],
    ];
    const pts: Pt[] = local.map(([x, y]) => {
      const vx = x * w + wobble(r, 0.9);
      const vy = y * h + wobble(r, 0.9);
      return [uc + vx + vy * lean, vc + vy];
    });
    const blade = taper(pts, (t) => 4 + 9 * Math.sin(Math.PI * t) ** 0.9, 13);
    outline += blade;
    body += blade;
    spine += smooth(pts.slice(2, -2));
    // Wax drops where the canting starts and lifts.
    fill += dot(pts[0][0], pts[0][1], 2.2 + r() * 0.5) + dot(pts[10][0], pts[10][1], 2.2 + r() * 0.5);
    // Cecek along the inside of each bowl.
    for (const [x, y] of [
      [0.08, -0.5],
      [-0.12, 0.5],
    ]) {
      const s = Math.sign(y);
      for (let k = 0; k < 3; k++) {
        const vy = (y + s * k * 0.13) * h;
        fill += dot(uc + (x - s * k * 0.12) * w + vy * lean, vc + vy, 0.85 + r() * 0.3);
      }
    }
  }

  // The mlinjon strip: two rules with diamonds between, ends pinned so cells join up.
  const rule = (v: number) => smooth(wavy([0, v], [100, v], r, 0.7, 5));
  const strip = rule(76) + rule(97);
  for (const uc of [0, 50]) {
    const vm = 86.5 + wobble(r, 0.4);
    const du = 9 + wobble(r, 0.6);
    const dv = 7 + wobble(r, 0.4);
    const pts: Pt[] = [
      [uc, vm - dv],
      [uc + du, vm],
      [uc, vm + dv],
      [uc - du, vm],
    ];
    fill += `M${nums(pts[0])}`;
    for (let k = 1; k <= 4; k++) {
      const p = pts[k % 4];
      const q = pts[k - 1];
      // Sides bow out a touch, like a seed.
      const mx = (p[0] + q[0]) / 2 + Math.sign(p[0] + q[0] - 2 * uc) * 1.2;
      const my = (p[1] + q[1]) / 2 + Math.sign(p[1] + q[1] - 2 * vm) * 1.2;
      fill += `Q${nums([mx, my, ...p])}`;
    }
    fill += "Z";
    fill += dot(uc + 25, vm, 1.3 + r() * 0.3);
  }

  return [
    { paint: "tint", d: body },
    { paint: "line", d: outline },
    { paint: "fine", d: spine + strip },
    { paint: "fill", d: fill },
  ];
}

function parang(seed: number): Geometry {
  const r = rng(seed);
  const s = 60;
  const k = s / 100;
  const uses: string[] = [];
  for (let i = -2; i <= 2; i++) {
    for (let j = -2; j <= 2; j++) {
      const ox = s * (i - j);
      const oy = s * (i + j);
      // The cell is a diamond from (ox - 60, oy) to (ox + 60, oy + 120); skip it if it's off the tile.
      if (ox + s + 24 < 0 || ox - s - 24 > 2 * s || oy + 2 * s + 24 < 0 || oy - 24 > 2 * s) continue;
      const variant = (((i + j) % 2) + 2) % 2;
      uses.push(`<use href="#@-p${variant}" transform="matrix(${[k, k, -k, k, ox, oy].map((v) => num(v, 2)).join(",")})"/>`);
    }
  }
  return { size: 2 * s, parts: { p0: parangCell(r), p1: parangCell(r) }, uses, layers: [] };
}

/* ---------- truntum ---------- */

function truntumFlower(r: ReturnType<typeof rng>): Layer[] {
  let petals = "";
  let fill = "";
  for (let n = 0; n < 8; n++) {
    const long = n % 2 === 0;
    const ang = (n * Math.PI) / 4 + wobble(r, 0.07);
    const r0 = 3.3;
    const r1 = (long ? 9.2 : 6) + wobble(r, 0.5);
    const mid = (r0 + r1) / 2;
    petals += petal(Math.cos(ang) * mid, Math.sin(ang) * mid, (r1 - r0) / 2, long ? 1.55 : 1.15, ang, r, {
      drift: 0.08,
      tip: 0.32,
    });
  }
  const ring = dot(wobble(r, 0.2), wobble(r, 0.2), 2.1 + r() * 0.3);
  fill += dot(0, 0, 0.95);
  // Short canting flicks between the long petals, out at the tips.
  for (let n = 0; n < 4; n++) {
    const ang = Math.PI / 4 + (n * Math.PI) / 2 + wobble(r, 0.1);
    fill += dot(Math.cos(ang) * 8.4, Math.sin(ang) * 8.4, 0.75 + r() * 0.25);
  }
  return [
    { paint: "tint", d: petals },
    { paint: "line", d: petals },
    { paint: "fine", d: ring },
    { paint: "fill", d: fill },
  ];
}

function truntum(seed: number): Geometry {
  const P = 96;
  const r = rng(seed);
  const parts = { t0: truntumFlower(r), t1: truntumFlower(r), t2: truntumFlower(r) };
  const uses: string[] = [];
  const place = (x: number, y: number, key: string, extra: number) => {
    // Draw again across any edge the flower touches, so the tile wraps.
    for (const dx of [-P, 0, P]) {
      for (const dy of [-P, 0, P]) {
        const fx = x + dx;
        const fy = y + dy;
        if (fx < -extra || fx > P + extra || fy < -extra || fy > P + extra) continue;
        uses.push(key.replace("@x", nums([fx], 1)).replace("@y", nums([fy], 1)));
      }
    }
  };
  let fill = "";
  for (let c = 0; c < 4; c++) {
    for (let k = 0; k < 2; k++) {
      const x = 12 + c * 24 + wobble(r, 1.6);
      const y = (c % 2 ? 0 : 24) + k * 48 + wobble(r, 1.6);
      const variant = (c * 2 + k) % 3;
      const rot = Math.round(r() * 45);
      const sc = (0.86 + r() * 0.24).toFixed(2);
      place(x, y, `<use href="#@-t${variant}" transform="translate(@x @y) rotate(${rot}) scale(${sc})"/>`, 12);
    }
  }
  // Loose dots between the flowers, the scattered stars.
  for (let c = 0; c < 4; c++) {
    for (let k = 0; k < 4; k++) {
      const x = c * 24 + wobble(r, 2.5);
      const y = 12 + k * 24 + wobble(r, 2.5);
      const rad = 0.7 + r() * 0.55;
      for (const dx of [0, P]) {
        if (dx && x > rad) continue;
        fill += dot(x + dx, y, rad);
      }
    }
  }
  return { size: P, parts, uses, layers: [{ paint: "fill", d: fill }] };
}

/* ---------- rendering ---------- */

const BUILD = { kawung, parang, truntum } as const;
const SEED = { kawung: 11, parang: 23, truntum: 5 } as const;
const cache = new Map<string, Geometry>();

function geometry(kind: BatikKind, seed: number = SEED[kind]): Geometry {
  const key = `${kind}:${seed}`;
  let g = cache.get(key);
  if (!g) {
    g = BUILD[kind](seed);
    cache.set(key, g);
  }
  return g;
}

function layerMarkup(kind: BatikKind, layers: Layer[], colors: { ink: string; tint?: string }) {
  const [line, fine] = STROKE[kind];
  return layers
    .map(({ paint, d }) => {
      if (!d) return "";
      switch (paint) {
        case "tint":
          return colors.tint ? `<path d="${d}" fill="${colors.tint}"/>` : "";
        case "fill":
          return `<path d="${d}" fill="${colors.ink}"/>`;
        default:
          return `<path d="${d}" fill="none" stroke="${colors.ink}" stroke-width="${paint === "line" ? line : fine}" stroke-linecap="round" stroke-linejoin="round"/>`;
      }
    })
    .join("");
}

type Built = { size: number; defs: string; body: string };

function build(kind: BatikKind, colors: BatikColors, prefix: string, seed?: number): Built {
  const g = geometry(kind, seed);
  const c = {
    ink: colors.ink ?? "#efe9dc",
    ground: colors.ground ?? "#0f1a47",
    tint: colors.tint,
  };
  const defs = Object.entries(g.parts)
    .map(([key, layers]) => `<g id="${prefix}-${key}">${layerMarkup(kind, layers, c)}</g>`)
    .join("");
  const ground = c.ground === "none" || c.ground === "transparent" ? "" : `<rect width="${g.size}" height="${g.size}" fill="${c.ground}"/>`;
  const body = ground + g.uses.map((u) => u.replace("#@", `#${prefix}`)).join("") + layerMarkup(kind, g.layers, c);
  return { size: g.size, defs, body };
}

/** Tile size in CSS pixels at a given scale, for background-size or layout math. */
export function batikTileSize(kind: BatikKind, scale = 1) {
  return geometry(kind).size * scale;
}

/**
 * Markup for one <pattern> plus the shapes it reuses, to drop inside an SVG's <defs> (with
 * dangerouslySetInnerHTML). Colors may be CSS custom properties.
 */
export function batikPatternMarkup(kind: BatikKind, id: string, { scale = 1, seed, ...colors }: BatikColors & { scale?: number; seed?: number } = {}) {
  const { size, defs, body } = build(kind, colors, id, seed);
  return `${defs}<pattern id="${id}" width="${size}" height="${size}" patternUnits="userSpaceOnUse" patternTransform="scale(${scale})">${body}</pattern>`;
}

export type BatikDefsProps = BatikColors & {
  /** Multiplies the tile: 1 is a 120px kawung or parang tile and a 96px truntum tile. */
  scale?: number;
  /** Added to the ids, for a second set in other colors: "mori" gives "batik-kawung-mori". */
  idSuffix?: string;
  /** Which patterns to define. All three by default. */
  kinds?: readonly BatikKind[];
  /** A different hand: the same motif with other wobbles. */
  seed?: number;
};

/**
 * A hidden <svg> with the three batik patterns as <pattern>s, for `fill="url(#batik-kawung)"`
 * anywhere on the page. Ids are batik-kawung, batik-parang and batik-truntum (plus idSuffix).
 * Colors can be CSS custom properties here, since the patterns live in the page.
 */
export function BatikDefs({
  ink = "var(--mori, #efe9dc)",
  ground = "var(--nila, #0f1a47)",
  tint,
  scale = 1,
  idSuffix,
  kinds = BATIK_KINDS,
  seed,
}: BatikDefsProps) {
  const markup = kinds
    .map((kind) => batikPatternMarkup(kind, `batik-${kind}${idSuffix ? `-${idSuffix}` : ""}`, { ink, ground, tint, scale, seed }))
    .join("");
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="0"
      height="0"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
    >
      <defs dangerouslySetInnerHTML={{ __html: markup }} />
    </svg>
  );
}

export type BatikUriOptions = BatikColors & { scale?: number; seed?: number };

/** One tile as a standalone SVG document. Colors must be literal (a data URI can't see CSS variables). */
export function batikSvg(kind: BatikKind, { ink, ground, tint, scale = 1, seed }: BatikUriOptions = {}) {
  const { size, defs, body } = build(kind, { ink, ground, tint }, "b", seed);
  const px = Math.round(size * scale * 100) / 100;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${size} ${size}"><defs>${defs}</defs>${body}</svg>`;
}

/**
 * The tile as a CSS-ready `url("data:image/svg+xml,...")`, for background-image. It repeats
 * seamlessly at its own size. Colors must be literal values like "#efe9dc" or "rgb(...)".
 *
 *   style={{ backgroundImage: batikDataUri("parang", { ink: "#f4b223", ground: "#0f1a47" }) }}
 */
export function batikDataUri(kind: BatikKind, options: BatikUriOptions = {}) {
  const svg = batikSvg(kind, options)
    .replace(/"/g, "'")
    .replace(/[\r\n%#<>?[\\\]^`{|}]/g, encodeURIComponent);
  return `url("data:image/svg+xml,${svg}")`;
}
