// sprites.js — draws detailed top-down plane/star sprites onto offscreen canvases.
// All planes drawn NOSE-UP (pointing -y), centered. Used by game2d.js.
(function () {
  "use strict";

  function make(w, h) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    return c;
  }

  function softShadow(ctx, drawShape) {
    ctx.save();
    ctx.translate(4, 8);
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = "#000";
    drawShape(ctx);
    ctx.fill();
    ctx.restore();
  }

  // Camo blobs clipped to current path region
  function camo(ctx, x, y, w, h, colors) {
    ctx.save();
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = colors[i % colors.length];
      ctx.globalAlpha = 0.9;
      const bx = x + Math.random() * w, by = y + Math.random() * h;
      const r = 6 + Math.random() * 14;
      ctx.beginPath();
      ctx.ellipse(bx, by, r, r * (0.6 + Math.random() * 0.6), Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ---------- PLAYER: swept-wing camo fighter (reference #1) ----------
  function drawFighter(opts) {
    const W = 92, H = 110, cx = W / 2;
    const c = make(W, H), ctx = c.getContext("2d");
    const body = (x) => {
      x.beginPath();
      x.moveTo(cx, 6);                    // nose tip
      x.quadraticCurveTo(cx + 9, 30, cx + 9, 60);
      x.lineTo(cx + 7, 86);
      x.quadraticCurveTo(cx, 96, cx - 7, 86);
      x.lineTo(cx - 9, 60);
      x.quadraticCurveTo(cx - 9, 30, cx, 6);
      x.closePath();
    };
    // shadow
    softShadow(ctx, (x) => {
      x.beginPath();
      x.moveTo(cx, 8); x.lineTo(cx + 40, 70); x.lineTo(cx + 8, 70);
      x.lineTo(cx + 7, 95); x.lineTo(cx - 7, 95); x.lineTo(cx - 8, 70);
      x.lineTo(cx - 40, 70); x.closePath();
    });

    // wings (swept back)
    ctx.fillStyle = opts.wing;
    ctx.beginPath();
    ctx.moveTo(cx - 8, 48); ctx.lineTo(cx - 42, 74); ctx.lineTo(cx - 40, 82);
    ctx.lineTo(cx - 8, 70); ctx.closePath();
    ctx.moveTo(cx + 8, 48); ctx.lineTo(cx + 42, 74); ctx.lineTo(cx + 40, 82);
    ctx.lineTo(cx + 8, 70); ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = 1.5; ctx.stroke();

    // tail fins
    ctx.fillStyle = opts.wing;
    ctx.beginPath();
    ctx.moveTo(cx - 6, 84); ctx.lineTo(cx - 20, 98); ctx.lineTo(cx - 16, 100); ctx.lineTo(cx - 4, 90); ctx.closePath();
    ctx.moveTo(cx + 6, 84); ctx.lineTo(cx + 20, 98); ctx.lineTo(cx + 16, 100); ctx.lineTo(cx + 4, 90); ctx.closePath();
    ctx.fill(); ctx.stroke();

    // fuselage base
    const grad = ctx.createLinearGradient(cx - 10, 0, cx + 10, 0);
    grad.addColorStop(0, opts.dark); grad.addColorStop(0.5, opts.base); grad.addColorStop(1, opts.dark);
    ctx.fillStyle = grad;
    body(ctx); ctx.fill();

    // camo on fuselage
    ctx.save(); body(ctx); ctx.clip();
    camo(ctx, cx - 12, 10, 24, 80, opts.camo);
    ctx.restore();

    // outline
    body(ctx); ctx.strokeStyle = "rgba(0,0,0,.5)"; ctx.lineWidth = 2; ctx.stroke();

    // cockpit canopy
    const cg = ctx.createLinearGradient(cx, 26, cx, 50);
    cg.addColorStop(0, "#bfe8ff"); cg.addColorStop(1, "#2b6bd8");
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.ellipse(cx, 40, 6, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.4)"; ctx.lineWidth = 1; ctx.stroke();
    // glass highlight
    ctx.fillStyle = "rgba(255,255,255,.5)";
    ctx.beginPath(); ctx.ellipse(cx - 2, 36, 1.6, 4, 0, 0, Math.PI * 2); ctx.fill();

    // nose detail
    ctx.fillStyle = opts.nose || "#c0392b";
    ctx.beginPath(); ctx.moveTo(cx, 6); ctx.lineTo(cx + 4, 20); ctx.lineTo(cx - 4, 20); ctx.closePath(); ctx.fill();

    return c;
  }

  // ---------- ENEMY: simpler fighter / bomber ----------
  function drawEnemy(opts) {
    const W = 80, H = 90, cx = W / 2;
    const c = make(W, H), ctx = c.getContext("2d");
    softShadow(ctx, (x) => { x.beginPath(); x.ellipse(cx, 50, 34, 40, 0, 0, Math.PI * 2); });

    // wings straight (bomber-ish)
    ctx.fillStyle = opts.wing;
    ctx.fillRect(cx - 36, 40, 72, 14);
    ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = 1.5; ctx.strokeRect(cx - 36, 40, 72, 14);

    // engine nacelles
    ctx.fillStyle = opts.dark;
    ctx.fillRect(cx - 24, 36, 8, 24);
    ctx.fillRect(cx + 16, 36, 8, 24);

    // fuselage
    const grad = ctx.createLinearGradient(cx - 9, 0, cx + 9, 0);
    grad.addColorStop(0, opts.dark); grad.addColorStop(0.5, opts.base); grad.addColorStop(1, opts.dark);
    ctx.fillStyle = grad;
    const bodyPath = () => {
      ctx.beginPath();
      ctx.moveTo(cx, 10); ctx.quadraticCurveTo(cx + 10, 30, cx + 8, 70);
      ctx.lineTo(cx - 8, 70); ctx.quadraticCurveTo(cx - 10, 30, cx, 10); ctx.closePath();
    };
    bodyPath(); ctx.fill();
    // camo
    ctx.save(); bodyPath(); ctx.clip();
    camo(ctx, cx - 10, 12, 20, 60, opts.camo);
    ctx.restore();
    bodyPath(); ctx.strokeStyle = "rgba(0,0,0,.5)"; ctx.lineWidth = 2; ctx.stroke();

    // tail
    ctx.fillStyle = opts.wing;
    ctx.fillRect(cx - 14, 64, 28, 8);

    // cockpit
    ctx.fillStyle = "#1a2a3a";
    ctx.beginPath(); ctx.ellipse(cx, 34, 5, 9, 0, 0, Math.PI * 2); ctx.fill();

    return c;
  }

  // ---------- BOSS: big bomber ----------
  function drawBoss() {
    const W = 220, H = 180, cx = W / 2;
    const c = make(W, H), ctx = c.getContext("2d");
    softShadow(ctx, (x) => { x.beginPath(); x.ellipse(cx, 90, 95, 80, 0, 0, Math.PI * 2); });
    // wings
    ctx.fillStyle = "#5a4a6a";
    ctx.fillRect(cx - 95, 70, 190, 26);
    ctx.strokeStyle = "rgba(0,0,0,.4)"; ctx.lineWidth = 2; ctx.strokeRect(cx - 95, 70, 190, 26);
    // 4 engines
    ctx.fillStyle = "#2a2030";
    [-70, -40, 40, 70].forEach(dx => ctx.fillRect(cx + dx - 6, 60, 12, 40));
    // body
    const grad = ctx.createLinearGradient(cx - 24, 0, cx + 24, 0);
    grad.addColorStop(0, "#3a2a4a"); grad.addColorStop(0.5, "#7a3aa0"); grad.addColorStop(1, "#3a2a4a");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx, 18); ctx.quadraticCurveTo(cx + 28, 60, cx + 22, 140);
    ctx.quadraticCurveTo(cx, 158, cx - 22, 140);
    ctx.quadraticCurveTo(cx - 28, 60, cx, 18); ctx.closePath();
    ctx.fill(); ctx.strokeStyle = "rgba(0,0,0,.5)"; ctx.lineWidth = 3; ctx.stroke();
    // glowing core
    const core = ctx.createRadialGradient(cx, 80, 2, cx, 80, 22);
    core.addColorStop(0, "#ff5a8a"); core.addColorStop(1, "rgba(255,40,80,0)");
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(cx, 80, 22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ff3366";
    ctx.beginPath(); ctx.arc(cx, 80, 9, 0, Math.PI * 2); ctx.fill();
    return c;
  }

  // ---------- STAR ----------
  function drawStar() {
    const S = 44, cx = S / 2, c = make(S, S), ctx = c.getContext("2d");
    ctx.translate(cx, cx);
    const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, cx);
    grad.addColorStop(0, "#fff3b0"); grad.addColorStop(0.6, "#ffcc22"); grad.addColorStop(1, "#e69500");
    ctx.fillStyle = grad; ctx.strokeStyle = "#a66b00"; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? cx - 3 : (cx - 3) * 0.45;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(a) * r, py = Math.sin(a) * r;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    return c;
  }

  window.SPRITES = {
    player: drawFighter({ base: "#6b7a3a", dark: "#3f4a22", wing: "#5a6830", camo: ["#4a5a28", "#8a9a50", "#6b7a3a", "#c9b878"], nose: "#c0392b" }),
    enemyA: drawEnemy({ base: "#3a7a4a", dark: "#1f4a2a", wing: "#2f6238", camo: ["#2a5a34", "#4a8a54", "#6aaa6a"] }),
    enemyB: drawEnemy({ base: "#7a5a3a", dark: "#4a3420", wing: "#62482f", camo: ["#8a6a44", "#aa8a5a", "#5a4228"] }),
    boss: drawBoss(),
    star: drawStar(),
  };
})();
