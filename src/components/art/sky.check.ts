/*
  A small check for sky.ts, no test framework. Run it with:

    npx tsx src/components/art/sky.check.ts

  It prints the sky at a few times of day and fails loudly if something is off.
*/
import assert from "node:assert/strict";
import { skyAt, skyAtHour } from "./sky";

const at = (hhmm: string) => new Date(`2026-10-24T${hhmm}:00+07:00`);
const hex = /^#[0-9a-f]{6}$/;

const samples = ["06:00", "12:00", "18:00", "23:00"].map((t) => [t, skyAt(at(t))] as const);
for (const [t, s] of samples) console.log(t, JSON.stringify(s));

const [morning, noon, dusk, night] = samples.map(([, s]) => s);
assert.equal(morning.phase, "morning");
assert.equal(noon.phase, "day");
assert.equal(dusk.phase, "dusk");
assert.equal(night.phase, "night");

for (const [, s] of samples) {
  assert.equal(s.stops.length, 3);
  for (const c of s.stops) assert.match(c, hex);
}

// The sun is up and high at noon, gone at 23:00. Stars the other way round.
assert.ok(noon.sun.visible && noon.sun.y < 0.2, "sun high at noon");
assert.ok(!night.sun.visible, "no sun at night");
assert.equal(noon.stars, 0);
assert.equal(night.stars, 1);
assert.ok(morning.sun.x < noon.sun.x, "sun moves left to right");

// The time zone matters: 06:00 in Jakarta is 23:00 the day before in UTC.
assert.equal(skyAt(at("06:00"), "UTC").phase, "night");

// No jumps: a minute never changes a color channel by more than a few steps.
let worst = 0;
for (let m = 0; m < 24 * 60; m++) {
  const a = skyAtHour(m / 60).stops;
  const b = skyAtHour((m + 1) / 60).stops;
  for (let k = 0; k < 3; k++) {
    for (let c = 1; c < 7; c += 2) {
      worst = Math.max(worst, Math.abs(parseInt(a[k].slice(c, c + 2), 16) - parseInt(b[k].slice(c, c + 2), 16)));
    }
  }
}
assert.ok(worst <= 6, `largest change in one minute is ${worst}`);

// Midnight wraps cleanly.
assert.deepEqual(skyAtHour(0).stops, skyAtHour(24).stops);

console.log(`ok (largest one-minute color step: ${worst})`);
