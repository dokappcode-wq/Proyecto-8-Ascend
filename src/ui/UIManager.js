import * as THREE from 'three';
import { Input } from '../core/Input.js';
import { markSymbolTexture } from '../player/markTextures.js';

/**
 * UIManager — menús (principal, pausa, ajustes, depuración, salir), HUD y
 * transiciones. No contiene lógica de juego: notifica acciones mediante
 * `onAction`.
 */

/** Controles mostrados en Ajustes. `ready` indica si ya funcionan. */
const CONTROL_ROWS = [
  ['Movimiento', ['moveForward', 'moveLeft', 'moveBack', 'moveRight'], true],
  ['Cámara', null, true, 'Ratón'],
  ['Saltar', ['jump'], true],
  ['Sprint', ['sprint'], true],
  ['Esquivar', ['dodge'], true],
  ['Proyectil energético', ['attack'], true],
  ['Apuntar', ['aim'], true],
  ['Dash energético', ['special'], true],
  ['Descarga concentrada (mantener)', ['charged'], true],
  ['Onda expansiva', ['wave'], true],
  ['Pausa', null, true, 'Esc'],
  ['Menú de depuración', ['debugMenu'], true],
  ['Datos de depuración', ['debug'], true],
  ['Cuerpo a cuerpo', ['melee'], false, null, 'Etapa 3'],
  ['Interactuar', ['interact'], false, null, 'Etapa 4'],
  ['Menú de poderes', ['powerMenu'], false, null, 'Etapa 4'],
];

