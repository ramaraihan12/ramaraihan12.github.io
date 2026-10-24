"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import { Fragment, useRef } from "react";
import { answer, retrieval, sourceLinks } from "@/content/story";
import { site } from "@/content/site";
import { PRIORITY, REDUCE_MQ, SCENE_MQ, scrollToY, scrollyOn } from "@/lib/scroll";
import { elementMarker, setMarker } from "@/lib/stage";
import { ArrowUpRightIcon } from "./icons";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const notesUrl = `${site.source}/blob/main/scripts/notes.json`;

/** Splits the answer into words, with "[n]" turned into a citation link. */
function AnswerText() {
  const words = answer.replace(/ \[/g, "[").split(" ");
  return words.map((word, i) => (
    <Fragment key={i}>
      {word.split(/(\[\d\])/).map((part, k) => {
        const cite = part.match(/^\[(\d)\]$/);
        if (cite) {
          return (
            <sup key={k} className="cite w">
              <a href={`#source-${cite[1]}`} aria-label={`source ${cite[1]}`}>
                {cite[1]}
              </a>
            </sup>
          );
        }
        return part ? (
          <span key={k} className="w">
            {part}
          </span>
        ) : null;
      })}{" "}
    </Fragment>
  ));
}

export function AnswerScene() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const section = root.current!;
      const contact = document.getElementById("contact");
      const header = document.querySelector<HTMLElement>(".site-header");
      const setTone = (kunyit: boolean) => {
        if (header) header.dataset.tone = kunyit ? "kunyit" : "nila";
      };

      const mm = gsap.matchMedia();
      mm.add({ scene: SCENE_MQ, reduce: REDUCE_MQ }, (ctx) => {
        const { scene, reduce } = ctx.conditions as Record<string, boolean>;
        const scrolly = scrollyOn() && scene && !reduce;
        const headerHeight = () => header?.offsetHeight ?? 0;

        if (!scrolly) {
          const removeMarker = setMarker("answer", elementMarker(section));
          // The header turns turmeric while it sits over the answer and the contact block.
          ScrollTrigger.create({
            trigger: section,
            refreshPriority: PRIORITY.answer,
            start: () => `top ${headerHeight()}`,
            endTrigger: contact,
            end: () => `bottom ${headerHeight()}`,
            onToggle: (self) => setTone(self.isActive),
          });
          return () => {
            setTone(false);
            removeMarker();
          };
        }

        const bg = section.querySelector<HTMLElement>(".answer-bg")!;
        const words = gsap.utils.toArray<HTMLElement>(".answer-text .w", section);
        const photo = section.querySelector<HTMLElement>(".answer-photo")!;
        const late = gsap.utils.toArray<HTMLElement>(".answer-sources, .answer-note", section);
        const fullCircle = () => `circle(${Math.hypot(window.innerWidth, window.innerHeight) / 2 + 20}px at 50% 50%)`;

        // The query dot arrives and floods the screen, then the answer writes itself in.
        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: section,
            refreshPriority: PRIORITY.answer,
            pin: true,
            start: "top top",
            end: () => `+=${window.innerHeight * 2.6}`,
            scrub: 0.6,
            invalidateOnRefresh: true,
          },
        });
        tl.fromTo(bg, { clipPath: "circle(7px at 50% 50%)" }, { clipPath: fullCircle, duration: 1, ease: "power1.inOut" }, 0)
          .addLabel("covered", 0.9)
          // The text waits for the background, or its faded words show through the circle.
          .fromTo(".answer-text", { opacity: 0 }, { opacity: 1, duration: 0.1 }, 1)
          .fromTo(".answer-eyebrow", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.3 }, 1)
          .fromTo(
            photo,
            { clipPath: "inset(0% 0% 100% 0%)" },
            { clipPath: "inset(0% 0% 0% 0%)", duration: 0.6, ease: "power2.out" },
            1,
          )
          .fromTo(words, { opacity: 0.14 }, { opacity: 1, duration: 0.25, stagger: 2 / words.length }, 1.1)
          .fromTo(late, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.3, stagger: 0.1 }, 3.3)
          .addLabel("done", 3.8)
          .to({}, { duration: 0.4 });

        const st = tl.scrollTrigger!;
        const at = (label: string) => st.start + (st.end - st.start) * (tl.labels[label] / tl.duration());
        const removeMarker = setMarker("answer", { at: () => st.start - window.innerHeight * 0.3, to: () => at("done") });

        // Tabbing to a citation or source while the answer is still writing itself in jumps
        // to the finished answer, so the focused link is visible.
        const onFocus = () => {
          if (window.scrollY < at("done") - 2) scrollToY(at("done"));
        };
        section.addEventListener("focusin", onFocus);

        // This one reads the timeline's start and needs the answer's pin spacer in place to
        // measure the contact block, so it has to refresh after the timeline. Without a trigger
        // element it sorts by its own start, which is still 0 from its first refresh, so at the
        // same priority it goes first. When fonts are cached, the one full refresh can come
        // before the timeline was ever measured (a timeline's trigger waits a tick for that),
        // and the header then turned turmeric from the top of the page. Half a step lower
        // keeps it after every trigger of the answer scene.
        ScrollTrigger.create({
          refreshPriority: PRIORITY.answer - 0.5,
          start: () => at("covered"),
          endTrigger: contact,
          end: () => `bottom ${headerHeight()}`,
          onToggle: (self) => setTone(self.isActive),
        });
        return () => {
          setTone(false);
          removeMarker();
          section.removeEventListener("focusin", onFocus);
        };
      });
    },
    { scope: root },
  );

  return (
    <section id="answer" ref={root} className="answer" aria-labelledby="answer-title">
      <div className="answer-bg" aria-hidden="true" />
      <div className="answer-inner container-page">
        <p className="answer-eyebrow eyebrow">
          answer · from the {retrieval.top.length} notes above
        </p>
        <h2 id="answer-title" className="sr-only">
          The answer
        </h2>

        <div className="answer-grid">
          <div className="answer-photo">
            {/* A head-and-shoulders crop on phones, where the full portrait would be tiny. */}
            <Image
              src="/images/rama-avatar.jpg"
              alt="Rama Raihan in a black tuxedo and bow tie"
              width={384}
              height={384}
              sizes="96px"
              className="answer-photo-small"
            />
            <Image
              src="/images/rama.jpg"
              alt="Rama Raihan in a black tuxedo and bow tie, standing in a garden"
              width={900}
              height={1200}
              sizes="(min-width: 768px) 320px, 1px"
              className="answer-photo-large"
            />
          </div>
          <p className="answer-text">
            <AnswerText />
          </p>
        </div>

        <ol className="answer-sources" aria-label="Sources">
          {retrieval.top.map((t, rank) => {
            const note = retrieval.points[t.index];
            const href = sourceLinks[note.source];
            return (
              <li key={t.index} id={`source-${rank + 1}`}>
                <span className="answer-source-n">{rank + 1}</span>
                {href ? (
                  <a href={href}>
                    {note.source}
                    <ArrowUpRightIcon className="size-3" />
                  </a>
                ) : (
                  <span>{note.source}</span>
                )}
                <span className="answer-source-score">{t.score.toFixed(3)}</span>
              </li>
            );
          })}
        </ol>

        <p className="answer-note">
          The tokens, numbers and scores up top are real, from a model on my laptop. This answer
          isn&apos;t generated. I wrote it from those five notes.{" "}
          <a href={notesUrl}>All {retrieval.points.length} notes</a>
        </p>
      </div>
    </section>
  );
}
