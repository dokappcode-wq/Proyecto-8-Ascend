import { Input } from '../core/Input.js';

/**
 * UIManager — menús (principal, pausa, ajustes, salir), HUD y transiciones.
 * No contiene lógica de juego: notifica acciones mediante `onAction`.
 */

/** Controles mostrados en Ajustes. `ready` indica si ya funcionan. */
const CONTROL_ROWS = [
  ['Movimiento', ['moveForward', 'moveLeft', 'moveBack', 'moveRight'], true],
  ['Cámara', null, true, 'Ratón'],
  ['Saltar', ['jump'], true],
  ['Sprint', ['sprint'], true],
  ['Esquivar', ['dodge'], true],
  ['Pausa', null, true, 'Esc'],
  ['Depuración', ['debug'], true],
  ['Ataque principal', ['attack'], false, null, 'Etapa 2'],
  ['Apuntar', ['aim'], false, null, 'Etapa 2'],
  ['Habilidad especial', ['special'], false, null, 'Etapa 2'],
  ['Descarga concentrada', ['charged'], false, null, 'Etapa 2'],
  ['Cuerpo a cuerpo', ['melee'], false, null, 'Etapa 3'],
  ['Interactuar', ['interact'], false, null, 'Etapa 4'],
  ['Menú de poderes', ['powerMenu'], false, null, 'Etapa 4'],
];

export class UIManager {
  constructor({ save, input, onAction, onSettingsChanged }) {
    this.save = save;
    this.input = input;
    this.onAction = onAction;
    this.onSettingsChanged = onSettingsChanged;
    this.$ = (id) => document.getElementById(id);
    this.screens = {
      menu: this.$('screen-menu'),
      pause: this.$('screen-pause'),
      settings: this.$('screen-settings'),
      quit: this.$('screen-quit'),
    };
    this.hud = {
      root: this.$('hud'),
      map: this.$('hud-map'),
      dodge: this.$('hud-dodge'),
      dodgeCd: this.$('hud-dodge').querySelector('.cooldown'),
      sprint: this.$('hud-sprint'),
      hint: this.$('hud-hint'),
      click: this.$('hud-click'),
      debug: this.$('hud-debug'),
      fps: this.$('hud-fps'),
      toast: this.$('hud-toast'),
    };
    this._settingsReturn = 'menu';
    this._toastTimer = null;

    document.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        if (action === 'settings') return this.openSettings();
        if (action === 'settings-back') return this.closeSettings();
        if (action === 'quit-back') return this.show('menu');
        this.onAction(action, btn.dataset);
      });
    });

    this._bindSettings();
    this._renderControls();
  }

  show(name) {
    for (const [k, el] of Object.entries(this.screens)) el.classList.toggle('active', k === name);
    this.currentScreen = name;
    const firstBtn = name && this.screens[name]?.querySelector('.menu-btn');
    firstBtn?.focus({ preventScroll: true });
  }

  hideAll() {
    this.show(null);
  }

  setHudVisible(v) {
    this.hud.root.classList.toggle('hidden', !v);
  }

  openSettings() {
    this._settingsReturn = this.currentScreen === 'pause' ? 'pause' : 'menu';
    this._syncSettingsForm();
    this.show('settings');
  }

  closeSettings() {
    this.show(this._settingsReturn);
  }

  /** Transición en negro: ejecuta `work` con la pantalla cubierta. */
  async fade(text, work) {
    const fade = this.$('fade');
    this.$('fade-text').textContent = text;
    fade.classList.add('show');
    await wait(360);
    await work();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    fade.classList.remove('show');
  }

  setMapName(name, subtitle) {
    this.hud.map.innerHTML = `${escapeHtml(name)}${subtitle ? `<small>${escapeHtml(subtitle)}</small>` : ''}`;
  }

  toast(title, subtitle = '', ms = 2600) {
    const t = this.hud.toast;
    t.innerHTML = `${escapeHtml(title)}${subtitle ? `<small>${escapeHtml(subtitle)}</small>` : ''}`;
    t.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }

  toggleHint() {
    this.hud.hint.classList.toggle('hidden');
  }

  toggleDebug() {
    this.hud.debug.classList.toggle('hidden');
  }

  get debugVisible() {
    return !this.hud.debug.classList.contains('hidden');
  }

  updateHud({ dodgeCooldown, dodgeCooldownMax, dodging, sprinting, pointerLocked, fps, debugText }) {
    const ratio = dodgeCooldownMax > 0 ? Math.min(1, dodgeCooldown / dodgeCooldownMax) : 0;
    this.hud.dodgeCd.style.transform = `scaleY(${ratio})`;
    this.hud.dodge.classList.toggle('active', dodging);
    this.hud.sprint.classList.toggle('active', sprinting);
    this.hud.click.classList.toggle('show', !pointerLocked);
    if (this.save.settings.showFps) {
      this.hud.fps.classList.remove('hidden');
      this.hud.fps.textContent = `${fps.toFixed(0)} FPS`;
    } else {
      this.hud.fps.classList.add('hidden');
    }
    if (this.debugVisible && debugText) this.hud.debug.textContent = debugText;
  }

  _bindSettings() {
    const s = () => this.save.settings;
    const sens = this.$('set-sens');
    const fov = this.$('set-fov');
    const inv = this.$('set-invert');
    const sh = this.$('set-shadows');
    const fps = this.$('set-fps');
    const apply = (patch) => {
      this.save.updateSettings(patch);
      this._syncSettingsForm();
      this.onSettingsChanged?.(s());
    };
    sens.addEventListener('input', () => apply({ mouseSensitivity: Number(sens.value) }));
    fov.addEventListener('input', () => apply({ fov: Number(fov.value) }));
    inv.addEventListener('change', () => apply({ invertY: inv.checked }));
    sh.addEventListener('change', () => apply({ shadows: sh.checked }));
    fps.addEventListener('change', () => apply({ showFps: fps.checked }));
    this._syncSettingsForm();
  }

  _syncSettingsForm() {
    const s = this.save.settings;
    this.$('set-sens').value = s.mouseSensitivity;
    this.$('out-sens').textContent = `${Number(s.mouseSensitivity).toFixed(2)}×`;
    this.$('set-fov').value = s.fov;
    this.$('out-fov').textContent = `${s.fov}°`;
    this.$('set-invert').checked = !!s.invertY;
    this.$('set-shadows').checked = !!s.shadows;
    this.$('set-fps').checked = !!s.showFps;
  }

  _renderControls() {
    const b = this.input.bindings;
    const rows = CONTROL_ROWS.map(([label, actions, ready, fixed, stage]) => {
      let keys;
      if (fixed) keys = `<kbd>${fixed}</kbd>`;
      else if (actions.length > 1) keys = actions.map((a) => `<kbd>${Input.labelFor(b[a][0])}</kbd>`).join(' ');
      else keys = b[actions[0]].map((c) => `<kbd>${Input.labelFor(c)}</kbd>`).join(' / ');
      const tag = ready ? '' : ` <span class="pending">(${stage})</span>`;
      return `<tr><td>${label}${tag}</td><td>${keys}</td></tr>`;
    });
    this.$('controls-table').innerHTML = rows.join('');
  }
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
