// The target rings: glowing hoops standing on the course that the plane must
// fly through in order. Each ring hangs in the air above the valley floor at
// a fixed distance down the course; flying near its centre collects it.

import { RING, VALLEY } from './config.js';
import { range } from './random.js';

/**
 * Lay out a mission's rings. `count` rings are spread down the valley, each
 * one offset left or right of the centreline and hung at a flyable height.
 * Returns an array of { x, y, z, radius, got, missed, flash }.
 */
export function createRings(rand, count, terrain) {
  const rings = [];
  const firstZ = 700;
  const lastZ = VALLEY.length - 700;
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const z = firstZ + (lastZ - firstZ) * t;
    // Alternate sides so the course weaves; keep the offsets gentle early on.
    const sway = Math.sin(i * 1.7) * 90 + range(rand, -40, 40);
    const x = Math.max(-150, Math.min(150, sway));
    const groundY = terrain.heightAt(x, z);
    const y = groundY + range(rand, 55, 95);
    rings.push({ x, y, z, radius: RING.radius, got: false, missed: false, flash: 0 });
  }
  return rings;
}

/** The next ring the pilot has to fly through, or null when all are got or missed. */
export function nextRing(rings) {
  for (let i = 0; i < rings.length; i += 1) {
    if (!rings[i].got && !rings[i].missed) return rings[i];
  }
  return null;
}

/**
 * Test the plane against the next ring. The plane must be near the ring's
 * z and within its hit radius of the centre. Returns the ring when flown
 * through, else null.
 */
export function testRing(rings, plane) {
  const ring = nextRing(rings);
  if (!ring) return null;
  if (Math.abs(plane.z - ring.z) > 26) return null;
  const dx = plane.x - ring.x;
  const dy = plane.y - ring.y;
  if (Math.hypot(dx, dy) > RING.hitRadius) return null;
  ring.got = true;
  ring.flash = 1;
  return ring;
}

/** Fade the collected flash on every ring, one step at a time. */
export function stepRings(rings, dt) {
  for (let i = 0; i < rings.length; i += 1) {
    if (rings[i].flash > 0) rings[i].flash = Math.max(0, rings[i].flash - dt * 1.4);
  }
}
