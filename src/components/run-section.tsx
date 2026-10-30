import type { CSSProperties } from "react";
import { DuotoneFilter } from "@/components/art";
import { batikTile } from "@/components/art/files";
import { workCopy } from "@/content/copy";
import { aiProjects, webProjects } from "@/content/projects";
import { site } from "@/content/site";
import { ArrowUpRightIcon } from "./icons";
import { deckCopy } from "./scenes/middle/deck-strings";
import { ProjectPanel } from "./scenes/middle/project-panel";
import { RunRail } from "./scenes/middle/run-rail";
import { WebDivider } from "./scenes/middle/web-divider";

const pad = (n: number) => String(n).padStart(2, "0");

/*
  The work: the AI apps, then the web apps and the plumbing under them, in one list. Server
  markup; RunRail pins it and slides it sideways on wide screens, and on phones the list is a
  deck you swipe through, one card at a time, with the bar under it saying where you are.

  Screenshots are dyed nila and mori (shadows indigo, lights cotton) rather than nila and
  kunyit, which would turn a white app solid yellow. Projects without one get a piece of
  kawung cloth behind their postcard instead. Both are defined once here for every panel.
*/
export function RunSection() {
  const cloth = batikTile("run-cloth");
  const style = {
    "--cloth": cloth.css,
    "--cloth-tile": `${cloth.size}px`,
  } as CSSProperties;
  const total = aiProjects.length + webProjects.length;

  return (
    <RunRail id="work" className="run" aria-labelledby="run-title" style={style}>
      <DuotoneFilter id="duotone-nila-mori" shadow="#0f1a47" highlight="#efe9dc" />
      <div className="run-track">
        <div className="run-intro">
          <p className="eyebrow">{workCopy.eyebrow}</p>
          <h2 id="run-title" className="display-l mt-4">
            {workCopy.title}
          </h2>
          <p className="lead mt-5">{workCopy.lead}</p>
          <p className="run-hint" aria-hidden="true">
            {workCopy.scrollHint} <span>→</span>
          </p>
        </div>

        <ul className="run-deck" aria-label={deckCopy.label}>
          {aiProjects.map((project, i) => (
            <li key={project.name} className="run-card">
              <ProjectPanel project={project} index={i} />
            </li>
          ))}

          <li className="run-card" data-divider="">
            <WebDivider />
          </li>

          {webProjects.map((project, i) => (
            <li key={project.name} className="run-card">
              <ProjectPanel project={project} index={aiProjects.length + i} />
            </li>
          ))}
        </ul>

        <div className="run-deck-bar">
          <p className="run-deck-count" aria-hidden="true">
            <span className="run-deck-at">{pad(1)}</span>
            <span className="run-deck-of"> / {pad(total)}</span>
          </p>
          <div className="run-deck-nav">
            <button type="button" className="run-deck-btn" data-step="-1" aria-label={deckCopy.prev} aria-disabled="true">
              <span aria-hidden="true">←</span>
            </button>
            <button type="button" className="run-deck-btn" data-step="1" aria-label={deckCopy.next}>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>

        <div className="run-outro">
          <p>{workCopy.outro}</p>
          <a href={site.github} className="code-link">
            {workCopy.outroLink}
            <ArrowUpRightIcon className="size-4" />
          </a>
        </div>
      </div>
    </RunRail>
  );
}
