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

  const S = window.SPRITES;

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
  // ---- procedural soundtrack (Web Audio, no audio files) ----
  // Each track loops 4 bars of 16 steps. Notes are MIDI numbers; 0 means rest.
  const TRACKS = {
    menu: { bpm: 88, chords: [[57,60,64],[53,57,60],[48,52,55],[55,59,62]], drums: false,
      lead: [69,0,0,72, 0,0,76,0, 74,0,72,0, 0,0,0,0,  69,0,0,72, 0,0,77,0, 76,0,72,0, 0,0,0,0,
             67,0,0,72, 0,0,76,0, 79,0,76,0, 0,0,0,0,  74,0,0,71, 0,0,74,0, 67,0,0,0, 0,0,0,0] },
    play: { bpm: 132, chords: [[57,60,64],[53,57,60],[48,52,55],[55,59,62]], drums: true,
      lead: [76,0,76,79, 0,76,74,0, 72,0,74,76, 0,0,69,0,  77,0,77,81, 0,77,76,0, 72,0,74,77, 0,0,76,0,
             79,0,79,84, 0,79,76,0, 72,0,76,79, 0,0,76,0,  74,0,74,79, 0,74,71,0, 74,0,79,83, 0,0,79,0] },
    boss: { bpm: 152, chords: [[52,55,59],[52,55,59],[48,52,55],[50,54,57]], drums: true,
      lead: [76,76,0,76, 79,0,76,0, 83,0,82,0, 79,0,76,0,  76,76,0,76, 79,0,76,0, 74,0,72,0, 71,0,0,0,
             72,72,0,72, 76,0,72,0, 79,0,78,0, 76,0,72,0,  74,74,0,74, 78,0,74,0, 81,0,78,0, 74,0,0,0] },
  };
  let musicTimer = null, musicStep = 0, musicMode = "play", musicBus = null, nextNoteAt = 0, noiseBuf = null;
  let musicOn = true;
  try { musicOn = localStorage.getItem("skyrush_music") !== "off"; } catch (e) {}
  const midiHz = (n) => 440 * Math.pow(2, (n - 69) / 12);
  function ensureMusicBus() {
    if (musicBus || !actx) return;
    const comp = actx.createDynamicsCompressor();
    musicBus = actx.createGain();
    musicBus.connect(comp); comp.connect(actx.destination);
    noiseBuf = actx.createBuffer(1, Math.floor(actx.sampleRate * 0.25), actx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  function mNote(t, midi, dur, vol, type, cutoff) {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = midiHz(midi);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.015, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (cutoff) {
      const f = actx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = cutoff;
      o.connect(f); f.connect(g);
    } else o.connect(g);
    g.connect(musicBus); o.start(t); o.stop(t + dur + 0.02);
  }
  function mKick(t) {
    const o = actx.createOscillator(), g = actx.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.18);
  }
  function mNoise(t, dur, vol, freq) {
    const s = actx.createBufferSource(), g = actx.createGain(), f = actx.createBiquadFilter();
    s.buffer = noiseBuf; f.type = "highpass"; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(musicBus); s.start(t); s.stop(t + dur + 0.02);
  }
  function playStep(mode, step, t, sixteenth) {
    const tr = TRACKS[mode], s = step % 16, chord = tr.chords[Math.floor(step / 16) % 4];
    const lead = tr.lead[step % 64];
    if (tr.drums) {
      if (s % 4 === 0) mKick(t);
      if (s % 8 === 4) mNoise(t, 0.14, 0.16, 1500);
      if (s % 2 === 0) mNoise(t, 0.04, 0.05, 7000);
      if (s % 2 === 0 || s === 7) mNote(t, chord[0] - 24, sixteenth * 1.6, 0.17, "sawtooth", 500);
      if (s % 2 === 1) mNote(t, chord[Math.floor(step / 2) % 3] + 12, sixteenth * 1.3, 0.035, "square", 2600);
      if (lead) mNote(t, lead, sixteenth * 1.8, 0.075, "square", 3200);
    } else {
      if (s === 0) chord.forEach((n) => mNote(t, n, sixteenth * 15, 0.05, "sawtooth", 750));
      if (s === 0 || s === 8) mNote(t, chord[0] - 12, sixteenth * 7, 0.14, "triangle");
      if (s % 2 === 0) mNote(t, chord[(s / 2) % 3] + 12, sixteenth * 3, 0.035, "triangle");
      if (lead) mNote(t, lead, sixteenth * 5, 0.09, "sine");
    }
  }
  function musicTick() {
    if (!actx || !musicBus || !musicOn || actx.state !== "running") return;
    let mode = musicMode;
    if (mode !== "menu") {
      if (G.state !== "playing") { nextNoteAt = actx.currentTime + 0.05; return; } // held while paused
      mode = G.boss ? "boss" : "play";
    }
    const sixteenth = 60 / TRACKS[mode].bpm / 4;
    if (nextNoteAt < actx.currentTime) nextNoteAt = actx.currentTime + 0.05;
    while (nextNoteAt < actx.currentTime + 0.2) {
      try { playStep(mode, musicStep, nextNoteAt, sixteenth); } catch (e) {}
      nextNoteAt += sixteenth;
      musicStep = (musicStep + 1) % 64;
    }
  }
  function startMusic(mode) {
    resumeAudio();
    if (!actx) return;
    ensureMusicBus();
    const next = mode || "play";
    if (next !== musicMode || !musicTimer) { musicStep = 0; nextNoteAt = 0; }
    musicMode = next;
    musicBus.gain.cancelScheduledValues(actx.currentTime);
    musicBus.gain.setValueAtTime(musicOn ? 1 : 0, actx.currentTime);
    if (!musicTimer) musicTimer = setInterval(musicTick, 50);
  }
  function stopMusic() {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    if (actx && musicBus) {
      musicBus.gain.cancelScheduledValues(actx.currentTime);
      musicBus.gain.setTargetAtTime(0, actx.currentTime, 0.04); // fade notes already queued
    }
  }
  function setMusicOn(on) {
    musicOn = on;
    try { localStorage.setItem("skyrush_music", on ? "on" : "off"); } catch (e) {}
    if (actx && musicBus) {
      musicBus.gain.cancelScheduledValues(actx.currentTime);
      musicBus.gain.setValueAtTime(on ? 1 : 0, actx.currentTime);
    }
    nextNoteAt = 0;
  }
  // Browsers only allow audio after a touch; stop it when the app is in the background.
  document.addEventListener("pointerdown", resumeAudio);
  document.addEventListener("visibilitychange", () => {
    if (!actx) return;
    try { if (document.hidden) actx.suspend(); else actx.resume(); } catch (e) {}
  });

  // ---------- ENTITIES ----------
  function spawnEnemy() {
    const m = mission();
    const strong = Math.random() < 0.3;
    const baseHp = Math.max(2, m.enemyHp * 2);          // double HP, min 2 (needs >=2 bullets)
    const x0 = 40 + Math.random() * (W - 80);
    enemies.push({
      x: x0, baseX: x0, y: -60, spr: strong ? S.enemyB : S.enemyA,
      hp: strong ? Math.round(baseHp * 1.4) : baseHp, max: strong ? Math.round(baseHp * 1.4) : baseHp,
      speed: m.enemySpeed * 10 * (strong ? 0.85 : 1.05),
      sway: Math.random() * 6.28, amp: 20 + Math.random() * 50,
      canFire: Math.random() < 0.7, fireCd: 1.6 + Math.random() * 2.2,
      bdmg: strong ? 2 : 1, btrack: 0.3 + Math.random() * 0.18, bspeed: strong ? 25 : 0,
      r: strong ? 28 : 24, boss: false,
    });
  }
  function spawnBoss() {
    const m = mission();
    G.boss = { x: W / 2, y: -120, spr: BOSS_SPR[m.world] || S.boss, hp: m.bossHp, max: m.bossHp,
      speed: 110, dir: 1, fireCd: 1.0, r: 90, boss: true, entered: false,
      bdmg: 2, btrack: 0.4, bspeed: 30 };
    enemies.push(G.boss);
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
    beep(900, 0.03, 0.035);
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
    if (e.boss) { for (let a = -0.5; a <= 0.5; a += 0.25) aim(a); }
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
    G.lives = 5; G.power = 1;
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
  function gameOver() { G.state = "over"; stopMusic(); bankRun(); boom(player.x, player.y, "#ff7733", 40); beep(180, 0.4, 0.1); UI.showGameOver(); }
  function hitPlayer(cost) {
    if (G.invuln > 0 || G.state !== "playing") return;
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
    G.scrollY = (G.scrollY + 190 * dt) % 1000000;
    drawBackground();
    if (G.state === "playing") update(dt);
    drawEntities();
    updateParts(dt);
  }

  function update(dt) {
    const m = mission();
    G.elapsed += dt;
    if (G.invuln > 0) G.invuln -= dt;

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

    if (m.type !== "boss") {
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
            boom(e.x, e.y, e.boss ? "#ff3366" : "#7fff9f", e.boss ? 50 : 14);
            enemies.splice(j, 1); G.score += e.boss ? 5000 : 100;
            G.runCoins += e.boss ? 200 : 5; window.SAVE.get().stats.kills++;
            if (e.boss) { for (let k2 = 0; k2 < 10; k2++) spawnCoin(e.x + (Math.random() - .5) * 70, e.y); spawnPower(e.x, e.y); }
            else { if (Math.random() < 0.35) spawnCoin(e.x, e.y); if (Math.random() < 0.08) spawnPower(e.x, e.y); }
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
        if (!e.entered) { e.y += 80 * dt; if (e.y >= 130) e.entered = true; }
        else { e.x += e.dir * e.speed * dt; if (e.x < 110 || e.x > W - 110) e.dir *= -1; }
        e.fireCd -= dt; if (e.fireCd <= 0 && e.entered) { eFire(e); e.fireCd = 0.9; }
        continue;
      }
      e.y += e.speed * dt; e.sway += dt * 2;
      e.x = e.baseX + Math.sin(e.sway) * e.amp;
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
        beep(1200, 0.06, 0.06); boom(s.x, s.y, "#ffcc22", 6); progress("star"); UI.updateHUD();
      }
    }

    // coins
    for (let i = coinItems.length - 1; i >= 0; i--) {
      const co = coinItems[i]; co.y += co.vy * dt; co.spin += dt * 4;
      if (co.y > H + 30) { coinItems.splice(i, 1); continue; }
      if (Math.abs(co.x - player.x) < 34 && Math.abs(co.y - player.y) < 34) {
        coinItems.splice(i, 1);
        if (co.kind === "power") {
          G.power = Math.min(5, G.power + 1);
          beep(1700, 0.08, 0.06); boom(co.x, co.y, "#4affd0", 8); UI.toast("Power Up!", "Weapon Lv " + G.power);
        } else {
          G.runCoins += 10; G.score += 10; beep(1400, 0.05, 0.05); boom(co.x, co.y, "#ffcf3a", 5);
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
    const px = W / TILE_LOW;          // low-res pixel -> screen scale
    const tH = TILE_H * px;           // on-screen tile height
    const off = ((G.scrollY % tH) + tH) % tH;
    ctx.imageSmoothingEnabled = false;
    for (let yy = off - tH; yy < H + tH; yy += tH) {
      ctx.drawImage(terrains[G.terrainWorld || 0], 0, 0, TILE_LOW, TILE_H, 0, Math.round(yy), W, Math.ceil(tH) + 1);
    }
    ctx.imageSmoothingEnabled = true;
    // vignette
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.8);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.32)");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
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
      if (co.kind === "power") {
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
      blit(e.spr, e.x, e.y, true, e.boss ? 0.85 : 0.62);
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
      blit(equippedSprite(), player.x, player.y, false, 0.62);
      ctx.globalAlpha = 1;
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
      let hearts = ""; for (let i = 0; i < G.lives; i++) hearts += "❤";
      this.el("lives").textContent = hearts || "—";
      this.el("hpfill").style.width = Math.max(0, G.power / 5 * 100) + "%";
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
      this.el("bStart").onclick = () => { resumeAudio(); G.lives = 3; G.score = 0; this.hide(); startMission(start); };
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
        b.onclick = () => { resumeAudio(); G.lives = 3; G.score = 0; this.hide(); startMission(+b.dataset.i); });
      this.el("bBack").onclick = () => this.showMenu();
    },
    showMissionComplete() {
      const next = G.missionIndex + 1;
      this.hideHUD();
      this.over(`<div class="panel"><h2>✅ Mission Complete!</h2><p class="sub">${mission().name}</p>
        <div class="stats"><div><span>⭐ Stars</span><b>${G.missionStarsShown || 0}</b></div><div><span>🪙 Earned</span><b>+${G.lastReward || 0}</b></div><div><span>Score</span><b>${G.score}</b></div></div>
        <button id="bNext" class="btn">▶ Next Mission (${next + 1})</button>
        <button id="bMenu" class="btn ghost">Menu</button></div>`);
      this.el("bNext").onclick = () => { this.hide(); startMission(next); };
      this.el("bMenu").onclick = () => this.showMenu();
    },
    showGameOver() {
      this.hideHUD();
      this.over(`<div class="panel"><h2 class="bad">💥 Game Over</h2>
        <p class="sub">Mission ${mission().id} — ${mission().name}</p>
        <div class="stats"><div><span>Score</span><b>${G.score}</b></div><div><span>🪙 Earned</span><b>+${G.lastReward || 0}</b></div></div>
        <button id="bRetry" class="btn">↻ Retry</button><button id="bMenu" class="btn ghost">Menu</button></div>`);
      this.el("bRetry").onclick = () => { this.hide(); G.lives = 3; startMission(G.missionIndex); };
      this.el("bMenu").onclick = () => this.showMenu();
    },
    showWin() {
      this.hideHUD();
      this.over(`<div class="panel"><h1>🏆 Victory!</h1><p class="sub">You cleared all ${window.MISSIONS.length} missions!</p>
        <div class="stats"><div><span>Score</span><b>${G.score}</b></div><div><span>⭐</span><b>${window.SAVE.get().stars}</b></div></div>
        <button id="bMenu" class="btn">🏠 Menu</button></div>`);
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

  window.SF = { G, startMission, UI };

  // ---------- BOOT ----------
  measure();
  window.addEventListener("load", measure);
  requestAnimationFrame(loop);
  UI.showSplash();
  const pb = document.getElementById("pauseBtn");
  if (pb) pb.onclick = () => {
    if (G.state === "playing") { G.state = "paused"; UI.toast("Paused", "Tap ⏸ to resume"); }
    else if (G.state === "paused") { G.state = "playing"; last = performance.now(); }
  };
})();
