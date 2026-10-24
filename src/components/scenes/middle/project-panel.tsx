import type { CSSProperties } from "react";
import { hash, Postcard } from "@/components/art";
import { ArrowUpRightIcon } from "@/components/icons";
import { Pipeline } from "@/components/pipeline";
import { workCopy } from "@/content/copy";
import type { Project } from "@/content/projects";

/**
 * Long names get a narrower cut of Anybody instead of a smaller size, so every name keeps
 * about the same weight on the rail. 112 for short ones, down to 62 for the longest.
 */
function nameWidth(name: string) {
  return Math.round(Math.min(112, Math.max(62, 140 - name.length * 3.6)));
}

/** Postcards lean left and right in turn along the rail, each by its own few degrees. */
function tilt(name: string, index: number) {
  return (index % 2 ? 1 : -1) * (2.5 + (hash(name) % 5) * 0.6);
}

/**
 * The screenshot's frame follows the picture's own shape, kept between 5:4 and 16:9. A taller
 * one is cut off at the bottom, since the top is where an app's header is.
 */
function shotRatio(width: number, height: number) {
  return Math.min(16 / 9, Math.max(5 / 4, width / height)).toFixed(3);
}

/**
 * The art for one panel: the project's postcard in front, and behind it either the real
 * screenshot, dyed nila and mori until you hover, or a piece of plain cloth when there's no
 * screenshot to show.
 */
function ProjectArt({ project }: { project: Project }) {
  const { image } = project;
  return (
    <div
      className="project-art"
      data-has-shot={image ? "" : undefined}
      style={image ? ({ "--shot-ratio": shotRatio(image.width, image.height) } as CSSProperties) : undefined}
    >
      {image ? (
        <span className="project-back project-shot">
          {/* eslint-disable-next-line @next/next/no-img-element -- static export with no image server; the rail switches these to eager itself */}
          <img
            className="project-shot-img"
            src={image.src}
            alt={image.alt}
            width={image.width}
            height={image.height}
            loading="lazy"
            decoding="async"
          />
          {/* eslint-disable-next-line @next/next/no-img-element -- the dyed copy of the same file */}
          <img
            className="project-shot-dye"
            src={image.src}
            alt=""
            aria-hidden="true"
            width={image.width}
            height={image.height}
            loading="lazy"
            decoding="async"
          />
        </span>
      ) : (
        <span className="project-back project-cloth" aria-hidden="true" />
      )}
      <span className="project-card">
        <Postcard name={project.name} tone="mori" />
      </span>
    </div>
  );
}

/** One project on the rail: what it is on the left, its art on the right, its pipeline under both. */
export function ProjectPanel({ project, index }: { project: Project; index: number }) {
  const id = `project-${project.name}`;
  const style = { "--name-w": nameWidth(project.name), "--tilt": `${tilt(project.name, index).toFixed(1)}deg` } as CSSProperties;

  return (
    <article className="panel project" aria-labelledby={id} style={style}>
      <div className="project-text">
        <p className="project-kind">{project.kind}</p>
        <h3 id={id} className="project-name">
          {project.name}
        </h3>
        <p className="project-summary">{project.summary}</p>
      </div>

      <ProjectArt project={project} />

      {project.flow ? <Pipeline steps={project.flow} /> : null}

      <div className="project-foot">
        <ul className="chips" aria-label={workCopy.stackLabel}>
          {project.stack.map((tech) => (
            <li key={tech}>{tech}</li>
          ))}
        </ul>
        <p className="project-links">
          {project.demo ? (
            <a href={project.demo} className="code-link">
              {workCopy.demoLink}
              <span className="sr-only">{workCopy.codeLinkFor(project.name)}</span>
              <ArrowUpRightIcon className="size-4" />
            </a>
          ) : null}
          <a href={project.href} className="code-link">
            {workCopy.codeLink}
            <span className="sr-only">{workCopy.codeLinkFor(project.name)}</span>
            <ArrowUpRightIcon className="size-4" />
          </a>
        </p>
      </div>
    </article>
  );
}
