import type { CSSProperties, ReactNode } from "react";
import { type BatikKind, batikDataUri, batikTileSize } from "./patterns";

export type BatikFrameProps = {
  children: ReactNode;
  /** The border's motif. Parang by default; kawung and truntum work too. */
  motif?: BatikKind;
  /** Border thickness, any CSS length. Default 0.9rem. */
  width?: string;
  /** Literal colors only (the border is a data URI, which can't read CSS variables). */
  ink?: string;
  ground?: string;
  /** Body dye for the blades or petals. Soga by default; "none" for line only. */
  tint?: string;
  /** Pattern scale. 0.4 gives a 48px parang tile, about right for a 0.9rem border. */
  scale?: number;
  /** Corner radius of the outside edge. */
  radius?: string;
  as?: "div" | "span" | "figure";
  className?: string;
  style?: CSSProperties;
};

/**
 * Wraps a photo (or anything) in a batik border, with a thin wax line between the border and
 * the picture. Server-friendly: it's a styled box with a data-URI background. The inner line
 * and image sizing come from art.css (.art-frame, .art-frame-inner).
 */
export function BatikFrame({
  children,
  motif = "parang",
  width = "0.9rem",
  ink = "#efe9dc",
  ground = "#0f1a47",
  tint = "#8a5a2b",
  scale = 0.4,
  radius = "0.4rem",
  as: Tag = "div",
  className,
  style,
}: BatikFrameProps) {
  const tile = batikTileSize(motif, scale);
  return (
    <Tag
      className={className ? `art-frame ${className}` : "art-frame"}
      style={
        {
          "--art-frame-w": width,
          "--art-frame-ink": ink,
          "--art-frame-ground": ground,
          padding: width,
          borderRadius: radius,
          backgroundColor: ground,
          backgroundImage: batikDataUri(motif, { ink, ground, tint: tint === "none" ? undefined : tint, scale }),
          backgroundSize: `${tile}px ${tile}px`,
          backgroundPosition: "center",
          ...style,
        } as CSSProperties
      }
    >
      <span className="art-frame-inner">{children}</span>
    </Tag>
  );
}
