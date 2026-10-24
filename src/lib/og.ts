import { dot, type Pt, smooth, taper } from "@/components/art/draw";
import { batikPatternMarkup, batikTileSize } from "@/components/art/patterns";
import { ogCopy } from "@/content/copy";

/** The link preview card. app/og.png/route.tsx renders it to a PNG at build time. */
export const ogImage = {
  url: "/og.png",
  width: 1200,
  height: 630,
  type: "image/png",
  alt: `${ogCopy.title.join(" ")} ${ogCopy.tagline}`,
};

/*
  The card's picture, as one SVG: a nila night, Merbabu with Merapi behind its shoulder, a
  turmeric sun (the query dot from the page), and a parang hem along the bottom like the
  footer's. Drawn here rather than with the art kit's <Landscape>, which colors with CSS
  variables and color-mix(); the renderer behind next/og only takes plain colors. Satori lays
  out flex boxes only, so the route puts this behind the text as an <img>.
*/

const W = ogImage.width;
const H = ogImage.height;

const C = {
  nila: "#0f1a47",
  malam: "#080e2b",
  mori: "#efe9dc",
  kunyit: "#f4b223",
  soga: "#9c6633",
  // Distance fades toward a lighter indigo, near layers toward malam.
  far: "#2a3876",
  mid: "#1d2a66",
};

const HEM_SCALE = 0.25;
const HEM = batikTileSize("parang", HEM_SCALE);

const ground = (ridge: Pt[]) => `${smooth(ridge, false, 0)}L${W + 20} ${ridge[ridge.length - 1][1]}V${H + 20}H-20V${ridge[0][1]}Z`;

const MERAPI: Pt[] = [
  [420, 640],
  [520, 586],
  [600, 532],
  [654, 494],
  [684, 474],
  [698, 470],
  [708, 474],
  [716, 468],
  [730, 474],
  [770, 500],
  [840, 548],
  [920, 600],
  [980, 640],
];

const MERBABU: Pt[] = [
  [560, 640],
  [650, 598],
  [736, 548],
  [806, 494],
  [858, 450],
  [892, 426],
  [914, 418],
  [928, 422],
  [944, 410],
  [962, 414],
  [984, 424],
  [1004, 420],
  [1030, 432],
  [1072, 458],
  [1124, 488],
  [1180, 508],
  [1220, 516],
];

// The near hills, in malam like the page's footer, with terraces cut into the left slope.
const HILLS: Pt[] = [
  [-20, 548],
  [120, 540],
  [260, 556],
  [420, 574],
  [600, 586],
  [800, 578],
  [1000, 588],
  [1220, 572],
];

const TERRACES: Pt[][] = [1, 2, 3].map((k) => [
  [-10, 548 + k * 13],
  [120, 541 + k * 13],
  [260, 557 + k * 12],
  [400 - k * 40, 573 + k * 9],
]);

const GULLIES: Pt[][] = [
  [
    [906, 424],
    [880, 470],
    [862, 520],
  ],
  [
    [944, 414],
    [946, 470],
    [956, 530],
  ],
  [
    [1002, 424],
    [1034, 470],
    [1070, 512],
  ],
];

// A few stars, placed by hand where the text isn't.
const STARS: Pt[] = [
  [812, 92],
  [904, 178],
  [1004, 74],
  [1122, 142],
  [770, 260],
  [868, 330],
];

/** The cecek, dots of wax, following a ridge a little below its edge. */
const cecek = (ridge: Pt[], drop: number, below: number) =>
  smooth(
    ridge.filter(([, y]) => y < below).map(([x, y]): Pt => [x, y + drop]),
    false,
    0,
  );

