/*
  The sky over Salatiga at any moment, for the landscape. Pure: give it a Date and it returns
  the gradient, where the sun (the turmeric query dot) sits and how many stars are out. Colors
  are blended in OKLab between hand-picked keyframes, so dusk goes through soga brown instead
  of mud.

  Salatiga is about 7°S, so the day barely changes length through the year. Sunrise is around
  05:30 and sunset around 17:45 local time (WIB, UTC+7).
*/

export type SkyPhase = "morning" | "day" | "dusk" | "night";

export type Sky = {
  phase: SkyPhase;
  /** Gradient stops from the top of the sky down to the horizon, as hex. */
  stops: string[];
  /** Position as a fraction of the landscape's width and height (0,0 is top left). */
  sun: { x: number; y: number; visible: boolean };
  /** 0 is no stars, 1 is a full night sky. */
  stars: number;
  /** Local time in hours, e.g. 17.75 for 17:45. */
  hour: number;
};

export const SUNRISE = 5.5;
export const SUNSET = 17.75;

/** Where the sun touches the ridge, and its highest point, as fractions of the height. */
const HORIZON_Y = 0.66;
const ZENITH_Y = 0.12;

type Key = [hour: number, top: string, middle: string, horizon: string];

// Nila at night, a hint of soga before dawn, kunyit on the horizon at both ends of the day.
const KEYS: Key[] = [
  [0, "#050a22", "#0a1233", "#16215a"],
  [4.3, "#050a22", "#0b1438", "#1b2766"],
  [5.0, "#0a1233", "#1d2a66", "#5c4868"],
  [5.6, "#16235c", "#5f5a86", "#eaa24c"],
  [6.3, "#25388a", "#8a90bd", "#f2cf8c"],
  [7.5, "#2c44a0", "#8b9ad2", "#e8e1cd"],
  [12, "#283e98", "#7387cc", "#dfe1e8"],
  [15.5, "#293b90", "#7d8ac4", "#e7dcc0"],
  [17.0, "#22337e", "#8f7a8a", "#f2bf5e"],
  [17.75, "#18266a", "#8a5a2b", "#f4b223"],
  [18.4, "#0f1a47", "#3b2b4c", "#8a5a2b"],
  [19.2, "#070d2a", "#0f1a47", "#1e2a66"],
  [24, "#050a22", "#0a1233", "#16215a"],
];

/* ---------- color ---------- */

type Lab = [number, number, number];

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function hexToLab(hex: string): Lab {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => toLinear(v / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function labToHex([L, A, B]: Lab): string {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return `#${rgb
    .map((c) => Math.round(Math.min(1, Math.max(0, toGamma(c))) * 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

const LAB_KEYS = KEYS.map(([hour, ...stops]) => ({ hour, stops: stops.map(hexToLab) }));

/** Blends two hex colors in OKLab. t = 0 gives a, 1 gives b. */
export function mixHex(a: string, b: string, t: number): string {
  const la = hexToLab(a);
  const lb = hexToLab(b);
  return labToHex([0, 1, 2].map((i) => la[i] + (lb[i] - la[i]) * t) as Lab);
}

/* ---------- time ---------- */

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

const formats = new Map<string, Intl.DateTimeFormat>();

/** Hours since local midnight in the time zone, with minutes and seconds as the fraction. */
export function localHour(date: Date, timeZone = "Asia/Jakarta"): number {
  let f = formats.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hourCycle: "h23",
    });
    formats.set(timeZone, f);
  }
  const parts = f.formatToParts(date);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return part("hour") + part("minute") / 60 + part("second") / 3600;
}

function phaseAt(h: number): SkyPhase {
  if (h < 4.75 || h >= 19) return "night";
  if (h < 10) return "morning";
  if (h < 16.75) return "day";
  return "dusk";
}

/** The sky for a local hour (0 to 24). skyAt() calls this after working out the hour. */
export function skyAtHour(hour: number): Sky {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < LAB_KEYS.length - 2 && LAB_KEYS[i + 1].hour <= h) i++;
  const a = LAB_KEYS[i];
  const b = LAB_KEYS[i + 1];
  const t = smoothstep(a.hour, b.hour, h);
  const stops = a.stops.map((la, k) => labToHex([0, 1, 2].map((c) => la[c] + (b.stops[k][c] - la[c]) * t) as Lab));

  // The sun crosses from left to right and drops behind the ridge on the right at sunset.
  const f = (h - SUNRISE) / (SUNSET - SUNRISE);
  const sun = {
    x: round(Math.min(1.1, Math.max(-0.1, 0.08 + 0.84 * f))),
    y: round(HORIZON_Y - (HORIZON_Y - ZENITH_Y) * Math.sin(Math.PI * Math.min(1, Math.max(0, f))) + (f > 1 ? (f - 1) * 0.6 : f < 0 ? -f * 0.6 : 0)),
    visible: f > -0.04 && f < 1.04,
  };
  const stars = round(Math.max(1 - smoothstep(4.25, 5.4, h), smoothstep(18.2, 19.5, h)));
  return { phase: phaseAt(h), stops, sun, stars, hour: round(h) };
}

/** The sky over Salatiga at `date`. Same input, same output, on the server and in the browser. */
export function skyAt(date: Date, timeZone = "Asia/Jakarta"): Sky {
  return skyAtHour(localHour(date, timeZone));
}

function round(v: number) {
  return Math.round(v * 1000) / 1000;
}
