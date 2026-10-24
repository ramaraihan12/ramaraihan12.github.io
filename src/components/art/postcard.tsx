import type { CSSProperties, ReactNode } from "react";
import { handRect, nums, petal, type Pt } from "./draw";
import { batikPatternMarkup } from "./patterns";
import { hash, rng, wobble } from "./rng";

/*
  A small 4:3 illustration per project, all in one hand: ink line art on dyed cloth, flat soga
  and shade fills, and exactly one turmeric thing per card, the point of the project, the way
  the query dot is the point of the page. Behind it, the faint crackle (remukan) that wax
  leaves when it breaks in the dye bath; around it, a frame like a cap stamp.

  Decorative: aria-hidden. The caller shows the project's name and text.
*/

export type PostcardTone = "nila" | "mori" | "kunyit";

export type PostcardProps = {
  /** The project's repo name, e.g. "docs-rag-assistant". Unknown names get a batik tile. */
  name: string;
  /** The cloth: nila (default), mori or kunyit. */
  tone?: PostcardTone;
  className?: string;
  style?: CSSProperties;
};

// Ground, ink, accent, soga, shade, muted.
const TONES: Record<PostcardTone, Record<string, string>> = {
  nila: {
    "--pc-g": "var(--nila-2, #16235c)",
    "--pc-i": "var(--mori, #efe9dc)",
    "--pc-a": "var(--kunyit, #f4b223)",
    "--pc-s": "var(--soga-2, #b5824a)",
    "--pc-d": "var(--nila, #0f1a47)",
    "--pc-m": "var(--pudar, #9aa3c7)",
  },
  mori: {
    "--pc-g": "var(--mori, #efe9dc)",
    "--pc-i": "var(--nila, #0f1a47)",
    "--pc-a": "var(--kunyit, #f4b223)",
    "--pc-s": "var(--soga, #8a5a2b)",
    "--pc-d": "color-mix(in oklab, var(--mori, #efe9dc) 80%, var(--soga, #8a5a2b))",
    "--pc-m": "color-mix(in oklab, var(--nila, #0f1a47) 55%, var(--mori, #efe9dc))",
  },
  kunyit: {
    "--pc-g": "var(--kunyit, #f4b223)",
    "--pc-i": "var(--nila, #0f1a47)",
    "--pc-a": "var(--mori, #efe9dc)",
    "--pc-s": "var(--soga, #8a5a2b)",
    "--pc-d": "color-mix(in oklab, var(--kunyit, #f4b223) 72%, var(--soga, #8a5a2b))",
    "--pc-m": "color-mix(in oklab, var(--nila, #0f1a47) 62%, var(--kunyit, #f4b223))",
  },
};

const G = "var(--pc-g)";
const I = "var(--pc-i)";
const A = "var(--pc-a)";
const S = "var(--pc-s)";
const D = "var(--pc-d)";
const M = "var(--pc-m)";

/* ---------- small shared marks ---------- */

/** An arrowhead with its tip at (x, y), pointing along `angle` (radians). */
function head(x: number, y: number, angle: number, size = 6) {
  const p = (da: number): Pt => [x - Math.cos(angle + da) * size, y - Math.sin(angle + da) * size];
  return `M${nums(p(0.5))}L${nums([x, y])}L${nums(p(-0.5))}`;
}

/** A circular arc from a0 to a1 (radians, clockwise), with an arrowhead at the end. */
function loop(cx: number, cy: number, r: number, a0: number, a1: number) {
  const at = (a: number): Pt => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const end = at(a1);
  return `M${nums(at(a0))}A${r} ${r} 0 ${large} 1 ${nums(end)}${head(end[0], end[1], a1 + Math.PI / 2, 7)}`;
}

