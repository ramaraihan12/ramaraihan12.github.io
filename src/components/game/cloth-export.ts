/*
  "Save the cloth": the run's cloth as a picture, laid out like the label a batik maker pins to
  a finished piece. Loaded on click only (closer.tsx imports it dynamically), so none of this
  is in the page until someone asks for it.

  The panels are painted from the same art kit as the cloth on screen: one tile per kind and
  dye, drawn as an SVG, turned into an Image and tiled onto the canvas. The words are drawn on
  the canvas with the page's own loaded fonts, because an SVG that becomes an image can't reach
  web fonts. Colours are read from the page's tokens, with the same values as fallback.
*/

import { BATIK_KINDS, batikSvg } from "@/components/art/patterns";
import { site } from "@/content/site";
import type { Motif } from "./cloth";
import { strings as S } from "./strings";

export type ExportInput = {
  motifs: readonly Motif[];
  streak: number;
  best: number;
};

type Dye = "calm" | "warm" | "hot";

const W = 1200;
const PAD = 72;
const INNER = W - PAD * 2;

function token(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
}

function mix(a: string, b: string, t: number) {
  const n = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  const c = (i: number) =>
    Math.round(n(a, i) * t + n(b, i) * (1 - t))
      .toString(16)
      .padStart(2, "0");
  return `#${c(0)}${c(1)}${c(2)}`;
}

/** Same thresholds as the cloth on screen. */
function dyeOf(heat: number): Dye {
  if (heat >= 0.72) return "hot";
  if (heat >= 0.4) return "warm";
  return "calm";
}

function load(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("tile failed"));
    img.src = src;
  });
}

const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** The font stacks the page set up through next/font, read from the variables on <html>. */
function fonts() {
  const cs = getComputedStyle(document.documentElement);
  const f = (v: string, fallback: string) => cs.getPropertyValue(v).trim() || fallback;
  return {
    display: f("--font-anybody", "sans-serif"),
    mono: f("--font-martian", "monospace"),
    sans: f("--font-schibsted", "sans-serif"),
  };
}

