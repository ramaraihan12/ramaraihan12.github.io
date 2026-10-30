"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { type ComponentPropsWithoutRef, useRef } from "react";
import { webCopy } from "@/content/copy";
import { PRIORITY, RAIL_MQ, REDUCE_MQ, scrollToY, scrollyOn } from "@/lib/scroll";
import { elementMarker, setMarker } from "@/lib/stage";
import { MOTION_MQ } from "./motion";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * Scroll per pixel of sideways travel. Under 1, the rail moves a little faster than the wheel,
 * so twelve panels don't take forever.
 */
const PACE = 0.8;

/** What --in moves: the art box, the postcard and whatever sits behind it. */
const ART = ".project-art, .project-card, .project-back";

/** How many screen widths ahead of the view a screenshot starts loading. */
const AHEAD = 2.5;

/** Phones get the swipe deck. Matches the deck's query in src/styles/run.css. */
const DECK_MQ = "(width < 48rem)";

/** Which card of the deck was in view, kept for a reload of the page. */
const CARD = "work-card";

/** Time for the packet to hop from one dot to the next, and to sit at each one, in seconds. */
const HOP = 0.36;
const SIT = 0.14;

const pad = (n: number) => String(n).padStart(2, "0");

function savedCard() {
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  if (nav?.type !== "reload" && nav?.type !== "back_forward") return 0;
  try {
    return Number(sessionStorage.getItem(CARD)) || 0;
  } catch {
    return 0;
  }
}

/**
 * The work section's <section>, plus its motion. The panels are server markup
 * (run-section.tsx); this pins the section on wide screens and slides the track sideways,
 * runs each pipeline's dot (--p) and brings each panel's art in (--in) as it arrives. On
 * phones it runs the deck instead.
 */
export function RunRail(props: ComponentPropsWithoutRef<"section">) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const section = root.current!;
      const track = section.querySelector<HTMLElement>(".run-track")!;
      const panels = gsap.utils.toArray<HTMLElement>(".project", section);
      const mm = gsap.matchMedia();
      // The deck's card, kept while a turned phone shows the stacked layout for a while.
      let card = savedCard();

      // One of motion and reduce always matches, so every branch below registers the marker.
      mm.add({ motion: MOTION_MQ, rail: RAIL_MQ, reduce: REDUCE_MQ, deck: DECK_MQ }, (ctx) => {
        const { rail, reduce, deck } = ctx.conditions as Record<string, boolean>;
        const moving = !reduce && scrollyOn();

        if (deck) {
          const removeMarker = setMarker("work", elementMarker(section));
          const stopDeck = runDeck(section, moving, card, (i) => (card = i));
          return () => {
            stopDeck();
            removeMarker();
          };
        }

        if (!moving) return setMarker("work", elementMarker(section));

        if (!rail) {
          // Stacked panels: the dot runs down each pipeline and the art settles as it scrolls by.
          const removeMarker = setMarker("work", elementMarker(section));
          for (const panel of panels) {
            const pipe = panel.querySelector(".pipe");
            if (pipe) {
              gsap.fromTo(
                pipe,
                { "--p": 0 },
                {
                  "--p": 1,
                  ease: "none",
                  scrollTrigger: {
                    trigger: pipe,
                    start: "top 80%",
                    end: "bottom 40%",
                    scrub: 0.4,
                    refreshPriority: PRIORITY.work,
                  },
                },
              );
            }
            gsap.fromTo(
              panel.querySelectorAll(ART),
              { "--in": 0 },
              {
                "--in": 1,
                ease: "none",
                scrollTrigger: {
                  trigger: panel.querySelector(".project-art"),
                  start: "top bottom",
                  end: "center 55%",
                  scrub: 0.5,
                  refreshPriority: PRIORITY.work,
                },
              },
            );
          }
          return removeMarker;
        }

        // Wide screens: the section pins and the panels slide past sideways.
        const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);

        // The section clips the track, so native lazy loading only starts a screenshot once it's
        // already sliding into view, and it pops in. Ask for each one a couple of screens early.
        const lazy = panels.flatMap((panel) => {
          const imgs = [...panel.querySelectorAll<HTMLImageElement>("img[loading='lazy']")];
          return imgs.length ? [{ panel, imgs }] : [];
        });
        let next = 0;
        const loadAhead = () => {
          const reach = -Number(gsap.getProperty(track, "x")) + window.innerWidth * AHEAD;
          while (next < lazy.length && lazy[next].panel.offsetLeft < reach) {
            for (const img of lazy[next++].imgs) img.loading = "eager";
          }
        };
        ScrollTrigger.create({
          trigger: section,
          start: "top bottom+=50%",
          once: true,
          refreshPriority: PRIORITY.work,
          onEnter: loadAhead,
        });

        const slide = gsap.to(track, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: {
            trigger: section,
            refreshPriority: PRIORITY.work,
            pin: true,
            start: "top top",
            end: () => `+=${Math.round(distance() * PACE)}`,
            scrub: 0.6,
            invalidateOnRefresh: true,
            onUpdate: loadAhead,
          },
        });

        for (const panel of panels) {
          const pipe = panel.querySelector(".pipe");
          if (pipe) {
            gsap.fromTo(
              pipe,
              { "--p": 0 },
              {
                "--p": 1,
                ease: "none",
                scrollTrigger: {
                  trigger: panel,
                  refreshPriority: PRIORITY.work,
                  containerAnimation: slide,
                  start: "left 78%",
                  end: "left 16%",
                  scrub: 0.4,
                },
              },
            );
          }
          gsap.fromTo(
            panel.querySelectorAll(ART),
            { "--in": 0 },
            {
              "--in": 1,
              ease: "none",
              scrollTrigger: {
                trigger: panel,
                refreshPriority: PRIORITY.work,
                containerAnimation: slide,
                start: "left 100%",
                end: "left 30%",
                scrub: 0.5,
              },
            },
          );
        }

        const st = slide.scrollTrigger!;
        const removeMarker = setMarker("work", { at: () => st.start - window.innerHeight * 0.5, to: () => st.start });

        // Tabbing into a panel that's still off to the side scrolls the page until it's in view.
        // The browser may also scroll the clipped section sideways on focus, so undo that.
        const onFocus = (e: FocusEvent) => {
          section.scrollLeft = 0;
          const panel = (e.target as Element).closest<HTMLElement>(".panel, .run-outro");
          if (!panel) return;
          const x = panel.offsetLeft - (window.innerWidth - panel.offsetWidth) / 2;
          const perPixel = distance() ? (st.end - st.start) / distance() : 0;
          scrollToY(st.start + gsap.utils.clamp(0, distance(), x) * perPixel);
        };
        track.addEventListener("focusin", onFocus);
        return () => {
          track.removeEventListener("focusin", onFocus);
          removeMarker();
        };
      });
    },
    { scope: root },
  );

  return <section ref={root} {...props} />;
}

