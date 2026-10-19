"use client";

import { useSyncExternalStore } from "react";
import { site } from "@/content/site";

const format = new Intl.DateTimeFormat("en-GB", {
  timeZone: site.timeZone,
  hour: "2-digit",
  minute: "2-digit",
});

function subscribe(onChange: () => void) {
  const timer = setInterval(onChange, 15_000);
  return () => clearInterval(timer);
}

const now = () => format.format(new Date());

/** Local time in Salatiga, so someone in another time zone knows if I'm likely awake. */
export function SalatigaClock() {
  const time = useSyncExternalStore(subscribe, now, () => null);
  return time ? (
    <>
      It&apos;s <time>{time}</time> in Salatiga (UTC+7)
    </>
  ) : (
    <>Salatiga, UTC+7</>
  );
}
