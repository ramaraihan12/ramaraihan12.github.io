"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";
import { aiProjects } from "@/content/projects";
import { site } from "@/content/site";
import { PRIORITY, RAIL_MQ, REDUCE_MQ, scrollToY, scrollyOn } from "@/lib/scroll";
import { elementMarker, setMarker } from "@/lib/stage";
import { ArrowUpRightIcon } from "./icons";
import { Pipeline } from "./pipeline";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export function RunSection() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const section = root.current!;
      const track = section.querySelector<HTMLElement>(".run-track")!;
      const panels = gsap.utils.toArray<HTMLElement>(".project", section);
      const mm = gsap.matchMedia();

      mm.add({ rail: RAIL_MQ, reduce: REDUCE_MQ }, (ctx) => {
        const { rail, reduce } = ctx.conditions as Record<string, boolean>;
        if (reduce || !scrollyOn()) return setMarker("work", elementMarker(section));

        if (!rail) {
          // Stacked panels: the dot runs down each pipeline as it scrolls through the screen.
          const removeMarker = setMarker("work", elementMarker(section));
          for (const panel of panels) {
            gsap.fromTo(
              panel.querySelector(".pipe"),
              { "--p": 0 },
              {
                "--p": 1,
                ease: "none",
                scrollTrigger: {
                  trigger: panel.querySelector(".pipe"),
                  start: "top 80%",
                  end: "bottom 40%",
                  scrub: 0.4,
                  refreshPriority: PRIORITY.work,
                },
              },
            );
          }
          return removeMarker;
        }

        // Wide screens: the section pins and the panels slide past sideways.
        const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);
        const slide = gsap.to(track, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: {
            trigger: section,
            refreshPriority: PRIORITY.work,
            pin: true,
            start: "top top",
            end: () => `+=${distance()}`,
            scrub: 0.6,
            invalidateOnRefresh: true,
          },
        });

        for (const panel of panels) {
          gsap.fromTo(
            panel.querySelector(".pipe"),
            { "--p": 0 },
            {
              "--p": 1,
              ease: "none",
              scrollTrigger: {
                trigger: panel,
                refreshPriority: PRIORITY.work,
                containerAnimation: slide,
                start: "left 78%",
                end: "left -4%",
                scrub: 0.4,
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
          scrollToY(st.start + gsap.utils.clamp(0, distance(), x));
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

  return (
    <section id="work" ref={root} className="run" aria-labelledby="run-title">
      <div className="run-track">
        <div className="run-intro">
          <p className="eyebrow">work</p>
          <h2 id="run-title" className="display-l mt-4">
            Eight AI apps I built
          </h2>
          <p className="lead mt-5">
            Most run on a local model through Ollama by default, so you can try them without an
            API key.
          </p>
          <p className="run-hint" aria-hidden="true">
            keep scrolling <span>→</span>
          </p>
        </div>

        {aiProjects.map((project) => (
          <article key={project.name} className="panel project" aria-labelledby={`project-${project.name}`}>
            <p className="project-kind">{project.kind}</p>
            <h3 id={`project-${project.name}`} className="project-name">
              {project.name}
            </h3>
            <p className="project-summary">{project.summary}</p>
            {project.flow ? <Pipeline steps={project.flow} /> : null}
            <div className="project-foot">
              <ul className="chips" aria-label="Stack">
                {project.stack.map((tech) => (
                  <li key={tech}>{tech}</li>
                ))}
              </ul>
              <a href={project.href} className="code-link">
                Read the code<span className="sr-only"> for {project.name}</span>
                <ArrowUpRightIcon className="size-4" />
              </a>
            </div>
          </article>
        ))}

        <div className="run-outro">
          <p>Everything else, including the commits, is on GitHub.</p>
          <a href={site.github} className="code-link">
            github.com/ramaraihan12
            <ArrowUpRightIcon className="size-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