/** Four kawung petals around a point, the cap's own mark. */
function flower(cx: number, cy: number, size: number, seed: number) {
  const r = rng(seed);
  let d = "";
  for (let q = 0; q < 4; q++) {
    const ang = Math.PI / 4 + (q * Math.PI) / 2;
    d += petal(cx + Math.cos(ang) * size, cy + Math.sin(ang) * size, size * 0.86, size * 0.54, ang, r, { drift: 0.05, tip: 0.4 });
  }
  return d;
}

function Bean({ x, y, rot, fill = D }: { x: number; y: number; rot: number; fill?: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <ellipse rx="7" ry="4.8" fill={fill} />
      <path d="M-5 .8C-2-1.6 2 1.6 5-.8" strokeWidth="1.3" stroke={fill === A ? D : I} />
    </g>
  );
}

function Envelope({ x, y, rot }: { x: number; y: number; rot: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <rect x="-15" y="-10" width="30" height="20" rx="1.5" fill={G} />
      <path d="M-15-10L0 2 15-10" strokeWidth="1.6" />
    </g>
  );
}

/** Seven-segment digits, so the TV's number doesn't depend on a font. */
function Digit({ x, y, n }: { x: number; y: number; n: number }) {
  // Segments a to g as [x1, y1, x2, y2] in a 18 × 32 box.
  const seg = [
    [3, 0, 15, 0],
    [18, 3, 18, 13],
    [18, 19, 18, 29],
    [3, 32, 15, 32],
    [0, 19, 0, 29],
    [0, 3, 0, 13],
    [3, 16, 15, 16],
  ];
  const on = ["1111110", "0110000", "1101101", "1111001", "0110011", "1011011", "1011111", "1110000", "1111111", "1111011"][n];
  const d = seg
    .filter((_, i) => on[i] === "1")
    .map(([x1, y1, x2, y2]) => `M${x + x1} ${y + y1}L${x + x2} ${y + y2}`)
    .join("");
  return <path d={d} stroke={A} strokeWidth="4.5" />;
}

/* ---------- the cards ---------- */

