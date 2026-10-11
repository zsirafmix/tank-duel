/* GIGÁSZOK CSATÁJA, AVAGY ZSOLESZ, ÉS GAZI HARCA – fő játékmotor */
(function () {
  'use strict';
  const TD = window.TD;
  const P = TD.Physics, CFG = TD.CFG, UI = TD.UI;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ================= HANG (WebAudio szintézis) =================
  const Sound = (TD.Sound = {
    ctx: null, master: null, muted: false,
    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC(); } catch (e) { return; }
      const c = this.ctx;
      this.master = c.createGain();
      this.master.gain.value = this.muted ? 0 : 0.7;
      this.master.connect(c.destination);
      const len = c.sampleRate * 2;
      this.nbuf = c.createBuffer(1, len, c.sampleRate);
      const d = this.nbuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      // tankmotor: folyamatos alapjárati dübörgés
      this.eng = c.createOscillator(); this.eng.type = 'sawtooth'; this.eng.frequency.value = 38;
      const lfo = c.createOscillator(); lfo.frequency.value = 7; const lg = c.createGain(); lg.gain.value = 6; lfo.connect(lg); lg.connect(this.eng.frequency); lfo.start();
      const ef = c.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 170;
      this.engGain = c.createGain(); this.engGain.gain.value = 0;
      this.eng.connect(ef); ef.connect(this.engGain); this.engGain.connect(this.master); this.eng.start();
    },
    setMute(m) { this.muted = m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.02); },
    t() { return this.ctx ? this.ctx.currentTime : 0; },
    noise(dur, type, f0, f1, gain, delay) {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime + (delay || 0);
      const src = c.createBufferSource(); src.buffer = this.nbuf;
      const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      const g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t, Math.random()); src.stop(t + dur + 0.05);
    },
    tone(type, f0, f1, dur, gain, delay) {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime + (delay || 0);
      const o = c.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
    },
    boom() { this.noise(0.7, 'lowpass', 1400, 150, 0.9); this.tone('sine', 110, 35, 0.55, 0.9); this.tone('square', 60, 30, 0.2, 0.15); },
    explosion(big) { this.noise(big ? 1.8 : 1.1, 'lowpass', 1800, 80, big ? 1 : 0.8); this.tone('sine', 70, 22, big ? 1.2 : 0.8, 0.9); this.noise(0.25, 'highpass', 3000, 1200, 0.25); },
    bricks(n) { for (let i = 0; i < Math.min(12, n + 3); i++) { this.noise(0.09, 'bandpass', rand(1500, 3200), rand(600, 1200), 0.35, i * rand(0.03, 0.07)); this.tone('triangle', rand(260, 420), 120, 0.08, 0.12, i * 0.05); } },
    clack() { this.tone('triangle', rand(330, 420), 140, 0.07, 0.22); this.noise(0.05, 'bandpass', 2600, 1500, 0.18); },
    boing() { if (!this.ctx) return; const c = this.ctx, t = c.currentTime; const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.5); const v = c.createOscillator(); v.frequency.value = 22; const vg = c.createGain(); vg.gain.value = 40; v.connect(vg); vg.connect(o.frequency); const g = c.createGain(); g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.55); o.connect(g); g.connect(this.master); o.start(t); v.start(t); o.stop(t + 0.6); v.stop(t + 0.6); },
    whistleStart() {
      if (!this.ctx) return; this.whistleStop();
      const c = this.ctx; this.wo = c.createOscillator(); this.wo.type = 'sine'; this.wo.frequency.value = 900;
      this.wg = c.createGain(); this.wg.gain.value = 0.0001; this.wo.connect(this.wg); this.wg.connect(this.master); this.wo.start();
      this.wg.gain.exponentialRampToValueAtTime(0.06, c.currentTime + 0.4);
    },
    whistle(vy, speed) { if (this.wo) { this.wo.frequency.setTargetAtTime(clamp(700 + vy * 14, 250, 1600), this.ctx.currentTime, 0.05); this.wg.gain.setTargetAtTime(clamp(0.02 + speed * 0.0015, 0.02, 0.07), this.ctx.currentTime, 0.1); } },
    whistleStop() { if (this.wo) { try { this.wg.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.03); this.wo.stop(this.ctx.currentTime + 0.15); } catch (e) {} this.wo = null; } },
    engine(level) { if (this.engGain) this.engGain.gain.setTargetAtTime(level * 0.09, this.ctx.currentTime, 0.15); if (this.eng) this.eng.frequency.setTargetAtTime(36 + level * 30, this.ctx.currentTime, 0.2); },
    fanfare() { const n = [523, 659, 784, 1047, 784, 1047, 1319]; const d = [0.14, 0.14, 0.14, 0.3, 0.14, 0.14, 0.6]; let t = 0; n.forEach((f, i) => { this.tone('square', f, f * 0.999, d[i] + 0.05, 0.12, t); this.tone('triangle', f / 2, f / 2, d[i] + 0.05, 0.12, t); t += d[i]; }); },
    sad() { [392, 370, 349, 330].forEach((f, i) => this.tone('sawtooth', f, f * 0.97, i === 3 ? 0.8 : 0.3, 0.06, 0.4 + i * 0.32)); },
    thunder() { this.noise(2.8, 'lowpass', 600, 40, 0.9); },
    click() { this.tone('square', 900, 600, 0.05, 0.05); },
  });

  // ================= SZÖVEGEK =================
  const Q = {
    ouch: ['AÚÚÚ!', 'Ez fájt!', 'Anyaaaa!', 'Na neee!', 'A frizurám!!', 'Hé, ez új tank volt!', 'Csak súrolt!', 'Jaj, a fülem!', 'Ezt még visszakapod!'],
    direct: ['TELITALÁLAT!', 'Bumm, csatt!', 'Ezt nézd!', 'Juhééé!', 'Pontos, mint a svájci óra!', 'Na, ki a király?', 'Ez kemény volt!'],
    near: ['Majdnem telibe!', 'Érezted a szelét?', 'Megcsiklandoztalak!', 'Közel volt!'],
    miss: ['Haha, mellé!', 'Szemüveg kéne?', 'Ez a madaraknak szólt?', 'Hűű, de közel… NEM!', 'Bé-bé!', 'Gyakorolj még!'],
    wall: ['A fal az úr!', 'Bocs, fal!', 'Már megint ez a fal…', 'Téglaszállítás!', 'Hülye fal!'],
    self: ['Saját magamat?!', 'Ez nem így volt tervezve…', 'Upsz.'],
    scared: ['Jaj, jön!', 'Ne, ne, ne!', 'Fedezéket!'],
    aim: ['Hmmm…', 'Most figyelj!', 'Célzok…', 'Ez most talál!'],
    mason: ['A kőművesek nem pihennek!', 'Még egy sor tégla!', 'Magasabbra!', 'Habarcs rendel!'],
    win: ['{w} lett a Gigászok Gigásza!', '{l} most gyalog megy haza.', '{w} tankja fényesebb, mint valaha!', '{l}: „Csak a szél volt az oka!”', '{w} mától a fal fölötti lövések mestere!', '{l} tankját most a kőművesek javítják.'],
  };
  const fmt = (s, w, l) => s.replace('{w}', w).replace('{l}', l);
  function emblemOf(name) { const m = /^(zs|sz|cs|gy|ny|ty|ly|dz)/i.exec(name); const e = name.slice(0, m ? 2 : 1); return e.charAt(0).toUpperCase() + e.slice(1).toLowerCase(); }

  // ================= JÁTÉK =================
  const G = (TD.Game = {
    state: 'menu', paused: false, speed: 1,
    tanks: [], wall: new TD.Wall(CFG.WALL_X), proj: null,
    round: 1, current: 0, shotsInRound: 0, wind: 0,
    weather: 'clear', night: false, mode: 'classic', opponent: 'human',
    showPreview: true, previewMode: 'short', showLast: true,
    particles: [], rubble: [], craters: [], texts: [], lights: [],
    clouds: [], drops: [], stars: [], hills: [],
    time: 0, acc: 0, resolveT: 0, growT: 0, overT: 0, shake: 0, flash: 0, lightning: 0, lightningT: 5,
    history: [], ai: null, winShown: false, hopT: 0,
    cam: { s: 10, ox: 0, oy: 0, needH: 30, X(x) { return this.ox + x * this.s + this.dx; }, Y(y) { return this.oy - y * this.s + this.dy; }, dx: 0, dy: 0 },

    isAI(i) { return this.opponent !== 'human' && i === 1; },
    world() { return { tanks: this.tanks, wall: this.wall }; },

    start(settings) {
      Sound.init();
      const s = settings || UI.settings;
      this.mode = s.mode; this.opponent = s.opponent;
      this.previewMode = s.preview; this.showPreview = s.preview !== 'off';
      this.showLast = true;
      this.night = s.time === 'random' ? Math.random() < 0.4 : s.time === 'night';
      this.weather = s.weather === 'random' ? pick(['clear', 'clear', 'clouds', 'clouds', 'rain', 'snow', 'storm']) : s.weather;
      TD.Terrain.init((Math.random() * 1e9) | 0);
      const names = s.names || ['Gazi', 'Zsolesz'];
      this.tanks = [
        new TD.Tank(0, { face: 'gazi', color: 'green', name: names[0], emblem: emblemOf(names[0]) }),
        new TD.Tank(1, { face: 'zsolesz', color: 'grey', name: names[1], emblem: emblemOf(names[1]) }),
      ];
      this.tanks[1].angle = this.tanks[1].dispAngle = 45;
      this.wall = new TD.Wall(CFG.WALL_X);
      this.wall.cap = this.mode === 'endless' ? CFG.WALL_CAP_ENDLESS : CFG.WALL_CAP_CLASSIC;
      this.wall.onLand = (b) => { Sound.clack(); this.dust((b.x0 + b.x1) / 2, b.y0, 3, 0.4); this.shake = Math.max(this.shake, 0.08); };
      this.wall.growTo(1, true);
      this.round = 1; this.current = 0; this.shotsInRound = 0;
      this.proj = null; this.particles = []; this.rubble = []; this.craters = []; this.texts = []; this.history = [];
      this.winShown = false; this.paused = false; this.ai = null; this.acc = 0;
      this.newWind();
      this.genBackground();
      UI.setupGame(this);
      UI.showScreen('game'); UI.showPause(false);
      this.cam.needH = 30;
      Sound.engine(0.35);
      this.state = 'wallgrow'; this.growT = 0.6;
      UI.banner(`⚔️ CSATA! ⚔️<small>${TD.esc(names[0])} vs ${TD.esc(names[1])}</small>`, '#ffd23f');
    },
    toMenu() {
      this.state = 'menu'; this.paused = false; this.proj = null; Sound.whistleStop(); Sound.engine(0);
      UI.showPause(false); UI.showScreen('menu');
    },
    pause(on) {
      if (this.state === 'menu' || this.state === 'over') return;
      this.paused = on; UI.showPause(on);
      Sound.engine(on ? 0 : 0.35);
      if (on) Sound.whistleStop(); else if (this.proj) Sound.whistleStart();
    },
    toggleMute() { Sound.init(); Sound.setMute(!Sound.muted); UI.setMute(Sound.muted); try { localStorage.setItem('td_mute', Sound.muted ? '1' : '0'); } catch (e) {} },

    newWind() {
      let maxW = { clear: 4, clouds: 6, rain: 7, snow: 5, storm: 10 }[this.weather] || 5;
      if (this.mode === 'endless') maxW = Math.min(CFG.WIND_MAX, 2.5 + this.round * 0.6);
      this.wind = Math.round(rand(-maxW, maxW) * 10) / 10;
    },

    beginTurn(i) {
      this.current = i;
      this.state = 'aim';
      const t = this.tanks[i];
      t.setExpr('aim', 1.6);
      const ai = this.isAI(i);
      UI.banner(`${TD.esc(t.name.toUpperCase())} KÖVETKEZIK!<small>${ai ? '🤖 a gép céloz…' : i === 0 ? 'A/D szög · W/S erő · SPACE tűz' : '←/→ szög · ↑/↓ erő · ENTER tűz'}</small>`, i === 0 ? '#8dff6a' : '#e6ecf2');
      if (ai) {
        const L = TD.AI.LEVELS[this.opponent];
        this.ai = { phase: 'think', t: L.think, level: this.opponent };
        t.say('Hmm… 🤔', 1.4);
      } else this.ai = null;
    },

    fire() {
      if (this.state !== 'aim' || this.paused) return false;
      const t = this.tanks[this.current];
      const m = t.muzzle();
      const v = P.launch(t.angle, t.power, t.dir);
      this.proj = new TD.Projectile(this.current, m.x, m.y, v.vx, v.vy, this.wind);
      this.collide = TD.makeCollider(this.world(), this.current);
      t.stats.shots++;
      t.recoil = 1; t.setExpr('fire', 1.0); t.hop(2.5);
      if (Math.random() < 0.3) t.say(pick(['TŰZ!', 'Kapd el!', 'Ez a tiéd!', 'Bumm!']), 1.2);
      // torkolattűz
      const a = (t.angle * Math.PI) / 180;
      for (let i = 0; i < 14; i++) {
        const sp = rand(3, 12), aa = a + rand(-0.35, 0.35);
        this.particles.push({ type: i < 6 ? 'fire' : 'smoke', x: m.x, y: m.y, vx: Math.cos(aa) * sp * t.dir, vy: Math.sin(aa) * sp, life: rand(0.3, 1.2), max: 1.2, size: rand(0.3, 0.8), grow: 1.5, drag: 3 });
      }
      this.flashLight(m.x, m.y, 9, 0.9, '255,200,120');
      this.shake = Math.max(this.shake, 0.35);
      Sound.boom(); Sound.whistleStart();
      this.state = 'flight'; this.acc = 0; this.scaredDone = false;
      return true;
    },
    fireHuman() { Sound.init(); if (!this.isAI(this.current)) this.fire(); },
    setAimHuman(a, p) {
      if (this.state !== 'aim' || this.isAI(this.current)) return;
      const t = this.tanks[this.current]; t.angle = clamp(a, 0, 90); t.power = clamp(p, 0, 100); Sound.engine(0.8); this.revT = 0.3;
    },
    nudge(k, d) {
      if (this.state !== 'aim' || this.isAI(this.current)) return;
      const t = this.tanks[this.current];
      if (k === 'ang') t.angle = clamp(Math.round((t.angle + d) * 2) / 2, 0, 90); else t.power = clamp(Math.round((t.power + d) * 2) / 2, 0, 100);
      Sound.engine(0.8); this.revT = 0.3;
    },

    impact(hit) {
      const p = this.proj; this.proj = null; Sound.whistleStop();
      const owner = this.tanks[p.owner], opp = this.tanks[1 - p.owner];
      owner.lastPath = p.path.concat([[hit.x, hit.y]]);
      const res = { owner: p.owner, type: hit.type, dmg: [0, 0], x: hit.x, y: hit.y, maxErr: p.maxErr, t: p.t, round: this.round, bricks: 0, wind: this.wind };
      if (hit.type === 'tank') {
        this.explode(hit.x, hit.y, 1.25);
        res.dmg[hit.tank.idx] = this.damage(hit.tank, CFG.DIRECT_DMG, 'direct', owner);
        res.direct = true;
      } else if (hit.type === 'wall') {
        this.explode(hit.x, hit.y, 0.85, 'wall');
        const des = this.wall.blast(hit.x, hit.y, 1.35);
        res.bricks = des.length;
        this.brickDebris(des, p.vx, hit);
        Sound.bricks(des.length);
        owner.setExpr('annoyed', 2); owner.say(pick(Q.wall), 1.8);
        this.texts.push({ x: hit.x, y: hit.y + 2, text: 'FAL! 0', color: '#ffb38a', life: 1.6 });
      } else if (hit.type === 'ground') {
        this.explode(hit.x, hit.y, 1);
        this.craters.push({ x: hit.x, r: rand(1.1, 1.6) });
        if (Math.abs(hit.x - this.wall.cx) < 3) { const des = this.wall.blast(hit.x, hit.y + 0.3, 1.2); res.bricks = des.length; this.brickDebris(des, p.vx, hit); if (des.length) Sound.bricks(des.length); }
        for (const t of this.tanks) {
          const d = t.distTo(hit.x, hit.y);
          if (d <= CFG.NEAR_R) {
            const dmg = Math.round(CFG.NEAR_MAX - ((CFG.NEAR_MAX - CFG.NEAR_MIN) * d) / CFG.NEAR_R);
            res.dmg[t.idx] = this.damage(t, dmg, 'near', owner);
          }
        }
      } else {
        this.texts.push({ x: clamp(hit.x, 2, CFG.WORLD_W - 2), y: 12, text: 'MELLÉ! ↗', color: '#fff', life: 1.8 });
      }
      if (!res.dmg[opp.idx] && hit.type !== 'wall') { opp.setExpr('laugh', 2.2); opp.say(pick(Q.miss), 2); }
      this.history.push(res);
      this.lastResult = res;
      this.state = 'resolve';
      this.resolveT = res.dmg[0] || res.dmg[1] ? 1.9 : 1.3;
    },

    damage(t, dmg, kind, shooter) {
      const before = t.hp;
      t.hp = Math.max(0, t.hp - dmg);
      const dealt = before - t.hp;
      t.hitFlash = 1; t.soot = Math.min(0.6, t.soot + (kind === 'direct' ? 0.45 : 0.3));
      t.setExpr('hit', 2.3); t.hop(kind === 'direct' ? 8 : 5);
      t.addDamageMarks(kind === 'direct' ? 3 : 1);
      this.partsDebris(t, kind === 'direct' ? 9 : 4);
      this.texts.push({ x: t.x + t.dir * 3, y: t.y + 10.5, text: '−' + dmg, color: kind === 'direct' ? '#ff4b3e' : '#ffb03e', life: 1.8, big: kind === 'direct' });
      if (kind === 'direct') this.texts.push({ x: t.x + t.dir * 3, y: t.y + 13, text: 'TELITALÁLAT!', color: '#ffd23f', life: 1.8 });
      this.shake = Math.max(this.shake, kind === 'direct' ? 1.1 : 0.6);
      UI.ouch(t.idx); Sound.boing();
      if (shooter !== t) {
        t.say(pick(Q.ouch), 2);
        shooter.stats.hits++; shooter.stats.dmg += dealt;
        shooter.setExpr('happy', 2.4);
        setTimeout(() => shooter.say(pick(kind === 'direct' ? Q.direct : Q.near), 1.8), 500 / this.speed);
      } else t.say(pick(Q.self), 2);
      if (t.hp <= 0) t.dead = true;
      return dmg;
    },

    afterShot() {
      const dead = this.tanks.filter((t) => t.hp <= 0);
      if (dead.length) return this.gameOver(dead);
      this.shotsInRound++;
      if (this.shotsInRound >= 2) {
        this.shotsInRound = 0; this.round++;
        this.startWallGrow();
      } else this.beginTurn(1 - this.current);
    },

    startWallGrow() {
      this.newWind();
      const added = this.wall.growTo(this.round, true);
      this.state = 'wallgrow';
      if (added.length) {
        UI.banner(`🧱 A FAL NŐ! 🧱<small>${this.round}. forduló · ${this.wall.height} m · ${pick(Q.mason)}</small>`, '#ffb38a');
        this.growT = 0.6;
      } else {
        UI.banner(`${this.round}. FORDULÓ<small>A fal elérte a maximumot (${this.wall.height} m)</small>`, '#ffb38a');
        this.growT = 1.0;
      }
      if (this.mode === 'endless' && this.round - 1 > UI.scores.endlessBest) { UI.scores.endlessBest = this.round - 1; UI.saveScores(); }
    },

    gameOver(dead) {
      this.state = 'over'; this.overT = 2.6; this.winShown = false;
      const winner = dead.length === 2 ? null : this.tanks.find((t) => t.hp > 0);
      for (const d of dead) {
        this.explode(d.x, d.y + 2, 2.2);
        d.pop = { on: true, y: 0, vy: 11, rot: 0, vr: rand(2, 3.5) * (Math.random() < 0.5 ? -1 : 1) };
        d.setExpr('lose', 9999); d.dead = true;
      }
      this.winner = winner;
      if (winner) {
        winner.setExpr('win', 9999); UI.addWin(winner.name);
        setTimeout(() => Sound.fanfare(), 900 / this.speed);
      } else Sound.sad();
      if (this.mode === 'endless' && this.round > UI.scores.endlessBest) { UI.scores.endlessBest = this.round; UI.saveScores(); }
    },
    showWinScreen() {
      const w = this.winner, l = w ? this.tanks[1 - w.idx] : null;
      const st = this.tanks.map((t) => `${TD.esc(t.name)}: ${t.stats.hits}/${t.stats.shots} találat · ${t.stats.dmg} sebzés`);
      st.unshift(`🔁 ${this.round}. forduló`, `🧱 Fal: ${this.wall.height} m · ${this.wall.destroyed} tégla repült`);
      if (this.mode === 'endless') st.push(`🏅 Végtelen rekord: ${UI.scores.endlessBest}. forduló`);
      UI.showWin({
        winner: w || this.tanks[0],
        title: w ? `${w.name.toUpperCase()} GYŐZÖTT!` : 'DÖNTETLEN!',
        quip: w ? fmt(pick(Q.win), w.name, l.name) : 'Mindketten egyszerre robbantak fel. Ezt nevezik barátságnak!',
        stats: st,
      });
    },

    // ---------- effektek ----------
    flashLight(x, y, r, i, col) { this.particles.push({ type: 'light', x, y, r, i, col: col || '255,190,110', life: 0.35, max: 0.35 }); },
    explode(x, y, k, kind) {
      k = k || 1;
      this.flashLight(x, y, 16 * k, 1, '255,180,90');
      this.flash = Math.max(this.flash, 0.35 * k);
      this.particles.push({ type: 'ring', x, y, life: 0.5, max: 0.5, size: 5 * k });
      for (let i = 0; i < 22 * k; i++) { const a = rand(0, Math.PI * 2), sp = rand(2, 11) * k; this.particles.push({ type: 'fire', x, y, vx: Math.cos(a) * sp, vy: Math.abs(Math.sin(a)) * sp, life: rand(0.3, 0.8), max: 0.8, size: rand(0.5, 1.3) * k, grow: 1.2, drag: 2.5 }); }
      for (let i = 0; i < 16 * k; i++) { const a = rand(0, Math.PI * 2), sp = rand(1, 5); this.particles.push({ type: 'smoke', x: x + rand(-1, 1), y: y + rand(0, 1), vx: Math.cos(a) * sp, vy: Math.abs(Math.sin(a)) * sp + 1, life: rand(1.2, 3), max: 3, size: rand(0.8, 1.8) * k, grow: 1.4, drag: 1.2, dark: kind !== 'wall' }); }
      for (let i = 0; i < 14 * k; i++) { const a = rand(0.1, Math.PI - 0.1), sp = rand(8, 22); this.particles.push({ type: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.3, 0.9), max: 0.9, grav: 1, drag: 0.5 }); }
      if (kind !== 'wall') for (let i = 0; i < 10; i++) { const a = rand(0.3, Math.PI - 0.3), sp = rand(4, 10); this.particles.push({ type: 'dirt', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 2, max: 2, size: rand(0.12, 0.3), grav: 1, ground: true }); }
      this.shake = Math.max(this.shake, 0.5 * k);
      Sound.explosion(k > 1.1);
    },
    dust(x, y, n, sz) { for (let i = 0; i < n; i++) this.particles.push({ type: 'smoke', x: x + rand(-0.5, 0.5), y, vx: rand(-2, 2), vy: rand(0.3, 1.5), life: rand(0.6, 1.2), max: 1.2, size: sz || 0.5, grow: 1, drag: 2, tan: true }); },
    brickDebris(list, vx, hit) {
      const dirx = Math.sign(vx) || 1;
      for (const b of list) {
        for (let k = 0; k < 3; k++) {
          const cx = rand(b.x0, b.x1), cy = rand(b.y0, b.y1);
          const ang = Math.atan2(cy - hit.y, cx - hit.x);
          const sp = rand(5, 13);
          this.particles.push({ type: 'brick', x: cx, y: cy, vx: Math.cos(ang) * sp * 0.6 + dirx * rand(2, 7), vy: Math.abs(Math.sin(ang)) * sp + rand(2, 6), life: 6, max: 6, w: rand(0.25, 0.55), h: rand(0.18, 0.3), rot: rand(0, 6), vr: rand(-12, 12), grav: 1, ground: true, settle: true, tint: b.tint });
        }
        this.dust((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, 2, 0.7);
      }
    },
    partsDebris(t, n) {
      const cols = [t.pal.base, t.pal.dark, '#333', '#888', t.pal.light];
      for (let i = 0; i < n; i++) {
        this.particles.push({ type: 'part', x: t.x + rand(-2.5, 2.5), y: t.y + rand(1, 3), vx: rand(-9, 9), vy: rand(6, 16), life: 7, max: 7, w: rand(0.2, 0.6), h: rand(0.1, 0.35), rot: rand(0, 6), vr: rand(-15, 15), grav: 1, ground: true, settle: true, color: pick(cols), bolt: Math.random() < 0.35 });
      }
    },

    // ---------- háttér ----------
    genBackground() {
      this.stars = []; for (let i = 0; i < 140; i++) this.stars.push({ x: Math.random(), y: Math.random() * 0.7, r: rand(0.5, 1.8), p: rand(0, 6) });
      this.hills = [];
      for (let L = 0; L < 3; L++) {
        const pts = [];
        const n = 14;
        for (let i = 0; i <= n; i++) pts.push(rand(0.3, 1) * (L === 0 ? 1 : L === 1 ? 0.6 : 0.35));
        this.hills.push(pts);
      }
      this.trees = []; for (let i = 0; i < 26; i++) this.trees.push({ x: rand(-0.05, 1.05), s: rand(0.6, 1.3), h: rand(0, 1) });
      const nc = { clear: 4, clouds: 9, rain: 10, snow: 8, storm: 11 }[this.weather];
      this.clouds = []; for (let i = 0; i < nc; i++) this.clouds.push(this.mkCloud(Math.random()));
      const nd = { clear: 0, clouds: 0, rain: 260, snow: 160, storm: 360 }[this.weather];
      this.drops = []; for (let i = 0; i < nd; i++) this.drops.push({ x: Math.random(), y: Math.random(), s: rand(0.6, 1.4) });
    },
    mkCloud(x) { const puffs = []; const n = 4 + ((Math.random() * 4) | 0); for (let i = 0; i < n; i++) puffs.push({ dx: (i - n / 2) * rand(0.6, 0.9), dy: rand(-0.4, 0.3), r: rand(0.7, 1.3) }); return { x, y: rand(0.05, 0.42), s: rand(0.6, 1.4), puffs, sp: rand(0.6, 1.2) }; },

    // ---------- frissítés ----------
    update(dt) {
      this.time += dt;
      const st = this.state;
      if (st === 'aim') {
        if (this.isAI(this.current)) this.aiUpdate(dt); else this.keyAim(dt);
      } else if (st === 'flight' && this.proj) {
        this.acc += dt * P.TIME_SCALE;
        let n = 0;
        while (this.acc >= P.DT && this.proj && n < 40000) {
          this.acc -= P.DT; n++;
          const hit = this.proj.step(this.collide);
          if (hit) { this.impact(hit); break; }
        }
        const pr = this.proj;
        if (pr) {
          Sound.whistle(pr.vy, Math.hypot(pr.vx, pr.vy));
          const opp = this.tanks[1 - pr.owner];
          if (!this.scaredDone && pr.vy < 0 && Math.abs(pr.x - opp.x) < 16 && pr.y < 22) { this.scaredDone = true; opp.setExpr('scared', 1.6); if (Math.random() < 0.6) opp.say(pick(Q.scared), 1.2); }
          if (this.night) this.lights.push({ x: pr.x, y: pr.y, r: 5, i: 0.7, col: '255,210,150' });
        }
      } else if (st === 'resolve') {
        this.resolveT -= dt;
        if (this.resolveT <= 0) this.afterShot();
      } else if (st === 'wallgrow') {
        this.growT -= dt;
        if (this.growT <= 0 && !this.wall.animating()) this.beginTurn(0);
      } else if (st === 'over') {
        this.overT -= dt;
        if (this.overT <= 0 && !this.winShown) { this.winShown = true; this.showWinScreen(); }
        const w = this.winner;
        if (w) {
          this.hopT -= dt;
          if (this.hopT <= 0) { this.hopT = 0.75; w.hop(7); }
          if (Math.random() < dt * 30) { const cols = ['#ff4b3e', '#ffd23f', '#4fb83a', '#5aa0ff', '#ff6bd6', '#fff']; this.particles.push({ type: 'confetti', x: rand(-5, CFG.WORLD_W + 5), y: this.cam.needH + 2, vx: rand(-1, 1), vy: rand(-3, -1), life: 7, max: 7, w: 0.35, h: 0.2, rot: rand(0, 6), vr: rand(-6, 6), color: pick(cols) }); }
        }
      }
      if (this.revT > 0) { this.revT -= dt; if (this.revT <= 0) Sound.engine(0.35); }
      this.wall.update(dt);
      for (const t of this.tanks) {
        t.update(dt);
        // füst / tűz a sérült tankokból
        const dmg = 1 - t.hp / 100;
        if (dmg > 0.35 && Math.random() < dt * (dmg * 10)) this.particles.push({ type: 'smoke', x: t.x - t.dir * rand(1.5, 2.8), y: t.y + 2.2, vx: rand(-0.5, 0.5), vy: rand(1, 2.5), life: rand(1.5, 3), max: 3, size: rand(0.4, 0.8), grow: 1.6, drag: 0.6, dark: true });
        if ((dmg > 0.75 || t.dead) && Math.random() < dt * 14) this.particles.push({ type: 'fire', x: t.x - t.dir * rand(1, 3), y: t.y + 2.1, vx: rand(-0.5, 0.5), vy: rand(1, 3), life: rand(0.2, 0.6), max: 0.6, size: rand(0.3, 0.7), grow: 0.5, drag: 1 });
        if (!t.dead && Math.random() < dt * 2.5) { const e = t.exhaust(); this.particles.push({ type: 'smoke', x: e.x, y: e.y, vx: -t.dir * rand(0.3, 1), vy: rand(0.4, 1), life: 1.2, max: 1.2, size: 0.25, grow: 1.5, drag: 1, light: true }); }
        if (this.night && !t.dead) {
          this.lights.push({ x: t.x + t.dir * 6, y: t.y + 1.6, r: 7, i: 0.8, col: '255,240,180' });
          const h = t.headWorld(); this.lights.push({ x: h.x, y: h.y, r: 4.5, i: 0.65, col: '255,220,170' });
        }
      }
      this.updateParticles(dt);
      for (const tx of this.texts) { tx.life -= dt; tx.y += dt * 1.6; }
      this.texts = this.texts.filter((t) => t.life > 0);
      for (const c of this.clouds) { c.x += dt * (0.004 + this.wind * 0.0018) * c.sp; if (c.x > 1.25) Object.assign(c, this.mkCloud(-0.25)); if (c.x < -0.25) Object.assign(c, this.mkCloud(1.25)); }
      if (this.weather === 'storm') { this.lightningT -= dt; if (this.lightningT <= 0) { this.lightningT = rand(4, 11); this.lightning = 1; setTimeout(() => Sound.thunder(), 300); } }
      this.lightning = Math.max(0, this.lightning - dt * 3);
      this.flash = Math.max(0, this.flash - dt * 2.5);
      this.shake = Math.max(0, this.shake - dt * 2.2);
    },

    keyAim(dt) {
      const t = this.tanks[this.current];
      const fine = keys.ShiftLeft || keys.ShiftRight ? 0.25 : 1;
      const vsAI = this.opponent !== 'human';
      let da = 0, dp = 0;
      const p1 = this.current === 0 || vsAI, p2 = this.current === 1 || vsAI;
      // a "ellenféltől elfelé" mutató gomb emeli a csövet
      if (p1) { if (keys.KeyA) da += t.dir; if (keys.KeyD) da -= t.dir; if (keys.KeyW) dp += 1; if (keys.KeyS) dp -= 1; }
      if (p2) { if (keys.ArrowLeft) da += t.dir; if (keys.ArrowRight) da -= t.dir; if (keys.ArrowUp) dp += 1; if (keys.ArrowDown) dp -= 1; }
      if (da || dp) {
        this.holdT = (this.holdT || 0) + dt;
        const rate = (6 + Math.min(1, this.holdT) * 34) * fine;
        t.angle = clamp(t.angle + da * rate * dt, 0, 90);
        t.power = clamp(t.power + dp * rate * dt, 0, 100);
        Sound.engine(0.8); this.revT = 0.2;
      } else this.holdT = 0;
    },

    aiUpdate(dt) {
      const ai = this.ai; if (!ai) return;
      const t = this.tanks[this.current];
      ai.t -= dt;
      if (ai.phase === 'think' && ai.t <= 0) {
        const plan = TD.AI.choose(this.world(), t, this.tanks[1 - this.current], this.wind, ai.level);
        Object.assign(ai, { phase: 'move', plan, a0: t.angle, p0: t.power, mt: 0, dur: 0.9 });
        this.lastAIPlan = plan;
      } else if (ai.phase === 'move') {
        ai.mt += dt; const k = Math.min(1, ai.mt / ai.dur); const e = k * k * (3 - 2 * k);
        t.angle = ai.a0 + (ai.plan.angle - ai.a0) * e; t.power = ai.p0 + (ai.plan.power - ai.p0) * e;
        Sound.engine(0.8); this.revT = 0.2;
        if (k >= 1) { t.angle = ai.plan.angle; t.power = ai.plan.power; ai.phase = 'wait'; ai.t = 0.35; }
      } else if (ai.phase === 'wait' && ai.t <= 0) { this.ai = null; this.fire(); }
    },

    updateParticles(dt) {
      const out = [];
      const windDrift = this.wind * 0.35;
      for (const p of this.particles) {
        p.life -= dt;
        if (p.life <= 0) continue;
        if (p.type === 'light' || p.type === 'ring') { out.push(p); continue; }
        if (p.grav) p.vy -= P.G * p.grav * dt;
        if (p.type === 'smoke') { p.vx += (windDrift - p.vx) * dt * 0.6; p.vy += dt * 0.5; }
        if (p.type === 'confetti') { p.vx += Math.sin(this.time * 3 + p.rot) * dt * 2 + this.wind * 0.02 * dt; p.vy = Math.max(p.vy - dt * 2, -2.5); }
        if (p.drag) { const f = Math.max(0, 1 - p.drag * dt); p.vx *= f; p.vy *= f; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.vr) p.rot += p.vr * dt;
        if (p.ground) {
          let gy = TD.Terrain.height(p.x);
          // a fal tetején is megállhat
          if (p.x > this.wall.x0 && p.x < this.wall.x0 + this.wall.w) gy = Math.max(gy, this.wall.topAlive);
          if (p.y <= gy) {
            p.y = gy;
            if (Math.abs(p.vy) > 2) { p.vy = -p.vy * 0.35; p.vx *= 0.6; p.vr *= 0.5; }
            else if (p.settle) { p.vx = 0; p.vy = 0; this.rubble.push(p); continue; }
            else { p.vy = 0; p.vx *= 0.8; }
          }
        }
        out.push(p);
      }
      if (out.length > 1600) out.splice(0, out.length - 1600);
      this.particles = out;
      if (this.rubble.length > 400) this.rubble.splice(0, this.rubble.length - 400);
    },

    // ---------- kamera ----------
    layout() {
      const W = innerWidth, H = innerHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
        canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
        lightCv.width = canvas.width; lightCv.height = canvas.height;
      }
      this.W = W; this.H = H; this.dpr = dpr;
      const hud = document.getElementById('hud'), ctl = document.getElementById('controls');
      this.topUI = hud.classList.contains('hidden') ? 0 : hud.offsetHeight;
      this.botUI = ctl.classList.contains('hidden') ? 0 : ctl.offsetHeight;
    },
    updateCamera(dt) {
      const c = this.cam;
      let need = Math.max(24, this.wall.height + 11);
      if (this.proj) need = Math.max(need, this.proj.y + 4);
      if (this.state === 'aim' && this.previewApex && this.showPreview) need = Math.max(need, Math.min(this.previewApex + 3, 90));
      if (this.state === 'menu') need = 26;
      // gyorsan nyit ki, lassan zár vissza
      const k = need > c.needH ? 4 : 1.2;
      c.needH += (need - c.needH) * Math.min(1, dt * k);
      const groundDepth = 3.2;
      const availH = Math.max(120, this.H - this.topUI - this.botUI);
      const sW = this.W / 70, sH = availH / (c.needH + groundDepth);
      c.s = Math.min(sW, sH);
      c.ox = this.W / 2 - (CFG.WORLD_W / 2) * c.s;
      c.oy = this.H - this.botUI - groundDepth * c.s;
      const sh = this.shake * c.s * 0.6;
      c.dx = (Math.random() - 0.5) * sh; c.dy = (Math.random() - 0.5) * sh;
    },
  });

  // ================= RAJZOLÁS =================
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const lightCv = document.createElement('canvas');
  const lctx = lightCv.getContext('2d');

  function render() {
    const c = G.cam, W = G.W, H = G.H, night = G.night;
    ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
    const env = { night, wind: G.wind, time: G.time };
    drawSky(W, H, c);
    drawHills(W, H, c);
    drawGround(W, H, c);
    // törmelék
    for (const p of G.rubble) drawParticle(p, c, env);
    G.wall.draw(ctx, c, env);
    // előnézet + utolsó lövés
    drawAimHelpers(c);
    for (const t of G.tanks) t.draw(ctx, c, env);
    if (G.proj) G.proj.draw(ctx, c, env);
    // részecskék
    for (const p of G.particles) if (p.type !== 'fire' && p.type !== 'spark' && p.type !== 'light') drawParticle(p, c, env);
    ctx.globalCompositeOperation = 'lighter';
    for (const p of G.particles) if (p.type === 'fire' || p.type === 'spark') drawParticle(p, c, env);
    ctx.globalCompositeOperation = 'source-over';
    drawWeather(W, H);
    drawLighting(W, H, c);
    drawOverlayTexts(c);
    if (G.lightning > 0) { ctx.fillStyle = `rgba(230,240,255,${G.lightning * 0.55})`; ctx.fillRect(0, 0, W, H); }
    if (G.flash > 0) { ctx.fillStyle = `rgba(255,240,200,${G.flash * 0.35})`; ctx.fillRect(0, 0, W, H); }
    G.lights.length = 0;
  }

  function drawSky(W, H, c) {
    const night = G.night, wx = G.weather;
    const g = ctx.createLinearGradient(0, 0, 0, c.oy);
    const gloomy = wx === 'rain' || wx === 'storm';
    if (night) { g.addColorStop(0, '#060a24'); g.addColorStop(0.6, '#1b2052'); g.addColorStop(1, '#3a3270'); }
    else if (gloomy) { g.addColorStop(0, '#5a6a80'); g.addColorStop(1, '#a9b6c4'); }
    else if (wx === 'snow') { g.addColorStop(0, '#8fb2d6'); g.addColorStop(1, '#e4eef7'); }
    else { g.addColorStop(0, '#2f8fea'); g.addColorStop(0.65, '#8fd2ff'); g.addColorStop(1, '#ffe7b8'); }
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (night) {
      for (const s of G.stars) { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(G.time * 2 + s.p); ctx.fillStyle = '#fff'; ctx.fillRect(s.x * W, s.y * c.oy, s.r, s.r); }
      ctx.globalAlpha = 1;
      const mx = W * 0.82, my = H * 0.16, mr = Math.max(18, W * 0.03);
      const mg = ctx.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 4); mg.addColorStop(0, 'rgba(255,250,220,0.35)'); mg.addColorStop(1, 'rgba(255,250,220,0)');
      ctx.fillStyle = mg; ctx.fillRect(mx - mr * 4, my - mr * 4, mr * 8, mr * 8);
      ctx.fillStyle = '#fff6d6'; ctx.beginPath(); ctx.arc(mx, my, mr, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(200,190,160,0.5)'; ctx.beginPath(); ctx.arc(mx - mr * 0.3, my - mr * 0.2, mr * 0.2, 0, 7); ctx.arc(mx + mr * 0.35, my + mr * 0.3, mr * 0.14, 0, 7); ctx.fill();
    } else if (!gloomy) {
      const sx = W * 0.15, sy = H * 0.17, sr = Math.max(22, W * 0.035);
      const sg = ctx.createRadialGradient(sx, sy, sr * 0.6, sx, sy, sr * 5); sg.addColorStop(0, 'rgba(255,240,170,0.6)'); sg.addColorStop(1, 'rgba(255,240,170,0)');
      ctx.fillStyle = sg; ctx.fillRect(sx - sr * 5, sy - sr * 5, sr * 10, sr * 10);
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(G.time * 0.1);
      ctx.strokeStyle = 'rgba(255,230,120,0.6)'; ctx.lineWidth = 4;
      for (let i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); ctx.beginPath(); ctx.moveTo(sr * 1.2, 0); ctx.lineTo(sr * 1.6, 0); ctx.stroke(); }
      ctx.restore();
      ctx.fillStyle = '#ffe24a'; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, 7); ctx.fill();
      // vicces napocska-arc
      ctx.fillStyle = '#6a4a00'; ctx.beginPath(); ctx.arc(sx - sr * 0.33, sy - sr * 0.15, sr * 0.1, 0, 7); ctx.arc(sx + sr * 0.33, sy - sr * 0.15, sr * 0.1, 0, 7); ctx.fill();
      ctx.strokeStyle = '#6a4a00'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(sx, sy + sr * 0.05, sr * 0.45, 0.4, Math.PI - 0.4); ctx.stroke();
    }
    // felhők
    for (const cl of G.clouds) {
      const x = cl.x * W, y = cl.y * c.oy, r = cl.s * Math.max(22, W * 0.03);
      const col = night ? 'rgba(70,75,120,0.75)' : gloomy ? 'rgba(110,118,132,0.9)' : 'rgba(255,255,255,0.92)';
      const sh = night ? 'rgba(30,30,60,0.5)' : gloomy ? 'rgba(70,76,90,0.8)' : 'rgba(180,200,230,0.8)';
      ctx.fillStyle = sh;
      ctx.beginPath(); for (const p of cl.puffs) { ctx.moveTo(x + p.dx * r + p.r * r, y + p.dy * r + r * 0.18); ctx.arc(x + p.dx * r, y + p.dy * r + r * 0.18, p.r * r, 0, 7); } ctx.fill();
      ctx.fillStyle = col;
      ctx.beginPath(); for (const p of cl.puffs) { ctx.moveTo(x + p.dx * r + p.r * r, y + p.dy * r); ctx.arc(x + p.dx * r, y + p.dy * r, p.r * r, 0, 7); } ctx.fill();
    }
  }

  function drawHills(W, H, c) {
    const night = G.night, snow = G.weather === 'snow';
    const cols = night ? ['#262c5a', '#1e2a4a', '#1a3036'] : snow ? ['#b9c9dc', '#a6bccf', '#93b0a4'] : ['#8aa6d6', '#6f9fb8', '#5e9a5a'];
    const base = c.Y(0.6 + 1.2);
    G.hills.forEach((pts, L) => {
      const amp = (L === 0 ? 0.42 : L === 1 ? 0.3 : 0.18) * Math.min(H, W * 0.7);
      ctx.fillStyle = cols[L];
      ctx.beginPath(); ctx.moveTo(0, base);
      const n = pts.length - 1;
      for (let i = 0; i <= n; i++) {
        const x = (i / n) * W, y = base - pts[i] * amp;
        if (i === 0) ctx.lineTo(x, y); else { const px = ((i - 0.5) / n) * W; ctx.quadraticCurveTo(px, base - pts[i - 1] * amp, x, y); }
      }
      ctx.lineTo(W, base); ctx.closePath(); ctx.fill();
      if (L === 0 && !night) { // hósapkák
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        for (let i = 1; i < n; i++) if (pts[i] > 0.75) { const x = (i / n) * W, y = base - pts[i] * amp; ctx.beginPath(); ctx.moveTo(x - 18, y + 14); ctx.lineTo(x, y); ctx.lineTo(x + 18, y + 14); ctx.closePath(); ctx.fill(); }
      }
    });
    // fák a közeli dombon
    for (const t of G.trees) {
      const x = t.x * W, y = base - G.hills[2][clamp(Math.round(t.x * 14), 0, 14)] * 0.18 * Math.min(H, W * 0.7) * 0.5 - 2;
      const s = t.s * Math.max(6, c.s * 0.9);
      ctx.fillStyle = night ? '#2a2016' : '#5a3d22'; ctx.fillRect(x - s * 0.12, y - s * 1.2, s * 0.24, s * 1.2);
      ctx.fillStyle = night ? '#163222' : snow ? '#5d8a6a' : t.h > 0.5 ? '#2f8a3a' : '#3fa44a';
      ctx.beginPath(); ctx.arc(x, y - s * 1.6, s * 0.75, 0, 7); ctx.arc(x - s * 0.45, y - s * 1.2, s * 0.5, 0, 7); ctx.arc(x + s * 0.45, y - s * 1.2, s * 0.5, 0, 7); ctx.fill();
      if (snow) { ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(x, y - s * 1.95, s * 0.4, Math.PI, 0); ctx.fill(); }
    }
  }

  function drawGround(W, H, c) {
    const night = G.night, snow = G.weather === 'snow';
    const xl = (0 - c.ox) / c.s - 2, xr = (W - c.ox) / c.s + 2;
    const step = Math.max(0.25, 4 / c.s);
    const D = 1.6; // 2.5D mélység
    // hátsó sáv (felső síklap)
    ctx.beginPath();
    for (let x = xl; x <= xr; x += step) { const y = TD.Terrain.height(x) * 0.6 + D; if (x === xl) ctx.moveTo(c.X(x), c.Y(y)); else ctx.lineTo(c.X(x), c.Y(y)); }
    for (let x = xr; x >= xl; x -= step) ctx.lineTo(c.X(x), c.Y(TD.Terrain.height(x)));
    ctx.closePath();
    let g = ctx.createLinearGradient(0, c.Y(D), 0, c.Y(0));
    if (night) { g.addColorStop(0, '#1f3a2a'); g.addColorStop(1, '#2c5236'); }
    else if (snow) { g.addColorStop(0, '#dfe9f2'); g.addColorStop(1, '#ffffff'); }
    else { g.addColorStop(0, '#6fbf4a'); g.addColorStop(1, '#9be05c'); }
    ctx.fillStyle = g; ctx.fill();
    // kráterek a felső síkon
    for (const cr of G.craters) {
      const y = TD.Terrain.height(cr.x);
      ctx.fillStyle = night ? 'rgba(10,8,5,0.6)' : 'rgba(60,40,20,0.55)';
      ctx.beginPath(); ctx.ellipse(c.X(cr.x), c.Y(y + 0.45), cr.r * c.s, cr.r * 0.35 * c.s, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(20,12,5,0.5)';
      ctx.beginPath(); ctx.ellipse(c.X(cr.x), c.Y(y + 0.5), cr.r * 0.6 * c.s, cr.r * 0.2 * c.s, 0, 0, 7); ctx.fill();
    }
    // első oldallap (föld rétegek)
    ctx.beginPath();
    for (let x = xl; x <= xr; x += step) { const y = TD.Terrain.height(x); if (x === xl) ctx.moveTo(c.X(x), c.Y(y)); else ctx.lineTo(c.X(x), c.Y(y)); }
    ctx.lineTo(c.X(xr), H); ctx.lineTo(c.X(xl), H); ctx.closePath();
    g = ctx.createLinearGradient(0, c.Y(0), 0, H);
    if (night) { g.addColorStop(0, '#3a2a1c'); g.addColorStop(1, '#140e08'); } else { g.addColorStop(0, '#9a6a3a'); g.addColorStop(0.5, '#7a4e28'); g.addColorStop(1, '#4a2e16'); }
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.strokeStyle = night ? 'rgba(0,0,0,0.25)' : 'rgba(60,30,10,0.25)'; ctx.lineWidth = Math.max(1, c.s * 0.15);
    for (let k = 1; k < 5; k++) { ctx.beginPath(); for (let x = xl; x <= xr; x += step * 2) { const y = TD.Terrain.height(x) - k * 0.75 + Math.sin(x * 0.4 + k) * 0.15; if (x === xl) ctx.moveTo(c.X(x), c.Y(y)); else ctx.lineTo(c.X(x), c.Y(y)); } ctx.stroke(); }
    ctx.fillStyle = night ? 'rgba(90,80,70,0.4)' : 'rgba(170,140,110,0.6)';
    for (let i = 0; i < 40; i++) { const x = xl + ((i * 37.7) % (xr - xl)); const y = TD.Terrain.height(x) - 0.6 - ((i * 13) % 25) / 10; ctx.beginPath(); ctx.ellipse(c.X(x), c.Y(y), c.s * 0.25, c.s * 0.15, 0, 0, 7); ctx.fill(); }
    ctx.restore();
    // fűszegély
    ctx.strokeStyle = night ? '#2f5a36' : snow ? '#ffffff' : '#4f9a30'; ctx.lineWidth = Math.max(2, c.s * 0.3);
    ctx.beginPath(); for (let x = xl; x <= xr; x += step) { const y = TD.Terrain.height(x); if (x === xl) ctx.moveTo(c.X(x), c.Y(y)); else ctx.lineTo(c.X(x), c.Y(y)); } ctx.stroke();
    if (!snow) {
      ctx.strokeStyle = night ? '#3a6a40' : '#5fb83a'; ctx.lineWidth = Math.max(1, c.s * 0.08);
      ctx.beginPath();
      for (let x = Math.floor(xl); x <= xr; x += 0.7) { const y = TD.Terrain.height(x); const sw = Math.sin(G.time * 2 + x) * 0.15 + G.wind * 0.02; ctx.moveTo(c.X(x), c.Y(y)); ctx.lineTo(c.X(x + sw), c.Y(y + 0.45)); ctx.moveTo(c.X(x + 0.15), c.Y(y)); ctx.lineTo(c.X(x + 0.15 + sw), c.Y(y + 0.3)); }
      ctx.stroke();
    }
  }

  function drawAimHelpers(c) {
    const t = G.tanks[G.current];
    if (!t) return;
    const aiming = G.state === 'aim';
    // utolsó lövés (játékosonként)
    if (G.showLast && t.lastPath && (aiming || G.state === 'flight')) {
      ctx.save();
      ctx.setLineDash([2, 6]); ctx.lineWidth = 2;
      ctx.strokeStyle = t.idx === 0 ? 'rgba(170,255,140,0.55)' : 'rgba(230,236,242,0.55)';
      ctx.beginPath(); t.lastPath.forEach((p, i) => (i ? ctx.lineTo(c.X(p[0]), c.Y(p[1])) : ctx.moveTo(c.X(p[0]), c.Y(p[1])))); ctx.stroke();
      ctx.setLineDash([]);
      const e = t.lastPath[t.lastPath.length - 1];
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(c.X(e[0]), c.Y(e[1]), 6, 0, 7); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center'; ctx.fillText('utolsó lövés', c.X(e[0]), c.Y(e[1]) - 10);
      ctx.restore();
    }
    G.previewApex = 0;
    if (aiming && G.showPreview && !G.isAI(G.current)) {
      const m = t.muzzle(), v = P.launch(t.angle, t.power, t.dir);
      const key = [t.angle, t.power, G.wind, G.wall.rows, G.wall.destroyed].join('|');
      if (G._pvKey !== key) { G._pvKey = key; G._pv = P.simulate({ x: m.x, y: m.y, vx: v.vx, vy: v.vy, wind: G.wind, collide: TD.makeCollider(G.world(), t.idx), record: 3 }); }
      const sim = G._pv;
      let pts = sim.pts;
      const full = G.previewMode === 'full';
      if (!full) pts = pts.slice(0, Math.max(4, Math.floor(pts.length * 0.35)));
      for (const p of pts) G.previewApex = Math.max(G.previewApex, p[1]);
      ctx.save();
      ctx.setLineDash([9, 7]); ctx.lineDashOffset = -G.time * 30;
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(c.X(p[0]), c.Y(p[1])) : ctx.moveTo(c.X(p[0]), c.Y(p[1])))); ctx.stroke();
      ctx.lineWidth = 2.2; ctx.strokeStyle = t.idx === 0 ? '#b6ff8a' : '#ffffff';
      ctx.stroke();
      ctx.setLineDash([]);
      if (full && sim.hit) { const e = sim.pts[sim.pts.length - 1]; ctx.strokeStyle = '#ff4b3e'; ctx.lineWidth = 3; const X = c.X(e[0]), Y = c.Y(e[1]); ctx.beginPath(); ctx.moveTo(X - 7, Y - 7); ctx.lineTo(X + 7, Y + 7); ctx.moveTo(X + 7, Y - 7); ctx.lineTo(X - 7, Y + 7); ctx.stroke(); }
      ctx.restore();
    }
    // ki következik – nyíl a parancsnok fölött
    if (aiming || G.state === 'flight') {
      const h = t.headWorld();
      const X = c.X(h.x), Y = c.Y(h.y + 2.2) - Math.abs(Math.sin(G.time * 5)) * 10;
      ctx.fillStyle = t.idx === 0 ? '#7be05a' : '#e6ecf2'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(X - 12, Y - 16); ctx.lineTo(X + 12, Y - 16); ctx.lineTo(X, Y); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }

  function drawParticle(p, c, env) {
    const X = c.X(p.x), Y = c.Y(p.y), s = c.s;
    const a = Math.max(0, p.life / p.max);
    switch (p.type) {
      case 'smoke': {
        const r = (p.size + (1 - a) * p.grow) * s;
        const col = p.tan ? '160,130,100' : p.dark ? (env.night ? '30,30,35' : '55,52,50') : p.light ? '200,200,200' : '120,120,120';
        ctx.fillStyle = `rgba(${col},${a * (p.light ? 0.35 : 0.55)})`;
        ctx.beginPath(); ctx.arc(X, Y, r, 0, 7); ctx.fill();
        break;
      }
      case 'fire': {
        const r = (p.size + (1 - a) * p.grow) * s;
        const gr = ctx.createRadialGradient(X, Y, 0, X, Y, r);
        gr.addColorStop(0, `rgba(255,255,200,${a})`); gr.addColorStop(0.4, `rgba(255,170,40,${a * 0.9})`); gr.addColorStop(1, 'rgba(255,60,0,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(X, Y, r, 0, 7); ctx.fill();
        if (G.night && Math.random() < 0.3) G.lights.push({ x: p.x, y: p.y, r: 4, i: 0.5 * a, col: '255,150,60' });
        break;
      }
      case 'spark':
        ctx.strokeStyle = `rgba(255,220,120,${a})`; ctx.lineWidth = Math.max(1, s * 0.08);
        ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X - p.vx * s * 0.03, Y + p.vy * s * 0.03); ctx.stroke();
        break;
      case 'brick': case 'part': case 'confetti': {
        ctx.save(); ctx.translate(X, Y); ctx.rotate(p.rot || 0);
        const w = p.w * s, h = p.h * s;
        if (p.type === 'brick') { ctx.fillStyle = `hsl(${10 + p.tint * 10},${env.night ? 35 : 55}%,${env.night ? 25 : 40 + p.tint * 10}%)`; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(-w / 2, -h / 2, w, h * 0.3); }
        else if (p.type === 'part') {
          ctx.fillStyle = p.color;
          if (p.bolt) { ctx.beginPath(); ctx.arc(0, 0, Math.max(1.5, h * 0.7), 0, 7); ctx.fill(); ctx.fillStyle = '#222'; ctx.fillRect(-1, -1, 2, 2); }
          else { ctx.fillRect(-w / 2, -h / 2, w, h); ctx.strokeStyle = '#111'; ctx.lineWidth = 1; ctx.strokeRect(-w / 2, -h / 2, w, h); }
        } else { ctx.fillStyle = p.color; ctx.fillRect(-w / 2, -h / 2 * Math.abs(Math.sin(G.time * 8 + p.rot)), w, h); }
        ctx.restore();
        break;
      }
      case 'dirt':
        ctx.fillStyle = env.night ? '#2a1d12' : '#6a4422'; ctx.beginPath(); ctx.arc(X, Y, Math.max(1.5, p.size * s), 0, 7); ctx.fill();
        break;
      case 'ring':
        ctx.strokeStyle = `rgba(255,255,230,${a * 0.8})`; ctx.lineWidth = Math.max(2, s * 0.3 * a);
        ctx.beginPath(); ctx.ellipse(X, Y, (1 - a) * p.size * s * 1.4, (1 - a) * p.size * s * 0.9, 0, 0, 7); ctx.stroke();
        break;
    }
  }

  function drawWeather(W, H) {
    const wx = G.weather;
    if (!G.drops.length) return;
    const snow = wx === 'snow';
    ctx.strokeStyle = G.night ? 'rgba(170,190,230,0.45)' : 'rgba(220,235,255,0.6)'; ctx.lineWidth = 1.2;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    const slant = G.wind * 0.012;
    ctx.beginPath();
    for (const d of G.drops) {
      if (snow) { d.y += 0.0012 * d.s; d.x += slant * 0.1 + Math.sin(G.time + d.s * 10) * 0.0004; }
      else { d.y += 0.018 * d.s; d.x += slant * 0.25; }
      if (d.y > 1) { d.y -= 1.05; d.x = Math.random(); }
      if (d.x > 1.02) d.x -= 1.04; if (d.x < -0.02) d.x += 1.04;
      const x = d.x * W, y = d.y * H;
      if (snow) { ctx.moveTo(x + 2 * d.s, y); ctx.arc(x, y, 2 * d.s, 0, 7); }
      else { ctx.moveTo(x, y); ctx.lineTo(x - slant * 900 * 0.02, y - 14 * d.s); }
    }
    if (snow) ctx.fill(); else ctx.stroke();
  }

  function drawLighting(W, H, c) {
    // dinamikus fények
    const lights = G.lights.slice();
    for (const p of G.particles) if (p.type === 'light') { const a = p.life / p.max; lights.push({ x: p.x, y: p.y, r: p.r, i: p.i * a, col: p.col }); }
    if (G.night) {
      lctx.setTransform(1, 0, 0, 1, 0, 0);
      lctx.globalCompositeOperation = 'source-over';
      lctx.clearRect(0, 0, lightCv.width, lightCv.height);
      lctx.fillStyle = `rgba(4,6,28,${0.55 - G.lightning * 0.4})`;
      lctx.fillRect(0, 0, lightCv.width, lightCv.height);
      lctx.globalCompositeOperation = 'destination-out';
      lctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
      for (const L of lights) {
        const X = c.X(L.x), Y = c.Y(L.y), r = L.r * c.s;
        const g = lctx.createRadialGradient(X, Y, 0, X, Y, r);
        g.addColorStop(0, `rgba(0,0,0,${Math.min(1, L.i)})`); g.addColorStop(1, 'rgba(0,0,0,0)');
        lctx.fillStyle = g; lctx.fillRect(X - r, Y - r, r * 2, r * 2);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(lightCv, 0, 0);
      ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const L of lights) {
      const X = c.X(L.x), Y = c.Y(L.y), r = L.r * c.s * 0.8;
      const g = ctx.createRadialGradient(X, Y, 0, X, Y, r);
      g.addColorStop(0, `rgba(${L.col},${Math.min(1, L.i) * (G.night ? 0.35 : 0.25)})`); g.addColorStop(1, `rgba(${L.col},0)`);
      ctx.fillStyle = g; ctx.fillRect(X - r, Y - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawOverlayTexts(c) {
    // lebegő sebzésszámok
    for (const t of G.texts) {
      const a = Math.min(1, t.life);
      const sz = Math.max(16, c.s * (t.big ? 2.4 : 1.6));
      ctx.font = `900 ${sz}px "Arial Black", Arial`; ctx.textAlign = 'center';
      ctx.globalAlpha = a; ctx.lineWidth = 5; ctx.strokeStyle = '#000'; ctx.strokeText(t.text, c.X(t.x), c.Y(t.y));
      ctx.fillStyle = t.color; ctx.fillText(t.text, c.X(t.x), c.Y(t.y)); ctx.globalAlpha = 1;
    }
    // szövegbuborékok
    for (const t of G.tanks) {
      const b = t.bubble; if (!b) continue;
      const h = t.headWorld();
      const fs = Math.max(13, Math.min(22, c.s * 1.1));
      ctx.font = `900 ${fs}px "Arial Black", Arial`;
      const w = ctx.measureText(b.text).width + 22, bh = fs + 16;
      let X = c.X(h.x + t.dir * 2.5), Y = c.Y(h.y + 2.4 * t.headPop) - bh;
      X = clamp(X, w / 2 + 6, G.W - w / 2 - 6); Y = Math.max(G.topUI + 6, Y);
      const pop = Math.min(1, (b.max - b.t) * 8), al = Math.min(1, b.t * 3);
      ctx.save(); ctx.globalAlpha = al; ctx.translate(X, Y + bh / 2); ctx.scale(pop, pop);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
      TD.draw.rr(ctx, -w / 2, -bh / 2, w, bh, 12); ctx.fill(); ctx.stroke();
      const tx = clamp(c.X(h.x) - X, -w / 2 + 14, w / 2 - 14);
      ctx.beginPath(); ctx.moveTo(tx - 8, bh / 2 - 1); ctx.lineTo(tx, bh / 2 + 12); ctx.lineTo(tx + 8, bh / 2 - 1); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(tx - 8, bh / 2); ctx.lineTo(tx, bh / 2 + 12); ctx.lineTo(tx + 8, bh / 2); ctx.stroke();
      ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.text, 0, 1);
      ctx.restore(); ctx.textBaseline = 'alphabetic';
    }
  }

  // ================= BEMENET =================
  const keys = {};
  addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'text') return;
    keys[e.code] = true;
    if (G.state === 'menu') { if (e.code === 'Enter' && !e.repeat) document.getElementById('startBtn').click(); return; }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    Sound.init();
    if (e.code === 'KeyP' || e.code === 'Escape') { G.pause(!G.paused); return; }
    if (e.code === 'KeyM') { G.toggleMute(); return; }
    if (G.paused || G.state !== 'aim' || G.isAI(G.current)) return;
    const vsAI = G.opponent !== 'human';
    if (e.code === 'Space' && (G.current === 0 || vsAI)) G.fire();
    if ((e.code === 'Enter' || e.code === 'NumpadEnter') && (G.current === 1 || vsAI)) G.fire();
  });
  addEventListener('keyup', (e) => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  document.addEventListener('visibilitychange', () => { if (document.hidden && G.state !== 'menu' && G.state !== 'over' && !G.paused) G.pause(true); });

  // ================= FŐ CIKLUS =================
  let last = performance.now();
  function frame(now) {
    const realDt = Math.min(0.05, (now - last) / 1000); last = now;
    G.layout();
    const dt = G.paused ? 0 : realDt * G.speed;
    if (!G.paused) G.update(dt);
    G.updateCamera(realDt);
    render();
    if (G.state !== 'menu') UI.update(G);
    requestAnimationFrame(frame);
  }

  // menü háttere: két tank áll egymással szemben
  function initMenuScene() {
    TD.Terrain.init(7);
    G.tanks = [new TD.Tank(0, { face: 'gazi', color: 'green', name: UI.settings.names[0], emblem: emblemOf(UI.settings.names[0]) }), new TD.Tank(1, { face: 'zsolesz', color: 'grey', name: UI.settings.names[1], emblem: emblemOf(UI.settings.names[1]) })];
    G.tanks[0].angle = 35; G.tanks[1].angle = 55;
    G.tanks[0].setExpr('laugh', 9999); G.tanks[1].setExpr('aim', 9999);
    G.wall = new TD.Wall(CFG.WALL_X); G.wall.growTo(3, false);
    G.weather = 'clear'; G.night = false; G.genBackground();
  }

  UI.init(G);
  try { if (localStorage.getItem('td_mute') === '1') { Sound.muted = true; UI.setMute(true); } } catch (e) {}
  initMenuScene();
  UI.showScreen('menu');
  requestAnimationFrame(frame);

  // ================= TESZT API (automatikus tesztekhez) =================
  TD.test = {
    G,
    start(over) { G.start(Object.assign({}, UI.settings, over || {})); },
    aim(a, p) { const t = G.tanks[G.current]; t.angle = a; t.power = p; },
    fire() { return G.fire(); },
    info() { return { state: G.state, round: G.round, current: G.current, wall: G.wall.height, rows: G.wall.rows, hp: G.tanks.map((t) => t.hp), wind: G.wind, alive: G.wall.aliveCount(), destroyed: G.wall.destroyed, animating: G.wall.animating(), particles: G.particles.length, rubble: G.rubble.length, hist: G.history.length }; },
  };
})();
