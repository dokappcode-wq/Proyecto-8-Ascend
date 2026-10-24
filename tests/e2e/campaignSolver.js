/**
 * «Jugador automático» de la campaña de la ciudad para las pruebas e2e. Se
 * instala en la página (window.__solver) y, cada pocas décimas, hace lo que
 * pide la misión en curso: va al marcador, pulsa E, elige la primera
 * opción, neutraliza a los enemigos de la misión, sube a los vehículos,
 * pasa por los aros, dispara a las cajas de empalme en orden, se queda en
 * las zonas que hay que mantener y sigue a quien hay que seguir.
 * No hace trampas con el resultado: la misión decide si se ha cumplido.
 */
export function installSolver() {
  const a = window.__ascend;
  const C = a.city;
  const S = (window.__solver = { on: false, acts: 0, log: [] });
  const tp = (x, y, z) => {
    const m = a.player.motor;
    m.position.x = x;
    m.position.y = y;
    m.position.z = z;
    m.velocity.x = m.velocity.y = m.velocity.z = 0;
  };
  const near = (p, x, z) => Math.hypot(p.x - x, p.z - z);
  const dist = (p) => near(a.player.motor.position, p.x, p.z);
  const ground = (x, z) => Math.max(0, a.world.groundHeight(x, z, 0.4, 400)) + 0.05;
  /** Punto libre (suelo de calle) junto a q: no encima de la cabina ni del accesorio. */
  const beside = (q, r = 1.3) => {
    for (const rr of [r, r + 0.8, r + 1.6, r + 2.6]) {
      for (let k = 0; k < 8; k++) {
        const x = q.x + Math.cos(k * 0.785) * rr;
        const z = q.z + Math.sin(k * 0.785) * rr;
        if (a.world.groundHeight(x, z, 0.4, (q.y ?? 0) + 1.5) <= (q.y ?? 0) + 0.3) return { x, y: Math.max(0, a.world.groundHeight(x, z, 0.4, (q.y ?? 0) + 1.5)) + 0.05, z };
      }
    }
    return { x: q.x, y: ground(q.x, q.z), z: q.z };
  };
  const vehicles = () => C._props.filter((p) => p.path && p.roofPoint);
  const step = () => {
    if (!S.on || !C.active || a.state !== 'playing') return;
    const m = C.mission;
    if (!m) return;
    // Elecciones: la primera opción
    if (C.modal && C.ui._choice) {
      C.ui._pick(S.pick ?? 0);
      return;
    }
    if (C.controlsLocked || C._loading) return;
    const p = a.player.motor.position;
    const obj = C._obj?.text ?? '';
    // Enemigos de la misión: fuera
    for (const e of a.enemies.alive) if (e.tag === 'mision' && dist(e.position) < 400) e.takeDamage(9999, { kind: 'test' });
    // Cajas de empalme (en orden de creación: es el orden del circuito)
    // (en un vehículo, solo las que quedan a tiro, como haría un jugador)
    const riding = vehicles().some((v) => v.riding);
    const boxes = C._props.filter((x) => x.onHit && x.setState && x.state !== 'on' && (!riding || dist(x.position) < 45));
    if (boxes.length && /caja|letras|Restablece|Carga las cajas|empalme/i.test(obj + JSON.stringify(C._obj?.extra ?? ''))) {
      boxes[0].onHit(boxes[0]);
      return;
    }
    // Bajar del vehículo: al suelo, junto a la vía
    if (/Baja del/.test(obj)) {
      const v0 = vehicles()[0];
      if (v0?.riding || p.y > 13) {
        const s = beside({ x: p.x, y: 0, z: p.z }, 8);
        tp(s.x, s.y, s.z);
      }
      return;
    }
    // Vehículos: subirse al techo y quedarse
    const v = vehicles()[0];
    if (v && /tranvía|tren|Tren|techo|freno|Línea 0|furgón|Alcanza/i.test(obj)) {
      if (/furgón|Alcanza/.test(obj)) {
        const q = v.roofPoint(-v.length / 2 - 1.2);
        tp(q.x, 0.05, q.z);
      } else if (!v.riding) {
        const q = v.roofPoint(v.kind === 'train' ? 8 : 0);
        tp(q.x, v.roofY + 0.05, q.z);
        a.player.motor.grounded = true;
      }
      // Barricadas delante: romperlas
      for (const b of C._props) if (b.health !== undefined && b.alive && b.takeDamage && dist(b.position) < 60) b.takeDamage(999);
    }
    // Escolta: junto a quien hay que escoltar
    if (/Escolta|Protege/.test(obj) && C.markers[0]) {
      const t = C.markers[0];
      if (near(p, t.x, t.z) > 6) {
        const s = beside({ x: t.x, y: 0, z: t.z }, 3);
        tp(s.x, s.y, s.z);
      }
      return;
    }
    // Seguimiento: a 30 m detrás de quien hay que seguir
    if (/Sigue|Síguele/.test(obj) && C.markers[0]) {
      const t = C.markers[0];
      const d = near(p, t.x, t.z);
      if (d > 40 || d < 15) {
        const k = 28 / Math.max(1, d);
        tp(t.x + (p.x - t.x) * k, ground(t.x + (p.x - t.x) * k, t.z + (p.z - t.z) * k), t.z + (p.z - t.z) * k);
      }
      return;
    }
    // Fotos: acercarse a cada agente y hacerle la foto (apuntar con el ratón no se puede simular)
    if (C._photo) {
      const n = C._photo.targets.find((t) => t.agent && !t.photographed);
      if (n) {
        tp(n.position.x + 12, ground(n.position.x + 12, n.position.z), n.position.z);
        C._photo.shoot(n);
        return;
      }
    }
    // Cámaras: romper una que ninguna otra esté mirando, llegando por detrás
    const cams = C.stealth?.guards?.filter((c) => c.inCone && c.active) ?? [];
    if (cams.length) {
      const free = cams.find((c) => !cams.some((o) => o !== c && o.inCone(c.position)));
      if (!free) return;
      const bx = free.position.x - Math.sin(free.yaw) * 1.6;
      const bz = free.position.z - Math.cos(free.yaw) * 1.6;
      tp(bx, ground(bx, bz), bz);
      const it = C._interactions.find((x) => x.position && Math.hypot(x.position.x - free.position.x, x.position.z - free.position.z) < 0.5);
      for (const g of C.stealth.guards) g.meter = 0;
      it?.onInteract();
      return;
    }
    // Interacciones disponibles (E): la más cercana
    // Solo las de la misión (las fuentes de recarga también usan E)
    const its = C._interactions.filter((it) => a.interactions.list.includes(it) && (!it.enabled || it.enabled()));
    if (its.length) {
      let best = null;
      for (const it of its) {
        const q = it.getPosition ? it.getPosition() : it.position;
        if (!q) continue;
        const d = near(p, q.x, q.z);
        if (!best || d < best.d) best = { it, q, d };
      }
      if (best && !(best.it.label && /Empezar/.test(typeof best.it.label === 'function' ? best.it.label() : best.it.label))) {
        const r = Math.min(1.6, (best.it.radius ?? 2) * 0.6);
        // Como InteractionSystem: distancia 3D desde los pies
        if (Math.hypot(p.x - best.q.x, p.y - best.q.y, p.z - best.q.z) > (best.it.radius ?? 2) - 0.2) {
          let s;
          if (best.q.y > 2.5) {
            // En alto (techo de un vehículo, una torre): de pie sobre lo que haya allí
            const gh = a.world.groundHeight(best.q.x, best.q.z, 0.4, best.q.y + 0.5);
            s = { x: best.q.x, y: gh > best.q.y - 2 ? gh + 0.05 : best.q.y + 0.05, z: best.q.z };
          } else s = beside({ x: best.q.x, y: best.q.y - 1, z: best.q.z }, r);
          tp(s.x, s.y, s.z);
        } else {
          best.it.onInteract();
          S.acts++;
        }
        return;
      }
    }
    // Marcador: ir allí (los aros, a su altura)
    const mk = C.markers[0];
    if (mk) {
      const y = mk.y - 2.4;
      const ring = C._props.find((r) => r.passed && r.state === 'next');
      if (ring) {
        tp(ring.position.x, ring.position.y - 1, ring.position.z);
        return;
      }
      if (near(p, mk.x, mk.z) > 2.5 || p.y < y - 1.5) {
        const s = y > 1 ? { x: mk.x + 0.4, y: y + 0.1, z: mk.z } : beside({ x: mk.x, y: 0, z: mk.z }, 0.8);
        tp(s.x, s.y, s.z);
      }
      return;
    }
    // Buzón muerto: el paquete escondido
    const pkg = C._props.find((x) => x.halo === undefined && x.object3d && x.position && /Encuentra/.test(obj));
    if (pkg) tp(pkg.position.x + 1, 0.05, pkg.position.z);
  };
  S.timer = setInterval(step, 250);
}
