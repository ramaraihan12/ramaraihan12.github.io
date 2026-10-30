"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { type ComponentPropsWithoutRef, useRef } from "react";
import { PRIORITY, REDUCE_MQ, scrollyOn } from "@/lib/scroll";
import { elementMarker, setMarker } from "@/lib/stage";
import { MOTION_MQ } from "./motion";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/*
  Timeline units for one band. The band's motif goes on first, a cell at a time, the way a cap
  is walked along the cloth. The names follow, one cap every BEAT, each falling for DROP,
  pressing a touch past flat and settling back.
*/
const PRINT = 1.2;
const FIRST = 0.55;
const BEAT = 0.5;
const DROP = 0.75;
const SETTLE = 0.25;

/** Scroll, in px, for the band's motif and for each name after it. Capped at SPAN screens. */
const LEAD_PX = 140;
const CAP_PX = 46;
const SPAN = 0.55;

/**
 * The tools section's <section>, plus its motion. The markup comes from the server
 * (tools-section.tsx) already printed; with motion allowed, each band of the cloth is printed
 * again as it scrolls up the screen, scrubbed, so the caps come down in step with the reader.
 * The section stays in the page's flow: nothing here changes its size, so no pin or marker below
 * it moves.
 */
export function ToolsMotion(props: ComponentPropsWithoutRef<"section">) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const section = root.current!;
      const removeMarker = setMarker("tools", elementMarker(section));
      const mm = gsap.matchMedia();

      // One of the two always matches, so this runs on every screen and re-runs on a change.
      mm.add({ motion: MOTION_MQ, reduce: REDUCE_MQ }, (ctx) => {
        if (ctx.conditions?.reduce || !scrollyOn()) return;

        const bands = gsap.utils
          .toArray<HTMLElement>(".tool-band", section)
          .map((band) => ({
            band,
            print: band.querySelector<HTMLElement>(".tool-print"),
            caps: [...band.querySelectorAll<HTMLElement>(".tool-cap")],
          }));

        for (const [index, { band, print, caps }] of bands.entries()) {
          for (const cap of caps) {
            const stamp = cap.querySelector<HTMLElement>(".cap-stamp");
            if (stamp) stamp.dataset.state = "scrub";
          }

          const span = () =>
            Math.round(
              Math.min(
                window.innerHeight * SPAN,
                LEAD_PX + caps.length * CAP_PX,
              ),
            );
          // The first band must be finished where the section lands: under the header for the
          // nav, or under the scroll-padding for a native #tools jump. Either way a jump shows
          // printed names, not half-blank ones. Measured on refresh.
          const landing = () => {
            const header = Math.max(
              document.querySelector(".site-header")?.clientHeight ?? 0,
              parseFloat(
                getComputedStyle(document.documentElement).scrollPaddingTop,
              ) || 0,
            );
            return Math.round(
              header +
                band.getBoundingClientRect().top -
                section.getBoundingClientRect().top,
            );
          };
          // Band 0 is held to the landing only when it is really on screen there. On a short
          // screen (a phone on its side) it sits at the fold, so holding it would squeeze the
          // caps into a few px or print them before they show; it gets a normal window then.
          const first = () => {
            const vh = window.innerHeight;
            const land = landing();
            const s = span();
            if (vh - land >= s * 0.5) {
              return { start: Math.min(vh, land + s), end: land };
            }
            const start = Math.round(vh * 0.85);
            return { start, end: start - s };
          };

          const tl = gsap.timeline({
            defaults: { ease: "none" },
            scrollTrigger: {
              trigger: band,
              start:
                index === 0 ? () => `top ${first().start}px` : "top 85%",
              end:
                index === 0 ? () => `top ${first().end}px` : () => `+=${span()}`,
              scrub: 0.5,
              invalidateOnRefresh: true,
              refreshPriority: PRIORITY.tools,
            },
          });

          // One step per cell of the motif. The cells are square, as tall as the strip inside its
          // two wax lines (the padding). Measured on refresh.
          if (print) {
            const cells = () => {
              const { paddingTop, paddingBottom } = getComputedStyle(print);
              const cell =
                print.clientHeight -
                parseFloat(paddingTop) -
                parseFloat(paddingBottom);
              return Math.ceil(print.clientWidth / Math.max(1, cell));
            };
            tl.fromTo(
              print,
              { "--cells": 0 },
              { "--cells": cells, snap: { "--cells": 1 }, duration: PRINT },
              0,
            );
          }

          caps.forEach((cap, i) => {
            const at = FIRST + i * BEAT;
            tl.fromTo(
              cap,
              { "--press": 0 },
              { "--press": 1.06, duration: DROP, ease: "power2.in" },
              at,
            ).to(
              cap,
              { "--press": 1, duration: SETTLE, ease: "power1.out" },
              at + DROP,
            );
          });
        }

        return () => {
          for (const { print, caps } of bands) {
            print?.style.removeProperty("--cells");
            for (const cap of caps) {
              cap.style.removeProperty("--press");
              const stamp = cap.querySelector<HTMLElement>(".cap-stamp");
              if (stamp) stamp.dataset.state = "stamped";
            }
          }
        };
      });

      return removeMarker;
    },
    { scope: root },
  );

  return <section ref={root} {...props} />;
}
