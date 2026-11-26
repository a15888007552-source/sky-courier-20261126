// The courier plane: its flight state, the physics step, and the drawing of
// the aircraft itself. The plane is a single-engine prop courier with a
// high wing, fixed gear and a red cheatline; it is drawn in screen space at
// the centre of the chase view, banking and pitching with its attitude.

import { PLANE, STEP } from './config.js';

/** Fresh flight state on the departure runway, engine idling. */
export function createAircraft() {
  return {
    x: 0, // lateral position, metres from the centreline (+ right)
    y: 2, // altitude above the valley floor, metres
    z: 0, // distance down the course, metres
    heading: 0, // rad, 0 is straight down the valley (+z)
    speed: 0, // m/s along the heading
    throttle: 0, // 0..1
    bank: 0, // rad of roll, + to the right
    pitch: 0, // rad, + nose up
    vspeed: 0, // vertical speed, m/s
    fuel: 100, // percent
    gearDown: true,
    propAngle: 0,
    airborne: false,
  };
}

/**
 * Advance the flight model one fixed step. `ctl` carries bank (-1..1), pitch
 * (-1..1) and throttle (-1..1) from the input; `groundY` is the terrain
 * height under the plane. Returns nothing; the state is updated in place.
 */
export function stepAircraft(p, ctl, groundY) {
  // Throttle: Shift feeds it, Ctrl pulls it back; the engine drinks fuel.
  p.throttle = Math.max(0, Math.min(1, p.throttle + ctl.throttle * (ctl.throttle > 0 ? PLANE.throttleUp : PLANE.throttleDown) * STEP));
  const burn = PLANE.fuelIdle + (PLANE.fuelBurn - PLANE.fuelIdle) * p.throttle;
  p.fuel = Math.max(0, p.fuel - burn * STEP);
  const engineOut = p.fuel <= 0;

  // Bank and pitch ease toward what the pilot asks for.
  const wantBank = ctl.bank * PLANE.maxBank;
  const wantPitch = ctl.pitch * PLANE.maxPitch;
  p.bank += (wantBank - p.bank) * Math.min(1, 6 * STEP);
  p.pitch += (wantPitch - p.pitch) * Math.min(1, 5 * STEP);

  // Speed: the engine pushes toward its throttle speed, drag pulls back, and
  // climbing trades speed for height while descending gives it back.
  const targetSpeed = engineOut ? 0 : PLANE.minSpeed + (PLANE.maxSpeed - PLANE.minSpeed) * p.throttle;
  const climbCost = p.pitch * 26;
  p.speed += ((targetSpeed - climbCost) - p.speed) * Math.min(1, 0.9 * STEP);
  if (p.speed < 0) p.speed = 0;

  // Heading follows the bank; the turn tightens with speed. A right bank
  // (positive) turns the nose right, toward +x, so the heading grows.
  p.heading += p.bank * PLANE.turnRate * STEP * (0.5 + p.speed / PLANE.cruiseSpeed);

  // Vertical speed: pitch and throttle lift it, gravity and a slow wing sink it.
  const lift = engineOut ? -PLANE.sinkRate : p.pitch * PLANE.climbRate + (p.throttle - 0.45) * 7;
  p.vspeed += (lift - p.vspeed) * Math.min(1, 2.2 * STEP);
  if (!p.airborne && p.speed < PLANE.minSpeed) p.vspeed = 0;

  // Move along the heading, and sideways with it.
  const dx = Math.sin(p.heading) * p.speed * STEP;
  const dz = Math.cos(p.heading) * p.speed * STEP;
  p.x += dx;
  p.z += dz;
  p.y += p.vspeed * STEP;

  // The ground is a hard floor: touching it slow and level is a landing,
  // touching it any other way is a crash (the world decides which).
  const floorY = groundY + 2;
  if (p.y < floorY) {
    p.y = floorY;
    if (p.vspeed < 0) p.vspeed = 0;
  }
  if (!p.airborne && p.speed >= PLANE.minSpeed && p.y > floorY + 0.5) p.airborne = true;
  if (p.airborne && p.y <= floorY + 0.01 && Math.abs(p.vspeed) < 0.5) p.airborne = false;

  p.propAngle += (2 + p.throttle * 26) * STEP * Math.PI;
}

