"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { type ComponentPropsWithoutRef, useRef } from "react";
import { PRIORITY, RAIL_MQ, REDUCE_MQ, scrollToY, scrollyOn } from "@/lib/scroll";
import { elementMarker, setMarker } from "@/lib/stage";
import { MOTION_MQ } from "./motion";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * Scroll per pixel of sideways travel. Under 1, the rail moves a little faster than the wheel,
 * so twelve panels don't take forever.
 */
const PACE = 0.8;

/** What --in moves: the art box, the postcard and whatever sits behind it. */
const ART = ".project-art, .project-card, .project-back";

/** How many screen widths ahead of the view a screenshot starts loading. */
const AHEAD = 2.5;

/**
 * The work section's <section>, plus its motion. The panels are server markup
 * (run-section.tsx); this pins the section on wide screens and slides the track sideways,
 * runs each pipeline's dot (--p) and brings each panel's art in (--in) as it arrives.
 */
export function RunRail(props: ComponentPropsWithoutRef<"section">) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const section = root.current!;
      const track = section.querySelector<HTMLElement>(".run-track")!;
      const panels = gsap.utils.toArray<HTMLElement>(".project", section);
      const mm = gsap.matchMedia();

      // One of motion and reduce always matches, so every branch below registers the marker.
      mm.add({ motion: MOTION_MQ, rail: RAIL_MQ, reduce: REDUCE_MQ }, (ctx) => {
        const { rail, reduce } = ctx.conditions as Record<string, boolean>;
        if (reduce || !scrollyOn()) return setMarker("work", elementMarker(section));

        if (!rail) {
          // Stacked panels: the dot runs down each pipeline and the art settles as it scrolls by.
          const removeMarker = setMarker("work", elementMarker(section));
          for (const panel of panels) {
            const pipe = panel.querySelector(".pipe");
            if (pipe) {
              gsap.fromTo(
                pipe,
                { "--p": 0 },
                {
                  "--p": 1,
                  ease: "none",
                  scrollTrigger: {
                    trigger: pipe,
                    start: "top 80%",
                    end: "bottom 40%",
                    scrub: 0.4,
                    refreshPriority: PRIORITY.work,
                  },
                },
              );
            }
            gsap.fromTo(
              panel.querySelectorAll(ART),
              { "--in": 0 },
              {
                "--in": 1,
                ease: "none",
                scrollTrigger: {
                  trigger: panel.querySelector(".project-art"),
                  start: "top bottom",
                  end: "center 55%",
                  scrub: 0.5,
                  refreshPriority: PRIORITY.work,
                },
              },
            );
          }
          return removeMarker;
        }

        // Wide screens: the section pins and the panels slide past sideways.
        const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);

        // The section clips the track, so native lazy loading only starts a screenshot once it's
        // already sliding into view, and it pops in. Ask for each one a couple of screens early.
        const lazy = panels.flatMap((panel) => {
          const imgs = [...panel.querySelectorAll<HTMLImageElement>("img[loading='lazy']")];
          return imgs.length ? [{ panel, imgs }] : [];
        });
        let next = 0;
        const loadAhead = () => {
          const reach = -Number(gsap.getProperty(track, "x")) + window.innerWidth * AHEAD;
          while (next < lazy.length && lazy[next].panel.offsetLeft < reach) {
            for (const img of lazy[next++].imgs) img.loading = "eager";
          }
        };
        ScrollTrigger.create({
          trigger: section,
          start: "top bottom+=50%",
          once: true,
          refreshPriority: PRIORITY.work,
          onEnter: loadAhead,
        });

        const slide = gsap.to(track, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: {
            trigger: section,
            refreshPriority: PRIORITY.work,
            pin: true,
            start: "top top",
            end: () => `+=${Math.round(distance() * PACE)}`,
            scrub: 0.6,
            invalidateOnRefresh: true,
            onUpdate: loadAhead,
          },
        });

        for (const panel of panels) {
          const pipe = panel.querySelector(".pipe");
          if (pipe) {
            gsap.fromTo(
              pipe,
              { "--p": 0 },
              {
                "--p": 1,
                ease: "none",
                scrollTrigger: {
                  trigger: panel,
                  refreshPriority: PRIORITY.work,
                  containerAnimation: slide,
                  start: "left 78%",
                  end: "left 16%",
                  scrub: 0.4,
                },
              },
            );
          }
          gsap.fromTo(
            panel.querySelectorAll(ART),
            { "--in": 0 },
            {
              "--in": 1,
              ease: "none",
              scrollTrigger: {
                trigger: panel,
                refreshPriority: PRIORITY.work,
                containerAnimation: slide,
                start: "left 100%",
                end: "left 30%",
                scrub: 0.5,
              },
            },
          );
        }

        const st = slide.scrollTrigger!;
        const removeMarker = setMarker("work", { at: () => st.start - window.innerHeight * 0.5, to: () => st.start });

        // Tabbing into a panel that's still off to the side scrolls the page until it's in view.
        // The browser may also scroll the clipped section sideways on focus, so undo that.
        const onFocus = (e: FocusEvent) => {
          section.scrollLeft = 0;
          const panel = (e.target as Element).closest<HTMLElement>(".panel, .run-outro");
          if (!panel) return;
          const x = panel.offsetLeft - (window.innerWidth - panel.offsetWidth) / 2;
          const perPixel = distance() ? (st.end - st.start) / distance() : 0;
          scrollToY(st.start + gsap.utils.clamp(0, distance(), x) * perPixel);
        };
        track.addEventListener("focusin", onFocus);
        return () => {
          track.removeEventListener("focusin", onFocus);
          removeMarker();
        };
      });
    },
    { scope: root },
  );

  return <section ref={root} {...props} />;
}
