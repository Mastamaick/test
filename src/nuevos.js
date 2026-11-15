// Poderes de Hordatoj y DJ Transe (dibujos hechos en Canva en assets/powers/). game.js llama a EXTRA_POWERS(api) al cargar.
// Las fichas están en src/roster.js.
(function () {
  window.EXTRA_POWERS = (api) => {
    const { POWERS, POWER_SCALE, game, hold, release, strike, guarding, psfx, bodyY, spriteH, spriteSet, pickSprite, tintOf, ease, GROUND, W, H, ARENA_L, ARENA_R } = api;
    const POSE_CYCLE = ['punch', 'kick', 'punchH', 'kickH'];
    // dibujos de los poderes hechos en Canva (assets/powers/)
    ['tinta_charco', 'tinta_tent1', 'tinta_tent2', 'tinta_tent3', 'tinta_tent4', 'tinta_salp1', 'tinta_salp2', 'tinta_salp3', 'tinta_salp4',
      'tinta_mancha1', 'tinta_mancha2', 'tinta_mancha3', 'sombra_aura', 'sombra_estela', 'sombra_humo1', 'sombra_humo2', 'sombra_humo3']
      .forEach(n => api.loadArt(n, 'assets/powers/' + n + '.png'));
    ['luz_flash', 'luz_rayos', 'luz_estrella', 'luz_anillo'].forEach(n => api.loadArt(n, 'assets/powers/' + n + '.png', true)); // luz: se suma
    const puff = (x, y, w) => game.fxArt('sombra_humo' + (1 + Math.floor(Math.random() * 3)), x, y, w || 150, { life: 20, grow: 0.7, lift: 20, fade: 1.2 });
    // dibujo del luchador (silueta o normal) en una pose, parado en x mirando a dir
    function drawPose(f, pose, x, dir, tint, alpha) {
      const set = spriteSet(f.ch); if (!set) return;
      let [img] = pickSprite(set, pose); if (tint) img = tintOf(img, tint);
      const k = spriteH(f.ch) / set.idle.height, w = img.width * k, h = img.height * k, ax = img._footX ?? 0.5;
      const c = api.ctx; c.save(); c.globalAlpha = alpha; c.imageSmoothingEnabled = false;
      c.translate(x, GROUND - f.y); c.scale(dir, 1); c.drawImage(img, -w * ax, -h, w, h); c.restore();
    }

    // HAY LUZ (especial, 2 barras): la pantalla queda en negativo como un flash, Hordatoj aparece como sombra
    // al lado del rival, le da 10 golpes muy rápidos, desaparece, vuelven los colores y reaparece al otro lado.
    POWER_SCALE.hayluz = 1.0;
    POWERS.hayluz = {
      start(fx) { fx.guard = guarding(fx.o); hold(fx.f, 'taunt'); psfx('pw_flash', 'super_start', 0.9); },
      update(fx) {
        const f = fx.f, o = fx.o, t = fx.t;
        if (t === 1) { game.cam.flash = 10; game.shake(12); }
        if (t === 10) {
          f.hidden = true; if (!fx.guard) hold(o, 'hit');
          // aparecen DOS sombras, una a cada lado del rival, y se turnan para pegar
          fx.side = f.x < o.x ? 1 : -1;
          fx.sx = [o.x + fx.side * 125, o.x - fx.side * 125];
          puff(fx.sx[0], bodyY(o, 0.45), 190); puff(fx.sx[1], bodyY(o, 0.45), 190);
          game.shake(10);
        }
        // 15 golpes cada 5 cuadros (mismo daño total que antes: 24), para que dure como los demás especiales (~2,5 s)
        const NH = 15, LAST = 16 + (NH - 1) * 5;
        if (t > 10 && t < LAST + 9 && !fx.guard && o.state !== 'held') hold(o, 'hit');
        if (t >= 16 && t <= LAST && (t - 16) % 5 === 0) {
          fx.n = (t - 16) / 5; fx.jit = (Math.random() - 0.5) * 20;
          const s = fx.n % 2 ? -fx.side : fx.side; // la sombra que pega ahora
          // si no se estaba cubriendo cuando partió el poder, las sombras le pegan por donde no mira: no se bloquea
          strike(fx, { dmg: 1.6, stun: 22, kb: 0, hitstop: 2, heavy: fx.n === NH - 1, unblockable: !fx.guard, at: { x: o.x + s * 25, y: bodyY(o, 0.5 + (fx.n % 3) * 0.12) } });
          game.shake(4 + Math.min(fx.n, 12));
          game.popText(o.x, bodyY(o, 1.25), (fx.n + 1) + ' HITS', '#ffffff');
        }
        fx.boomT = LAST + 5;
        if (t === fx.boomT) {
          // explosión de luz final que lanza al rival
          fx.gone = true; game.cam.flash = 9; game.shake(26);
          game.fxArt('luz_flash', o.x, bodyY(o, 0.5), 520, { life: 22, grow: 0.6 });
          game.fxArt('luz_rayos', o.x, bodyY(o, 0.5), 460, { life: 20, grow: 0.4, rot: Math.random() });
          fx.sx.forEach(x => puff(x, bodyY(o, 0.45), 220));
          if (!fx.guard && o.state === 'held') { release(o); o.vy = 11; o.vx = -fx.side * 6; o.y = Math.max(o.y, 1); o.setState('down'); }
        }
        if (t === fx.boomT + 14) {
          // reaparece al otro lado de la pantalla con un destello
          f.x = o.x > (ARENA_L + ARENA_R) / 2 ? ARENA_L + 40 : ARENA_R - 40; f.facing = f.x < o.x ? 1 : -1;
          release(f); if (o.state === 'held') release(o);
          game.fxArt('luz_estrella', f.x, bodyY(f, 0.55), 260, { life: 18, grow: 0.8 });
          game.fxArt('luz_anillo', f.x, bodyY(f, 0.55), 200, { life: 18, grow: 1.4 });
          puff(f.x, bodyY(f, 0.3), 200);
        }
        return t > fx.boomT + 26;
      },
      front(fx) {
        const c = api.ctx, t = fx.t, B = fx.boomT || 91;
        // negativo de la pantalla (efecto flash), entra y sale suave
        const a = t < 10 ? t / 10 : t < B + 8 ? 1 : Math.max(0, 1 - (t - B - 8) / 8);
        if (a > 0) {
          c.save(); c.globalCompositeOperation = 'difference'; c.fillStyle = `rgba(255,255,255,${a})`; c.fillRect(-W, -H, W * 3, H * 3); c.restore();
        }
        // estallido de luz al partir (sobre el negativo)
        if (t < 14) { api.art('luz_flash', fx.f.x, bodyY(fx.f, 0.55), 300 + t * 40, { alpha: 1 - t / 14 }); api.art('luz_rayos', fx.f.x, bodyY(fx.f, 0.55), 260 + t * 30, { alpha: 1 - t / 14, rot: t * 0.05 }); }
        // las dos sombras: aura de humo violeta detrás y la silueta negra golpeando
        if (fx.sx && !fx.gone && t >= 10) {
          const o = fx.o, sh = spriteH(fx.f.ch);
          fx.sx.forEach((x, i) => {
            const s = i ? -fx.side : fx.side, active = ((fx.n || 0) % 2) === i && t >= 16;
            const pose = active ? POSE_CYCLE[(fx.n || 0) % 4] : 'idle', jit = active ? (fx.jit || 0) : 0;
            const xx = x - s * (active ? 30 : 0) + jit; // la que pega se tira encima
            api.art('sombra_aura', xx, GROUND - sh * 0.6, sh * 0.85, { h: sh * 1.25, alpha: active ? 0.9 : 0.55, flipX: s > 0 });
            if (active) api.art('sombra_estela', xx + s * 90, bodyY(o, 0.55), 220, { alpha: 0.7, flipX: s < 0 });
            drawPose(fx.f, pose, xx, -s, '#05050a', active ? 1 : 0.7);
          });
        }
      },
    };

    // EL TINTERO (súper, 3 barras): una mancha de tinta negra sale del suelo y atrapa al rival; Hordatoj camina
    // lento hacia él y le da 4 patadas, y el rival se va dando vuelta (pecho, espalda) entre cada una.
    POWER_SCALE.tintero = 1.0;
    const INK_RATIO = { tinta_tent1: 1.39, tinta_tent2: 1.625, tinta_tent3: 1.0, tinta_tent4: 1.525 };
    // cuánta tinta hay (0 a 1): crece al partir y se seca al terminar
    const inkLevel = fx => fx.fail ? Math.max(0, 1 - (fx.t - fx.fail) / 20) : fx.end != null ? Math.max(0, 1 - (fx.t - fx.end) / 30) : fx.grow;
    function tentacles(fx, list) {
      if (fx.fail || fx.t < 20) return;
      const o = fx.o, out = fx.end != null ? Math.max(0, 1 - (fx.t - fx.end) / 14) : 1;
      if (out <= 0) return;
      const rise = Math.min(1, (fx.t - 20) / 12) * out, sh = spriteH(o.ch);
      const squeeze = fx.squeeze ? Math.max(0, 1 - (fx.t - fx.squeeze) / 10) : 0; // aprietan con cada patada
      list.forEach(([name, dx, hk, flip], i) => {
        const h = sh * hk * rise * (1 + squeeze * 0.15), w = h / INK_RATIO[name];
        const sway = Math.sin(fx.t * 0.09 + i * 1.7) * 0.08 + (dx > 0 ? -1 : 1) * squeeze * 0.12;
        api.art(name, o.x + dx * (1 - squeeze * 0.3), GROUND - h / 2 + 8, w, { h, rot: sway, flipX: flip });
      });
    }
    POWERS.tintero = {
      start(fx) { fx.guard = guarding(fx.o); hold(fx.f, 'taunt'); fx.px = fx.o.x; psfx('pw_ink', 'special_wave', 0.8); },
      update(fx) {
        const f = fx.f, o = fx.o, t = fx.t;
        fx.grow = Math.min(1, t / 28);
        if (t === 24) { if (fx.guard) { fx.fail = t; } else { hold(o, 'dizzy'); game.shake(8); } }
        if (fx.fail) { if (t - fx.fail > 20) { release(f); return true; } return false; }
        if (t > 24 && fx.kicks == null && o.state !== 'held') hold(o, 'dizzy');
        if (t >= 34 && fx.kicks == null) {
          // camina lento hasta quedar a distancia de patada
          const dx = o.x - f.x, d = Math.abs(dx);
          f.facing = dx > 0 ? 1 : -1;
          if (d > 105) { f.x += f.facing * 2.4; f.fxPose = Math.floor(t / 9) % 2 ? 'walk2' : 'walk1'; }
          else { fx.kicks = 0; fx.kt = t; }
          if (t > 180) { fx.kicks = 0; fx.kt = t; } // por si no alcanza a llegar
        }
        if (fx.kicks != null) {
          const k = t - fx.kt;
          // 3 patadas (mismo daño total: 35 = 10,5 + 10,5 + 14)
          const NK = 3;
          if (k % 24 === 6 && fx.kicks < NK) {
            const last = fx.kicks === NK - 1;
            f.fxPose = last ? 'kickH' : fx.kicks % 2 ? 'kick2' : 'kick';
            if (!last) hold(o, 'hit');
            // atrapado en la tinta no se puede cubrir
            const ok = strike(fx, last ? { dmg: 14, stun: 40, kb: 9, knockdown: true, hitstop: 16, unblockable: true } : { dmg: 10.5, stun: 40, kb: 0, hitstop: 10, unblockable: true });
            game.shake(last ? 24 : 10); fx.squeeze = t;
            // cada patada revienta tinta alrededor del rival (ya no quedan manchas pegadas arriba en la pantalla)
            game.fxArt('tinta_salp' + (1 + fx.kicks % 4), o.x, bodyY(o, 0.55), last ? 380 : 250, { life: 18, grow: 0.5, flip: f.facing < 0, rot: (Math.random() - 0.5) * 0.5 });
            fx.kicks++;
            if (!last) o.facing *= -1; // pecho, espalda, pecho...
            if (last || !ok) { fx.end = t; release(f); }
          } else if (k % 24 === 18 && fx.kicks < NK) f.fxPose = 'idle';
        }
        return fx.end != null && t - fx.end > 32; // deja que la tinta del piso se seque
      },
      // dibujos de Canva: charco que inunda el piso, una columna de tinta que sube al atrapar
      // y tentáculos alrededor del rival (2 detrás y 2 delante) que se mecen y aprietan con cada patada
      back(fx) {
        const g = inkLevel(fx); if (g <= 0) return;
        const w = 620 * g; api.art('tinta_charco', fx.px, GROUND + 4 - w * 0.194 * 0.15, w); // apenas asomando sobre el piso
        tentacles(fx, [['tinta_tent2', -62, 1.0, false], ['tinta_tent3', 66, 0.8, true]]);
      },
      front(fx) {
        if (fx.fail) return;
        // columna de tinta al atrapar (t 10-34): sube de golpe, cubre al rival y baja
        const t = fx.t;
        if (t > 8 && t < 40) {
          const k = t < 22 ? ease((t - 8) / 14) : 1 - ease((t - 22) / 18), sh = spriteH(fx.o.ch) * 1.35 * k;
          if (sh > 4) api.art('tinta_tent4', fx.o.x, GROUND - sh / 2 + 10, sh / 1.525, { h: sh, alpha: 0.95 });
        }
        tentacles(fx, [['tinta_tent1', 44, 0.5, false], ['tinta_tent3', -40, 0.38, false]]); // bajos: que se vea al rival atrapado
      },
    };

    // ================= DJ TRANSE =================
    ['dj_tornamesa', 'dj_vinilo', 'dj_vinilo_gira', 'dj_vinilo_fuego'].forEach(n => api.loadArt(n, 'assets/powers/' + n + '.png'));
    // dibuja a un rapero (por su ficha) en una pose, parado en x mirando a dir
    function drawChar(ch, pose, x, dir, alpha) {
      const set = spriteSet(ch); if (!set) return;
      const [img] = pickSprite(set, pose), k = spriteH(ch) / set.idle.height, w = img.width * k, h = img.height * k, ax = img._footX ?? 0.5;
      const c = api.ctx; c.save(); c.globalAlpha = alpha; c.imageSmoothingEnabled = false;
      c.translate(x, GROUND); c.scale(dir, 1); c.drawImage(img, -w * ax, -h, w, h); c.restore();
    }
    const clampX = x => Math.max(ARENA_L, Math.min(ARENA_R, x));
    // vinilos que vuelan hacia el rival girando; al llegar pegan (big = el último, en llamas)
    function flyVinyls(fx, hitOpts) {
      const o = fx.o;
      for (const v of fx.vin) {
        if (v.done) continue;
        v.x += v.vx; v.rot += 0.5 * fx.dir; v.y += Math.sin((v.x + v.ph) * 0.05) * 1.2;
        if ((fx.dir > 0 ? v.x >= o.x - 20 : v.x <= o.x + 20) || v.x < ARENA_L - 60 || v.x > ARENA_R + 60) {
          v.done = true;
          const ok = strike(fx, Object.assign({}, v.big ? hitOpts.big : hitOpts.small, { at: { x: o.x - fx.dir * 20, y: v.y } }));
          game.fxArt(v.big ? 'x_crea_bombo' : 'x_macro_notas', o.x - fx.dir * 20, v.y, v.big ? 280 : 150, { life: 18, grow: 0.5 });
          if (v.big) { game.shake(24); game.cam.flash = 6; } else game.shake(6);
          if (!ok && !v.big) fx.vin.forEach(w => { if (!w.done) w.blocked = true; });
        }
      }
    }
    function drawVinyls(fx) {
      for (const v of fx.vin) if (!v.done) api.art(v.big ? 'dj_vinilo_fuego' : 'dj_vinilo_gira', v.x, v.y, v.big ? 230 : 95, { rot: v.big ? v.rot * 0.3 : v.rot });
    }

    // TORNAMESA (especial, 2 barras): aparece una tornamesa gigante, hace scratch y dispara 5 vinilos, el último enorme
    POWER_SCALE.tornamesa = 1.0;
    POWERS.tornamesa = {
      start(fx) { const f = fx.f; hold(f, 'taunt'); fx.tx = clampX(f.x + fx.dir * 105); fx.vin = []; fx.guard = guarding(fx.o); psfx('pw_scratch', 'super_start', 0.8); },
      update(fx) {
        const f = fx.f, t = fx.t;
        if (t === 12) { game.popText(fx.tx, bodyY(f, 1.2), '¡SCRATCH!', '#2fbf71'); game.shake(8); game.fxArt('x_macro_ondas', fx.tx, GROUND - 200, 200, { life: 20 }); }
        // ráfaga: 4 vinilos y uno gigante en llamas
        if ([24, 32, 40, 48, 64].includes(t)) {
          const big = t === 64;
          fx.vin.push({ x: fx.tx + fx.dir * 40, y: big ? bodyY(f, 0.55) : GROUND - 130 - Math.random() * 60, vx: fx.dir * (big ? 13 : 19), rot: 0, ph: Math.random() * 100, big });
          psfx('pw_vinyl', big ? 'special_wave' : 'whoosh', big ? 1 : 0.6);
          if (big) game.fxArt('x_macro_ondas', fx.tx, GROUND - 200, 300, { life: 22 });
        }
        if (t === 26) f.fxPose = 'punch'; if (t === 66) f.fxPose = 'punchH';
        flyVinyls(fx, { small: { dmg: 4, stun: 22, kb: 1, hitstop: 4 }, big: { dmg: 10, stun: 30, kb: 9, knockdown: true, hitstop: 14 } });
        if (t === 70) release(f);
        return t > 70 && fx.vin.every(v => v.done) && t > 90;
      },
      back(fx) {
        // la tornamesa sobre su mesa: aparece con un rebote y se va al final
        const t = fx.t, a = Math.min(1, t / 6, Math.max(0, (100 - t) / 12)), pop = t < 10 ? 0.6 + 0.4 * ease(t / 10) + Math.sin(t / 10 * Math.PI) * 0.15 : 1;
        const w = 270 * pop, h = w * 290 / 315;
        api.art('dj_tornamesa', fx.tx, GROUND - h / 2 + 6, w, { alpha: a, flipX: fx.dir < 0, rot: t > 12 && t < 70 ? Math.sin(t * 1.3) * 0.02 : 0 });
      },
      front(fx) { drawVinyls(fx); },
    };

    // SCRATCH Y FLOW (súper, 3 barras): llega ChysteMC de invitado. DJ Transe pone el beat en la tornamesa y Chyste rapea:
    // sus rimas salen como notas que golpean al rival y al final revientan en una onda de bajo gigante
    POWER_SCALE.scratchflow = 0.9; // medido: 41 de daño sin escalar; los súper quedan en ~35 × fuerza
    POWERS.scratchflow = {
      start(fx) {
        const f = fx.f; hold(f, 'taunt'); fx.guard = guarding(fx.o); if (!fx.guard) hold(fx.o, 'dizzy');
        fx.partner = window.ROSTER.find(c => c.id === f.ch.super.partner);
        // la tornamesa delante de DJ Transe y ChysteMC detrás de él, rapeando
        fx.tx = clampX(f.x + fx.dir * 60); fx.px = clampX(f.x - fx.dir * 130); fx.vin = []; fx.notes = [];
        if (Math.abs(fx.px - f.x) < 100) { fx.px = clampX(f.x + fx.dir * 0); f.x = clampX(fx.px + fx.dir * 130); fx.tx = clampX(f.x + fx.dir * 60); }
        game.popText(fx.px, bodyY(f, 1.25), '¡CHYSTEMC!', '#5b8cff');
      },
      update(fx) {
        const f = fx.f, o = fx.o, t = fx.t;
        if (t < 112 && !fx.guard && o.state !== 'held') hold(o, 'dizzy');
        if (t % 16 === 8 && t < 100) { game.shake(5); game.fxArt('x_macro_ondas', fx.tx, GROUND - 120, 240, { life: 16 }); } // el beat
        // rimas de Chyste: notas que vuelan al rival
        if (t >= 28 && t <= 92 && (t - 28) % 8 === 0) {
          fx.notes.push({ x: fx.px + fx.dir * 50, y: bodyY(f, 0.85), vx: fx.dir * 20, t: 0 });
          if ((t - 28) % 24 === 0) game.popText(fx.px, bodyY(f, 1.2), ['¡FLOW!', '¡RIMA!', '¡SCRATCH!'][((t - 28) / 24) % 3], '#ffffff');
        }
        for (const n of fx.notes) {
          if (n.done) continue; n.x += n.vx; n.t++;
          if (fx.dir > 0 ? n.x >= o.x - 20 : n.x <= o.x + 20) { n.done = true; strike(fx, { dmg: 2.6, stun: 30, kb: 0, hitstop: 3, unblockable: !fx.guard, at: { x: o.x - fx.dir * 20, y: n.y } }); game.shake(5); }
        }
        // final: el vinilo en llamas y una onda de bajo gigante
        if (t === 100) { fx.vin.push({ x: fx.tx + fx.dir * 40, y: bodyY(f, 0.55), vx: fx.dir * 16, rot: 0, ph: 0, big: true }); game.fxArt('x_crea_bass', fx.tx + fx.dir * 80, bodyY(f, 0.55), 420, { life: 26 }); game.cam.flash = 6; }
        flyVinyls(fx, { small: { dmg: 3, stun: 20, kb: 0, hitstop: 3 }, big: { dmg: 14, stun: 40, kb: 10, knockdown: true, hitstop: 18, unblockable: true } });
        if (t === 104) release(f);
        return t > 104 && fx.vin.every(v => v.done) && t > 130;
      },
      back(fx) {
        const t = fx.t, a = Math.min(1, t / 10, Math.max(0, (130 - t) / 14));
        // la tornamesa frente a DJ Transe
        api.art('dj_tornamesa', fx.tx + fx.dir * 40, GROUND - 115, 250, { alpha: a, flipX: fx.dir < 0, rot: Math.sin(t * 1.1) * 0.015 });
      },
      front(fx) {
        // ChysteMC va por delante de DJ Transe (en la capa de atrás quedaba tapado)
        if (fx.partner) {
          const t = fx.t, a = Math.min(1, t / 10, Math.max(0, (130 - t) / 14));
          const pose = t > 24 && t < 100 ? (Math.floor(t / 10) % 2 ? 'taunt' : 'punchH') : 'idle';
          drawChar(fx.partner, pose, fx.px, fx.dir, a);
        }
        for (const n of fx.notes) if (!n.done) api.art('x_macro_notas', n.x, n.y + Math.sin(n.t * 0.5) * 10, 90, { rot: n.t * 0.1 });
        drawVinyls(fx);
      },
    };
  };
})();
