// Sky Courier: boot and the one loop. Input is read every frame, the world
// advances in fixed 1/60 s steps (several in a slow frame, none in a fast
// one), and the renderer paints what is there. The game moves between five
// screens: title, play, paused, done and over.
//
// ?shot=cover|ring|land|title (with &mission=0|1|2 and &seed=N) stages that
// scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { BEST_KEY, MISSIONS, STEP } from './config.js';
import { createAudio } from './audio.js';
import {
  ACTION_CONFIRM,
  ACTION_MISSION_1,
  ACTION_MISSION_2,
  ACTION_MISSION_3,
  ACTION_PAUSE,
  createInput,
} from './input.js';
import { createRenderer, SCREEN_DONE, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createWorld, EVENT_DONE, EVENT_OVER, EVENT_RING, EVENT_WARN } from './world.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const missionParam = Number.parseInt(params.get('mission') ?? '0', 10);
const missionIndex = Number.isInteger(missionParam) && missionParam >= 0 && missionParam < MISSIONS.length ? missionParam : 0;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off: the best score then lasts this visit only.
  }
}

function runShot(name, mission) {
  const world = createWorld(mission);
  const scene = stageShot(name, world);
  const s = world.state;
  // Debug hook: the staged state, for the screenshot tool to read back.
  window.__debugState = {
    planeZ: s.plane.z,
    planeX: s.plane.x,
    planeY: s.plane.y,
    heading: s.plane.heading,
    speed: s.plane.speed,
    score: s.score,
    ringsGot: s.rings.filter((r) => r.got).length,
    ringsMissed: s.rings.filter((r) => r.missed).length,
    nextRing: world.nextRing() ? { x: world.nextRing().x, y: world.nextRing().y, z: world.nextRing().z } : null,
    screen: scene.screen,
  };
  const snapshot = {
    plane: s.plane,
    terrain: s.terrain,
    rings: s.rings,
    clouds: s.clouds,
    ridgeRand: s.ridgeRand,
    ridgeRand2: s.ridgeRand2,
    dusk: s.dusk,
    score: s.score,
    ringsLeft: world.ringsLeft(),
    timeLeft: s.timeLeft,
    missionName: s.mission.name,
    missions: MISSIONS,
    missionIndex: mission,
    nextRing: world.nextRing(),
    message: s.message,
    messageColor: s.messageColor,
    overTitle: s.overTitle,
    overSub: s.overSub,
  };
  let painted = 0;
  function paint() {
    renderer.draw(snapshot, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let mission = missionIndex;
  let world = createWorld(mission);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let warnAt = 0;

  function announce(message) {
    status.textContent = message;
  }

  function snapshot() {
    const s = world.state;
    return {
      plane: s.plane,
      terrain: s.terrain,
      rings: s.rings,
      clouds: s.clouds,
      ridgeRand: s.ridgeRand,
      ridgeRand2: s.ridgeRand2,
      dusk: s.dusk,
      score: s.score,
      ringsLeft: world.ringsLeft(),
      timeLeft: s.timeLeft,
      missionName: s.mission.name,
      missions: MISSIONS,
      missionIndex: mission,
      nextRing: world.nextRing(),
      message: s.message,
      messageColor: s.messageColor,
      overTitle: s.overTitle,
      overSub: s.overSub,
    };
  }

  function startMission(index) {
    mission = index;
    world = createWorld(mission);
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    audio.click();
    announce(`${MISSIONS[mission].name}. Fly the rings, then land on runway 25.`);
  }

  function endRun(done) {
    const s = world.state;
    screen = done ? SCREEN_DONE : SCREEN_OVER;
    if (s.score > best) {
      best = s.score;
      saveBest(best);
    }
    if (done) audio.land();
    else audio.crash();
    announce(done ? `Delivered. Score ${s.score}. Best ${best}.` : `${s.overTitle}. Score ${s.score}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_MISSION_1) startMission(0);
      else if (actions & ACTION_MISSION_2) startMission(1);
      else if (actions & ACTION_MISSION_3) startMission(2);
      else if (actions & ACTION_CONFIRM) startMission(mission);
      return;
    }
    if (screen === SCREEN_OVER || screen === SCREEN_DONE) {
      if (actions & ACTION_MISSION_1) startMission(0);
      else if (actions & ACTION_MISSION_2) startMission(1);
      else if (actions & ACTION_MISSION_3) startMission(2);
      else if (actions & ACTION_CONFIRM) startMission(mission);
      return;
    }
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Flying.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step({ bank: 0, pitch: 0, throttle: 0 }, true);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const ctl = { bank: input.bank(), pitch: input.pitch(), throttle: input.throttle() };
    const events = world.step(ctl, false);
    const s = world.state;
    audio.update(s.plane.throttle, s.plane.speed, s.plane.airborne);
    if (events & EVENT_RING) audio.ring();
    if (events & EVENT_WARN) audio.warn();
    if (events & EVENT_DONE) endRun(true);
    else if (events & EVENT_OVER) endRun(false);
    if (s.plane.fuel < 25 && performance.now() - warnAt > 4000) {
      warnAt = performance.now();
      audio.warn();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(snapshot(), screen, best);
  }

  // Leaving the tab pauses a running game rather than letting it fly unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Sky Courier. Press Space or click to fly.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot, missionIndex);
else runGame();
