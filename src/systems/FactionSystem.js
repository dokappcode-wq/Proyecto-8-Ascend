import { Reputation, FACTIONS } from '../factions/Reputation.js';

/**
 * FactionSystem — reacción básica de hostilidad de la PDC.
 *
 * - Dañar o neutralizar agentes, o usar poderes a la vista de la PDC, sube
 *   su hostilidad (reglas en factions/Reputation.js).
 * - Tranquila: la PDC ignora al jugador. Vigilante: le observa. Hostil: le
 *   ataca, y toda la PDC del mapa recibe el aviso por radio.
 * - Si ningún agente le ve durante un rato, la hostilidad baja.
 * - Cada mapa fija su hostilidad base (`factions` en la definición): el
 *   Campo de Pruebas es un simulacro en el que la PDC siempre ataca.
 * Los Acólitos (y cualquier otra facción) atacan siempre.
 */
export class FactionSystem {
  constructor(game) {
    this.game = game;
    this.reputation = new Reputation();
    this.enabled = false; // ¿el mapa muestra la reputación en el HUD?
    this._powerSeenCd = 0;
    const g = game;

    g.enemies.attitude = (faction) => {
      if (faction !== 'pdc') return 'hostile';
      return this.reputation.level('pdc').id === 'hostile' ? 'hostile' : this.reputation.level('pdc').id;
    };

    g.events.on('combat:damage', (d) => {
      if (d.faction !== 'player' || d.target?.type?.faction !== 'pdc') return;
      this._apply(this.reputation.report(d.killed ? 'pdc:killed' : 'pdc:attacked'));
    });
    g.events.on('power:used', () => {
      if (this._powerSeenCd > 0 || !g.enemies.seenBy('pdc')) return;
      this._powerSeenCd = 1;
      this._apply(this.reputation.report('pdc:power-seen'));
    });
    g.events.on('map:loaded', ({ id }) => {
      const def = g.mapManager.maps.get(id);
      this.reputation.reset(def?.factions ?? {});
      this.enabled = !!def?.reputation;
    });
  }

  get pdcLevel() {
    return this.reputation.level('pdc');
  }

  update(dt) {
    this._powerSeenCd = Math.max(0, this._powerSeenCd - dt);
    this._apply(this.reputation.update(dt, { pdc: this.game.enemies.seenBy('pdc') }));
  }

  _apply(changes) {
    const g = this.game;
    for (const c of changes) {
      g.events.emit('faction:changed', c);
      const name = FACTIONS[c.faction].name;
      if (c.to === 'hostile') {
        g.ui.toast(`${name}: hostil`, 'Te consideran una amenaza: todos los agentes han recibido el aviso', 2600);
        // Aviso por radio: los agentes cercanos acuden a la posición del jugador
        const p = g.player.motor.position;
        for (const e of g.enemies.alive) {
          if (e.type.faction === c.faction && Math.hypot(e.position.x - p.x, e.position.z - p.z) < 70) e.alertTo(p);
        }
      } else if (c.to === 'watchful' && c.from === 'calm') {
        g.ui.toast(`${name}: vigilante`, 'Te han visto usar poderes', 2000);
      } else if (c.to === 'calm') {
        for (const e of g.enemies.alive) if (e.type.faction === c.faction) e.forgetTarget();
        g.ui.toast(`${name}: tranquila`, 'Han perdido tu rastro', 2000);
      }
    }
  }
}
