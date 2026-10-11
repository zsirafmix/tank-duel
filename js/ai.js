/* GIGÁSZOK CSATÁJA – számítógépes ellenfél */
(function () {
  'use strict';
  const TD = window.TD;
  const P = TD.Physics;

  const LEVELS = {
    // Könnyű: a szelet figyelmen kívül hagyja, nagy szórás -> gyakran hibázik
    easy: { name: 'Könnyű', windK: 0, windNoise: 0, angErr: 9, powErr: 13, think: 1.2 },
    // Közepes: közelítő ballisztika – a szelet csak becsüli (±50%), közepes szórás
    medium: { name: 'Közepes', windK: 1, windNoise: 0.5, angErr: 2.5, powErr: 4, think: 1.0 },
    // Nehéz: pontos számítás, kis maradék hiba
    hard: { name: 'Nehéz', windK: 1, windNoise: 0.05, angErr: 1.8, powErr: 2.2, think: 0.8 },
  };

  function gauss() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /** Egy lövés kiértékelése: 0 = közvetlen találat, egyébként méterben mért hiba */
  function evalShot(world, tank, target, angle, power, wind) {
    const m = tank.muzzle(angle);
    const v = P.launch(angle, power, tank.dir);
    const sim = P.simulate({ x: m.x, y: m.y, vx: v.vx, vy: v.vy, wind, collide: TD.makeCollider(world, tank.idx), record: 1000 });
    const h = sim.hit;
    const c = target.center();
    if (!h) return { score: 9999, sim };
    if (h.type === 'tank') {
      if (h.tank === target) return { score: Math.hypot(h.x - c.x, h.y - c.y) * 0.01, sim, direct: true };
      return { score: 5000, sim }; // önmagát találná
    }
    if (h.type === 'wall') return { score: 1000 + Math.abs(h.x - c.x), sim };
    if (h.type === 'out') return { score: 2000 + Math.abs(h.x - c.x), sim };
    return { score: Math.max(0.5, target.distTo(h.x, h.y)) + 0.3, sim };
  }

  /** Rácskeresés + finomítás a teljes szimulációval (fal, szél, terep). */
  function solve(world, tank, target, wind, opts) {
    opts = opts || {};
    let best = { score: Infinity, angle: 45, power: 60 };
    const a0 = opts.minAngle || 8, a1 = opts.maxAngle || 88;
    for (let a = a0; a <= a1; a += 2) {
      for (let p = 20; p <= 100; p += 2) {
        const r = evalShot(world, tank, target, a, p, wind);
        // enyhén a "szép" közepes szögeket preferálja
        const sc = r.score + (r.score < 1 ? Math.abs(a - 52) * 0.001 : 0);
        if (sc < best.score) best = { score: sc, angle: a, power: p };
      }
    }
    // finomítás
    for (let it = 0; it < 2; it++) {
      const st = it === 0 ? 0.5 : 0.25;
      const c = { ...best };
      for (let a = c.angle - 2; a <= c.angle + 2; a += st) {
        for (let p = c.power - 2; p <= c.power + 2; p += st) {
          if (a < 0 || a > 90 || p < 0 || p > 100) continue;
          const r = evalShot(world, tank, target, a, p, wind);
          const sc = r.score + (r.score < 1 ? Math.abs(a - 52) * 0.001 : 0);
          if (sc < best.score) best = { score: sc, angle: a, power: p };
        }
      }
    }
    best.direct = best.score < 1;
    return best;
  }

  /** A gép döntése az adott nehézségen */
  function choose(world, tank, target, wind, level) {
    const L = LEVELS[level] || LEVELS.medium;
    const windEst = wind * L.windK * (1 + gauss() * L.windNoise);
    const sol = solve(world, tank, target, windEst);
    const angle = Math.max(0, Math.min(90, sol.angle + gauss() * L.angErr));
    const power = Math.max(5, Math.min(100, sol.power + gauss() * L.powErr));
    return { angle: Math.round(angle * 2) / 2, power: Math.round(power * 2) / 2, ideal: sol, windEst };
  }

  TD.AI = { LEVELS, solve, choose, evalShot };
})();
