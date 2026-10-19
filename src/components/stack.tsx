import { stack } from "@/content/stack";
import { SectionHeading } from "./section-heading";

export function Stack() {
  return (
    <section id="stack" aria-labelledby="stack-title" className="container-page py-16 sm:py-24">
      <SectionHeading id="stack-title" title="What I work with">
        The web stack is what I ship with. The AI tools are what I&apos;ve been building with lately.
      </SectionHeading>

      <ul className="mt-10 border-b border-line">
        {stack.map((group) => (
          <li
            key={group.name}
            className="grid gap-2 border-t border-line py-6 md:grid-cols-[13rem_1fr] md:gap-8"
          >
            <h3 className="font-mono text-sm text-muted">{group.name}</h3>
            <div>
              <ul className="dot-list text-lg leading-relaxed font-medium text-ink">
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="mt-1.5 max-w-2xl text-pretty text-muted">{group.note}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
