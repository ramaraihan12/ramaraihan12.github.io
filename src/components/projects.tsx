import { aiProjects } from "@/content/projects";
import { ProjectCard } from "./project-card";
import { SectionHeading } from "./section-heading";

export function Projects() {
  return (
    <section id="projects" aria-labelledby="projects-title" className="container-page py-16 sm:py-24">
      <SectionHeading id="projects-title" title="AI projects">
        Small apps, each solving one problem end to end. Most of them run on a local model
        through Ollama by default, so you can try them without an API key.
      </SectionHeading>

      <ul className="mt-10 grid gap-4 md:grid-cols-2">
        {aiProjects.map((project) => (
          <li key={project.name} data-reveal>
            <ProjectCard project={project} />
          </li>
        ))}
      </ul>
    </section>
  );
}
