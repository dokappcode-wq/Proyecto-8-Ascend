/**
 * Prueba e2e de Ibaia, la ciudad. La llama smoke.mjs en una pestaña nueva.
 * Carga el mapa desde el menú, comprueba que Jon llega al Distrito Cero, que
 * la barrera de la Defensa le frena, que el menú de administración (F4) baja
 * y sube las barreras (y lo guarda), que el plano lleva a otro barrio y que
 * caer al agua devuelve a la orilla.
 */
import path from 'node:path';

export async function citySection({ page, check, PORT, out }) {
  const g = (fn, arg) => page.evaluate(fn, arg);
  const until = (fn, arg, timeout = 60000) => page.waitForFunction(fn, arg, { timeout, polling: 200 }).then(() => true).catch(() => false);
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__ascend);
  await page.evaluate(() => window.addEventListener('mousemove', (e) => e.stopImmediatePropagation(), true));
  // Render ligero: la ciudad entera en render por software va a 1–2 fps
  await g(() => {
    const a = window.__ascend;
    Object.assign(a.save.settings, { shadows: false, bloom: false, reflections: false, antialias: false, renderScale: 0.5, autoQuality: false });
    a._applySettings(a.save.settings);
    a.save.data.debug.cityBarriers = {};
    a.save.save();
  });

  check(await page.isVisible('[data-map="ibaia"]'), 'Menú: botón «Ibaia · La ciudad»');
  const t0 = Date.now();
  await page.click('[data-map="ibaia"]');
  const loaded = await until(() => window.__ascend.state === 'playing' && window.__ascend.mapManager.current?.def.id === 'ibaia', null, 180000);
  check(loaded, `Ibaia carga (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  if (!loaded) return;
  const info = await g(() => {
    const a = window.__ascend;
    const cur = a.mapManager.current;
    const adm = cur.admin;
    const p = a.player.motor.position;
    return {
      district: adm.districtAt(p.x, p.z)?.id, land: adm.landAt(p.x, p.z), buildings: adm.buildings, obb: a.world.obbSets[0]?.n ?? 0,
      up: adm.barriers.items.filter((b) => !b.down).length, sources: adm.sources.length, far: a.camera.far, wps: cur.waypoints.length,
    };
  });
  check(info.district === 'cero' && info.land, `Jon llega al Distrito Cero por la Autovía de la Sierra (${info.district})`);
  check(info.buildings > 30000 && info.obb > 30000, `La ciudad entera: ${info.buildings} edificios y ${info.obb} colisionadores`);
  check(info.up === 10, 'Las diez barreras de la Defensa empiezan levantadas');
  check(info.far >= 5000, `Cámara de largo alcance en la ciudad (${info.far} m)`);
  check(info.sources >= 50 && info.wps === 21, `Fuentes de recarga (${info.sources}) y destinos de viaje (${info.wps})`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(out, 'ibaia-01-llegada.png') });

  // Andar por la calle con el teclado real
  const p0 = await g(() => ({ ...window.__ascend.player.motor.position }));
  await page.keyboard.down('KeyW');
  await page.keyboard.down('ShiftLeft');
  await page.waitForTimeout(2500);
  await page.keyboard.up('ShiftLeft');
  await page.keyboard.up('KeyW');
  const p1 = await g(() => ({ ...window.__ascend.player.motor.position }));
  check(Math.hypot(p1.x - p0.x, p1.z - p0.z) > 1.5, `Jon se mueve por la calle (${Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(1)} m)`);

  // Un tramo de la barrera del Distrito Cero con la calle libre a ambos lados
  const spot = await g(() => {
    const a = window.__ascend;
    const cero = a.mapManager.current.admin.city.districts.find((d) => d.id === 'cero');
    const r = cero.barrier[0];
    const w = a.world;
    for (let i = 0; i < r.length; i += 2) {
      const j = (i + 2) % r.length;
      const mx = (r[i] + r[j]) / 2;
      const mz = (r[i + 1] + r[j + 1]) / 2;
      const L = Math.hypot(r[j] - r[i], r[j + 1] - r[i + 1]);
      if (L < 8) continue;
      // Normal del tramo hacia fuera del barrio
      let nx = (r[j + 1] - r[i + 1]) / L;
      let nz = -(r[j] - r[i]) / L;
      if (Math.hypot(mx + nx * 5 - cero.label.x, mz + nz * 5 - cero.label.z) < Math.hypot(mx - cero.label.x, mz - cero.label.z)) {
        nx = -nx;
        nz = -nz;
      }
      const s = { x: mx - nx * 18, y: 0.05, z: mz - nz * 18 };
      if (w.groundHeight(s.x, s.z, 0.6, 50) > 0.01) continue;
      const first = w.raycastHit({ x: s.x, y: 1, z: s.z }, { x: nx, y: 0, z: nz }, 30);
      const beyond = w.raycastHit({ x: s.x, y: 1, z: s.z }, { x: nx, y: 0, z: nz }, 34, { ignoreTags: ['barrier'] });
      if (first?.collider.tag === 'barrier' && !beyond && a.mapManager.current.admin.landAt(mx + nx * 14, mz + nz * 14)) return { s, d: { x: nx, z: nz } };
    }
    return null;
  });
  check(!!spot, 'Hay un tramo de barrera con calle libre a ambos lados');
  if (!spot) return;
  const run = () => g(({ s, d }) => {
    const a = window.__ascend;
    a.player.spawnAt(s);
    const m = a.player.motor;
    for (let i = 0; i < 3.4 * 60; i++) m.update(1 / 60, { moveX: d.x, moveZ: d.z, sprint: true });
    return (m.position.x - s.x) * d.x + (m.position.z - s.z) * d.z;
  }, spot);
  const blocked = await run();
  check(blocked > 10 && blocked < 18, `La barrera levantada frena a Jon (avanza ${blocked.toFixed(1)} m de 18)`);

  // Menú de administración (F4): bajar todas
  await page.keyboard.press('F4');
  const adminOpen = await until(() => document.querySelector('#screen-admin.active #admin-map') && window.__ascend.state === 'paused');
  const rows = await page.locator('.adm-barrier').count();
  check(adminOpen && rows === 10, `F4 abre la administración: plano y ${rows} barreras`);
  await page.screenshot({ path: path.join(out, 'ibaia-02-administracion.png') });
  await page.click('[data-action="adm-all-down"]');
  const allDown = await until(() => window.__ascend.mapManager.current.admin.barriers.items.every((b) => b.down) && Object.keys(window.__ascend.save.data.debug.cityBarriers).length === 10);
  check(allDown, '«Bajar todas» baja las diez barreras y se guarda');
  check(await page.isVisible('.adm-barrier.down'), 'La lista marca las barreras como bajadas');
  await page.keyboard.press('F4');
  await until(() => window.__ascend.state === 'playing');
  const crossed = await run();
  check(crossed > 25, `Con la barrera bajada Jon cruza al otro lado (${crossed.toFixed(1)} m)`);
  // La barrera se hunde en el suelo
  const sunk = await until(() => window.__ascend.mapManager.current.admin.barriers.items.every((b) => b.level === 0), null, 60000);
  check(sunk, 'Los muros de luz se hunden al bajarlas');

  // Una barrera sola: subir la del Distrito Cero desde su fila
  await page.keyboard.press('F4');
  await until(() => document.querySelector('#screen-admin.active'));
  await page.click('.adm-barrier[data-id="cero"]');
  const ceroUp = await until(() => !window.__ascend.mapManager.current.admin.barriers.isDown('cero') && window.__ascend.save.data.debug.cityBarriers.cero === undefined);
  check(ceroUp, 'Subir solo la barrera del Distrito Cero (las demás siguen bajadas)');
  check(await g(() => window.__ascend.mapManager.current.admin.barriers.items.filter((b) => b.down).length === 9), 'Nueve barreras siguen bajadas');

  // Viajar con el plano: clic sobre Midtown
  const target = await g(() => {
    const a = window.__ascend;
    const d = a.mapManager.current.admin.city.districts.find((x) => x.id === 'midtown');
    const c = document.getElementById('admin-map');
    const r = c.getBoundingClientRect();
    const [x0, z0, x1] = a.mapManager.current.admin.city.frame;
    const s = c.width / (x1 - x0);
    return { x: r.left + (((d.center.x - x0) * s) / c.width) * r.width, y: r.top + (((d.center.z - z0) * s) / c.height) * r.height };
  });
  await page.mouse.click(target.x, target.y);
  const there = await until(() => {
    const a = window.__ascend;
    const p = a.player.motor.position;
    return a.state === 'playing' && a.mapManager.current.admin.districtAt(p.x, p.z)?.id === 'midtown';
  });
  check(there, 'Un clic en el plano lleva a Midtown');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(out, 'ibaia-03-midtown.png') });

  // Al agua: vuelve a la orilla
  const water = await g(() => {
    const a = window.__ascend;
    const br = a.mapManager.current.admin.city.bridges.find((b) => b.name === 'Puente del Este');
    const p = br.pts[Math.floor(br.pts.length / 2)];
    a.player.spawnAt({ x: p[0], y: 0.05, z: p[1] + 40 });
    return a.mapManager.current.admin.landAt(p[0], p[1] + 40);
  });
  check(water === false, 'Jon cae al río junto al Puente del Este');
  const ashore = await until(() => {
    const a = window.__ascend;
    const p = a.player.motor.position;
    return a.mapManager.current.admin.landAt(p.x, p.z) && a.player.motor.grounded;
  }, null, 60000);
  check(ashore, 'Al caer al agua vuelve a la última orilla pisada');

  // Volver a subirlas todas
  await page.keyboard.press('F4');
  await until(() => document.querySelector('#screen-admin.active'));
  await page.click('[data-action="adm-all-up"]');
  const allUp = await until(() => window.__ascend.mapManager.current.admin.barriers.items.every((b) => !b.down) && Object.keys(window.__ascend.save.data.debug.cityBarriers).length === 0);
  check(allUp, '«Subir todas» las vuelve a levantar');
  await page.keyboard.press('F4');
  await until(() => window.__ascend.state === 'playing');
}
