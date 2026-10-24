import gsap from "gsap";

/*
  Kawung is one of the oldest batik motifs: four oval palm seeds around a point, like a flower
  seen from above. On a perfect round a handful of them pop out of the score and drift down.
  Only called when motion is allowed.
*/
const KAWUNG =
  '<svg viewBox="-10 -10 20 20" aria-hidden="true" focusable="false"><g transform="rotate(45)">' +
  '<ellipse cx="0" cy="-5.2" rx="3.6" ry="4.8"/><ellipse cx="0" cy="5.2" rx="3.6" ry="4.8"/>' +
  '<ellipse cx="-5.2" cy="0" rx="4.8" ry="3.6"/><ellipse cx="5.2" cy="0" rx="4.8" ry="3.6"/></g></svg>';

const TONES = ["kunyit", "mori", "nila"];

/** Throws `count` pieces out of `host` (an empty, absolutely placed box) and cleans them up. */
export function burst(host: HTMLElement, count = 30) {
  const random = gsap.utils.random;
  const pieces = Array.from({ length: count }, (_, i) => {
    const el = document.createElement("span");
    const kawung = i % 4 !== 0;
    el.className = kawung ? "nn-bit nn-bit-kawung" : "nn-bit nn-bit-dot";
    // Turmeric shows on the indigo page, indigo on a turmeric result, cotton on both.
    el.dataset.tone = TONES[i % TONES.length];
    if (kawung) el.innerHTML = KAWUNG;
    host.appendChild(el);
    return el;
  });

  const tl = gsap.timeline({ onComplete: () => pieces.forEach((el) => el.remove()) });
  pieces.forEach((el, i) => {
    // A fan upwards, then a slow fall with a little drift, like petals rather than paper.
    const angle = random(-Math.PI * 0.92, -Math.PI * 0.08);
    const speed = random(80, 210);
    const x = Math.cos(angle) * speed;
    const y = Math.sin(angle) * speed;
    const delay = i * 0.01;
    tl.fromTo(
      el,
      { x: 0, y: 0, scale: 0, rotation: 0, opacity: 1 },
      { x, y, scale: random(0.65, 1.25), rotation: random(-140, 140), duration: 0.55, ease: "power3.out" },
      delay,
    ).to(
      el,
      {
        x: x * 1.3 + random(-30, 30),
        y: y + random(140, 240),
        rotation: `+=${random(-120, 120)}`,
        opacity: 0,
        duration: random(1, 1.5),
        ease: "power1.in",
      },
      delay + 0.5,
    );
  });
  return tl;
}
