/**
 * Input — teclado y ratón con un mapa de acciones reasignable.
 *
 * El resto del juego consulta acciones ('jump', 'sprint'…) y nunca teclas
 * concretas, de modo que los controles puedan modificarse desde los ajustes.
 */

export const DEFAULT_BINDINGS = Object.freeze({
  moveForward: ['KeyW', 'ArrowUp'],
  moveBack: ['KeyS', 'ArrowDown'],
  moveLeft: ['KeyA', 'ArrowLeft'],
  moveRight: ['KeyD', 'ArrowRight'],
  jump: ['Space'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  // Ctrl según el documento de diseño; Alt como alternativa porque algunos
  // navegadores reservan combinaciones con Ctrl (Ctrl+W cierra la pestaña).
  dodge: ['ControlLeft', 'ControlRight', 'AltLeft'],
  crouch: ['KeyC'], // agacharse / ponerse a cubierto (alterna)
  interact: ['KeyE'],
  melee: ['KeyF'],
  special: ['KeyQ'], // Energía: dash energético
  charged: ['KeyR'], // Energía: descarga concentrada (mantener)
  wave: ['KeyG'], // Energía: onda expansiva · Gravedad: empujar
  grenade: ['KeyX', 'Mouse1'], // Gravedad: granada de gravedad
  switchMark: ['KeyV'], // cambiar de marca copiada
  powerMenu: ['Tab'],
  debug: ['F3'],
  debugMenu: ['F2', 'Backquote'],
  attack: ['Mouse0'],
  aim: ['Mouse2'],
});

/** Teclas cuyo comportamiento por defecto en el navegador hay que impedir. */
const PREVENT = new Set(['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F3', 'F2', 'KeyC', 'ControlLeft', 'ControlRight', 'AltLeft']);

export class Input {
  constructor(target, bindings = null) {
    this.target = target;
    this.bindings = { ...DEFAULT_BINDINGS, ...(bindings || {}) };
    this._down = new Set();
    this._pressed = new Set();
    this._released = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.pointerLocked = false;
    this.enabled = true;

    this._onKeyDown = (e) => {
      if (PREVENT.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      if (!this._down.has(e.code)) this._pressed.add(e.code);
      this._down.add(e.code);
    };
    this._onKeyUp = (e) => {
      this._down.delete(e.code);
      this._released.add(e.code);
    };
    this._onMouseDown = (e) => {
      const code = `Mouse${e.button}`;
      if (e.button === 1) e.preventDefault(); // clic central: sin desplazamiento automático
      if (!this._down.has(code)) this._pressed.add(code);
      this._down.add(code);
    };
    this._onMouseUp = (e) => {
      const code = `Mouse${e.button}`;
      this._down.delete(code);
      this._released.add(code);
    };
    this._onMouseMove = (e) => {
      if (!this.pointerLocked) return;
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
    };
    this._onBlur = () => this._down.clear();
    this._onLockChange = () => {
      this.pointerLocked = document.pointerLockElement === this.target;
    };
    this._onContextMenu = (e) => e.preventDefault();

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('blur', this._onBlur);
    document.addEventListener('pointerlockchange', this._onLockChange);
    target.addEventListener('contextmenu', this._onContextMenu);
  }

  setBindings(bindings) {
    this.bindings = { ...DEFAULT_BINDINGS, ...(bindings || {}) };
  }

  isDown(action) {
    if (!this.enabled) return false;
    return (this.bindings[action] || []).some((c) => this._down.has(c));
  }

  wasPressed(action) {
    if (!this.enabled) return false;
    return (this.bindings[action] || []).some((c) => this._pressed.has(c));
  }

  wasReleased(action) {
    return (this.bindings[action] || []).some((c) => this._released.has(c));
  }

  /** Llamar al final de cada frame. */
  endFrame() {
    this._pressed.clear();
    this._released.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
  }

  clear() {
    this._down.clear();
    this.endFrame();
  }

  requestPointerLock() {
    if (document.pointerLockElement === this.target) return;
    try {
      const r = this.target.requestPointerLock?.();
      // En algunos navegadores devuelve una promesa que puede rechazarse.
      if (r && typeof r.catch === 'function') r.catch(() => {});
    } catch {
      // Sin bloqueo de puntero el juego sigue siendo jugable con teclado.
    }
  }

  exitPointerLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  /** Nombre legible de una tecla para la interfaz. */
  static labelFor(code) {
    const names = {
      Backquote: 'º', AltLeft: 'Alt', Space: 'Espacio', ShiftLeft: 'Shift', ShiftRight: 'Shift D', ControlLeft: 'Ctrl', ControlRight: 'Ctrl D',
      Mouse0: 'Clic izq.', Mouse1: 'Clic central', Mouse2: 'Clic der.', Tab: 'Tab', Escape: 'Esc',
      ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
    };
    if (names[code]) return names[code];
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    return code;
  }
}
