"use client";

import { type MouseEvent, useEffect, useRef, useSyncExternalStore } from "react";
import { headerCopy } from "@/content/copy";
import { site } from "@/content/site";
import { stages, type StageId } from "@/content/story";
import { getStage, goToStage, subscribeStage } from "@/lib/stage";
import { EmailLink } from "./email-link";
import { CheckIcon, MailIcon } from "./icons";

const pad = (n: number) => String(n).padStart(2, "0");

export function SiteHeader() {
  const active = useSyncExternalStore(subscribeStage, getStage, () => "query" as StageId);
  const index = stages.findIndex((s) => s.id === active);
  const navRef = useRef<HTMLOListElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);

  // The dot slides under whichever stage is active.
  useEffect(() => {
    const place = () => {
      const link = navRef.current?.querySelector<HTMLElement>('[aria-current="step"]');
      if (!link || !dotRef.current) return;
      dotRef.current.style.translate = `${link.offsetLeft + link.offsetWidth / 2}px 0`;
    };
    place();
    window.addEventListener("resize", place);
    document.fonts?.ready.then(place);
    return () => window.removeEventListener("resize", place);
  }, [active]);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      barRef.current?.style.setProperty("scale", `${max > 0 ? window.scrollY / max : 0} 1`);
    };
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // Stages inside a pinned scene have no element to jump to, so the scenes say where they are.
  const jump = (id: StageId) => (e: MouseEvent) => {
    if (goToStage(id)) e.preventDefault();
  };

  return (
    <header className="site-header">
      <div className="site-header-inner container-page">
        <a href="#top" onClick={jump("query")} className="brand">
          {site.name}
        </a>

        <nav aria-label={headerCopy.navLabel} className="stage-nav">
          <ol ref={navRef}>
            {stages.map((stage) => (
              <li key={stage.id}>
                <a
                  href={stage.href}
                  onClick={jump(stage.id)}
                  aria-current={stage.id === active ? "step" : undefined}
                >
                  {stage.label}
                </a>
              </li>
            ))}
          </ol>
          <span ref={dotRef} className="stage-dot" aria-hidden="true" />
        </nav>

        <p className="stage-now" aria-hidden="true">
          <span className="eyebrow-n">{pad(index + 1)}</span> {stages[index].label}
        </p>

        <EmailLink
          className="header-email"
          copiedLabel={
            <>
              <CheckIcon className="size-4" />
              {headerCopy.copied}
            </>
          }
        >
          <MailIcon className="size-4" />
          {headerCopy.email}
        </EmailLink>
      </div>
      <span className="scroll-bar" aria-hidden="true">
        <span ref={barRef} />
      </span>
    </header>
  );
}
