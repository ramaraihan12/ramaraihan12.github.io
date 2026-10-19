import { site } from "@/content/site";
import { SectionHeading } from "./section-heading";

export function Contact() {
  return (
    <section id="contact" aria-labelledby="contact-title" className="border-t border-line">
      <div className="container-page py-16 sm:py-24">
        <SectionHeading id="contact-title" title="Get in touch">
          Want to talk about a project, AI or plain web? Email is the best way to reach me, and I
          reply from Salatiga (UTC+7).
        </SectionHeading>

        <a
          href={`mailto:${site.email}`}
          className="type-display mt-8 inline-block text-[clamp(1.1rem,4.5vw,3rem)] [overflow-wrap:anywhere] text-indigo underline decoration-line decoration-2 underline-offset-[0.2em] transition-colors hover:decoration-kunyit"
        >
          {site.email}
        </a>

        <p className="mt-6 text-muted">
          Code lives on{" "}
          <a
            href={site.github}
            className="font-medium text-ink underline decoration-line underline-offset-4 hover:decoration-indigo"
          >
            GitHub
          </a>
          .
        </p>
      </div>
    </section>
  );
}
