import nipplejs from 'nipplejs';
import { CONFIG } from './config.js';

export class Input {
  constructor({ canvas, mobileRoot, fireButton, reloadButton, swapButton, sprintButton }) {
    this.canvas = canvas;
    this.mobileRoot = mobileRoot;
    this.fireButton = fireButton;
    this.reloadButton = reloadButton;
    this.swapButton = swapButton;
    this.sprintButton = sprintButton;
    this.keys = new Set();
    this.move = { x: 0, y: 0 };
    this.lookDelta = { x: 0, y: 0 };
    this.fireHeld = false;
    this.reloadPressed = false;
    this.swapPressed = false;
    this.isMobile = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    this._cleanups = [];
  }

  mount() {
    const kd = (e) => {
      this.keys.add(e.code);
      if (e.code === 'KeyR') this.reloadPressed = true;
      if (e.code === 'KeyQ') this.swapPressed = true;
    };
    const ku = (e) => this.keys.delete(e.code);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    this._cleanups.push(() => window.removeEventListener('keydown', kd), () => window.removeEventListener('keyup', ku));

    if (this.isMobile) this.mountTouch();
    else this.mountDesktop();
  }

  mountDesktop() {
    const click = () => {
      if (document.pointerLockElement !== this.canvas) this.canvas.requestPointerLock?.();
      else this.fireHeld = true;
    };
    const up = () => { this.fireHeld = false; };
    const move = (e) => {
      if (document.pointerLockElement !== this.canvas) return;
      this.lookDelta.x += e.movementX * CONFIG.player.mouseSensitivity;
      this.lookDelta.y += e.movementY * CONFIG.player.mouseSensitivity;
    };
    this.canvas.addEventListener('mousedown', click);
    window.addEventListener('mouseup', up);
    window.addEventListener('mousemove', move);
    this._cleanups.push(
      () => this.canvas.removeEventListener('mousedown', click),
      () => window.removeEventListener('mouseup', up),
      () => window.removeEventListener('mousemove', move),
    );
  }

  mountTouch() {
    this.mobileRoot.classList.add('visible');
    const zone = this.mobileRoot.querySelector('[data-stick]');
    this.joystick = nipplejs.create({ zone, mode: 'static', position: { left: '70px', bottom: '72px' }, size: 112, color: 'white' });
    this.joystick.on('move', (_, data) => {
      const v = data.vector || { x: 0, y: 0 };
      this.move.x = v.x;
      this.move.y = v.y;
    });
    this.joystick.on('end', () => { this.move.x = 0; this.move.y = 0; });

    let lookPointer = null;
    let lastX = 0;
    let lastY = 0;
    const pd = (e) => {
      if (e.target.closest('button') || e.target.closest('[data-stick]')) return;
      lookPointer = e.pointerId;
      lastX = e.clientX;
      lastY = e.clientY;
      this.canvas.setPointerCapture?.(e.pointerId);
    };
    const pm = (e) => {
      if (e.pointerId !== lookPointer) return;
      this.lookDelta.x += (e.clientX - lastX) * CONFIG.player.touchSensitivity;
      this.lookDelta.y += (e.clientY - lastY) * CONFIG.player.touchSensitivity;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const pu = (e) => { if (e.pointerId === lookPointer) lookPointer = null; };
    this.canvas.addEventListener('pointerdown', pd);
    this.canvas.addEventListener('pointermove', pm);
    this.canvas.addEventListener('pointerup', pu);
    this.canvas.addEventListener('pointercancel', pu);

    const hold = (el, setter) => {
      const down = (e) => { e.preventDefault(); setter(true); };
      const up = (e) => { e.preventDefault(); setter(false); };
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('pointerleave', up);
      this._cleanups.push(() => {
        el.removeEventListener('pointerdown', down);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
        el.removeEventListener('pointerleave', up);
      });
    };
    hold(this.fireButton, (v) => { this.fireHeld = v; });
    hold(this.sprintButton, (v) => {
      if (v) this.keys.add('ShiftLeft'); else this.keys.delete('ShiftLeft');
    });
    const reload = (e) => { e.preventDefault(); this.reloadPressed = true; };
    const swap = (e) => { e.preventDefault(); this.swapPressed = true; };
    this.reloadButton.addEventListener('pointerdown', reload);
    this.swapButton.addEventListener('pointerdown', swap);
    this._cleanups.push(() => this.reloadButton.removeEventListener('pointerdown', reload), () => this.swapButton.removeEventListener('pointerdown', swap));
  }

  movement() {
    if (this.isMobile) return { x: this.move.x, y: this.move.y };
    return {
      x: (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0),
      y: (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0),
    };
  }

  sprinting() { return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'); }

  consumeLook() {
    const out = { ...this.lookDelta };
    this.lookDelta.x = 0;
    this.lookDelta.y = 0;
    return out;
  }

  consumeReload() { const v = this.reloadPressed; this.reloadPressed = false; return v; }
  consumeSwap() { const v = this.swapPressed; this.swapPressed = false; return v; }

  destroy() {
    this.joystick?.destroy();
    this._cleanups.forEach((fn) => fn());
    this._cleanups = [];
  }
}
