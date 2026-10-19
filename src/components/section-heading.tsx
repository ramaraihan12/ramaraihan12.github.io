import type { ReactNode } from "react";

type SectionHeadingProps = {
  id: string;
  title: string;
  children?: ReactNode;
};

export function SectionHeading({ id, title, children }: SectionHeadingProps) {
  return (
    <div className="max-w-2xl">
      <h2 id={id} className="type-display text-[clamp(1.75rem,5vw,2.75rem)] leading-[1.05] text-ink">
        {title}
      </h2>
      {children ? <p className="mt-3 text-lg text-pretty text-muted">{children}</p> : null}
    </div>
  );
}
