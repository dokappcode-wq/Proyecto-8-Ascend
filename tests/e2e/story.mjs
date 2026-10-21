/**
 * Prueba e2e del modo historia (prólogo). La llama smoke.mjs al final, en una
 * pestaña nueva. Recorre los cinco capítulos con el juego real: teletransporta
 * a Jon a los puntos que disparan cada tramo, pulsa las teclas del guion (E, F,
 * 1/2, salto + dash) y comprueba los criterios de aceptación del documento.
 * Los diálogos van 8 veces más rápido (`story.speed`) para acortar la prueba.
 */
export async function storySection({ page, check, PORT, out }) {
  const g = (fn, arg) => page.evaluate(fn, arg);
  const until = (fn, arg, timeout = 60000) => page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => true).catch(() => false);
  const T0 = Date.now();
  const log = (m) => console.log(`  [historia ${((Date.now() - T0) / 1000).toFixed(0)} s] ${m}`);
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__ascend);
  await page.evaluate(() => window.addEventListener('mousemove', (e) => e.stopImmediatePropagation(), true));
  // Render más ligero para que el software aguante los mapas nuevos
  await g(() => { const a = window.__ascend; Object.assign(a.save.settings, { shadows: false, bloom: false, renderScale: 0.5 }); a._applySettings(a.save.settings); });
  check(await page.isVisible('#menu-story'), 'Menú: botón «Historia · Prólogo»');
  await page.click('#menu-story');
  await until(() => window.__ascend.state === 'playing' && window.__ascend.story.active);
  await g(() => {
    const a = window.__ascend;
    a.story.speed = 8;
    window.__ev = [];
    for (const ev of ['story:line', 'story:reload', 'story:checkpoint', 'story:detected', 'story:pinned', 'story:storm', 'story:bought', 'story:choice', 'story:choice-made', 'story:convoy-attacked', 'story:teleport', 'story:debris-broken', 'story:drone', 'story:encounter', 'story:final-dash', 'story:completed', 'story:skip', 'story:destiny', 'story:sphere', 'mark:acquired', 'acquisition:failed', 'enemy:spawned', 'story:error'])
      a.events.on(ev, (d) => window.__ev.push({ ev, d: JSON.parse(JSON.stringify(d, (k, v) => (k === 'enemy' || k === 'target' ? undefined : v))) , cp: a.save.data.story.checkpoint }));
  });
  const has = (ev, pred = '') => until(new Function(`return window.__ev.some((e) => e.ev === ${JSON.stringify(ev)}${pred ? ' && (' + pred + ')' : ''})`));
  const cpIs = (id, timeout) => until((c) => window.__ascend.save.data.story.checkpoint === c, id, timeout);
  const tp = (p) => g((q) => window.__ascend.player.spawnAt(q), p);
  const jump = async (cp) => { await g((c) => window.__ascend.story.jumpTo(c), cp); await until((c) => window.__ascend.save.data.story.checkpoint === c && !window.__ascend.story._loading && window.__ascend.mapManager.current, cp); await page.waitForTimeout(300); };
  log('inicio');
  check(await g(() => window.__ascend.mapManager.current.def.id === 'pueblo-noche' && window.__ascend.save.data.story.checkpoint === 'CP01'), 'Nueva partida: pueblo de noche, CP01');
  check(await g(() => window.__ascend.marks.profile.marks.length === 0 && !window.__ascend.powers.available), 'Jon empieza sin marcas ni poderes');

  {
    console.log('\n[M01]');
    const met = await has('story:line', "e.d.text === 'Vamos.'");
    check(met, 'Reunión en los tejados: diálogo completo de Iker y Jon');
    check(await until(() => !window.__ascend.story.controlsLocked && window.__ascend.save.data.story.mission.objectiveIndex === 1, null, 20000), 'Tras la reunión se guarda CP01 y se devuelve el control');
    check(await g(() => ['attack', 'special', 'charged'].every((x) => window.__ascend.input.blocked.has(x))), 'Sin poderes en M01 (acciones bloqueadas)');
    // Saltar una cinemática (despertar de CP09): mismo resultado que verla entera
    await jump('CP09');
    check(await until(() => window.__ascend.story.canSkip, null, 20000), 'CP09: empieza la cinemática del despertar');
    check(await until(() => getComputedStyle(document.getElementById('story-skip')).opacity > 0.5, null, 5000), 'Aviso «Mantén Espacio para saltar» visible');
    await g(() => window.__ascend.pause());
    check(await page.isVisible('#screen-pause [data-action="skip-scene"]'), 'La pausa ofrece «Saltar escena» durante la cinemática');
    await g(() => window.__ascend.resume());
    await page.keyboard.down('Space');
    check(await until(() => window.__ascend.story.skipping || !window.__ascend.story.controlsLocked, null, 15000), 'Mantener Espacio salta la escena');
    await page.keyboard.up('Space');
    check(await until(() => !window.__ascend.story.skipping && !window.__ascend.story.controlsLocked, null, 30000), 'Tras el salto se recupera el control');
    const skipped = await g(() => { const a = window.__ascend; const p = a.player.motor.position; return { line: window.__ev.some((e) => e.ev === 'story:line' && e.d.text === 'No fue un sueño...'), skip: window.__ev.some((e) => e.ev === 'story:skip'), muted: !!a.audio._muted, cover: getComputedStyle(document.getElementById('story-skipping')).opacity, obj: document.getElementById('story-obj').textContent, cp: a.save.data.story.checkpoint, outOfBed: Math.hypot(p.x - a.mapManager.current.story.points.cp09.x, p.z - a.mapManager.current.story.points.cp09.z) < 1.5 }; });
    check(skipped.skip && skipped.line && !skipped.muted && Number(skipped.cover) < 0.5 && /Sal de casa/.test(skipped.obj) && skipped.cp === 'CP09' && skipped.outOfBed, `La escena saltada deja el mismo estado que verla (${JSON.stringify(skipped)})`);
    // Detección → recarga del punto de control correcto
    await jump('CP03');
    check(await g(() => !!window.__ascend.story.stealth), 'CP03: sigilo activo (guardias y focos)');
    check(await g(() => window.__ascend.enemies.list.length === 0 && window.__ascend.input.blocked.has('melee')), 'Infiltración sin combate: no hay enemigos y F lanza piedras (no golpea)');
    await tp({ x: 82.6, y: 10.2, z: -50.6, yaw: Math.PI / 2 });
    check(await has('story:reload', "e.d.reason === 'Te han descubierto'"), 'De pie delante de un guardia: «Te han descubierto»');
    check(await until(() => { const a = window.__ascend; const p = a.player.motor.position; return !a.story._loading && Math.hypot(p.x - 77.5, p.z + 43.6) < 1.5; }, null, 30000), 'La detección recarga CP03 (Jon vuelve al escondite)');
    check(await g(() => window.__ascend.save.data.story.checkpoint === 'CP03'), 'El punto de control sigue siendo CP03');
    // Conducto
    check(await until(() => window.__ascend.mapManager.current.story.base.shutters.vent.k < 0.1, null, 60000), 'Cambio de guardia: Iker abre el conducto');
    await g(() => window.__ascend.player.motor.setCrouch(true));
    await tp({ x: 90.2, y: 10.2, z: -52 });
    check(await cpIs('CP04', 20000), 'Entrar por el conducto → CP04');
    await tp({ x: 101.4, y: 14.2, z: -73.6, yaw: Math.PI / 2 });
    check(await cpIs('CP05', 20000), 'Subir a la planta alta → CP05');
    await tp({ x: 106, y: 14.2, z: -68.1, yaw: Math.PI });
    check(await has('story:line', "e.d.text === 'Espera.'"), 'Cámara de contención: diálogo de las cartas');
    await until(() => /carta dorada/.test(document.getElementById('hud-prompt').textContent), null, 20000);
    await page.keyboard.press('KeyE');
    check(await cpIs('CP06', 30000), 'E en la carta dorada → absorción → CP06');
    const destiny = await g(() => { const a = window.__ascend; return { flag: a.save.data.story.flags.HasDestinyMark, owns: a.marks.owns('destino'), power: a.powers.available, fam: a.marks.activeFamily }; });
    check(destiny.flag && destiny.owns && !destiny.power && destiny.fam === null, `La carta concede el Destino sin poder ofensivo (${JSON.stringify(destiny)})`);
    check(await has('story:line', "e.d.text === 'Anomalía detectada. Contención comprometida.'"), 'Alarma: «Contención comprometida»');
    check(await cpIs('CP07', 30000), 'Salida principal cerrada → huida (CP07)');
    await tp({ x: 104, y: 14.2, z: -44 });
    await page.waitForTimeout(800);
    await tp({ x: 104, y: 18.7, z: -50 });
    check(await has('story:line', "e.d.text === 'Dos intrusos en cubierta norte.'"), 'Huida por la azotea (radio de la PDC)');
    await tp({ x: 116, y: 15.2, z: -17.5, yaw: Math.PI });
    check(await cpIs('CP08', 20000), 'Pasarela → CP08');
    await tp({ x: 116, y: 15.2, z: -10.6, yaw: Math.PI });
    await until(() => /tirolina/.test(document.getElementById('hud-prompt').textContent), null, 20000);
    await page.keyboard.press('KeyE');
    check(await has('story:line', "e.d.text === 'Iker... no veo bien...'"), 'Tirolina hasta la playa y desmayo');
    check(await cpIs('CP09', 60000), 'Transición a la mañana: CP09 (pueblo de día)');
    check(await g(() => window.__ascend.mapManager.current.def.id === 'pueblo-dia'), 'Mapa: pueblo de día');
    log('M01 ok');
  }
  {
    console.log('\n[M02]');
    await until(() => !window.__ascend.story.controlsLocked && window.__ascend.story.markers.length > 0, null, 40000);
    await tp({ x: -8, y: 0.2, z: 3, yaw: Math.PI / 2 });
    check(await has('story:line', "e.d.text.startsWith('¿Sabes qué es lo que más me gusta')"), 'Plaza: Narbaiza tortura a Martín con Sangre');
    await until(() => /Intervenir/.test(document.getElementById('story-tut').textContent), null, 20000);
    await page.keyboard.press('KeyF');
    check(await has('story:pinned'), 'Jon interviene y queda inmovilizado');
    const hp = await g(() => window.__ascend.playerCombat.health.value);
    check(hp === 1, `Narbaiza deja a Jon exactamente a 1 PV (${hp})`);
    check(await cpIs('CP10', 30000), 'Tras la escena → CP10');
    check(await g(() => window.__ascend.save.data.story.snapshot.health === 1), 'CP10 guardado con 1 PV');
    check(await has('story:line', "e.d.text === 'Hoy no.'"), 'Callejón: discusión con Iker');
    log('M02 ok');
  }
  {
    console.log('\n[M03]');
    await jump('CP11');
    check(await until(() => /DÍA 1/.test(document.getElementById('story-day').textContent), null, 20000), 'Tarjeta DÍA 1');
    check(await g(() => window.__ascend.playerCombat.health.value === window.__ascend.playerCombat.health.max), 'Un nuevo día: salud recuperada');
    await g(() => { window.__ascend.save.data.story.mission.dayIndex = 5; window.__ascend.save.save(); });
    await jump('CP11');
    check(await until(() => /DÍA 5/.test(document.getElementById('story-day').textContent), null, 20000), 'Cargar CP11 continúa en el día guardado (DÍA 5)');
    log('M03 ok');
  }
  {
    console.log('\n[M04]');
    await jump('CP12');
    const stalls = await g(() => window.__ascend.mapManager.current.story.stalls);
    for (const s of stalls) {
      await tp({ x: s.x, y: 0.2, z: s.z + 0.4, yaw: Math.PI });
      await until((id) => new RegExp(`Comprar`).test(document.getElementById('hud-prompt').textContent), s.id, 15000);
      await page.keyboard.press('KeyE');
      await has('story:bought', `e.d.item === '${s.id}'`);
    }
    check(await g(() => window.__ascend.save.data.story.mission.collectedFoodItems.length === 3), 'Mercado: pan, patatas y pescado');
    check(await has('story:storm'), 'La compra desencadena la tormenta');
    check(await cpIs('CP13', 30000), 'Salida del mercado → CP13');
    check(await has('story:sphere'), 'La esfera eléctrica cae sobre la casa');
    check(await g(() => window.__ascend.mapManager.current.story.storm.blocked && window.__ascend.mapManager.current.story.jonHouse.ruinedState), 'Rutas bloqueadas y casa en ruinas');
    await tp({ x: -9.5, y: 5.8, z: -11, yaw: -Math.PI / 2 });
    check(await cpIs('CP14', 20000), 'Por los tejados → CP14');
    await tp({ x: -30, y: 0.2, z: 12.2 });
    check(await cpIs('CP15', 20000), 'Llega a casa → CP15');
    await tp({ x: -31, y: 0.2, z: 18.2 });
    check(await has('story:line', "e.d.text === 'No vuelvas a llamarme así.'"), 'La pérdida y la Encarnación («Normie»)');
    await until(() => !window.__ascend.story.controlsLocked, null, 20000);
    await tp({ x: -28.6, y: 0.2, z: 17.4, yaw: Math.PI / 2 });
    await until(() => /contacto/.test(document.getElementById('hud-prompt').textContent), null, 15000);
    await page.keyboard.press('KeyE');
    await until(() => window.__ascend.acquisition.state === 'contact', null, 5000);
    await page.keyboard.down('KeyE');
    await until(() => window.__ascend.acquisition.will > 0.25, null, 15000);
    await page.keyboard.up('KeyE');
    check(await has('acquisition:failed', "e.d.reason === 'no-will'") && !(await g(() => window.__ascend.save.data.story.flags.HasEnergyMark)), 'Soltar antes de tiempo cancela la copia (falta voluntad)');
    await page.waitForTimeout(400);
    await page.keyboard.press('KeyE');
    await until(() => window.__ascend.acquisition.state === 'contact', null, 5000);
    await page.keyboard.down('KeyE');
    check(await has('mark:acquired', "e.d.markId === 'energia'"), 'Contacto + voluntad: Energía copiada');
    await page.keyboard.up('KeyE');
    check(await g(() => { const a = window.__ascend; const e = a.mapManager.current.entities.find((x) => x.source?.markId === 'energia'); return e?.hasPower === true && a.save.data.story.flags.HasEnergyMark; }), 'La Encarnación conserva su marca y su poder');
    check(await cpIs('CP16', 20000), 'Tras copiar → CP16');
    check(await g(() => window.__ascend.input.blocked.has('attack')), 'Aún no se usa la Energía libremente');
    check(await has('story:choice'), 'Pantalla de elección MATAR / PERDONAR');
    await page.keyboard.press('Digit2');
    check(await has('story:choice-made', "e.d.choice === 'SPARE'"), 'Elección: PERDONAR');
    check(JSON.parse(await g(() => localStorage.getItem(Object.keys(localStorage).find((k) => /ascend/i.test(k))))).story.flags.EnergyEncounterChoice === 'SPARE', 'La elección se guarda de inmediato');
    check(await has('story:line', "e.d.text === 'Qué conmovedor. Lástima que yo no tenga tanta compasión.'"), 'Rama PERDONAR: Narbaiza la mata con Sangre');
    check(await cpIs('CP17', 30000), 'Convergencia → CP17 (detención)');
    check(await has('story:line', "e.d.text === 'Aseguraos de que este llegue vivo.'"), 'Esposados: «Os llevamos a la ciudad como prisioneros»');
    check(await has('story:convoy-attacked'), 'Autobús de presos: el convoy es atacado en el puente');
    check(await has('story:teleport'), 'Vuelco y destello de Energía');
    check(await cpIs('CP18', 60000), 'Despertar en el bosque: CP18');
    // Rama MATAR
    await jump('CP16');
    check(await has('story:choice', 'e.cp === "CP16" && window.__ev.filter((x) => x.ev === "story:choice").length >= 2'), 'Otra vez la elección (rama MATAR)');
    await page.keyboard.press('Digit1');
    check(await has('story:line', "e.d.text === 'Interesante. Un chico sin entrenamiento acaba de matar a una Encarnación.'"), 'Rama MATAR: descarga narrativa y frase distinta de Narbaiza');
    check(await cpIs('CP17', 30000), 'Rama MATAR → también CP17 (autobús)');
    check(await g(() => window.__ascend.save.data.story.flags.EnergyEncounterChoice === 'KILL'), 'Elección guardada: KILL');
    log('M04 ok');
  }
  {
    console.log('\n[M05]');
    await jump('CP20');
    await until(() => !window.__ascend.story.controlsLocked, null, 15000);
    const deb = await g(() => { const a = window.__ascend; const d = a.mapManager.current.story.debris; return a.combat.applyDamage(d, 50, { kind: 'melee', faction: 'player' }); });
    check(deb === 0, 'El escombro no se rompe a golpes');
    await tp({ x: 17, y: 3.2, z: 0, yaw: Math.PI / 2 });
    await page.waitForTimeout(500);
    await g(() => { window.__ascend.cameraController.pitch = -0.05; });
    const shotE0 = await g(() => window.__ascend.powers.energy.value);
    await page.mouse.down();
    const broke = await has('story:debris-broken');
    await page.mouse.up();
    const shotE1 = await g(() => window.__ascend.powers.energy.value);
    check(broke && shotE1 < shotE0, `Los disparos de Energía destruyen el escombro (carga ${shotE0.toFixed(0)} → ${shotE1.toFixed(0)})`);
    await has('story:line', "e.d.text === '¿Cómo he hecho eso?'");
    const before = await g(() => { const a = window.__ascend; a.powers.energy.value = 10; return 10; });
    await tp({ x: 29.5, y: 3.2, z: -0.6, yaw: Math.PI });
    await page.keyboard.down('KeyE');
    await until(() => window.__ascend.powers.energy.value >= 40, null, 20000);
    await page.keyboard.up('KeyE');
    const after = await g(() => window.__ascend.powers.energy.value);
    check(after > before + 15, `El generador recarga la Energía (${before} → ${after.toFixed(0)})`);
    check(await has('story:line', "e.d.text === 'Vale... creo que empiezo a entenderlo.'"), '«Creo que empiezo a entenderlo»');
    // Drones
    await jump('CP21');
    await has('enemy:spawned', "e.d.tag === 'drones'");
    const killDrones = async () => {
      for (let n = 1; n <= 3; n++) {
        await until((k) => window.__ev.filter((e) => e.ev === 'story:drone').length >= k, n, 30000);
        const alive = await g(() => window.__ascend.enemies.alive.filter((e) => e.tag === 'drones').length);
        if (alive !== 1) check(false, `De uno en uno: ${alive} drones activos a la vez`);
        await page.waitForTimeout(400);
        await g(() => { const a = window.__ascend; for (const e of a.enemies.alive.filter((x) => x.tag === 'drones')) a.combat.applyDamage(e, 999, { faction: 'player', kind: 'bolt' }); });
      }
    };
    await killDrones();
    check(await cpIs('CP22', 30000), 'Tras los drones → CP22');
    const nDrones = await g(() => window.__ev.filter((e) => e.ev === 'enemy:spawned' && e.d.tag === 'drones' && e.cp === 'CP21').length);
    check(nDrones === 3, `Exactamente 3 drones en el primer encuentro (${nDrones})`);
    check(await until(() => !window.__ascend.input.blocked.has('charged') && !window.__ascend.input.blocked.has('wave'), null, 10000), 'R y G quedan desbloqueadas tras los drones');
    // Puente
    await tp({ x: 97, y: 3.2, z: 0, yaw: Math.PI / 2 });
    check(await cpIs('CP23', 20000), 'Puente: CP23');
    check(await until(() => !window.__ascend.input.blocked.has('special') && !!window.__ascend.story.dashAssist, null, 20000), 'Uso guiado de Q en el puente (dash asistido y círculo de aterrizaje)');
    // Caer al cañón recarga el punto de control
    await tp({ x: 116, y: 3.2, z: 0 });
    check(await has('story:reload', "e.d.reason === 'Has caído' && e.d.checkpoint === 'CP23'"), 'Caer al cañón recarga CP23');
    await until(() => !window.__ascend.story._loading && window.__ascend.player.motor.position.x < 105, null, 20000);
    // Salto real con dash
    await until(() => !window.__ascend.story.controlsLocked && !!window.__ascend.story.dashAssist, null, 20000);
    await tp({ x: 103, y: 3.2, z: 0, yaw: Math.PI / 2 });
    await page.waitForTimeout(400);
    // Carrera, salto en el borde y dash en lo alto del salto (teclas reales, sincronizadas con los fotogramas)
    const dashRun = await g(() => new Promise((resolve) => {
      const a = window.__ascend;
      const kd = (code) => window.dispatchEvent(new KeyboardEvent('keydown', { code }));
      const ku = (code) => window.dispatchEvent(new KeyboardEvent('keyup', { code }));
      kd('KeyW');
      kd('ShiftLeft');
      let phase = 0;
      const t0 = performance.now();
      const step = () => {
        const m = a.player.motor;
        if (phase === 0 && m.position.x > 110.4) {
          kd('Space');
          setTimeout(() => ku('Space'), 60);
          phase = 1;
        } else if (phase === 1 && !m.grounded && m.velocity.y < 1.5) {
          kd('KeyQ');
          setTimeout(() => ku('KeyQ'), 60);
          phase = 2;
        } else if (phase === 2 && (m.grounded || m.position.y < -2)) {
          ku('KeyW');
          ku('ShiftLeft');
          resolve({ x: m.position.x, y: m.position.y, phase });
          return;
        }
        if (performance.now() - t0 > 20000) {
          ku('KeyW');
          ku('ShiftLeft');
          resolve({ x: m.position.x, y: m.position.y, phase, timeout: true });
          return;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }));
    console.log('    dash:', JSON.stringify(dashRun));
    const crossed = await g(() => { const p = window.__ascend.player.motor.position; return { x: p.x, y: p.y }; });
    check(crossed.x > 120.5 && crossed.y > 2.5, `Primer hueco cruzado con salto + dash (x ${crossed.x.toFixed(1)}, y ${crossed.y.toFixed(1)})`);
    // Bloqueos
    await jump('CP25');
    await tp({ x: 180, y: 3.2, z: 0, yaw: Math.PI / 2 });
    check(await has('story:encounter', "e.d.id === 'block1'"), 'Primer bloqueo');
    const b1 = await g(() => window.__ev.find((e) => e.ev === 'story:encounter' && e.d.id === 'block1').d.types.slice().sort().join(','));
    check(b1 === 'dron,pdc,pdc', `2 agentes + 1 dron (${b1})`);
    await until(() => !window.__ascend.story.controlsLocked, null, 20000);
    await g(() => { const a = window.__ascend; for (const e of a.enemies.alive.filter((x) => x.tag === 'block1')) a.combat.applyDamage(e, 999, { faction: 'player', kind: 'bolt' }); });
    check(await cpIs('CP26', 20000), 'Tras vencer → CP26');
    await tp({ x: 207, y: 3.2, z: 0, yaw: Math.PI / 2 });
    check(await cpIs('CP27', 20000), 'Sección final → CP27');
    check(await has('story:encounter', "e.d.id === 'block2a' && e.d.types.join() === 'reforzado'"), 'Oleada 1: un agente reforzado');
    await until(() => !window.__ascend.story.controlsLocked, null, 20000);
    await g(() => { const a = window.__ascend; for (const e of a.enemies.alive.filter((x) => x.tag === 'block2')) a.combat.applyDamage(e, 999, { faction: 'player', kind: 'bolt' }); });
    check(await has('story:encounter', "e.d.id === 'block2b' && e.d.types.join() === 'pdc,pdc'"), 'Oleada 2: dos agentes');
    await page.waitForTimeout(500);
    await g(() => { const a = window.__ascend; for (const e of a.enemies.alive.filter((x) => x.tag === 'block2')) a.combat.applyDamage(e, 999, { faction: 'player', kind: 'bolt' }); });
    await page.waitForTimeout(500);
    await tp({ x: 253, y: 3.2, z: 0, yaw: Math.PI / 2 });
    check(await cpIs('CP28', 20000), 'Fuera del puente → CP28');
    await g(() => { const p = window.__ascend.save.data.profile; p.marks = p.marks.filter((m) => m !== 'energia'); });
    await tp({ x: 292, y: 12.2, z: 0, yaw: Math.PI / 2 });
    check(await cpIs('CP29', 20000), 'Colina → CP29');
    check(await has('story:line', "e.d.text === 'Aguanta, Iker. Voy a encontrarte.'"), 'Vista de la ciudad: «Voy a encontrarte»');
    await page.screenshot({ path: `${out}/story-city.png` });
    check(await has('story:final-dash'), 'Jon sale de plano con un dash');
    check(await until(() => window.__ascend.state === 'menu' && document.querySelector('#screen-menu.active'), null, 30000), 'Se abre el menú principal');
    const done = await g(() => { const s = window.__ascend.save.data; return { tc: s.story.flags.TutorialComplete, completed: s.story.completed, energia: s.profile.marks.includes('energia') }; });
    check(done.tc && done.completed && done.energia, `Progreso guardado: TutorialComplete y Energía en el modo libre (${JSON.stringify(done)})`);
    check(/completado/.test(await page.textContent('#menu-story-sub')), 'El menú muestra el prólogo completado');
    log('M05 ok');
  }
  const storyErrors = await g(() => window.__ev.filter((e) => e.ev === 'story:error').map((e) => e.d.error));
  check(storyErrors.length === 0, `El guion no lanza errores${storyErrors.length ? `: ${storyErrors.join(' | ')}` : ''}`);
}
