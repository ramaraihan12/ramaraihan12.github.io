import type { CSSProperties } from "react";
import { CapStamp } from "@/components/art";
import { type BatikTileName, batikTile, capStampHref } from "@/components/art/files";
import { toolsCopy } from "@/content/copy";
import { stack } from "@/content/stack";
import { ToolsMotion } from "./scenes/middle/tools-motion";
import { toolsClothCopy } from "./tools-copy";

/*
  The stack as a test cloth: one length of mori with a band of motif across it for each kind of
  tool, and every tool pressed on below its band like a batik cap. Rendered on the server
  already printed, which is what reduced motion and no-script visitors see. The printing itself
  is ToolsMotion's: the band goes on a cap at a time, then the names, in step with the scroll.

  Under each name is its pola, the pencil sketch a batik maker draws before the wax goes on:
  the name in outline and the stamp's own frame, untilted, so the print lands a little off it
  the way a real cap does. It fades as the ink covers it. Hidden from screen readers, since the
  stamp holds the name.
*/

/** The motif across each band, top to bottom, nila and soga in turn. Kawung first, the embed step's motif, over the AI tools. */
const BANDS: BatikTileName[] = ["tools-kawung", "web-kepala", "tools-truntum", "tools-kawung-soga", "tools-parang"];

export function ToolsSection() {
  return (
    <ToolsMotion id="tools" className="tools" aria-labelledby="tools-title">
      <div className="container-page">
        <p className="eyebrow">{toolsCopy.eyebrow}</p>
        <h2 id="tools-title" className="display-l mt-4">
          {toolsCopy.title}
        </h2>
        <p className="lead mt-5">{toolsCopy.lead}</p>

        <figure className="tools-cloth">
          <ul className="tool-bands">
            {stack.map((group, i) => (
              <li key={group.key} className="tool-band" style={{ "--motif": batikTile(BANDS[i % BANDS.length]).css } as CSSProperties}>
                <div className="tool-strip">
                  <span className="tool-print" aria-hidden="true" />
                  <h3 className="tool-key">
                    <span className="sr-only">{group.name}: </span>
                    <span aria-hidden="true">{group.key}</span>
                  </h3>
                </div>
                <div className="tool-body">
                  <ul className="tool-caps">
                    {group.items.map((item) => {
                      const frame = capStampHref(item);
                      return (
                        <li key={item} className="tool-cap">
                          <span className="tool-pola" aria-hidden="true">
                            {frame ? (
                              <svg className="tool-pola-frame" viewBox="0 0 100 40" preserveAspectRatio="none" focusable="false">
                                <use href={frame} />
                              </svg>
                            ) : null}
                            <span className="tool-pola-name">{item}</span>
                          </span>
                          <CapStamp ink="nila" seed={item} frameHref={frame} className="tool-stamp">
                            {item}
                          </CapStamp>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="tool-note">{group.note}</p>
                </div>
              </li>
            ))}
          </ul>
          <figcaption className="tools-caption">{toolsClothCopy.caption}</figcaption>
        </figure>
      </div>
    </ToolsMotion>
  );
}
