// SkyForce 2D — top-down sprite shooter on <canvas>.
// Needs: missions.js (window.MISSIONS), sprites.js (window.SPRITES).
(function () {
  "use strict";

  const cv = document.getElementById("cv");
  const ctx = cv.getContext("2d");
  let W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2);

  function measure() {
    const nw = window.innerWidth || document.documentElement.clientWidth;
    const nh = window.innerHeight || document.documentElement.clientHeight;
    if (nw === W && nh === H) return false;
    W = nw; H = nh;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    cv.style.width = W + "px"; cv.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    return true;
  }
  window.addEventListener("resize", measure);

  const S = window.SPRITES;

  const G = {
    state: "menu", missionIndex: 0, lives: 3, score: 0, stars: 0,
    hp: 100, maxHp: 100, progress: 0, missionStars: 0, invuln: 0, elapsed: 0,
    enemyTimer: 0, starTimer: 0, fireTimer: 0, boss: null, scrollY: 0,
  };

  const bullets = [], eBullets = [], enemies = [], stars = [], parts = [];
  const player = { x: 0, y: 0, tx: 0, ty: 0, r: 22 };
  const input = { active: false };
  const keys = {};

  function mission() { return window.MISSIONS[G.missionIndex]; }

  // ---------- INPUT ----------
  function onMove(cx2, cy) {
    player.tx = Math.max(26, Math.min(W - 26, cx2));
    player.ty = Math.max(60, Math.min(H - 20, cy - 36)); // finger offset so ship visible
  }
  cv.addEventListener("pointerdown", (e) => { input.active = true; onMove(e.clientX, e.clientY); resumeAudio(); });
  cv.addEventListener("pointermove", (e) => { if (input.active) onMove(e.clientX, e.clientY); });
  window.addEventListener("pointerup", () => input.active = false);
  window.addEventListener("keydown", (e) => { keys[e.key] = true; });
  window.addEventListener("keyup", (e) => { keys[e.key] = false; });

  // ---------- AUDIO ----------
  let actx;
  function resumeAudio() { try { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); } catch (e) {} }
  function beep(freq, dur, vol, type) {
    try {
      if (!actx) return;
      const o = actx.createOscillator(), g = actx.createGain();
      o.frequency.value = freq; o.type = type || "square"; g.gain.value = vol || 0.06;
      o.connect(g); g.connect(actx.destination); o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur); o.stop(actx.currentTime + dur);
    } catch (e) {}
  }

  // ---------- ENTITIES ----------
  function spawnEnemy() {
    const m = mission();
    const sprite = Math.random() < 0.5 ? S.enemyA : S.enemyB;
    enemies.push({
      x: 40 + Math.random() * (W - 80), y: -60, spr: sprite,
      hp: m.enemyHp, max: m.enemyHp, speed: m.enemySpeed * 10,
      sway: Math.random() * 6.28, amp: 20 + Math.random() * 50, baseX: 0,
      fireCd: 1 + Math.random() * 2, r: 26, boss: false,
    });
    enemies[enemies.length - 1].baseX = enemies[enemies.length - 1].x;
  }
  function spawnBoss() {
    const m = mission();
    G.boss = { x: W / 2, y: -120, spr: S.boss, hp: m.bossHp, max: m.bossHp,
      speed: 90, dir: 1, fireCd: 1.2, r: 90, boss: true, entered: false };
    enemies.push(G.boss);
  }
  function spawnStar() {
    stars.push({ x: 40 + Math.random() * (W - 80), y: -30, spin: Math.random() * 3, r: 22, bob: Math.random() * 6.28 });
  }
  function fire() {
    bullets.push({ x: player.x - 9, y: player.y - 10 }, { x: player.x + 9, y: player.y - 10 });
    beep(900, 0.04, 0.04);
  }
  function eFire(e, spread) {
    if (spread) {
      for (let a = -0.5; a <= 0.5; a += 0.25) eBullets.push({ x: e.x, y: e.y, vx: Math.sin(a) * 180, vy: 260 });
    } else {
      eBullets.push({ x: e.x, y: e.y, vx: 0, vy: 240 });
    }
  }
  function boom(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, sp = 40 + Math.random() * 180;
      parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5 + Math.random() * 0.3, c: color, s: 2 + Math.random() * 4 });
    }
  }

  // ---------- MISSION FLOW ----------
  function startMission(idx) {
    G.missionIndex = idx; G.state = "playing"; G.progress = 0; G.missionStars = 0;
    G.hp = 100; G.invuln = 1.2; G.elapsed = 0;
    G.enemyTimer = 0.5; G.starTimer = 1; G.fireTimer = 0; G.boss = null;
    bullets.length = eBullets.length = enemies.length = stars.length = parts.length = 0;
    player.x = player.tx = W / 2; player.y = player.ty = H - 140;
    if (mission().type === "boss") spawnBoss();
    UI.showHUD();
    UI.toast("Mission " + mission().id + ": " + mission().name, mission().desc);
  }
  function missionComplete() {
    if (G.state !== "playing") return;
    G.state = "done";
    G.score += 500 + G.missionStars * 50;
    beep(660, 0.12, 0.08); setTimeout(() => beep(990, 0.18, 0.08), 120);
    const next = G.missionIndex + 1;
    const unlocked = +(localStorage.getItem("sf_unlocked") || 1);
    if (next + 1 > unlocked) localStorage.setItem("sf_unlocked", Math.min(window.MISSIONS.length, next + 1));
    if (G.missionIndex >= window.MISSIONS.length - 1) { G.state = "win"; UI.showWin(); }
    else UI.showMissionComplete();
  }
  function gameOver() { G.state = "over"; boom(player.x, player.y, "#ff7733", 40); beep(180, 0.4, 0.1); UI.showGameOver(); }
  function hitPlayer(d) {
    if (G.invuln > 0 || G.state !== "playing") return;
    G.hp -= d; G.invuln = 1.1; beep(300, 0.1, 0.08);
    if (G.hp <= 0) {
      G.lives--;
      if (G.lives <= 0) gameOver();
      else { G.hp = 100; G.invuln = 2; UI.toast("Life Lost!", "Lives left: " + G.lives); }
    }
    UI.updateHUD();
  }
  function progress(kind) {
    const m = mission();
    if (kind === "kill" && m.type === "kill") G.progress++;
    if (kind === "star" && m.type === "stars") G.progress++;
    check();
  }
  function check() {
    const m = mission();
    if (m.type === "survive") { if (G.elapsed >= m.goal) missionComplete(); }
    else if (m.type === "boss") { if (G.boss && G.boss.hp <= 0) { G.progress = 1; missionComplete(); } }
    else { if (G.progress >= m.goal) missionComplete(); }
    UI.updateHUD();
  }

  // ---------- LOOP ----------
  let last = 0;
  function loop(t) {
    requestAnimationFrame(loop);
    const resized = measure();
    if (resized && (G.state === "menu" || G.state === "playing")) {
      // keep player on-screen after a resize
      player.tx = Math.max(26, Math.min(W - 26, player.tx || W / 2));
      player.ty = Math.max(60, Math.min(H - 20, player.ty || H - 140));
    }
    const dt = Math.min((t - last) / 1000 || 0, 0.05); last = t;
    G.scrollY = (G.scrollY + 160 * dt) % 256;
    drawBackground();
    if (G.state === "playing") update(dt);
    drawEntities();
    updateParts(dt);
  }

  function update(dt) {
    const m = mission();
    G.elapsed += dt;
    if (G.invuln > 0) G.invuln -= dt;

    const k = 420 * dt;
    if (keys["ArrowLeft"] || keys["a"]) player.tx -= k;
    if (keys["ArrowRight"] || keys["d"]) player.tx += k;
    if (keys["ArrowUp"] || keys["w"]) player.ty -= k;
    if (keys["ArrowDown"] || keys["s"]) player.ty += k;
    player.tx = Math.max(26, Math.min(W - 26, player.tx));
    player.ty = Math.max(60, Math.min(H - 20, player.ty));
    player.x += (player.tx - player.x) * Math.min(1, 14 * dt);
    player.y += (player.ty - player.y) * Math.min(1, 14 * dt);

    G.fireTimer -= dt;
    if (G.fireTimer <= 0) { fire(); G.fireTimer = 0.16; }

    if (m.type !== "boss") {
      G.enemyTimer -= dt;
      if (G.enemyTimer <= 0) { spawnEnemy(); G.enemyTimer = m.enemyRate * (0.7 + Math.random() * 0.6); }
    }
    G.starTimer -= dt;
    if (G.starTimer <= 0) { spawnStar(); G.starTimer = m.starRate * (0.7 + Math.random() * 0.6); }

    // bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i]; b.y -= 620 * dt;
      if (b.y < -20) { bullets.splice(i, 1); continue; }
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        if (Math.abs(b.x - e.x) < e.r && Math.abs(b.y - e.y) < e.r) {
          bullets.splice(i, 1); e.hp--; boom(b.x, b.y, "#aef", 3);
          if (e.hp <= 0) {
            boom(e.x, e.y, e.boss ? "#ff3366" : "#7fff9f", e.boss ? 50 : 14);
            enemies.splice(j, 1); G.score += e.boss ? 5000 : 100;
            beep(e.boss ? 120 : 440, 0.1, 0.07);
            if (e.boss) { G.boss = null; check(); } else progress("kill");
          } else { beep(680, 0.02, 0.04); if (e.boss) check(); }
          break;
        }
      }
    }

    // enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (e.boss) {
        if (!e.entered) { e.y += 70 * dt; if (e.y >= 120) e.entered = true; }
        else { e.x += e.dir * e.speed * dt; if (e.x < 110 || e.x > W - 110) e.dir *= -1; }
        e.fireCd -= dt; if (e.fireCd <= 0 && e.entered) { eFire(e, true); e.fireCd = 1.0; }
        continue;
      }
      e.y += e.speed * dt; e.sway += dt * 2;
      e.x = e.baseX + Math.sin(e.sway) * e.amp;
      e.x = Math.max(24, Math.min(W - 24, e.x));
      e.fireCd -= dt;
      if (e.fireCd <= 0 && m.enemyHp >= 2) { eFire(e, false); e.fireCd = 2 + Math.random() * 2; }
      if (e.y > H + 60) { enemies.splice(i, 1); continue; }
      if (Math.abs(e.x - player.x) < e.r && Math.abs(e.y - player.y) < e.r) {
        boom(e.x, e.y, "#ff8800", 12); enemies.splice(i, 1); hitPlayer(34);
      }
    }

    // enemy bullets
    for (let i = eBullets.length - 1; i >= 0; i--) {
      const b = eBullets[i]; b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y > H + 20 || b.x < -20 || b.x > W + 20) { eBullets.splice(i, 1); continue; }
      if (Math.abs(b.x - player.x) < 18 && Math.abs(b.y - player.y) < 18) {
        eBullets.splice(i, 1); boom(b.x, b.y, "#ff3366", 6); hitPlayer(16);
      }
    }

    // stars
    for (let i = stars.length - 1; i >= 0; i--) {
      const s = stars[i]; s.y += 170 * dt; s.spin += dt * 3;
      if (s.y > H + 30) { stars.splice(i, 1); continue; }
      if (Math.abs(s.x - player.x) < 30 && Math.abs(s.y - player.y) < 30) {
        stars.splice(i, 1); G.stars++; G.missionStars++; G.score += 25;
        beep(1200, 0.06, 0.06); boom(s.x, s.y, "#ffcc22", 6); progress("star"); UI.updateHUD();
      }
    }

    if (m.type === "survive") check();
  }

  function updateParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life -= dt;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 120 * dt;
    }
  }

  // ---------- RENDER ----------
  function drawBackground() {
    // desert base
    ctx.fillStyle = "#c9a24b"; ctx.fillRect(0, 0, W, H);
    // scrolling canyon river down the middle + rocks via repeating pattern
    const tile = 256;
    for (let y = -tile + G.scrollY; y < H + tile; y += tile) {
      // river
      const rw = W * 0.26;
      ctx.fillStyle = "#3a4e86";
      ctx.fillRect(W / 2 - rw / 2, y, rw, tile);
      ctx.fillStyle = "#4a62a6";
      ctx.fillRect(W / 2 - rw / 2 + 6, y, 6, tile);
      // canyon edges (darker)
      ctx.fillStyle = "rgba(90,70,40,.45)";
      ctx.fillRect(W / 2 - rw / 2 - 18, y, 12, tile);
      ctx.fillRect(W / 2 + rw / 2 + 6, y, 12, tile);
      // rocks/cacti dots
      ctx.fillStyle = "rgba(120,95,55,.5)";
      for (let i = 0; i < 6; i++) {
        const seed = ((y * 13 + i * 97) % 211) / 211;
        const rx = seed < 0.5 ? seed * (W * 0.3) : W - seed * (W * 0.3);
        ctx.beginPath(); ctx.ellipse(rx, y + (i * 40) % tile, 10 + seed * 14, 8 + seed * 10, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    // vignette
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.35)");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }

  function blit(spr, x, y, flip) {
    ctx.save(); ctx.translate(x, y);
    if (flip) ctx.rotate(Math.PI);
    ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
    ctx.restore();
  }

  function drawEntities() {
    // stars
    for (const s of stars) {
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.spin);
      ctx.drawImage(S.star, -S.star.width / 2, -S.star.height / 2); ctx.restore();
    }
    // enemy bullets
    ctx.fillStyle = "#ff4477";
    for (const b of eBullets) { ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, 6.28); ctx.fill(); }
    // enemies (nose-down => flip)
    for (const e of enemies) {
      blit(e.spr, e.x, e.y, true);
      if (e.boss) { // boss hp bar
        ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.fillRect(W / 2 - 120, 70, 240, 10);
        ctx.fillStyle = "#ff3366"; ctx.fillRect(W / 2 - 120, 70, 240 * Math.max(0, e.hp / e.max), 10);
      } else if (e.max > 1 && e.hp < e.max) {
        ctx.fillStyle = "rgba(0,0,0,.4)"; ctx.fillRect(e.x - 18, e.y - 34, 36, 4);
        ctx.fillStyle = "#7fff9f"; ctx.fillRect(e.x - 18, e.y - 34, 36 * (e.hp / e.max), 4);
      }
    }
    // player bullets
    ctx.fillStyle = "#66ffff";
    for (const b of bullets) { ctx.fillRect(b.x - 2.5, b.y - 9, 5, 14); }
    // player (blink on invuln)
    if (G.state === "playing" || G.state === "paused") {
      if (!(G.invuln > 0 && Math.floor(G.elapsed * 12) % 2 === 0)) blit(S.player, player.x, player.y, false);
    }
    // particles
    for (const p of parts) { ctx.globalAlpha = Math.max(0, p.life * 2); ctx.fillStyle = p.c; ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); }
    ctx.globalAlpha = 1;
  }

  // ---------- UI ----------
  const UI = {
    el(id) { return document.getElementById(id); },
    showHUD() { this.el("hud").style.display = "flex"; this.updateHUD(); },
    hideHUD() { this.el("hud").style.display = "none"; },
    updateHUD() {
      const m = mission();
      this.el("score").textContent = G.score;
      this.el("starcount").textContent = G.stars;
      let hearts = ""; for (let i = 0; i < G.lives; i++) hearts += "❤";
      this.el("lives").textContent = hearts || "—";
      const hpPercent = Math.max(0, Math.min(100, G.hp));
      this.el("hpfill").style.width = hpPercent + "%";
      const hpValue = this.el("hpvalue"); if (hpValue) hpValue.textContent = Math.round(hpPercent) + "%";
      let cur, goal;
      if (m.type === "survive") { cur = Math.floor(G.elapsed); goal = m.goal; }
      else if (m.type === "boss") { cur = G.boss ? (m.bossHp - G.boss.hp) : m.bossHp; goal = m.bossHp; }
      else { cur = G.progress; goal = m.goal; }
      this.el("mtitle").textContent = "Mission " + m.id + " — " + m.name;
      this.el("mprog").textContent = cur + " / " + goal;
      this.el("mfill").style.width = Math.min(100, (cur / goal) * 100) + "%";
    },
    toast(title, sub) {
      const t = this.el("toast");
      t.innerHTML = "<b>" + title + "</b><span>" + (sub || "") + "</span>";
      t.classList.add("show"); clearTimeout(this._t);
      this._t = setTimeout(() => t.classList.remove("show"), 2200);
    },
    over(html) { const o = this.el("overlay"); o.style.display = "flex"; o.innerHTML = html; },
    hide() { this.el("overlay").style.display = "none"; },
    showMenu() {
      this.hideHUD();
      this.over(`<div class="panel">
        <h1>SKYFORCE <span>3D</span></h1>
        <p class="sub">War over the desert skies — ${window.MISSIONS.length} missions</p>
        <button id="bStart" class="btn">▶ Play</button>
        <button id="bSel" class="btn ghost">🎯 Select Mission</button>
        <p class="hint">Drag with mouse / finger to fly · Auto-fire · Keyboard: Arrows / WASD</p>
      </div>`);
      this.el("bStart").onclick = () => { resumeAudio(); G.lives = 3; G.score = 0; G.stars = 0; this.hide(); startMission(0); };
      this.el("bSel").onclick = () => this.showSelect();
    },
    showSelect() {
      const unlocked = +(localStorage.getItem("sf_unlocked") || 1);
      let grid = "";
      window.MISSIONS.forEach((m, i) => {
        const open = i < unlocked;
        grid += `<button class="mcell ${open ? "" : "locked"}" data-i="${i}" ${open ? "" : "disabled"}>
          <span class="mnum">${m.id}</span><span class="mname">${open ? m.name : "🔒"}</span></button>`;
      });
      this.over(`<div class="panel wide"><h2>Select Mission</h2><div class="mgrid">${grid}</div>
        <button id="bBack" class="btn ghost">← Back</button></div>`);
      this.el("overlay").querySelectorAll(".mcell:not(.locked)").forEach(b =>
        b.onclick = () => { resumeAudio(); G.lives = 3; G.score = 0; G.stars = 0; this.hide(); startMission(+b.dataset.i); });
      this.el("bBack").onclick = () => this.showMenu();
    },
    showMissionComplete() {
      const next = G.missionIndex + 1;
      this.hideHUD();
      this.over(`<div class="panel"><h2>✅ Mission Complete!</h2><p class="sub">${mission().name}</p>
        <div class="stats"><div><span>⭐ Stars</span><b>${G.missionStars}</b></div><div><span>Score</span><b>${G.score}</b></div></div>
        <button id="bNext" class="btn">▶ Next Mission (${next + 1})</button>
        <button id="bMenu" class="btn ghost">Menu</button></div>`);
      this.el("bNext").onclick = () => { this.hide(); startMission(next); };
      this.el("bMenu").onclick = () => this.showMenu();
    },
    showGameOver() {
      this.hideHUD();
      this.over(`<div class="panel"><h2 class="bad">💥 Game Over</h2>
        <p class="sub">Mission ${mission().id} — ${mission().name}</p>
        <div class="stats"><div><span>Score</span><b>${G.score}</b></div><div><span>⭐</span><b>${G.stars}</b></div></div>
        <button id="bRetry" class="btn">↻ Retry</button><button id="bMenu" class="btn ghost">Menu</button></div>`);
      this.el("bRetry").onclick = () => { this.hide(); G.lives = 3; startMission(G.missionIndex); };
      this.el("bMenu").onclick = () => this.showMenu();
    },
    showWin() {
      this.hideHUD();
      this.over(`<div class="panel"><h1>🏆 Victory!</h1><p class="sub">You cleared all ${window.MISSIONS.length} missions!</p>
        <div class="stats"><div><span>Score</span><b>${G.score}</b></div><div><span>⭐</span><b>${G.stars}</b></div></div>
        <button id="bMenu" class="btn">🏠 Menu</button></div>`);
      this.el("bMenu").onclick = () => this.showMenu();
    },
  };

  window.SF = { G, startMission, UI };

  // ---------- BOOT ----------
  measure();
  window.addEventListener("load", measure);
  requestAnimationFrame(loop);
  UI.showMenu();
  const pb = document.getElementById("pauseBtn");
  if (pb) pb.onclick = () => {
    if (G.state === "playing") { G.state = "paused"; UI.toast("Paused", "Tap ⏸ to resume"); }
    else if (G.state === "paused") { G.state = "playing"; last = performance.now(); }
  };
})();