/** Casillas de habilidades del HUD. `power` = requiere la marca activa. */
const ABILITY_SLOTS = [
  { id: 'projectile', action: 'attack', name: 'Proyectil', power: true },
  { id: 'dash', action: 'special', name: 'Dash', power: true },
  { id: 'discharge', action: 'charged', name: 'Descarga', power: true },
  { id: 'wave', action: 'wave', name: 'Onda', power: true },
  { id: 'dodge', action: 'dodge', name: 'Esquiva', power: false },
  { id: 'sprint', action: 'sprint', name: 'Sprint', power: false },
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
      debug: this.$('screen-debug'),
      quit: this.$('screen-quit'),
    };
    this.hud = {
      root: this.$('hud'),
      map: this.$('hud-map'),
      hint: this.$('hud-hint'),
      click: this.$('hud-click'),
      debug: this.$('hud-debug'),
      fps: this.$('hud-fps'),
      toast: this.$('hud-toast'),
      crosshair: this.$('hud-crosshair'),
      charge: this.$('hud-charge'),
      hit: this.$('hud-hit'),
      power: this.$('hud-power'),
      powerName: this.$('hud-power-name'),
      powerIcon: this.$('hud-power-icon'),
      powerInf: this.$('hud-power-inf'),
      energyBar: this.$('hud-power').querySelector('.energy-bar'),
      energyFill: this.$('hud-energy-fill'),
      floaters: this.$('hud-floaters'),
      abilities: this.$('hud-abilities'),
    };
    this._settingsReturn = 'menu';
    this._toastTimer = null;
    this._hitTimer = null;
    this._floaters = [];
    this._v = new THREE.Vector3();
    this.waypoints = [];

    // Delegación: también funciona con botones generados dinámicamente.
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      e.stopPropagation();
      const action = btn.dataset.action;
      if (action === 'settings') return this.openSettings();
      if (action === 'settings-back') return this.closeSettings();
      if (action === 'quit-back') return this.show('menu');
      this.onAction(action, btn.dataset);
    });

    this._buildAbilities();
    this._renderHint();
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

  setWaypoints(list) {
    this.waypoints = list;
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

  // ---------------------------------------------------------------- Poderes
  setPowerAvailable(available, def) {
    this._powerAvailable = available;
    this.hud.power.classList.toggle('hidden', !available);
    this.hud.crosshair.classList.toggle('show', available);
    for (const s of ABILITY_SLOTS) if (s.power) this._slots[s.id].el.classList.toggle('locked', !available);
    if (available && def) {
      this.hud.powerName.textContent = def.concept;
      this.hud.powerIcon.src = markSymbolTexture(def.symbol, def.glowColor).image.toDataURL();
    }
    this._renderHint();
  }

  abilityFailed(id) {
    const slot = this._slots[id];
    if (slot) {
      slot.el.classList.remove('fail');
      void slot.el.offsetWidth; // reinicia la animación
      slot.el.classList.add('fail');
    }
    const bar = this.hud.energyBar;
    bar.classList.remove('low');
    void bar.offsetWidth;
    bar.classList.add('low');
  }

  /** Número de daño flotante sobre el punto de impacto. */
  damageNumber(point, amount, killed, kind) {
    const el = document.createElement('div');
    el.className = `floater${kind === 'discharge' || amount >= 25 ? ' big' : ''}${killed ? ' kill' : ''}`;
    el.textContent = killed ? `${amount} ✕` : String(amount);
    this.hud.floaters.appendChild(el);
    this._floaters.push({
      el, pos: new THREE.Vector3(point.x, point.y, point.z), life: 0.9, max: 0.9,
      dx: (Math.random() - 0.5) * 30,
    });
    const hit = this.hud.hit;
    hit.classList.add('show');
    hit.classList.toggle('kill', !!killed);
    clearTimeout(this._hitTimer);
    this._hitTimer = setTimeout(() => hit.classList.remove('show'), 90);
  }

  clearFloaters() {
    for (const f of this._floaters) f.el.remove();
    this._floaters.length = 0;
  }

  _updateFloaters(dt, camera) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    for (let i = this._floaters.length - 1; i >= 0; i--) {
      const f = this._floaters[i];
      f.life -= dt;
      if (f.life <= 0) {
        f.el.remove();
        this._floaters.splice(i, 1);
        continue;
      }
      const t = 1 - f.life / f.max;
      this._v.copy(f.pos);
      this._v.y += t * 0.8;
      this._v.project(camera);
      if (this._v.z > 1) {
        f.el.style.opacity = '0';
        continue;
      }
      const x = (this._v.x * 0.5 + 0.5) * w + f.dx * t;
      const y = (-this._v.y * 0.5 + 0.5) * h;
      f.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${1 + (1 - t) * 0.3})`;
      f.el.style.opacity = String(Math.min(1, f.life / 0.3));
    }
  }

  _buildAbilities() {
    this._slots = {};
    const root = this.hud.abilities;
    root.innerHTML = '';
    for (const s of ABILITY_SLOTS) {
      const el = document.createElement('div');
      el.className = `ability${s.power ? ' power' : ''}`;
      el.innerHTML = `<span class="key"></span><span class="name">${s.name}</span><div class="cooldown"></div>`;
      root.appendChild(el);
      this._slots[s.id] = { el, cd: el.querySelector('.cooldown'), key: el.querySelector('.key'), def: s };
    }
    this._refreshSlotKeys();
  }

  _refreshSlotKeys() {
    const b = this.input.bindings;
    for (const s of Object.values(this._slots)) {
      const codes = b[s.def.action] ?? [];
      const labels = [...new Set(codes.map((c) => Input.labelFor(c).replace(/ D$/, '')))].slice(0, 2);
      s.key.textContent = labels.join(' / ');
    }
  }

  _renderHint() {
    const power = this._powerAvailable
      ? ' · <b>Clic izq.</b> proyectil · <b>Clic der.</b> apuntar · <b>Q</b> dash · <b>R</b> (mantener) descarga · <b>G</b> onda'
      : '';
    this.hud.hint.innerHTML = `<b>WASD</b> moverse · <b>Espacio</b> saltar · <b>Shift</b> sprint · <b>Ctrl / C</b> esquivar${power} · <b>Esc</b> pausa · <b>F2</b> depuración · <b>H</b> ocultar ayuda`;
  }

  updateHud({ dt, camera, dodgeCooldown, dodgeCooldownMax, dodging, sprinting, pointerLocked, fps, debugText, power }) {
    const sl = this._slots;
    const ratio = dodgeCooldownMax > 0 ? Math.min(1, dodgeCooldown / dodgeCooldownMax) : 0;
    sl.dodge.cd.style.transform = `scaleY(${ratio})`;
    sl.dodge.el.classList.toggle('active', dodging);
    sl.sprint.el.classList.toggle('active', sprinting);

    if (power) {
      if (power.available !== this._powerAvailable) this.setPowerAvailable(power.available, null);
      if (power.available) {
        this.hud.energyFill.style.transform = `scaleX(${power.energy / power.energyMax})`;
        this.hud.powerInf.classList.toggle('show', power.infinite);
        for (const [id, a] of Object.entries(power.abilities)) {
          const s = sl[id];
          if (!s) continue;
          s.cd.style.transform = `scaleY(${a.cooldown})`;
          s.el.classList.toggle('unaffordable', !a.affordable);
        }
        sl.dash.el.classList.toggle('active', power.dashing);
        sl.discharge.el.classList.toggle('active', power.charge !== null);
        this.hud.crosshair.classList.toggle('aiming', power.aiming);
        const ch = this.hud.charge;
        ch.classList.toggle('show', power.charge !== null);
        if (power.charge !== null) {
          ch.style.setProperty('--p', power.charge.toFixed(3));
          ch.classList.toggle('full', power.charge >= 1);
        }
      }
    }

    this.hud.click.classList.toggle('show', !pointerLocked);
    if (this.save.settings.showFps) {
      this.hud.fps.classList.remove('hidden');
      this.hud.fps.textContent = `${fps.toFixed(0)} FPS`;
    } else {
      this.hud.fps.classList.add('hidden');
    }
    if (this.debugVisible && debugText) this.hud.debug.textContent = debugText;
    if (camera) this._updateFloaters(dt ?? 0, camera);
  }

  // ---------------------------------------------------------------- Depuración
  renderDebug(state) {
    const toggle = (action, label, on) =>
      `<button class="menu-btn" data-action="${action}"><span class="btn-title">${label}</span><span class="dbg-state ${on ? 'on' : 'off'}">${on ? 'Sí' : 'No'}</span></button>`;
    const btn = (action, label, extra = '') => `<button class="menu-btn" data-action="${action}" ${extra}><span class="btn-title">${label}</span></button>`;
    const wps = this.waypoints.map((w) => btn('dbg-teleport', escapeHtml(w.name), `data-wp="${escapeHtml(w.id)}"`)).join('');
    this.$('debug-body').innerHTML = `
      <section><h3>Energía</h3><div class="dbg-row">
        ${btn('dbg-energy', 'Restaurar energía')}
        ${toggle('dbg-infinite', 'Energía infinita', state.infiniteEnergy)}
        ${btn('dbg-abilities', 'Reiniciar habilidades')}
      </div></section>
      <section><h3>Marcas</h3><div class="dbg-row">
        ${toggle('dbg-mark', 'Marca de Energía', state.grantEnergy)}
        ${toggle('dbg-maxmarks', 'Marcas al máximo', state.maxMarks)}
      </div>
      <p class="note">Hasta la Etapa 4 la marca de Energía se concede desde aquí; después se obtendrá en la estación de adquisición.</p></section>
      <section><h3>Escenario</h3><div class="dbg-row">
        ${btn('dbg-scenario', 'Reiniciar dianas y objetos')}
        ${btn('restart', 'Reiniciar mapa')}
      </div></section>
      ${wps ? `<section><h3>Ir a</h3><div class="dbg-row">${wps}</div></section>` : ''}
      <p class="note">Salud del jugador y generación de enemigos llegan en la Etapa 3.</p>
      <nav class="menu-list compact row">
        ${btn('menu', 'Volver al menú')}
        ${btn('resume', 'Cerrar (F2)')}
      </nav>`;
  }

  // ---------------------------------------------------------------- Ajustes
  _bindSettings() {
    const s = () => this.save.settings;
    const sens = this.$('set-sens');
    const fov = this.$('set-fov');
    const inv = this.$('set-invert');
    const sh = this.$('set-shadows');
    const bloom = this.$('set-bloom');
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
    bloom.addEventListener('change', () => apply({ bloom: bloom.checked }));
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
    this.$('set-bloom').checked = !!s.bloom;
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
