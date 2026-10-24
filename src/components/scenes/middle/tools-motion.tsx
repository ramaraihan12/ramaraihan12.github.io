"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { type ComponentPropsWithoutRef, useRef } from "react";
import { PRIORITY, REDUCE_MQ, scrollyOn } from "@/lib/scroll";
import { elementMarker, setMarker } from "@/lib/stage";
import { MOTION_MQ } from "./motion";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/** Seconds between two stamps in a row. */
const STAGGER = 0.07;

/**
 * The tools section's <section>, plus its motion. The markup comes from the server
 * (tools-section.tsx) already stamped; with motion allowed, each row's stamps lift off and get
 * pressed back on, one after another, the first time the row comes up.
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

        const rows = gsap.utils.toArray<HTMLElement>(".tool-row", section).map((row) => ({
          row,
          stamps: [...row.querySelectorAll<HTMLElement>(".cap-stamp")],
        }));

        for (const { row, stamps } of rows) {
          stamps.forEach((stamp, i) => {
            stamp.style.setProperty("--d", `${(i * STAGGER).toFixed(2)}s`);
            stamp.dataset.state = "ready";
          });
          ScrollTrigger.create({
            trigger: row,
            start: "top 86%",
            once: true,
            refreshPriority: PRIORITY.tools,
            onEnter: () => stamps.forEach((stamp) => (stamp.dataset.state = "pressed")),
          });
        }

        return () => {
          for (const { stamps } of rows) {
            for (const stamp of stamps) {
              stamp.dataset.state = "stamped";
              stamp.style.removeProperty("--d");
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
