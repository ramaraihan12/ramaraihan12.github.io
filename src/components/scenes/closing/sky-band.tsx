"use client";

import type { CSSProperties, ReactNode } from "react";
import { type Sky, skyAt } from "@/components/art/sky";
import { contactCopy } from "@/content/copy";
import { useMinute } from "./salatiga-time";

/*
  The sky over Merbabu, at the time it is in Salatiga right now.

  The drawing itself is rendered on the server (contact.tsx) with its sky colors, sun and stars
  left as CSS variables. This sets them, once the browser knows the time, and again every
  minute. Until then, and without scripts, the sky stays undyed: plain kunyit, like the cloth
  around it (the defaults are in contact.css). The variables are registered with @property,
  so the sky fades from that into the real one instead of jumping. Nothing here changes size,
  so the page doesn't move.
*/

/*
  The band is cut to a wide strip (32vw tall, see contact.css), which crops the top of the
  drawing: about the top 27% of the sky is out of view. skyAt() arcs the sun from the ridge
  (0.66) up to 0.12, so at midday it would be gone. Flatten the arc to peak at 0.34 instead,
  still clear above Merbabu's summit.
*/
const HORIZON = 0.66;
const flatten = (y: number) => HORIZON - (HORIZON - y) * ((HORIZON - 0.34) / (HORIZON - 0.12));

function skyVars(sky: Sky) {
  const [top, mid, low] = sky.stops;
  return {
    "--sky-top": top,
    "--sky-mid": mid,
    "--sky-low": low,
    "--sun-x": sky.sun.x,
    "--sun-y": Math.round(flatten(sky.sun.y) * 1000) / 1000,
    "--sun-on": sky.sun.visible ? 1 : 0,
    "--stars": sky.stars,
  } as CSSProperties;
}

export function SkyBand({ children }: { children: ReactNode }) {
  const now = useMinute();
  const sky = now ? skyAt(now) : null;
  return (
    <div className="contact-sky" aria-hidden="true" data-phase={sky?.phase} style={sky ? skyVars(sky) : undefined}>
      {children}
    </div>
  );
}

/** One line on what I'm likely doing, by the same clock. Empty until the time is known. */
export function SkyCaption() {
  const now = useMinute();
  return <span className="contact-sky-caption">{now ? contactCopy.sky[skyAt(now).phase] : null}</span>;
}