export function ogArt(): string {
  const sun = { x: 1092, y: 336, r: 38 };
  const plume = taper(
    [
      [712, 468],
      [706, 440],
      [716, 414],
      [742, 396],
      [784, 386],
      [840, 384],
    ],
    (t) => 4 + t * 30,
    10,
    0,
  );
  const wax = `stroke="${C.mori}" fill="none" stroke-linecap="round"`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    "<defs>",
    `<radialGradient id="glow"><stop offset=".3" stop-color="${C.kunyit}" stop-opacity=".38"/><stop offset="1" stop-color="${C.kunyit}" stop-opacity="0"/></radialGradient>`,
    `<linearGradient id="smoke" gradientUnits="userSpaceOnUse" x1="712" y1="468" x2="840" y2="384"><stop offset="0" stop-color="${C.mori}" stop-opacity=".4"/><stop offset="1" stop-color="${C.mori}" stop-opacity="0"/></linearGradient>`,
    batikPatternMarkup("parang", "hem", { ink: C.kunyit, ground: C.malam, tint: C.soga, scale: HEM_SCALE }),
    "</defs>",
    `<rect width="${W}" height="${H}" fill="${C.nila}"/>`,
    `<path d="${STARS.map(([x, y]) => `M${x} ${y}h0`).join("")}" ${wax} stroke-width="3.4" opacity=".7"/>`,
    `<circle cx="${sun.x}" cy="${sun.y}" r="${sun.r * 3.4}" fill="url(#glow)"/>`,
    `<circle cx="${sun.x}" cy="${sun.y}" r="${sun.r}" fill="${C.kunyit}"/>`,
    `<path d="${plume}" fill="url(#smoke)"/>`,
    `<path d="${ground(MERAPI)}" fill="${C.far}" stroke="${C.mori}" stroke-opacity=".4" stroke-width="1.5"/>`,
    `<path d="${cecek(MERAPI.slice(1, -1), 9, 520)}" ${wax} stroke-width="2.4" stroke-dasharray="0 8" opacity=".45"/>`,
    `<path d="${ground(MERBABU)}" fill="${C.mid}" stroke="${C.mori}" stroke-opacity=".5" stroke-width="1.6"/>`,
    `<path d="${GULLIES.map((g) => smooth(g, false, 0)).join("")}" ${wax} stroke-width="1.5" opacity=".3"/>`,
    `<path d="${cecek(MERBABU.slice(1, -1), 10, 470)}" ${wax} stroke-width="2.6" stroke-dasharray="0 9" opacity=".55"/>`,
    `<path d="${ground(HILLS)}" fill="${C.malam}" stroke="${C.mori}" stroke-opacity=".18" stroke-width="1.5"/>`,
    `<path d="${TERRACES.map((t) => smooth(t, false, 0)).join("")}" ${wax} stroke-width="1.5" opacity=".14"/>`,
    `<rect y="${H - HEM - 7}" width="${W}" height="${HEM + 7}" fill="${C.malam}"/>`,
    `<rect y="${H - HEM - 1.5}" width="${W}" height="1.5" fill="${C.kunyit}"/>`,
    `<rect y="${H - HEM}" width="${W}" height="${HEM}" fill="url(#hem)"/>`,
    // The sun is the query dot: a small ring around it, like the dot on the map.
    `<path d="${dot(sun.x, sun.y, sun.r + 12)}" fill="none" stroke="${C.kunyit}" stroke-width="1.5" opacity=".5"/>`,
    "</svg>",
  ].join("");
}

/** The art as a data URI for an <img>. */
export const ogArtUri = () => `data:image/svg+xml;base64,${Buffer.from(ogArt()).toString("base64")}`;

/**
 * A Google font cut down to the letters it has to draw, as a TTF the renderer can read. The
 * build already needs Google Fonts for next/font, but if the fetch fails anyway the card falls
 * back to the default face rather than failing the build.
 */
export async function loadFont(family: string, axes: string, text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:${axes}&text=${encodeURIComponent(text)}`,
    ).then((r) => r.text());
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    const font = await fetch(url);
    return font.ok ? font.arrayBuffer() : null;
  } catch {
    return null;
  }
}
