"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { type CSSProperties, Fragment, type ReactNode, useRef } from "react";
import { queryCopy } from "@/content/copy";
import { intro, retrieval, steps } from "@/content/story";
import { EmbeddingMap, type Frame } from "@/lib/embedding-map";
import { MOBILE_MQ, PRIORITY, REDUCE_MQ, SCENE_MQ, scrollyOn } from "@/lib/scroll";
import { elementMarker, setMarkers } from "@/lib/stage";
import { chipDrag } from "./chip-drag";
import { landRig } from "./land-rig";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const { tokens } = retrieval;
// The tokens that open "Rama" and "Raihan". "Who is" goes on the first line, the name on the
// second, and phones give the surname a line of its own.
const [NAME, SURNAME] = tokens.flatMap((t, i) => (/^ R/.test(t.text) ? [i] : []));
const LINES = [
  tokens.slice(0, NAME).map((_, i) => i),
  tokens.slice(NAME).map((_, i) => NAME + i),
];
const isName = (i: number) => i >= NAME && tokens[i].text !== "?";

const formatNumber = (v: number) => v.toFixed(4);

/*
  The scene's timeline, in its own units. The pin is SCROLL screens tall, and the whole
  timeline is stretched over it.
*/
const SCROLL = 5.5;
const T = {
  tokens: 0.5,
  tokenized: 1.6,
  /** While the playhead is in here, the chips can be dragged. */
  drag: [1.45, 2.05],
  collapse: 2.15,
  embed: 2.4,
  embedded: 3.9,
  fold: 4.3,
  swap: 4.85,
  bloom: 4.95,
  retrieve: 5.45,
  hits: 6.45,
} as const;

/** The canvas query dot's diameter, in pixels. The sun shrinks to exactly this. */
const DOT = 11;

/** Distance from el's center to the top left of ancestor, ignoring transforms. */
function centerWithin(el: HTMLElement, ancestor: HTMLElement) {
  let x = el.offsetWidth / 2;
  let y = el.offsetHeight / 2;
  let node: HTMLElement | null = el;
  while (node && node !== ancestor) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { x, y };
}

function Token({ index, lineStart }: { index: number; lineStart: boolean }) {
  const { text, id } = tokens[index];
  const leadingSpace = text.startsWith(" ");
  return (
    <span className={isName(index) ? "tok tok-name" : "tok"} style={{ "--i": index } as CSSProperties}>
      {leadingSpace ? <span className={lineStart ? "tok-sp tok-sp-start" : "tok-sp"} /> : null}
      {text.trimStart()}
      <span className="tok-id">{id}</span>
    </span>
  );
}

/**
 * The opening: the question over Merbabu at dawn, its tokens, its embedding, and the map of
 * notes it's matched against. One pinned, scrubbed scene; a plain document
 * with reduced motion or without scripts. `land` is the server-rendered landscape.
 */
