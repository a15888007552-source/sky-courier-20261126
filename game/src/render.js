// The renderer: a chase view over the valley. The sky, the sun and the
// clouds, the layered mountains, the ground as a perspective mesh of quads
// (fields, the river, the road and the runways are coloured into it), the
// trees and houses as projected sprites, the glowing rings, the aircraft in
// the centre and the HUD on top. Everything is drawn from the world state,
// so a staged screenshot is a real frame of the game.

import { CAMERA, FIELD, PALETTE, VALLEY } from './config.js';
import { drawAircraft } from './aircraft.js';
import { drawHUD } from './hud.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_DONE = 'done';

/** The far plane of the ground mesh and the sprite cull, in metres. */
const VIEW_DIST = 1400;
const NEAR = 4;

/** Ground mesh steps: coarse far away, fine up close. */
const Z_STEPS = [14, 22, 32, 46, 66, 94, 132, 186, 260, 360, 500];
const X_STEP = 44;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let W = FIELD.width;
  let H = FIELD.height;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    const scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    ctx.setTransform(scale, 0, 0, scale, (canvas.width - FIELD.width * scale) / 2, (canvas.height - FIELD.height * scale) / 2);
    W = FIELD.width;
    H = FIELD.height;
  }
  resize();
  window.addEventListener('resize', resize);

  // A jagged ridge line, seeded, for the distant mountain layers.
  function ridge(rand, baseY, amp, points) {
    const xs = [];
    const ys = [];
    for (let i = 0; i <= points; i += 1) {
      xs.push((i / points) * (W + 200) - 100);
      ys.push(baseY - rand() * amp - (i % 3 === 0 ? amp * 0.4 : 0));
    }
    return { xs, ys };
  }

  function drawSky(state, palette) {
    const horizonY = state.horizonY;
    const sky = ctx.createLinearGradient(0, 0, 0, horizonY + 40);
    sky.addColorStop(0, palette.skyTop);
    sky.addColorStop(0.55, palette.skyMid);
    sky.addColorStop(1, palette.skyHorizon);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, horizonY + 40);
    // The sun, low and warm.
    const sunX = W * 0.78;
    const sunY = horizonY - 150;
    const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 130);
    glow.addColorStop(0, palette.sun);
    glow.addColorStop(0.25, 'rgba(255,240,190,0.55)');
    glow.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 140, sunY - 140, 280, 280);
    ctx.fillStyle = palette.sun;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
    ctx.fill();
    // Distant mountain layers, parallaxed by the heading.
    const shift = -state.plane.heading * 320;
    const far = ridge(state.ridgeRand, horizonY - 8, 90, 14);
    ctx.fillStyle = palette.farMountain;
    ctx.beginPath();
    ctx.moveTo(-100, horizonY + 2);
    for (let i = 0; i < far.xs.length; i += 1) {
      ctx.lineTo(far.xs[i] + ((shift * 0.4) % 220), far.ys[i]);
    }
    ctx.lineTo(W + 100, horizonY + 2);
    ctx.closePath();
    ctx.fill();
    const near = ridge(state.ridgeRand2, horizonY - 2, 60, 10);
    ctx.fillStyle = palette.nearMountain;
    ctx.beginPath();
    ctx.moveTo(-100, horizonY + 2);
    for (let i = 0; i < near.xs.length; i += 1) {
      ctx.lineTo(near.xs[i] + ((shift * 0.7) % 220), near.ys[i]);
    }
    ctx.lineTo(W + 100, horizonY + 2);
    ctx.closePath();
    ctx.fill();
  }

  function drawClouds(state, palette) {
    ctx.save();
    for (const c of state.clouds) {
      const p = state.project(c.x, c.y, c.z);
      if (!p) continue;
      const r = c.r * p.scale;
      if (r < 2) continue;
      const g = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, r);
      g.addColorStop(0, palette.cloud);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(p.sx, p.sy, r * 1.8, r * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** The ground mesh: quads coloured by what the terrain holds there. */
  function drawGround(state, palette) {
    const terrain = state.terrain;
    const camZ = state.plane.z - CAMERA.behind;
    // Build the z edges from near to far.
    const edges = [camZ + 8];
    for (const step of Z_STEPS) edges.push(edges[edges.length - 1] + step);
    // Draw far to near so near quads cover far ones.
    for (let zi = edges.length - 2; zi >= 0; zi -= 1) {
      const z0 = edges[zi];
      const z1 = edges[zi + 1];
      const zm = (z0 + z1) / 2;
      for (let x = -560; x < 560; x += X_STEP) {
        const x0 = x;
        const x1 = x + X_STEP;
        const xm = (x0 + x1) / 2;
        const p00 = state.project(x0, terrain.heightAt(x0, z0), z0);
        const p10 = state.project(x1, terrain.heightAt(x1, z0), z0);
        const p11 = state.project(x1, terrain.heightAt(x1, z1), z1);
        const p01 = state.project(x0, terrain.heightAt(x0, z1), z1);
        if (!p00 || !p10 || !p11 || !p01) continue;
        // Skip quads entirely off screen.
        const minX = Math.min(p00.sx, p10.sx, p11.sx, p01.sx);
        const maxX = Math.max(p00.sx, p10.sx, p11.sx, p01.sx);
        const minY = Math.min(p00.sy, p10.sy, p11.sy, p01.sy);
        const maxY = Math.max(p00.sy, p10.sy, p11.sy, p01.sy);
        if (maxX < -40 || minX > W + 40 || maxY < state.horizonY - 4 || minY > H + 40) continue;
        // Colour by what is there: river, road, runway, fields, or plain ground.
        let color = (Math.floor(zm / 130) + Math.floor(xm / X_STEP)) % 2 === 0 ? palette.groundFar : palette.groundNear;
        const riverX = terrain.riverX(zm);
        if (Math.abs(xm - riverX) < 13) color = palette.river;
        else {
          const roadX = terrain.roadX(zm);
          if (Math.abs(xm - roadX) < 6) color = palette.road;
          else {
            for (const f of terrain.fields) {
              if (xm > f.x - f.w / 2 && xm < f.x + f.w / 2 && zm > f.z - f.d / 2 && zm < f.z + f.d / 2) {
                color = f.variant === 0 ? palette.fieldA : f.variant === 1 ? palette.fieldB : palette.fieldC;
                break;
              }
            }
          }
        }
        // The runways are drawn on top later; keep their ground dark here.
        for (const r of terrain.runways) {
          if (zm > r.z0 && zm < r.z1 && Math.abs(xm - r.x) < r.w / 2 + 4) color = palette.runway;
        }
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(p00.sx, p00.sy);
        ctx.lineTo(p10.sx, p10.sy);
        ctx.lineTo(p11.sx, p11.sy);
        ctx.lineTo(p01.sx, p01.sy);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  /** The runway strips with their centreline and threshold bars. */
  function drawRunways(state, palette) {
    for (const r of state.terrain.runways) {
      const a = state.project(r.x - r.w / 2, 0.4, r.z0);
      const b = state.project(r.x + r.w / 2, 0.4, r.z0);
      const c = state.project(r.x + r.w / 2, 0.4, r.z1);
      const d = state.project(r.x - r.w / 2, 0.4, r.z1);
      if (!a || !b || !c || !d) continue;
      ctx.fillStyle = palette.runway;
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy);
      ctx.lineTo(b.sx, b.sy);
      ctx.lineTo(c.sx, c.sy);
      ctx.lineTo(d.sx, d.sy);
      ctx.closePath();
      ctx.fill();
      // Centreline dashes and the threshold bars.
      ctx.fillStyle = palette.runwayMark;
      const dashes = 12;
      for (let i = 0; i < dashes; i += 1) {
        const t0 = i / dashes;
        const t1 = (i + 0.45) / dashes;
        const zA = r.z0 + (r.z1 - r.z0) * t0;
        const zB = r.z0 + (r.z1 - r.z0) * t1;
        const pA = state.project(r.x - 0.8, 0.5, zA);
        const pB = state.project(r.x + 0.8, 0.5, zA);
        const pC = state.project(r.x + 0.8, 0.5, zB);
        const pD = state.project(r.x - 0.8, 0.5, zB);
        if (!pA || !pB || !pC || !pD) continue;
        ctx.beginPath();
        ctx.moveTo(pA.sx, pA.sy);
        ctx.lineTo(pB.sx, pB.sy);
        ctx.lineTo(pC.sx, pC.sy);
        ctx.lineTo(pD.sx, pD.sy);
        ctx.closePath();
        ctx.fill();
      }
      // The runway number, near the threshold.
      const num = state.project(r.x, 0.6, r.z0 + 14);
      if (num && num.scale > 0.4) {
        ctx.fillStyle = palette.runwayMark;
        ctx.font = `700 ${Math.max(10, Math.round(26 * num.scale))}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(r.name, num.sx, num.sy);
        ctx.textAlign = 'left';
      }
    }
  }

  function drawSprites(state, palette) {
    const drawList = [];
    for (const t of state.terrain.trees) {
      const y = state.terrain.heightAt(t.x, t.z);
      const p = state.project(t.x, y, t.z);
      if (!p || p.scale < 0.06) continue;
      drawList.push({ ...p, kind: 'tree', s: t.s });
    }
    for (const h of state.terrain.houses) {
      const y = state.terrain.heightAt(h.x, h.z);
      const p = state.project(h.x, y, h.z);
      if (!p || p.scale < 0.06) continue;
      drawList.push({ ...p, kind: 'house', s: h.s });
    }
    drawList.sort((a, b) => b.depth - a.depth);
    for (const s of drawList) {
      const size = s.scale * 14 * s.s;
      if (s.kind === 'tree') {
        ctx.fillStyle = '#2f5d33';
        ctx.beginPath();
        ctx.moveTo(s.sx, s.sy - size);
        ctx.lineTo(s.sx - size * 0.5, s.sy);
        ctx.lineTo(s.sx + size * 0.5, s.sy);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#24492a';
        ctx.beginPath();
        ctx.moveTo(s.sx, s.sy - size * 1.5);
        ctx.lineTo(s.sx - size * 0.38, s.sy - size * 0.4);
        ctx.lineTo(s.sx + size * 0.38, s.sy - size * 0.4);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = '#e8e0cc';
        ctx.fillRect(s.sx - size * 0.5, s.sy - size * 0.7, size, size * 0.7);
        ctx.fillStyle = '#a34a3a';
        ctx.beginPath();
        ctx.moveTo(s.sx - size * 0.6, s.sy - size * 0.7);
        ctx.lineTo(s.sx, s.sy - size * 1.15);
        ctx.lineTo(s.sx + size * 0.6, s.sy - size * 0.7);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  function drawRings(state, palette) {
    const list = [];
    for (const ring of state.rings) {
      const p = state.project(ring.x, ring.y, ring.z);
      if (!p) continue;
      list.push({ ring, ...p });
    }
    list.sort((a, b) => b.depth - a.depth);
    for (const item of list) {
      const r = item.ring;
      const radius = r.radius * item.scale;
      if (radius < 1.5) continue;
      const pulse = 1 + 0.08 * Math.sin(performance.now() / 300 + r.z);
      const rr = radius * pulse;
      ctx.save();
      ctx.globalAlpha = r.got ? 0.25 : 1;
      ctx.shadowColor = palette.ring;
      ctx.shadowBlur = r.got ? 0 : Math.min(28, rr * 0.5);
      ctx.strokeStyle = r.got ? '#9aa5ad' : palette.ring;
      ctx.lineWidth = Math.max(2, rr * 0.1);
      ctx.beginPath();
      ctx.arc(item.sx, item.sy, rr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = palette.ringCore;
      ctx.lineWidth = Math.max(1, rr * 0.035);
      ctx.beginPath();
      ctx.arc(item.sx, item.sy, rr * 0.86, 0, Math.PI * 2);
      ctx.stroke();
      if (!r.got && state.nextRing === r) {
        // The chevron that points the pilot at the next ring.
        ctx.fillStyle = palette.ringCore;
        ctx.font = `700 ${Math.max(11, Math.round(rr * 0.22))}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('NEXT', item.sx, item.sy - rr - 8);
      }
      ctx.restore();
    }
  }

  /** A beacon arrow at the top of the frame, pointing at the next ring. */
  function drawNextArrow(state, palette) {
    const ring = state.nextRing;
    if (!ring) return;
    const p = state.project(ring.x, ring.y, ring.z);
    if (!p) return;
    const dx = p.sx - W / 2;
    const dy = p.sy - 90;
    const angle = Math.atan2(dy, dx);
    const dist = Math.hypot(dx, dy);
    const ax = W / 2 + Math.cos(angle) * Math.min(dist, 180);
    const ay = 90 + Math.sin(angle) * Math.min(dist, 180) * 0.4;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(angle);
    ctx.fillStyle = palette.ring;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-8, -9);
    ctx.lineTo(-8, 9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = palette.text;
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(ring.z - state.plane.z)}m`, ax, ay + 26);
    ctx.textAlign = 'left';
  }

  function drawTitle(state, palette) {
    ctx.fillStyle = 'rgba(6,14,26,0.42)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = palette.text;
    ctx.font = '800 64px system-ui, sans-serif';
    ctx.fillText('SKY COURIER', W / 2, 190);
    ctx.font = '600 22px system-ui, sans-serif';
    ctx.fillStyle = palette.ring;
    ctx.fillText('— Alpine Run —', W / 2, 226);
    ctx.fillStyle = palette.text;
    ctx.font = '400 17px system-ui, sans-serif';
    ctx.fillText('Fly the rings, mind the fuel, and put her down on the far runway.', W / 2, 268);
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillStyle = palette.muted;
    ctx.fillText('← → bank   ↑ ↓ pitch   SHIFT throttle up   CTRL throttle down   P pause', W / 2, 310);
    ctx.fillText('Mouse: drag to steer, hold for throttle.  1 / 2 / 3 chooses a mission.', W / 2, 336);
    state.missions.forEach((m, i) => {
      const y = 392 + i * 68;
      const sel = i === state.missionIndex;
      ctx.fillStyle = sel ? 'rgba(125,249,255,0.16)' : 'rgba(8,18,32,0.4)';
      ctx.beginPath();
      ctx.roundRect(W / 2 - 300, y - 28, 600, 56, 10);
      ctx.fill();
      ctx.strokeStyle = sel ? palette.hud : 'rgba(255,255,255,0.18)';
      ctx.lineWidth = sel ? 2 : 1;
      ctx.stroke();
      ctx.fillStyle = sel ? palette.hud : palette.text;
      ctx.font = '700 18px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${i + 1}. ${m.name}`, W / 2 - 282, y - 2);
      ctx.fillStyle = palette.muted;
      ctx.font = '400 14px system-ui, sans-serif';
      ctx.fillText(m.blurb, W / 2 - 282, y + 18);
      ctx.textAlign = 'center';
    });
    ctx.fillStyle = palette.muted;
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillText('Press SPACE or click to fly the selected mission.', W / 2, 596);
    if (state.best > 0) {
      ctx.fillStyle = palette.ring;
      ctx.font = '700 16px system-ui, sans-serif';
      ctx.fillText(`Best score: ${state.best}`, W / 2, 626);
    }
    ctx.textAlign = 'left';
  }

  function drawCentre(state, palette, title, sub, color) {
    ctx.fillStyle = 'rgba(6,14,26,0.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = color || palette.text;
    ctx.font = '800 54px system-ui, sans-serif';
    ctx.fillText(title, W / 2, 300);
    ctx.fillStyle = palette.text;
    ctx.font = '400 20px system-ui, sans-serif';
    ctx.fillText(sub, W / 2, 344);
    ctx.fillStyle = palette.muted;
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.fillText('Press SPACE to fly again, or 1 / 2 / 3 for another mission.', W / 2, 396);
    ctx.textAlign = 'left';
  }

  return {
    /** Draw one frame. `state` is the world's snapshot; `screen` is one of the SCREEN_* names. */
    draw(state, screen, best) {
      const palette = state.dusk ? PALETTE.dusk : PALETTE.day;
      const plane = state.plane;
      // The horizon rides with the pitch; the world rolls a little with the bank.
      const horizonY = Math.max(120, Math.min(520, CAMERA.horizon - plane.pitch * 480));
      const world = { ...state, horizonY, palette };

      // The projection, in the plane's frame: forward is down the course.
      world.project = (x, y, z) => {
        const camX = plane.x;
        const camY = plane.y + CAMERA.above;
        const camZ = plane.z - CAMERA.behind;
        const rx = x - camX;
        const ry = y - camY;
        const rz = z - camZ;
        const sin = Math.sin(plane.heading);
        const cos = Math.cos(plane.heading);
        const forward = rx * sin + rz * cos;
        if (forward < NEAR || forward > VIEW_DIST) return null;
        const right = rx * cos - rz * sin;
        const scale = CAMERA.focal / forward;
        const sx = W / 2 + right * scale;
        const sy = horizonY - ry * scale;
        if (sx < -400 || sx > W + 400 || sy < -200 || sy > H + 300) return null;
        return { sx, sy, scale, depth: forward };
      };

      ctx.save();
      // A touch of world roll with the bank, for feel.
      ctx.translate(W / 2, H / 2);
      ctx.rotate(plane.bank * 0.28);
      ctx.translate(-W / 2, -H / 2);
      drawSky(world, palette);
      drawClouds(world, palette);
      drawGround(world, palette);
      drawRunways(world, palette);
      drawSprites(world, palette);
      drawRings(world, palette);
      ctx.restore();

      // The aircraft, centred, banked and pitched with its attitude.
      const planeY = H * 0.62;
      drawAircraft(ctx, W / 2, planeY, 1, plane.bank, plane.pitch, plane.throttle, plane.gearDown, state.dusk, palette);

      if (screen === SCREEN_TITLE) {
        drawTitle({ ...world, missions: state.missions, missionIndex: state.missionIndex, best }, palette);
        return;
      }
      if (screen === SCREEN_PAUSED) {
        drawCentre(world, palette, 'PAUSED', 'Take a breath. The valley will wait.', palette.hud);
        return;
      }
      if (screen === SCREEN_OVER) {
        drawCentre(world, palette, state.overTitle || 'CRASHED', state.overSub || 'The courier is down. The valley keeps the mail.', palette.hudBad);
        return;
      }
      if (screen === SCREEN_DONE) {
        drawCentre(world, palette, 'DELIVERED', state.overSub || 'Wheels down, mail delivered, courier home.', palette.hud);
        return;
      }
      // Playing: the beacon arrow and the HUD.
      drawNextArrow(world, palette);
      drawHUD(ctx, {
        speed: plane.speed,
        altitude: Math.max(0, plane.y),
        heading: plane.heading,
        bank: plane.bank,
        pitch: plane.pitch,
        throttle: plane.throttle,
        fuel: plane.fuel,
        score: state.score,
        ringsLeft: state.ringsLeft,
        timeLeft: state.timeLeft,
        mission: state.missionName,
        airborne: plane.airborne,
        vspeed: plane.vspeed,
        message: state.message,
        messageColor: state.messageColor,
      }, palette);
    },
  };
}
