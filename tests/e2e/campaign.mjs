/**
 * Prueba e2e de la campaña de la ciudad (Distrito Cero). La llama smoke.mjs.
 *
 * Carga Ibaia con la campaña nueva y comprueba la llegada (la primera
 * misión empieza sola, cabina en la plaza, control de la PDC al 100 %).
 * Después un jugador automático (campaignSolver.js) juega las diez misiones
 * de la historia, varias secundarias, una partida de cada actividad y los
 * cuatro sucesos; la prueba comprueba lo que cambia en el mundo: piso
 * franco, torre tomada, decisión de Pello, barrera del Distrito Cero bajada,
 * medallas y control de la PDC. Con CAMPAIGN_FULL=1 juega todas las
 * secundarias.
 */
import path from 'node:path';
import { installSolver } from './campaignSolver.js';

export async function campaignSection({ page, check, PORT, out }) {
  const g = (fn, arg) => page.evaluate(fn, arg);
  const until = (fn, arg, timeout = 60000) => page.waitForFunction(fn, arg, { timeout, polling: 250 }).then(() => true).catch(() => false);
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__ascend);
  await page.evaluate(() => window.addEventListener('mousemove', (e) => e.stopImmediatePropagation(), true));
  await g(() => {
    const a = window.__ascend;
    Object.assign(a.save.settings, { shadows: false, bloom: false, reflections: false, antialias: false, renderScale: 0.4, autoQuality: false });
    a._applySettings(a.save.settings);
    Object.assign(a.save.data.debug, { cityBarriers: {}, cityCampaign: true, invulnerable: true, cityEnemies: false });
    a.save.data.city = null;
    a.save.save();
    location.reload();
  });
  await page.waitForFunction(() => window.__ascend);
  await g(() => {
    const a = window.__ascend;
    a._applySettings(a.save.settings);
    window.__log = [];
    for (const ev of ['city:mission-start', 'city:mission-complete', 'city:fail', 'city:error', 'city:mission-abandon']) a.events.on(ev, (e) => window.__log.push([ev.slice(5), e.id, e.reason ?? e.error ?? '']));
  });
  await page.click('[data-map="ibaia"]');
  const loaded = await until(() => window.__ascend.state === 'playing' && window.__ascend.mapManager.current?.def.id === 'ibaia', null, 180000);
  check(loaded, 'Campaña: Ibaia carga con la campaña');
  if (!loaded) return;
  const arrival = await until(() => window.__ascend.city.mission?.def.id === 'cero-h1', null, 15000);
  const a0 = await g(() => {
    const C = window.__ascend.city;
    const cero = C.districts.get('cero');
    return { active: C.active, booths: cero.world.cabinas.length, km0: !!cero.world.booths.km0, control: C.control('cero'), regs: C.registry.size };
  });
  check(arrival && a0.active, 'Campaña: al llegar empieza sola «El teléfono de la plaza»');
  check(a0.km0 && a0.booths === 8, `Campaña: cabina de la plaza y 8 cabinas de la Centralita (${a0.booths})`);
  check(a0.control === 100 && a0.regs === 30, `Campaña: control de la PDC al 100 % y 30 misiones registradas (${a0.regs})`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(out, 'campana-01-llegada.png') });

  await g(installSolver);
  await g(() => {
    window.__ascend.city.speed = 10;
    window.__solver.on = true;
  });
  const play = async (id, limit = 300, o = {}) => {
    await g(({ id, inst }) => {
      const a = window.__ascend;
      const C = a.city;
      if (C.mission && C.mission.def.id !== id) C.abandon('');
      if (C.mission) return;
      // Como un jugador: se empieza en el marcador de la misión
      const def = C.registry.get(id);
      const at = def.kind === 'act' ? def.spots(C)[inst] : def.where?.(C);
      if (at) a.player.spawnAt({ x: at.x + 1.5, y: a.mapManager.current.admin.landing(at.x + 1.5, at.z).y, z: at.z, yaw: 0 });
      C.start(def, { inst });
    }, { id, inst: o.inst ?? 0 });
    const done = o.act
      ? await until(({ act, inst }) => (window.__ascend.city.state.acts[`${act}-${inst}`] ?? 0) > 0, { act: o.act, inst: o.inst ?? 0 }, limit * 1000)
      : await until((id) => window.__ascend.city.state.done[id], id, limit * 1000);
    if (!done) {
      const info = await g(() => ({ obj: window.__ascend.city._obj?.text, m: window.__ascend.city.mission?.def.id, log: window.__log.slice(-4) }));
      console.log('   ', id, JSON.stringify(info));
      await page.screenshot({ path: path.join(out, `campana-fallo-${id}.png`) });
      await g(() => window.__ascend.city.abandon(''));
    }
    return done;
  };

  // --- Historia completa ---
  const story = ['cero-h1', 'cero-h2', 'cero-h3', 'cero-h4', 'cero-h5', 'cero-h6', 'cero-h7', 'cero-h8', 'cero-h9', 'cero-h10'];
  const titles = await g(() => Object.fromEntries([...window.__ascend.city.registry.values()].map((d) => [d.id, d.title])));
  for (const id of story) {
    const t0 = Date.now();
    const ok = await play(id, 420);
    check(ok, `Historia ${id.slice(6)}: «${titles[id]}» (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    if (id === 'cero-h2') check(await g(() => window.__ascend.city.state.flags.pisoFranco === true), 'Historia: La Catenaria queda como piso franco');
    if (id === 'cero-h4') {
      const t = await g(() => ({ tower: window.__ascend.city.state.towers.cero, control: window.__ascend.city.control('cero') }));
      check(t.tower && t.control === 85, `Historia: torre tomada, control de la PDC al 85 % (${t.control} %)`);
    }
    if (id === 'cero-h8') check(await g(() => window.__ascend.city.state.flags.pello === 'entregado'), 'Historia: la decisión sobre Pello se guarda');
  }
  const end = await g(() => {
    const a = window.__ascend;
    const adm = a.mapManager.current.admin;
    return { down: adm.barriers.isDown('cero'), saved: a.save.data.debug.cityBarriers?.cero, flag: a.city.state.flags['historia:cero'] };
  });
  check(end.down && end.saved && end.flag, 'Historia: al sobrecargar el Ancla cae la barrera del Distrito Cero (y se guarda)');
  await page.screenshot({ path: path.join(out, 'campana-02-final.png') });

  // --- Secundarias ---
  const sides = process.env.CAMPAIGN_FULL ? ['cero-s1', 'cero-s2', 'cero-s3', 'cero-s4', 'cero-s5', 'cero-s6', 'cero-s7', 'cero-s8', 'cero-s9', 'cero-s10'] : ['cero-s3', 'cero-s6', 'cero-s10'];
  for (const id of sides) {
    const t0 = Date.now();
    check(await play(id, 300), `Secundaria: «${titles[id]}» (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }

  // --- Una partida de cada actividad ---
  const acts = [['cero-act-bases', 'cero-base'], ['cero-act-tram', 'cero-tram'], ['cero-act-cabinas', 'cero-cabina'], ['cero-act-cams', 'cero-cams'], ['cero-act-race', 'cero-race'], ['cero-act-drops', 'cero-drop']];
  for (const [id, act] of acts) {
    const t0 = Date.now();
    const ok = await play(id, 360, { act, inst: 0 });
    const medal = await g((k) => window.__ascend.city.state.acts[k] ?? 0, `${act}-0`);
    check(ok, `Actividad: «${titles[id]}» con medalla ${['—', 'de bronce', 'de plata', 'de oro'][medal]} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }

  // --- Sucesos (a velocidad casi normal: el tranvía sin frenos no espera) ---
  await g(() => {
    window.__ascend.city.speed = 2;
  });
  for (const id of ['cero-ev-redada', 'cero-ev-corto', 'cero-ev-tranvia', 'cero-ev-llamada']) {
    const n0 = await g(() => window.__ascend.city.state.events.cero ?? 0);
    await g((id) => {
      const a = window.__ascend;
      const C = a.city;
      if (C.mission) C.abandon('');
      // La llamada perdida suena en una cabina cercana: Jon junto a una
      if (id === 'cero-ev-llamada') {
        const b = C.districts.get('cero').world.cabinas[0].position;
        a.player.spawnAt({ x: b.x + 40, y: a.mapManager.current.admin.landing(b.x + 40, b.z).y, z: b.z, yaw: 0 });
      }
      C.triggerEvent(id);
    }, id);
    const ok = await until((n0) => (window.__ascend.city.state.events.cero ?? 0) > n0, n0, 180000);
    check(ok, `Suceso: «${titles[id]}» resuelto`);
    if (!ok) await g(() => window.__ascend.city.abandon(''));
  }

  const fin = await g(() => ({ control: window.__ascend.city.control('cero'), log: window.__log.filter((l) => l[0] === 'error') }));
  check(fin.control < 85, `Control de la PDC baja con secundarias, actividades y sucesos (${fin.control} %)`);
  check(fin.log.length === 0, `Campaña sin errores de guion${fin.log.length ? `: ${JSON.stringify(fin.log)}` : ''}`);
  await g(() => {
    window.__solver.on = false;
    clearInterval(window.__solver.timer);
  });
}
