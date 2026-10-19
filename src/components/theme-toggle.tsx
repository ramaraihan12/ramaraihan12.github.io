"use client";

import { useSyncExternalStore } from "react";
import { themeColors } from "@/lib/theme";
import { MoonIcon, SunIcon } from "./icons";

// The class on <html> is the source of truth. The inline script in layout.tsx sets it before
// React loads, so the button reads it from there instead of keeping its own copy in state.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

const isDark = () => document.documentElement.classList.contains("dark");

// The two theme-color tags from the metadata follow the system setting. A tag without a media
// query placed before them wins, so a manual choice adds one instead of editing the originals,
// which React would put back on hydration.
function setThemeColor(color: string) {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]:not([media])');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.prepend(meta);
  }
  meta.content = color;
}

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, isDark, () => false);

  function toggle() {
    const next = !isDark();
    document.documentElement.classList.toggle("dark", next);
    setThemeColor(next ? themeColors.dark : themeColors.light);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // Storage can be blocked (private mode); the toggle still works for this visit.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Dark mode"
      aria-pressed={dark}
      className="grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-ink/5 hover:text-ink"
    >
      <MoonIcon className="size-[1.125rem] dark:hidden" />
      <SunIcon className="hidden size-[1.125rem] dark:block" />
    </button>
  );
}
