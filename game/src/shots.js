// The screenshot scenes behind ?shot=cover|ring|land|title. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered
// by a simple autopilot (bank toward the next ring, hold a gentle climb, keep
// the throttle fed), so the frame is what a short flight really looks like
// and the same seed always gives the same frame. The cover is the money shot:
// mid-flight, a ring ahead, the runway in the distance, the HUD lit.

import { STEP } from './config.js';
import { EVENT_DONE, EVENT_OVER, SCREEN_DONE, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './world.js';

const COVER_SECONDS = 32;
const RING_SECONDS = 37;
const LAND_SECONDS = 82;
const TITLE_SECONDS = 4;

/** Steer the plane toward the next ring: bank into the turn, hold the climb. */
function autopilot(world) {
  const { plane } = world.state;
  const ring = world.nextRing();
  if (ring) {
    // Desired heading to the ring, and the bank that gets us there. The gain
    // is firm so the line converges well before the ring, and the throttle
    // eases off close in so the plane is not rushing the hoop.
    const dx = ring.x - plane.x;
    const dz = Math.max(40, ring.z - plane.z);
    const wantHeading = Math.atan2(dx, dz);
    let err = wantHeading - plane.heading;
    while (err > Math.PI) err -= Math.PI * 2;
    while (err < -Math.PI) err += Math.PI * 2;
    const bank = Math.max(-1, Math.min(1, err * 3.2));
    // Hold altitude near the ring's height; climb gently when low.
    const dy = ring.y - plane.y;
    const pitch = Math.max(-0.6, Math.min(0.7, dy * 0.03));
    const close = dz < 350;
    return { bank, pitch, throttle: close ? (plane.throttle > 0.45 ? -1 : 0) : (plane.throttle < 0.62 ? 1 : 0) };
  }
  // No rings left: line up on the destination runway and descend for it.
  const dest = world.state.terrain.runways[1];
  const targetZ = (dest.z0 + dest.z1) / 2;
  const dx = 0 - plane.x;
  const dz = Math.max(40, targetZ - plane.z);
  const wantHeading = Math.atan2(dx, dz);
  let err = wantHeading - plane.heading;
  while (err > Math.PI) err -= Math.PI * 2;
  while (err < -Math.PI) err += Math.PI * 2;
  const bank = Math.max(-1, Math.min(1, err * 2.2));
  // Descend toward the threshold: aim for a gentle 3-degree glide.
  const dist = Math.max(60, targetZ - plane.z);
  const wantAlt = Math.max(4, (dist * 0.05) + 2);
  const dy = wantAlt - plane.y;
  const pitch = Math.max(-0.5, Math.min(0.4, dy * 0.03));
  return { bank, pitch, throttle: plane.throttle > 0.3 ? -1 : 0 };
}

/** Fly the world forward for `seconds`, steered by the autopilot. Only a
 * finished sortie (landed or crashed) stops the flight early; collecting a
 * ring or a warning does not. */
function flyForward(world, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const events = world.step(autopilot(world), false);
    if (events & (EVENT_DONE | EVENT_OVER)) break;
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it and
 * the best score to show. Any unknown name is the cover.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'title') {
    for (let i = 0; i < TITLE_SECONDS / STEP; i += 1) world.step({ bank: 0, pitch: 0, throttle: 0 }, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'land') {
    // Fly almost the whole course, then let the autopilot bring it onto final.
    flyForward(world, LAND_SECONDS);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'ring') {
    flyForward(world, RING_SECONDS);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  // Cover: mid-course, a ring ahead and the valley open.
  flyForward(world, COVER_SECONDS);
  return { screen: SCREEN_PLAY, best: world.state.score };
}

// Keep the screen names importable for the stages above.
export { SCREEN_DONE, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE };
