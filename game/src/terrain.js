// The valley: a procedural heightfield the course runs down, plus the ground
// features drawn on it (fields, a river, a road, trees, the two runways).
// Everything is a pure function of the mission seed, so the same seed always
// builds the same valley.

import { VALLEY } from './config.js';
import { createNoise, range } from './random.js';

/** A ground feature the renderer draws as a projected patch or sprite. */
export const KIND_FIELD = 'field';
export const KIND_TREE = 'tree';
export const KIND_HOUSE = 'house';
export const KIND_RUNWAY = 'runway';

/**
 * Build the valley for a mission seed. Returns the height function and the
 * lists of features, the rings' course line and the two runway strips.
 * x is lateral (metres from the centreline, + to the right), z is distance
 * down the course (metres from the departure runway).
 */
export function createTerrain(seed) {
  const low = createNoise(seed * 7 + 1);
  const high = createNoise(seed * 13 + 5);
  const wobble = createNoise(seed * 29 + 11);

  // The river snakes down the valley floor; the road follows it loosely.
  const riverX = (z) => (wobble(z * 0.00012) - 0.5) * 150;
  const roadX = (z) => riverX(z) + 55 + (wobble(z * 0.00009 + 40) - 0.5) * 40;

  /** Ground height in metres at (x, z). 0 is the valley floor. */
  function heightAt(x, z) {
    const ax = Math.abs(x);
    // Rolling floor: gentle undulation that never blocks the course.
    let h = (low(z * 0.0016) - 0.5) * 14 + (high(z * 0.004) - 0.5) * 5;
    // The valley walls rise steeply once past the floor's edge.
    if (ax > VALLEY.wallStart) {
      const t = Math.min(1, (ax - VALLEY.wallStart) / 260);
      h += t * t * VALLEY.wallHeight * (0.7 + 0.6 * low(x * 0.008 + z * 0.001));
    }
    // The river carves a shallow channel.
    const dRiver = Math.abs(x - riverX(z));
    if (dRiver < 26) h -= (1 - dRiver / 26) * 4;
    return h;
  }

  // Fields: coloured patches scattered on the floor, clear of the river, the
  // road and the runways.
  const fields = [];
  const rand = (() => {
    let a = seed * 31 + 7;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })();
  const fieldKinds = [0, 1, 2, 0, 1, 2, 0, 1];
  for (let i = 0; i < 90; i += 1) {
    const z = range(rand, 120, VALLEY.length - 120);
    const x = range(rand, -VALLEY.halfWidth + 30, VALLEY.halfWidth - 30);
    if (Math.abs(x - riverX(z)) < 34) continue;
    if (Math.abs(x - roadX(z)) < 18) continue;
    if (z < 260 || z > VALLEY.length - 260) continue;
    fields.push({
      kind: KIND_FIELD,
      x,
      z,
      w: range(rand, 40, 110),
      d: range(rand, 40, 130),
      variant: fieldKinds[i % fieldKinds.length],
    });
  }

  // Trees in loose copses, and a few farmhouses near the road.
  const trees = [];
  const houses = [];
  for (let i = 0; i < 240; i += 1) {
    const z = range(rand, 60, VALLEY.length - 60);
    const x = range(rand, -VALLEY.halfWidth - 40, VALLEY.halfWidth + 40);
    if (Math.abs(x - riverX(z)) < 30) continue;
    if (Math.abs(x - roadX(z)) < 14) continue;
    if (z < 200 || z > VALLEY.length - 200) continue;
    trees.push({ kind: KIND_TREE, x, z, s: range(rand, 0.7, 1.5) });
  }
  for (let i = 0; i < 14; i += 1) {
    const z = range(rand, 300, VALLEY.length - 300);
    const x = roadX(z) + (rand() < 0.5 ? -26 : 26);
    houses.push({ kind: KIND_HOUSE, x, z, s: range(rand, 0.9, 1.3) });
  }

  // The two runways: departure at z = 0, destination at the far end.
  const runways = [
    { kind: KIND_RUNWAY, z0: -40, z1: 190, x: 0, w: 30, name: '07' },
    { kind: KIND_RUNWAY, z0: VALLEY.length - 40, z1: VALLEY.length + 190, x: 0, w: 30, name: '25' },
  ];

  return { heightAt, riverX, roadX, fields, trees, houses, runways };
}
