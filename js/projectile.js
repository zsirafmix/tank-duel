/* GIGÁSZOK CSATÁJA – lövedék és ütközésvizsgálat */
(function () {
  'use strict';
  const TD = window.TD;
  const P = TD.Physics;
  const RADIUS = 0.22;

  /**
   * Ütközésfüggvény a világhoz. world = {tanks, wall}. owner: lövő indexe.
   * Visszaad: {type:'tank'|'wall'|'ground'|'out', ...} vagy null.
   */
  function makeCollider(world, owner) {
    return function (x, y, t) {
      for (const tk of world.tanks) {
        if (tk.idx === owner && t < 0.35) continue; // a saját csőtorkolatból kilépés
        if (tk.hitTest(x, y, RADIUS)) return { type: 'tank', tank: tk, x, y };
      }
      const b = world.wall.hit(x, y, RADIUS);
      if (b) return { type: 'wall', brick: b, x, y };
      if (y <= TD.Terrain.height(x)) return { type: 'ground', x, y: TD.Terrain.height(x) };
      if (x < -25 || x > TD.CFG.WORLD_W + 25 || y < -10) return { type: 'out', x, y };
      return null;
    };
  }

  class Projectile {
    constructor(owner, x, y, vx, vy, wind) {
      this.owner = owner;
      this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.t = 0;
      this.x0 = x; this.y0 = y; this.vx0 = vx; this.vy0 = vy;
      const a = P.accel(wind);
      this.ax = a.ax; this.ay = a.ay;
      this.wind = wind;
      this.path = [[x, y]];
      this.trail = [];
      this.n = 0;
      this.alive = true;
      this.apex = y;
      this.maxErr = 0; // eltérés az analitikus parabolától (ellenőrzéshez)
    }
    step(collide) {
      P.step(this, this.ax, this.ay, P.DT);
      this.n++;
      if (this.y > this.apex) this.apex = this.y;
      const an = P.analytic(this.x0, this.y0, this.vx0, this.vy0, this.ax, this.ay, this.t);
      const err = Math.hypot(an.x - this.x, an.y - this.y);
      if (err > this.maxErr) this.maxErr = err;
      if (this.n % 3 === 0) this.path.push([this.x, this.y]);
      if (this.n % 2 === 0) { this.trail.push([this.x, this.y]); if (this.trail.length > 22) this.trail.shift(); }
      return collide(this.x, this.y, this.t);
    }
    draw(ctx, cam, env) {
      // rövid, halvány csík a lövedék mögött
      const tr = this.trail;
      for (let i = 1; i < tr.length; i++) {
        const a = i / tr.length;
        ctx.strokeStyle = env.night ? `rgba(255,220,140,${a * 0.55})` : `rgba(255,255,255,${a * 0.6})`;
        ctx.lineWidth = Math.max(1, cam.s * 0.22 * a);
        ctx.beginPath(); ctx.moveTo(cam.X(tr[i - 1][0]), cam.Y(tr[i - 1][1])); ctx.lineTo(cam.X(tr[i][0]), cam.Y(tr[i][1])); ctx.stroke();
      }
      const X = cam.X(this.x), Y = cam.Y(this.y);
      const ang = Math.atan2(-this.vy, this.vx);
      ctx.save(); ctx.translate(X, Y); ctx.rotate(ang);
      const r = Math.max(3, cam.s * 0.28);
      ctx.fillStyle = '#2b2b2b';
      ctx.beginPath(); ctx.moveTo(r * 1.6, 0); ctx.quadraticCurveTo(r * 0.8, -r, -r, -r * 0.8); ctx.lineTo(-r, r * 0.8); ctx.quadraticCurveTo(r * 0.8, r, r * 1.6, 0); ctx.fill();
      ctx.fillStyle = '#d9a63a'; ctx.fillRect(-r * 0.4, -r * 0.82, r * 0.35, r * 1.64);
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(-r * 0.6, -r * 0.6, r * 1.6, r * 0.25);
      ctx.restore();
    }
  }

  TD.Projectile = Projectile;
  TD.makeCollider = makeCollider;
  TD.PROJ_R = RADIUS;
})();
