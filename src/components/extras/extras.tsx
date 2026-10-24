"use client";

import { type ComponentType, useCallback, useEffect, useRef, useState } from "react";
import { achievements, consoleGreeting } from "@/content/copy";
import { site } from "@/content/site";
import { stages } from "@/content/story";
import { getStage, subscribeStage } from "@/lib/stage";
import type { DipProps } from "./dip";
import { extrasCopy as X } from "./strings";
import type { ToastProps } from "./toast";

/*
  Three easter eggs in one small component. Styles are in src/styles/extras.css.

  - Achievement toasts. Anything on the page can dispatch
      window.dispatchEvent(new CustomEvent("rr:achieve", { detail: { id: "game-finished" } }))
    and the matching card from `achievements` in copy.ts slides in, once per visitor.
  - The Konami code, or seven quick taps on the name in the header, dips the page in batik.
  - A greeting in the browser console, and rama.hello() to answer it.

  Only the listeners load with the page. The toast card and the dye, which draw batik tiles,
  are separate chunks fetched the first time they're needed. On the server this renders an
  empty live region and nothing else.
*/

/** Event ids, mapped to their entry in `achievements`. */
const IDS = {
  "game-finished": "gameDone",
  "game-perfect": "gamePerfect",
  konami: "konami",
  "console-source": "consoleSource",
  "all-stages": "allStages",
} as const satisfies Record<string, keyof typeof achievements>;

export type AchievementId = keyof typeof IDS;

const isId = (id: unknown): id is AchievementId => typeof id === "string" && Object.hasOwn(IDS, id);

/** localStorage: a JSON array of the achievement ids this visitor has already seen. */
export const STORE_KEY = "rr:ach";

const earned = new Set<string>();

/** Merges in what's stored, which another tab may have added to. Storage can be blocked. */
function loadEarned() {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORE_KEY) ?? "[]");
    if (Array.isArray(stored)) for (const id of stored) if (isId(id)) earned.add(id);
  } catch {}
}

/** Records an achievement. False if this visitor already had it. */
function earn(id: AchievementId) {
  loadEarned();
  if (earned.has(id)) return false;
  earned.add(id);
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify([...earned]));
  } catch {
    // Blocked storage: it still counts, until the tab closes.
  }
  return true;
}

const achieve = (id: AchievementId) => window.dispatchEvent(new CustomEvent("rr:achieve", { detail: { id } }));

function lazy<T>(load: () => Promise<T>) {
  let pending: Promise<T> | null = null;
  return () =>
    (pending ??= load().catch((error) => {
      pending = null;
      throw error;
    }));
}

const loadToast = lazy(() => import("./toast").then((m) => m.Toast));
const loadDip = lazy(() => import("./dip").then((m) => m.Dip));

const KONAMI = "arrowup arrowup arrowdown arrowdown arrowleft arrowright arrowleft arrowright b a";
/** The name in the header. Seven taps on it within three seconds is the Konami code for thumbs. */
export const BRAND_SELECTOR = ".site-header .brand";
const TAPS = 7;
const TAP_WINDOW = 3000;
/** A stage counts as visited once it's been the current one this long, not just scrolled past. */
const DWELL = 400;
/** Breathing room between two toasts. */
const GAP = 350;

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || t.matches("input, textarea, select"));

declare global {
  interface Window {
    rama?: { source: string; hello: () => void };
  }
}

const KAWUNG = [
  "      .-.",
  "     ( . )",
  " .-.  `-`  .-.",
  "( . )  *  ( . )",
  " `-`  .-.  `-`",
  "     ( . )",
  "      `-`",
].join("\n");

// Effects run twice in development (StrictMode). The greeting shouldn't.
let greeted = false;

function greet() {
  const display = getComputedStyle(document.documentElement).getPropertyValue("--font-anybody").trim();
  console.log(`%c${KAWUNG}`, "color:#d99a16;line-height:1.3");
  console.log(
    `%c${X.consoleTitle}`,
    `background:#0f1a47;color:#f4b223;font-family:${display ? `${display},` : ""}monospace;font-size:15px;font-weight:800;padding:5px 10px;border-radius:3px`,
  );
  console.log([...consoleGreeting, X.consoleHint].join("\n"));
}

type Item = { id: AchievementId; n: number };

