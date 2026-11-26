// A small seeded random number generator (mulberry32): the same seed gives the
// same valley, the same rings and the same screenshot, which is what makes the
// staged scenes repeatable. Written here from the algorithm's definition.

export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A 1-D value-noise helper: smooth pseudo-random values in [0, 1) along an axis. */
export function createNoise(seed) {
  const rand = createRandom(seed);
  const table = new Float64Array(256);
  for (let i = 0; i < 256; i += 1) table[i] = rand();
  const fade = (t) => t * t * (3 - 2 * t);
  return function noise(x) {
    const xi = Math.floor(x);
    const xf = x - xi;
    const a = table[((xi % 256) + 256) % 256];
    const b = table[(((xi + 1) % 256) + 256) % 256];
    return a + (b - a) * fade(xf);
  };
}

/** Pick a value in [min, max) from a random function. */
export function range(rand, min, max) {
  return min + rand() * (max - min);
}

/** Pick an integer in [min, max] from a random function. */
export function rangeInt(rand, min, max) {
  return min + Math.floor(rand() * (max - min + 1));
}
