// sprites.js — detailed top-down plane/star sprites on offscreen canvases.
// All planes drawn NOSE-UP (pointing -y), centered. Used by game2d.js.
(function () {
  "use strict";

  function make(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
  function line(ctx, x1, y1, x2, y2, col, w) { ctx.strokeStyle = col; ctx.lineWidth = w || 1; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }

  function camoClip(ctx, path, x, y, w, h, colors) {
    ctx.save(); path(); ctx.clip();
    for (let i = 0; i < 22; i++) {
      ctx.fillStyle = colors[i % colors.length]; ctx.globalAlpha = 0.85;
      const bx = x + Math.random() * w, by = y + Math.random() * h, r = 5 + Math.random() * 13;
      ctx.beginPath(); ctx.ellipse(bx, by, r, r * (0.6 + Math.random() * 0.7), Math.random() * 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // ---------- PLAYER: detailed modern fighter ----------
  function drawFighter(o) {
    const W = 120, H = 150, cx = W / 2, c = make(W, H), ctx = c.getContext("2d");

    // ground shadow
    ctx.save(); ctx.translate(5, 9); ctx.globalAlpha = 0.25; ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.moveTo(cx, 10); ctx.lineTo(cx + 52, 96); ctx.lineTo(cx + 10, 96);
    ctx.lineTo(cx + 9, 132); ctx.lineTo(cx - 9, 132); ctx.lineTo(cx - 10, 96); ctx.lineTo(cx - 52, 96); ctx.closePath(); ctx.fill(); ctx.restore();

    // ---- wings (swept delta) ----
    function wing(dir) {
      ctx.save();
      ctx.fillStyle = o.wing;
      ctx.beginPath();
      ctx.moveTo(cx + dir * 10, 60);
      ctx.lineTo(cx + dir * 54, 96);
      ctx.lineTo(cx + dir * 50, 106);
      ctx.lineTo(cx + dir * 10, 92);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,.4)"; ctx.lineWidth = 2; ctx.stroke();
      // camo on wing
      ctx.clip();
      for (let i = 0; i < 8; i++) { ctx.fillStyle = o.camo[i % o.camo.length]; ctx.globalAlpha = .7; ctx.beginPath(); ctx.ellipse(cx + dir * (18 + Math.random() * 30), 70 + Math.random() * 30, 8, 6, 0, 0, 6.28); ctx.fill(); }
      ctx.globalAlpha = 1;
      ctx.restore();
      // roundel insignia
      ctx.fillStyle = "#1c3f8a"; ctx.beginPath(); ctx.arc(cx + dir * 26, 86, 5.5, 0, 6.28); ctx.fill();
      ctx.fillStyle = "#e8edf2"; ctx.beginPath(); ctx.arc(cx + dir * 26, 86, 3.4, 0, 6.28); ctx.fill();
      ctx.fillStyle = "#c0392b"; ctx.beginPath(); ctx.arc(cx + dir * 26, 86, 1.6, 0, 6.28); ctx.fill();
      // wing-tip missile
      ctx.fillStyle = "#cfd6dd"; ctx.fillRect(cx + dir * 50 - 2, 92, 4, 16);
      ctx.fillStyle = "#c0392b"; ctx.beginPath(); ctx.moveTo(cx + dir * 50 - 2, 92); ctx.lineTo(cx + dir * 50 + 2, 92); ctx.lineTo(cx + dir * 50, 86); ctx.closePath(); ctx.fill();
    }
    wing(-1); wing(1);

    // ---- tail fins ----
    ctx.fillStyle = o.wing;
    [-1, 1].forEach(d => {
      ctx.beginPath(); ctx.moveTo(cx + d * 8, 118); ctx.lineTo(cx + d * 24, 138); ctx.lineTo(cx + d * 18, 140); ctx.lineTo(cx + d * 5, 126); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,.4)"; ctx.lineWidth = 1.5; ctx.stroke();
    });

    // ---- fuselage ----
    const bodyPath = () => {
      ctx.beginPath();
      ctx.moveTo(cx, 8);
      ctx.quadraticCurveTo(cx + 12, 36, cx + 12, 80);
      ctx.lineTo(cx + 10, 118);
      ctx.quadraticCurveTo(cx, 132, cx - 10, 118);
      ctx.lineTo(cx - 12, 80);
      ctx.quadraticCurveTo(cx - 12, 36, cx, 8);
      ctx.closePath();
    };
    const grad = ctx.createLinearGradient(cx - 12, 0, cx + 12, 0);
    grad.addColorStop(0, o.dark); grad.addColorStop(0.5, o.base); grad.addColorStop(1, o.dark);
    ctx.fillStyle = grad; bodyPath(); ctx.fill();
    // camo
    camoClip(ctx, bodyPath, cx - 14, 10, 28, 110, o.camo);
    // centerline highlight
    ctx.save(); bodyPath(); ctx.clip();
    const hl = ctx.createLinearGradient(cx - 4, 0, cx + 4, 0);
    hl.addColorStop(0, "rgba(255,255,255,0)"); hl.addColorStop(.5, "rgba(255,255,255,.22)"); hl.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = hl; ctx.fillRect(cx - 5, 8, 10, 124);
    // panel lines
    line(ctx, cx - 11, 58, cx + 11, 58, "rgba(0,0,0,.25)", 1);
    line(ctx, cx - 11, 92, cx + 11, 92, "rgba(0,0,0,.25)", 1);
    line(ctx, cx, 40, cx, 118, "rgba(0,0,0,.18)", 1);
    ctx.restore();
    bodyPath(); ctx.strokeStyle = "rgba(0,0,0,.55)"; ctx.lineWidth = 2.2; ctx.stroke();

    // air intakes
    ctx.fillStyle = "#11161d";
    ctx.fillRect(cx - 11, 62, 4, 14); ctx.fillRect(cx + 7, 62, 4, 14);

    // ---- cockpit canopy ----
    const cg = ctx.createLinearGradient(cx, 30, cx, 58);
    cg.addColorStop(0, "#d6f0ff"); cg.addColorStop(.5, "#5aa6ef"); cg.addColorStop(1, "#1d4ea0");
    ctx.fillStyle = cg; ctx.beginPath(); ctx.ellipse(cx, 46, 7.5, 15, 0, 0, 6.28); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.45)"; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.65)"; ctx.beginPath(); ctx.ellipse(cx - 2.5, 40, 2, 6, -0.2, 0, 6.28); ctx.fill();

    // ---- nose ----
    ctx.fillStyle = o.nose || "#c0392b";
    ctx.beginPath(); ctx.moveTo(cx, 8); ctx.lineTo(cx + 5, 26); ctx.lineTo(cx - 5, 26); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.5)"; ctx.fillRect(cx - 0.6, 12, 1.2, 12);

    // ---- afterburner nozzles ----
    ctx.fillStyle = "#2a2f36"; ctx.fillRect(cx - 8, 126, 6, 7); ctx.fillRect(cx + 2, 126, 6, 7);
    const ab = ctx.createLinearGradient(0, 130, 0, 150);
    ab.addColorStop(0, "rgba(120,220,255,.9)"); ab.addColorStop(1, "rgba(120,220,255,0)");
    ctx.fillStyle = ab; ctx.fillRect(cx - 7, 132, 4, 16); ctx.fillRect(cx + 3, 132, 4, 16);

    return c;
  }

  // ---------- ENEMY ----------
  function drawEnemy(o) {
    const W = 100, H = 112, cx = W / 2, c = make(W, H), ctx = c.getContext("2d");
    ctx.save(); ctx.translate(4, 8); ctx.globalAlpha = 0.22; ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.ellipse(cx, 58, 44, 46, 0, 0, 6.28); ctx.fill(); ctx.restore();

    // straight wings
    ctx.fillStyle = o.wing; ctx.fillRect(cx - 45, 48, 90, 16);
    ctx.strokeStyle = "rgba(0,0,0,.4)"; ctx.lineWidth = 2; ctx.strokeRect(cx - 45, 48, 90, 16);
    // camo stripes on wings
    ctx.save(); ctx.beginPath(); ctx.rect(cx - 45, 48, 90, 16); ctx.clip();
    for (let i = 0; i < 10; i++) { ctx.fillStyle = o.camo[i % o.camo.length]; ctx.globalAlpha = .7; ctx.fillRect(cx - 45 + i * 9, 48, 5, 16); }
    ctx.globalAlpha = 1; ctx.restore();
    // engines + props
    ctx.fillStyle = o.dark; ctx.fillRect(cx - 30, 42, 11, 28); ctx.fillRect(cx + 19, 42, 11, 28);
    ctx.fillStyle = "#11161d"; ctx.beginPath(); ctx.arc(cx - 24.5, 44, 6, 0, 6.28); ctx.fill(); ctx.beginPath(); ctx.arc(cx + 24.5, 44, 6, 0, 6.28); ctx.fill();
    line(ctx, cx - 31, 44, cx - 18, 44, "rgba(255,255,255,.35)", 1.5); line(ctx, cx - 24.5, 38, cx - 24.5, 50, "rgba(255,255,255,.35)", 1.5);
    line(ctx, cx + 18, 44, cx + 31, 44, "rgba(255,255,255,.35)", 1.5); line(ctx, cx + 24.5, 38, cx + 24.5, 50, "rgba(255,255,255,.35)", 1.5);

    // fuselage
    const bp = () => { ctx.beginPath(); ctx.moveTo(cx, 12); ctx.quadraticCurveTo(cx + 13, 40, cx + 11, 88); ctx.quadraticCurveTo(cx, 98, cx - 11, 88); ctx.quadraticCurveTo(cx - 13, 40, cx, 12); ctx.closePath(); };
    const g = ctx.createLinearGradient(cx - 12, 0, cx + 12, 0); g.addColorStop(0, o.dark); g.addColorStop(.5, o.base); g.addColorStop(1, o.dark);
    ctx.fillStyle = g; bp(); ctx.fill();
    camoClip(ctx, bp, cx - 13, 14, 26, 80, o.camo);
    ctx.save(); bp(); ctx.clip(); line(ctx, cx - 12, 60, cx + 12, 60, "rgba(0,0,0,.25)", 1); line(ctx, cx, 30, cx, 90, "rgba(0,0,0,.18)", 1); ctx.restore();
    bp(); ctx.strokeStyle = "rgba(0,0,0,.5)"; ctx.lineWidth = 2; ctx.stroke();
    // tail
    ctx.fillStyle = o.wing; ctx.beginPath(); ctx.moveTo(cx - 16, 84); ctx.lineTo(cx + 16, 84); ctx.lineTo(cx + 9, 96); ctx.lineTo(cx - 9, 96); ctx.closePath(); ctx.fill();
    // cockpit
    const cg = ctx.createLinearGradient(cx, 30, cx, 50); cg.addColorStop(0, "#9fd0ff"); cg.addColorStop(1, "#15385f");
    ctx.fillStyle = cg; ctx.beginPath(); ctx.ellipse(cx, 40, 6, 11, 0, 0, 6.28); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.4)"; ctx.lineWidth = 1; ctx.stroke();
    // nose tip
    ctx.fillStyle = o.nose || "#333"; ctx.beginPath(); ctx.moveTo(cx, 12); ctx.lineTo(cx + 4, 26); ctx.lineTo(cx - 4, 26); ctx.closePath(); ctx.fill();
    return c;
  }

  // ---------- BOSS ----------
  function drawBoss(o) {
    o = o || { wing1: "#6a5a7a", wing2: "#413050", body1: "#3a2a4a", body2: "#8a3ab0", core: "#ff5a8a", coreMid: "#ff3366" };
    const W = 240, H = 200, cx = W / 2, c = make(W, H), ctx = c.getContext("2d");
    ctx.save(); ctx.translate(6, 10); ctx.globalAlpha = .25; ctx.fillStyle = "#000"; ctx.beginPath(); ctx.ellipse(cx, 100, 105, 86, 0, 0, 6.28); ctx.fill(); ctx.restore();
    const wg = ctx.createLinearGradient(0, 70, 0, 110); wg.addColorStop(0, o.wing1); wg.addColorStop(1, o.wing2);
    ctx.fillStyle = wg; ctx.fillRect(cx - 105, 74, 210, 30); ctx.strokeStyle = "rgba(0,0,0,.45)"; ctx.lineWidth = 2.5; ctx.strokeRect(cx - 105, 74, 210, 30);
    ctx.fillStyle = o.wing2; [-78, -46, 46, 78].forEach(d => { ctx.fillRect(cx + d - 7, 60, 14, 46); ctx.fillStyle = "#11161d"; ctx.beginPath(); ctx.arc(cx + d, 62, 8, 0, 6.28); ctx.fill(); ctx.fillStyle = o.wing2; });
    const g = ctx.createLinearGradient(cx - 26, 0, cx + 26, 0); g.addColorStop(0, o.body1); g.addColorStop(.5, o.body2); g.addColorStop(1, o.body1);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(cx, 18); ctx.quadraticCurveTo(cx + 30, 64, cx + 24, 150); ctx.quadraticCurveTo(cx, 172, cx - 24, 150); ctx.quadraticCurveTo(cx - 30, 64, cx, 18); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.5)"; ctx.lineWidth = 3; ctx.stroke();
    line(ctx, cx - 24, 70, cx + 24, 70, "rgba(0,0,0,.3)", 1.5); line(ctx, cx - 22, 110, cx + 22, 110, "rgba(0,0,0,.3)", 1.5);
    const core = ctx.createRadialGradient(cx, 90, 3, cx, 90, 26); core.addColorStop(0, "#ffffff"); core.addColorStop(.4, o.core); core.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = core; ctx.beginPath(); ctx.arc(cx, 90, 26, 0, 6.28); ctx.fill();
    ctx.fillStyle = o.coreMid; ctx.beginPath(); ctx.arc(cx, 90, 10, 0, 6.28); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.beginPath(); ctx.arc(cx - 3, 87, 3, 0, 6.28); ctx.fill();
    return c;
  }

  // ---------- STAR ----------
  function drawStar() {
    const Sz = 48, cx = Sz / 2, c = make(Sz, Sz), ctx = c.getContext("2d");
    ctx.translate(cx, cx);
    const g = ctx.createRadialGradient(0, -3, 2, 0, 0, cx); g.addColorStop(0, "#fff6c0"); g.addColorStop(.55, "#ffcc22"); g.addColorStop(1, "#d98500");
    ctx.fillStyle = g; ctx.strokeStyle = "#9a6300"; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 === 0 ? cx - 4 : (cx - 4) * 0.45; const a = (i / 10) * 6.283 - 1.5708; const px = Math.cos(a) * r, py = Math.sin(a) * r; i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.6)"; ctx.beginPath(); ctx.arc(-4, -6, 2.5, 0, 6.28); ctx.fill();
    return c;
  }

  // ---------- COIN ----------
  function drawCoin() {
    const Sz = 40, cx = Sz / 2, c = make(Sz, Sz), ctx = c.getContext("2d");
    ctx.translate(cx, cx);
    const g = ctx.createRadialGradient(-3, -3, 2, 0, 0, cx - 2);
    g.addColorStop(0, "#fff3b0"); g.addColorStop(.5, "#ffcf3a"); g.addColorStop(1, "#c98a10");
    ctx.fillStyle = g; ctx.strokeStyle = "#a66b00"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, cx - 3, 0, 6.28); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#e0a820"; ctx.beginPath(); ctx.arc(0, 0, cx - 8, 0, 6.28); ctx.fill();
    ctx.fillStyle = "#8a5e08"; ctx.font = "bold 16px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("$", 0, 1);
    ctx.fillStyle = "rgba(255,255,255,.6)"; ctx.beginPath(); ctx.arc(-4, -5, 2.5, 0, 6.28); ctx.fill();
    return c;
  }

  window.SPRITES = {
    makeFighter: drawFighter,
    makeBoss: drawBoss,
    coin: drawCoin(),
    player: drawFighter({ base: "#6f7e3e", dark: "#3f4a22", wing: "#58662e", camo: ["#4a5a28", "#8a9a50", "#6b7a3a", "#c9b878"], nose: "#c0392b" }),
    enemyA: drawEnemy({ base: "#3a7a4a", dark: "#1f4a2a", wing: "#2f6238", camo: ["#2a5a34", "#4a8a54", "#6aaa6a"], nose: "#1a3a22" }),
    enemyB: drawEnemy({ base: "#7a5a3a", dark: "#4a3420", wing: "#62482f", camo: ["#8a6a44", "#aa8a5a", "#5a4228"], nose: "#3a2a18" }),
    boss: drawBoss(),
    star: drawStar(),
  };
})();