/**
 * The phone deck: the cards scroll sideways on their own with CSS scroll snapping, and this
 * keeps the bar under them in step (the count and the two buttons), loads screenshots a couple
 * of cards ahead, and with motion allowed:
 * - each postcard trails its card a little as you drag it in and settles at its tilt (--in);
 * - the card that lands sends a packet hopping down its pipeline, dot by dot (--p). It stays
 *   lit until the card is put away out of view, so a card you come back to runs again.
 * Returns the cleanup.
 */
function runDeck(section: HTMLElement, moving: boolean, start: number, onCard: (i: number) => void) {
  const deck = section.querySelector<HTMLElement>(".run-deck")!;
  const cards = gsap.utils.toArray<HTMLElement>(".run-card", deck);
  const projects = cards.filter((c) => !c.hasAttribute("data-divider"));
  const at = section.querySelector<HTMLElement>(".run-deck-at")!;
  const of = section.querySelector<HTMLElement>(".run-deck-of")!;
  const buttons = gsap.utils.toArray<HTMLButtonElement>(".run-deck-btn", section);
  const reduce = matchMedia(REDUCE_MQ);

  let current = -1;
  let near = false;
  let inView = false;
  const runs = new Map<HTMLElement, gsap.core.Timeline>();

  // Sideways swipes and trackpad gestures belong to the deck, so Lenis leaves those alone.
  deck.setAttribute("data-lenis-prevent-horizontal", "");

  const leftOf = (i: number) =>
    cards[i].getBoundingClientRect().left -
    deck.getBoundingClientRect().left +
    deck.scrollLeft -
    parseFloat(getComputedStyle(deck).scrollPaddingLeft || "0");

  // A wide card on a turned phone, or a reload, comes back to the card that was in view.
  // ScrollTrigger's refresh parks scrollers at the start while it measures, and the refresh
  // that follows a resize can land after this, so the place is put back once it has settled too.
  const settle = () => {
    if (start > 0 && start < cards.length && deck.scrollLeft < 1) deck.scrollLeft = leftOf(start);
  };
  settle();
  ScrollTrigger.addEventListener("refresh", settle);
  const settled = window.setTimeout(() => ScrollTrigger.removeEventListener("refresh", settle), 1500);

  const loadAhead = () => {
    if (!near || current < 0) return;
    for (const c of cards.slice(current, current + 3)) {
      for (const img of c.querySelectorAll<HTMLImageElement>("img[loading='lazy']")) img.loading = "eager";
    }
  };

  // Started by the observer, long after the matchMedia context recorded its own, so the deck
  // keeps track of these itself and clears them when it goes.
  const hop = (pipe: HTMLElement) => {
    const steps = pipe.querySelectorAll(".pipe-node").length;
    const tl = gsap.timeline({ delay: 0.12 });
    tl.set(pipe, { "--p": 0 });
    for (let k = 1; k < steps; k++) {
      tl.to(pipe, { "--p": k / (steps - 1), duration: HOP, ease: "power2.inOut" }, k > 1 ? `+=${SIT}` : undefined);
    }
    return tl;
  };

  const land = () => {
    if (!moving || !inView || current < 0) return;
    const pipe = cards[current].querySelector<HTMLElement>(".pipe");
    if (!pipe || runs.has(pipe)) return;
    runs.set(pipe, hop(pipe));
  };

  const putAway = (c: HTMLElement) => {
    const pipe = c.querySelector<HTMLElement>(".pipe");
    const run = pipe && runs.get(pipe);
    if (!pipe || !run) return;
    run.kill();
    runs.delete(pipe);
    gsap.set(pipe, { "--p": 0 });
  };

  const show = (i: number) => {
    if (i === current) return;
    // The layout may have turned wide already, with the deck squashed flat and every card
    // "in view" at scroll 0, a beat before this is torn down. That isn't a card to remember.
    if (!matchMedia(DECK_MQ).matches) return;
    current = i;
    onCard(i);
    try {
      sessionStorage.setItem(CARD, String(i));
    } catch {}
    const n = projects.indexOf(cards[i]);
    at.textContent = n < 0 ? webCopy.eyebrow : pad(n + 1);
    of.textContent = n < 0 ? "" : ` / ${pad(projects.length)}`;
    buttons.forEach((b) => {
      const end = Number(b.dataset.step) < 0 ? i === 0 : i === cards.length - 1;
      b.setAttribute("aria-disabled", String(end));
    });
    loadAhead();
    land();
  };

  // Which card is in view. The root is pulled in from the sides, so the sliver of the card
  // before still showing at the edge counts as put away.
  const watch = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const c = e.target as HTMLElement;
        if (!e.isIntersecting) putAway(c);
        else if (e.intersectionRatio >= 0.6) show(cards.indexOf(c));
      }
    },
    { root: deck, rootMargin: "0px -24px", threshold: [0, 0.6] },
  );
  cards.forEach((c) => watch.observe(c));

  // The buttons step one card. At either end one is only aria-disabled, so it keeps its focus.
  const onClick = (e: MouseEvent) => {
    const b = e.currentTarget as HTMLButtonElement;
    if (b.getAttribute("aria-disabled") === "true") return;
    const i = gsap.utils.clamp(0, cards.length - 1, Math.max(0, current) + Number(b.dataset.step));
    deck.scrollTo({ left: leftOf(i), behavior: reduce.matches ? "auto" : "smooth" });
  };
  buttons.forEach((b) => b.addEventListener("click", onClick));

  // Screenshots start loading once the deck is a screen away; the packet only runs where it's seen.
  ScrollTrigger.create({
    trigger: deck,
    start: "top bottom+=100%",
    once: true,
    refreshPriority: PRIORITY.work,
    onEnter: () => {
      near = true;
      loadAhead();
    },
  });
  ScrollTrigger.create({
    trigger: deck,
    start: "top 75%",
    end: "bottom 25%",
    refreshPriority: PRIORITY.work,
    onToggle: (self) => {
      inView = self.isActive;
      land();
    },
  });

  if (moving) {
    for (const c of cards) {
      const art = c.querySelectorAll(ART);
      if (!art.length) continue;
      gsap.fromTo(
        art,
        { "--in": 0 },
        {
          "--in": 1,
          ease: "none",
          scrollTrigger: {
            trigger: c,
            scroller: deck,
            horizontal: true,
            start: "left right",
            end: "left left+=40",
            // A number, not true: jumpToY() in src/lib/scroll.ts expects a scrub tween or none.
            scrub: 0.2,
            refreshPriority: PRIORITY.work,
          },
        },
      );
    }
  }

  return () => {
    watch.disconnect();
    window.clearTimeout(settled);
    ScrollTrigger.removeEventListener("refresh", settle);
    buttons.forEach((b) => b.removeEventListener("click", onClick));
    deck.removeAttribute("data-lenis-prevent-horizontal");
    runs.forEach((run) => run.kill());
    runs.clear();
    for (const pipe of deck.querySelectorAll<HTMLElement>(".pipe")) pipe.style.removeProperty("--p");
  };
}