export function Extras() {
  const [queue, setQueue] = useState<Item[]>([]);
  const [showing, setShowing] = useState(false);
  const [dipping, setDipping] = useState(false);
  const [Toast, setToast] = useState<ComponentType<ToastProps> | null>(null);
  const [Dip, setDip] = useState<ComponentType<DipProps> | null>(null);
  const [live, setLive] = useState("");
  const liveTimer = useRef(0);
  const dippingNow = useRef(false);

  // Clearing first means the same words twice are still read out twice.
  const say = useCallback((text: string) => {
    setLive("");
    window.clearTimeout(liveTimer.current);
    liveTimer.current = window.setTimeout(() => setLive(text), 100);
  }, []);

  const startDip = useCallback(() => {
    if (dippingNow.current) return;
    dippingNow.current = true;
    setDipping(true);
    achieve("konami");
    loadDip().then(
      (component) => {
        setDip(() => component);
        say(X.dipAnnounce);
      },
      () => {
        dippingNow.current = false;
        setDipping(false);
      },
    );
  }, [say]);

  const endDip = useCallback(() => {
    dippingNow.current = false;
    setDipping(false);
  }, []);

  const toastDone = useCallback(() => {
    setShowing(false);
    setQueue((q) => q.slice(1));
  }, []);

  useEffect(() => {
    loadEarned();

    const onAchieve = (e: Event) => {
      const id = (e as CustomEvent<{ id?: unknown } | null>).detail?.id;
      if (!isId(id) || !earn(id)) return;
      const n = [...earned].filter(isId).length;
      setQueue((q) => [...q, { id, n }]);
    };
    window.addEventListener("rr:achieve", onAchieve);

    // Every stage in the nav, read from story.ts, so a new stage is part of the set.
    const seen = new Set<string>();
    let dwell = 0;
    let unsubscribe = () => {};
    const visit = () => {
      const id = getStage();
      window.clearTimeout(dwell);
      dwell = window.setTimeout(() => {
        if (getStage() !== id) return;
        seen.add(id);
        if (stages.every((s) => seen.has(s.id))) {
          unsubscribe();
          achieve("all-stages");
        }
      }, DWELL);
    };
    if (!earned.has("all-stages")) {
      unsubscribe = subscribeStage(visit);
      visit();
    }

    let keys: string[] = [];
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
      keys = [...keys, e.key.toLowerCase()].slice(-10);
      if (keys.join(" ") !== KONAMI) return;
      keys = [];
      startDip();
    };
    window.addEventListener("keydown", onKey);

    let taps: number[] = [];
    const onClick = (e: MouseEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest(BRAND_SELECTOR)) return;
      const now = performance.now();
      taps = [...taps.filter((t) => now - t < TAP_WINDOW), now];
      if (taps.length < TAPS) return;
      taps = [];
      startDip();
    };
    document.addEventListener("click", onClick);

    if (!greeted) {
      greeted = true;
      greet();
    }
    const rama = {
      source: site.source,
      hello() {
        console.log(`%c${X.hello}`, "color:#d99a16");
        achieve("console-source");
      },
    };
    window.rama = rama;

    return () => {
      window.removeEventListener("rr:achieve", onAchieve);
      unsubscribe();
      window.clearTimeout(dwell);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
      if (window.rama === rama) delete window.rama;
    };
  }, [startDip]);

  // One toast at a time, and none while the page is dyed.
  const next = queue[0];
  useEffect(() => {
    if (!next || showing || dipping) return;
    let current = true;
    const { title, body } = achievements[IDS[next.id]];
    const timer = window.setTimeout(() => {
      loadToast().then(
        (component) => {
          if (!current) return;
          setToast(() => component);
          setShowing(true);
          say(X.announce(title, body));
        },
        () => {
          // No card without its chunk, but the words can still be read out.
          if (!current) return;
          say(X.announce(title, body));
          setQueue((q) => q.slice(1));
        },
      );
    }, GAP);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [next, showing, dipping, say]);

  useEffect(() => () => window.clearTimeout(liveTimer.current), []);

  const total = Object.keys(IDS).length;

  return (
    <>
      <p className="rr-live" role="status" aria-live="polite" aria-atomic="true">
        {live}
      </p>
      {showing && Toast && next ? (
        <Toast
          key={next.id}
          label={X.toastLabel}
          count={X.toastCount(next.n, total)}
          title={achievements[IDS[next.id]].title}
          body={achievements[IDS[next.id]].body}
          closeLabel={X.close}
          onDone={toastDone}
        />
      ) : null}
      {dipping && Dip ? <Dip title={achievements.konami.title} line={X.dipLine} onDone={endDip} /> : null}
    </>
  );
}
