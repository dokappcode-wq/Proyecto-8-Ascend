/**
 * InteractionSystem — objetos con los que se interactúa con E cuando el
 * jugador está cerca (muestra un aviso en pantalla). Base para la estación
 * de adquisición de marcas de la Etapa 4.
 */
export class InteractionSystem {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.current = null;
  }

  /**
   * @param {object} o { position | getPosition(), radius=2, label (texto o función),
   *   enabled?() (por defecto siempre), onInteract() }
   * @returns {object} el interactuable (para poder quitarlo)
   */
  add(o) {
    const it = { radius: 2, ...o };
    this.list.push(it);
    return it;
  }

  remove(it) {
    this.list = this.list.filter((x) => x !== it);
  }

  clear() {
    this.list.length = 0;
    this.current = null;
    this.game.ui.setPrompt(null);
  }

  update() {
    const g = this.game;
    const p = g.player.motor.position;
    let best = null;
    let bestD = Infinity;
    if (!g.playerCombat.dead) {
      if (g.acquisition?.active || g.drain?.active) return; // gestionan su propio aviso
      for (const it of this.list) {
        if (it.enabled && !it.enabled()) continue;
        const pos = it.getPosition ? it.getPosition() : it.position;
        const d = Math.hypot(pos.x - p.x, pos.y - p.y, pos.z - p.z);
        if (d <= it.radius && d < bestD) {
          best = it;
          bestD = d;
        }
      }
    }
    const label = best ? (typeof best.label === 'function' ? best.label() : best.label) : null;
    if (best !== this.current || label !== this._label) {
      this.current = best;
      this._label = label;
      g.ui.setPrompt(label);
    }
    if (best && g.input.wasPressed('interact')) best.onInteract();
  }
}
