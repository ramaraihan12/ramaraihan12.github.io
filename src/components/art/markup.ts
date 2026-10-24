import { Fragment, isValidElement, type ReactElement, type ReactNode } from "react";

/*
  Turns a tree of plain SVG elements (and the small function components that draw them) into
  markup, so a drawing written in JSX can also be saved as an .svg file at build time. Route
  handlers can't use react-dom/server, and this needs far less of it: no hooks, no context, no
  events, only tags, attributes, text and dangerouslySetInnerHTML.
*/

// React writes these props as dashed SVG attributes. Everything else keeps its spelling
// (viewBox, preserveAspectRatio, gradientUnits, ...).
const DASHED = new Set([
  "clipPath",
  "clipRule",
  "colorInterpolationFilters",
  "dominantBaseline",
  "fillOpacity",
  "fillRule",
  "floodColor",
  "floodOpacity",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "letterSpacing",
  "markerEnd",
  "markerMid",
  "markerStart",
  "paintOrder",
  "pointerEvents",
  "shapeRendering",
  "stopColor",
  "stopOpacity",
  "strokeDasharray",
  "strokeDashoffset",
  "strokeLinecap",
  "strokeLinejoin",
  "strokeMiterlimit",
  "strokeOpacity",
  "strokeWidth",
  "textAnchor",
  "vectorEffect",
]);

const dash = (name: string) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

function style(value: Record<string, unknown>) {
  return Object.entries(value)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k.startsWith("--") ? k : dash(k)}:${v}`)
    .join(";");
}

/** SVG markup for a React tree of SVG elements. Throws on anything it doesn't know how to write. */
export function svgMarkup(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return escape(String(node));
  if (Array.isArray(node)) return node.map(svgMarkup).join("");
  if (!isValidElement(node)) throw new Error("svgMarkup: unsupported node");

  const { type, props } = node as ReactElement<Record<string, unknown> & { children?: ReactNode }>;
  if (type === Fragment) return svgMarkup(props.children);
  if (typeof type === "function") return svgMarkup((type as (p: unknown) => ReactNode)(props));
  if (typeof type !== "string") throw new Error("svgMarkup: unsupported element type");

  let attrs = "";
  let inner = "";
  for (const [key, value] of Object.entries(props)) {
    if (key === "children" || key === "key" || value === undefined || value === null || value === false) continue;
    if (key === "dangerouslySetInnerHTML") {
      inner = (value as { __html: string }).__html;
      continue;
    }
    const name = key === "className" ? "class" : DASHED.has(key) ? dash(key) : key;
    const text = key === "style" ? style(value as Record<string, unknown>) : value === true ? "" : String(value);
    attrs += ` ${name}="${escape(text)}"`;
  }
  const content = inner || svgMarkup(props.children);
  return content ? `<${type}${attrs}>${content}</${type}>` : `<${type}${attrs}/>`;
}
