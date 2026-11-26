// The heads-up display: an attitude indicator, airspeed, altitude, a heading
// tape, throttle and fuel, the score and the mission message. Everything is
// drawn in screen space over the scene, in lit cyan on dark glass, so the
// instruments read as flown rather than drawn.

import { FIELD } from './config.js';

/** Knots from m/s, feet from metres: the units a pilot reads. */
const knots = (ms) => Math.round(ms * 1.94384);
const feet = (m) => Math.round(m * 3.28084);

function panel(ctx, x, y, w, h, palette) {
  ctx.fillStyle = palette.panel;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(125,249,255,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function label(ctx, text, x, y, palette, size = 11) {
  ctx.fillStyle = palette.muted;
  ctx.font = `600 ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y);
}

function value(ctx, text, x, y, palette, size = 22, color) {
  ctx.fillStyle = color || palette.hud;
  ctx.font = `700 ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y);
}

/** The attitude indicator: a ball that rolls with the bank and slides with pitch. */
function drawAttitude(ctx, cx, cy, r, bank, pitch, palette) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(bank);
  const dy = pitch * r * 2.2;
  ctx.fillStyle = '#3f8fd2';
  ctx.fillRect(-r, -r + dy - r, r * 2, r * 2);
  ctx.fillStyle = '#8a6a45';
  ctx.fillRect(-r, dy, r * 2, r * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r, dy);
  ctx.lineTo(r, dy);
  ctx.stroke();
  ctx.restore();
  // The fixed wings and the rim.
  ctx.strokeStyle = palette.hud;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx - r - 6, cy);
  ctx.lineTo(cx - 8, cy);
  ctx.moveTo(cx + 8, cy);
  ctx.lineTo(cx + r + 6, cy);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(125,249,255,0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
}

/** The heading tape: a strip of compass points scrolling with the heading. */
function drawHeading(ctx, cx, y, heading, palette) {
  const w = 260;
  const deg = ((heading * 180) / Math.PI % 360 + 360) % 360;
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - w / 2, y - 16, w, 32);
  ctx.clip();
  ctx.fillStyle = palette.panel;
  ctx.fillRect(cx - w / 2, y - 16, w, 32);
  const pxPerDeg = 2.2;
  for (let d = Math.floor((deg - 60) / 10) * 10; d <= deg + 60; d += 10) {
    const dd = ((d % 360) + 360) % 360;
    const x = cx + (((dd - deg + 540) % 360) - 180) * pxPerDeg;
    if (x < cx - w / 2 - 20 || x > cx + w / 2 + 20) continue;
    const cardinal = dd === 0 ? 'N' : dd === 90 ? 'E' : dd === 180 ? 'S' : dd === 270 ? 'W' : null;
    ctx.fillStyle = cardinal ? palette.hud : palette.muted;
    ctx.font = `700 ${cardinal ? 13 : 11}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(cardinal || String(dd).padStart(3, '0'), x, y + (cardinal ? 5 : 4));
    ctx.strokeStyle = 'rgba(125,249,255,0.5)';
    ctx.beginPath();
    ctx.moveTo(x, y - 14);
    ctx.lineTo(x, y - 8);
    ctx.stroke();
  }
  ctx.restore();
  // The lubber line.
  ctx.fillStyle = palette.hud;
  ctx.beginPath();
  ctx.moveTo(cx, y - 16);
  ctx.lineTo(cx - 5, y - 24);
  ctx.lineTo(cx + 5, y - 24);
  ctx.closePath();
  ctx.fill();
}

/**
 * Draw the whole HUD. `s` is the flight state the world hands over:
 * speed, altitude, heading, bank, pitch, throttle, fuel, score, rings left,
 * time left, the mission name and the message line.
 */
export function drawHUD(ctx, s, palette) {
  const W = FIELD.width;
  const H = FIELD.height;
  ctx.save();

  // Top-left: airspeed and altitude, the two numbers a pilot watches most.
  panel(ctx, 18, 16, 132, 74, palette);
  label(ctx, 'AIRSPEED', 30, 34, palette);
  value(ctx, `${knots(s.speed)}`, 30, 62, palette, 26, s.speed < 30 && s.airborne ? palette.hudBad : palette.hud);
  ctx.fillStyle = palette.muted;
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillText('KT', 96, 62);
  panel(ctx, 162, 16, 132, 74, palette);
  label(ctx, 'ALTITUDE', 174, 34, palette);
  value(ctx, `${feet(s.altitude)}`, 174, 62, palette, 26);
  ctx.fillStyle = palette.muted;
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillText('FT', 258, 62);

  // Top-centre: the heading tape.
  drawHeading(ctx, W / 2, 40, s.heading, palette);

  // Top-right: the mission, the score and the rings left.
  panel(ctx, W - 250, 16, 232, 74, palette);
  label(ctx, s.mission.toUpperCase(), W - 238, 34, palette);
  value(ctx, `${s.score}`, W - 238, 62, palette, 26);
  ctx.fillStyle = palette.muted;
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`RINGS ${s.ringsLeft}`, W - 30, 34);
  ctx.fillText(`TIME ${Math.max(0, Math.ceil(s.timeLeft))}s`, W - 30, 56);
  ctx.textAlign = 'left';

  // Bottom-left: the attitude indicator.
  drawAttitude(ctx, 78, H - 78, 46, s.bank, s.pitch, palette);
  label(ctx, 'ATTITUDE', 138, H - 60, palette);
  ctx.fillStyle = palette.text;
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillText(`BANK ${Math.round((s.bank * 180) / Math.PI)}°`, 138, H - 40);

  // Bottom-right: throttle and fuel bars.
  const bx = W - 250;
  const by = H - 96;
  panel(ctx, bx, by, 232, 78, palette);
  label(ctx, 'THROTTLE', bx + 12, by + 18, palette);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(bx + 12, by + 26, 208, 10);
  ctx.fillStyle = s.throttle > 0.85 ? palette.hudWarn : palette.hud;
  ctx.fillRect(bx + 12, by + 26, 208 * s.throttle, 10);
  label(ctx, 'FUEL', bx + 12, by + 56, palette);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(bx + 12, by + 62, 208, 10);
  const fuelColor = s.fuel < 20 ? palette.hudBad : s.fuel < 40 ? palette.hudWarn : palette.hud;
  ctx.fillStyle = fuelColor;
  ctx.fillRect(bx + 12, by + 62, 208 * (s.fuel / 100), 10);
  if (s.fuel < 20) {
    ctx.fillStyle = palette.hudBad;
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillText('LOW FUEL', bx + 150, by + 18);
  }

  // Centre message line, under the aircraft.
  if (s.message) {
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(8,18,32,0.45)';
    const tw = ctx.measureText(s.message).width;
    ctx.fillRect(W / 2 - tw / 2 - 16, H - 190, tw + 32, 34);
    ctx.fillStyle = s.messageColor || palette.text;
    ctx.fillText(s.message, W / 2, H - 166);
    ctx.textAlign = 'left';
  }

  // The vertical-speed needle, at the right edge.
  const vy = H / 2;
  ctx.fillStyle = palette.panel;
  ctx.fillRect(W - 30, vy - 70, 14, 140);
  ctx.fillStyle = s.vspeed >= 0 ? palette.hud : palette.hudWarn;
  const needle = Math.max(-60, Math.min(60, s.vspeed * 8));
  ctx.fillRect(W - 30, vy - needle - 3, 14, 6);
  ctx.fillStyle = palette.muted;
  ctx.font = '600 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('V/S', W - 23, vy - 78);
  ctx.textAlign = 'left';
  ctx.restore();
}
