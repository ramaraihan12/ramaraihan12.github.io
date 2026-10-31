"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";
import { hash } from "@/components/art/rng";
import {
  fracAt,
  LAND,
  type Geo,
  makeRide,
  type Ride,
  readQueryDot,
  type Route,
  routeFromDot,
  routeToSeed,
  stillThread,
  threadX,
} from "@/lib/benang-path";
import { REDUCE_MQ, SCENE_MQ, scrollyOn } from "@/lib/scroll";

gsap.registerPlugin(useGSAP, ScrollTrigger, MotionPathPlugin);

/*
  Benang is Indonesian for thread. The query dot used to vanish after the map and come back as
  the answer's seed, with nothing between. Here it leaves the map as a drip of wax dots, which
  set into a thread down the left margin, and the dot rides that thread through play, tools
  and the rest, to land as the seed.

  It all lives in document space, in one box after <main> (so it's not one of main's children,
  which stage.ts counts to keep your place). The geometry (src/lib/benang-path.ts) is measured
  when ScrollTrigger refreshes, once the pins are in place and everything above has its
  length. Scrolling only reads tables: how far along the thread the dot is for this scroll,
  from which the dot moves (MotionPath) and the thread is drawn behind it (stroke-dashoffset).

  The dot holds its place in the window while it rides, a little above the middle, so what it
  passes changes and it doesn't. Near the end of each stretch it runs ahead of the scroll: into
  the work rail's hint, which carries it off sideways (the arrow's own ::after, benang.css), and
  down to the seed. After the rail it comes back in from the left edge, where it went.

  With reduced motion, or a screen too short to pin, the thread is simply drawn whole.
*/

/** Where the dot rides in the window, as a share of its height. */
const HOLD = 0.5;
/** The tail of the stretch before the rail, where the dot goes into the hint, in screens. */
const HOOK = 0.22;

const at = (el: Element) => el.getBoundingClientRect();
const top = (el: Element) => at(el).top + window.scrollY;

type Plan = {
  geo: Geo;
  animated: boolean;
  a?: { route: Route; ride: Ride };
  b?: { route: Route; ride: Ride };
  landS: number;
  playBox: [number, number];
  height: number;
};

