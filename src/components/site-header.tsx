"use client";

import { type CSSProperties, type MouseEvent, useEffect, useRef, useSyncExternalStore } from "react";
import { headerCopy } from "@/content/copy";
import { site } from "@/content/site";
import { stages, type StageId } from "@/content/story";
import { getStage, goToStage, stageFractions, subscribeMeasure, subscribeProgress, subscribeStage } from "@/lib/stage";
import { EmailLink } from "./email-link";
import { CheckIcon, MailIcon } from "./icons";

const pad = (n: number) => String(n).padStart(2, "0");

export function SiteHeader() {
  const active = useSyncExternalStore(subscribeStage, getStage, () => "query" as StageId);
  const index = stages.findIndex((s) => s.id === active);
  const navRef = useRef<HTMLOListElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const ticksRef = useRef<HTMLSpanElement>(null);

  // The wire: --stage-i on the header says which stage it is (it changes once per stage), and each
  // arrow's own --fill (0..1) is written inline: the stages behind you full, the ones ahead empty,
  // and only the one you're on follows the scroll. So a scroll frame restyles one arrow, not the
  // whole header. Written here, not through React. Phones hide the wire, so it's skipped there.
  useEffect(() => {
    const el = headerRef.current;
    const wide = window.matchMedia("(width >= 64rem)");
    const inks = Array.from(el?.querySelectorAll<SVGPathElement>(".wire-ink") ?? []);
    let last = { i: -1, p: 0 };
    let filledFor = -1;
    const write = () => {
      if (!wide.matches) {
        filledFor = -1;
        return;
      }
      if (filledFor !== last.i) {
        filledFor = last.i;
        inks.forEach((ink, k) => ink.style.setProperty("--fill", k < last.i ? "1" : "0"));
      }
      inks[last.i]?.style.setProperty("--fill", String(last.p));
    };
    wide.addEventListener("change", write);
    const stop = subscribeProgress((i, p) => {
      if (i !== last.i) el?.style.setProperty("--stage-i", String(i));
      last = { i, p };
      write();
    });
    return () => {
      wide.removeEventListener("change", write);
      stop();
    };
  }, []);

  // Ticks on the phone's bar sit where each stage starts, once the scenes have measured the page.
  useEffect(() => {
    const place = () => {
      const marks = ticksRef.current?.children;
      if (!marks) return;
      stageFractions().slice(1).forEach((f, k) => {
        const mark = marks[k] as HTMLElement | undefined;
        mark?.style.setProperty("left", `${f * 100}%`);
      });
    };
    place();
    window.addEventListener("resize", place);
    const stop = subscribeMeasure(place);
    return () => {
      window.removeEventListener("resize", place);
      stop();
    };
  }, []);

  // The label's stamp press waits for the first real change, so it doesn't fire on load.
  const nowRef = useRef<HTMLParagraphElement>(null);
  const seenRef = useRef(active);
  useEffect(() => {
    if (seenRef.current !== active) nowRef.current?.setAttribute("data-ready", "");
  }, [active]);

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

  // The scroll bar. The page's length is read when the scenes measure it or the window resizes,
  // not on every scroll frame.
  useEffect(() => {
    let frame = 0;
    let max = 0;
    const update = () => {
      barRef.current?.style.setProperty("scale", `${max > 0 ? Math.min(1, window.scrollY / max) : 0} 1`);
    };
    const measure = () => {
      max = document.documentElement.scrollHeight - window.innerHeight;
      update();
    };
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    const stop = subscribeMeasure(measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
      stop();
    };
  }, []);

  // Stages inside a pinned scene have no element to jump to, so the scenes say where they are.
  const jump = (id: StageId) => (e: MouseEvent) => {
    if (goToStage(id)) e.preventDefault();
  };

  return (
    <header ref={headerRef} className="site-header">
      <div className="site-header-inner container-page">
        <a href="#top" onClick={jump("query")} className="brand">
          {site.name}
        </a>

        <nav aria-label={headerCopy.navLabel} className="stage-nav">
          <ol ref={navRef}>
            {stages.map((stage, k) => (
              <li key={stage.id} style={{ "--k": k } as CSSProperties}>
                <a
                  href={stage.href}
                  onClick={jump(stage.id)}
                  aria-current={stage.id === active ? "step" : undefined}
                >
                  {stage.label}
                </a>
                {k < stages.length - 1 && (
                  <svg className="wire" viewBox="0 0 16 8" aria-hidden="true">
                    <path className="wire-bare" d="M0 4.5H14M11 1.5l3 3-3 3" />
                    <path className="wire-ink" d="M0 4.5H14M11 1.5l3 3-3 3" />
                  </svg>
                )}
              </li>
            ))}
          </ol>
          <span ref={dotRef} className="stage-dot" aria-hidden="true" />
        </nav>

        <p ref={nowRef} className="stage-now" aria-hidden="true">
          <span key={active} className="stage-stamp">
            <span className="eyebrow-n">{pad(index + 1)}</span> {stages[index].label}
          </span>
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
        <span ref={ticksRef} className="scroll-ticks">
          {stages.slice(1).map((stage, k) => (
            <i key={stage.id} data-passed={k + 1 <= index ? "" : undefined} />
          ))}
        </span>
      </span>
    </header>
  );
}
