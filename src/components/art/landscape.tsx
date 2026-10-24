import type { CSSProperties, ReactNode, SVGProps } from "react";
import { dot, nums, type Pt, smooth, taper } from "./draw";
import { hash, rng, wobble } from "./rng";

/*
  Merbabu with Merapi behind it, the way they look from Salatiga: Merbabu big and broad with a
  lumpy summit ridge, Merapi a steeper cone peeking over its left shoulder with a little smoke,
  Telomoyo a dome off to the right, then foothills, a treeline and rice terraces up close.

  Far layers are mixed toward the haze (the horizon color), near ones toward the ink, which is
  all the atmospheric perspective there is. Each layer is a <g data-depth> from 0 (sky) to 1
  (foreground), so a scene can parallax it: translate each layer by depth × some distance.
*/

export const LANDSCAPE_SIZE = { width: 1600, height: 700 } as const;
const W = LANDSCAPE_SIZE.width;
const H = LANDSCAPE_SIZE.height;

export type LandscapeSun = {
  /** 0 to 1 across the width. */
  x: number;
  /** 0 to 1 down the height. The ridge is around 0.66. */
  y: number;
  visible?: boolean;
  /** Radius in viewBox units (the box is 1600 × 700). Default 24. */
  r?: number;
};

export type LandscapeProps = {
  /** Sky gradient stops from top to horizon. skyAt(date).stops fits here. Default: night. */
  sky?: readonly string[];
  /** The color distance fades into. Default: the last sky stop. */
  haze?: string;
  /** The nearest layer's color. Default: --malam, the night blue darker than nila. */
  ink?: string;
  /** Where the turmeric dot sits. skyAt(date).sun fits here. Leave out for no sun. */
  sun?: LandscapeSun | null;
  sunColor?: string;
  /** Extra SVG drawn in the sun's layer (behind the mountains), in viewBox units. */
  sunSlot?: ReactNode;
  /** 0 to 1. skyAt(date).stars fits here. */
  stars?: number;
  /** Merapi's smoke. On by default. */
  plume?: boolean;
  /** "xMidYMax slice" by default: fills the box, keeps the ground, crops the sides. */
  preserveAspectRatio?: string;
  /**
   * Where the drawing's shapes come from. "inline" (default) draws them here. Two landscapes on
   * one page can share them, since the mountains are the same in both: one "define"s them
   * (with ids, in its defs) and the other "reuse"s them through <use>, so the page carries the
   * paths once. A "reuse" landscape draws nothing without a "define" one on the page.
   */
  shapes?: LandscapeShapes;
  className?: string;
  style?: CSSProperties;
  /** Prefix for the gradient ids. Derived from the colors when left out. */
  id?: string;
};

export type LandscapeShapes = "inline" | "define" | "reuse";

const NIGHT = ["#050a22", "#0b1438", "#1b2766"];

/* ---------- geometry, built once ---------- */

const r = rng(2930);
const rough = (pts: Pt[], amount: number): Pt[] =>
  pts.map(([x, y], i): Pt => (i === 0 || i === pts.length - 1 ? [x, y] : [x + wobble(r, amount), y + wobble(r, amount)]));
// Closed just outside the box, so a stroke on the silhouette never shows on the sides.
const ground = (ridge: Pt[]) =>
  `${smooth(ridge, false, 0)}L${W + 20} ${ridge[ridge.length - 1][1]}V${H + 20}H-20V${ridge[0][1]}Z`;

// Merapi: steeper, a notched crater top. Mostly hidden by Merbabu.
const MERAPI: Pt[] = rough(
  [
    [0, 598],
    [140, 560],
    [290, 500],
    [410, 430],
    [490, 372],
    [540, 334],
    [568, 312],
    [586, 303],
    [597, 309],
    [606, 300],
    [622, 304],
    [646, 322],
    [700, 366],
    [790, 432],
    [900, 500],
    [1000, 560],
  ],
  2,
);

// Merbabu: broad, several humps along the summit ridge, a long north ridge to the right.
const MERBABU: Pt[] = rough(
  [
    [260, 650],
    [400, 596],
    [520, 532],
    [612, 466],
    [690, 398],
    [758, 338],
    [812, 296],
    [852, 272],
    [880, 266],
    [898, 270],
    [918, 252],
    [944, 258],
    [972, 272],
    [1000, 268],
    [1034, 284],
    [1084, 318],
    [1150, 358],
    [1236, 400],
    [1330, 432],
    [1430, 452],
    [1520, 466],
    [1600, 478],
  ],
  2.5,
);

