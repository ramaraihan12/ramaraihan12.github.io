"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { type CSSProperties, Fragment, useRef } from "react";
import { intro, retrieval, steps } from "@/content/story";
import { EmbeddingMap, type Region } from "@/lib/embedding-map";
import { MOBILE_MQ, PRIORITY, REDUCE_MQ, SCENE_MQ, scrollyOn } from "@/lib/scroll";
import { elementMarker, setMarkers } from "@/lib/stage";

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

export function QueryScene() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const section = root.current!;
      const stage = section.querySelector<HTMLElement>(".qs-stage")!;
      const mapBox = section.querySelector<HTMLElement>(".qs-map")!;
      const canvas = section.querySelector<HTMLCanvasElement>(".qs-canvas")!;
      const tip = section.querySelector<HTMLElement>(".qs-tip")!;
      const cards = gsap.utils.toArray<HTMLElement>(".qs-card", section);
      const mm = gsap.matchMedia();

      mm.add({ scene: SCENE_MQ, mobile: MOBILE_MQ, reduce: REDUCE_MQ }, (ctx) => {
        const { scene, mobile, reduce } = ctx.conditions as Record<string, boolean>;
        const scrolly = scrollyOn() && scene && !reduce;

        // Where the whole map fits once the camera has pulled back. On wide screens the
        // cards take the right side; on phones they sit under the map.
        const region = (w: number, h: number): Region => {
          if (!scrolly) return { x: 28, y: 36, w: w - 56, h: h - 64 };
          if (mobile) return { x: w * 0.08, y: h * 0.27, w: w * 0.84, h: h * 0.3 };
          return { x: w * 0.05, y: h * 0.15, w: w * 0.56, h: h * 0.6 };
        };
        const map = new EmbeddingMap(canvas, retrieval, region);

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

        const title = section.querySelector<HTMLElement>(".qs-title")!;
        const chips = gsap.utils.toArray<HTMLElement>(".qs-title .tok", section);
        const ids = gsap.utils.toArray<HTMLElement>(".qs-title .tok-id", section);
        const [stepTokens, stepEmbed, stepRetrieve] = gsap.utils.toArray<HTMLElement>(".qs-step", section);
        const numbers = gsap.utils.toArray<HTMLElement>(".vec-n", section);
        const heroBits = gsap.utils.toArray<HTMLElement>(".qs-eyebrow, .qs-intro, .qs-hint", section);
        const resultsHead = section.querySelector<HTMLElement>(".qs-results-head")!;

        const resize = () => map.resize();
        resize();
        ScrollTrigger.addEventListener("refreshInit", resize);

        const loop = () => map.draw(performance.now());
        let looping = false;
        const play = (on: boolean) => {
          if (on === looping) return;
          looping = on;
          if (on) gsap.ticker.add(loop);
          else gsap.ticker.remove(loop);
        };

        // Offset that moves a token's center onto the query dot.
        const toQuery = (el: HTMLElement) => {
          const c = centerWithin(el, stage);
          const q = map.queryScreen();
          return { x: q.x - c.x, y: q.y - c.y };
        };

        // Opacity only, never visibility: hidden text stays in the accessibility tree.
        const captionIn = { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" };
        const captionOut = { opacity: 0, y: -16, duration: 0.35, ease: "power2.in" };

        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: stage,
            refreshPriority: PRIORITY.query,
            pin: true,
            start: "top top",
            end: () => `+=${window.innerHeight * 5}`,
            scrub: 0.6,
            invalidateOnRefresh: true,
            onToggle: (self) => play(self.isActive),
          },
          // The scrub keeps easing for a moment after the scene leaves the screen.
          onUpdate: () => map.draw(performance.now()),
        });

        // Tokenize: the headline condenses and splits into the tokenizer's pieces. The hero bits
        // and tokens have CSS entrance animations, so their start values are given here instead
        // of read from the page, which could catch them mid-animation.
        tl.fromTo(heroBits, { opacity: 1, y: 0 }, { opacity: 0, y: -24, duration: 0.5, stagger: 0.05 }, 0)
          .to(title, { "--wdth": 100, "--chip": 1, duration: 1.2, ease: "power1.inOut" }, 0.1)
          .addLabel("tokens", 0.5)
          .fromTo(ids, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.07 }, 0.7)
          .fromTo(stepTokens, { opacity: 0, y: 16 }, captionIn, 0.8)
          .addLabel("tokenized", 1.6)
          .to(stepTokens, captionOut, 2.1)

          // Embed: the real first numbers of the query vector stream in.
          .addLabel("embed", 2.3)
          .fromTo(stepEmbed, { opacity: 0, y: 16 }, captionIn, 2.3)
          .fromTo(numbers, { opacity: 0 }, { opacity: 1, duration: 0.1, stagger: 0.05 }, 2.5)
          .addLabel("embedded", 3.3)
          .to(ids, { opacity: 0, duration: 0.3 }, 3.4)

          // The tokens collapse into one point, and the map of notes blooms out around it.
          .fromTo(
            chips,
            { x: 0, y: 0, scale: 1, opacity: 1 },
            {
              x: (_: number, el: HTMLElement) => toQuery(el).x,
              y: (_: number, el: HTMLElement) => toQuery(el).y,
              scale: 0.06,
              opacity: 0,
              duration: 0.9,
              ease: "power2.in",
              stagger: 0.04,
            },
            3.5,
          )
          .to(stepEmbed, captionOut, 3.7)
          .to(map.state, { query: 1, duration: 0.3, ease: "back.out(3)" }, 4.25)
          .to(map.state, { alpha: 1, bloom: 1, duration: 1.4, ease: "power1.out" }, 4.4)
          .to(map.state, { cam: 1, duration: 1.6, ease: "power1.inOut" }, 4.4)
          .addLabel("retrieve", 4.9)
          .fromTo(stepRetrieve, { opacity: 0, y: 16 }, captionIn, 5)
          .fromTo(resultsHead, { opacity: 0 }, { opacity: 1, duration: 0.3 }, 5.5);

        // Retrieve: one line out to each of the five closest notes, and its card.
        retrieval.top.forEach((_, rank) => {
          const at = 5.9 + rank * 0.75;
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
          ScrollTrigger.removeEventListener("refreshInit", resize);
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
        {/* The map repeats the notes for mouse users. The cards below carry the same content. */}
        <div className="qs-map" aria-hidden="true">
          <canvas className="qs-canvas" />
          <div className="qs-tip" hidden>
            <p className="qs-tip-src" />
            <p className="qs-tip-text" />
          </div>
        </div>

        <div className="qs-hero container-page">
          <p className="qs-eyebrow eyebrow">query</p>
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
            scroll to run <span className="qs-hint-arrow">↓</span>
          </p>
        </div>

        <ol className="qs-steps container-page">
          <li className="qs-step" id="tokens">
            <p className="eyebrow">tokens</p>
            <p className="qs-step-text">{steps.tokens}</p>
            <ol className="tok-row" aria-label="Tokens">
              {tokens.map((t) => (
                <li key={t.id}>
                  <span>{t.text.replace(" ", "·")}</span>
                  <span className="tok-row-id">{t.id}</span>
                </li>
              ))}
            </ol>
          </li>
          <li className="qs-step" id="embed">
            <p className="eyebrow">embed</p>
            <p className="qs-step-text">{steps.embed}</p>
            <p className="vec">
              [
              {retrieval.queryHead.map((v, i) => (
                <Fragment key={i}>
                  <span className="vec-n">{formatNumber(v)},</span>{" "}
                </Fragment>
              ))}
              <span className="vec-n vec-more">
                … {(retrieval.dims - retrieval.queryHead.length).toLocaleString("en-US")} more
              </span>
              ]
            </p>
          </li>
          <li className="qs-step">
            <p className="eyebrow">retrieve</p>
            <p className="qs-step-text">{steps.retrieve}</p>
          </li>
        </ol>

        <div className="qs-results" id="retrieve">
          <p className="qs-results-head eyebrow">
            top {retrieval.top.length} of {retrieval.points.length} · cosine similarity
          </p>
          <ol className="qs-cards">
            {retrieval.top.map((t, rank) => {
              const note = retrieval.points[t.index];
              return (
                <li key={t.index} className="qs-card" style={{ "--s": t.score } as CSSProperties}>
                  <p className="qs-card-head">
                    <span className="qs-card-rank">{rank + 1}</span>
                    <span className="qs-card-src">{note.source}</span>
                    <span className="qs-card-score">
                      <span className="sr-only">similarity </span>
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