const CARDS: Record<string, () => ReactNode> = {
  // A book's pages fly into a vector grid; the closest vector cites back to a tab in the book.
  "docs-rag-assistant": () => {
    let grid = "";
    for (const x of [168, 184, 200, 216]) for (const y of [84, 100, 116, 132]) grid += `M${x} ${y}h0`;
    return (
      <>
        <path d="M84 84Q104 34 170 58" stroke={M} strokeWidth="1.6" strokeDasharray="0 6" />
        <path d={grid} stroke={M} strokeWidth="4.5" />
        <path d="M197 103Q170 124 143 112" stroke={A} strokeWidth="1.6" strokeDasharray="0 5" />
        <circle cx="200" cy="100" r="10" stroke={A} strokeWidth="1.4" />
        <circle cx="200" cy="100" r="5" fill={A} stroke="none" />
        <path d="M80 138Q60 128 30 132V90Q58 86 80 98Z" fill={D} />
        <path d="M80 138Q100 128 130 132V90Q102 86 80 98Z" fill={D} />
        <path d="M130 104h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-9Z" fill={A} />
        <path d="M38 103Q56 100 72 106M38 113Q56 110 72 116M38 123Q52 120 64 124M88 106Q104 100 122 103M88 116Q104 110 122 113" stroke={M} strokeWidth="1.4" />
        <path d="M92 66L106 60 112 76 98 82Z" fill={G} />
        <path d="M125 44L140 44 141 60 126 61Z" fill={G} />
        <path d="M153 40L163 44 159 54 149 50Z" fill={G} />
        <path d="M99 69l7-3M101 74l7-3M129 49h8M129 54h7" stroke={M} strokeWidth="1.2" />
      </>
    );
  },

  // A magnifier finds the spot on a folded map; the plan's checklist is two ticks in.
  "research-agent": () => (
    <>
      <path d="M24 58L64 50V138L24 146Z" fill={D} />
      <path d="M64 50L104 58V146L64 138Z" fill={G} />
      <path d="M104 58L144 50V138L104 146Z" fill={D} />
      <path d="M34 132C50 120 44 104 60 98S84 106 90 90 110 76 124 76" stroke={I} strokeDasharray="0 6" />
      <path d="M134 98L152 116" stroke={I} strokeWidth="11" />
      <path d="M134 98L152 116" stroke={S} strokeWidth="6.5" />
      <circle cx="120" cy="82" r="22" fill={G} fillOpacity=".55" strokeWidth="4" />
      <path d="M124 90l-6-9a7 7 0 1 1 12 0Z" fill={A} />
      <circle cx="124" cy="76.5" r="2.2" fill={G} stroke="none" />
      <g transform="rotate(5 191 72)">
        <rect x="164" y="36" width="54" height="72" rx="3" fill={G} />
        <path d="M172 48h9v9h-9ZM172 66h9v9h-9ZM172 84h9v9h-9Z" strokeWidth="1.6" />
        <path d="M173.5 52.5l3 3 6.5-8M173.5 70.5l3 3 6.5-8" strokeWidth="2" />
        <path d="M187 53H210M187 71H206M187 89H202" stroke={M} strokeWidth="1.8" />
      </g>
    </>
  ),

  // A sack of beans, and the chat that answers about them.
  "shop-support-bot": () => (
    <>
      <path d="M46 156C36 126 46 100 62 90L58 80C72 74 92 74 104 80L100 90C118 102 124 130 112 156 92 162 66 162 46 156Z" fill={S} />
      <ellipse cx="81" cy="82" rx="21" ry="6" fill={D} />
      <Bean x={72} y={77} rot={-20} />
      <Bean x={86} y={74} rot={28} />
      <Bean x={93} y={81} rot={-48} />
      <path d="M59 92C72 98 90 98 103 92" strokeWidth="2.4" />
      <circle cx="81" cy="97" r="3" fill={I} stroke="none" />
      <path d={flower(80, 126, 7, 3)} strokeWidth="1.4" />
      <path d="M130 30H206Q214 30 214 38V76Q214 84 206 84H152L138 96 141 84H130Q122 84 122 76V38Q122 30 130 30Z" fill={G} />
      <Bean x={143} y={57} rot={-30} fill={A} />
      <path d="M158 52H202M158 64H190" stroke={M} strokeWidth="2" />
      <path d="M164 106H200Q208 106 208 114V122Q208 130 200 130H172L164 138 165 130Q156 128 156 120V114Q156 106 164 106Z" fill={D} />
      <path d="M170 118h0M182 118h0M194 118h0" strokeWidth="4" />
    </>
  ),

  // One gate (a split candi bentar), four roads out to four providers. One is lit.
  // Drawn like a village map: roads from above, the gate standing up in elevation.
  "llm-gateway": () => {
    const roads =
      "M120 172V112M120 112C100 104 62 98 40 66M120 112C112 84 84 72 84 42M120 112C130 86 156 72 152 46M120 112C140 108 184 102 202 80";
    const dome = (x: number, y: number) => `M${x - 10} ${y}a10 10 0 0 1 20 0Z`;
    return (
      <>
        <path d={roads} strokeWidth="13" />
        <path d={roads} stroke={D} strokeWidth="9.5" />
        <path d={roads} stroke={M} strokeWidth="1.2" strokeDasharray="3 5" />
        <path d={dome(38, 62) + dome(84, 38) + dome(204, 76)} fill={G} strokeWidth="1.8" />
        <path d={dome(152, 42)} fill={A} strokeWidth="1.8" />
        <path d="M113 150V102L108 92 103 102V110H98V122H93V136H87V150ZM127 150V102L132 92 137 102V110H142V122H147V136H153V150Z" fill={S} />
        <path d="M93 136H113M98 122H113M103 110H113M127 136H147M127 122H142M127 110H137" strokeWidth="1.3" />
      </>
    );
  },

  // An invoice, checked and stamped with a cap.
  "invoice-flow": () => (
    <>
      <path d="M56 26H150V146L142 152 134 146 126 152 118 146 110 152 102 146 94 152 86 146 78 152 70 146 62 152 56 146Z" fill={D} />
      <path d="M68 42H106" strokeWidth="5" />
      <path d="M68 62H110M124 62H138M68 74H102M124 74H138M68 86H108M124 86H138" stroke={M} strokeWidth="2" />
      <path d="M68 100H138" strokeWidth="1.4" />
      <path d="M112 113H138" strokeWidth="4" />
      <path d="M70 114L80 125 98 102" stroke={A} strokeWidth="6" />
      <g transform="rotate(-14 162 118)" stroke={S} opacity=".95">
        <circle cx="162" cy="118" r="28" strokeWidth="3" />
        <circle cx="162" cy="118" r="21.5" strokeWidth="2.2" strokeDasharray="0 4.7" />
        <path d={flower(162, 118, 7.5, 9)} strokeWidth="1.8" />
      </g>
    </>
  ),

  // A question in a speech bubble pours into a table, and the table into a chart.
  "text-to-sql-chat": () => (
    <>
      <path d="M30 26H94Q102 26 102 34V62Q102 70 94 70H52L40 82 42 70H30Q22 70 22 62V34Q22 26 30 26Z" fill={G} />
      <path d="M32 40Q40 35 48 40T64 40 80 40 92 40M32 54Q40 49 48 54T64 54 78 54" stroke={M} strokeWidth="1.8" />
      <path d="M70 74Q80 92 102 88" stroke={M} strokeWidth="1.6" strokeDasharray="0 5" />
      <rect x="104" y="78" width="60" height="46" rx="2" fill={D} />
      <path d="M104 78H164V90H104Z" fill={S} strokeWidth="1.4" />
      <path d="M104 102H164M104 114H164M124 78V124M144 78V124" strokeWidth="1.2" />
      <path d="M166 104Q180 108 184 120" stroke={M} strokeWidth="1.6" strokeDasharray="0 5" />
      <path d="M172 138h9v16h-9ZM184 126h9v28h-9ZM196 132h9v22h-9Z" fill={D} strokeWidth="1.6" />
      <path d="M208 114h9v40h-9Z" fill={A} strokeWidth="1.6" />
      <path d="M166 154H222" />
    </>
  ),

  // A new card flies in with its tag on, toward the bin wearing the same tag.
  "issue-triage-action": () => {
    const bin = (x: number, tag: string) => (
      <g key={x}>
        <rect x={x + 10} y="98" width="22" height="28" rx="1.5" fill={G} transform={`rotate(-8 ${x + 21} 112)`} strokeWidth="1.6" />
        <rect x={x + 26} y="100" width="22" height="28" rx="1.5" fill={G} transform={`rotate(7 ${x + 37} 114)`} strokeWidth="1.6" />
        <path d={`M${x} 118H${x + 60}L${x + 54} 154H${x + 6}Z`} fill={D} />
        <path d={`M${x + 22} 128H${x + 46}V144H${x + 22}L${x + 16} 136Z`} fill={tag} strokeWidth="1.6" />
        <circle cx={x + 22} cy="136" r="1.8" fill={D} strokeWidth="1.2" />
      </g>
    );
    return (
      <>
        <path d="M54 46Q90 22 112 46T118 108" stroke={M} strokeWidth="1.6" strokeDasharray="0 5" />
        <rect x="24" y="36" width="26" height="32" rx="1.5" fill={D} strokeWidth="1.6" />
        <rect x="28" y="32" width="26" height="32" rx="1.5" fill={G} strokeWidth="1.6" />
        <path d="M33 42H48M33 49H45" stroke={M} strokeWidth="1.6" />
        <g transform="rotate(16 124 56)">
          <rect x="110" y="40" width="28" height="34" rx="1.5" fill={G} strokeWidth="1.8" />
          <path d="M116 50H132M116 57H128" stroke={M} strokeWidth="1.6" />
          <path d="M138 52L150 58" strokeWidth="1.2" />
          <path d="M148 52H166V66H148L142 59Z" fill={A} strokeWidth="1.6" />
        </g>
        {bin(26, S)}
        {bin(90, A)}
        {bin(154, G)}
      </>
    );
  },

  // A laptop with a terminal, wired to a small GPU chip.
  "local-ai-coding-setup": () => {
    let pins = "";
    for (let i = 0; i < 4; i++) {
      const k = 74 + i * 7;
      const j = 188 + i * 7;
      pins += `M${j} 66v-6M${j} 102v6M180 ${k}h-6M216 ${k}h6`;
    }
    return (
      <>
        <path d="M174 84C164 84 166 100 156 100" stroke={M} strokeWidth="1.6" strokeDasharray="0 4" />
        <path d="M40 34H148Q152 34 152 38V112H36V38Q36 34 40 34Z" fill={D} />
        <rect x="44" y="42" width="100" height="62" rx="2" stroke={M} strokeWidth="1" />
        <path d="M52 54L58 59 52 64" strokeWidth="2.4" />
        <path d="M64 59H106" strokeWidth="2" />
        <path d="M52 74H92M52 86H120" stroke={M} strokeWidth="2" />
        <rect x="52" y="94" width="7" height="8" fill={A} stroke="none" />
        <path d="M28 112H160L168 124Q168 128 164 128H24Q20 128 20 124Z" fill={S} />
        <path d="M80 119H108" strokeWidth="1.4" />
        <path d={pins} strokeWidth="1.8" />
        <rect x="180" y="66" width="36" height="36" rx="3" fill={D} />
        <rect x="189" y="75" width="18" height="18" rx="1.5" fill={S} strokeWidth="1.4" />
      </>
    );
  },

  // Number 07 on the TV, and the people waiting for it.
  antre: () => {
    const person = (x: number, y: number, fill: string) => (
      <g key={x}>
        <path d={`M${x - 15} 148V${y + 24}Q${x - 15} ${y + 10} ${x} ${y + 10}T${x + 15} ${y + 24}V148Z`} fill={fill} />
        <circle cx={x} cy={y} r="7.5" fill={D} />
      </g>
    );
    return (
      <>
        <path d="M120 24V14" strokeWidth="3" />
        <rect x="58" y="24" width="124" height="62" rx="5" fill={D} />
        <rect x="65" y="31" width="110" height="48" rx="2" stroke={M} strokeWidth="1" />
        <path d="M80 55h0" stroke={M} strokeWidth="5" />
        <Digit x={96} y={39} n={0} />
        <Digit x={126} y={39} n={7} />
        {person(56, 108, S)}
        {person(98, 104, G)}
        {person(142, 108, S)}
        {person(184, 106, G)}
        <path d="M104 126h11v8h-11Z" fill={G} strokeWidth="1.6" transform="rotate(-12 110 130)" />
        <path d="M28 148H212M36 148V160M204 148V160" strokeWidth="3" />
      </>
    );
  },

  // A warung with jars and sachets on the counter, and the cloud crossed out: it works offline.
  "warung-pos": () => {
    let awning = "M26 70";
    for (let i = 0; i < 12; i++) awning += "a6 6 0 0 0 12 0";
    awning += "V56H26Z";
    return (
      <>
        <path d="M22 56L36 40H158L172 56Z" fill={D} />
        <path d="M34 76V150M162 76V150" strokeWidth="3" />
        <path d={awning} fill={G} />
        <path d="M38 56h12v14H38ZM62 56h12v14H62ZM86 56h12v14H86ZM110 56h12v14H110ZM134 56h12v14H134ZM158 56h12v14H158Z" fill={S} stroke="none" />
        <path d={awning} />
        <path d="M128 76V110" strokeWidth="1.2" />
        <path d="M122 80h12v8h-12ZM122 90h12v8h-12ZM122 100h12v8h-12Z" fill={S} strokeWidth="1.4" />
        <rect x="46" y="90" width="16" height="20" rx="4" fill={G} />
        <rect x="68" y="90" width="16" height="20" rx="4" fill={G} />
        <rect x="90" y="90" width="16" height="20" rx="4" fill={G} />
        <path d="M48 86h12v5H48ZM70 86h12v5H70ZM92 86h12v5H92Z" fill={D} strokeWidth="1.6" />
        <rect x="28" y="110" width="140" height="40" fill={S} />
        <path d="M36 122H160" strokeDasharray="0 7" strokeWidth="2.6" />
        <path d="M184 46H214A8 8 0 0 0 214 30 11 11 0 0 0 194 24 9 9 0 0 0 182 32 7 7 0 0 0 184 46Z" fill={G} />
        <path d="M178 52L222 20" stroke={A} strokeWidth="4" />
      </>
    );
  },

  // Envelopes drop into an inbox; one goes round the retry loop first.
  "webhook-inbox": () => (
    <>
      <path d="M30 30Q66 18 84 46M114 80Q122 90 122 98" stroke={M} strokeWidth="1.6" strokeDasharray="0 5" />
      <path d="M62 122L76 102H164L178 122Z" fill={G} />
      <Envelope x={122} y={106} rot={-4} />
      <path d="M62 122L72 154H168L178 122H146L140 134H100L94 122Z" fill={D} />
      <Envelope x={44} y={40} rot={-18} />
      <Envelope x={100} y={64} rot={10} />
      <path d={loop(100, 64, 26, -1.3, 3.9)} stroke={A} strokeWidth="2.6" />
    </>
  ),

  // The database goes into a locked box, and the box goes up to the cloud.
  "pg-backup": () => (
    <>
      <path d="M30 98V142A20 6 0 0 0 70 142V98" fill={D} />
      <ellipse cx="50" cy="98" rx="20" ry="6" fill={G} />
      <path d="M30 113A20 6 0 0 0 70 113M30 128A20 6 0 0 0 70 128" strokeWidth="1.4" />
      <path d="M76 118Q88 108 98 106" stroke={M} strokeWidth="1.6" strokeDasharray="0 5" />
      <path d={head(98, 106, -0.2, 5)} stroke={M} strokeWidth="1.6" />
      <rect x="102" y="84" width="44" height="40" rx="2" fill={S} />
      <path d="M102 94H146" strokeWidth="1.4" />
      <path d="M118 104V98A6 6 0 0 1 130 98V104" stroke={A} strokeWidth="3" />
      <rect x="113" y="102" width="22" height="16" rx="2" fill={A} stroke="none" />
      <circle cx="124" cy="109" r="2" fill={D} stroke="none" />
      <path d="M152 86Q160 76 164 68" stroke={M} strokeWidth="1.6" strokeDasharray="0 5" />
      <path d={head(164, 68, -1.1, 5)} stroke={M} strokeWidth="1.6" />
      <path d="M172 68H212A10 10 0 0 0 214 48 14 14 0 0 0 188 40 11 11 0 0 0 170 50 9 9 0 0 0 172 68Z" fill={G} />
      <rect x="186" y="50" width="13" height="10" rx="1" fill={S} strokeWidth="1.4" />
    </>
  ),

  // A phone with the month as a donut chart, and the coins it's counting.
  ralaex: () => (
    <>
      <rect x="80" y="22" width="72" height="138" rx="12" fill={D} />
      <rect x="86" y="34" width="60" height="114" rx="4" fill={G} stroke="none" />
      <path d="M110 28H122" strokeWidth="2" />
      <circle cx="116" cy="70" r="22" fill={D} strokeWidth="1.6" />
      <path d="M116 70L116 48A22 22 0 0 1 128.9 87.8Z" fill={A} strokeWidth="1.6" />
      <path d="M116 70L128.9 87.8A22 22 0 0 1 98.2 82.9Z" fill={S} strokeWidth="1.6" />
      <circle cx="116" cy="70" r="8" fill={G} strokeWidth="1.6" />
      <path d="M96 108h0" stroke={A} strokeWidth="6" />
      <path d="M96 121h0" stroke={S} strokeWidth="6" />
      <path d="M96 134h0" stroke={M} strokeWidth="6" />
      <path d="M104 108H136M104 121H128M104 134H132" stroke={M} strokeWidth="2" />
      {[148, 140, 132].map((y) => (
        <g key={y}>
          <path d={`M168 ${y}v5a16 6 0 0 0 32 0v-5`} fill={S} />
          <ellipse cx="184" cy={y} rx="16" ry="6" fill={S} />
        </g>
      ))}
      <ellipse cx="184" cy="132" rx="10" ry="3.4" strokeWidth="1.2" />
    </>
  ),

  // Chat floats up the stream as bubbles.
  chaBubbleTwitch: () => {
    const bubbles: [number, number, number, string][] = [
      [154, 44, 15, G],
      [176, 100, 14, D],
      [56, 118, 12, G],
      [126, 128, 10, D],
      [206, 62, 7, G],
      [92, 66, 24, A],
    ];
    return (
      <>
        {bubbles.map(([x, y, r]) => (
          <path key={`t${x}`} d={`M${x} ${y + r + 5}q-5 9 0 18t0 18 0 18 0 18`} stroke={M} strokeWidth="1.4" strokeDasharray="0 5" />
        ))}
        {bubbles.map(([x, y, r, fill]) => (
          <g key={x}>
            <path d={`M${x - r * 0.45} ${y + r * 0.82}l-5 ${r * 0.4 + 3}l${r * 0.5 + 4} -${r * 0.25 + 3}`} fill={fill} />
            <circle cx={x} cy={y} r={r} fill={fill} />
          </g>
        ))}
        <path d="M84 61h0M100 61h0" stroke={D} strokeWidth="4" />
        <path d="M83 71Q92 79 101 71" stroke={D} strokeWidth="2.4" />
        <path d="M146 41H162M146 48H157M50 116H62M50 122H58" stroke={M} strokeWidth="2" />
        <path d="M176 105l-6-6a3.6 3.6 0 0 1 6-5 3.6 3.6 0 0 1 6 5Z" fill={S} strokeWidth="1.2" />
        <path d="M121 128h0M126 128h0M131 128h0" strokeWidth="2.6" />
      </>
    );
  },

  // A filmstrip, one frame cut out and stood up in a phone, with subtitles burned in.
  "project-clipper": () => {
    const people = [26, 62, 98, 129].map((x) => `M${x - 10} 98Q${x} 84 ${x + 10} 98Z`).join("");
    return (
      <>
        <path d="M8 60H142V110H8Z" fill={D} />
        <path d="M12 66H140M12 104H140" stroke={G} strokeWidth="4" strokeDasharray="4 6" />
        <path d="M44 72V98M80 72V98M116 72V98" strokeWidth="1.4" />
        <path d={people} fill={M} stroke="none" />
        <path d="M26 81h0M62 81h0M98 81h0M129 81h0" stroke={M} strokeWidth="9" />
        <rect x="113" y="54" width="32" height="62" rx="1" strokeWidth="1.6" strokeDasharray="4 4" />
        <path d="M118 36L130 54M130 36L118 54" strokeWidth="2" />
        <circle cx="116" cy="32" r="4" strokeWidth="1.8" />
        <circle cx="132" cy="32" r="4" strokeWidth="1.8" />
        <path d="M148 86Q156 78 160 84" stroke={M} strokeWidth="1.6" strokeDasharray="0 5" />
        <rect x="162" y="24" width="50" height="132" rx="8" fill={D} />
        <rect x="167" y="34" width="40" height="112" rx="2" fill={G} stroke="none" />
        <circle cx="187" cy="78" r="11" fill={M} stroke="none" />
        <path d="M167 122Q169 96 187 94T207 122V146H167Z" fill={S} stroke="none" />
        <rect x="172" y="122" width="30" height="7" rx="1.5" fill={A} stroke="none" />
        <rect x="178" y="132" width="18" height="5" rx="1.5" fill={A} stroke="none" opacity=".75" />
      </>
    );
  },
};