export function Benang() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const box = root.current!;
      const q = <E extends Element = SVGElement>(sel: string) => box.querySelector<E>(sel)!;
      const svg = q<SVGSVGElement>(".bx-svg");
      const bead = q<HTMLElement>(".bx-bead");
      const clip = q<SVGPathElement>(".bx-clip path");
      const group = { a: q<SVGGElement>(".bx-a"), b: q<SVGGElement>(".bx-b") };
      const ride = { a: q<SVGPathElement>(".bx-ride-a"), b: q<SVGPathElement>(".bx-ride-b") };
      const thread = { a: q<SVGPathElement>(".bx-thread-a"), b: q<SVGPathElement>(".bx-thread-b") };
      const dots = q<SVGPathElement>(".bx-dots");
      const dripClip = q<SVGRectElement>(".bx-drip rect");
      const still = q<SVGPathElement>(".bx-still");
      const knots = box.querySelectorAll<SVGCircleElement>(".bx-knot");
      const root_ = document.documentElement;
      const answer = document.getElementById("answer")!;
      const play = document.getElementById("play");
      const mm = gsap.matchMedia();

      mm.add({ scene: SCENE_MQ, reduce: REDUCE_MQ, any: "all" }, (ctx) => {
        const { scene, reduce } = ctx.conditions as Record<string, boolean>;
        const animated = scrollyOn() && scene && !reduce;
        box.dataset.mode = animated ? "ride" : "still";

        let plan: Plan | null = null;
        const lengths = { a: 0, b: 0 };
        let last = { bead: "", park: false, bx: false, k: -1, fade: -1, drip: -1, clip: "", off: { a: -1, b: -1 } };

        const geometry = (): Geo | null => {
          const vw = root_.clientWidth;
          const vh = window.innerHeight;
          const wrap = (el: HTMLElement) => (el.parentElement?.classList.contains("pin-spacer") ? el.parentElement : el);
          const A = top(wrap(answer));
          const ar = at(answer);
          const also = document.querySelector<HTMLElement>("section.also");
          const seedY = A + answer.offsetHeight / 2;
          const leaveY = Math.min((also ? at(also).bottom + window.scrollY : A) - 10, seedY - 240);
          const base = { vw, vh, xg: threadX(vw), cx: ar.left + ar.width / 2, seedY, leaveY, answerAt: A };

          if (!animated) return { ...base, dot: { x: 0, y: 0, end: 0 }, rail: null };
          const dot = readQueryDot();
          if (!dot) return null;

          // The work rail: the section is held by a pin, and its hint has an arrow to park in.
          let rail: Geo["rail"] = null;
          const work = document.getElementById("work");
          const hint = work?.querySelector<HTMLElement>(".run-hint span");
          const track = work?.querySelector<HTMLElement>(".run-track");
          if (work && hint && track && work.parentElement?.classList.contains("pin-spacer")) {
            const spacer = work.parentElement;
            const h = at(hint);
            const s = at(work);
            if (h.width > 0) {
              const start = top(spacer);
              rail = {
                start,
                end: start + spacer.offsetHeight - work.offsetHeight,
                hx: h.left + h.width / 2 - s.left - Number(gsap.getProperty(track, "x") || 0),
                hy: h.top + h.height / 2 - s.top,
              };
            }
          }
          return { ...base, dot, rail };
        };

        const build = (): Plan | null => {
          const geo = geometry();
          if (!geo) return null;
          const { vh } = geo;
          const playEl = play;
          const playBox: [number, number] = playEl ? [top(playEl), top(playEl) + playEl.offsetHeight] : [0, 0];
          const landS = geo.answerAt - LAND * vh;
          const next: Plan = { geo, animated, landS, playBox, height: geo.seedY + vh * 0.5 };
          if (!animated) return next;

          const hold = HOLD * vh;
          const s0 = geo.dot.end;
          const seedA = hash("benang-a");
          const seedB = hash("benang-b");
          const rail = geo.rail;
          if (rail) {
            const route = routeFromDot(geo, seedA);
            const hookFrom = Math.max(s0 + 10, rail.start - HOOK * vh);
            const r = makeRide(route, {
              from: s0,
              to: rail.start,
              startY: geo.dot.y,
              hold,
              runFrom: hookFrom - Math.min(0.7 * vh, (hookFrom - s0) * 0.5),
              runTo: hookFrom,
              endY: route.ys[route.mono - 1],
              hookFrom,
            });
            next.a = { route, ride: r };

            const fromS = Math.min(rail.end + 0.5 * vh, landS - 0.6 * vh);
            const routeB = routeToSeed(geo, fromS + hold, seedB);
            next.b = {
              route: routeB,
              ride: makeRide(routeB, {
                from: fromS,
                to: landS,
                startY: fromS + hold,
                hold,
                runFrom: landS - Math.min(0.75 * vh, (landS - fromS) * 0.5),
                runTo: landS,
                endY: geo.seedY,
              }),
            };
          } else {
            const route = routeFromDot(geo, seedA);
            next.a = {
              route,
              ride: makeRide(route, {
                from: s0,
                to: landS,
                startY: geo.dot.y,
                hold,
                runFrom: landS - Math.min(0.75 * vh, (landS - s0) * 0.5),
                runTo: landS,
                endY: geo.seedY,
              }),
            };
          }
          return next;
        };

        // The play section's own stretch of the thread is hidden while the game is open.
        const gameOpen = () => play?.hasAttribute("data-started") ?? false;
        const writeClip = () => {
          if (!plan) return;
          const w = plan.geo.vw;
          const h = plan.height;
          const [t, b] = plan.playBox;
          const next = `M0 0H${w}V${h}H0Z${gameOpen() ? `M0 ${t}H${w}V${b}H0Z` : ""}`;
          if (next !== last.clip) clip.setAttribute("d", next);
          last.clip = next;
        };

        let tweenA: gsap.core.Tween | null = null;
        let tweenB: gsap.core.Tween | null = null;
        const drive = (path: SVGPathElement) => {
          gsap.set(bead, { x: 0, y: 0 });
          const tween = gsap.to(bead, {
            motionPath: { path, align: path, alignOrigin: [0.5, 0.5], autoRotate: false },
            duration: 1,
            ease: "none",
            paused: true,
          });
          tween.progress(0);
          return tween;
        };

        const measure = () => {
          tweenA?.kill();
          tweenB?.kill();
          tweenA = tweenB = null;
          plan = build();
          last = { bead: "", park: false, bx: false, k: -1, fade: -1, drip: -1, clip: "", off: { a: -1, b: -1 } };
          if (!plan) return;
          const { geo, height } = plan;
          svg.setAttribute("width", String(geo.vw));
          svg.setAttribute("height", String(height));
          svg.setAttribute("viewBox", `0 0 ${geo.vw} ${height}`);
          box.style.height = `${height}px`;
          writeClip();

          if (!plan.animated) {
            // Nothing moves: the thread from the end of the opening to the answer, with a knot at each end.
            const qs = document.querySelector(".qs");
            const y0 = qs ? at(qs).bottom + window.scrollY - 4 : 0;
            const y1 = geo.answerAt - 28;
            const s = stillThread(geo, y0, y1, hash("benang-still"));
            still.setAttribute("d", s.d);
            thread.a.setAttribute("d", "");
            thread.b.setAttribute("d", "");
            dots.setAttribute("d", "");
            knots[0].setAttribute("cx", String(geo.xg));
            knots[0].setAttribute("cy", String(y0));
            knots[1].setAttribute("cx", String(s.end[0]));
            knots[1].setAttribute("cy", String(s.end[1]));
            return;
          }

          still.setAttribute("d", "");
          const { a, b } = plan;
          if (a) {
            ride.a.setAttribute("d", a.route.d);
            thread.a.setAttribute("d", a.route.thread);
            dots.setAttribute("d", a.route.dotsD);
            lengths.a = thread.a.getTotalLength();
            thread.a.style.strokeDasharray = `${lengths.a} ${lengths.a + 2}`;
            dripClip.setAttribute("x", "0");
            dripClip.setAttribute("width", String(geo.vw));
            dripClip.setAttribute("y", String(geo.dot.y - 8));
            tweenA = drive(ride.a);
          }
          if (b) {
            ride.b.setAttribute("d", b.route.d);
            thread.b.setAttribute("d", b.route.thread);
            lengths.b = thread.b.getTotalLength();
            thread.b.style.strokeDasharray = `${lengths.b} ${lengths.b + 2}`;
            tweenB = drive(ride.b);
          } else {
            thread.b.setAttribute("d", "");
          }
        };

        const show = (state: string) => {
          if (state === last.bead) return;
          last.bead = state;
          bead.style.visibility = state === "on" ? "visible" : "hidden";
        };

        const render = (s: number) => {
          if (!plan?.animated || !plan.a) return;
          const { geo, landS } = plan;
          const a = plan.a;
          const b = plan.b;
          const rail = geo.rail;
          const onB = b && s >= b.ride.from;
          const started = s >= a.ride.from;

          // Which stretch the dot is on, and how far along it is.
          const fa = s > a.ride.to ? 1 : started ? fracAt(a.ride, s) : 0;
          const fb = b && onB ? fracAt(b.ride, s) : 0;

          const parked = !!rail && s >= rail.start && !onB;
          const landed = s >= geo.answerAt;
          const live = started && !landed && !parked && (!rail || onB || s <= a.ride.to);

          // The wax dots and the thread, drawn up to the dot.
          // Written only when it moves by half a pixel, so a stretch that isn't being drawn costs nothing.
          const reveal = (which: "a" | "b", route: Route, f: number) => {
            const from = route.threadAt;
            const len = lengths[which];
            const rev = Math.min(1, Math.max(0, (f * route.length - from) / Math.max(1, route.length - from)));
            const off = Math.round((len * (1 - rev) + (rev <= 0 ? 2 : 0)) * 2) / 2;
            if (off === last.off[which]) return;
            last.off[which] = off;
            thread[which].style.strokeDashoffset = String(off);
          };
          reveal("a", a.route, fa);
          if (b) reveal("b", b.route, fb);
          const dripBottom = Math.round(Math.max(0, a.ride.y(Math.min(s, a.ride.to)) - geo.dot.y + 12) / 2) * 2;
          const dripNow = started ? dripBottom : 0;
          if (dripNow !== last.drip) {
            last.drip = dripNow;
            dripClip.setAttribute("height", String(dripNow));
          }

          // The first stretch lets go over the screen after the rail pins, so the thread the dot left behind doesn't hang there.
          if (rail) {
            const fade = Math.round(Math.min(1, Math.max(0, (s - rail.start) / (0.22 * geo.vh))) * 20) / 20;
            if (fade !== last.fade) {
              last.fade = fade;
              group.a.style.opacity = String(1 - fade);
            }
          }

          // Where the dot is.
          let hidden = !live;
          if (live) {
            if (onB && b) tweenB?.progress(fb);
            else tweenA?.progress(fa);
            if (plan.playBox[1] > plan.playBox[0] && gameOpen()) {
              const y = onB && b ? b.ride.y(s) : a.ride.y(s);
              hidden = y > plan.playBox[0] - 14 && y < plan.playBox[1] + 14;
            }
          }
          show(hidden ? "off" : "on");

          // It lands: it grows to the seed's size and loses its ring, then the seed takes over.
          const k = live ? Math.round(Math.min(1, Math.max(0, (s - landS) / Math.max(1, geo.answerAt - landS))) * 25) / 25 : 0;
          if (k !== last.k) {
            last.k = k;
            bead.style.setProperty("--k", String(k));
          }

          if (parked !== last.park) {
            last.park = parked;
            root_.toggleAttribute("data-bx-park", parked);
          }
          // The seed is hidden until the dot has handed over to it.
          const wait = !landed;
          if (wait !== last.bx) {
            last.bx = wait;
            answer.toggleAttribute("data-bx", wait);
          }
        };

        const onRefresh = () => {
          measure();
          render(window.scrollY);
        };
        measure();
        const trigger = ScrollTrigger.create({
          start: 0,
          end: "max",
          refreshPriority: 0,
          onUpdate: (self) => render(self.scroll()),
        });
        ScrollTrigger.addEventListener("refresh", onRefresh);
        const watch = new MutationObserver(() => {
          writeClip();
          render(window.scrollY);
        });
        if (play) watch.observe(play, { attributes: true, attributeFilter: ["data-started"] });
        render(window.scrollY);

        return () => {
          ScrollTrigger.removeEventListener("refresh", onRefresh);
          watch.disconnect();
          trigger.kill();
          tweenA?.kill();
          tweenB?.kill();
          gsap.set(bead, { clearProps: "transform" });
          bead.style.visibility = "";
          bead.style.removeProperty("--k");
          group.a.style.opacity = "";
          root_.removeAttribute("data-bx-park");
          answer.removeAttribute("data-bx");
          delete box.dataset.mode;
          plan = null;
        };
      });
    },
    { scope: root },
  );

  return (
    <div ref={root} className="benang" aria-hidden="true">
      <svg className="bx-svg" focusable="false">
        <defs>
          <clipPath id="bx-clip" className="bx-clip" clipPathUnits="userSpaceOnUse">
            <path clipRule="evenodd" d="" />
          </clipPath>
          <clipPath id="bx-drip" className="bx-drip" clipPathUnits="userSpaceOnUse">
            <rect height="0" />
          </clipPath>
        </defs>
        <g clipPath="url(#bx-clip)">
          <path className="bx-still" d="" />
          <circle className="bx-knot" r="3.5" />
          <circle className="bx-knot" r="3.5" />
          <g className="bx-a">
            <path className="bx-ride bx-ride-a" d="" />
            <path className="bx-dots" d="" clipPath="url(#bx-drip)" />
            <path className="bx-thread bx-thread-a" d="" />
          </g>
          <g className="bx-b">
            <path className="bx-ride bx-ride-b" d="" />
            <path className="bx-thread bx-thread-b" d="" />
          </g>
        </g>
      </svg>
      <div className="bx-bead">
        <span className="bx-ring" />
        <span className="bx-core" />
      </div>
    </div>
  );
}
