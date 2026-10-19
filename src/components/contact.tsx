import { site } from "@/content/site";
import { EmailLink } from "./email-link";
import { ArrowUpRightIcon, CheckIcon, GitHubIcon, MailIcon } from "./icons";
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

        <EmailLink className="contact-email">{site.email}</EmailLink>

        <div className="contact-row">
          <EmailLink
            className="btn btn-solid"
            copiedLabel={
              <>
                <CheckIcon className="size-4" />
                Copied
              </>
            }
          >
            <MailIcon className="size-4" />
            Email me
          </EmailLink>
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
