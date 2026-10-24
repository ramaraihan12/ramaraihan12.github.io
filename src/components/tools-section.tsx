import { CapStamp } from "@/components/art";
import { capStampHref } from "@/components/art/files";
import { toolsCopy } from "@/content/copy";
import { stack } from "@/content/stack";
import { ToolsMotion } from "./scenes/middle/tools-motion";

/*
  The stack, one row per kind of tool, each name pressed on like a batik cap. Rendered on the
  server already printed, which is what reduced motion and no-script visitors see. The press
  itself is ToolsMotion's.

  Each name is there twice in one grid cell: a hidden copy at full width holds the stamp's
  size, and the visible one spreads out to it from condensed as the cap lands, so nothing
  around it re-wraps while the width animates.
*/
export function ToolsSection() {
  return (
    <ToolsMotion id="tools" className="tools" aria-labelledby="tools-title">
      <div className="container-page">
        <p className="eyebrow">{toolsCopy.eyebrow}</p>
        <h2 id="tools-title" className="display-l mt-4">
          {toolsCopy.title}
        </h2>
        <p className="lead mt-5">{toolsCopy.lead}</p>

        <ul className="tools-list">
          {stack.map((group) => (
            <li key={group.key} className="tool-row">
              <h3 className="tool-key">
                <span className="sr-only">{group.name}: </span>
                <span aria-hidden="true">{group.key}</span>
              </h3>
              <div>
                <ul className="tool-items">
                  {group.items.map((item) => (
                    <li key={item}>
                      <CapStamp ink="mori" seed={item} frameHref={capStampHref(item)} className="tool-stamp">
                        <span className="tool-name-size" aria-hidden="true">
                          {item}
                        </span>
                        <span className="tool-name">{item}</span>
                      </CapStamp>
                    </li>
                  ))}
                </ul>
                <p className="tool-note">{group.note}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </ToolsMotion>
  );
}
