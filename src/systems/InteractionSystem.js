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
   * @param {object} o { position: {x,y,z}, radius=2, label, onInteract() }
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
      for (const it of this.list) {
        const d = Math.hypot(it.position.x - p.x, it.position.y - p.y, it.position.z - p.z);
        if (d <= it.radius && d < bestD) {
          best = it;
          bestD = d;
        }
      }
    }
    if (best !== this.current) {
      this.current = best;
      g.ui.setPrompt(best ? best.label : null);
    }
    if (best && g.input.wasPressed('interact')) best.onInteract();
  }
}
