// Sound, all of it synthesised in code with WebAudio: no audio files, no
// network, nothing to load. The engine is a low oscillator whose pitch follows
// the throttle, the wind is filtered noise that grows with speed, and the
// events are short blips and chimes.

export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let windSource = null;
  let windGain = null;
  let windFilter = null;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      // Engine: a sawtooth through a low-pass, quiet enough to sit under play.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 52;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      // Wind: looped noise through a band-pass that opens with speed.
      const len = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      windSource = ctx.createBufferSource();
      windSource.buffer = buffer;
      windSource.loop = true;
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 500;
      windFilter.Q.value = 0.6;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      windSource.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(ctx.destination);
      windSource.start();
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function blip(freq, dur, type, vol, when = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  return {
    /** Call on the first user gesture; browsers need one before sound plays. */
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume();
    },
    /** Continuous engine and wind, from the throttle and the speed. */
    update(throttle, speed, airborne) {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      engineGain.gain.setTargetAtTime(airborne ? 0.02 + throttle * 0.05 : throttle * 0.02, t, 0.1);
      engineOsc.frequency.setTargetAtTime(48 + throttle * 55, t, 0.1);
      windGain.gain.setTargetAtTime(airborne ? Math.min(0.12, speed * 0.0012) : 0, t, 0.15);
      windFilter.frequency.setTargetAtTime(400 + speed * 9, t, 0.15);
    },
    /** The ring chime: two bright notes, a fifth apart. */
    ring() {
      blip(880, 0.35, 'sine', 0.16);
      blip(1318, 0.5, 'sine', 0.12, 0.07);
    },
    /** The low-fuel warning: a short double beep. */
    warn() {
      blip(620, 0.12, 'square', 0.07);
      blip(620, 0.12, 'square', 0.07, 0.16);
    },
    /** A good landing: a rising three-note figure. */
    land() {
      blip(523, 0.25, 'triangle', 0.16);
      blip(659, 0.25, 'triangle', 0.16, 0.12);
      blip(784, 0.5, 'triangle', 0.18, 0.24);
    },
    /** A crash: a low thud with noise. */
    crash() {
      blip(70, 0.5, 'sine', 0.3);
      blip(46, 0.7, 'triangle', 0.22, 0.05);
    },
    /** A click for the title screen. */
    click() {
      blip(740, 0.08, 'square', 0.06);
    },
    setMuted(value) {
      muted = value;
      if (ctx) {
        if (engineGain) engineGain.gain.value = 0;
        if (windGain) windGain.gain.value = 0;
      }
    },
  };
}