/** Every project that has its own card. */
export const POSTCARD_NAMES = Object.keys(CARDS);

/* ---------- frame and cloth ---------- */

/** The wax crackle: thin broken lines wandering across the cloth. */
function crackle(seed: number) {
  const r = rng(seed);
  let d = "";
  for (let k = 0; k < 4; k++) {
    let x = 20 + r() * 200;
    let y = 20 + r() * 140;
    let a = r() * Math.PI * 2;
    d += `M${nums([x, y], 0)}`;
    for (let s = 0; s < 7; s++) {
      a += wobble(r, 0.9);
      x += Math.cos(a) * (10 + r() * 14);
      y += Math.sin(a) * (10 + r() * 14);
      d += `L${nums([x, y], 0)}`;
    }
  }
  return d;
}

function frame(seed: number) {
  const r = rng(seed);
  return {
    outer: handRect(7, 7, 226, 166, r, { wave: 0.9, over: 2.6 }),
    inner: handRect(14, 14, 212, 152, r, { wave: 0.7, over: 1.6 }),
    dots: handRect(10.5, 10.5, 219, 159, r, { wave: 0.4 }),
  };
}

/**
 * A 4:3 illustration for a project, in batik colors with a cap-stamp frame. Decorative
 * (aria-hidden): show the project's name and summary next to it. Unknown names get a kawung
 * tile with the turmeric dot.
 */