// Gullies down Merbabu's face, drawn like canting lines.
const GULLIES = [
  [
    [866, 280],
    [826, 330],
    [798, 392],
    [770, 446],
  ],
  [
    [902, 274],
    [884, 340],
    [872, 410],
    [866, 480],
  ],
  [
    [944, 266],
    [956, 330],
    [982, 400],
    [1004, 470],
  ],
  [
    [1006, 276],
    [1046, 330],
    [1098, 384],
    [1150, 430],
  ],
  [
    [776, 330],
    [730, 386],
    [690, 440],
  ],
] as Pt[][];

// Telomoyo on the right, foothills in front of Merbabu.
const RIDGE: Pt[] = rough(
  [
    [0, 642],
    [180, 616],
    [360, 604],
    [540, 612],
    [720, 594],
    [900, 572],
    [1040, 548],
    [1160, 512],
    [1250, 478],
    [1318, 462],
    [1380, 460],
    [1450, 474],
    [1530, 500],
    [1600, 512],
  ],
  3,
);

// The near hills, with a treeline of round crowns along parts of the top.
const HILLS: Pt[] = [
  [0, 606],
  [200, 592],
  [380, 606],
  [560, 596],
  [760, 612],
  [960, 598],
  [1150, 606],
  [1330, 586],
  [1480, 592],
  [1600, 584],
];

/** y on a ridge at x, by smooth interpolation between its points. */
function yAt(ridge: Pt[], x: number) {
  for (let i = 0; i < ridge.length - 1; i++) {
    const [x0, y0] = ridge[i];
    const [x1, y1] = ridge[i + 1];
    if (x <= x1) {
      const t = (x - x0) / (x1 - x0);
      return y0 + (y1 - y0) * (1 - Math.cos(Math.PI * t)) * 0.5;
    }
  }
  return ridge[ridge.length - 1][1];
}

function treeline() {
  let d = `M0 ${H}L0 ${Math.round(yAt(HILLS, 0))}`;
  const isOpen = (x: number) => Math.sin(x / 150) + Math.sin(x / 53) > 0.9;
  let x = 0;
  let lastPoint = 0;
  while (x < W) {
    const step = 12 + r() * 22;
    const nx = Math.min(W, x + step);
    const y = yAt(HILLS, nx);
    // Some stretches are open field, the rest a row of crowns, now and then a tall one.
    if (isOpen(nx)) {
      // Open ground only needs a point every so often, and where the field ends.
      if (nx - lastPoint >= 70 || !isOpen(nx + 30) || nx === W) {
        d += `L${nums([nx, y + 3], 0)}`;
        lastPoint = nx;
      }
    } else {
      const rx = Math.round(step * (0.5 + r() * 0.15));
      const ry = Math.round(rx * (r() < 0.15 ? 2.2 : 0.8 + r() * 0.5));
      d += `A${rx} ${ry} 0 0 1 ${nums([nx, y - r() * 6], 0)}`;
      lastPoint = nx;
    }
    x = nx;
  }
  return `${d}L${W} ${H}Z`;
}

// The foreground: a terraced slope on the left, flat sawah to the right.
const FRONT: Pt[] = [
  [0, 540],
  [90, 532],
  [180, 540],
  [290, 562],
  [400, 594],
  [520, 624],
  [660, 646],
  [820, 660],
  [1000, 662],
  [1160, 656],
  [1300, 644],
  [1420, 630],
  [1520, 620],
  [1600, 616],
];

function terraces() {
  let d = "";
  for (let k = 1; k <= 6; k++) {
    const end = 640 - k * 56;
    const pts: Pt[] = [];
    for (let x = -10; x <= end; x += 110) {
      pts.push([x, yAt(FRONT, Math.max(0, x)) + k * 15 + k * k * 0.9 + wobble(r, 1.5)]);
    }
    pts.push([end, yAt(FRONT, end) + k * 15 + k * k * 0.9 + 4]);
    d += smooth(pts, false, 0);
  }
  // Sawah on the flat: long low lines, closer together further back.
  for (let k = 0; k < 4; k++) {
    const y = 672 + k * k * 4 + k * 4;
    d += smooth(
      [
        [840 + k * 30, y + wobble(r, 1)],
        [1100, y - 2 + wobble(r, 1)],
        [1350, y + wobble(r, 1)],
        [1610, y - 3],
      ],
      false,
      0,
    );
  }
  return d;
}

/** A coconut palm: a leaning, tapering trunk and a crown of drooping fronds. */
function palm(x: number, y: number, h: number, lean: number) {
  const top: Pt = [x + lean, y - h];
  const trunk = `M${x} ${y + 4}Q${nums([x - lean * 0.1, y - h * 0.5, ...top], 0)}`;
  let fronds = "";
  for (const [dx, dy] of [
    [-50, 18],
    [-40, -2],
    [-22, -18],
    [4, -24],
    [26, -14],
    [44, 4],
    [52, 22],
  ]) {
    const s = h / 110;
    fronds += `M${nums(top, 0)}Q${nums([top[0] + dx * s * 0.55, top[1] + (dy - 18) * s, top[0] + dx * s, top[1] + dy * s], 0)}`;
  }
  return { trunk, fronds };
}

