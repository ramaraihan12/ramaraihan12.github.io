import type { CSSProperties } from "react";

/**
 * A request's path through one app. --p (0 to 1) moves the dot along the wire and lights each
 * step as the dot reaches it; the run section drives it from the scroll position.
 */
export function Pipeline({ steps }: { steps: string[] }) {
  return (
    <div className="pipe" style={{ "--n": steps.length } as CSSProperties}>
      <ol className="pipe-steps" aria-label="How a request moves through it">
        {steps.map((step, i) => (
          <li key={step} className="pipe-node" style={{ "--i": i } as CSSProperties}>
            {step}
          </li>
        ))}
      </ol>
      <span className="pipe-packet" aria-hidden="true" />
    </div>
  );
}
