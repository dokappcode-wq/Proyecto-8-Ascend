/**
 * StoryUI — interfaz del modo historia: subtítulos, objetivo, tutoriales,
 * indicador de detección, tarjetas de día, elección, bandas de cine y fundidos.
 * Crea sus propios elementos (no depende del HTML de la página).
 */

const SPEAKER_COLORS = {
  JON: '#9fd0ff',
  IKER: '#9ff2b0',
  ABUELA: '#ffd59a',
  NARBAIZA: '#ff6a6a',
  'MARTÍN': '#e9c46a',
  SISTEMA: '#ff8080',
  AGENTE: '#c7d0dc',
  'AGENTE (RADIO)': '#c7d0dc',
  'SOLDADO (RADIO)': '#c7d0dc',
  'IKER (RECUERDO)': '#c6f2d0',
  'AGENTE 1': '#c7d0dc',
  'AGENTE 2': '#c7d0dc',
  'AGENTE REFORZADO': '#ffae7a',
  SOLDADO: '#c7d0dc',
  DRON: '#7fd8ff',
  DESCONOCIDO: '#8fb8ff',
  VENDEDORA: '#f2b8d0',
  VECINA: '#e8d7b0',
  VECINO: '#e8d7b0',
};

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export class StoryUI {
  constructor(root = document.getElementById('hud')) {
    const el = (id, cls, parent = root) => {
      let e = document.getElementById(id);
      if (!e) {
        e = document.createElement('div');
        e.id = id;
        e.className = cls;
        parent.appendChild(e);
      }
      return e;
    };
    this.bars = el('story-bars', 'story-bars');
    this.bars.innerHTML = '<div class="bar top"></div><div class="bar bottom"></div>';
    this.sub = el('story-sub', 'story-sub');
    this.obj = el('story-obj', 'story-obj');
    this.tut = el('story-tut', 'story-tut');
    this.detect = el('story-detect', 'story-detect');
    this.detect.innerHTML = '<svg viewBox="0 0 40 24" aria-hidden="true"><path d="M2 12C8 3 32 3 38 12C32 21 8 21 2 12Z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="20" cy="12" r="5" fill="currentColor"/></svg><div class="meter"><div class="fill"></div></div>';
    this.day = el('story-day', 'story-day', document.body);
    this.choiceEl = el('story-choice', 'story-choice', document.body);
    this.fadeEl = el('story-fade', 'story-fade', document.body);
    this.fadeEl.innerHTML = '<span></span>';
    this.flashEl = el('story-flash', 'story-flash', document.body);
    // Por encima de los fundidos y las tarjetas: también se puede saltar en negro
    this.skipEl = el('story-skip', 'story-skip', document.body);
    this.skipEl.innerHTML = '<span class="key">Espacio</span><span class="lbl">Mantén para saltar</span><div class="bar"><div class="fill"></div></div>';
    this.skipFill = this.skipEl.querySelector('.fill');
    this.skipCover = el('story-skipping', 'story-skipping', document.body);
    this.skipCover.innerHTML = '<span>Saltando la escena…</span>';
    this._choice = null;
    this._subTimer = null;
    this._tutKey = '';
    this._objKey = '';
    window.addEventListener('keydown', (e) => {
      if (!this._choice) return;
      const i = ['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3'].indexOf(e.code) % 3;
      if (i >= 0 && i < this._choice.options.length) this._pick(i);
    });
    this.choiceEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-choice]');
      if (b && this._choice) this._pick(Number(b.dataset.choice));
    });
  }

  /** Muestra u oculta todo lo del modo historia. */
  setVisible(v) {
    for (const e of [this.sub, this.obj, this.tut, this.detect, this.bars, this.skipEl]) e.classList.toggle('off', !v);
    if (!v) {
      this.subtitle(null);
      this.objective(null);
      this.tutorial(null);
      this.detection(null);
      this.letterbox(false);
      this.skipHint(false);
      this.skipping(false);
      this.fadeTo(0, 0);
    }
  }

  /** Aviso «Mantén Espacio para saltar» con el progreso de la pulsación (0..1). */
  skipHint(visible, progress = 0) {
    this.skipEl.classList.toggle('show', !!visible);
    this.skipFill.style.transform = `scaleX(${Math.max(0, Math.min(1, progress))})`;
  }

  /** Pantalla negra mientras se salta una cinemática. */
  skipping(on) {
    this.skipCover.classList.toggle('show', !!on);
  }

  /** Subtítulo con el nombre de quien habla (null lo oculta). */
  subtitle(speaker, text = '') {
    if (!speaker && !text) {
      this.sub.classList.remove('show');
      return;
    }
    const color = SPEAKER_COLORS[speaker] ?? '#e6edf5';
    this.sub.innerHTML = `${speaker ? `<b style="color:${color}">${esc(speaker)}:</b> ` : ''}<span>${esc(text)}</span>`;
    this.sub.classList.add('show');
  }

  /** Objetivo actual: { mission, text, extra: [líneas], timer }. null lo oculta. */
  objective(o) {
    if (!o) {
      this.obj.classList.remove('show');
      this._objKey = '';
      return;
    }
    const key = JSON.stringify(o);
    if (key === this._objKey) return;
    this._objKey = key;
    this.obj.innerHTML = `${o.mission ? `<div class="o-mission">${esc(o.mission)}</div>` : ''}${o.text ? `<div class="o-text">${esc(o.text)}</div>` : ''}${(o.extra ?? []).map((l) => `<div class="o-extra">${esc(l)}</div>`).join('')}${o.timer ? `<div class="o-timer">${esc(o.timer)}</div>` : ''}`;
    this.obj.classList.add('show');
  }

  /** Tarjeta de tutorial contextual (null la oculta). Las teclas van entre [corchetes]. */
  tutorial(title, text = '') {
    const key = `${title}|${text}`;
    if (!title) {
      this.tut.classList.remove('show');
      this._tutKey = '';
      return;
    }
    if (key === this._tutKey) return;
    this._tutKey = key;
    const fmt = esc(text).replace(/\[([^\]]+)\]/g, '<kbd>$1</kbd>');
    this.tut.innerHTML = `<div class="t-title">${esc(title)}</div><div class="t-text">${fmt}</div>`;
    this.tut.classList.add('show');
  }

  /** Indicador de detección 0..1 (null lo oculta). */
  detection(v) {
    if (v === null || v === undefined || v <= 0.001) {
      this.detect.classList.remove('show');
      return;
    }
    this.detect.classList.add('show');
    this.detect.classList.toggle('alert', v > 0.6);
    this.detect.querySelector('.fill').style.width = `${Math.round(v * 100)}%`;
  }

  /** Bandas negras de cine. */
  letterbox(on) {
    this.bars.classList.toggle('show', on);
  }

  /** Título grande y centrado (DÍA 1…). */
  async dayCard(title, sub = '', ms = 2200) {
    this.day.innerHTML = `<div class="d-title">${esc(title)}</div>${sub ? `<div class="d-sub">${esc(sub)}</div>` : ''}`;
    this.day.classList.add('show');
    await new Promise((r) => setTimeout(r, ms));
    this.day.classList.remove('show');
  }

  /** Fundido a negro (alpha 1) o desde negro (alpha 0) en `ms`. */
  fadeTo(alpha, ms = 600, text = '') {
    this.fadeEl.querySelector('span').textContent = text;
    this.fadeEl.style.transitionDuration = `${ms}ms`;
    this.fadeEl.style.opacity = String(alpha);
    this.fadeEl.classList.toggle('block', alpha > 0.01);
  }

  /** Destello a pantalla completa (rayo, transporte de Energía). */
  flash(color = '#d8ecff', ms = 900) {
    const f = this.flashEl;
    f.style.background = color;
    f.style.transition = 'none';
    f.style.opacity = '1';
    void f.offsetWidth;
    f.style.transition = `opacity ${ms}ms ease-out`;
    f.style.opacity = '0';
  }

  /** Pantalla de elección. Devuelve una promesa con el índice elegido (teclas 1/2 o clic). */
  choice(title, options) {
    this.choiceEl.innerHTML = `<div class="c-title">${esc(title)}</div><div class="c-opts">${options.map((o, i) => `<button class="c-opt${o.danger ? ' danger' : ''}" data-choice="${i}"><kbd>${i + 1}</kbd><b>${esc(o.label)}</b><span>${esc(o.desc ?? '')}</span></button>`).join('')}</div><div class="c-note">Esta decisión no se puede deshacer</div>`;
    this.choiceEl.classList.add('show');
    return new Promise((resolve) => {
      this._choice = { options, resolve };
    });
  }

  get choosing() {
    return !!this._choice;
  }

  _pick(i) {
    const c = this._choice;
    this._choice = null;
    this.choiceEl.classList.remove('show');
    c.resolve(i);
  }

  /** Cierra una elección pendiente (al recargar un punto de control). */
  cancelChoice() {
    if (!this._choice) return;
    this._choice = null;
    this.choiceEl.classList.remove('show');
  }
}
