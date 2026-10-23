import * as THREE from 'three';
import { Input } from '../core/Input.js';
import { markSymbolTexture } from '../player/markTextures.js';
import { MARKS } from '../data/marks.js';
import { checkpoint, STORY_MISSIONS } from '../story/storyData.js';
import { CityMap } from './cityMap.js';

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
  ['Agacharse / cubrirse junto a un muro · Soltarse al escalar', ['crouch'], true],
  ['Escalar: saltar hacia un muro o cornisa', ['jump'], true],
  ['Proyectil energético', ['attack'], true],
  ['Apuntar', ['aim'], true],
  ['Dash energético (apuntando + mantener: dash dirigido)', ['special'], true],
  ['Recargar (pulsar) · Descarga concentrada (mantener)', ['charged'], true],
  ['Onda expansiva (en el aire: caída en rayo) · Gravedad: empujar', ['wave'], true],
  ['Gravedad: granada de gravedad', ['grenade'], true],
  ['Cambiar de marca', ['switchMark'], true],
  ['Pausa', null, true, 'Esc'],
  ['Menú de depuración', ['debugMenu'], true],
  ['Administración de la ciudad (barreras, plano y viaje)', ['adminMenu'], true],
  ['Datos de depuración', ['debug'], true],
  ['Golpe (con energía: puños eléctricos y embestida)', ['melee'], true],
  ['Interactuar', ['interact'], true],
  ['Menú de marcas y habilidades', ['powerMenu'], true],
];

/**
 * Símbolo de munición de cada elemento (uno por disparo). Energía: una
 * flecha con forma de rayo. Los futuros elementos añaden aquí el suyo.
 */
const ELEMENT_AMMO_ICONS = {
  energia: '<svg class="ammo-icon" viewBox="0 0 12 24" aria-hidden="true"><path d="M6 0 10 6H7.4L9.6 12H6.8L8.8 24 2 10.4h3L2.6 6H5z" fill="currentColor"/></svg>',
  // Hilo: un puño (listo o volviendo)
  hilo: '<svg class="ammo-icon fist" viewBox="0 0 20 24" aria-hidden="true"><path d="M4 9h11a3 3 0 0 1 3 3v5a5 5 0 0 1-5 5H8a4 4 0 0 1-4-4z" fill="currentColor"/><path d="M5 9V5a2 2 0 0 1 4 0v4M9 9V4a2 2 0 0 1 4 0v5M13 9V5a2 2 0 0 1 4 0v5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10 0v3" stroke="currentColor" stroke-width="1"/></svg>',
  // Gravedad: núcleo con órbita y flecha hacia abajo
  gravedad: '<svg class="ammo-icon grav" viewBox="0 0 16 24" aria-hidden="true"><ellipse cx="8" cy="9" rx="7" ry="3" fill="none" stroke="currentColor" stroke-width="1.6" transform="rotate(-18 8 9)"/><circle cx="8" cy="9" r="2.6" fill="currentColor"/><path d="M8 14v8M5 19l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  // Alas: una pluma (cada icono son 10 plumas)
  alas: '<svg class="ammo-icon feather" viewBox="0 0 12 24" aria-hidden="true"><path d="M6 23V7" stroke="currentColor" stroke-width="1.2"/><path d="M6 1c4 3 5 8 4 13-1 3-3 5-4 6-1-1-3-3-4-6C1 9 2 4 6 1z" fill="currentColor" opacity=".85"/></svg>',
  // Temperatura: alterna un cristal de hielo y una llama (como los disparos)
  temperatura: [
    '<svg class="ammo-icon ice" viewBox="0 0 16 24" aria-hidden="true"><path d="M8 2v20M2 7l12 10M14 7 2 17M8 2 6 5M8 2l2 3M8 22l-2-3M8 22l2-3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    '<svg class="ammo-icon flame" viewBox="0 0 14 24" aria-hidden="true"><path d="M7 1c1 4 6 7 6 13a6 6 0 0 1-12 0c0-3 2-5 3-7 0 2 1 4 2 4 0-4 1-7 1-10z" fill="currentColor"/></svg>',
  ],
};

/** Nombres de las casillas de poder según la marca activa. */
const FAMILY_SLOT_NAMES = {
  energia: { projectile: 'Proyectil', dash: 'Dash', discharge: 'Descarga', wave: 'Onda' },
  gravedad: { projectile: 'Disparo', dash: 'Rocas', discharge: 'Atraer', wave: 'Empujar', grenade: 'Granada' },
  hilo: { projectile: 'Hilos', dash: 'Balanceo', discharge: 'Atar', wave: 'Lanzar', grenade: 'Atraer' },
  temperatura: { projectile: 'Hielo/Fuego', dash: 'Patinar', discharge: 'Muro', wave: 'Estela', grenade: 'Tormenta' },
  alas: { projectile: 'Plumas', dash: 'Vuelo', discharge: 'Espada', wave: 'Lluvia', grenade: 'Escudo' },
};