/**
 * Draw the aircraft in screen space, centred at (cx, cy), at `scale`
 * (1 is the chase-view size). `bank` rolls it, `pitch` tips it, `throttle`
 * spins the propeller, and `dusk` warms the palette. `gear` shows the wheels.
 */
export function drawAircraft(ctx, cx, cy, scale, bank, pitch, throttle, gear, dusk, palette) {
  ctx.save();
  ctx.translate(cx, cy + pitch * 26 * scale);
  ctx.rotate(bank);
  ctx.scale(scale, scale);
  const body = palette.planeBody;
  const trim = palette.planeTrim;
  const glass = palette.planeGlass;

  // The propeller: a blurred disc with two blades, spinning with the throttle.
  ctx.save();
  ctx.translate(0, -8);
  ctx.rotate(Math.sin(performance.now() / 90) * 0 + (throttle > 0.02 ? performance.now() / 60 : 0));
  ctx.fillStyle = 'rgba(200,210,220,0.28)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 6, 46, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(40,48,58,0.75)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 2.5, 44, 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, 0, 2.5, 44, -0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Spinner cone.
  ctx.fillStyle = trim;
  ctx.beginPath();
  ctx.arc(0, -8, 5, 0, Math.PI * 2);
  ctx.fill();

  // Fuselage: a rounded courier body, nose at the top of the frame.
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(0, -52);
  ctx.quadraticCurveTo(13, -40, 14, -14);
  ctx.quadraticCurveTo(15, 12, 9, 30);
  ctx.quadraticCurveTo(0, 40, -9, 30);
  ctx.quadraticCurveTo(-15, 12, -14, -14);
  ctx.quadraticCurveTo(-13, -40, 0, -52);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(30,45,60,0.35)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // Red cheatline along the fuselage.
  ctx.fillStyle = trim;
  ctx.fillRect(-14, 2, 28, 4);
  // Canopy glass.
  ctx.fillStyle = glass;
  ctx.beginPath();
  ctx.moveTo(-8, -34);
  ctx.quadraticCurveTo(0, -42, 8, -34);
  ctx.quadraticCurveTo(7, -22, 0, -20);
  ctx.quadraticCurveTo(-7, -22, -8, -34);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.moveTo(-5, -36);
  ctx.quadraticCurveTo(0, -40, 4, -35);
  ctx.quadraticCurveTo(0, -37, -5, -36);
  ctx.closePath();
  ctx.fill();

  // High wing, spanning the frame, with red tips.
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-118, -16);
  ctx.quadraticCurveTo(-60, -26, 0, -24);
  ctx.quadraticCurveTo(60, -26, 118, -16);
  ctx.lineTo(112, -6);
  ctx.quadraticCurveTo(60, -14, 0, -13);
  ctx.quadraticCurveTo(-60, -14, -112, -6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(30,45,60,0.3)';
  ctx.stroke();
  ctx.fillStyle = trim;
  ctx.fillRect(-118, -16, 10, 8);
  ctx.fillRect(108, -16, 10, 8);
  // Navigation lights: red left, green right, white tail.
  ctx.fillStyle = '#ff4b3e';
  ctx.beginPath();
  ctx.arc(-118, -12, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#37e07a';
  ctx.beginPath();
  ctx.arc(118, -12, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 38, 2.6, 0, Math.PI * 2);
  ctx.fill();

  // Tail: horizontal stabiliser and fin.
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-42, 26);
  ctx.lineTo(42, 26);
  ctx.lineTo(34, 36);
  ctx.lineTo(-34, 36);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(30,45,60,0.3)';
  ctx.stroke();
  ctx.fillStyle = trim;
  ctx.beginPath();
  ctx.moveTo(-7, 22);
  ctx.lineTo(0, 2);
  ctx.lineTo(7, 22);
  ctx.closePath();
  ctx.fill();

  // Fixed gear, when down.
  if (gear) {
    ctx.strokeStyle = '#2a3138';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-10, 26);
    ctx.lineTo(-16, 44);
    ctx.moveTo(10, 26);
    ctx.lineTo(16, 44);
    ctx.stroke();
    ctx.fillStyle = '#1c2126';
    ctx.beginPath();
    ctx.arc(-16, 46, 5, 0, Math.PI * 2);
    ctx.arc(16, 46, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