export function Postcard({ name, tone = "nila", className, style }: PostcardProps) {
  const seed = hash(name);
  const uid = `pc${seed.toString(36)}${tone[0]}`;
  const card: (() => ReactNode) | undefined = Object.hasOwn(CARDS, name) ? CARDS[name] : undefined;
  const f = frame(seed);

  return (
    <svg
      viewBox="0 0 240 180"
      className={className ? `art-postcard ${className}` : "art-postcard"}
      data-tone={tone}
      aria-hidden="true"
      focusable="false"
      style={{ ...(TONES[tone] as CSSProperties), ...style }}
    >
      <defs>
        <clipPath id={`${uid}-c`}>
          <rect x="14" y="14" width="212" height="152" />
        </clipPath>
        {card ? null : (
          <g
            dangerouslySetInnerHTML={{
              __html: batikPatternMarkup("kawung", `${uid}-k`, { ink: I, ground: G, tint: D, scale: 0.5 }),
            }}
          />
        )}
      </defs>
      <rect width="240" height="180" rx="6" fill={G} />
      <path d={crackle(seed)} fill="none" stroke={I} strokeWidth=".7" opacity=".13" />
      <g
        clipPath={`url(#${uid}-c)`}
        fill="none"
        stroke={I}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {card ? (
          card()
        ) : (
          <>
            <rect x="14" y="14" width="212" height="152" fill={`url(#${uid}-k)`} stroke="none" />
            <circle cx="120" cy="90" r="22" fill={G} />
            <circle cx="120" cy="90" r="13" fill={A} stroke="none" />
          </>
        )}
      </g>
      <g fill="none" stroke={I} strokeLinecap="round" strokeLinejoin="round">
        <path d={f.outer} strokeWidth="2" />
        <path d={f.inner} strokeWidth="1.1" />
        <path d={f.dots} strokeWidth="2" strokeDasharray="0 5.2" opacity=".8" />
      </g>
    </svg>
  );
}
