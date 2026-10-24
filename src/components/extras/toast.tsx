"use client";

import { type AnimationEvent, type FocusEvent, type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { batikDataUri } from "@/components/art/patterns";

/*
  One achievement card, loaded the first time one is earned. It times itself out with a CSS
  animation (the line along its bottom edge), so pausing on hover or focus is just
  animation-play-state. It never takes focus; if a keyboard user closes it from inside, focus
  goes back to where they were.
*/

export type ToastProps = {
  /** "achievement" */
  label: string;
  /** "2 of 5" */
  count: string;
  title: string;
  body: string;
  closeLabel: string;
  /** Called once, after the card has left. */
  onDone: () => void;
};

// A single kawung flower, stamped in a ring: one cell of the tile, centred in the disc by
// extras.css (the tile is 120 units, a cell 60, and this draws it at 0.55).
let mark: string | null = null;
const kawung = () => (mark ??= batikDataUri("kawung", { ink: "#f4b223", ground: "#0f1a47", tint: "#8a5a2b", scale: 0.55 }));

export function Toast({ label, count, title, body, closeLabel, onDone }: ToastProps) {
  const [leaving, setLeaving] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const cameFrom = useRef<HTMLElement | null>(null);
  const finished = useRef(false);
  const titleId = useId();

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    onDone();
  };

  const leave = () => {
    if (leaving) return;
    const card = root.current;
    if (card?.contains(document.activeElement)) {
      const back = cameFrom.current;
      if (back?.isConnected) back.focus({ preventScroll: true });
      else (document.activeElement as HTMLElement).blur();
    }
    setLeaving(true);
  };

  // If the exit animation never reports back (animations off), don't hold up the queue.
  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => {
      if (finished.current) return;
      finished.current = true;
      onDone();
    }, 800);
    return () => window.clearTimeout(timer);
  }, [leaving, onDone]);

  const onAnimationEnd = (e: AnimationEvent) => {
    if (e.animationName === "rr-toast-timer") leave();
    else if (leaving && e.target === e.currentTarget) finish();
  };

  const onFocus = (e: FocusEvent) => {
    const from = e.relatedTarget;
    if (from instanceof HTMLElement && !e.currentTarget.contains(from)) cameFrom.current = from;
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") leave();
  };

  return (
    <div
      ref={root}
      className="rr-toast"
      role="group"
      aria-labelledby={titleId}
      data-leaving={leaving || undefined}
      onAnimationEnd={onAnimationEnd}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
    >
      <span className="rr-toast-mark" aria-hidden="true">
        <span style={{ backgroundImage: kawung() }} />
      </span>
      <div className="rr-toast-text">
        <p className="rr-toast-eyebrow">
          {label} · <span>{count}</span>
        </p>
        <p id={titleId} className="rr-toast-title">
          {title}
        </p>
        <p className="rr-toast-body">{body}</p>
      </div>
      <button type="button" className="rr-toast-close" onClick={leave} aria-label={closeLabel}>
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M4.2 4.4 11.7 11.8M11.9 4.1 4.3 11.6" />
        </svg>
      </button>
      <span className="rr-toast-timer" aria-hidden="true" />
    </div>
  );
}
