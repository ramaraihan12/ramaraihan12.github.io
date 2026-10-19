import type { CSSProperties } from "react";

/** Inline custom properties used by the CSS motion rules in globals.css. */
export function motionVars(vars: { delay?: number; step?: number }): CSSProperties {
  const style: Record<string, string | number> = {};
  if (vars.delay !== undefined) style["--delay"] = `${vars.delay}ms`;
  if (vars.step !== undefined) style["--step"] = vars.step;
  return style as CSSProperties;
}
