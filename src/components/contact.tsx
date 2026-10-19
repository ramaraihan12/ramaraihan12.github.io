import { site } from "@/content/site";
import { ArrowUpRightIcon, GitHubIcon, MailIcon } from "./icons";
import { SalatigaClock } from "./salatiga-clock";

export function Contact() {
  return (
    <section id="contact" aria-labelledby="contact-title" className="contact">
      <div className="container-page">
        <p className="eyebrow">follow-up</p>
        <h2 id="contact-title" className="display-l mt-4">
          Ask me something else
        </h2>
        <p className="lead mt-5">
          Want to talk about a project, AI or plain web? Email is the best way to reach me.
        </p>

        <a href={`mailto:${site.email}`} className="contact-email">
          {site.email}
        </a>

        <div className="contact-row">
          <a href={`mailto:${site.email}`} className="btn btn-solid">
            <MailIcon className="size-4" />
            Email me
          </a>
          <a href={site.github} className="btn btn-line">
            <GitHubIcon className="size-4" />
            GitHub
            <ArrowUpRightIcon className="size-3.5" />
          </a>
          <p className="contact-clock">
            <SalatigaClock />
          </p>
        </div>
      </div>
    </section>
  );
}
