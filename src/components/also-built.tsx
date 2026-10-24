import type { CSSProperties } from "react";
import { PostcardImage } from "@/components/art/files";
import { alsoCopy, workCopy } from "@/content/copy";
import { otherProjects } from "@/content/projects";
import { ArrowUpRightIcon } from "./icons";

/** Screen readers hear where a link goes: GitHub, or the project's own page. */
const linkSuffix = (href: string) =>
  new URL(href).hostname === "github.com" ? alsoCopy.onGitHub : alsoCopy.projectPage;

export function AlsoBuilt() {
  return (
    <section aria-labelledby="also-title" className="also">
      <div className="container-page">
        <h2 id="also-title" className="also-title">
          {alsoCopy.title}
        </h2>

        <ul className="also-list">
          {otherProjects.map((project, i) => (
            <li key={project.name} className="also-row" data-reveal>
              <span className="also-card" style={{ "--tilt": `${i % 2 ? 2.5 : -2.5}deg` } as CSSProperties} aria-hidden="true">
                <PostcardImage name={project.name} tone="mori" />
              </span>
              {project.href ? (
                <a href={project.href} className="also-name">
                  {project.name}
                  <span className="sr-only">{linkSuffix(project.href)}</span>
                  <ArrowUpRightIcon className="size-4" />
                </a>
              ) : (
                <span className="also-name">{project.name}</span>
              )}
              <div className="also-body">
                <p className="also-summary">{project.summary}</p>
                <div className="also-foot">
                  <ul className="chips" aria-label={alsoCopy.stackLabel}>
                    {project.stack.map((tech) => (
                      <li key={tech}>{tech}</li>
                    ))}
                  </ul>
                  {project.demo ? (
                    <a href={project.demo} className="code-link also-demo">
                      {alsoCopy.demoLink}
                      <span className="sr-only">{workCopy.codeLinkFor(project.name)}</span>
                      <ArrowUpRightIcon className="size-4" />
                    </a>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>

        <p className="also-note">{alsoCopy.note}</p>
      </div>
    </section>
  );
}
