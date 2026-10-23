/**
 * Plano de Ibaia para el menú de administración: agua, sierra, barrios con
 * el color de su marca, edificios, avenidas, puentes y tren elevado (la base
 * se dibuja una vez por carga del mapa); encima, las barreras (ámbar si
 * están levantadas, discontinuas si están bajadas), las Anclas y el jugador.
 * Un clic en el plano lleva a ese punto.
 */
const W = 760;
const AMBER = '#ffb547';

export class CityMap {
  constructor() {
    this._base = null;
    this._for = null;
  }

  /** Escala y origen del plano (metros → píxeles). */
  frame(city) {
    const [x0, z0, x1, z1] = city.frame;
    const s = W / (x1 - x0);
    return { x0, z0, s, w: W, h: Math.round((z1 - z0) * s) };
  }

  toWorld(city, px, py) {
    const f = this.frame(city);
    return { x: f.x0 + px / f.s, z: f.z0 + py / f.s };
  }

  _baseFor(admin) {
    if (this._for === admin && this._base) return this._base;
    const city = admin.city;
    const f = this.frame(city);
    const c = document.createElement('canvas');
    c.width = f.w;
    c.height = f.h;
    const g = c.getContext('2d');
    const X = (x) => (x - f.x0) * f.s;
    const Z = (z) => (z - f.z0) * f.s;
    // Agua y tierra (máscara)
    const img = g.createImageData(f.w, f.h);
    const water = [24, 52, 74];
    const land = [52, 58, 44];
    for (let j = 0; j < f.h; j++) {
      for (let i = 0; i < f.w; i++) {
        const x = f.x0 + (i + 0.5) / f.s;
        const z = f.z0 + (j + 0.5) / f.s;
        const col = admin.landAt(x, z) ? land : water;
        const k = (j * f.w + i) * 4;
        img.data[k] = col[0];
        img.data[k + 1] = col[1];
        img.data[k + 2] = col[2];
        img.data[k + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    // Barrios: fondo urbano teñido con el color de su marca
    for (const d of city.districts) {
      g.beginPath();
      for (const r of d.outline) ring(g, r, X, Z);
      g.fillStyle = '#3b4049';
      g.fill();
      g.globalAlpha = 0.2;
      g.fillStyle = d.color;
      g.fill();
      g.globalAlpha = 1;
    }
    // Edificios (un solo trazado)
    const B = admin.data.buildings;
    g.beginPath();
    for (let i = 0; i < B.n; i++) {
      const ux = Math.cos(B.ang[i]);
      const uz = Math.sin(B.ang[i]);
      const hw = B.hw[i];
      const hd = B.hd[i];
      const cx = B.cx[i];
      const cz = B.cz[i];
      g.moveTo(X(cx - hw * ux + hd * uz), Z(cz - hw * uz - hd * ux));
      g.lineTo(X(cx + hw * ux + hd * uz), Z(cz + hw * uz - hd * ux));
      g.lineTo(X(cx + hw * ux - hd * uz), Z(cz + hw * uz + hd * ux));
      g.lineTo(X(cx - hw * ux - hd * uz), Z(cz - hw * uz + hd * ux));
      g.closePath();
    }
    g.fillStyle = 'rgba(150,158,172,0.55)';
    g.fill();
    // Avenidas y autopistas
    for (const r of city.roads) {
      g.beginPath();
      for (let k = 1; k < r.length; k += 2) (k === 1 ? g.moveTo : g.lineTo).call(g, X(r[k]), Z(r[k + 1]));
      g.strokeStyle = r[0] ? 'rgba(232,206,140,0.9)' : 'rgba(210,214,222,0.45)';
      g.lineWidth = r[0] ? 1.6 : 0.9;
      g.stroke();
    }
    // Puentes y tren elevado
    for (const b of city.bridges) {
      g.beginPath();
      b.pts.forEach((p, k) => (k ? g.lineTo(X(p[0]), Z(p[1])) : g.moveTo(X(p[0]), Z(p[1]))));
      g.strokeStyle = '#e6e0d0';
      g.lineWidth = 2.2;
      g.stroke();
    }
    g.setLineDash([3, 2]);
    for (const l of city.rail.lines) {
      g.beginPath();
      l.forEach((p, k) => (k ? g.lineTo(X(p[0]), Z(p[1])) : g.moveTo(X(p[0]), Z(p[1]))));
      g.strokeStyle = 'rgba(255,255,255,0.5)';
      g.lineWidth = 1;
      g.stroke();
    }
    g.setLineDash([]);
    this._base = c;
    this._for = admin;
    return c;
  }

  /** Dibuja el plano con el estado actual. */
  draw(canvas, admin, player) {
    const city = admin.city;
    const f = this.frame(city);
    canvas.width = f.w;
    canvas.height = f.h;
    const g = canvas.getContext('2d');
    g.drawImage(this._baseFor(admin), 0, 0);
    const X = (x) => (x - f.x0) * f.s;
    const Z = (z) => (z - f.z0) * f.s;
    // Barreras
    for (const d of city.districts) {
      const down = admin.barriers.isDown(d.id);
      g.beginPath();
      for (const r of d.barrier) ring(g, r, X, Z);
      g.setLineDash(down ? [4, 4] : []);
      g.strokeStyle = down ? 'rgba(255,181,71,0.35)' : AMBER;
      g.lineWidth = down ? 1 : 2;
      if (!down) {
        g.shadowColor = AMBER;
        g.shadowBlur = 6;
      }
      g.stroke();
      g.shadowBlur = 0;
    }
    g.setLineDash([]);
    // Nombres de los barrios
    g.font = '600 13px Rajdhani, Arial Narrow, Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const d of city.districts) {
      const x = X(d.label.x);
      const y = Z(d.label.z);
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(8,12,18,0.85)';
      g.strokeText(d.name.toUpperCase(), x, y);
      g.fillStyle = '#eef2f8';
      g.fillText(d.name.toUpperCase(), x, y);
    }
    // La PDC: puestos (cuadrados azules), campamentos de Acólitos (violeta) y enemigos de la zona (rojo)
    const pop = admin.population;
    if (pop?.enabled) {
      for (const gr of pop.groups) {
        if (gr.kind !== 'post' && gr.kind !== 'acolytes') continue;
        g.fillStyle = gr.kind === 'post' ? '#3ac8ff' : '#b45cff';
        g.fillRect(X(gr.x) - 2.5, Z(gr.z) - 2.5, 5, 5);
      }
      g.fillStyle = '#ff4a3a';
      for (const e of pop.units) g.fillRect(X(e.position.x) - 1.5, Z(e.position.z) - 1.5, 3, 3);
    }
    // Anclas
    for (const a of admin.anchors.items) {
      const x = X(a.x);
      const y = Z(a.z);
      g.beginPath();
      g.moveTo(x, y - 6);
      g.lineTo(x + 4.5, y);
      g.lineTo(x, y + 6);
      g.lineTo(x - 4.5, y);
      g.closePath();
      g.fillStyle = a.broken ? '#5a4a34' : AMBER;
      g.fill();
      g.strokeStyle = '#120c04';
      g.lineWidth = 1;
      g.stroke();
    }
    // Jugador: flecha hacia donde mira
    if (player) {
      const x = X(player.x);
      const y = Z(player.z);
      const a = player.facing ?? 0;
      const fx = Math.sin(a);
      const fz = Math.cos(a);
      g.beginPath();
      g.moveTo(x + fx * 11, y + fz * 11);
      g.lineTo(x - fx * 6 + fz * 6, y - fz * 6 - fx * 6);
      g.lineTo(x - fx * 3, y - fz * 3);
      g.lineTo(x - fx * 6 - fz * 6, y - fz * 6 + fx * 6);
      g.closePath();
      g.fillStyle = '#2f8bff';
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = '#ffffff';
      g.stroke();
    }
  }
}

function ring(g, r, X, Z) {
  for (let i = 0; i < r.length; i += 2) (i ? g.lineTo : g.moveTo).call(g, X(r[i]), Z(r[i + 1]));
  g.closePath();
}
