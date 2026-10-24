import { useSyncExternalStore } from "react";

/*
  The current minute, shared by the clock, the sky over Merbabu and its caption, so all three
  change together, right as the minute turns. On the server (and while hydrating) it's null:
  the time is only known in the browser, so the server renders a neutral version and nothing
  mismatches.
*/

export const MINUTE = 60_000;

const listeners = new Set<() => void>();
let timer = 0;

function notify() {
  listeners.forEach((listener) => listener());
}

function schedule() {
  window.clearTimeout(timer);
  // A little past the turn of the minute, so the new one has surely started.
  timer = window.setTimeout(() => {
    notify();
    schedule();
  }, MINUTE - (Date.now() % MINUTE) + 50);
}

// A tab in the background gets its timers slowed down. Catch up as soon as it's back.
function onVisible() {
  if (document.visibilityState === "visible") {
    notify();
    schedule();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    schedule();
    document.addEventListener("visibilitychange", onVisible);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    }
  };
}

const getMinute = () => Math.floor(Date.now() / MINUTE);
const getServerMinute = () => null;

/** The start of the current minute as a Date, or null on the server and while hydrating. */
export function useMinute(): Date | null {
  const minute = useSyncExternalStore(subscribe, getMinute, getServerMinute);
  return minute === null ? null : new Date(minute * MINUTE);
}
