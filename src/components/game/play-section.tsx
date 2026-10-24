"use client";

import { ScrollTrigger } from "gsap/ScrollTrigger";
import { type ComponentType, type ReactNode, useEffect, useRef, useState } from "react";
import retrieval from "@/content/retrieval.json";
import { elementMarker, setMarker } from "@/lib/stage";
import type { NearestNeighborsProps } from "./nearest-neighbors";
import { Poster } from "./poster";
import { strings as S } from "./strings";

/*
  The "play" stop. This file is all that's in the first load: the section, the poster and a
  Play button. The game itself is a separate chunk, fetched once the section is a screen away
  (so pressing Play feels instant) and mounted only when someone presses Play.
*/

type Game = ComponentType<NearestNeighborsProps>;

let loading: Promise<Game> | null = null;
function loadGame() {
  loading ??= import("./nearest-neighbors").then(
    (m) => m.NearestNeighbors,
    (error) => {
      loading = null;
      throw error;
    },
  );
  return loading;
}

export type PlaySectionProps = {
  /** The section's id, which is also the nav's href. */
  id?: string;
  className?: string;
  /** Replaces the default illustrated poster. Receives the Play button to place. */
  renderPoster?: (action: ReactNode) => ReactNode;
  /** Passed through to the game once it's loaded. */
  game?: NearestNeighborsProps;
};

const DECOYS = 7;

export function PlaySection({ id = "play", className, renderPoster, game }: PlaySectionProps) {
  const root = useRef<HTMLElement>(null);
  const [Game, setGame] = useState<Game | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "failed">("idle");
  const k = retrieval.top.length;
  const n = k + Math.min(game?.decoys ?? DECOYS, retrieval.points.length - k);
  const titleId = `${id}-title`;

  useEffect(() => {
    const section = root.current!;
    const removeMarker = setMarker("play", elementMarker(section));

    // Warm the chunk a screen ahead. It's small and gsap is already loaded, and it means the
    // game appears the moment Play is pressed. Nothing runs until then.
    const near = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        near.disconnect();
        loadGame().catch(() => {});
      },
      { rootMargin: "100% 0px" },
    );
    near.observe(section);

    // The game is taller than the poster and changes height as it's played. The pinned scenes
    // below measured the page when it loaded, so they need to measure again.
    let height = section.offsetHeight;
    let timer = 0;
    const resized = new ResizeObserver(() => {
      if (section.offsetHeight === height) return;
      height = section.offsetHeight;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => ScrollTrigger.refresh(), 150);
    });
    resized.observe(section);

    return () => {
      removeMarker();
      near.disconnect();
      resized.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  function play() {
    if (status === "loading") return;
    setStatus("loading");
    loadGame().then(
      (component) => {
        setGame(() => component);
        setStatus("idle");
      },
      () => setStatus("failed"),
    );
  }

  const button = (
    <button
      type="button"
      className="nn-btn nn-btn-solid nn-play"
      onClick={play}
      onPointerEnter={() => void loadGame().catch(() => {})}
      onFocus={() => void loadGame().catch(() => {})}
      aria-busy={status === "loading" || undefined}
      aria-describedby={`${id}-how`}
    >
      <span className="nn-play-icon" aria-hidden="true" />
      {status === "loading" ? S.poster.loading : S.poster.play}
    </button>
  );

  return (
    <section
      id={id}
      ref={root}
      className={className ? `nn ${className}` : "nn"}
      aria-labelledby={titleId}
      data-started={Game ? "" : undefined}
    >
      <div className="container-page">
        <p className="eyebrow">{S.section.eyebrow}</p>
        <h2 id={titleId} className="display-l nn-title">
          {S.section.title}
        </h2>
        <p id={`${id}-how`} className="lead nn-intro">
          {S.section.intro(k)}
        </p>

        {Game ? (
          <Game {...game} />
        ) : (
          <>
            {renderPoster ? renderPoster(button) : <Poster data={retrieval} n={n} k={k} action={button} />}

            {/* Without scripts there's no game, so the answer it hides is shown instead. */}
            <div className="nn-static" data-failed={status === "failed" || undefined}>
              <p className="nn-static-lead">{status === "failed" ? S.poster.failed(k) : S.static.lead(k)}</p>
              <ol className="nn-static-list" aria-label={S.static.listLabel(k)}>
                {retrieval.top.map((t, rank) => {
                  const note = retrieval.points[t.index];
                  return (
                    <li key={t.index}>
                      <p className="nn-static-head">
                        <span className="nn-static-rank">{rank + 1}</span>
                        <span>{note.source}</span>
                        <span className="nn-static-score">
                          <span className="sr-only">{S.static.scoreLabel} </span>
                          {t.score.toFixed(3)}
                        </span>
                      </p>
                      <p className="nn-static-text">{note.text}</p>
                    </li>
                  );
                })}
              </ol>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
