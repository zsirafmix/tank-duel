/* GIGÁSZOK CSATÁJA – kezelőfelület (HUD, menük, csúszkák) */
(function () {
  'use strict';
  const TD = window.TD;
  const $ = (id) => document.getElementById(id);
  const LS_SET = 'td_settings_v1', LS_SCORE = 'td_scores_v1';

  const WEATHER_LBL = { clear: '☀️ Derült', clouds: '☁️ Felhős', rain: '🌧️ Eső', snow: '❄️ Havazás', storm: '⛈️ Vihar' };

  const UI = {
    settings: { opponent: 'human', mode: 'classic', time: 'random', weather: 'random', preview: 'short', names: ['Gazi', 'Zsolesz'] },
    scores: { wins: {}, endlessBest: 0 },
    dragging: false,
    last: {},

    init(G) {
      this.G = G;
      try { Object.assign(this.settings, JSON.parse(localStorage.getItem(LS_SET) || '{}')); } catch (e) {}
      try { Object.assign(this.scores, JSON.parse(localStorage.getItem(LS_SCORE) || '{}')); } catch (e) {}
      if (!Array.isArray(this.settings.names) || this.settings.names.length !== 2) this.settings.names = ['Gazi', 'Zsolesz'];
      // menü szegmensek
      document.querySelectorAll('.seg').forEach((seg) => {
        const opt = seg.dataset.opt;
        seg.querySelectorAll('button').forEach((b) => {
          b.classList.toggle('on', b.dataset.v === this.settings[opt]);
          b.addEventListener('click', () => {
            seg.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
            b.classList.add('on');
            this.settings[opt] = b.dataset.v;
            this.save();
            TD.Sound && TD.Sound.click();
          });
        });
      });
      $('inName0').value = this.settings.names[0];
      $('inName1').value = this.settings.names[1];
      const nameUpd = () => {
        this.settings.names = [$('inName0').value.trim() || 'Gazi', $('inName1').value.trim() || 'Zsolesz'];
        this.save();
      };
      $('inName0').addEventListener('input', nameUpd);
      $('inName1').addEventListener('input', nameUpd);
      $('swapNames').addEventListener('click', () => {
        const a = $('inName0').value; $('inName0').value = $('inName1').value; $('inName1').value = a; nameUpd();
      });
      $('startBtn').addEventListener('click', () => { nameUpd(); G.start(this.settings); });
      $('resumeBtn').addEventListener('click', () => G.pause(false));
      $('restartBtn').addEventListener('click', () => G.start(this.settings));
      $('toMenuBtn').addEventListener('click', () => G.toMenu());
      $('againBtn').addEventListener('click', () => G.start(this.settings));
      $('winMenuBtn').addEventListener('click', () => G.toMenu());
      $('pauseBtn').addEventListener('click', () => G.pause(!G.paused));
      $('muteBtn').addEventListener('click', () => G.toggleMute());
      $('fireBtn').addEventListener('click', () => G.fireHuman());
      $('rotateOk').addEventListener('click', () => { this.rotateDismissed = true; $('rotateHint').classList.add('hidden'); });

      const ang = $('angle'), pow = $('power');
      const onSlide = () => G.setAimHuman(parseFloat(ang.value), parseFloat(pow.value));
      for (const el of [ang, pow]) {
        el.addEventListener('input', onSlide);
        el.addEventListener('pointerdown', () => (this.dragging = true));
        el.addEventListener('pointerup', () => (this.dragging = false));
        el.addEventListener('change', () => (this.dragging = false));
        el.addEventListener('keydown', (e) => e.preventDefault()); // a billentyűket a játék kezeli
      }
      // +/- gombok nyomva tartással
      document.querySelectorAll('.adj').forEach((b) => {
        let timer = null, rep = null;
        const go = () => G.nudge(b.dataset.k, parseFloat(b.dataset.v) * 0.5);
        const stop = () => { clearTimeout(timer); clearInterval(rep); timer = rep = null; };
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); go(); timer = setTimeout(() => (rep = setInterval(go, 45)), 320); });
        ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, stop));
      });
      $('prevToggle').checked = this.settings.preview !== 'off';
      $('prevToggle').addEventListener('change', (e) => { G.showPreview = e.target.checked; e.target.blur(); });
      $('lastToggle').addEventListener('change', (e) => { G.showLast = e.target.checked; e.target.blur(); });
      this.renderScores();
    },
    save() { try { localStorage.setItem(LS_SET, JSON.stringify(this.settings)); } catch (e) {} },
    saveScores() { try { localStorage.setItem(LS_SCORE, JSON.stringify(this.scores)); } catch (e) {} },
    addWin(name) { this.scores.wins[name] = (this.scores.wins[name] || 0) + 1; this.saveScores(); },
    renderScores() {
      const w = this.scores.wins, n = this.settings.names;
      const el = $('scoreBoard');
      el.innerHTML = `🏆 Eredmények: <b>${esc(n[0])}</b> ${w[n[0]] || 0} – ${w[n[1]] || 0} <b>${esc(n[1])}</b>` +
        (this.scores.endlessBest ? ` &nbsp;|&nbsp; 🧱 Végtelen fal rekord: <b>${this.scores.endlessBest}. forduló</b>` : '') +
        ` <button id="resetScores">nullázás</button>`;
      $('resetScores').onclick = () => { this.scores = { wins: {}, endlessBest: 0 }; this.saveScores(); this.renderScores(); };
    },

    showScreen(name) {
      for (const id of ['menu', 'pauseScr', 'winScr']) $(id).classList.toggle('hidden', id !== name);
      const inGame = name !== 'menu';
      $('hud').classList.toggle('hidden', !inGame);
      $('controls').classList.toggle('hidden', !inGame);
      if (name === 'menu') this.renderScores();
    },

    setupGame(G) {
      for (let i = 0; i < 2; i++) {
        const t = G.tanks[i];
        $('name' + i).textContent = t.name;
        $('por' + i).src = `assets/images/${t.faceKey}_portrait.png`;
        $('wins' + i).textContent = '🏆 ' + (this.scores.wins[t.name] || 0) + ' győzelem';
      }
      $('prevToggle').checked = G.showPreview;
      $('lastToggle').checked = G.showLast;
      $('weatherLbl').textContent = WEATHER_LBL[G.weather] + (G.night ? ' · 🌙 Éjszaka' : ' · ☀️ Nappal') + (G.mode === 'endless' ? ' · Végtelen fal' : '');
      this.last = {};
    },

    /** Képkockánként hívva – csak változáskor ír a DOM-ba */
    update(G) {
      const L = this.last;
      for (let i = 0; i < 2; i++) {
        const t = G.tanks[i];
        if (L['hp' + i] !== t.hp) {
          L['hp' + i] = t.hp;
          const f = $('hp' + i);
          f.style.width = t.hp + '%';
          f.classList.toggle('mid', t.hp <= 60 && t.hp > 30);
          f.classList.toggle('low', t.hp <= 30);
          $('hpt' + i).textContent = Math.round(t.hp) + ' / 100';
        }
      }
      const cur = G.current;
      const act = G.state === 'aim' || G.state === 'flight';
      const key = cur + '|' + act;
      if (L.turn !== key) {
        L.turn = key;
        $('hudP0').classList.toggle('active', act && cur === 0);
        $('hudP1').classList.toggle('active', act && cur === 1);
        const tag = $('turnTag');
        tag.textContent = G.tanks[cur].name + (G.isAI(cur) ? ' (gép) gondolkodik…' : ' lő');
        tag.classList.toggle('p1', cur === 1);
        $('fireBtn').style.background = cur === 0 ? 'linear-gradient(#7be05a,#2c9e1a)' : 'linear-gradient(#e0e6ec,#7d868e)';
        $('fireBtn').style.color = cur === 0 ? '#fff' : '#111';
      }
      const enabled = G.state === 'aim' && !G.isAI(cur) && !G.paused;
      if (L.en !== enabled) { L.en = enabled; $('controls').classList.toggle('disabled', !enabled); }
      if (L.round !== G.round) { L.round = G.round; $('roundLbl').textContent = G.round + '. forduló' + (G.mode === 'endless' ? ' 🧱' : ''); }
      const w = Math.round(G.wind * 10) / 10;
      if (L.wind !== w) {
        L.wind = w;
        $('windVal').textContent = Math.abs(w).toFixed(1) + ' m/s';
        const arr = $('windArrow');
        arr.style.transform = `scaleX(${w < 0 ? -1 : 1}) scale(${0.7 + Math.min(1, Math.abs(w) / 10) * 0.8})`;
        arr.style.opacity = Math.abs(w) < 0.2 ? 0.3 : 1;
      }
      const wh = G.wall.height;
      if (L.wall !== wh) { L.wall = wh; $('wallLbl').textContent = (Math.round(wh * 10) / 10) + ' m' + (wh >= G.wall.cap ? ' (max)' : ''); }
      const t = G.tanks[cur];
      if (!this.dragging && (L.ang !== t.angle || L.pow !== t.power)) {
        L.ang = t.angle; L.pow = t.power;
        $('angle').value = t.angle; $('power').value = t.power;
      }
      if (L.angTxt !== t.angle) { L.angTxt = t.angle; $('angVal').textContent = t.angle.toFixed(1) + '°'; }
      if (L.powTxt !== t.power) { L.powTxt = t.power; $('powVal').textContent = t.power.toFixed(1) + '%'; }
      // álló telefon figyelmeztetés
      const portrait = innerHeight > innerWidth * 1.15 && innerWidth < 700;
      $('rotateHint').classList.toggle('hidden', !portrait || this.rotateDismissed || G.state === 'menu');
    },

    banner(html, color) {
      const b = $('turnBanner');
      b.innerHTML = html;
      b.style.color = color || '#fff';
      b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    },
    ouch(i) {
      const p = $('por' + i);
      p.classList.remove('ouch'); void p.offsetWidth; p.classList.add('ouch');
    },
    showWin(info) {
      $('winPor').src = `assets/images/${info.winner.faceKey}_portrait.png`;
      $('winTitle').textContent = info.title;
      $('winQuip').textContent = info.quip;
      $('winStats').innerHTML = info.stats.map((s) => `<div>${s}</div>`).join('');
      this.showScreen('winScr');
    },
    showPause(on) {
      $('pauseScr').classList.toggle('hidden', !on);
      $('pauseBtn').textContent = on ? '▶' : '⏸';
    },
    setMute(m) { $('muteBtn').textContent = m ? '🔇' : '🔊'; },
  };
  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  TD.UI = UI;
  TD.esc = esc;
})();
