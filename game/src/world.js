// The world: the flight state machine and the rules of the sortie. It owns
// the plane, the terrain, the rings, the score and the clock, and turns the
// pilot's input into a flight. Screens: title, play, paused, done, over.

import { MISSIONS, PLANE, RING, LANDING, STEP, VALLEY } from './config.js';
import { createRandom } from './random.js';
import { createTerrain } from './terrain.js';
import { createAircraft, stepAircraft } from './aircraft.js';
import { createRings, nextRing, testRing, stepRings } from './rings.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_DONE = 'done';

const EVENT_NONE = 0;
export const EVENT_RING = 1;
export const EVENT_DONE = 2;
export const EVENT_OVER = 4;
export const EVENT_WARN = 8;

/**
 * Build a world for a mission index. The valley, the rings and the clouds
 * are all seeded from the mission, so the same mission always flies the
 * same course.
 */
export function createWorld(missionIndex) {
  const mission = MISSIONS[missionIndex];
  const rand = createRandom(mission.seed);
  const terrain = createTerrain(mission.seed);
  const rings = createRings(rand, mission.rings, terrain);
  const clouds = [];
  for (let i = 0; i < 26; i += 1) {
    clouds.push({
      x: (rand() - 0.5) * 1400,
      y: 120 + rand() * 160,
      z: rand() * (VALLEY.length + 600) - 200,
      r: 40 + rand() * 70,
    });
  }
  // Two seeded ridge lines for the distant mountains (drawn by the renderer).
  const ridgeRand = createRandom(mission.seed * 3 + 2);
  const ridgeRand2 = createRandom(mission.seed * 5 + 9);
  const plane = createAircraft();
  plane.fuel = mission.fuel;

  const state = {
    mission,
    missionIndex,
    dusk: mission.dusk === 1,
    terrain,
    rings,
    clouds,
    ridgeRand,
    ridgeRand2,
    plane,
    score: 0,
    timeLeft: mission.timeLimit,
    message: '',
    messageColor: null,
    messageT: 0,
    overTitle: '',
    overSub: '',
    warned: false,
    landed: false,
  };

  function say(text, color, seconds = 2.4) {
    state.message = text;
    state.messageColor = color || null;
    state.messageT = seconds;
  }

  function reset() {
    const fresh = createWorld(missionIndex);
    for (const key of Object.keys(fresh.state)) state[key] = fresh.state[key];
    state.message = '';
    state.messageT = 0;
    state.warned = false;
  }

  /**
   * One fixed step of the sortie. `ctl` is the pilot's input for this step.
   * Returns an event flag: ring collected, mission done, crashed, or a
   * low-fuel warning. The title screen idles the plane on the runway.
   * The terrain and rings are read from the state, so a reset truly restarts.
   */
  function step(ctl, idle) {
    if (state.messageT > 0) state.messageT -= STEP;
    if (state.messageT <= 0) state.message = '';
    stepRings(state.rings, STEP);

    if (idle) {
      // On the title screen the plane sits on the runway, prop ticking over.
      state.plane.throttle = 0.12;
      state.plane.propAngle += 0.4;
      return EVENT_NONE;
    }

    let events = EVENT_NONE;
    const plane = state.plane;
    const terrain = state.terrain;
    const rings = state.rings;
    const groundY = terrain.heightAt(plane.x, plane.z);
    stepAircraft(plane, ctl, groundY);
    state.timeLeft -= STEP;

    // The clock: running out of time ends the sortie.
    if (state.timeLeft <= 0) {
      state.overTitle = 'OUT OF TIME';
      state.overSub = 'The mail was due before sundown. The valley keeps it.';
      return EVENT_OVER;
    }

    // Fuel: a warning at a quarter tank, silence at empty.
    if (plane.fuel < 25 && !state.warned) {
      state.warned = true;
      say('LOW FUEL — fly the rings, they carry fuel', '#ffb02e', 3);
      events |= EVENT_WARN;
    }
    if (plane.fuel <= 0 && plane.airborne && plane.speed < PLANE.minSpeed + 4) {
      state.overTitle = 'OUT OF FUEL';
      state.overSub = 'The engine quit over the valley. The courier glided down short.';
      return EVENT_OVER;
    }

    // The rings, in order. A ring flown past without going through is missed:
    // the course moves on, and the points for it are gone.
    const upcoming = nextRing(rings);
    if (upcoming && plane.z > upcoming.z + 40) {
      upcoming.missed = true;
      say('RING MISSED', '#ffb02e', 1.6);
    }
    const got = testRing(rings, plane);
    if (got) {
      state.score += RING.points;
      plane.fuel = Math.min(100, plane.fuel + PLANE.ringFuel);
      state.timeLeft += RING.timeBonus;
      say(`RING ${rings.filter((r) => r.got).length}/${rings.length}  +${RING.points}`, '#7df9ff');
      events |= EVENT_RING;
    }

    // The valley walls and the floor: hitting either ends the flight.
    const clearance = plane.y - groundY;
    if (plane.airborne && clearance <= 0.5) {
      // Touching down: a landing only counts on the destination runway.
      const dest = terrain.runways[1];
      const onRunway = plane.z > dest.z0 - 20 && plane.z < dest.z1 + 40 && Math.abs(plane.x - dest.x) < dest.w / 2 + 3;
      const aligned = Math.abs(plane.heading) < LANDING.align;
      const gentle = plane.vspeed > -LANDING.maxSink;
      const slow = plane.speed < LANDING.maxSpeed;
      if (onRunway && aligned && gentle && slow && nextRing(rings) === null) {
        state.landed = true;
        const smooth = plane.vspeed > -2 ? LANDING.smoothBonus : 0;
        const fuelBonus = Math.round(plane.fuel * 2);
        const timeBonus = Math.round(Math.max(0, state.timeLeft) * 2);
        state.score += LANDING.points + smooth + fuelBonus + timeBonus;
        state.overSub = `Rings ${rings.length}/${rings.length}  ·  Landing +${LANDING.points}${smooth ? `  ·  Smooth +${smooth}` : ''}  ·  Fuel +${fuelBonus}  ·  Time +${timeBonus}  ·  Total ${state.score}`;
        return EVENT_DONE;
      }
      state.overTitle = onRunway && !nextRing(rings) ? 'HARD LANDING' : 'TERRAIN';
      state.overSub = onRunway
        ? 'Too fast, too steep, or crooked over the threshold. The courier is down.'
        : 'The valley floor came up too fast. The courier is down.';
      return EVENT_OVER;
    }
    if (Math.abs(plane.x) > VALLEY.halfWidth + 220) {
      state.overTitle = 'INTO THE ROCK';
      state.overSub = 'The valley wall does not forgive a wide turn.';
      return EVENT_OVER;
    }

    // Past the far runway with rings still to fly: the course is missed.
    if (plane.z > VALLEY.length + 420) {
      state.overTitle = 'OVERSHOT';
      state.overSub = 'Past the airfield with rings still unflown. Turn back is not an option.';
      return EVENT_OVER;
    }
    return events;
  }

  return {
    state,
    reset,
    step,
    say,
    /** The next ring, for the beacon arrow. Reads the live state, so a reset restarts it. */
    nextRing() {
      return nextRing(state.rings);
    },
    /** How many rings are left, for the HUD. */
    ringsLeft() {
      return state.rings.filter((r) => !r.got && !r.missed).length;
    },
  };
}
