/* GIGÁSZOK CSATÁJA – a növekvő téglafal */
(function () {
  'use strict';
  const TD = window.TD;

  class Wall {
    constructor(cx) {
      this.cx = cx;
      this.bw = 1.0;   // tégla szélessége (m)
      this.bh = 0.5;   // tégla magassága (m) -> 2 sor / méter
      this.cols = 3;   // a fal 3 m széles
      this.w = this.bw * this.cols;
      this.x0 = cx - this.w / 2;
      this.cap = TD.CFG.WALL_CAP_CLASSIC;
      this.onLand = null; // (brick) => void, hang/por
      this.reset();
    }
    reset() {
      this.bricks = [];
      this.grid = [];
      this.rows = 0;
      this.destroyed = 0;
    }
    /** Felépített magasság méterben */
    get height() { return this.rows * this.bh; }
    /** A legmagasabb még álló tégla teteje */
    get topAlive() {
      for (let r = this.rows - 1; r >= 0; r--) {
        if (this.grid[r] && this.grid[r].some(b => b.alive)) return (r + 1) * this.bh;
      }
      return 0;
    }
    rowSpans(r) {
      // futókötés: minden második sor fél téglával eltolva
      return r % 2 === 0 ? [[0, 1], [1, 2], [2, 3]] : [[0, 0.5], [0.5, 1.5], [1.5, 2.5], [2.5, 3]];
    }
    addRows(n, animate) {
      let k = 0;
      const added = [];
      for (let i = 0; i < n; i++) {
        const r = this.rows++;
        const y0 = r * this.bh;
        this.grid[r] = [];
        const spans = this.rowSpans(r);
        // váltakozó irányban rakjuk, mint egy kőműves
        const order = r % 2 ? spans.slice().reverse() : spans;
        for (const [a, b] of order) {
          const br = {
            x0: this.x0 + a * this.bw, x1: this.x0 + b * this.bw,
            y0, y1: y0 + this.bh, row: r, alive: true,
            tint: Math.random(), crack: 0, crackSeed: Math.random() * 1000,
            set: !animate, fy: y0, vy: 0, delay: 0, landed: !animate, rot: 0,
          };
          if (animate) {
            br.delay = k * 0.11;
            br.fy = y0 + 10 + Math.random() * 4;
            br.rot = (Math.random() - 0.5) * 0.6;
            k++;
          }
          this.bricks.push(br);
          this.grid[r].push(br);
          added.push(br);
        }
      }
      return added;
    }
    /** A fal a megadott magasságig nő (méter). Visszaadja az új téglákat. */
    growTo(meters, animate) {
      const target = Math.round(Math.min(meters, this.cap) / this.bh);
      const n = target - this.rows;
      return n > 0 ? this.addRows(n, animate) : [];
    }
    animating() {
      for (const b of this.bricks) if (!b.set && b.alive) return true;
      return false;
    }
    update(dt) {
      for (const b of this.bricks) {
        if (b.set || !b.alive) continue;
        if (b.delay > 0) { b.delay -= dt; continue; }
        b.vy -= 32 * dt;
        b.fy += b.vy * dt;
        b.rot *= Math.max(0, 1 - dt * 6);
        if (b.fy <= b.y0) {
          b.fy = b.y0;
          if (!b.landed) {
            b.landed = true;
            b.vy = -b.vy * 0.22;
            b.rot = 0;
            if (this.onLand) this.onLand(b);
          } else {
            b.vy = 0; b.set = true;
          }
        }
      }
    }
    /** Kör–téglalap ütközés: az első eltalált álló tégla */
    hit(x, y, r) {
      if (x < this.x0 - r || x > this.x0 + this.w + r) return null;
      if (y < -r || y > this.rows * this.bh + r) return null;
      const r0 = Math.max(0, Math.floor((y - r) / this.bh));
      const r1 = Math.min(this.rows - 1, Math.floor((y + r) / this.bh));
      for (let row = r0; row <= r1; row++) {
        const g = this.grid[row];
        if (!g) continue;
        for (const b of g) {
          if (!b.alive || !b.set) continue;
          const cx = Math.max(b.x0, Math.min(x, b.x1));
          const cy = Math.max(b.y0, Math.min(y, b.y1));
          const dx = x - cx, dy = y - cy;
          if (dx * dx + dy * dy <= r * r) return b;
        }
      }
      return null;
    }
    /** Robbanás: a sugáron belüli téglák kirepülnek, a szélén levők megrepednek. */
    blast(x, y, rad) {
      const out = [];
      for (const b of this.bricks) {
        if (!b.alive) continue;
        const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
        const d = Math.hypot(cx - x, cy - y);
        if (d < rad) { b.alive = false; out.push(b); this.destroyed++; }
        else if (d < rad + 0.9) b.crack = Math.min(3, b.crack + 1);
      }
      return out;
    }
    aliveCount() { let n = 0; for (const b of this.bricks) if (b.alive) n++; return n; }

    draw(ctx, cam, env) {
      const s = cam.s;
      const night = env.night;
      const depth = 0.32; // 2.5D mélység
      // árnyék a földön
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.ellipse(cam.X(this.cx + 0.4), cam.Y(0), (this.w / 2 + 1) * s, 0.35 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      // hátsó mélységlap (2.5D)
      for (const b of this.bricks) {
        if (!b.alive) continue;
        const y0 = b.set ? b.y0 : b.fy;
        ctx.fillStyle = night ? '#3a1d17' : '#6e2e22';
        ctx.fillRect(cam.X(b.x0 + depth), cam.Y(y0 + this.bh + depth), (b.x1 - b.x0) * s + 1, this.bh * s + 1);
      }
      for (const b of this.bricks) {
        if (!b.alive) continue;
        const y0 = b.set ? b.y0 : b.fy;
        const X = cam.X(b.x0), Y = cam.Y(y0 + this.bh);
        const w = (b.x1 - b.x0) * s, h = this.bh * s;
        ctx.save();
        if (b.rot) { ctx.translate(X + w / 2, Y + h / 2); ctx.rotate(b.rot); ctx.translate(-X - w / 2, -Y - h / 2); }
        // teteje (ha fölötte nincs tégla)
        const above = this.grid[b.row + 1];
        const covered = above && above.some(o => o.alive && o.set && o.x0 < b.x1 - 0.05 && o.x1 > b.x0 + 0.05);
        if (!covered || !b.set) {
          ctx.fillStyle = night ? '#a0574a' : '#e08a6c';
          ctx.beginPath();
          ctx.moveTo(X, Y); ctx.lineTo(X + depth * s, Y - depth * s);
          ctx.lineTo(X + w + depth * s, Y - depth * s); ctx.lineTo(X + w, Y); ctx.closePath(); ctx.fill();
        }
        const L = 38 + b.tint * 14;
        const hue = 8 + b.tint * 10;
        ctx.fillStyle = `hsl(${hue},${night ? 35 : 58}%,${night ? L * 0.55 : L}%)`;
        ctx.fillRect(X, Y, w, h);
        // csillogás + árnyék
        ctx.fillStyle = 'rgba(255,255,255,0.13)';
        ctx.fillRect(X, Y, w, h * 0.28);
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(X, Y + h * 0.75, w, h * 0.25);
        // habarcs
        ctx.strokeStyle = night ? 'rgba(160,150,140,0.5)' : 'rgba(235,220,200,0.75)';
        ctx.lineWidth = Math.max(1, s * 0.06);
        ctx.strokeRect(X + 0.5, Y + 0.5, w - 1, h - 1);
        // repedések
        if (b.crack) {
          ctx.strokeStyle = 'rgba(30,10,5,0.85)';
          ctx.lineWidth = Math.max(1, s * 0.05);
          let sd = b.crackSeed;
          const rnd = () => ((sd = (sd * 9301 + 49297) % 233280) / 233280);
          for (let c = 0; c < b.crack; c++) {
            ctx.beginPath();
            let px = X + rnd() * w, py = Y;
            ctx.moveTo(px, py);
            for (let k = 0; k < 3; k++) { px += (rnd() - 0.5) * w * 0.5; py += h / 3; ctx.lineTo(px, py); }
            ctx.stroke();
          }
        }
        ctx.restore();
      }
    }
  }
  TD.Wall = Wall;
})();
