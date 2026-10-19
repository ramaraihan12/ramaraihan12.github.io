"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";
import { stack } from "@/content/stack";
import { PRIORITY, REDUCE_MQ, scrollyOn } from "@/lib/scroll";
import { elementMarker, setMarker } from "@/lib/stage";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export function ToolsSection() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const section = root.current!;
      const removeMarker = setMarker("tools", elementMarker(section));

      const mm = gsap.matchMedia();
      mm.add({ reduce: REDUCE_MQ }, (ctx) => {
        if (ctx.conditions?.reduce || !scrollyOn()) return;
        // Each row's names stretch out from the condensed width as the row comes up.
        for (const row of gsap.utils.toArray<HTMLElement>(".tool-row", section)) {
          gsap.fromTo(
            row.querySelectorAll(".tool-items li"),
            { "--w": 50, opacity: 0, y: 18 },
            {
              "--w": 100,
              opacity: 1,
              y: 0,
              duration: 0.9,
              ease: "power3.out",
              stagger: 0.05,
              scrollTrigger: { trigger: row, start: "top 82%", refreshPriority: PRIORITY.tools },
            },
          );
        }
      });
      return removeMarker;
    },
    { scope: root },
  );

  return (
    <section id="tools" ref={root} className="tools" aria-labelledby="tools-title">
      <div className="container-page">
        <p className="eyebrow">tools</p>
        <h2 id="tools-title" className="display-l mt-4">
          What I work with
        </h2>
        <p className="lead mt-5">
          Client work runs on the web stack. My recent projects use the AI tools.
        </p>

        <ul className="tools-list">
          {stack.map((group) => (
            <li key={group.key} className="tool-row">
              <h3 className="tool-key">
                <span className="sr-only">{group.name}: </span>
                <span aria-hidden="true">{group.key}</span>
              </h3>
              <div>
                <ul className="tool-items">
                  {group.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p className="tool-note">{group.note}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
