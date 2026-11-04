// assets.js: streams generated art and audio from www/assets. Exposes window.ASSETS.
// Anything not loaded yet returns null, so the game falls back to its procedural art.
(function () {
  "use strict";
  const BASE = "assets/";
  const NAMES = ["desert", "jungle", "snow", "cyber", "volcano", "orbit"];
  const CHUNKS = 32;

  function image(src, done) {
    const i = new Image();
    i.onload = () => { i.ready = true; if (done) done(i); };
    i.onerror = () => console.warn("asset failed:", src);
    i.src = BASE + src;
    return i;
  }

  // ----- terrain: only the visible chunks and the next one stay decoded -----
  const live = new Map();
  const two = (n) => (n < 10 ? "0" : "") + n;
  function chunk(world, k) {
    const key = world + ":" + k;
    if (!live.has(key)) live.set(key, image("terrain/" + NAMES[world] + "/" + two(k) + ".webp"));
    return live.get(key);
  }
  // Returns false until the visible part of the map has decoded.
  function drawTerrain(ctx, W, H, scrollY, world) {
    const ch = W * 2, top = Math.floor(scrollY / ch);
    const keep = new Set();
    let ok = true;
    const wrap = (n) => ((n % CHUNKS) + CHUNKS) % CHUNKS;
    for (let i = 0; i <= Math.ceil(H / ch) + 1; i++) {
      const idx = top - i + 1, k = wrap(idx);
      keep.add(world + ":" + k);
      const img = chunk(world, k);
      const y = scrollY - idx * ch;
      if (y >= H || y + ch <= 0) continue;
      if (img.ready) ctx.drawImage(img, 0, Math.floor(y), W, Math.ceil(ch) + 1);
      else ok = false;
    }
    if (ok) for (const key of live.keys()) if (!keep.has(key)) { live.get(key).src = ""; live.delete(key); }
    return ok;
  }

  // ----- sprites -----
  const planes = [], bosses = [], enemies = {}, sheets = {}, clouds = {}, art = {};
  function loadSprites() {
    for (let i = 0; i < 12; i++) planes[i] = image("planes/" + two(i) + ".webp");
    for (let w = 0; w < 6; w++) bosses[w] = image("bosses/" + w + ".webp");
  }
  function enemy(world, type) {
    const key = world + "_" + type;
    return enemies[key] || (enemies[key] = image("enemies/" + key + ".webp"));
  }
  function sheet(variant, big) {
    const key = variant + "_" + (big ? 1 : 0);
    return sheets[key] || (sheets[key] = image("fx/boom" + key + ".webp"));
  }
  function cloud(world, layer) {
    const key = world + "_" + layer;
    return clouds[key] || (clouds[key] = image("clouds/" + key + ".webp"));
  }
  function worldArt(world) {
    const n = NAMES[world];
    return art[n] || (art[n] = image("art/" + n + ".webp"));
  }

  // ----- music: streamed, with a short crossfade -----
  let current = null, currentName = "", enabled = true;
  const gain = 0.8;
  function fadeOut(a) {
    const t = setInterval(() => {
      a.volume = Math.max(0, a.volume - 0.08);
      if (a.volume <= 0) { clearInterval(t); a.pause(); a.removeAttribute("src"); a.load(); }
    }, 50);
  }
  function playMusic(name, loop) {
    if (name === currentName && current) { if (enabled && current.paused) current.play().catch(() => {}); return; }
    if (current) fadeOut(current);
    currentName = name;
    const a = new Audio(BASE + "music/" + name + ".ogg");
    a.loop = loop !== false; a.volume = 0; current = a;
    if (enabled) a.play().catch(() => {});
    const t = setInterval(() => {
      if (a !== current || a.volume >= gain) { clearInterval(t); return; }
      a.volume = Math.min(gain, a.volume + 0.06);
    }, 50);
  }
  function stopMusic() { if (current) fadeOut(current); current = null; currentName = ""; }
  function pauseMusic(p) { if (current) { if (p) current.pause(); else if (enabled) current.play().catch(() => {}); } }
  function setMusicEnabled(on) { enabled = on; pauseMusic(!on); }
  // A blocked autoplay is retried on the next touch.
  document.addEventListener("pointerdown", () => { if (current && enabled && current.paused && !window.__gamePaused) current.play().catch(() => {}); });
  document.addEventListener("visibilitychange", () => { if (!window.__gamePaused) pauseMusic(document.hidden); });

  // ----- sound effects: decoded once through Web Audio -----
  const SFX = ["shot0", "shot1", "shot2", "boom0", "boom1", "boom2", "boom3", "hit", "hurt", "coin", "star", "power", "shield", "bomb", "alarm", "click"];
  const buffers = {};
  let loading = false;
  function loadSfx(actx) {
    if (loading) return; loading = true;
    SFX.forEach((n) => {
      fetch(BASE + "sfx/" + n + ".ogg").then((r) => r.arrayBuffer()).then((b) => actx.decodeAudioData(b))
        .then((d) => { buffers[n] = d; }).catch((e) => console.warn("sfx failed:", n, e));
    });
  }
  function playSfx(actx, name, vol) {
    const b = buffers[name];
    if (!actx || !b) return false;
    const s = actx.createBufferSource(), g = actx.createGain();
    s.buffer = b; g.gain.value = vol == null ? 0.5 : vol;
    s.connect(g); g.connect(actx.destination); s.start();
    return true;
  }

  window.ASSETS = { NAMES, drawTerrain, planes, bosses, enemy, sheet, cloud, worldArt, loadSprites, playMusic, stopMusic, pauseMusic, setMusicEnabled, loadSfx, playSfx, chunk };
  loadSprites();
})();