/** A round tree: a few overlapping crowns. */
function crown(x: number, y: number, size: number) {
  return [
    [0, 0, 1],
    [-0.8, 0.35, 0.72],
    [0.85, 0.3, 0.78],
  ]
    .map(([dx, dy, k]) => dot(x + dx * size, y - size * 0.6 + dy * size, size * k, 0))
    .join("");
}

// Stars, as zero-length round-capped strokes so a whole sky fits in two paths.
const STARS = (() => {
  const sr = rng(77);
  let small = "";
  let big = "";
  const sparkles: Pt[] = [];
  for (let i = 0; i < 56; i++) {
    const x = Math.round(sr() * W);
    const y = Math.round(sr() ** 1.3 * H * 0.62);
    if (i % 9 === 0) {
      big += `M${x} ${y}h0`;
      if (i % 27 === 0) sparkles.push([x, y]);
    } else small += `M${x} ${y}h0`;
  }
  const sparkle = sparkles.map(([x, y]) => `M${x} ${y - 9}v18M${x - 9} ${y}h18`).join("");
  return { small, big, sparkle };
})();

/** A row of cecek (wax dots) following a ridge a little below its edge, where it's high enough. */
function cecek(ridge: Pt[], drop: number, below: number) {
  const pts = ridge.filter(([, y]) => y < below).map(([x, y]): Pt => [x, y + drop]);
  return smooth(pts.slice(1, -1), false, 0);
}

const GEOMETRY = (() => {
  const palms = [palm(214, 538, 118, 16), palm(1458, 632, 96, -12), palm(1530, 622, 70, 8)];
  return {
    merapi: ground(MERAPI),
    merbabu: ground(MERBABU),
    // Cecek following the summits. The wax outline itself is the silhouette's own stroke:
    // the closing edges it also strokes are hidden behind the nearer layers.
    merapiDots: cecek(MERAPI.slice(0, 13), 12, 470),
    merbabuDots: cecek(MERBABU, 13, 470),
    gullies: GULLIES.map((g) => smooth(rough(g, 3), false, 0)).join(""),
    ridge: ground(RIDGE),
    hills: treeline(),
    front: ground(FRONT),
    terraces: terraces(),
    trunks: palms.map((p) => p.trunk).join(""),
    fronds: palms.map((p) => p.fronds).join(""),
    crowns: crown(116, 536, 15) + crown(330, 566, 12) + crown(1384, 634, 11),
    plume: taper(
      [
        [604, 300],
        [597, 270],
        [606, 240],
        [630, 214],
        [668, 196],
        [716, 186],
        [780, 184],
      ],
      (t) => 6 + t * 44,
      10,
      0,
    ),
  };
})();

/** Every path the drawing uses, by name. The same for every Landscape. */
const SHAPES = { ...GEOMETRY, stars: STARS.small, bigStars: STARS.big, sparkle: STARS.sparkle };
type ShapeName = keyof typeof SHAPES;
const shapeId = (name: string) => `art-land-${name}`;

type ShapeProps = Omit<SVGProps<SVGPathElement>, "d" | "ref"> & { name: ShapeName; shapes: LandscapeShapes };

/** One of the shapes, painted here: as a path, or as a <use> of the shared one. */
function Shape({ name, shapes, ...paint }: ShapeProps) {
  return shapes === "inline" ? (
    <path d={SHAPES[name]} {...paint} />
  ) : (
    <use href={`#${shapeId(name)}`} {...(paint as SVGProps<SVGUseElement>)} />
  );
}

/* ---------- component ---------- */

const mix = (ink: string, haze: string, pct: number) => `color-mix(in oklab, ${ink} ${pct}%, ${haze})`;

/**
 * Layered silhouettes of Merbabu and Merapi as seen from Salatiga. Decorative (aria-hidden).
 * Size it with CSS; the drawing fills the box. Layers, back to front, with their data-depth:
 * sky 0, sun 0.05, merapi 0.15, merbabu 0.3, ridge 0.5, hills 0.72, front 1.
 */
