"use client";

import dynamic from "next/dynamic";

/** The 404 cloth on demand, so the home page's bundle (which carries the not-found boundary) doesn't include it. */
export const ClothLazy = dynamic(() => import("./cloth").then((m) => m.Cloth));
