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

      // A tap on a citation or a source lights it with its sentence and source. Mouse and
      // keyboard do it in CSS (answer.css); a finger has no hover, so it sets data-lit here.
      // Tapping the same one again, or anywhere else, puts it out.
      const onTap = (e: Event) => {
        const hit = (e.target as Element).closest<HTMLElement>(".cite[data-note], .answer-sources li[data-note]");
        const n = hit?.dataset.note;
        if (n && section.dataset.lit !== n) section.dataset.lit = n;
        else delete section.dataset.lit;
      };
      section.addEventListener("click", onTap);

      const mm = gsap.matchMedia();
      // gsap only runs this while at least one condition matches. "motion" and "reduce" make
      // sure one always does, so a short screen with motion allowed (a phone held sideways)
      // still gets the plain version's tone switch and stage marker.
      mm.add({ scene: SCENE_MQ, motion: "(prefers-reduced-motion: no-preference)", reduce: REDUCE_MQ }, (ctx) => {
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
        const notes = gsap.utils.toArray<HTMLElement>(".an-note", section);
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

        /*
          The five notes. Before the pin they drift in from the edges of the screen to wait
          round the query dot (their rings and names, as on the map). Once the flood is over
          them they are dyed like everything else, and each flies to its citation, to land as
          the answer's words reach it: the citation is inked, heavier for a higher score. All of
          it sits inside the timeline's length, so its labels stay where they were.
        */
        const rect = (el: Element) => el.getBoundingClientRect();
        const wordIndex = (cite: Element) => words.indexOf(cite as HTMLElement);
        const total = words.length;
        notes.forEach((note, i) => {
          const n = i + 1;
          const cite = section.querySelector<HTMLElement>(`.cite[data-note="${n}"]`);
          const fly = note.querySelector<HTMLElement>(".an-fly")!;
          if (!cite) return;
          // When the word writes in: the same formula as the words' own stagger above.
          const lands = 1.1 + (wordIndex(cite) / total) * 2;
          const leaves = Math.min(0.5 + i * 0.08, lands - 0.5);
          // The offsets are read when ScrollTrigger refreshes, not while scrolling. The note's
          // own box never moves (only its children do), so it's a fixed point to measure from.
          const to = (axis: "x" | "y") => () => {
            const a = rect(cite);
            const b = rect(note);
            return axis === "x" ? a.left + a.width / 2 - b.left : a.top + a.height / 2 - b.top;
          };
          tl.to(fly, { x: to("x"), y: to("y"), scale: 0.62, duration: lands - leaves - 0.05, ease: "power2.inOut" }, leaves)
            .to(fly, { opacity: 0, duration: 0.08 }, lands - 0.1)
            .fromTo(cite, { "--ink": 0 }, { "--ink": 1, duration: 0.14, ease: "power2.out" }, lands - 0.1);
        });
        tl.set(notes, { "--dye": 1 }, 0.4).to(".an-label", { opacity: 0, duration: 0.25 }, 0.55);

        // Before the pin: the notes arrive from the edges. This scrubs on its own trigger, the
        // stretch of scroll leading up to the pin, where there used to be only the seed dot.
        gsap.fromTo(
          notes.map((n) => n.querySelector(".an-drift")),
          {
            x: (i: number) => (Number(notes[i].dataset.far!.split(" ")[0]) * window.innerWidth),
            y: (i: number) => (Number(notes[i].dataset.far!.split(" ")[1]) * window.innerHeight),
            opacity: 0,
          },
          {
            x: 0,
            y: 0,
            opacity: 1,
            ease: "power2.out",
            stagger: 0.12,
            scrollTrigger: {
              trigger: section,
              refreshPriority: PRIORITY.answer - 0.25,
              start: "top 90%",
              end: "top top",
              scrub: 0.6,
              invalidateOnRefresh: true,
            },
          },
        );

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
      return () => section.removeEventListener("click", onTap);
    },
    { scope: root },
  );

  return (
    <section id="answer" ref={root} className="answer" aria-labelledby="answer-title">
      {children}
    </section>
  );
}
