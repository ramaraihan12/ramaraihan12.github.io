"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// The thread only shows after the map unpins and its box is empty on the server, so its code
// (MotionPathPlugin and all) waits until the engine is up instead of sitting in the first load.
const Benang = dynamic(() => import("./benang").then((m) => m.Benang), { ssr: false });

export function BenangLazy() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const check = () => {
      if (!root.dataset.engine) return;
      watch.disconnect();
      setReady(true);
    };
    const watch = new MutationObserver(check);
    watch.observe(root, { attributes: true, attributeFilter: ["data-engine"] });
    queueMicrotask(check);
    return () => watch.disconnect();
  }, []);
  return ready ? <Benang /> : null;
}
