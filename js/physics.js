/* GIGÁSZOK CSATÁJA – fizika: ballisztika állandó időlépéssel + terep */
(function () {
  'use strict';
  const TD = (window.TD = window.TD || {});

  const CFG = (TD.CFG = {
    WORLD_W: 64,          // a pálya szélessége méterben
    TANK_X: [7, 57],      // a két tank helye
    WALL_X: 32,           // a fal közepe
    WALL_CAP_CLASSIC: 15, // klasszikus mód falmagasság-határa (m)
    WALL_CAP_ENDLESS: 30, // végtelen mód: fizikai határ, ahol még mindig van lövési megoldás
    WIND_MAX: 10,         // m/s
    NEAR_R: 6,            // közeli robbanás sugara (m)
    DIRECT_DMG: 30,
    NEAR_MIN: 10,
    NEAR_MAX: 20,
  });

  const Physics = (TD.Physics = {
    G: 9.81,          // m/s²
    DT: 1 / 120,      // állandó szimulációs időlépés (s)
    VMAX: 32,         // kezdősebesség 100%-os erőnél (m/s)
    WIND_ACC: 0.2,    // 1 m/s szél = 0.2 m/s² vízszintes gyorsulás
    TIME_SCALE: 1.6,  // játékidő-gyorsítás (a fizikát nem változtatja, csak több lépés/képkocka)
    MAX_T: 30,

    /** Kezdősebesség vektor. dir: +1 jobbra néz, -1 balra. */
    launch(angleDeg, power, dir) {
      const v = (Math.max(0, Math.min(100, power)) / 100) * Physics.VMAX;
      const a = (Math.max(0, Math.min(90, angleDeg)) * Math.PI) / 180;
      return { vx: Math.cos(a) * v * dir, vy: Math.sin(a) * v };
    },

    accel(wind) {
      return { ax: wind * Physics.WIND_ACC, ay: -Physics.G };
    },

    /** Egy lépés állandó gyorsulással – állandó gyorsulásnál pontos (nincs numerikus sodródás). */
    step(b, ax, ay, dt) {
      b.x += b.vx * dt + 0.5 * ax * dt * dt;
      b.y += b.vy * dt + 0.5 * ay * dt * dt;
      b.vx += ax * dt;
      b.vy += ay * dt;
      b.t += dt;
    },

    /** Analitikus parabola (ellenőrzéshez). */
    analytic(x0, y0, vx, vy, ax, ay, t) {
      return { x: x0 + vx * t + 0.5 * ax * t * t, y: y0 + vy * t + 0.5 * ay * t * t };
    },

    /**
     * Teljes röppálya szimulálása ütközésvizsgálattal.
     * o = {x,y,vx,vy,wind,collide:(x,y,t)=>hit|null, record}
     */
    simulate(o) {
      const b = { x: o.x, y: o.y, vx: o.vx, vy: o.vy, t: 0 };
      const { ax, ay } = Physics.accel(o.wind || 0);
      const rec = o.record || 4;
      const pts = [[b.x, b.y]];
      let hit = null, n = 0, apex = b.y;
      const maxT = o.maxT || Physics.MAX_T;
      while (b.t < maxT) {
        Physics.step(b, ax, ay, Physics.DT);
        n++;
        if (b.y > apex) apex = b.y;
        if (n % rec === 0) pts.push([b.x, b.y]);
        if (o.collide) {
          hit = o.collide(b.x, b.y, b.t);
          if (hit) { pts.push([b.x, b.y]); break; }
        }
      }
      return { pts, hit, x: b.x, y: b.y, t: b.t, apex, steps: n };
    },
  });

  // ---------- Terep ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  TD.rng = mulberry32;

  const Terrain = (TD.Terrain = {
    bumps: [],
    flat: [],
    init(seed) {
      const r = mulberry32(seed || 1);
      this.bumps = [];
      for (let i = 0; i < 5; i++) {
        this.bumps.push({ a: 0.25 + r() * 0.55, f: 0.06 + r() * 0.22, p: r() * 6.28 });
      }
      this.flat = [[CFG.TANK_X[0], 5.5], [CFG.TANK_X[1], 5.5], [CFG.WALL_X, 3.5]];
    },
    mask(x) {
      let m = 1;
      for (const [c, r] of this.flat) {
        const d = Math.abs(x - c);
        if (d < r) return 0;
        if (d < r + 5) { const u = (d - r) / 5; m = Math.min(m, u * u * (3 - 2 * u)); }
      }
      return m;
    },
    height(x) {
      let h = 0;
      for (const b of this.bumps) h += b.a * Math.sin(x * b.f + b.p);
      return Math.max(-0.6, h) * this.mask(x);
    },
  });
  Terrain.init(1);
})();
