"use client";

import { clockCopy } from "@/content/copy";
import { site } from "@/content/site";
import { useMinute } from "./scenes/closing/salatiga-time";

const format = new Intl.DateTimeFormat("en-GB", {
  timeZone: site.timeZone,
  hour: "2-digit",
  minute: "2-digit",
});

/** Local time in Salatiga, so someone in another time zone knows if I'm likely awake. */
export function SalatigaClock() {
  const now = useMinute();
  return now ? (
    <>
      {clockCopy.before} <time dateTime={now.toISOString()}>{format.format(now)}</time> {clockCopy.after}
    </>
  ) : (
    <>{clockCopy.fallback}</>
  );
}
