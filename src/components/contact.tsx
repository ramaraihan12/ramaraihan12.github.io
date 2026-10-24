import { Landscape } from "@/components/art/landscape";
import { contactCopy } from "@/content/copy";
import { site } from "@/content/site";
import { EmailLink } from "./email-link";
import { ArrowUpRightIcon, CheckIcon, GitHubIcon, MailIcon } from "./icons";
import { SalatigaClock } from "./salatiga-clock";
import { SkyBand, SkyCaption } from "./scenes/closing/sky-band";

// SkyBand fills these in with the sky at the current time in Salatiga.
const SKY = ["var(--sky-top)", "var(--sky-mid)", "var(--sky-low)"];

export function Contact() {
  return (
    <section id="contact" aria-labelledby="contact-title" className="contact">
      <div className="container-page">
        <p className="eyebrow">{contactCopy.eyebrow}</p>
        <h2 id="contact-title" className="display-l mt-4">
          {contactCopy.title}
        </h2>
        <p className="lead mt-5">{contactCopy.lead}</p>

        <EmailLink className="contact-email">{site.email}</EmailLink>

        <div className="contact-row">
          <EmailLink
            className="btn btn-solid"
            copiedLabel={
              <>
                <CheckIcon className="size-4" />
                {contactCopy.copied}
              </>
            }
          >
            <MailIcon className="size-4" />
            {contactCopy.email}
          </EmailLink>
          <a href={site.github} className="btn btn-line">
            <GitHubIcon className="size-4" />
            {contactCopy.github}
            <ArrowUpRightIcon className="size-3.5" />
          </a>
          <p className="contact-time">
            <span className="contact-clock">
              <SalatigaClock />
            </span>
            <SkyCaption />
          </p>
        </div>
      </div>

      {/* Merbabu from Salatiga, under the sky it has right now. The near hills are malam, the
          night blue of the footer, so the ground runs straight on into it. The shapes are the
          hero's (hero-land.tsx defines them), painted in this sky's colors. */}
      <SkyBand>
        <Landscape id="contact-sky" sky={SKY} sun={{ x: 0, y: 0, r: 22 }} stars={1} shapes="reuse" />
      </SkyBand>
    </section>
  );
}
