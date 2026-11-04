// SkyForce 2D — top-down sprite shooter on <canvas>.
// Needs: missions.js (window.MISSIONS), sprites.js (window.SPRITES).
(function () {
  "use strict";

  const cv = document.getElementById("cv");
  const ctx = cv.getContext("2d");
  let W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2);

  function measure() {
    // Use the canvas element's actual rendered CSS box (reliable on mobile WebView).
    const nw = Math.round(cv.clientWidth || window.innerWidth || document.documentElement.clientWidth);
    const nh = Math.round(cv.clientHeight || window.innerHeight || document.documentElement.clientHeight);
    // Ignore tiny fluctuations (address-bar animation etc.) to avoid resize flicker.
    if (Math.abs(nw - W) < 2 && Math.abs(nh - H) < 2) return false;
    W = nw; H = nh;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    return true;
  }
  window.addEventListener("resize", measure);
  window.addEventListener("orientationchange", () => setTimeout(measure, 120));

  const S = window.SPRITES, A = window.ASSETS;

  // ---------- pixel-art terrain tile (generated once, scrolled) ----------
  const TILE_LOW = 220, TILE_H = 1600;
  const CXB = TILE_LOW / 2;
  function edgeHW(y) { // half-width of river channel at low-res row y (periodic -> seamless)
    return 40 + Math.sin(y * 2 * Math.PI * 5 / TILE_H) * 20 + Math.sin(y * 2 * Math.PI * 11 / TILE_H) * 9 + Math.sin(y * 2 * Math.PI * 2 / TILE_H) * 7;
  }
  function sandX(py, minPad) { // random x on sand (either side), away from river
    const side = Math.random() < 0.5 ? 1 : -1;
    const minx = edgeHW(py) + (minPad || 8), span = (TILE_LOW / 2 - minx - 5);
    if (span <= 0) return null;
    return Math.round(CXB + side * (minx + Math.random() * span));
  }
  // per-world terrain palettes
  const TPAL = [
    { // Desert
      sand: "#d9b65f", blob: ["rgba(231,199,116,.45)", "rgba(186,144,66,.4)"], dapple: "rgba(255,236,180,.25)",
      grain: ["rgba(96,64,26,.06)", "rgba(255,244,210,.06)"], mesa: ["#9c8c68", "#bdae88", "#857754"],
      river: ["#2f365f", "#3a4170", "#464f90"], ripple: "rgba(120,140,210,.3)", sparkle: "rgba(170,195,255,.6)", foam: "rgba(200,215,255,.22)",
      wrock: ["#565066", "#7a7488"], wall: ["#6a6472", "#746a7c", "#5f5a6c", "#7b6f80"], wallHi: "#9a93a8", wallSh: "rgba(12,8,22,.6)", rim: "rgba(120,95,55,.5)",
      clust: ["#8a7355", "#a89070", "#6b573c"], bush: ["#3f6e2c", "#4e8636", "#6aa84a"], veg: "cactus",
    },
    { // Jungle
      sand: "#3f7a34", blob: ["rgba(90,150,70,.42)", "rgba(36,84,38,.42)"], dapple: "rgba(200,240,160,.2)",
      grain: ["rgba(16,46,18,.08)", "rgba(200,255,180,.06)"], mesa: ["#6b5a3a", "#8a7550", "#4a3c24"],
      river: ["#1f5a4a", "#2a7a5e", "#3fa07a"], ripple: "rgba(120,220,180,.3)", sparkle: "rgba(200,255,230,.6)", foam: "rgba(210,255,235,.25)",
      wrock: ["#4a5040", "#6a7458"], wall: ["#3c5a2e", "#2e4a24", "#476c38", "#345226"], wallHi: "#6aa050", wallSh: "rgba(8,20,8,.6)", rim: "rgba(50,80,30,.5)",
      clust: ["#5a4a2e", "#7a6540", "#3a2e1a"], bush: ["#2e5a22", "#3f7a30", "#5aa040"], veg: "tree",
    },
    { // Snow
      sand: "#dfe7ef", blob: ["rgba(255,255,255,.5)", "rgba(190,205,225,.45)"], dapple: "rgba(255,255,255,.3)",
      grain: ["rgba(120,140,170,.06)", "rgba(255,255,255,.08)"], mesa: ["#9fb0c2", "#c6d6e6", "#7389a0"],
      river: ["#2a6a8a", "#3f8fb0", "#6fc0dd"], ripple: "rgba(180,230,255,.35)", sparkle: "rgba(255,255,255,.7)", foam: "rgba(235,250,255,.3)",
      wrock: ["#8a97a8", "#b8c6d6"], wall: ["#8ea0b4", "#7a8ca0", "#a0b2c4", "#90a2b6"], wallHi: "#d6e4f0", wallSh: "rgba(40,60,90,.5)", rim: "rgba(210,225,240,.6)",
      clust: ["#9aa6b6", "#c6d2e0", "#6f7e90"], bush: ["#5a7a6a", "#7a9a88", "#a8c8b8"], veg: "pine",
    },
    { // Cyber
      sand: "#1b2030", blob: ["rgba(40,55,80,.5)", "rgba(18,26,42,.5)"], dapple: "rgba(60,120,160,.12)",
      grain: ["rgba(0,0,0,.12)", "rgba(90,200,255,.05)"], mesa: ["#2a3350", "#3f4e78", "#161c2c"],
      river: ["#0a2a3a", "#0f4a66", "#1fd0ff"], ripple: "rgba(60,220,255,.35)", sparkle: "rgba(180,255,255,.8)", foam: "rgba(120,240,255,.3)",
      wrock: ["#20304a", "#3f5a80"], wall: ["#2a3450", "#20283e", "#344066", "#283250"], wallHi: "#5fd0ff", wallSh: "rgba(0,0,0,.6)", rim: "rgba(60,200,255,.4)",
      clust: ["#2a3350", "#4a5e90", "#141a2a"], bush: ["#1f6a8a", "#2f9ac0", "#4fd0ff"], veg: "neon",
    },
  ];

  function drawVeg(x, P, px, py) {
    if (P.veg === "cactus") {
      x.fillStyle = "rgba(0,0,0,.12)"; x.fillRect(px - 2, py + 7, 7, 1);
      x.fillStyle = "#3f8a3a"; x.fillRect(px, py, 3, 8); x.fillRect(px - 3, py + 2, 3, 3); x.fillRect(px + 3, py + 3, 3, 3);
      x.fillStyle = "#58a84e"; x.fillRect(px, py, 1, 8); x.fillStyle = "#2c6b2a"; x.fillRect(px, py + 7, 3, 1);
    } else if (P.veg === "tree") {
      x.fillStyle = "rgba(0,0,0,.18)"; x.beginPath(); x.ellipse(px + 2, py + 9, 7, 3, 0, 0, 6.28); x.fill();
      x.fillStyle = "#5a3f22"; x.fillRect(px, py + 3, 3, 7);
      x.fillStyle = "#2e6b26"; x.beginPath(); x.arc(px + 1, py + 1, 7, 0, 6.28); x.fill();
      x.fillStyle = "#3f8a30"; x.beginPath(); x.arc(px - 2, py, 4, 0, 6.28); x.arc(px + 4, py + 1, 4, 0, 6.28); x.fill();
      x.fillStyle = "#5aa84a"; x.beginPath(); x.arc(px - 1, py - 2, 2.5, 0, 6.28); x.fill();
    } else if (P.veg === "pine") {
      x.fillStyle = "rgba(60,80,110,.3)"; x.beginPath(); x.ellipse(px + 1, py + 10, 6, 2, 0, 0, 6.28); x.fill();
      x.fillStyle = "#3a2a1a"; x.fillRect(px, py + 7, 2, 4);
      x.fillStyle = "#1f5a3a"; x.beginPath(); x.moveTo(px + 1, py - 2); x.lineTo(px + 7, py + 8); x.lineTo(px - 5, py + 8); x.closePath(); x.fill();
      x.fillStyle = "#e8f2ff"; x.beginPath(); x.moveTo(px + 1, py - 2); x.lineTo(px + 4, py + 2); x.lineTo(px - 2, py + 2); x.closePath(); x.fill(); // snow cap
    } else { // neon post
      x.fillStyle = "#101828"; x.fillRect(px, py, 2, 9);
      const g = x.createRadialGradient(px + 1, py, 1, px + 1, py, 6); g.addColorStop(0, "#9afcff"); g.addColorStop(1, "rgba(31,208,255,0)");
      x.fillStyle = g; x.beginPath(); x.arc(px + 1, py, 6, 0, 6.28); x.fill();
      x.fillStyle = "#ff3aff"; x.fillRect(px, py + 9, 2, 2);
    }
  }

  function buildTerrain(P) {
    const c = document.createElement("canvas"); c.width = TILE_LOW; c.height = TILE_H;
    const x = c.getContext("2d");
    x.fillStyle = P.sand; x.fillRect(0, 0, TILE_LOW, TILE_H);
    for (let i = 0; i < 90; i++) {
      x.fillStyle = Math.random() < 0.5 ? P.blob[0] : P.blob[1];
      const bx = Math.random() * TILE_LOW, by = Math.random() * TILE_H, r = 8 + Math.random() * 30;
      x.beginPath(); x.ellipse(bx, by, r, r * (0.6 + Math.random() * 0.5), Math.random() * 3, 0, 6.28); x.fill();
    }
    for (let i = 0; i < 40; i++) {
      x.fillStyle = P.dapple;
      const bx = Math.random() * TILE_LOW, by = Math.random() * TILE_H, r = 10 + Math.random() * 26;
      x.beginPath(); x.ellipse(bx, by, r, r * 0.7, 0, 0, 6.28); x.fill();
    }
    const dots = (TILE_LOW * TILE_H * 0.10) | 0;
    for (let i = 0; i < dots; i++) {
      x.fillStyle = Math.random() < 0.5 ? P.grain[0] : P.grain[1];
      x.fillRect((Math.random() * TILE_LOW) | 0, (Math.random() * TILE_H) | 0, 1, 1);
    }
    // mesas / mounds
    for (let i = 0; i < 34; i++) {
      const py = (Math.random() * TILE_H) | 0; const px = sandX(py, 10); if (px === null) continue;
      const w = (8 + Math.random() * 16) | 0, h = (6 + Math.random() * 14) | 0;
      x.fillStyle = "rgba(0,0,0,.16)"; x.fillRect(px - (w >> 1) + 2, py + 3, w, h);
      x.fillStyle = P.mesa[0]; x.fillRect(px - (w >> 1), py, w, h);
      x.fillStyle = P.mesa[1]; x.fillRect(px - (w >> 1), py, w, 2);
      x.fillStyle = P.mesa[2]; x.fillRect(px - (w >> 1), py + h - 2, w, 2);
      x.fillStyle = "rgba(0,0,0,.12)"; x.fillRect(px + (w >> 1) - 2, py, 2, h);
    }
    // river
    for (let y = 0; y < TILE_H; y++) {
      const hw = edgeHW(y), l = Math.round(CXB - hw), r = Math.round(CXB + hw), wd = r - l;
      x.fillStyle = P.river[0]; x.fillRect(l, y, wd, 1);
      x.fillStyle = P.river[1]; x.fillRect(l + 3, y, wd - 6, 1);
      x.fillStyle = P.river[2]; x.fillRect(CXB - 5, y, 10, 1);
      if (y % 9 === 0) { x.fillStyle = P.ripple; x.fillRect(l + 4, y, wd - 8, 1); }
      if (Math.random() < 0.04) { x.fillStyle = P.sparkle; x.fillRect(l + ((Math.random() * wd) | 0), y, 1 + (Math.random() * 2 | 0), 1); }
      x.fillStyle = P.foam; x.fillRect(l + 1, y, 2, 1); x.fillRect(r - 3, y, 2, 1);
    }
    // rocks in water
    for (let i = 0; i < 22; i++) {
      const py = (Math.random() * TILE_H) | 0; const hw = edgeHW(py);
      const px = Math.round(CXB + (Math.random() * 2 - 1) * (hw - 6));
      x.fillStyle = P.wrock[0]; x.fillRect(px, py, 3, 3); x.fillStyle = P.wrock[1]; x.fillRect(px, py, 3, 1);
      x.fillStyle = P.foam; x.fillRect(px - 1, py + 3, 5, 1);
    }
    // rock banks
    for (let y = 0; y < TILE_H; y += 2) {
      const hw = edgeHW(y);
      [-1, 1].forEach(d => {
        const ex = CXB + d * hw, bw = 4 + ((Math.random() * 7) | 0), bx = Math.round(d < 0 ? ex - bw : ex);
        x.fillStyle = P.wall[(Math.random() * P.wall.length) | 0]; x.fillRect(bx, y, bw, 2);
        x.fillStyle = P.wallHi; x.fillRect(bx, y, bw, 1);
        x.fillStyle = P.wallSh; x.fillRect(Math.round(d < 0 ? ex - 1 : ex), y, 1, 2);
        x.fillStyle = P.rim; x.fillRect(Math.round(d < 0 ? bx - 1 : bx + bw), y, 1, 2);
      });
    }
    // rock clusters
    for (let i = 0; i < 70; i++) {
      const py = (Math.random() * TILE_H) | 0; const px = sandX(py, 10); if (px === null) continue;
      x.fillStyle = "rgba(0,0,0,.12)"; x.fillRect(px, py + 3, 4, 1);
      x.fillStyle = P.clust[0]; x.fillRect(px, py, 4, 3);
      x.fillStyle = P.clust[1]; x.fillRect(px, py, 4, 1);
      x.fillStyle = P.clust[2]; x.fillRect(px, py + 2, 4, 1);
    }
    // bushes
    for (let i = 0; i < 48; i++) {
      const py = (Math.random() * TILE_H) | 0; const px = sandX(py, 10); if (px === null) continue;
      x.fillStyle = P.bush[0]; x.fillRect(px - 2, py + 1, 6, 3);
      x.fillStyle = P.bush[1]; x.fillRect(px - 1, py, 4, 3);
      x.fillStyle = P.bush[2]; x.fillRect(px, py, 2, 2);
    }
    // vegetation (world-specific)
    for (let i = 0; i < 26; i++) {
      const py = (Math.random() * TILE_H) | 0; const px = sandX(py, 14); if (px === null) continue;
      drawVeg(x, P, px, py);
    }
    return c;
  }
  const terrains = TPAL.map(buildTerrain);

  // equipped-plane sprites (one per catalog plane)
  const PLANE_SPR = window.PLANES.map(p => S.makeFighter(p.palette));
  const BOSS_PAL = [
    { wing1: "#6a5a7a", wing2: "#413050", body1: "#3a2a4a", body2: "#8a3ab0", core: "#ff5a8a", coreMid: "#ff3366" }, // desert
    { wing1: "#3f6a3a", wing2: "#204020", body1: "#244a22", body2: "#4e9a3a", core: "#b6ff6a", coreMid: "#7ad84a" }, // jungle
    { wing1: "#8ea8c0", wing2: "#4a6080", body1: "#3a5a7a", body2: "#8fcfe6", core: "#d6f4ff", coreMid: "#5fc8ff" }, // snow
    { wing1: "#2a3450", wing2: "#141c30", body1: "#101828", body2: "#2f6aa0", core: "#5fffff", coreMid: "#1fd0ff" }, // cyber
  ];
  const BOSS_SPR = BOSS_PAL.map(p => S.makeBoss(p));
  function equippedSprite() { return PLANE_SPR[window.SAVE.get().equipped] || S.player; }
  function planeShot(id) {
    const tier = Math.min(4, Math.floor(id / 3));
    const colors = ["#66ffff", "#7affa0", "#ffd24a", "#ff7ad0", "#b08aff"];
    return { color: colors[tier], base: Math.min(3, Math.floor(id / 3)) }; // pricier plane -> wider base fire
  }

  const G = {
    state: "menu", missionIndex: 0, lives: 3, score: 0, stars: 0,
    hp: 100, maxHp: 100, progress: 0, missionStars: 0, invuln: 0, elapsed: 0,
    enemyTimer: 0, starTimer: 0, fireTimer: 0, boss: null, scrollY: 0,
    pdmg: 1, fireInt: 0.16, pspeed: 12, runCoins: 0, power: 1, terrainWorld: 0,
  };

  const fxs = [];
  function addFx(x, y, big, variant) { if (fxs.length < 24) fxs.push({ x, y, big: !!big, v: (variant || 0) % 6, t: 0 }); }
  const bullets = [], eBullets = [], enemies = [], stars = [], parts = [], coinItems = [];
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
  function resumeAudio() { try { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); A.loadSfx(actx); } catch (e) {} }
  function sfx(name, vol) { return A.playSfx(actx, name, vol); }
  function beep(freq, dur, vol, type) {
    try {
      if (!actx) return;
      const o = actx.createOscillator(), g = actx.createGain();
      o.frequency.value = freq; o.type = type || "square"; g.gain.value = vol || 0.06;
      o.connect(g); g.connect(actx.destination); o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur); o.stop(actx.currentTime + dur);
    } catch (e) {}
  }
  let musicOn = true;
  try { musicOn = localStorage.getItem("skyrush_music") !== "off"; } catch (e) {}
  function trackFor(mode) {
    if (mode === "menu") return "menu";
    const m = mission();
    return m.type === "boss" ? (m.final ? "final_boss" : "boss_" + A.NAMES[m.world]) : "play_" + A.NAMES[m.world];
  }
  function startMusic(mode) { resumeAudio(); A.setMusicEnabled(musicOn); A.playMusic(["victory", "credits", "gameover"].includes(mode) ? mode : trackFor(mode)); }
  function stopMusic() { A.stopMusic(); }
  function setMusicOn(on) {
    musicOn = on;
    try { localStorage.setItem("skyrush_music", on ? "on" : "off"); } catch (e) {}
    A.setMusicEnabled(on);
  }
  // Browsers only allow audio after a touch; stop it when the app is in the background.
  document.addEventListener("pointerdown", resumeAudio);
  document.addEventListener("visibilitychange", () => {
    if (!actx) return;
    try { if (document.hidden) actx.suspend(); else actx.resume(); } catch (e) {}
  });

  // ---------- ENTITIES ----------
  // 0 fighter: sways. 1 gunship: slow, aimed bursts. 2 interceptor: fast zigzag. 3 bomber: tough, wide spread.
  const ETYPES = [
    { hp: 1, sp: 1.05, r: 24, scale: .32, amp: 1, fire: .7 }, { hp: 1.6, sp: .8, r: 30, scale: .3, amp: .5, fire: 1 },
    { hp: .8, sp: 1.45, r: 22, scale: .34, amp: 1.8, fire: .25 }, { hp: 3, sp: .6, r: 38, scale: .34, amp: .25, fire: 1 },
  ];
  function spawnEnemy() {
    const m = mission();
    const roll = Math.random(), t = G.missionIndex < 3 ? 0 : roll < .45 ? 0 : roll < .7 ? 1 : roll < .9 ? 2 : (G.missionIndex >= 8 ? 3 : 1);
    const T = ETYPES[t], hp = Math.round(Math.max(2, m.enemyHp * 2) * T.hp);
    const x0 = 40 + Math.random() * (W - 80);
    enemies.push({
      x: x0, baseX: x0, y: -60, type: t, spr: A.enemy(m.world, t), fb: t === 1 || t === 3 ? S.enemyB : S.enemyA, scale: T.scale,
      hp: hp, max: hp, speed: m.enemySpeed * 10 * T.sp, sway: Math.random() * 6.28, amp: (20 + Math.random() * 50) * T.amp,
      canFire: Math.random() < T.fire, fireCd: 1.2 + Math.random() * 2.2, bdmg: t === 3 ? 2 : 1, btrack: 0.3 + Math.random() * 0.18,
      bspeed: t === 1 ? 25 : 0, r: T.r, boss: false, spread: t === 3,
    });
  }
  function spawnBoss() {
    const m = mission();
    G.boss = { x: W / 2, y: -120, spr: A.bosses[m.world], fb: BOSS_SPR[m.world % 4], scale: .3, phase: 1, spin: 0, minion: 4, hp: m.bossHp, max: m.bossHp,
      speed: 110, dir: 1, fireCd: 1.0, r: 90, boss: true, entered: false,
      bdmg: 2, btrack: 0.4, bspeed: 30 };
    enemies.push(G.boss);
    sfx("alarm", .35);
  }
  function spawnStar() {
    stars.push({ x: 40 + Math.random() * (W - 80), y: -30, spin: Math.random() * 3, r: 22, bob: Math.random() * 6.28 });
  }
  function spawnCoin(x, y) {
    coinItems.push({ kind: "coin", x: x != null ? x : 40 + Math.random() * (W - 80), y: y != null ? y : -30, spin: Math.random() * 3, vy: 130 + Math.random() * 70 });
  }
  function spawnPower(x, y) {
    coinItems.push({ kind: "power", x: x, y: y, spin: 0, vy: 110 + Math.random() * 40 });
  }
  function fire() {
    const p = Math.min(5, G.power + (G.pshot ? G.pshot.base : 0)); // plane adds base lanes
    const col = G.pshot ? G.pshot.color : "#66ffff";
    let offs;
    if (p <= 1) offs = [0];
    else if (p === 2) offs = [-7, 7];
    else if (p === 3) offs = [-11, 0, 11];
    else if (p === 4) offs = [-15, -5, 5, 15];
    else offs = [-18, -9, 0, 9, 18];
    offs.forEach(dx => bullets.push({ x: player.x + dx, y: player.y - 12, vx: dx * 0.55, col: col }));
    if (!sfx("shot" + Math.min(2, G.power >> 1), .13)) beep(900, 0.03, 0.035);
  }
  function eFire(e) {
    const dmg = e.bdmg || 1, track = e.btrack || 0;
    const r = dmg >= 2 ? 7 : 5, col = dmg >= 2 ? "#ff9a33" : "#ff4477";
    const sp = 195 + (e.bspeed || 0);
    const aim = (ang) => {
      const dx = player.x - e.x, dy = player.y - e.y, d = Math.hypot(dx, dy) || 1;
      let tx = dx / d, ty = dy / d;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const rx = tx * ca - ty * sa, ry = tx * sa + ty * ca;
      // 65% aimed at player + 35% downward bias
      eBullets.push({ x: e.x, y: e.y, vx: rx * 0.65 * sp, vy: (ry * 0.65 + 0.35) * sp, dmg: dmg, track: track, r: r, col: col });
    };
    if (e.boss) {
      const ph = e.phase;
      if (ph === 1 || ph === 3) for (let a = -0.5; a <= 0.5; a += 0.25) aim(a);
      if (ph >= 2) { // ring with a gap the player can fly through
        e.spin += .5; const count = ph >= 3 ? 16 : 12;
        for (let i = 2; i < count; i++) { const a = e.spin + i / count * 6.283;
          eBullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * sp * .7, vy: Math.sin(a) * sp * .7, dmg: 1, track: 0, r: 5, col: "#ff4477" }); }
      }
    } else if (e.spread) { aim(-.35); aim(0); aim(.35); }
    else aim(0);
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
    const st = window.SAVE.stats(window.SAVE.get().equipped);
    G.pdmg = st.dmg; G.fireInt = 1 / st.fire; G.pspeed = st.speed;
    G.pshot = planeShot(window.SAVE.get().equipped);
    G.terrainWorld = mission().world || 0;
    G.lives = 5; G.power = 1; G.bombs = 1; G.shield = 0; G.dying = null; G.shake = 0; G.flash = 0; fxs.length = 0;
    G.invuln = 1.2; G.elapsed = 0; G.runCoins = 0;
    G.enemyTimer = 0.5; G.starTimer = 1; G.fireTimer = 0; G.boss = null;
    bullets.length = eBullets.length = enemies.length = stars.length = parts.length = coinItems.length = 0;
    player.x = player.tx = W / 2; player.y = player.ty = H - 140;
    if (mission().type === "boss") spawnBoss();
    startMusic();
    UI.showHUD();
    UI.toast("Mission " + mission().id + ": " + mission().name, mission().desc);
  }
  function bankRun() {
    const s = window.SAVE.get();
    if (G.runCoins > 0) window.SAVE.addCoins(G.runCoins);
    s.stars = (s.stars || 0) + G.missionStars;
    window.SAVE.setHi(G.score);
    window.SAVE.persist();
    G.lastReward = G.runCoins; G.runCoins = 0; G.missionStars = 0;
  }
  function missionComplete() {
    if (G.state !== "playing") return;
    G.state = "done"; stopMusic();
    G.score += 500 + G.missionStars * 50;
    G.runCoins += 100 + G.missionIndex * 25 + G.missionStars * 10;
    G.missionStarsShown = G.missionStars;
    bankRun();
    window.SAVE.unlock(G.missionIndex + 2);
    beep(660, 0.12, 0.08); setTimeout(() => beep(990, 0.18, 0.08), 120);
    if (G.missionIndex >= window.MISSIONS.length - 1) { G.state = "win"; UI.showWin(); }
    else UI.showMissionComplete();
  }
  function gameOver() { G.state = "over"; startMusic("gameover"); bankRun(); boom(player.x, player.y, "#ff7733", 40); beep(180, 0.4, 0.1); UI.showGameOver(); }
  function useBomb() {
    if (G.state !== "playing" || G.bombs <= 0 || G.dying) return;
    G.bombs--; G.shake = 16; eBullets.length = 0; sfx("bomb", .8); G.flash = .5;
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (e.boss) { e.hp = Math.max(1, e.hp - e.max * .08); continue; }
      addFx(e.x, e.y, false, mission().world); enemies.splice(i, 1); G.score += 100; progress("kill");
      if (G.state !== "playing") return;
    }
    UI.updateHUD();
  }
  function hitPlayer(cost) {
    if (G.invuln > 0 || G.state !== "playing") return;
    if (G.shield > 0) { G.shield = 0; G.invuln = 1; sfx("shield", .5); return; }
    sfx("hurt", .5); G.shake = 9;
    G.lives -= (cost || 1); G.invuln = 1.3; beep(300, 0.12, 0.08);
    boom(player.x, player.y, "#ff7733", 12);
    if (G.power > 1) G.power--;                 // lose a power level when hit
    if (G.lives <= 0) { G.lives = 0; UI.updateHUD(); gameOver(); return; }
    UI.toast("Hit!", "Lives left: " + G.lives);
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
    else if (m.type === "boss") { if (G.progress >= 1) missionComplete(); }
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
    G.scrollY = (G.scrollY + 190 * dt) % 1000000;
    for (let i = fxs.length - 1; i >= 0; i--) { fxs[i].t += dt; if (fxs[i].t >= 1) fxs.splice(i, 1); }
    G.shake = Math.max(0, (G.shake || 0) - dt * 26); G.flash = Math.max(0, (G.flash || 0) - dt);
    ctx.save();
    if (G.shake > 0) ctx.translate((Math.random() - .5) * G.shake, (Math.random() - .5) * G.shake);
    drawBackground();
    if (G.state === "playing") update(dt);
    drawEntities();
    ctx.restore();
    if (G.flash > 0) { ctx.fillStyle = "rgba(255,255,255," + G.flash + ")"; ctx.fillRect(0, 0, W, H); }
    updateParts(dt);
  }

  function update(dt) {
    const m = mission();
    G.elapsed += dt;
    if (G.dying) {
      const d = G.dying; d.t -= dt; d.next -= dt; G.invuln = 1;
      if (d.next <= 0) { d.next = .16; addFx(d.x + (Math.random() - .5) * 240, d.y + (Math.random() - .5) * 170, Math.random() < .5, Math.random() * 3 | 0); G.shake = Math.max(G.shake, 8); sfx("boom1", .35); }
      if (d.t <= 0) { addFx(d.x, d.y, true, 0); G.dying = null; G.progress = 1; check(); return; }
    }
    if (G.invuln > 0) G.invuln -= dt;
    if (G.shield > 0) G.shield -= dt;

    const k = 32 * G.pspeed * dt;
    if (keys["ArrowLeft"] || keys["a"]) player.tx -= k;
    if (keys["ArrowRight"] || keys["d"]) player.tx += k;
    if (keys["ArrowUp"] || keys["w"]) player.ty -= k;
    if (keys["ArrowDown"] || keys["s"]) player.ty += k;
    player.tx = Math.max(26, Math.min(W - 26, player.tx));
    player.ty = Math.max(60, Math.min(H - 20, player.ty));
    const follow = Math.min(1, (G.pspeed * 1.1) * dt);
    player.x += (player.tx - player.x) * follow;
    player.y += (player.ty - player.y) * follow;

    G.fireTimer -= dt;
    const firing = input.active || keys[" "] || keys["Spacebar"];
    if (firing && G.fireTimer <= 0) { fire(); G.fireTimer = G.fireInt; }

    if (m.type !== "boss" && !G.dying) {
      G.enemyTimer -= dt;
      if (G.enemyTimer <= 0) {
        spawnEnemy();
        if (G.missionIndex >= 3 && Math.random() < 0.3) spawnEnemy();  // occasional pair
        if (G.missionIndex >= 10 && Math.random() < 0.2) spawnEnemy();  // late swarm
        G.enemyTimer = m.enemyRate * (0.8 + Math.random() * 0.5);
      }
    }
    G.starTimer -= dt;
    if (G.starTimer <= 0) { spawnStar(); G.starTimer = m.starRate * (0.7 + Math.random() * 0.6); }

    // bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i]; b.y -= 620 * dt; b.x += (b.vx || 0) * dt;
      if (b.y < -20) { bullets.splice(i, 1); continue; }
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        if (Math.abs(b.x - e.x) < e.r && Math.abs(b.y - e.y) < e.r) {
          bullets.splice(i, 1); e.hp -= G.pdmg; boom(b.x, b.y, "#aef", 3);
          if (e.hp <= 0) {
            boom(e.x, e.y, e.boss ? "#ff3366" : "#ffc36a", e.boss ? 50 : 8); addFx(e.x, e.y, e.boss || e.type === 3, m.world); sfx(e.boss ? "boom2" : "boom0", .4); G.shake = Math.max(G.shake, e.boss ? 12 : e.type === 3 ? 5 : 2);
            enemies.splice(j, 1); G.score += e.boss ? 5000 : 100;
            G.runCoins += e.boss ? 200 : 5; window.SAVE.get().stats.kills++;
            if (e.boss) { for (let k2 = 0; k2 < 10; k2++) spawnCoin(e.x + (Math.random() - .5) * 70, e.y); spawnPower(e.x, e.y); }
            else { if (Math.random() < 0.35) spawnCoin(e.x, e.y); if (Math.random() < 0.08) spawnPower(e.x, e.y); else if (Math.random() < 0.035) coinItems.push({ kind: "shield", x: e.x, y: e.y, spin: 0, vy: 120 }); else if (Math.random() < 0.025) coinItems.push({ kind: "bomb", x: e.x, y: e.y, spin: 0, vy: 120 }); }
            
            if (e.boss) { G.boss = null; G.dying = { x: e.x, y: e.y, t: m.final ? 5 : 2.8, spr: e.spr, next: 0 }; G.invuln = 9; eBullets.length = 0; enemies.length = 0; A.stopMusic(); sfx(m.final ? "boom3" : "boom2", .9); G.shake = 18; break; } else progress("kill");
          } else { sfx("hit", .12) || beep(680, 0.02, 0.04); }
          break;
        }
      }
    }

    // enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (e.boss) {
        if (!e.entered) { e.y += 80 * dt; if (e.y >= 130) e.entered = true; }
        else { e.x += e.dir * e.speed * dt; if (e.x < 110 || e.x > W - 110) e.dir *= -1; }
        const frac = e.hp / e.max, ph = frac < .33 ? 3 : frac < .66 ? 2 : 1;
        if (ph !== e.phase) { e.phase = ph; G.shake = 10; addFx(e.x, e.y, true, 2); sfx("boom1", .6); UI.toast("Phase " + ph, "The boss is enraged!"); }
        e.minion -= dt;
        if (e.minion <= 0 && ph >= 2) { spawnEnemy(); e.minion = ph === 3 ? 3 : 5; }
        e.fireCd -= dt; if (e.fireCd <= 0 && e.entered) { eFire(e); e.fireCd = ph === 3 ? 0.75 : 0.95; }
        continue;
      }
      e.y += e.speed * dt; e.sway += dt * 2;
      e.x = e.baseX + Math.sin(e.sway) * e.amp;
      if (e.type === 2) e.x = e.baseX + Math.sign(Math.sin(e.sway * 1.4)) * e.amp * .6 + Math.sin(e.sway) * 20;
      e.x = Math.max(24, Math.min(W - 24, e.x));
      e.fireCd -= dt;
      if (e.canFire && e.fireCd <= 0 && e.y > 40 && e.y < H * 0.7) { eFire(e); e.fireCd = 2.2 + Math.random() * 2.4; }
      if (e.y > H + 60) { enemies.splice(i, 1); continue; }
      if (Math.abs(e.x - player.x) < e.r && Math.abs(e.y - player.y) < e.r) {
        boom(e.x, e.y, "#ff8800", 12); enemies.splice(i, 1); hitPlayer(1);
      }
    }

    // enemy bullets
    for (let i = eBullets.length - 1; i >= 0; i--) {
      const b = eBullets[i];
      // homing: steer velocity toward player (tracking)
      // home toward player only while still approaching (above the plane); once passed, fly straight off
      if (b.track > 0 && G.state === "playing" && b.y < player.y - 12) {
        const dx = player.x - b.x, dy = player.y - b.y, d = Math.hypot(dx, dy) || 1;
        const sp = Math.hypot(b.vx, b.vy) || 200;
        b.vx += (dx / d * sp - b.vx) * b.track * dt * 1.4;
        b.vy += (dy / d * sp - b.vy) * b.track * dt * 1.4;
        if (b.vy < 40) b.vy = 40;
      } else if (b.track) {
        b.track = 0;                        // passed the player: stop chasing, let it leave
        if (b.vy < 120) b.vy = 180;         // ensure it exits downward
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y > H + 20 || b.x < -30 || b.x > W + 30) { eBullets.splice(i, 1); continue; }
      if (Math.abs(b.x - player.x) < 16 && Math.abs(b.y - player.y) < 16) {
        eBullets.splice(i, 1); boom(b.x, b.y, "#ff3366", 7); hitPlayer(b.dmg || 1);
      }
    }

    // stars
    for (let i = stars.length - 1; i >= 0; i--) {
      const s = stars[i]; s.y += 170 * dt; s.spin += dt * 3;
      if (s.y > H + 30) { stars.splice(i, 1); continue; }
      if (Math.abs(s.x - player.x) < 30 && Math.abs(s.y - player.y) < 30) {
        stars.splice(i, 1); G.stars++; G.missionStars++; G.score += 25;
        sfx("star", .35) || beep(1200, 0.06, 0.06); boom(s.x, s.y, "#ffcc22", 6); progress("star"); UI.updateHUD();
      }
    }

    // coins
    for (let i = coinItems.length - 1; i >= 0; i--) {
      const co = coinItems[i]; co.y += co.vy * dt; co.spin += dt * 4;
      if (co.y > H + 30) { coinItems.splice(i, 1); continue; }
      if (Math.abs(co.x - player.x) < 34 && Math.abs(co.y - player.y) < 34) {
        coinItems.splice(i, 1);
        if (co.kind === "shield") { G.shield = 8; sfx("shield", .5); UI.toast("Shield!", "8 seconds of protection"); }
        else if (co.kind === "bomb") { G.bombs = Math.min(3, G.bombs + 1); sfx("power", .5); UI.toast("Bomb +1", "Tap the bomb button to clear the sky"); }
        else if (co.kind === "power") {
          G.power = Math.min(5, G.power + 1);
          sfx("power", .5) || beep(1700, 0.08, 0.06); boom(co.x, co.y, "#4affd0", 8); UI.toast("Power Up!", "Weapon Lv " + G.power);
        } else {
          G.runCoins += 10; G.score += 10; sfx("coin", .3) || beep(1400, 0.05, 0.05); boom(co.x, co.y, "#ffcf3a", 5);
        }
        UI.updateHUD();
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
    if (!A.drawTerrain(ctx, W, H, G.scrollY, G.terrainWorld || 0)) drawTile();
    for (let l = 0; l < 2; l++) { // parallax clouds
      const c = A.cloud(G.terrainWorld || 0, l); if (!c.ready) continue;
      const ch = W * 2, y = ((G.scrollY * (1.35 + l * .4)) % ch);
      ctx.globalAlpha = l ? .34 : .2;
      ctx.drawImage(c, 0, y, W, ch); ctx.drawImage(c, 0, y - ch, W, ch);
      ctx.globalAlpha = 1;
    }
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.8);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.32)");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }
  function drawTile() {
    const px = W / TILE_LOW;          // low-res pixel -> screen scale
    const tH = TILE_H * px;           // on-screen tile height
    const off = ((G.scrollY % tH) + tH) % tH;
    ctx.imageSmoothingEnabled = false;
    for (let yy = off - tH; yy < H + tH; yy += tH) {
      ctx.drawImage(terrains[(G.terrainWorld || 0) % 4], 0, 0, TILE_LOW, TILE_H, 0, Math.round(yy), W, Math.ceil(tH) + 1);
    }
    ctx.imageSmoothingEnabled = true;
  }

  function blit(spr, x, y, flip, scale) {
    const s = scale || 1;
    ctx.save(); ctx.translate(x, y);
    if (flip) ctx.rotate(Math.PI);
    ctx.drawImage(spr, (-spr.width / 2) * s, (-spr.height / 2) * s, spr.width * s, spr.height * s);
    ctx.restore();
  }

  function drawEntities() {
    // stars
    for (const s of stars) {
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.spin);
      ctx.drawImage(S.star, -S.star.width / 2, -S.star.height / 2); ctx.restore();
    }
    // coins (spin flip)
    for (const co of coinItems) {
      if (co.kind === "shield" || co.kind === "bomb") {
        ctx.fillStyle = co.kind === "bomb" ? "rgba(255,120,60,.9)" : "rgba(80,190,255,.9)"; ctx.beginPath(); ctx.arc(co.x, co.y, 16, 0, 6.28); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.font = "bold 16px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(co.kind === "bomb" ? "💣" : "🛡", co.x, co.y + 1);
      } else if (co.kind === "power") {
        const pr = 15 + Math.sin(co.spin * 2) * 2;
        const gg = ctx.createRadialGradient(co.x, co.y, 2, co.x, co.y, pr);
        gg.addColorStop(0, "#ffffff"); gg.addColorStop(.4, "#4affd0"); gg.addColorStop(1, "rgba(74,255,208,0)");
        ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(co.x, co.y, pr, 0, 6.28); ctx.fill();
        ctx.fillStyle = "#0a3a33"; ctx.font = "bold 16px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("⚡", co.x, co.y + 1);
      } else {
        ctx.save(); ctx.translate(co.x, co.y); ctx.scale(Math.max(0.15, Math.abs(Math.cos(co.spin))), 1);
        ctx.drawImage(S.coin, -S.coin.width / 2, -S.coin.height / 2); ctx.restore();
      }
    }
    // enemy bullets
    for (const b of eBullets) {
      const r = b.r || 5, col = b.col || "#ff4477";
      const ang = Math.atan2(b.vy || 1, b.vx || 0);   // local +x = travel direction
      const L = r * 3.4, w = r * 1.35;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(ang);
      // flame trail (behind)
      ctx.globalAlpha = 0.4; ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(-L * 0.45, 0); ctx.lineTo(-L * 1.2, -w * 0.45); ctx.lineTo(-L * 1.2, w * 0.45); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
      // body (capsule)
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(0, 0, L * 0.5, w * 0.5, 0, 0, 6.28); ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,.22)"; ctx.beginPath(); ctx.ellipse(0, w * 0.18, L * 0.5, w * 0.3, 0, 0, 6.28); ctx.fill();
      // nose tip (bright metal)
      ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(L * 0.42, 0, w * 0.34, 0, 6.28); ctx.fill();
      // top highlight streak
      ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.beginPath(); ctx.ellipse(-L * 0.05, -w * 0.2, L * 0.3, w * 0.15, 0, 0, 6.28); ctx.fill();
      ctx.restore();
    }
    // enemies (nose-down => flip)
    for (const e of enemies) {
      if (e.spr && e.spr.ready) blit(e.spr, e.x, e.y, true, e.scale * Math.min(1, W / 420 + .1)); else blit(e.fb, e.x, e.y, true, e.boss ? 0.85 : 0.62);
      if (e.boss) { // boss hp bar
        ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.fillRect(W / 2 - 120, 70, 240, 10);
        ctx.fillStyle = "#ff3366"; ctx.fillRect(W / 2 - 120, 70, 240 * Math.max(0, e.hp / e.max), 10);
      } else if (e.max > 1 && e.hp < e.max) {
        ctx.fillStyle = "rgba(0,0,0,.4)"; ctx.fillRect(e.x - 18, e.y - 34, 36, 4);
        ctx.fillStyle = "#7fff9f"; ctx.fillRect(e.x - 18, e.y - 34, 36 * (e.hp / e.max), 4);
      }
    }
    // player bullets
    for (const b of bullets) {
      const col = b.col || "#66ffff";
      ctx.strokeStyle = col; ctx.globalAlpha = 0.35; ctx.lineWidth = 7; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(b.x, b.y + 4); ctx.lineTo(b.x, b.y - 10); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(b.x, b.y, 2.6, 8, 0, 0, 6.28); ctx.fill();
      ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.ellipse(b.x, b.y - 2, 1.3, 4, 0, 0, 6.28); ctx.fill();
    }
    // player (blink on invuln)
    if (G.state === "playing" || G.state === "paused") {
      if (G.invuln > 0) ctx.globalAlpha = 0.45 + 0.4 * Math.abs(Math.sin(G.elapsed * 10));
      const hi = A.planes[window.SAVE.get().equipped];
      if (hi && hi.ready) blit(hi, player.x, player.y, false, .17); else blit(equippedSprite(), player.x, player.y, false, 0.62);
      ctx.globalAlpha = 1;
      if (G.shield > 0) { ctx.strokeStyle = "rgba(90,220,255,.85)"; ctx.fillStyle = "rgba(90,220,255,.12)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(player.x, player.y, 46, 0, 6.28); ctx.stroke(); ctx.fill(); }
    }
    if (G.dying && G.dying.spr && G.dying.spr.ready) { ctx.globalAlpha = Math.min(1, G.dying.t / 1.2); blit(G.dying.spr, G.dying.x + Math.sin(G.dying.t * 40) * 4, G.dying.y, true, .3); ctx.globalAlpha = 1; }
    // sprite-sheet explosions: 36 frames, 6 columns
    for (const f of fxs) {
      const img = A.sheet(f.v, f.big), fr = Math.floor(f.t * 36); if (!img.ready || fr > 35) continue;
      const cs = img.width / 6, ds = f.big ? 230 : 110;
      ctx.drawImage(img, (fr % 6) * cs, Math.floor(fr / 6) * cs, cs, cs, f.x - ds / 2, f.y - ds / 2, ds, ds);
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
      this.el("starcount").textContent = (window.SAVE.get().stars + G.missionStars);
      const bb = this.el("bombBtn"); if (bb) bb.textContent = "💣 " + G.bombs;
      let hearts = ""; for (let i = 0; i < G.lives; i++) hearts += "❤";
      this.el("lives").textContent = hearts || "—";
      const powerPercent = Math.max(0, Math.min(100, G.power / 5 * 100));
      this.el("hpfill").style.width = powerPercent + "%";
      const hpValue = this.el("hpvalue"); if (hpValue) hpValue.textContent = Math.round(powerPercent) + "%";
      const pl = this.el("powerlvl"); if (pl) pl.textContent = "Lv " + G.power;
      const cc = this.el("coincount"); if (cc) cc.textContent = (window.SAVE.get().coins + G.runCoins);
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
    wallet() { const s = window.SAVE.get(); return `<div class="wallet">🪙 ${s.coins} &nbsp; ⭐ ${s.stars}</div>`; },
    showSplash() {
      this.hideHUD();
      this.over(`<div class="splash">
        <img src="${PLANE_SPR[0].toDataURL()}" class="splashplane"/>
        <h1 class="splashtitle">SKY <span>RUSH</span></h1>
        <div class="splashbar"><i></i></div>
        <p class="splashsub">tap to begin</p>
        <p class="hint">Build by Gm Anondo</p>
      </div>`);
      const go = () => { this._splashDone = true; resumeAudio(); this.showMenu(); };
      this._splashDone = false;
      this.el("overlay").onclick = () => { if (!this._splashDone) go(); this.el("overlay").onclick = null; };
      setTimeout(() => { if (!this._splashDone) { this._splashDone = true; this.showMenu(); } }, 2400);
    },
    showMenu() {
      this.hideHUD(); startMusic("menu");
      const start = Math.max(0, Math.min(window.MISSIONS.length - 1, window.SAVE.get().unlocked - 1));
      this.over(`<div class="panel">
        <h1>SKY <span>RUSH</span></h1>
        ${this.wallet()}
        <button id="bStart" class="btn">▶ Play</button>
        <button id="bDaily" class="btn ghost">🎁 Daily Reward${window.SAVE.canClaimDaily() ? " <span class='dot'>●</span>" : ""}</button>
        <div class="menu2">
          <button id="bSel" class="btn ghost">🎯 Missions</button>
          <button id="bShop" class="btn ghost">🛒 Shop</button>
          <button id="bHangar" class="btn ghost">✈ Hangar</button>
          <button id="bUpg" class="btn ghost">⚙ Upgrades</button>
        </div>
        <button id="bMusic" class="btn ghost">${musicOn ? "🎵 Music: On" : "🔇 Music: Off"}</button>
        <p class="hint">Drag to fly · Auto-fire · Earn 🪙 to buy & upgrade planes</p>
        <p class="hint">Build by Gm Anondo</p>
      </div>`);
      this.el("bStart").onclick = () => { resumeAudio(); G.score = 0; if (window.SAVE.get().unlocked > window.MISSIONS.length) this.showSelect(); else this.brief(start); };
      this.el("bMusic").onclick = (e) => { setMusicOn(!musicOn); e.currentTarget.textContent = musicOn ? "🎵 Music: On" : "🔇 Music: Off"; };
      this.el("bDaily").onclick = () => this.showDaily();
      this.el("bSel").onclick = () => this.showSelect();
      this.el("bShop").onclick = () => this.showShop();
      this.el("bHangar").onclick = () => this.showHangar();
      this.el("bUpg").onclick = () => this.showUpgrades();
    },
    showSelect() {
      const unlocked = window.SAVE.get().unlocked;
      let grid = "";
      window.MISSIONS.forEach((m, i) => {
        const open = i < unlocked;
        grid += `<button class="mcell ${open ? "" : "locked"}" data-i="${i}" ${open ? "" : "disabled"}>
          <span class="mnum">${m.id}</span><span class="mname">${open ? m.name : "🔒"}</span></button>`;
      });
      this.over(`<div class="panel wide"><h2>Select Mission</h2><div class="mgrid">${grid}</div>
        <button id="bBack" class="btn ghost">← Back</button></div>`);
      this.el("overlay").querySelectorAll(".mcell:not(.locked)").forEach(b =>
        b.onclick = () => { resumeAudio(); G.score = 0; this.brief(+b.dataset.i); });
      this.el("bBack").onclick = () => this.showMenu();
    },
    showMissionComplete() {
      const next = G.missionIndex + 1;
      this.hideHUD();
      this.over(`<div class="panel"><h2>✅ Mission Complete!</h2><p class="sub">${mission().name}</p>
        <div class="stats"><div><span>⭐ Stars</span><b>${G.missionStarsShown || 0}</b></div><div><span>🪙 Earned</span><b>+${G.lastReward || 0}</b></div><div><span>Score</span><b>${G.score}</b></div></div>
        <button id="bNext" class="btn">▶ Next Mission (${next + 1})</button>
        <button id="bMenu" class="btn ghost">Menu</button></div>`);
      this.el("bNext").onclick = () => this.brief(next);
      this.el("bMenu").onclick = () => this.showMenu();
    },
    showGameOver() {
      this.hideHUD();
      this.over(`<div class="panel"><h2 class="bad">💥 Game Over</h2>
        <p class="sub">Mission ${mission().id} — ${mission().name}</p>
        <div class="stats"><div><span>Score</span><b>${G.score}</b></div><div><span>🪙 Earned</span><b>+${G.lastReward || 0}</b></div></div>
        <button id="bRetry" class="btn">↻ Retry</button><button id="bMenu" class="btn ghost">Menu</button></div>`);
      this.el("bRetry").onclick = () => { this.hide(); startMission(G.missionIndex); };
      this.el("bMenu").onclick = () => this.showMenu();
    },
    brief(idx) {
      const m = window.MISSIONS[idx], go = () => { this.hide(); startMission(idx); };
      if (idx % 10 !== 0 && m.type !== "boss") return go();
      const art = A.worldArt(m.world);
      this.hideHUD();
      this.over(`<div class="panel"><img src="${art.src}" class="brief"/><h2>${m.type === "boss" ? "⚠ " + m.bossName : window.WORLDS[m.world].name}</h2>
        <p class="sub">${m.type === "boss" ? m.desc : window.WORLDS[m.world].story}</p><button id="bGo" class="btn">▶ Launch</button></div>`);
      this.el("bGo").onclick = go;
    },
    showWin() {
      this.hideHUD(); startMusic("victory");
      this.over(`<div class="panel"><h1>🏆 Victory!</h1><p class="sub">You cleared all ${window.MISSIONS.length} missions!</p>
        <div class="stats"><div><span>Score</span><b>${G.score}</b></div><div><span>⭐</span><b>${window.SAVE.get().stars}</b></div></div>
        <p class="sub">The Eclipse Core is destroyed. The skies are free.</p>
        <button id="bCred" class="btn">🎬 Credits</button><button id="bMenu" class="btn ghost">🏠 Menu</button></div>`);
      this.el("bCred").onclick = () => this.showCredits();
      this.el("bMenu").onclick = () => this.showMenu();
    },
    showCredits() {
      startMusic("credits");
      this.over(`<div class="credits"><div class="roll"><h1>SKY <span>RUSH</span></h1><p>Built by<br><b>Gm Anondo</b></p>
        ${window.WORLDS.map(w => `<p>${w.name}<br><b>Liberated</b></p>`).join("")}<p>Thank you for playing</p></div>
        <button id="bMenu" class="btn ghost">🏠 Menu</button></div>`);
      this.el("bMenu").onclick = () => this.showMenu();
    },
    statBar(label, val, max) {
      const pct = Math.min(100, val / max * 100);
      return `<div class="sb"><span>${label}</span><i style="width:${pct}%"></i><b>${Math.round(val * 10) / 10}</b></div>`;
    },
    showDaily() {
      this.hideHUD(); const S2 = window.SAVE, can = S2.canClaimDaily(), day = S2.dailyDay(), rw = S2.dailyRewards();
      let cells = "";
      for (let i = 0; i < 7; i++) {
        const cls = i < day ? "claimed" : (i === day ? "today" : "");
        cells += `<div class="dcell ${cls}"><div class="dd">Day ${i + 1}</div><div class="dr">🪙 ${rw[i]}</div>${i < day ? "<div class='dok'>✓</div>" : ""}</div>`;
      }
      this.over(`<div class="panel wide"><h2>Daily Reward</h2>${this.wallet()}
        <div class="dailygrid">${cells}</div>
        <button id="bClaim" class="btn ${can ? "" : "ghostdis"}">${can ? "🎁 Claim Day " + (day + 1) : "✓ Come back tomorrow"}</button>
        <button id="bBack" class="btn ghost">← Back</button></div>`);
      const self = this;
      this.el("bClaim").onclick = () => {
        const amt = S2.claimDaily();
        if (amt > 0) { beep(1200, 0.1, 0.07); setTimeout(() => beep(1600, 0.12, 0.07), 110); self.toast("Daily Reward!", "+🪙 " + amt); self.showDaily(); }
      };
      this.el("bBack").onclick = () => this.showMenu();
    },
    showShop() {
      this.hideHUD(); const S2 = window.SAVE, s = S2.get(); let cells = "";
      window.PLANES.forEach((p, i) => {
        const owned = S2.has(p.id), eq = s.equipped === p.id, img = PLANE_SPR[i].toDataURL();
        const action = eq ? `<span class="tag eq">EQUIPPED</span>`
          : owned ? `<button class="mini equip" data-eq="${p.id}">Equip</button>`
          : `<button class="mini buy ${s.coins >= p.price ? "" : "dis"}" data-buy="${p.id}">🪙 ${p.price}</button>`;
        cells += `<div class="scell ${eq ? "on" : ""}"><img src="${img}" class="pprev"/>
          <div class="pn">${p.name}</div><div class="pr">${p.rarity}</div>
          <div class="pstats">DMG ${p.dmg} · HP ${p.hp}</div>${action}</div>`;
      });
      this.over(`<div class="panel wide"><h2>Plane Shop</h2>${this.wallet()}
        <div class="shopgrid">${cells}</div><button id="bBack" class="btn ghost">← Back</button></div>`);
      const self = this;
      this.el("overlay").querySelectorAll("[data-buy]").forEach(b => b.onclick = () => {
        const id = +b.dataset.buy, p = window.PLANES[id];
        if (S2.spend(p.price)) { S2.own(id); S2.equip(id); beep(900, 0.1, 0.07); self.showShop(); }
        else self.toast("Not enough coins", "Need 🪙 " + p.price);
      });
      this.el("overlay").querySelectorAll("[data-eq]").forEach(b => b.onclick = () => { S2.equip(+b.dataset.eq); beep(700, 0.08, 0.06); self.showShop(); });
      this.el("bBack").onclick = () => this.showMenu();
    },
    showHangar() {
      this.hideHUD(); const S2 = window.SAVE, s = S2.get(), p = window.PLANES[s.equipped], st = S2.stats(s.equipped);
      const img = PLANE_SPR[s.equipped].toDataURL();
      const owned = s.owned.slice().sort((a, b) => a - b).map(id =>
        `<button class="mini ${id === s.equipped ? "on" : ""}" data-eq="${id}">${window.PLANES[id].name}</button>`).join("");
      this.over(`<div class="panel wide"><h2>Hangar</h2>${this.wallet()}
        <img src="${img}" class="pbig"/><div class="pn big">${p.name}</div><div class="pr">${p.rarity}</div>
        <div class="statbars">${this.statBar("Damage", st.dmg, 10)}${this.statBar("Fire", st.fire, 12)}${this.statBar("Hull", st.hp, 260)}${this.statBar("Speed", st.speed, 22)}</div>
        <div class="ownedrow">${owned}</div>
        <button id="bUpg2" class="btn">⚙ Upgrade this plane</button>
        <button id="bBack" class="btn ghost">← Back</button></div>`);
      const self = this;
      this.el("overlay").querySelectorAll("[data-eq]").forEach(b => b.onclick = () => { S2.equip(+b.dataset.eq); beep(700, 0.08, 0.06); self.showHangar(); });
      this.el("bUpg2").onclick = () => this.showUpgrades();
      this.el("bBack").onclick = () => this.showMenu();
    },
    showUpgrades() {
      this.hideHUD(); const S2 = window.SAVE, s = S2.get(), id = s.equipped, p = window.PLANES[id];
      const img = PLANE_SPR[id].toDataURL(); let rows = "";
      ["dmg", "fire", "hp", "speed"].forEach(cat => {
        const U = window.UPGRADES[cat], lv = S2.upgLevel(id, cat), max = lv >= window.UPG_MAX, cost = S2.upgCost(cat, lv);
        let pips = ""; for (let i = 0; i < window.UPG_MAX; i++) pips += `<i class="${i < lv ? "f" : ""}"></i>`;
        rows += `<div class="urow"><div class="ul">${U.label}</div><div class="pips">${pips}</div>
          ${max ? `<span class="tag eq">MAX</span>` : `<button class="mini buy ${s.coins >= cost ? "" : "dis"}" data-up="${cat}">🪙 ${cost}</button>`}</div>`;
      });
      this.over(`<div class="panel wide"><h2>Upgrades</h2>${this.wallet()}
        <img src="${img}" class="pbig"/><div class="pn">${p.name}</div>
        <div class="uplist">${rows}</div><button id="bBack" class="btn ghost">← Back</button></div>`);
      const self = this;
      this.el("overlay").querySelectorAll("[data-up]").forEach(b => b.onclick = () => {
        const cat = b.dataset.up, lv = S2.upgLevel(id, cat), cost = S2.upgCost(cat, lv);
        if (lv >= window.UPG_MAX) return;
        if (S2.spend(cost)) { S2.setUpg(id, cat, lv + 1); beep(1000, 0.08, 0.07); self.showUpgrades(); }
        else self.toast("Not enough coins", "Need 🪙 " + cost);
      });
      this.el("bBack").onclick = () => this.showMenu();
    },
  };

  window.SF = { G, startMission, UI, enemies, aim(x) { player.tx = x; player.x = x; } };

  // ---------- BOOT ----------
  measure();
  window.addEventListener("load", measure);
  requestAnimationFrame(loop);
  UI.showSplash();
  const pb = document.getElementById("pauseBtn");
  const bb = document.getElementById("bombBtn"); if (bb) bb.onclick = useBomb;
  window.addEventListener("keydown", (e) => { if (e.key === "b") useBomb(); });
  if (pb) pb.onclick = () => {
    if (G.state === "playing") { G.state = "paused"; window.__gamePaused = true; A.pauseMusic(true); UI.toast("Paused", "Tap ⏸ to resume"); }
    else if (G.state === "paused") { G.state = "playing"; window.__gamePaused = false; A.pauseMusic(false); last = performance.now(); }
  };
})();