export function OpeningScene({ land }: { land: ReactNode }) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const section = root.current!;
      const q = <E extends Element = HTMLElement>(sel: string) => section.querySelector<E>(sel)!;
      const stage = q(".qs-stage");
      const mapBox = q(".qs-map");
      const canvas = q<HTMLCanvasElement>(".qs-canvas");
      const tip = q(".qs-tip");
      const cards = gsap.utils.toArray<HTMLElement>(".qs-card", section);
      const mm = gsap.matchMedia();

      // "all" always matches, so the callback runs on every screen, including landscape phones
      // that match none of the others, and builds the plain page there.
      mm.add({ scene: SCENE_MQ, mobile: MOBILE_MQ, reduce: REDUCE_MQ, any: "all" }, (ctx) => {
        const { scene, mobile, reduce } = ctx.conditions as Record<string, boolean>;
        const scrolly = scrollyOn() && scene && !reduce;

        const title = q(".qs-title");
        const caret = q(".qs-caret");

        // Where the question ends once it's in chips: the sun lands there, and the camera starts
        // pulling back from there.
        const anchorAt = (w: number, h: number) => {
          const keep = ["--wdth", "--chip"].map((p) => [p, title.style.getPropertyValue(p)] as const);
          title.style.setProperty("--wdth", "100");
          title.style.setProperty("--chip", "1");
          const c = centerWithin(caret, stage);
          const em = parseFloat(getComputedStyle(title).fontSize) || 16;
          for (const [p, v] of keep) {
            if (v) title.style.setProperty(p, v);
            else title.style.removeProperty(p);
          }
          return { x: Math.min(c.x + em * 0.42, w - 24), y: Math.min(Math.max(c.y, h * 0.2), h * 0.8) };
        };

        // Where the whole map fits once the camera has pulled back. On wide screens the cards
        // take the right side, so the map stops short of them; on phones they sit under it. The
        // map's own data decides where in that box the query ends up.
        const results = q(".qs-results");
        const frame = (w: number, h: number): Frame => {
          if (!scrolly) return { region: { x: 28, y: 36, w: w - 56, h: h - 64 } };
          const anchor = anchorAt(w, h);
          if (mobile) return { region: { x: w * 0.07, y: h * 0.24, w: w * 0.86, h: h * 0.48 }, anchor };
          const right = Math.min(w * 0.62, results.offsetLeft - 24);
          return { region: { x: w * 0.04, y: h * 0.13, w: right - w * 0.04, h: h * 0.64 }, anchor };
        };
        const map = new EmbeddingMap(canvas, retrieval, frame);

        // Hovering a dot shows its note; hovering a card lights its dot.
        const setHot = (index: number) => {
          map.highlight = index;
          cards.forEach((card, rank) => card.classList.toggle("is-hot", retrieval.top[rank].index === index));
          if (!scrolly) map.draw();
        };
        const showTip = (index: number) => {
          if (index < 0) {
            tip.hidden = true;
            return;
          }
          const note = retrieval.points[index];
          tip.querySelector(".qs-tip-src")!.textContent = note.source;
          tip.querySelector(".qs-tip-text")!.textContent = note.text;
          tip.hidden = false;
          const p = map.pointScreen(index);
          const left = Math.min(p.x + 14, mapBox.clientWidth - tip.offsetWidth - 12);
          const below = p.y + 14 + tip.offsetHeight < mapBox.clientHeight;
          tip.style.translate = `${Math.max(12, left)}px ${below ? p.y + 14 : p.y - tip.offsetHeight - 14}px`;
        };
        const onMove = (e: PointerEvent) => {
          if (e.pointerType !== "mouse") return;
          const r = canvas.getBoundingClientRect();
          const index = map.pick(e.clientX - r.left, e.clientY - r.top);
          if (index === map.highlight) return;
          setHot(index);
          showTip(index);
        };
        const onLeave = () => {
          setHot(-1);
          showTip(-1);
        };
        const cardEnter = cards.map((_, rank) => () => setHot(retrieval.top[rank].index));
        canvas.addEventListener("pointermove", onMove);
        canvas.addEventListener("pointerleave", onLeave);
        cards.forEach((card, rank) => {
          card.addEventListener("pointerenter", cardEnter[rank]);
          card.addEventListener("pointerleave", onLeave);
        });
        const removeHover = () => {
          canvas.removeEventListener("pointermove", onMove);
          canvas.removeEventListener("pointerleave", onLeave);
          cards.forEach((card, rank) => {
            card.removeEventListener("pointerenter", cardEnter[rank]);
            card.removeEventListener("pointerleave", onLeave);
          });
        };

        if (!scrolly) {
          // The plain page: everything drawn, top to bottom.
          map.complete();
          const draw = () => {
            map.resize();
            map.draw();
          };
          draw();
          const observer = new ResizeObserver(draw);
          observer.observe(canvas);
          const removeMarkers = setMarkers([
            ["query", { at: () => -1, to: () => 0 }],
            ["tokens", elementMarker(section.querySelector("#tokens")!)],
            ["embed", elementMarker(section.querySelector("#embed")!)],
            ["retrieve", elementMarker(section.querySelector("#retrieve")!)],
          ]);
          return () => {
            observer.disconnect();
            removeHover();
            removeMarkers();
          };
        }

        const chips = gsap.utils.toArray<HTMLElement>(".qs-title .tok", section);
        const ids = gsap.utils.toArray<HTMLElement>(".qs-title .tok-id", section);
        const [stepTokens, , stepRetrieve] = gsap.utils.toArray<HTMLElement>(".qs-step", section);
        const embedBody = q(".qs-step-embed .qs-step-body");
        const numbers = gsap.utils.toArray<HTMLElement>(".vec-n", section);
        const heroBits = gsap.utils.toArray<HTMLElement>(".qs-eyebrow, .qs-intro, .qs-hint", section);
        const resultsHead = q(".qs-results-head");
        const landBox = q(".qs-land");
        const sun = q(".qs-sun");
        const splash = q(".qs-splash");

        const rig = landRig(landBox);
        const drag = chipDrag(chips, title);

        const resize = () => {
          map.resize();
          rig.measure();
          const a = map.queryScreen();
          gsap.set(splash, { x: a.x, y: a.y });
        };
        resize();
        ScrollTrigger.addEventListener("refreshInit", resize);

        const loop = () => map.draw(performance.now());
        let looping = false;
        const play = (on: boolean) => {
          if (on === looping) return;
          looping = on;
          stage.classList.toggle("is-idle", !on);
          if (on) gsap.ticker.add(loop);
          else gsap.ticker.remove(loop);
        };

        // The hills follow a fine pointer a little, only while they're on screen.
        const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
        const onPoint = (e: PointerEvent) => {
          if (tl.time() > T.tokenized) return;
          rig.point((e.clientX / window.innerWidth - 0.5) * 48, (e.clientY / window.innerHeight - 0.5) * 20);
        };
        if (fine) window.addEventListener("pointermove", onPoint, { passive: true });

        // Offset that moves a token's center onto the query dot.
        const toQuery = (el: HTMLElement) => {
          const c = centerWithin(el, stage);
          const a = map.queryScreen();
          return { x: a.x - c.x, y: a.y - c.y };
        };
        // Offset that drops the sun onto the query dot, and the scale that makes it one.
        const sunTo = () => {
          const c = centerWithin(sun, stage);
          const a = map.queryScreen();
          return { x: a.x - c.x, y: a.y - c.y };
        };
        const dotScale = () => DOT / (sun.offsetWidth || DOT);

        // Opacity only, never visibility: hidden text stays in the accessibility tree.
        const captionIn = { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" };
        const captionOut = { opacity: 0, y: -16, duration: 0.35, ease: "power2.in" };
        const sink = { v: 0 };

        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: stage,
            refreshPriority: PRIORITY.query,
            pin: true,
            start: "top top",
            end: () => `+=${window.innerHeight * SCROLL}`,
            scrub: 0.6,
            invalidateOnRefresh: true,
            onToggle: (self) => play(self.isActive),
          },
          // The scrub keeps easing for a moment after the scene leaves the screen.
          onUpdate: () => {
            map.draw(performance.now());
            drag.set(tl.time() >= T.drag[0] && tl.time() <= T.drag[1]);
          },
        });

        // Query → tokens. The headline condenses and splits into the tokenizer's pieces, the land
        // falls away (the nearest hills fastest) and the sun drops out of the sky to where the
        // question ends: it's the query dot now. The hero bits and tokens have CSS entrance
        // animations, so their start values are given here instead of read from the page.
        tl.fromTo(heroBits, { opacity: 1, y: 0 }, { opacity: 0, y: -24, duration: 0.5, stagger: 0.05 }, 0)
          .to(title, { "--wdth": 100, "--chip": 1, duration: 1.2, ease: "power1.inOut" }, 0.1)
          .fromTo(
            sink,
            { v: 0 },
            { v: 1, duration: 1.3, ease: "power1.in", onUpdate: () => rig.sink(sink.v * stage.clientHeight * 0.5) },
            0.05,
          )
          .fromTo(landBox, { opacity: 1 }, { opacity: 0, duration: 0.7, ease: "power1.in" }, 0.45)
          .fromTo(
            sun,
            { x: 0, y: 0, scale: 1, opacity: 1 },
            { x: () => sunTo().x, y: () => sunTo().y, scale: dotScale, duration: 1, ease: "power2.in" },
            0.35,
          )
          .fromTo(splash, { opacity: 0.9, scale: 0.25 }, { opacity: 0, scale: 2.4, duration: 0.45, ease: "power1.out", immediateRender: false }, 1.35)
          .addLabel("tokens", T.tokens)
          .fromTo(ids, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.07 }, 0.7)
          .fromTo(stepTokens, { opacity: 0, y: 16 }, captionIn, 0.8)
          .addLabel("tokenized", T.tokenized)
          .to(stepTokens, captionOut, 2.0)

          // Embed. The tokens go into the dot one after another, and the numbers stream out.
          .to(ids, { opacity: 0, duration: 0.2 }, 2.1)
          .fromTo(
            chips,
            { x: 0, y: 0, scale: 1, opacity: 1 },
            {
              x: (_: number, el: HTMLElement) => toQuery(el).x,
              y: (_: number, el: HTMLElement) => toQuery(el).y,
              scale: 0.06,
              opacity: 0,
              duration: 0.55,
              ease: "power2.in",
              stagger: 0.05,
            },
            T.collapse,
          )
          .to(sun, { scale: () => dotScale() * 1.7, duration: 0.15, ease: "power1.out" }, 2.95)
          .to(sun, { scale: dotScale, duration: 0.3, ease: "power2.inOut" }, 3.1)
          .addLabel("embed", T.embed)
          .fromTo(embedBody, { opacity: 0, y: 16 }, captionIn, T.embed)
          .fromTo(numbers, { opacity: 0 }, { opacity: 1, duration: 0.1, stagger: 0.06 }, 2.6)
          .addLabel("embedded", T.embedded)

          // The canvas takes the dot over from the sun, and the map blooms out around it.
          .to(embedBody, captionOut, T.fold + 0.1)
          .to(sun, { opacity: 0, duration: 0.12 }, T.swap)
          .to(map.state, { query: 1, duration: 0.12 }, T.swap)
          .to(map.state, { alpha: 1, bloom: 1, duration: 1.4, ease: "power1.out" }, T.bloom)
          .to(map.state, { cam: 1, duration: 1.6, ease: "power1.inOut" }, T.bloom)
          .addLabel("retrieve", T.retrieve)
          .fromTo(stepRetrieve, { opacity: 0, y: 16 }, captionIn, T.retrieve + 0.1)
          .fromTo(resultsHead, { opacity: 0 }, { opacity: 1, duration: 0.3 }, T.retrieve + 0.6);

        // Retrieve: one line out to each of the five closest notes, and its card.
        retrieval.top.forEach((_, rank) => {
          const at = T.hits + rank * 0.75;
          tl.to(map.state.hits[rank], { v: 1, duration: 0.45, ease: "power1.out" }, at).fromTo(
            cards[rank],
            { opacity: 0, y: 24 },
            { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" },
            at + 0.25,
          );
          // Phones have room for one card at a time, so the previous one steps back.
          if (mobile && rank > 0) {
            tl.to(cards[rank - 1], { opacity: 0, y: -14, scale: 0.96, duration: 0.3 }, at + 0.25);
          }
        });
        tl.addLabel("done").to({}, { duration: 0.8 });

        const st = tl.scrollTrigger!;
        const at = (label: string) => () => st.start + (st.end - st.start) * (tl.labels[label] / tl.duration());
        const removeMarkers = setMarkers([
          ["query", { at: () => -1, to: () => 0 }],
          ["tokens", { at: at("tokens"), to: at("tokenized") }],
          ["embed", { at: at("embed"), to: at("embedded") }],
          ["retrieve", { at: at("retrieve"), to: at("done") }],
        ]);

        return () => {
          play(false);
          stage.classList.remove("is-idle");
          ScrollTrigger.removeEventListener("refreshInit", resize);
          window.removeEventListener("pointermove", onPoint);
          rig.kill();
          drag.kill();
          removeHover();
          removeMarkers();
        };
      });
    },
    { scope: root },
  );

  return (
    <section id="top" ref={root} className="qs" aria-labelledby="hero-title">
      <div className="qs-stage">
        {land}

        {/* The map repeats the notes for mouse users. The cards below carry the same content. */}
        <div className="qs-map" aria-hidden="true">
          <canvas className="qs-canvas" />
          <div className="qs-tip" hidden>
            <p className="qs-tip-src" />
            <p className="qs-tip-text" />
          </div>
        </div>

        <div className="qs-hero container-page">
          <p className="qs-eyebrow eyebrow">{queryCopy.eyebrow}</p>
          <h1 id="hero-title" className="qs-title">
            <span className="sr-only">{retrieval.question}</span>
            <span aria-hidden="true">
              {LINES.map((line, li) => (
                <span key={li} className="qs-line">
                  {line.map((index, k) => (
                    <Fragment key={index}>
                      {/* Phones put the surname on its own line, so the name can stay big. */}
                      {index === SURNAME ? <span className="qs-wrap" /> : null}
                      <Token index={index} lineStart={k === 0} />
                    </Fragment>
                  ))}
                  {li === LINES.length - 1 ? <span className="qs-caret" /> : null}
                </span>
              ))}
            </span>
          </h1>
          <p className="qs-intro">{intro}</p>
          <p className="qs-hint" aria-hidden="true">
            {queryCopy.scrollHint} <span className="qs-hint-arrow">↓</span>
          </p>
        </div>

        <ol className="qs-steps container-page">
          <li className="qs-step" id="tokens">
            <p className="eyebrow">{queryCopy.stepEyebrows.tokens}</p>
            <p className="qs-step-text">{steps.tokens}</p>
            <ol className="tok-row" aria-label={queryCopy.tokensLabel}>
              {tokens.map((t) => (
                <li key={t.id}>
                  <span>{t.text.replace(" ", "·")}</span>
                  <span className="tok-row-id">{t.id}</span>
                </li>
              ))}
            </ol>
          </li>
          <li className="qs-step qs-step-embed" id="embed">
            <div className="qs-step-body">
              <p className="eyebrow">{queryCopy.stepEyebrows.embed}</p>
              <p className="qs-step-text">{steps.embed}</p>
              <p className="vec">
                [
                {retrieval.queryHead.map((v, i) => (
                  <Fragment key={i}>
                    <span className="vec-n">{formatNumber(v)},</span>{" "}
                  </Fragment>
                ))}
                <span className="vec-n vec-more">{queryCopy.moreNumbers(retrieval.dims - retrieval.queryHead.length)}</span>]
              </p>
            </div>
          </li>
          <li className="qs-step">
            <p className="eyebrow">{queryCopy.stepEyebrows.retrieve}</p>
            <p className="qs-step-text">{steps.retrieve}</p>
          </li>
        </ol>

        <span className="qs-sun" aria-hidden="true" />
        <span className="qs-splash" aria-hidden="true" />

        <div className="qs-results" id="retrieve">
          <p className="qs-results-head eyebrow">{queryCopy.resultsHead(retrieval.top.length, retrieval.points.length)}</p>
          <ol className="qs-cards">
            {retrieval.top.map((t, rank) => {
              const note = retrieval.points[t.index];
              return (
                <li key={t.index} className="qs-card" style={{ "--s": t.score } as CSSProperties}>
                  <p className="qs-card-head">
                    <span className="qs-card-rank">{rank + 1}</span>
                    <span className="qs-card-src">{note.source}</span>
                    <span className="qs-card-score">
                      <span className="sr-only">{queryCopy.scoreLabel} </span>
                      {t.score.toFixed(3)}
                    </span>
                  </p>
                  <p className="qs-card-text">{note.text}</p>
                  <span className="qs-card-bar" aria-hidden="true" />
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
