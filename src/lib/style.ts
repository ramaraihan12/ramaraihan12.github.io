import type { CSSProperties } from "react";

/** Sets the --delay custom property read by the .rise animation in globals.css. */
export function riseDelay(ms: number): CSSProperties {
  return { "--delay": `${ms}ms` } as CSSProperties;
}
