import gsap from "gsap";

/**
 * Parallax for the hero's landscape: every layer moves by its data-depth (0 is the sky, 1 the
 * foreground), so the near hills move most. Two inputs add up: the pointer (eased, fine pointers
 * only, set by the scene) and the scroll (`sink`, set straight from the timeline, so it scrubs).
 * Offsets are in screen pixels at depth 1.
 */
export function landRig(box: HTMLElement) {
  const svg = box.querySelector("svg");
  const layers = svg
    ? [...svg.querySelectorAll<SVGGElement>("g[data-depth]")]
        .map((el) => ({ el, depth: Number(el.dataset.depth) }))
        .filter((l) => l.depth > 0)
    : [];
  const at = { px: 0, py: 0, sink: 0 };
  // viewBox units per screen pixel. The drawing is "slice"d, so the larger ratio wins.
  let unit = 1;

  const apply = () => {
    for (const { el, depth } of layers) {
      const x = at.px * depth * unit;
      const y = (at.py + at.sink) * depth * unit;
      el.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
    }
  };

  const measure = () => {
    if (!svg) return;
    // Read from the drawing itself, so the landscape's code stays on the server.
    const vb = svg.viewBox.baseVal;
    const r = svg.getBoundingClientRect();
    const scale = vb?.width ? Math.max(r.width / vb.width, r.height / vb.height) : 1;
    unit = scale > 0 ? 1 / scale : 1;
    apply();
  };

  const toX = gsap.quickTo(at, "px", { duration: 1.1, ease: "power3", onUpdate: apply });
  const toY = gsap.quickTo(at, "py", { duration: 1.1, ease: "power3", onUpdate: apply });

  return {
    measure,
    /** Pointer offset at depth 1, eased. */
    point(x: number, y: number) {
      toX(x);
      toY(y);
    },
    /** Scroll offset at depth 1, applied at once. */
    sink(y: number) {
      if (y === at.sink) return;
      at.sink = y;
      apply();
    },
    kill() {
      gsap.killTweensOf(at);
      for (const { el } of layers) el.removeAttribute("transform");
    },
  };
}