export function Landscape({
  sky = NIGHT,
  haze,
  ink = "var(--malam, #0a1130)",
  sun,
  sunColor = "var(--kunyit, #f4b223)",
  sunSlot,
  stars = 0,
  plume = true,
  preserveAspectRatio = "xMidYMax slice",
  shapes = "inline",
  className,
  style,
  id,
}: LandscapeProps) {
  // Mountains fade toward the middle of the sky; the mist at their feet takes the horizon.
  const fade = haze ?? sky[Math.floor(sky.length / 2)];
  const glow = sky[sky.length - 1];
  const wax = mix("var(--mori, #efe9dc)", fade, 40);
  const uid = id ?? `ls${hash([...sky, fade, ink, sunColor].join()).toString(36)}`;
  const showSun = sun && sun.visible !== false;
  const sunR = sun?.r ?? 24;

  return (
    <svg
      className={className ? `art-landscape ${className}` : "art-landscape"}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio={preserveAspectRatio}
      aria-hidden="true"
      focusable="false"
      style={style}
    >
      <defs>
        <linearGradient id={`${uid}-sky`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={H}>
          {sky.map((c, i) => (
            <stop key={i} className="art-sky-stop" offset={sky.length > 1 ? (i / (sky.length - 1)) * 0.9 : 0} stopColor={c} />
          ))}
        </linearGradient>
        <linearGradient id={`${uid}-mist`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={glow} stopOpacity="0" />
          <stop offset="1" stopColor={glow} stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id={`${uid}-smoke`} gradientUnits="userSpaceOnUse" x1="604" y1="300" x2="780" y2="184">
          <stop offset="0" stopColor="var(--mori, #efe9dc)" stopOpacity="0.55" />
          <stop offset="1" stopColor="var(--mori, #efe9dc)" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${uid}-glow`}>
          <stop offset="0.3" stopColor={sunColor} stopOpacity="0.4" />
          <stop offset="1" stopColor={sunColor} stopOpacity="0" />
        </radialGradient>
        {shapes === "define"
          ? Object.entries(SHAPES).map(([name, d]) => <path key={name} id={shapeId(name)} d={d} />)
          : null}
      </defs>

      <g data-depth="0" data-layer="sky">
        <rect x={-W} y={-H} width={W * 3} height={H * 2} fill={`url(#${uid}-sky)`} />
        {stars > 0 ? (
          <g opacity={Math.min(1, stars)} stroke="var(--mori, #efe9dc)" strokeLinecap="round" fill="none">
            <Shape shapes={shapes} name="stars" strokeWidth="2.2" opacity="0.7" />
            <Shape shapes={shapes} name="bigStars" strokeWidth="3.6" />
            <Shape shapes={shapes} name="sparkle" strokeWidth="1.2" opacity="0.8" />
          </g>
        ) : null}
      </g>

      <g data-depth="0.05" data-layer="sun">
        {showSun ? (
          <g className="art-sun">
            <circle cx={sun.x * W} cy={sun.y * H} r={sunR * 3.2} fill={`url(#${uid}-glow)`} />
            <circle cx={sun.x * W} cy={sun.y * H} r={sunR} fill={sunColor} />
          </g>
        ) : null}
        {sunSlot}
      </g>

      <g data-depth="0.15" data-layer="merapi">
        {plume ? <Shape shapes={shapes} name="plume" fill={`url(#${uid}-smoke)`} opacity="0.7" /> : null}
        <Shape shapes={shapes} name="merapi" fill={mix(ink, fade, 38)} stroke={wax} strokeWidth="1.5" strokeOpacity="0.55" />
        <Shape
          shapes={shapes}
          name="merapiDots"
          fill="none"
          stroke={wax}
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeDasharray="0 9"
          opacity="0.55"
        />
      </g>

      <g data-depth="0.3" data-layer="merbabu">
        <Shape shapes={shapes} name="merbabu" fill={mix(ink, fade, 54)} stroke={wax} strokeWidth="1.6" strokeOpacity="0.6" />
        <g fill="none" stroke={wax} strokeLinecap="round">
          <Shape shapes={shapes} name="gullies" strokeWidth="1.6" opacity="0.4" />
          <Shape shapes={shapes} name="merbabuDots" strokeWidth="2.8" strokeDasharray="0 10" opacity="0.6" />
        </g>
        <rect y="470" width={W} height="160" fill={`url(#${uid}-mist)`} />
      </g>

      <g data-depth="0.5" data-layer="ridge">
        <Shape shapes={shapes} name="ridge" fill={mix(ink, fade, 70)} stroke={wax} strokeWidth="1.5" strokeOpacity="0.35" />
        <rect y="560" width={W} height="90" fill={`url(#${uid}-mist)`} opacity="0.6" />
      </g>

      <g data-depth="0.72" data-layer="hills">
        <Shape shapes={shapes} name="hills" fill={mix(ink, fade, 86)} />
      </g>

      <g data-depth="1" data-layer="front" fill={ink}>
        <Shape shapes={shapes} name="front" />
        <Shape shapes={shapes} name="crowns" />
        <Shape shapes={shapes} name="trunks" fill="none" stroke={ink} strokeWidth="6.5" strokeLinecap="round" />
        <Shape shapes={shapes} name="fronds" fill="none" stroke={ink} strokeWidth="5" strokeLinecap="round" />
        <Shape shapes={shapes} name="terraces" fill="none" stroke={mix(ink, fade, 78)} strokeWidth="2" strokeLinecap="round" />
      </g>
    </svg>
  );
}
