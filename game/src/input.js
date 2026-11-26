// Keyboard and pointer input. Held keys give steering and throttle; one-shot
// presses (start, restart, pause, mission select) are queued as bit flags and
// taken once by the loop, so a press between two frames is never lost and
// never counted twice. The pointer steers by where it sits left or right of
// centre, and holding the button adds throttle.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MISSION_1 = 4;
export const ACTION_MISSION_2 = 8;
export const ACTION_MISSION_3 = 16;

const BANK_LEFT = new Set(['ArrowLeft', 'KeyA']);
const BANK_RIGHT = new Set(['ArrowRight', 'KeyD']);
const PITCH_UP = new Set(['ArrowUp', 'KeyW']);
const PITCH_DOWN = new Set(['ArrowDown', 'KeyS']);
const THROTTLE_UP = new Set(['ShiftLeft', 'ShiftRight']);
const THROTTLE_DOWN = new Set(['ControlLeft', 'ControlRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MISSION_1 = new Set(['Digit1', 'Numpad1']);
const MISSION_2 = new Set(['Digit2', 'Numpad2']);
const MISSION_3 = new Set(['Digit3', 'Numpad3']);

export function createInput(target) {
  let bankLeft = false;
  let bankRight = false;
  let pitchUp = false;
  let pitchDown = false;
  let throttleUp = false;
  let throttleDown = false;
  let pointerX = 0; // -1 (far left) .. 1 (far right), 0 when no pointer held
  let pointerDown = false;
  let actions = 0;

  window.addEventListener('keydown', (event) => {
    if (BANK_LEFT.has(event.code)) bankLeft = true;
    else if (BANK_RIGHT.has(event.code)) bankRight = true;
    else if (PITCH_UP.has(event.code)) pitchUp = true;
    else if (PITCH_DOWN.has(event.code)) pitchDown = true;
    else if (THROTTLE_UP.has(event.code)) throttleUp = true;
    else if (THROTTLE_DOWN.has(event.code)) throttleDown = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (MISSION_1.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MISSION_1;
    } else if (MISSION_2.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MISSION_2;
    } else if (MISSION_3.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MISSION_3;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (BANK_LEFT.has(event.code)) bankLeft = false;
    else if (BANK_RIGHT.has(event.code)) bankRight = false;
    else if (PITCH_UP.has(event.code)) pitchUp = false;
    else if (PITCH_DOWN.has(event.code)) pitchDown = false;
    else if (THROTTLE_UP.has(event.code)) throttleUp = false;
    else if (THROTTLE_DOWN.has(event.code)) throttleDown = false;
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    bankLeft = false;
    bankRight = false;
    pitchUp = false;
    pitchDown = false;
    throttleUp = false;
    throttleDown = false;
    pointerDown = false;
    pointerX = 0;
  });
  target.addEventListener('pointerdown', (event) => {
    pointerDown = true;
    const rect = target.getBoundingClientRect();
    pointerX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    actions |= ACTION_CONFIRM;
  });
  target.addEventListener('pointermove', (event) => {
    if (!pointerDown) return;
    const rect = target.getBoundingClientRect();
    pointerX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  });
  target.addEventListener('pointerup', () => {
    pointerDown = false;
    pointerX = 0;
  });
  target.addEventListener('pointercancel', () => {
    pointerDown = false;
    pointerX = 0;
  });

  return {
    /** -1 for full left bank, 1 for full right bank, 0 for level. */
    bank() {
      const keys = (bankRight ? 1 : 0) - (bankLeft ? 1 : 0);
      if (keys !== 0) return keys;
      return Math.max(-1, Math.min(1, pointerX * 1.4));
    },
    /** -1 for full nose down, 1 for full nose up, 0 for level. */
    pitch() {
      return (pitchUp ? 1 : 0) - (pitchDown ? 1 : 0);
    },
    /** -1 to throttle down, 1 to throttle up, 0 to hold. */
    throttle() {
      if (pointerDown) return 1;
      return (throttleUp ? 1 : 0) - (throttleDown ? 1 : 0);
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
