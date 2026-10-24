"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { type ReactNode, useRef } from "react";
import { PRIORITY, REDUCE_MQ, SCENE_MQ, scrollToY, scrollyOn } from "@/lib/scroll";
import { elementMarker, setMarker } from "@/lib/stage";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/*
  The answer's motion, and nothing else. The markup and the art come from answer-scene.tsx, a
  server component, so the batik and the duotone never reach the browser as code. This wraps
  them in the section and runs the scroll timeline on what's inside.

  The header turns turmeric over the answer and the contact block, and back to nila where the
  sky over Merbabu starts (.contact-sky), since the footer below is nila too.
*/

export function AnswerStage({ children }: { children: ReactNode }) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const section = root.current!;
      const contact = document.getElementById("contact");
      // The tone ends where the sky begins, or at the end of the contact block without one.
      const sky = document.querySelector<HTMLElement>("#contact .contact-sky");
      const toneEnd = sky ?? contact;
      const toneEndEdge = sky ? "top" : "bottom";
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
          ScrollTrigger.create({
            trigger: section,
            refreshPriority: PRIORITY.answer - 0.5,
            start: () => `top ${headerHeight()}`,
            endTrigger: toneEnd,
            end: () => `${toneEndEdge} ${headerHeight()}`,
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
        // Only clip-path, opacity and transforms move, so nothing here lays the page out again.
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
          endTrigger: toneEnd,
          end: () => `${toneEndEdge} ${headerHeight()}`,
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
      {children}
    </section>
  );
}