/** Casillas de habilidades del HUD. `power` = requiere la marca activa. */
const ABILITY_SLOTS = [
  { id: 'projectile', action: 'attack', name: 'Proyectil', power: true },
  { id: 'dash', action: 'special', name: 'Dash', power: true },
  { id: 'discharge', action: 'charged', name: 'Descarga', power: true },
  { id: 'wave', action: 'wave', name: 'Onda', power: true },
  { id: 'grenade', action: 'grenade', name: 'Granada', power: true },
  { id: 'melee', action: 'melee', name: 'Golpe', power: false },
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
      admin: this.$('screen-admin'),
      marks: this.$('screen-marks'),
      quit: this.$('screen-quit'),
      mission: this.$('screen-mission'),
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
      ammo: this.$('hud-ammo'),
      vitals: this.$('hud-vitals'),
      power: this.$('hud-power'),
      powerAmmo: this.$('hud-power-ammo'),
      ammoIcons: this.$('hud-ammo-icons'),
      energyText: this.$('hud-energy-text'),
      powerIcon: this.$('hud-power-icon'),
      powerInf: this.$('hud-power-inf'),
      energyBar: this.$('hud-power').querySelector('.energy-bar'),
      energyFill: this.$('hud-energy-fill'),
      floaters: this.$('hud-floaters'),
      abilities: this.$('hud-abilities'),
      health: this.$('hud-health'),
      healthFill: this.$('hud-health-fill'),
      healthLag: this.$('hud-health-lag'),
      healthText: this.$('hud-health-text'),
      vignette: this.$('hud-vignette'),
      hitdir: this.$('hud-hitdir'),
      prompt: this.$('hud-prompt'),
      death: this.$('hud-death'),
      xp: this.$('hud-xp'),
      stance: this.$('hud-stance'),
      mission: this.$('hud-mission'),
      markers: this.$('hud-markers'),
      faction: this.$('hud-faction'),
      bounds: this.$('hud-bounds'),
    };
    this._missionKey = '';
    this._markerEls = [];
    this._factionKey = '';
    this._xpTimer = null;
    this._vigTimer = null;
    this._dirTimer = null;
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
    if (name === 'menu') {
      this._renderMenuMissions();
      this._renderMenuStory();
    }
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

  // ---------------------------------------------------------------- Rueda de marcas
  /** Muestra la rueda con las marcas copiadas (la primera arriba, en sentido horario). */
  showMarkWheel(defs, activeId) {
    const el = this.$('mark-wheel');
    const R = 120;
    el.innerHTML = defs.map((d, i) => {
      const a = (i / defs.length) * Math.PI * 2;
      const x = Math.sin(a) * R;
      const y = -Math.cos(a) * R;
      const img = markSymbolTexture(d.symbol, d.glowColor).image.toDataURL();
      return `<div class="wheel-slot${d.id === activeId ? ' current' : ''}" data-i="${i}" style="--el:${d.color};transform:translate(calc(-50% + ${x.toFixed(0)}px), calc(-50% + ${y.toFixed(0)}px))"><img src="${img}" alt="" /><span>${escapeHtml(d.concept)}</span></div>`;
    }).join('') + '<div class="wheel-hint">Mueve el ratón y suelta V</div>';
    el.classList.add('show');
    this._wheelPick = -2;
  }

  highlightMarkWheel(i) {
    if (i === this._wheelPick) return;
    this._wheelPick = i;
    for (const s of this.$('mark-wheel').querySelectorAll('.wheel-slot')) s.classList.toggle('pick', Number(s.dataset.i) === i);
  }

  hideMarkWheel() {
    this.$('mark-wheel').classList.remove('show');
  }

  /** Aviso grande y breve de combo entre marcas. */
  combo(name, desc) {
    const el = this.$('combo-banner');
    el.innerHTML = `<b>¡Combo! ${escapeHtml(name)}</b><span>${escapeHtml(desc)}</span>`;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(this._comboT);
    this._comboT = setTimeout(() => el.classList.remove('show'), 1800);
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
    this.hud.powerAmmo.classList.toggle('hidden', !available);
    this.hud.crosshair.classList.toggle('show', available);
    for (const s of ABILITY_SLOTS) if (s.power) this._slots[s.id].el.classList.toggle('locked', !available);
    const names = FAMILY_SLOT_NAMES[def?.id] ?? FAMILY_SLOT_NAMES.energia;
    for (const s of ABILITY_SLOTS) {
      if (!s.power) continue;
      const slot = this._slots[s.id];
      slot.el.querySelector('.name').textContent = names[s.id] ?? s.name;
      slot.el.style.display = names[s.id] ? '' : 'none';
    }
    if (available && def) {
      this._element = def.id;
      this.hud.powerIcon.src = markSymbolTexture(def.symbol, def.glowColor).image.toDataURL();
      this.hud.vitals.style.setProperty('--el', def.color);
      this.hud.vitals.dataset.el = def.id;
      this._ammoKey = null; // redibuja los símbolos de munición
    }
    this._renderHint();
  }

  /**
   * Munición elemental: un símbolo del elemento por disparo del cargador.
   * Los gastados se apagan; durante la recarga se van rellenando.
   */
  _renderAmmoIcons(mag) {
    const el = this._element ?? 'energia';
    // Con mucha munición (Alas: 100 plumas) cada símbolo representa `iconStep` balas
    const step = mag.iconStep ?? 1;
    const count = Math.ceil(mag.size / step);
    const lit = Math.ceil((mag.reloading ? Math.floor(mag.size * mag.progress) : mag.ammo) / step);
    const key = `${el}|${count}|${lit}|${mag.reloading}`;
    if (key === this._ammoKey) return;
    this._ammoKey = key;
    const root = this.hud.ammoIcons;
    if (root.childElementCount !== count || root.dataset.el !== el) {
      root.dataset.el = el;
      const icon = ELEMENT_AMMO_ICONS[el] ?? ELEMENT_AMMO_ICONS.energia;
      root.innerHTML = Array.from({ length: count }, (_, i) => (Array.isArray(icon) ? icon[i % icon.length] : icon)).join('');
    }
    [...root.children].forEach((icon, i) => {
      icon.classList.toggle('spent', i >= lit);
      icon.classList.toggle('refill', mag.reloading && i < lit);
    });
  }

  // ---------------------------------------------------------------- Combate
  /** Aviso de interacción (E). `label` null lo oculta; `progress` (0..1) muestra una barra. */
  setPrompt(label, progress = null) {
    const p = this.hud.prompt;
    if (!label) return p.classList.remove('show');
    const meter = progress !== null ? `<div class="prompt-meter"><div style="width:${(progress * 100).toFixed(1)}%"></div></div>` : '';
    p.innerHTML = `<kbd>${Input.labelFor(this.input.bindings.interact[0])}</kbd>${escapeHtml(label)}${meter}`;
    p.classList.add('show');
  }

  /** «+40 EXP» breve junto a la barra de energía. */
  xpGain(amount) {
    const el = this.hud.xp;
    el.textContent = `+${amount} EXP`;
    el.classList.add('show');
    clearTimeout(this._xpTimer);
    this._xpTimer = setTimeout(() => el.classList.remove('show'), 900);
  }

  // ---------------------------------------------------------------- Marcas (Tab)
  /**
   * Menú de marcas: marca original del Destino, marcas adquiridas con su
   * progreso y árbol de habilidades de cada una.
   */
  renderMarks({ profile, progression, marks }) {
    const icon = (def) => markSymbolTexture(def.symbol, def.glowColor).image.toDataURL();
    const destino = MARKS.destino;
    const copied = Object.values(MARKS).filter((d) => !d.original);
    let html = '<div class="marks-layout"><div>';
    html += `<div class="mark-card"><img src="${icon(destino)}" alt="" /><div><span class="tag">Original</span><h4>${destino.name}</h4>
      <p>Innata. Permite copiar las marcas de otras Encarnaciones por contacto y voluntad. Su naturaleza sigue siendo un misterio.</p></div></div>`;
    for (const def of copied) {
      const has = profile.marks.includes(def.id);
      const viaDebug = !has && marks.owns(def.id);
      if (has || viaDebug) {
        const st = progression.state(def.id);
        const tree = progression.tree(def.id);
        const pct = tree ? (st.xp / tree.xpPerLevel) * 100 : 0;
        const isActive = marks.activeFamily === def.id;
        const use = isActive ? '<span class="tag active-tag">Activa</span>' : `<button class="menu-btn mini" data-action="set-mark" data-mark="${def.id}"><span class="btn-title">Usar esta marca</span></button>`;
        html += `<div class="mark-card${isActive ? ' active' : ''}"><img src="${icon(def)}" alt="" /><div style="flex:1"><span class="tag">${viaDebug ? 'Concedida (depuración)' : 'Copiada'}</span> ${use}<h4>${def.name}</h4>
          ${def.passive ? `<p class="passive"><b>Pasiva — ${escapeHtml(def.passive.name)}:</b> ${escapeHtml(def.passive.desc)}</p>` : ''}
          <p>Nivel ${st.level} · ${st.xp}/${tree?.xpPerLevel ?? '—'} EXP · <span class="points">${st.points} punto${st.points === 1 ? '' : 's'}</span></p>
          <div class="xp-bar"><div style="width:${pct.toFixed(1)}%"></div></div>
          <p>Se gana experiencia neutralizando enemigos con esta marca activa.</p></div></div>`;
      } else {
        html += `<div class="mark-card locked"><img src="${icon(def)}" alt="" /><div><span class="tag">No adquirida</span><h4>${def.name}</h4>
          <p>${def.id === 'energia' ? 'Se consigue en la Historia · Prólogo (contacto + voluntad).' : `Cópiala por contacto con la Encarnación de la ${def.concept} (Campo de Pruebas, Zona E).`}</p></div></div>`;
      }
    }
    html += '</div><div>';
    const active = copied.find((d) => d.id === marks.activeFamily) ?? copied.find((d) => marks.owns(d.id));
    if (!active) {
      html += '<p class="note">Aún no tienes marcas copiadas. Sus habilidades aparecerán aquí.</p>';
    } else {
      const tree = progression.tree(active.id);
      html += `<h3 style="margin-top:0">Habilidades — ${active.concept}</h3><div class="tree">`;
      for (const n of tree.nodes) {
        const unlocked = progression.isUnlocked(active.id, n.id);
        const can = progression.canUnlock(active.id, n.id);
        let cls;
        let status;
        if (n.type === 'base') {
          cls = 'base';
          status = 'Fundamental · disponible';
        } else if (n.type === 'future') {
          cls = 'future';
          status = 'Próximamente';
        } else if (unlocked) {
          cls = 'unlocked';
          status = 'Desbloqueada';
        } else if (can.ok) {
          cls = 'available';
          status = `Disponible · ${n.cost} punto${n.cost === 1 ? '' : 's'}`;
        } else if (can.reason === 'requires') {
          cls = 'locked';
          status = `Requiere: ${can.missing.map((m) => tree.nodes.find((x) => x.id === m)?.name ?? m).join(', ')}`;
        } else {
          cls = 'locked';
          status = `${n.cost} punto${n.cost === 1 ? '' : 's'}`;
        }
        const btn = can.ok ? `<button class="menu-btn" data-action="unlock-node" data-mark="${active.id}" data-node="${n.id}"><span class="btn-title">Desbloquear</span></button>` : '';
        html += `<div class="node ${cls}" data-node="${n.id}"><h5>${escapeHtml(n.name)}</h5><p>${escapeHtml(n.desc)}</p><span class="status">${escapeHtml(status)}</span>${btn}</div>`;
      }
      html += '</div>';
    }
    html += '</div></div>';
    this.$('marks-body').innerHTML = html;
  }

  /** Viñeta roja e indicador de la dirección del impacto. */
  playerDamaged(d, camera, playerPos) {
    const v = this.hud.vignette;
    v.classList.add('show');
    clearTimeout(this._vigTimer);
    this._vigTimer = setTimeout(() => v.classList.remove('show'), 120);
    let dx;
    let dz;
    if (d.from) {
      dx = d.from.x - playerPos.x;
      dz = d.from.z - playerPos.z;
    } else if (d.dir) {
      dx = -d.dir.x;
      dz = -d.dir.z;
    } else return;
    camera.getWorldDirection(this._v);
    const fx = this._v.x;
    const fz = this._v.z;
    // Ángulo con signo entre la dirección de la cámara y la fuente (0 = delante, + = derecha)
    const ang = Math.atan2(fx * dz - fz * dx, fx * dx + fz * dz);
    const el = this.hud.hitdir;
    el.style.transform = `rotate(${ang}rad)`;
    el.classList.add('show');
    clearTimeout(this._dirTimer);
    this._dirTimer = setTimeout(() => el.classList.remove('show'), 150);
  }

  showDeath(v) {
    this.hud.death.classList.toggle('show', v);
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
      el.innerHTML = `<span class="key"></span><span class="name">${s.name}</span><span class="ammo"></span><div class="cooldown"></div>`;
      root.appendChild(el);
      this._slots[s.id] = { el, cd: el.querySelector('.cooldown'), key: el.querySelector('.key'), ammo: el.querySelector('.ammo'), def: s };
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
    let power = '';
    if (this._powerAvailable && this._element === 'alas') {
      power = ' · Las plumas se regeneran solas (<b>E</b> junto a palomares o cojines: más rápido) · <b>Clic izq.</b> plumas (1 por disparo) · <b>Q</b> volar (más plumas, más rápido; <b>Espacio</b> sube, <b>C</b> baja) · <b>R</b> espada de plumas (mantén: más grande) · <b>G</b> lluvia de plumas · <b>X</b> escudo de plumas · <b>V</b> cambiar de marca (mantener: rueda)';
    } else if (this._powerAvailable && this._element === 'temperatura') {
      power = ' · <b>E</b> (mantener) junto a arcones congeladores o bidones con fuego: absorber temperatura · <b>Clic izq.</b> hielo y fuego (alternos) · <b>Q</b> patinar (contra una pared: patinas por ella) · <b>Shift</b> patinando: fuego atrás y camino de hielo por el aire · <b>R</b> muro de hielo · <b>G</b> estela de fuego · <b>X</b> fuego frío · <b>V</b> cambiar de marca (mantener: rueda)';
    } else if (this._powerAvailable && this._element === 'hilo') {
      power = ' · <b>E</b> (mantener) junto a tendederos o rollos de tela: absorber hilo · <b>Clic izq.</b> hilos (el puño debe volver) · <b>Q</b> (mantener) balancearse · <b>R</b> atar · <b>G</b> lanzar · <b>X</b> atraerse · <b>F</b> cadena · <b>Espacio</b> mantener: salto alto · <b>V</b> cambiar de marca (mantener: rueda)';
    } else if (this._powerAvailable && this._element === 'gravedad') {
      power = ' · <b>E</b> (mantener) junto a escombros o bloques de hormigón: absorber gravedad · <b>Clic izq.</b> disparo (hace flotar) · <b>Q</b> elevar roca (en el aire, otra: hasta 3) · <b>R</b> atraer · <b>G</b> empujar · <b>X</b> granada · <b>Espacio</b> mantener: más alto, hasta 3 saltos, cayendo: planear · <b>V</b> cambiar de marca (mantener: rueda)';
    } else if (this._powerAvailable) {
      power = ' · <b>E</b> (mantener) junto a farolas, armarios o máquinas: absorber energía · <b>Clic izq.</b> proyectil · <b>Clic der.</b> apuntar · <b>Q</b> dash (apuntando y manteniendo: dash dirigido) · <b>R</b> recargar (mantener: descarga) · <b>G</b> onda (en el aire: rayo) · <b>V</b> cambiar de marca (mantener: rueda)';
    }
    this.hud.hint.innerHTML = `<b>WASD</b> moverse · <b>Espacio</b> saltar · <b>Shift</b> sprint · <b>Espacio</b> hacia un muro: escalar (<b>C</b> soltarse) · <b>Ctrl / Alt</b> esquivar · <b>C</b> agacharse / cubrirse · <b>F</b> golpe · <b>E</b> interactuar${power} · <b>Esc</b> pausa · <b>Tab</b> marcas · <b>F2</b> depuración · <b>H</b> ocultar ayuda`;
  }

  updateHud({ dt, camera, dodgeCooldown, dodgeCooldownMax, dodging, sprinting, pointerLocked, fps, debugText, power, health, meleeCooldown, stance, meleeElemental, faction }) {
    this._updateFaction(faction);
    const sl = this._slots;
    if (stance !== undefined && stance !== this._stance) {
      this._stance = stance;
      const labels = { none: '', crouch: 'Agachado', cover: 'A cubierto', peek: 'Asomado' };
      this.hud.stance.textContent = labels[stance] ?? '';
      this.hud.stance.className = `hud-stance ${stance}`;
    }
    sl.melee.el.classList.toggle('elemental', !!meleeElemental);
    if (health) {
      const r = Math.max(0, health.value / health.max);
      this.hud.healthFill.style.transform = `scaleX(${r})`;
      this.hud.healthLag.style.transform = `scaleX(${r})`;
      this.hud.healthFill.classList.toggle('mid', r <= 0.5 && r > 0.25);
      this.hud.healthFill.classList.toggle('low', r <= 0.25);
      this.hud.healthText.textContent = String(Math.ceil(health.value));
      this.hud.health.classList.toggle('god', !!health.god);
      this.hud.health.classList.toggle('invuln', !!health.invuln);
      this.hud.vignette.classList.toggle('critical', r > 0 && r <= 0.25);
    }
    if (meleeCooldown !== undefined) sl.melee.cd.style.transform = `scaleY(${Math.min(1, Math.max(0, meleeCooldown))})`;
    const ratio = dodgeCooldownMax > 0 ? Math.min(1, dodgeCooldown / dodgeCooldownMax) : 0;
    sl.dodge.cd.style.transform = `scaleY(${ratio})`;
    sl.dodge.el.classList.toggle('active', dodging);
    sl.sprint.el.classList.toggle('active', sprinting);

    if (power) {
      if (power.available !== this._powerAvailable) this.setPowerAvailable(power.available, null);
      if (power.available) {
        this.hud.energyFill.style.transform = `scaleX(${power.energy / power.energyMax})`;
        this.hud.energyText.textContent = power.infinite ? '' : String(Math.round(power.energy));
        this.hud.powerInf.classList.toggle('show', power.infinite);
        for (const [id, a] of Object.entries(power.abilities)) {
          const s = sl[id];
          if (!s) continue;
          s.cd.style.transform = `scaleY(${a.cooldown})`;
          s.el.classList.toggle('unaffordable', !a.affordable);
        }
        sl.dash.el.classList.toggle('active', power.dashing || power.targeting);
        sl.wave.el.classList.toggle('active', power.diving);
        sl.discharge.el.classList.toggle('active', power.charge !== null);
        this.hud.crosshair.classList.toggle('aiming', power.aiming);
        const ch = this.hud.charge;
        const mag = power.magazine;
        const reloading = !!mag?.reloading;
        // El anillo muestra la carga de la descarga o el progreso de la recarga.
        const ring = power.charge !== null ? power.charge : reloading ? mag.progress : null;
        ch.classList.toggle('show', ring !== null);
        ch.classList.toggle('reload', reloading && power.charge === null);
        if (ring !== null) {
          ch.style.setProperty('--p', ring.toFixed(3));
          ch.classList.toggle('full', power.charge !== null && power.charge >= 1);
        }
        if (mag) {
          const low = !reloading && mag.ammo <= Math.ceil(mag.size * 0.3);
          this.hud.ammo.textContent = reloading ? (this._element === 'hilo' ? 'Puño volviendo' : 'Recargando') : `${mag.ammo}/${mag.size}`;
          this._renderAmmoIcons(mag);
          this.hud.ammo.classList.toggle('low', low);
          this.hud.ammo.classList.toggle('reloading', reloading);
          sl.projectile.ammo.textContent = reloading ? '···' : `${mag.ammo}/${mag.size}`;
          if (reloading) sl.projectile.cd.style.transform = `scaleY(${1 - mag.progress})`;
          sl.projectile.el.classList.toggle('reloading', reloading);
        } else {
          this.hud.ammo.textContent = '';
          sl.projectile.ammo.textContent = '';
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
      <section><h3>Salud</h3><div class="dbg-row">
        ${btn('dbg-health', 'Restaurar salud')}
        ${toggle('dbg-invulnerable', 'Invulnerable', state.invulnerable)}
      </div></section>
      <section><h3>Enemigos (${state.enemies ?? 0} activos)</h3><div class="dbg-row">
        ${btn('dbg-spawn', 'Generar enemigos (PDC + Acólito)')}
        ${btn('dbg-clear-enemies', 'Eliminar enemigos')}
      </div></section>
      <section><h3>Energía</h3><div class="dbg-row">
        ${btn('dbg-energy', 'Restaurar energía')}
        ${toggle('dbg-infinite', 'Energía infinita', state.infiniteEnergy)}
        ${btn('dbg-abilities', 'Reiniciar habilidades')}
      </div></section>
      <section><h3>Marcas</h3><div class="dbg-row">
        ${btn('dbg-reset-acquisition', 'Reiniciar adquisición de Energía')}
        ${toggle('dbg-mark', 'Conceder Energía (atajo)', state.grantEnergy)}
        ${toggle('dbg-mark-gravity', 'Conceder Gravedad (atajo)', state.grantGravity)}
        ${btn('dbg-reset-gravity', 'Reiniciar adquisición de Gravedad')}
        ${toggle('dbg-mark-thread', 'Conceder Hilo (atajo)', state.grantThread)}
        ${btn('dbg-reset-thread', 'Reiniciar adquisición de Hilo')}
        ${toggle('dbg-mark-temperature', 'Conceder Temperatura (atajo)', state.grantTemperature)}
        ${btn('dbg-reset-temperature', 'Reiniciar adquisición de Temperatura')}
        ${toggle('dbg-mark-wings', 'Conceder Alas (atajo)', state.grantWings)}
        ${btn('dbg-reset-wings', 'Reiniciar adquisición de Alas')}
        ${toggle('dbg-maxmarks', 'Marcas al máximo', state.maxMarks)}
        ${toggle('dbg-zone-e', 'Zona E clásica (Encarnación de la Energía en el Campo)', state.classicZoneE)}
        ${btn('dbg-xp', '+60 EXP')}
        ${btn('dbg-points', '+1 punto de mejora')}
      </div>
      <p class="note">Marca de Energía adquirida: ${state.acquired ? 'sí' : 'no'}. La forma normal de obtenerla es el Prólogo (Historia); la «Zona E clásica» la devuelve al Campo para practicar.</p></section>
      ${state.story ? `<section><h3>Historia · punto de control ${escapeHtml(state.story.checkpoint)}${state.story.choice ? ` · elección: ${state.story.choice === 'KILL' ? 'matar' : 'perdonar'}` : ''}</h3><div class="dbg-row">
        ${state.story.list.map((c) => btn('dbg-story-cp', `${c.id} · ${escapeHtml(c.title)}`, `data-cp="${c.id}"`)).join('')}
      </div></section>` : ''}
      ${state.mission ? `<section><h3>Misión: ${escapeHtml(state.mission.name)} (${{ inactive: 'sin empezar', active: 'en curso', completed: 'completada' }[state.mission.state]})</h3><div class="dbg-row">
        ${btn('dbg-mission-reset', 'Reiniciar misión')}
      </div></section>` : ''}
      ${state.pdc ? `<section><h3>Reputación — PDC: ${escapeHtml(state.pdc)}</h3><div class="dbg-row">
        ${btn('dbg-pdc-hostile', state.pdc === 'Hostil' ? 'Calmar a la PDC' : 'Volver hostil a la PDC')}
      </div></section>` : ''}
      <section><h3>Escenario</h3><div class="dbg-row">
        ${btn('dbg-scenario', 'Reiniciar escenario (dianas, objetos, enemigos)')}
        ${btn('restart', 'Reiniciar mapa')}
      </div></section>
      ${wps ? `<section><h3>Ir a</h3><div class="dbg-row">${wps}</div></section>` : ''}
      <nav class="menu-list compact row">
        ${btn('menu', 'Volver al menú')}
        ${btn('resume', 'Cerrar (F2)')}
      </nav>`;
  }

  // ---------------------------------------------------------------- Administración (F4)
  /**
   * Menú de administración: barreras de la Defensa (todas o por barrio),
   * plano de la ciudad (clic para ir) y lista de destinos.
   * @param {object} state { mapName, admin (API del mapa o null), waypoints, player, district }
   */
  renderAdmin(state) {
    const body = this.$('admin-body');
    const adm = state.admin;
    const btn = (action, label, extra = '', cls = '') => `<button class="menu-btn ${cls}" data-action="${action}" ${extra}><span class="btn-title">${label}</span></button>`;
    if (!adm) {
      body.innerHTML = `
        <p class="note">Las barreras de la Defensa solo existen en Ibaia, la ciudad. Estás en ${escapeHtml(state.mapName || 'el menú')}.</p>
        <nav class="menu-list compact row">${btn('adm-city', 'Ir a Ibaia')}${btn('resume', 'Cerrar (F4)')}</nav>`;
      return;
    }
    const city = adm.city;
    const down = city.districts.filter((d) => adm.barriers.isDown(d.id)).length;
    const rows = city.districts.map((d, i) => {
      const isDown = adm.barriers.isDown(d.id);
      return `<button class="adm-barrier${isDown ? ' down' : ''}" data-action="adm-barrier" data-id="${d.id}" style="--mk:${d.color}">
        <span class="adm-n">${i + 1}</span>
        <span class="adm-name">${escapeHtml(d.name)}<small>${escapeHtml(d.area)} · ${escapeHtml(d.markName)}</small></span>
        <span class="adm-state">${isDown ? 'Bajada' : 'Levantada'}</span>
      </button>`;
    }).join('');
    const here = state.district ? `${escapeHtml(state.district.name)} · ` : '';
    const wps = state.waypoints.filter((w) => !w.anchor).map((w) => btn('adm-travel', escapeHtml(w.name), `data-wp="${escapeHtml(w.id)}"`)).join('');
    const anchors = state.waypoints.filter((w) => w.anchor).map((w) => btn('adm-travel', escapeHtml(w.name), `data-wp="${escapeHtml(w.id)}"`)).join('');
    body.innerHTML = `
      <div class="adm-grid">
        <figure class="adm-map">
          <canvas id="admin-map" aria-label="Plano de Ibaia: clic para ir a ese punto"></canvas>
          <figcaption id="admin-map-cap">${here}${Math.round(state.player.x)}, ${Math.round(state.player.z)} · Clic en el plano para ir allí</figcaption>
        </figure>
        <div class="adm-side">
          <h3>Barreras de la Defensa <span class="adm-count">${down}/10 bajadas</span></h3>
          <div class="dbg-row">${btn('adm-all-down', 'Bajar todas', '', 'adm-primary')}${btn('adm-all-up', 'Subir todas')}</div>
          <div class="adm-list">${rows}</div>
          <h3>Viajar a</h3>
          <div class="dbg-row">${wps}</div>
          <h3>Anclas</h3>
          <div class="dbg-row">${anchors}</div>
        </div>
      </div>
      <nav class="menu-list compact row">${btn('resume', 'Cerrar (F4)')}${btn('menu', 'Volver al menú')}</nav>`;
    const canvas = this.$('admin-map');
    this._cityMap ??= new CityMap();
    this._cityMap.draw(canvas, adm, state.player);
    const cap = this.$('admin-map-cap');
    const at = (e) => {
      const r = canvas.getBoundingClientRect();
      return this._cityMap.toWorld(city, ((e.clientX - r.left) / r.width) * canvas.width, ((e.clientY - r.top) / r.height) * canvas.height);
    };
    canvas.addEventListener('mousemove', (e) => {
      const p = at(e);
      const d = adm.districtAt(p.x, p.z);
      cap.textContent = `${d ? `${d.name} · ` : adm.landAt(p.x, p.z) ? 'Sierra · ' : 'Agua · '}${Math.round(p.x)}, ${Math.round(p.z)} · Clic para ir`;
    });
    canvas.addEventListener('click', (e) => {
      const p = at(e);
      this.onAction('adm-goto', { x: p.x, z: p.z });
    });
  }

  // ---------------------------------------------------------------- Etapa 6: misión
  /** Panel de objetivos (null lo oculta). */
  setMission(m) {
    const el = this.hud.mission;
    if (!m) {
      el.classList.remove('show');
      this._missionKey = '';
      return;
    }
    const key = JSON.stringify([m.name, m.state, m.detected, m.objectives]);
    if (key !== this._missionKey) {
      this._missionKey = key;
      const status = m.state === 'completed' ? 'Completada' : m.state === 'active' && m.detected ? 'Detectado' : '';
      el.innerHTML = `<div class="m-name"><span>${escapeHtml(m.name)}</span><span class="m-time"></span></div>
        <ul>${m.objectives.map((o) => `<li class="${o.count && o.done >= o.count ? 'done' : ''}"><span>${escapeHtml(o.label)}</span>${o.count ? `<span class="count">${o.done}/${o.count}</span>` : ''}</li>`).join('')}</ul>
        ${status ? `<div class="m-status">${status}</div>` : ''}`;
      el.classList.add('show');
    }
    const t = el.querySelector('.m-time');
    const txt = m.state === 'inactive' ? '' : formatTime(m.time);
    if (t && t.textContent !== txt) t.textContent = txt;
  }

  /**
   * Marcadores de ubicación: proyecta cada punto en pantalla; si queda fuera
   * (o detrás de la cámara) se fija al borde con una flecha hacia él.
   */
  updateMarkers(list, camera, from) {
    const root = this.hud.markers;
    while (this._markerEls.length < list.length) {
      const el = document.createElement('div');
      el.className = 'marker';
      el.innerHTML = '<div class="arrow"></div><div class="gem"></div><span class="label"></span>';
      root.appendChild(el);
      this._markerEls.push(el);
    }
    const W = window.innerWidth;
    const H = window.innerHeight;
    this._markerEls.forEach((el, i) => {
      const m = list[i];
      el.style.display = m ? '' : 'none';
      if (!m) return;
      const v = this._v.set(m.x, m.y, m.z).project(camera);
      const behind = v.z > 1;
      let x = (v.x * 0.5 + 0.5) * W;
      let y = (-v.y * 0.5 + 0.5) * H;
      // Márgenes: la etiqueta no se corta y no tapa el HUD inferior
      const padX = 80;
      const top = 60;
      const bottom = H - 130;
      if (behind) {
        x = W - x;
        y = bottom;
      }
      const edge = behind || x < padX || x > W - padX || y < top || y > bottom;
      x = Math.min(W - padX, Math.max(padX, x));
      y = Math.min(bottom, Math.max(top, y));
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.className = `marker ${m.kind ?? ''}${edge ? ' edge' : ''}`;
      if (edge) {
        const ang = Math.atan2(y - H / 2, x - W / 2) + Math.PI / 2;
        el.querySelector('.arrow').style.transform = `rotate(${ang}rad)`;
      }
      const d = from ? Math.round(Math.hypot(m.x - from.x, m.y - 2.6 - from.y, m.z - from.z)) : null;
      el.querySelector('.label').textContent = `${m.label}${d !== null ? ` · ${d} m` : ''}`;
    });
  }

  renderMissionComplete(st) {
    this.$('mission-title').textContent = st.name;
    const rows = [
      ['Tiempo', `${formatTime(st.time)}${st.newBest ? ' · ¡mejor marca!' : ''}`],
      ['Mejor tiempo', st.best !== null ? formatTime(st.best) : '—'],
      ...st.objectives.map((o) => {
        const i = o.lastIndexOf(':');
        return [o.slice(0, i), o.slice(i + 1).trim()];
      }),
      ['Daño recibido', `${st.damage}`],
      ['Detectado', st.detected ? 'Sí' : 'No (sigilo)'],
      ...(st.xp ? [['Experiencia', `+${st.xp} EXP`]] : []),
    ];
    this.$('mission-stats').innerHTML = rows.map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join('');
  }

  /** Botones de la historia: «Continuar» con el último punto de control o «Prólogo». */
  _renderMenuStory() {
    const st = this.save.data.story;
    const title = this.$('menu-story-title');
    if (!title) return;
    const cont = !!st?.started && !st.completed;
    const cp = cont ? checkpoint(st.checkpoint) : null;
    title.textContent = cont ? 'Continuar historia' : 'Historia · Prólogo';
    this.$('menu-story-sub').textContent = cont
      ? `${STORY_MISSIONS[cp?.mission] ?? ''} · ${cp?.title ?? ''}`
      : st?.completed ? 'Prólogo completado · volver a jugarlo' : 'La última noche en el pueblo costero';
    this.$('menu-story-new').classList.toggle('show', cont);
  }

  /** En la historia, «Reiniciar» vuelve al último punto de control. */
  setStoryPause(on, canSkip = false) {
    const t = this.screens.pause?.querySelector('[data-action="restart"] .btn-title');
    if (t) t.textContent = on ? 'Reiniciar desde el punto de control' : 'Reiniciar mapa';
    // «Saltar escena» solo durante una cinemática de la historia
    this.screens.pause?.querySelector('[data-action="skip-scene"]')?.classList.toggle('hidden', !canSkip);
  }

  _renderMenuMissions() {
    const rec = this.save.data.profile.missions?.['op-distrito-cero'];
    const el = this.$('menu-mission-done');
    if (el) el.textContent = rec?.completed ? `✓ ${formatTime(rec.bestTime ?? 0)}` : '';
  }

  _updateFaction(f) {
    const el = this.hud.faction;
    if (!f) {
      if (this._factionKey) el.classList.remove('show');
      this._factionKey = '';
      return;
    }
    const key = `${f.level.id}|${Math.round(f.hostility)}`;
    if (key === this._factionKey) return;
    this._factionKey = key;
    el.className = `hud-faction show ${f.level.id}`;
    el.querySelector('.fac-name').textContent = `${f.name} · ${f.level.name}`;
    el.querySelector('.fac-fill').style.width = `${Math.round(f.hostility)}%`;
  }

  setBoundsWarning(text) {
    const el = this.hud.bounds;
    if (text) el.textContent = text;
    el.classList.toggle('show', !!text);
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
    const aa = this.$('set-aa');
    const ao = this.$('set-ao');
    const refl = this.$('set-refl');
    aa.addEventListener('change', () => apply({ antialias: aa.checked }));
    const auto = this.$('set-auto');
    auto.addEventListener('change', () => apply({ autoQuality: auto.checked }));
    refl.addEventListener('change', () => apply({ reflections: refl.checked }));
    ao.addEventListener('change', () => apply({ ao: ao.checked }));
    for (const [id, key] of [['set-scale', 'renderScale'], ['set-vol', 'volumeMaster'], ['set-sfx', 'volumeSfx'], ['set-amb', 'volumeAmbience']]) {
      const el = this.$(id);
      el.addEventListener('input', () => apply({ [key]: Number(el.value) }));
    }
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
    this.$('set-aa').checked = s.antialias !== false;
    this.$('set-auto').checked = s.autoQuality !== false;
    this.$('set-ao').checked = !!s.ao;
    this.$('set-refl').checked = s.reflections !== false;
    const pct = (v) => `${Math.round(v * 100)}%`;
    for (const [id, out, key] of [['set-scale', 'out-scale', 'renderScale'], ['set-vol', 'out-vol', 'volumeMaster'], ['set-sfx', 'out-sfx', 'volumeSfx'], ['set-amb', 'out-amb', 'volumeAmbience']]) {
      this.$(id).value = s[key];
      this.$(out).textContent = pct(s[key]);
    }
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

function formatTime(sec) {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
