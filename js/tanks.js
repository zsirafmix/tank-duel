/* GIGÁSZOK CSATÁJA – harckocsik és a rajzfilmes parancsnokok */
(function () {
  'use strict';
  const TD = window.TD;

  // A feldolgozott (rajzfilmesített) fejek arcpontjai a PNG pixelkoordinátáiban
  const FACES = (TD.FACES = {
    gazi: { src: 'assets/images/gazi_head.png', w: 209, h: 268, eyes: [[44, 159], [109, 165.5]], mouth: [76.5, 230.5], skin: '#e3a27c', shirt: '#1f2b4d', shirt2: '#2c3c66', hoodie: false },
    zsolesz: { src: 'assets/images/zsolesz_head.png', w: 213, h: 268, eyes: [[66.7, 128], [135.1, 129.6]], mouth: [102.3, 199.1], skin: '#efbea4', shirt: '#b4b8bf', shirt2: '#d0d3d8', hoodie: true },
  });

  function loadFace(key) {
    const f = FACES[key];
    if (f.img) return f;
    f.img = new Image();
    f.ready = false;
    f.img.onload = () => {
      f.ready = true;
      const mk = (col) => {
        const c = document.createElement('canvas');
        c.width = f.img.naturalWidth; c.height = f.img.naturalHeight;
        const x = c.getContext('2d');
        x.drawImage(f.img, 0, 0);
        x.globalCompositeOperation = 'source-atop';
        x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
        return c;
      };
      f.soot = mk('rgba(35,25,20,0.82)');
      f.red = mk('rgba(255,40,30,0.55)');
    };
    f.img.src = f.src;
    return f;
  }
  TD.loadFace = loadFace;

  const EXPR = {
    idle: {},
    aim: { brows: 'angry', mouth: 'tongue' },
    fire: { brows: 'up', mouth: 'O', arms: 'punch' },
    scared: { brows: 'worried', eyes: 'wide', mouth: 'O', sweat: true, arms: 'cover', pop: 1.15 },
    hit: { brows: 'worried', eyes: 'spiral', mouth: 'wavy', stars: true, squash: true, arms: 'flail', pop: 1.3 },
    happy: { brows: 'up', eyes: 'closed', mouth: 'grin', bob: true, arms: 'up', pop: 1.35 },
    laugh: { brows: 'smug', eyes: 'closed', mouth: 'grin', bob: true, arms: 'belly', pop: 1.2 },
    annoyed: { brows: 'angry', mouth: 'frown', arms: 'cross' },
    win: { brows: 'up', eyes: 'closed', mouth: 'grin', bob: true, arms: 'wave', pop: 1.5 },
    lose: { brows: 'worried', eyes: 'x', mouth: 'wavy', stars: true, flag: true, sweat: true },
  };
  TD.EXPR = EXPR;

  const PAL = {
    green: { base: '#5a9a3c', light: '#8fd062', dark: '#2f5c20', top: '#a6dd78', accent: '#ffd23f', flag: '#3fdc5a' },
    grey: { base: '#7f878f', light: '#b9c1c8', dark: '#474e55', top: '#cfd6dc', accent: '#ff6b3d', flag: '#ff8a3d' },
  };

  class Tank {
    constructor(idx, opts) {
      this.idx = idx;
      this.dir = idx === 0 ? 1 : -1;
      this.x = TD.CFG.TANK_X[idx];
      this.y = 0;
      this.faceKey = opts.face;
      this.face = loadFace(opts.face);
      this.pal = PAL[opts.color];
      this.color = opts.color;
      this.name = opts.name;
      this.emblem = opts.emblem || this.name.slice(0, 1);
      this.reset();
    }
    reset() {
      this.hp = 100;
      this.dead = false;
      this.angle = 45; this.power = 60;
      this.dispAngle = 45;
      this.recoil = 0;
      this.jy = 0; this.jvy = 0;
      this.expr = 'idle'; this.exprT = 0;
      this.soot = 0; this.hitFlash = 0;
      this.marks = [];
      this.tread = 0;
      this.time = Math.random() * 10;
      this.bubble = null;
      this.pop = { y: 0, vy: 0, rot: 0, vr: 0, on: false };
      this.headPop = 1;
      this.lastPath = null;
      this.stats = { shots: 0, hits: 0, dmg: 0 };
      this.y = TD.Terrain.height(this.x);
    }
    setExpr(e, dur) { this.expr = e; this.exprT = dur == null ? 2 : dur; }
    say(text, dur) { this.bubble = { text, t: dur || 2.2, max: dur || 2.2 }; }
    hop(v) { if (this.jy <= 0.01) this.jvy = v; }

    get pivot() {
      return { x: this.x + this.dir * 0.9, y: this.y + this.jy + 2.75 };
    }
    muzzle(angle) {
      const a = ((angle == null ? this.angle : angle) * Math.PI) / 180;
      const p = this.pivot, L = 3.5;
      return { x: p.x + Math.cos(a) * L * this.dir, y: p.y + Math.sin(a) * L };
    }
    headWorld() {
      return { x: this.x - this.dir * 0.55, y: this.y + this.jy + 5.5 };
    }
    center() { return { x: this.x, y: this.y + 1.4 }; }
    exhaust() { return { x: this.x - this.dir * 3.4, y: this.y + 2.3 }; }

    /** Közvetlen találat vizsgálata (test + torony + parancsnok) */
    hitTest(x, y, r) {
      const bx = this.x, by = this.y;
      if (Math.abs(x - bx) <= 3.7 + r && y >= by - r && y <= by + 2.35 + r) return true;
      if (Math.abs(x - (bx - 0.2 * this.dir)) <= 1.85 + r && y >= by + 2.2 && y <= by + 3.55 + r) return true;
      const h = { x: bx - this.dir * 0.55, y: by + 5.5 };
      if (Math.hypot(x - h.x, y - h.y) <= 1.1 + r) return true;
      if (Math.abs(x - h.x) <= 0.75 + r && y >= by + 3.4 && y <= by + 4.6) return true;
      return false;
    }
    /** Távolság a harckocsi testétől (közeli robbanás sebzéséhez) */
    distTo(x, y) {
      const cx = Math.max(this.x - 3.7, Math.min(x, this.x + 3.7));
      const cy = Math.max(this.y, Math.min(y, this.y + 3.5));
      return Math.hypot(x - cx, y - cy);
    }
    addDamageMarks(n) {
      for (let i = 0; i < n; i++) {
        this.marks.push({
          x: -3 + Math.random() * 6.3, y: -(1.35 + Math.random() * 0.65),
          r: 0.18 + Math.random() * 0.3, type: Math.random() < 0.45 ? 'hole' : Math.random() < 0.5 ? 'dent' : 'scorch',
        });
      }
      if (this.marks.length > 30) this.marks.splice(0, this.marks.length - 30);
    }

    update(dt) {
      this.time += dt;
      if (this.exprT > 0) {
        this.exprT -= dt;
        if (this.exprT <= 0 && !this.dead && this.expr !== 'win') this.expr = 'idle';
      }
      this.recoil = Math.max(0, this.recoil - dt * 2.2);
      this.dispAngle += (this.angle - this.dispAngle) * Math.min(1, dt * 14);
      // ugrás
      if (this.jy > 0 || this.jvy > 0) {
        this.jvy -= 30 * dt; this.jy += this.jvy * dt;
        if (this.jy <= 0) { this.jy = 0; this.jvy = Math.abs(this.jvy) > 3 ? -this.jvy * 0.3 : 0; }
      }
      const base = (1 - this.hp / 100) * 0.25;
      this.soot = Math.max(base, this.soot - dt * 0.12);
      this.hitFlash = Math.max(0, this.hitFlash - dt * 2.5);
      this.tread += dt * 0.6;
      if (this.bubble) { this.bubble.t -= dt; if (this.bubble.t <= 0) this.bubble = null; }
      const target = (EXPR[this.expr] && EXPR[this.expr].pop) || 1;
      this.headPop += (target - this.headPop) * Math.min(1, dt * 8);
      const p = this.pop;
      if (p.on) {
        p.vy -= 25 * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        if (p.y <= 0.15 && p.vy < 0) { p.y = 0.15; p.vy = 0; p.vr = 0; }
      }
    }

    // ---------------- rajzolás ----------------
    draw(ctx, cam, env) {
      const s = cam.s, d = this.dir, pal = this.pal;
      const t = this.time;
      ctx.save();
      ctx.translate(cam.X(this.x), cam.Y(this.y + this.jy));
      // árnyék
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath(); ctx.ellipse(0.3 * s, (this.jy) * s, 4.2 * s, 0.45 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.scale(s * d, s);
      const lw = 0.07;
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      const charA = Math.min(0.75, (1 - this.hp / 100) * 0.3 + (this.dead ? 0.45 : 0));
      const night = env.night;
      const shade = (c) => c;

      // --- lánctalp ---
      ctx.fillStyle = '#26272b';
      rr(ctx, -3.4, -1.12, 6.8, 1.12, 0.56); ctx.fill();
      ctx.strokeStyle = '#111'; ctx.lineWidth = lw; ctx.stroke();
      ctx.strokeStyle = '#4a4c52'; ctx.lineWidth = 0.08;
      const ph = (this.tread % 0.4);
      for (let x = -3.0 + ph; x < 3.0; x += 0.4) {
        ctx.beginPath(); ctx.moveTo(x, -1.12); ctx.lineTo(x + 0.05, -1.0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 0.05, -0.12); ctx.stroke();
      }
      for (let i = 0; i < 5; i++) {
        const wx = -2.6 + i * 1.3;
        ctx.fillStyle = '#5b5e66'; ctx.beginPath(); ctx.arc(wx, -0.55, 0.42, 0, 7); ctx.fill();
        ctx.fillStyle = '#9aa0a8'; ctx.beginPath(); ctx.arc(wx, -0.55, 0.2, 0, 7); ctx.fill();
        ctx.strokeStyle = '#2d2f34'; ctx.lineWidth = 0.06;
        for (let k = 0; k < 3; k++) {
          const a = this.tread * 3 + k * 2.09;
          ctx.beginPath(); ctx.moveTo(wx, -0.55); ctx.lineTo(wx + Math.cos(a) * 0.38, -0.55 + Math.sin(a) * 0.38); ctx.stroke();
        }
      }
      // --- sárvédő ---
      ctx.fillStyle = pal.dark;
      ctx.beginPath(); ctx.moveTo(-3.65, -1.05); ctx.lineTo(3.75, -1.05); ctx.lineTo(3.45, -1.32); ctx.lineTo(-3.45, -1.32); ctx.closePath(); ctx.fill();
      // --- test ---
      const hullPath = () => { ctx.beginPath(); ctx.moveTo(-3.5, -1.25); ctx.lineTo(3.95, -1.25); ctx.lineTo(3.1, -2.08); ctx.lineTo(-3.2, -2.08); ctx.closePath(); };
      let g = ctx.createLinearGradient(0, -2.1, 0, -1.2);
      g.addColorStop(0, pal.light); g.addColorStop(0.45, pal.base); g.addColorStop(1, pal.dark);
      hullPath(); ctx.fillStyle = g; ctx.fill();
      if (charA > 0) { ctx.fillStyle = `rgba(25,18,12,${charA})`; ctx.fill(); }
      ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = lw; hullPath(); ctx.stroke();
      // teteje (2.5D)
      ctx.fillStyle = pal.top;
      ctx.beginPath(); ctx.moveTo(-3.2, -2.08); ctx.lineTo(3.1, -2.08); ctx.lineTo(2.75, -2.38); ctx.lineTo(-2.95, -2.38); ctx.closePath(); ctx.fill();
      if (charA > 0) { ctx.fillStyle = `rgba(25,18,12,${charA})`; ctx.fill(); }
      ctx.stroke();
      // szegecsek
      ctx.fillStyle = pal.dark;
      for (let x = -3.0; x < 3.4; x += 0.55) { ctx.beginPath(); ctx.arc(x, -1.42, 0.06, 0, 7); ctx.fill(); }
      // fényszóró
      ctx.fillStyle = night ? '#fff6b0' : '#ffe9a0';
      ctx.beginPath(); ctx.arc(3.55, -1.75, 0.17, 0, 7); ctx.fill(); ctx.strokeStyle = '#333'; ctx.lineWidth = 0.05; ctx.stroke();
      // szerszámláda + kipufogó
      ctx.fillStyle = pal.dark; rr(ctx, -3.15, -2.75, 0.95, 0.42, 0.06); ctx.fill(); ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 0.05; ctx.stroke();
      ctx.fillStyle = '#444'; rr(ctx, -3.55, -2.35, 0.38, 0.5, 0.08); ctx.fill();
      // embléma
      ctx.save(); ctx.translate(-1.55, -1.66); ctx.scale(d, 1);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 0.34, 0, 7); ctx.fill();
      ctx.strokeStyle = pal.accent; ctx.lineWidth = 0.08; ctx.stroke();
      ctx.fillStyle = pal.dark; ctx.font = 'bold 0.42px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(this.emblem, 0, 0.02);
      ctx.restore();
      // sérülésnyomok
      for (const m of this.marks) {
        if (m.type === 'hole') {
          ctx.fillStyle = '#1b1b1b'; ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 0.55, 0, 7); ctx.fill();
          ctx.strokeStyle = 'rgba(200,200,200,0.5)'; ctx.lineWidth = 0.05; ctx.stroke();
        } else if (m.type === 'dent') {
          ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(m.x, m.y, m.r, m.r * 0.6, 0.4, 0, 7); ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.04; ctx.beginPath(); ctx.ellipse(m.x, m.y, m.r, m.r * 0.6, 0.4, 3.4, 5.5); ctx.stroke();
        } else {
          const sg = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 1.6);
          sg.addColorStop(0, 'rgba(10,8,6,0.75)'); sg.addColorStop(1, 'rgba(10,8,6,0)');
          ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 1.6, 0, 7); ctx.fill();
        }
      }

      // --- torony csoport (halálkor leröppen) ---
      ctx.save();
      if (this.pop.on) { ctx.translate(-0.2, -2.6 - this.pop.y); ctx.rotate(-this.pop.rot); ctx.translate(0.2, 2.6); }
      // antenna (hajlik a széllel)
      const wind = (env.wind || 0) * d;
      const sway = Math.sin(t * 3) * 0.06 + wind * 0.035;
      ctx.strokeStyle = '#222'; ctx.lineWidth = 0.05;
      ctx.beginPath(); ctx.moveTo(-1.55, -3.0);
      const bentA = this.hp < 60 ? 0.5 : 0;
      ctx.quadraticCurveTo(-1.55 + sway * 6 + bentA * 0.6, -4.3, -1.55 + sway * 14 + bentA * 1.4, -5.4 + bentA * 0.8); ctx.stroke();
      const fx = -1.55 + sway * 14 + bentA * 1.4, fy = -5.4 + bentA * 0.8;
      const fd = wind >= 0 ? 1 : -1;
      ctx.fillStyle = pal.flag;
      ctx.beginPath(); ctx.moveTo(fx, fy);
      const fl = 0.6 + Math.min(0.6, Math.abs(wind) * 0.06);
      ctx.quadraticCurveTo(fx + fd * fl * 0.5, fy + 0.1 + Math.sin(t * 9) * 0.1, fx + fd * fl, fy + 0.18);
      ctx.lineTo(fx, fy + 0.4); ctx.closePath(); ctx.fill();

      // ágyúcső
      const a = (this.dispAngle * Math.PI) / 180;
      ctx.save(); ctx.translate(0.9, -2.75); ctx.rotate(-a);
      const rc = -this.recoil * 0.7;
      g = ctx.createLinearGradient(0, -0.2, 0, 0.2);
      g.addColorStop(0, pal.light); g.addColorStop(0.5, pal.base); g.addColorStop(1, pal.dark);
      ctx.fillStyle = g; rr(ctx, rc, -0.17, 3.15, 0.34, 0.08); ctx.fill(); ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 0.05; ctx.stroke();
      ctx.fillStyle = pal.dark; rr(ctx, rc + 2.95, -0.25, 0.6, 0.5, 0.08); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#111'; ctx.fillRect(rc + 3.5, -0.12, 0.06, 0.24);
      ctx.restore();
      // torony
      g = ctx.createLinearGradient(0, -3.6, 0, -2.3);
      g.addColorStop(0, pal.top); g.addColorStop(0.5, pal.base); g.addColorStop(1, pal.dark);
      ctx.fillStyle = pal.dark; rr(ctx, -2.0, -2.62, 3.6, 0.32, 0.1); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-0.2, -2.6, 1.85, 0.95, 0, Math.PI, 0); ctx.closePath();
      ctx.fillStyle = g; ctx.fill();
      if (charA > 0) { ctx.fillStyle = `rgba(25,18,12,${charA})`; ctx.fill(); }
      ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = lw; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 0.09;
      ctx.beginPath(); ctx.ellipse(-0.3, -2.65, 1.5, 0.72, 0, Math.PI * 1.15, Math.PI * 1.55); ctx.stroke();
      // ágyúpajzs
      ctx.fillStyle = pal.dark; ctx.beginPath(); ctx.arc(0.95, -2.75, 0.42, 0, 7); ctx.fill(); ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 0.05; ctx.stroke();

      // --- parancsnok ---
      this.drawCommander(ctx, env);
      ctx.restore(); // torony csoport
      ctx.restore();
    }

    drawCommander(ctx, env) {
      const f = this.face, d = this.dir, t = this.time;
      const ex = EXPR[this.expr] || EXPR.idle;
      const cx = -0.55, hatchY = -3.45;
      let bob = 0;
      if (ex.bob) bob = Math.abs(Math.sin(t * 9)) * 0.25;
      else bob = Math.sin(t * 1.7) * 0.04;
      // nyitott búvónyílás fedele (mögötte)
      ctx.fillStyle = this.pal.dark;
      ctx.save(); ctx.translate(cx - 0.85, hatchY); ctx.rotate(-1.2); rr(ctx, -0.05, -0.08, 1.0, 0.16, 0.05); ctx.fill(); ctx.restore();
      const body = { x: cx, y: hatchY - bob };
      // törzs
      const shW = 1.45, shH = 1.05;
      ctx.fillStyle = f.shirt;
      ctx.beginPath();
      ctx.moveTo(body.x - shW / 2, body.y + 0.1);
      ctx.lineTo(body.x - shW / 2, body.y - shH + 0.25);
      ctx.quadraticCurveTo(body.x - shW / 2, body.y - shH, body.x - shW / 2 + 0.3, body.y - shH);
      ctx.lineTo(body.x + shW / 2 - 0.3, body.y - shH);
      ctx.quadraticCurveTo(body.x + shW / 2, body.y - shH, body.x + shW / 2, body.y - shH + 0.25);
      ctx.lineTo(body.x + shW / 2, body.y + 0.1);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#141414'; ctx.lineWidth = 0.06; ctx.stroke();
      if (f.hoodie) {
        ctx.fillStyle = f.shirt2;
        ctx.beginPath(); ctx.ellipse(body.x, body.y - shH + 0.02, 0.55, 0.22, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#8b9096'; ctx.lineWidth = 0.05;
        ctx.beginPath(); ctx.moveTo(body.x, body.y - shH + 0.2); ctx.lineTo(body.x, body.y + 0.05); ctx.stroke();
        ctx.strokeStyle = '#eee'; ctx.lineWidth = 0.04;
        ctx.beginPath(); ctx.moveTo(body.x - 0.15, body.y - shH + 0.2); ctx.lineTo(body.x - 0.18, body.y - 0.45); ctx.moveTo(body.x + 0.15, body.y - shH + 0.2); ctx.lineTo(body.x + 0.18, body.y - 0.45); ctx.stroke();
      } else {
        ctx.save(); ctx.translate(body.x, body.y - 0.42); ctx.scale(d, 1);
        ctx.fillStyle = '#e8e8e8'; ctx.font = 'bold 0.2px Arial'; ctx.textAlign = 'center';
        ctx.fillText('I AM TOTAL', 0, 0); ctx.restore();
      }
      // nyak
      ctx.fillStyle = f.skin; ctx.fillRect(body.x - 0.2, body.y - shH - 0.2, 0.4, 0.3);

      // fej
      const hp = this.headPop;
      const headH = 2.3 * hp;
      const hx = body.x, hy = body.y - shH - headH * 0.47;
      ctx.save();
      ctx.translate(hx, hy + headH * 0.47);
      let sx = 1, sy = 1, rot = 0;
      if (ex.squash) { const k = Math.sin(t * 22) * Math.max(0, this.exprT) * 0.08; sx = 1 + k; sy = 1 - k; }
      if (this.expr === 'laugh') rot = Math.sin(t * 14) * 0.08;
      if (this.expr === 'lose') rot = 0.25 + Math.sin(t * 2) * 0.05;
      if (this.expr === 'idle' || this.expr === 'aim') rot = Math.sin(t * 1.3) * 0.03;
      ctx.rotate(rot);
      ctx.scale(sx * d, sy); // fej visszatükrözése: az arc sosem tükröződik
      ctx.translate(0, -headH * 0.47);
      const k = headH / f.h;
      ctx.scale(k, k);
      ctx.translate(-f.w / 2, -f.h / 2);
      if (f.ready) {
        ctx.drawImage(f.img, 0, 0);
        const soot = this.dead ? 0.6 : this.soot;
        if (soot > 0.01 && f.soot) { ctx.globalAlpha = Math.min(this.dead ? 0.6 : 0.45, soot); ctx.drawImage(f.soot, 0, 0); ctx.globalAlpha = 1; }
        if (this.hitFlash > 0 && f.red) { ctx.globalAlpha = this.hitFlash * 0.8; ctx.drawImage(f.red, 0, 0); ctx.globalAlpha = 1; }
      } else {
        ctx.fillStyle = f.skin; ctx.beginPath(); ctx.ellipse(f.w / 2, f.h / 2, f.w / 2, f.h / 2, 0, 0, 7); ctx.fill();
      }
      drawFaceOverlay(ctx, f, ex, t, this);
      // fejhallgató
      ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 11;
      ctx.beginPath(); ctx.ellipse(f.w / 2, f.h * 0.52, f.w / 2 + 3, f.h * 0.5 + 2, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      for (const side of [0, 1]) {
        const ux = side ? f.w - 4 : 4;
        ctx.fillStyle = this.pal.dark;
        rr(ctx, ux - 14, f.h * 0.42, 28, 50, 10); ctx.fill();
        ctx.strokeStyle = '#111'; ctx.lineWidth = 4; ctx.stroke();
        ctx.fillStyle = this.pal.accent; ctx.beginPath(); ctx.arc(ux, f.h * 0.42 + 25, 6, 0, 7); ctx.fill();
      }
      ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(10, f.h * 0.42 + 45); ctx.quadraticCurveTo(20, f.mouth[1] + 10, f.mouth[0] - 30, f.mouth[1] + 4); ctx.stroke();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(f.mouth[0] - 30, f.mouth[1] + 4, 7, 0, 7); ctx.fill();
      ctx.restore();

      // csillagok a fej körül
      if (ex.stars) {
        for (let i = 0; i < 4; i++) {
          const a = t * 4 + i * (Math.PI / 2);
          star(ctx, hx + Math.cos(a) * 1.3 * hp, hy - headH * 0.45 + Math.sin(a) * 0.3, 0.22, '#ffe14a');
        }
      }
      // búvónyílás pereme (előtte)
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.ellipse(cx, hatchY + 0.05, 0.9, 0.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = this.pal.dark; ctx.beginPath(); ctx.ellipse(cx, hatchY + 0.12, 0.92, 0.15, 0, 0, Math.PI); ctx.fill();
      // karok
      this.drawArms(ctx, body, shW, shH, ex, t, f);
    }

    drawArms(ctx, body, shW, shH, ex, t, f) {
      const sh = [{ x: body.x - shW / 2 + 0.12, y: body.y - shH + 0.18 }, { x: body.x + shW / 2 - 0.12, y: body.y - shH + 0.18 }];
      const hands = [];
      const mode = ex.arms || 'rest';
      for (let i = 0; i < 2; i++) {
        const s = i ? 1 : -1, p = sh[i];
        let hx, hy, ex_, ey;
        if (mode === 'up' || mode === 'wave') {
          const w = mode === 'wave' ? Math.sin(t * 10 + i * 3) * 0.35 : Math.sin(t * 12 + i) * 0.15;
          ex_ = p.x + s * 0.55; ey = p.y - 0.5; hx = p.x + s * (0.7 + w); hy = p.y - 1.35;
        } else if (mode === 'flail') {
          const a = t * 16 + i * 2;
          ex_ = p.x + s * 0.5; ey = p.y - 0.1; hx = ex_ + Math.cos(a) * 0.6; hy = ey + Math.sin(a) * 0.6;
        } else if (mode === 'punch' && i === 1) {
          ex_ = p.x + 0.5; ey = p.y - 0.45; hx = p.x + 0.6; hy = p.y - 1.3;
        } else if (mode === 'cover') {
          ex_ = p.x + s * 0.4; ey = p.y + 0.1; hx = body.x + s * 0.3; hy = p.y - 0.7;
        } else if (mode === 'belly') {
          ex_ = p.x + s * 0.45; ey = p.y + 0.35; hx = body.x + s * 0.15; hy = body.y - 0.3;
        } else if (mode === 'cross') {
          ex_ = p.x + s * 0.3; ey = p.y + 0.45; hx = body.x - s * 0.35; hy = p.y + 0.35;
        } else {
          ex_ = p.x + s * 0.35; ey = p.y + 0.45; hx = p.x + s * 0.55; hy = body.y + 0.05;
        }
        if (ex.flag && i === 0) { ex_ = p.x - 0.4; ey = p.y - 0.4; hx = p.x - 0.5; hy = p.y - 1.1; }
        ctx.strokeStyle = f.shirt; ctx.lineWidth = 0.34;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(ex_, ey); ctx.lineTo(hx, hy); ctx.stroke();
        ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.04; ctx.stroke();
        hands.push([hx, hy]);
      }
      if (ex.flag) {
        const [hx, hy] = hands[0];
        ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 0.08;
        ctx.beginPath(); ctx.moveTo(hx, hy + 0.3); ctx.lineTo(hx, hy - 1.8); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.strokeStyle = '#999'; ctx.lineWidth = 0.03;
        ctx.beginPath(); ctx.moveTo(hx, hy - 1.8);
        for (let k = 0; k <= 6; k++) ctx.lineTo(hx - k * 0.2, hy - 1.8 + Math.sin(t * 8 + k) * 0.08);
        for (let k = 6; k >= 0; k--) ctx.lineTo(hx - k * 0.2, hy - 1.1 + Math.sin(t * 8 + k) * 0.08);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      for (const [hx, hy] of hands) {
        ctx.fillStyle = f.skin; ctx.beginPath(); ctx.arc(hx, hy, 0.21, 0, 7); ctx.fill();
        ctx.strokeStyle = '#3a2418'; ctx.lineWidth = 0.04; ctx.stroke();
      }
    }
  }

  function drawFaceOverlay(ctx, f, ex, t, tank) {
    const [e1, e2] = f.eyes, m = f.mouth;
    const er = f.w * 0.085;
    const ink = '#24160f';
    // szemek
    if (ex.eyes) {
      for (const [i, e] of [[0, e1], [1, e2]]) {
        if (ex.eyes === 'wide' || ex.eyes === 'spiral') {
          ctx.fillStyle = '#fff'; ctx.strokeStyle = ink; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(e[0], e[1], er * 1.25, 0, 7); ctx.fill(); ctx.stroke();
          if (ex.eyes === 'wide') {
            ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(e[0] + Math.sin(t * 7) * 3, e[1] + 2, er * 0.45, 0, 7); ctx.fill();
          } else {
            ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.beginPath();
            for (let a = 0; a < 14; a += 0.3) { const r = a * er * 0.08; const aa = a * (i ? -1 : 1) + t * 10; ctx.lineTo(e[0] + Math.cos(aa) * r, e[1] + Math.sin(aa) * r); }
            ctx.stroke();
          }
        } else if (ex.eyes === 'closed') {
          ctx.fillStyle = f.skin; ctx.beginPath(); ctx.ellipse(e[0], e[1], er * 1.15, er * 0.9, 0, 0, 7); ctx.fill();
          ctx.strokeStyle = ink; ctx.lineWidth = 6;
          ctx.beginPath(); ctx.arc(e[0], e[1] + er * 0.5, er * 0.8, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
        } else if (ex.eyes === 'x') {
          ctx.fillStyle = f.skin; ctx.beginPath(); ctx.ellipse(e[0], e[1], er * 1.15, er * 0.9, 0, 0, 7); ctx.fill();
          ctx.strokeStyle = ink; ctx.lineWidth = 6;
          ctx.beginPath(); ctx.moveTo(e[0] - er * 0.7, e[1] - er * 0.7); ctx.lineTo(e[0] + er * 0.7, e[1] + er * 0.7);
          ctx.moveTo(e[0] + er * 0.7, e[1] - er * 0.7); ctx.lineTo(e[0] - er * 0.7, e[1] + er * 0.7); ctx.stroke();
        }
      }
    }
    // szemöldök
    if (ex.brows) {
      ctx.strokeStyle = ink; ctx.lineWidth = 9; ctx.lineCap = 'round';
      const mid = (e1[0] + e2[0]) / 2;
      for (const e of [e1, e2]) {
        const inner = e[0] < mid ? 1 : -1; // a belső vég iránya
        const by = e[1] - er * 2.1;
        let yi = 0, yo = 0;
        if (ex.brows === 'angry') { yi = 10; yo = -6; }
        else if (ex.brows === 'worried') { yi = -10; yo = 6; }
        else if (ex.brows === 'up') { yi = -12; yo = -12; }
        else if (ex.brows === 'smug') { if (inner > 0) { yi = -16; yo = -16; } else { yi = 6; yo = 0; } }
        ctx.beginPath();
        ctx.moveTo(e[0] - inner * er * 1.2, by + yo);
        ctx.quadraticCurveTo(e[0], by + Math.min(yi, yo) - 6, e[0] + inner * er * 1.1, by + yi);
        ctx.stroke();
      }
    }
    // száj
    const mw = f.w * 0.17;
    if (ex.mouth === 'O') {
      ctx.fillStyle = '#5a1212'; ctx.strokeStyle = ink; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(m[0], m[1], mw * 0.5, mw * 0.65 + Math.sin(t * 18) * 2, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e05a6a'; ctx.beginPath(); ctx.ellipse(m[0], m[1] + mw * 0.35, mw * 0.32, mw * 0.2, 0, 0, 7); ctx.fill();
    } else if (ex.mouth === 'grin') {
      ctx.fillStyle = '#5a1212'; ctx.strokeStyle = ink; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(m[0] - mw * 1.15, m[1] - 6);
      ctx.quadraticCurveTo(m[0], m[1] - 14, m[0] + mw * 1.15, m[1] - 6);
      ctx.quadraticCurveTo(m[0], m[1] + mw * 1.4, m[0] - mw * 1.15, m[1] - 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.moveTo(m[0] - mw * 0.95, m[1] - 6); ctx.quadraticCurveTo(m[0], m[1] - 12, m[0] + mw * 0.95, m[1] - 6);
      ctx.lineTo(m[0] + mw * 0.8, m[1] + 2); ctx.quadraticCurveTo(m[0], m[1] - 2, m[0] - mw * 0.8, m[1] + 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e05a6a'; ctx.beginPath(); ctx.ellipse(m[0], m[1] + mw * 0.55, mw * 0.4, mw * 0.18, 0, 0, 7); ctx.fill();
    } else if (ex.mouth === 'tongue') {
      ctx.fillStyle = '#e8606e'; ctx.strokeStyle = ink; ctx.lineWidth = 3;
      const tx = m[0] + mw * 0.6;
      ctx.beginPath(); ctx.ellipse(tx, m[1] + 9 + Math.sin(t * 5) * 2, 9, 13, 0.3, 0, 7); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(tx, m[1] + 4); ctx.lineTo(tx + 1, m[1] + 16); ctx.stroke();
    } else if (ex.mouth === 'frown') {
      ctx.fillStyle = f.skin; ctx.beginPath(); ctx.ellipse(m[0], m[1], mw * 1.05, mw * 0.45, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = ink; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.arc(m[0], m[1] + mw * 0.7, mw * 0.8, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke();
    } else if (ex.mouth === 'wavy') {
      ctx.fillStyle = '#5a1212'; ctx.strokeStyle = ink; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(m[0], m[1] + 2, mw * 0.95, mw * 0.5, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath();
      for (let i = 0; i <= 8; i++) ctx.lineTo(m[0] - mw * 0.8 + (i * mw * 1.6) / 8, m[1] + 2 + (i % 2 ? 5 : -5));
      ctx.stroke();
    }
    // izzadságcseppek
    if (ex.sweat) {
      for (let i = 0; i < 3; i++) {
        const ph = (t * 1.3 + i * 0.33) % 1;
        const sx = i % 2 ? f.w * 0.86 : f.w * 0.12, sy = f.h * 0.3 + ph * f.h * 0.3;
        ctx.globalAlpha = 1 - ph;
        ctx.fillStyle = '#7fd3ff'; ctx.strokeStyle = '#1f6fa8'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(sx, sy - 18); ctx.quadraticCurveTo(sx + 11, sy, sx, sy + 8); ctx.quadraticCurveTo(sx - 11, sy, sx, sy - 18); ctx.fill(); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    // pirospozsgás arc örömében
    if (ex.mouth === 'grin') {
      ctx.fillStyle = 'rgba(255,90,90,0.35)';
      ctx.beginPath(); ctx.ellipse(e1[0] - 4, e1[1] + er * 2.2, er, er * 0.6, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(e2[0] + 4, e2[1] + er * 2.2, er, er * 0.6, 0, 0, 7); ctx.fill();
    }
  }

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  function star(ctx, x, y, r, col) {
    ctx.fillStyle = col; ctx.strokeStyle = '#7a5a00'; ctx.lineWidth = r * 0.2;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const rr_ = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr_, y + Math.sin(a) * rr_); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  TD.draw = { rr, star };
  TD.Tank = Tank;
})();
