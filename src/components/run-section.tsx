import type { CSSProperties } from "react";
import { batikDataUri, batikTileSize, DuotoneFilter } from "@/components/art";
import { workCopy } from "@/content/copy";
import { aiProjects, webProjects } from "@/content/projects";
import { site } from "@/content/site";
import { ArrowUpRightIcon } from "./icons";
import { ProjectPanel } from "./scenes/middle/project-panel";
import { RunRail } from "./scenes/middle/run-rail";
import { WebDivider } from "./scenes/middle/web-divider";

const CLOTH_SCALE = 0.42;

/*
  The work: the AI apps, then the web apps and the plumbing under them, on one rail. Server
  markup; RunRail pins it and slides it sideways on wide screens.

  Screenshots are dyed nila and mori (shadows indigo, lights cotton) rather than nila and
  kunyit, which would turn a white app solid yellow. Projects without one get a piece of
  kawung cloth behind their postcard instead. Both are defined once here for every panel.
*/
export function RunSection() {
  const style = {
    "--cloth": batikDataUri("kawung", { ink: "#c4915a", ground: "#0f1a47", tint: "#16235c", scale: CLOTH_SCALE }),
    "--cloth-tile": `${batikTileSize("kawung", CLOTH_SCALE)}px`,
  } as CSSProperties;

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

        {aiProjects.map((project, i) => (
          <ProjectPanel key={project.name} project={project} index={i} />
        ))}

        <WebDivider />

        {webProjects.map((project, i) => (
          <ProjectPanel key={project.name} project={project} index={aiProjects.length + i} />
        ))}

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