function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, track: number, align: "left" | "right" = "left") {
  // letterSpacing is in current Chromium, Safari and Firefox; where it isn't, plain text is fine.
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${track}px`;
  ctx.textAlign = align;
  // A trailing space is added after the last letter, so right-aligned text is nudged back.
  ctx.fillText(text, align === "right" ? x + track : x, y);
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "0px";
}

export async function drawCloth({ motifs, streak, best }: ExportInput) {
  const F = fonts();
  const nila = token("--nila", "#0f1a47");
  const mori = token("--mori", "#efe9dc");
  const kunyit = token("--kunyit", "#f4b223");
  const soga = token("--soga", "#9c6633");
  const malam = token("--malam", "#080e2b");

  // Make sure the faces are in before anything is measured or drawn.
  try {
    await Promise.all([
      document.fonts.load(`700 120px ${F.display}`),
      document.fonts.load(`500 22px ${F.mono}`),
      document.fonts.load(`700 22px ${F.mono}`),
      document.fonts.load(`500 30px ${F.sans}`),
    ]);
  } catch {
    // The fallback faces will do.
  }

  const dyes: Record<Dye, { ground: string; tint: string; ink: string }> = {
    calm: { ground: nila, tint: mix(soga, nila, 0.72), ink: mix(mori, nila, 0.8) },
    warm: { ground: nila, tint: soga, ink: kunyit },
    hot: { ground: kunyit, tint: soga, ink: malam },
  };

  // The grid: wider than tall, a few columns for a short run, up to eight for a long one.
  const n = motifs.length;
  const cols = Math.min(8, Math.max(3, Math.ceil(Math.sqrt(n * 1.6))));
  const rows = Math.max(1, Math.ceil(n / cols));
  const cell = Math.min(190, Math.floor((INNER - 56) / cols));
  const clothW = cols * cell;
  const hem = 54;
  const clothH = rows * cell;

  const used = new Set<string>();
  motifs.forEach((m) => used.add(`${m.kind}:${dyeOf(m.heat)}`));
  const tiles = new Map<string, HTMLImageElement>();
  await Promise.all(
    [...used].map(async (key) => {
      const [kind, dye] = key.split(":") as [(typeof BATIK_KINDS)[number], Dye];
      const k = kind === "truntum" ? 1.4 : 1;
      const probe = batikSvg(kind, { ...dyes[dye] });
      const size = Number(/width="([\d.]+)"/.exec(probe)?.[1] ?? 120);
      const svg = batikSvg(kind, { ...dyes[dye], scale: (cell * k) / size });
      tiles.set(key, await load(svgUrl(svg)));
    }),
  );
  const hemSize = Number(/width="([\d.]+)"/.exec(batikSvg("parang"))?.[1] ?? 120);
  const hemTile = await load(svgUrl(batikSvg("parang", { ink: mori, ground: nila, scale: hem / hemSize })));

  // Height: head, hem, cloth, hem, fringe, then the label block and the foot.
  const headH = 128;
  const labelH = 380;
  const H = PAD + headH + hem + clothH + hem + 34 + 56 + labelH + PAD - 20;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");

  // The paper: unbleached cotton, with the label's dashed edge.
  ctx.fillStyle = mori;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = soga;
  ctx.lineWidth = 2;
  ctx.setLineDash([2, 9]);
  ctx.lineCap = "round";
  ctx.strokeRect(28, 28, W - 56, H - 56);
  ctx.setLineDash([]);

  // Head: what this is, and when it was made.
  const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date());
  ctx.fillStyle = nila;
  ctx.textBaseline = "alphabetic";
  ctx.font = `700 22px ${F.mono}`;
  spaced(ctx, S.save.head.toUpperCase(), PAD, PAD + 22, 3);
  ctx.font = `500 22px ${F.mono}`;
  ctx.fillStyle = soga;
  spaced(ctx, date.toUpperCase(), W - PAD, PAD + 22, 3, "right");
  ctx.fillStyle = nila;
  ctx.font = `700 64px ${F.display}`;
  ctx.textAlign = "left";
  ctx.fillText(S.save.title, PAD, PAD + 100);

  // The cloth, hemmed at both ends.
  const x0 = Math.round((W - clothW) / 2);
  let y = PAD + headH;

  const hemBand = (yy: number) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, yy, clothW, hem);
    ctx.clip();
    ctx.fillStyle = ctx.createPattern(hemTile, "repeat") ?? nila;
    ctx.translate(x0, yy);
    ctx.fillRect(0, 0, clothW, hem);
    ctx.restore();
  };
  hemBand(y);
  y += hem;

  ctx.fillStyle = mix(mori, "#000000", 0.93);
  ctx.fillRect(x0, y, clothW, clothH);

  // How far into its run of one kind each panel is, so a field of one motif reads as one field.
  const run: number[] = [];
  motifs.forEach((m, i) => run.push(i > 0 && motifs[i - 1].kind === m.kind ? run[i - 1] + 1 : 0));

  motifs.forEach((m, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const px = x0 + col * cell;
    const py = y + row * cell;
    const tile = tiles.get(`${m.kind}:${dyeOf(m.heat)}`);
    if (!tile) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(px, py, cell, cell);
    ctx.clip();
    // Panels of one run share the tile, so the field carries on across the cut.
    const k = m.kind === "truntum" ? 1.4 : 1;
    const t = cell * k;
    const shift = ((run[i] * cell) % t + t) % t;
    for (let tx = -shift; tx < cell; tx += t) {
      for (let ty = 0; ty < cell; ty += t) ctx.drawImage(tile, px + tx, py + ty, t, t);
    }
    ctx.restore();
  });

  // Seams between panels, and a turmeric line where the question changed.
  ctx.lineWidth = 2;
  motifs.forEach((m, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const px = x0 + col * cell;
    const py = y + row * cell;
    ctx.strokeStyle = mix(malam, mori, 0.55);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, py + cell);
    ctx.moveTo(px, py + cell);
    ctx.lineTo(px + cell, py + cell);
    ctx.stroke();
    if (i > 0 && run[i] === 0 && col > 0) {
      ctx.strokeStyle = kunyit;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px, py + cell);
      ctx.stroke();
      ctx.lineWidth = 2;
    }
  });

  // The part of the cloth still waiting for wax: dotted, like the cecek along a seret.
  const filled = n;
  for (let i = filled; i < cols * rows; i++) {
    const px = x0 + (i % cols) * cell;
    const py = y + Math.floor(i / cols) * cell;
    ctx.fillStyle = mix(soga, mori, 0.35);
    for (let dx = 14; dx < cell; dx += 22) {
      for (let dy = 14; dy < cell; dy += 22) {
        ctx.beginPath();
        ctx.arc(px + dx, py + dy, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  y += clothH;
  hemBand(y);
  y += hem;

  // Fringe: loose threads past the hem.
  ctx.strokeStyle = mix(soga, mori, 0.6);
  ctx.lineWidth = 2;
  for (let fx = x0 + 4; fx < x0 + clothW - 2; fx += 7) {
    ctx.beginPath();
    ctx.moveTo(fx, y);
    ctx.lineTo(fx + ((fx * 7) % 5) - 2, y + 20 + ((fx * 13) % 14));
    ctx.stroke();
  }
  y += 34 + 56;

  // The label: the number the run came to, and the small print a maker writes on the tag.
  ctx.strokeStyle = nila;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, y - 28);
  ctx.lineTo(W - PAD, y - 28);
  ctx.stroke();

  ctx.fillStyle = nila;
  ctx.font = `700 230px ${F.display}`;
  ctx.textAlign = "left";
  ctx.fillText(String(streak), PAD - 6, y + 190);
  const numW = ctx.measureText(String(streak)).width;
  const tx = PAD + numW + 36;
  ctx.font = `700 30px ${F.sans}`;
  ctx.fillText(S.over.streakLabel(streak), tx, y + 120);
  ctx.font = `500 22px ${F.mono}`;
  ctx.fillStyle = soga;
  spaced(ctx, S.over.best(best).toUpperCase(), tx, y + 164, 2);

  // The dyes, as a maker's key.
  const key: [Dye, string][] = [
    ["calm", S.save.key.calm],
    ["warm", S.save.key.warm],
    ["hot", S.save.key.hot],
  ];
  let kx = PAD;
  const ky = y + 262;
  ctx.font = `500 20px ${F.mono}`;
  for (const [dye, label] of key) {
    const d = dyes[dye];
    ctx.fillStyle = d.ground;
    ctx.fillRect(kx, ky - 22, 30, 30);
    ctx.fillStyle = d.ink;
    ctx.fillRect(kx + 8, ky - 14, 14, 14);
    ctx.fillStyle = nila;
    spaced(ctx, label, kx + 44, ky, 1);
    kx += 44 + ctx.measureText(label).width + label.length + 36;
  }

  // The foot: where the cloth came from.
  ctx.fillStyle = nila;
  ctx.font = `700 24px ${F.mono}`;
  spaced(ctx, site.url.replace(/^https?:\/\//, ""), PAD, y + 330, 1);
  ctx.font = `500 20px ${F.mono}`;
  ctx.fillStyle = soga;
  spaced(ctx, `${site.name} · ${site.location}`.toUpperCase(), W - PAD, y + 330, 2, "right");

  return canvas;
}

function toBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("no blob"))), "image/png"));
}

/** What happened, so the button can say so. */
export type SaveResult = "shared" | "saved" | "cancelled";

export async function saveCloth(input: ExportInput): Promise<SaveResult> {
  const blob = await toBlob(await drawCloth(input));
  const name = `closer-${input.streak}-in-a-row.png`;
  const file = new File([blob], name, { type: "image/png" });

  // A phone gets the share sheet, which can put it straight into a chat or the photos. A
  // computer gets a download: its share sheets are rarely what anyone wants here.
  const phone = window.matchMedia("(pointer: coarse)").matches;
  if (phone && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: S.save.title, text: site.url });
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
      // Anything else: fall through to the download.
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "saved";
}
