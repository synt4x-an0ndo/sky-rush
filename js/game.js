// SkyForce 3D — vertical shooter (Three.js)
// Called from index.html after three.min.js and missions.js are loaded.
(function () {
  "use strict";

  const bn = (n) => String(n);

  // ---- World bounds (play field in world units) ----
  const FIELD_W = 20;   // x: -10..10
  const FIELD_NEAR = 12;  // z near camera (player)
  const FIELD_FAR = -40;  // z spawn line

  // ---- Three.js core ----
  let renderer, scene, camera, clock;
  let container = document.getElementById("game");

  // ---- Game state ----
  const G = {
    state: "menu",        // menu | playing | missioncomplete | gameover | win
    missionIndex: 0,
    lives: 3,
    score: 0,
    stars: 0,             // total collected (persist-ish per run)
    progress: 0,          // kills OR stars-in-mission OR seconds
    missionStars: 0,
    hp: 100,
    invuln: 0,
    elapsed: 0,
    enemyTimer: 0,
    starTimer: 0,
    fireTimer: 0,
    boss: null,
  };

  const bullets = [];
  const enemyBullets = [];
  const enemies = [];
  const starItems = [];
  const particles = [];
  let player, groundA, groundB;

  // ---- Input ----
  const input = { x: 0, dragging: false, targetX: 0, targetZ: 8, pointerActive: false };
  const keys = {};

  // ================= INIT =================
  function initThree() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e1a);
    scene.fog = new THREE.Fog(0x0a0e1a, 25, 60);

    camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(0, 26, 13);
    camera.lookAt(0, 0, -3);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Lights
    const amb = new THREE.AmbientLight(0x6688cc, 0.7);
    scene.add(amb);
    const sun = new THREE.DirectionalLight(0xfff0d0, 1.1);
    sun.position.set(-8, 20, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -25; sun.shadow.camera.right = 25;
    sun.shadow.camera.top = 25; sun.shadow.camera.bottom = -25;
    scene.add(sun);

    buildGround();
    player = buildPlayer();
    scene.add(player);

    clock = new THREE.Clock();
    window.addEventListener("resize", onResize);
    setupInput();
    animate();
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // ================= TERRAIN =================
  function makeGroundTile() {
    const geo = new THREE.PlaneGeometry(FIELD_W + 20, 80, 24, 60);
    // add bumpy canyon look
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      let h = Math.sin(x * 0.4) * Math.cos(y * 0.25) * 0.8;
      // river channel in middle
      const channel = Math.max(0, 1 - Math.abs(x) / 4);
      h -= channel * 1.6;
      pos.setZ(i, h);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: 0xc9a24b, roughness: 1, flatShading: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -2;
    mesh.receiveShadow = true;
    // water strip
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 80),
      new THREE.MeshStandardMaterial({ color: 0x2a3b6e, roughness: 0.2, metalness: 0.4 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = -1.9;
    const group = new THREE.Group();
    group.add(mesh); group.add(water);
    // rocks
    for (let i = 0; i < 10; i++) {
      const r = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.6 + Math.random() * 1.2),
        new THREE.MeshStandardMaterial({ color: 0x6a5a3a, roughness: 1, flatShading: true })
      );
      const side = Math.random() < 0.5 ? -1 : 1;
      r.position.set(side * (4 + Math.random() * 6), -1.3, (Math.random() - 0.5) * 70);
      r.castShadow = true;
      group.add(r);
    }
    return group;
  }

  function buildGround() {
    groundA = makeGroundTile();
    groundB = makeGroundTile();
    groundA.position.z = 0;
    groundB.position.z = -80;
    scene.add(groundA);
    scene.add(groundB);
  }

  // ================= PLAYER =================
  function buildPlayer() {
    const g = new THREE.Group();
    const hull = new THREE.MeshStandardMaterial({ color: 0xe8edf2, metalness: 0.6, roughness: 0.35, flatShading: true });
    const accent = new THREE.MeshStandardMaterial({ color: 0xd83a4a, metalness: 0.5, roughness: 0.4, flatShading: true });

    // fuselage (nose points to -z)
    const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 2.6, 10), hull);
    fuse.rotation.x = Math.PI / 2;
    fuse.castShadow = true;
    g.add(fuse);
    // nose cone
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.1, 10), accent);
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = -1.7;
    nose.castShadow = true;
    g.add(nose);
    // main swept wings
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, -0.6); wingShape.lineTo(2.3, 0.5);
    wingShape.lineTo(2.3, 0.9); wingShape.lineTo(0, 0.7); wingShape.lineTo(0, -0.6);
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.12, bevelEnabled: false });
    const wingL = new THREE.Mesh(wingGeo, accent);
    wingL.rotation.x = -Math.PI / 2; wingL.position.set(0, 0, 0.1); wingL.castShadow = true;
    g.add(wingL);
    const wingR = wingL.clone(); wingR.scale.x = -1; g.add(wingR);
    // tail fins
    const tailGeo = new THREE.BoxGeometry(0.1, 0.5, 0.8);
    const tailL = new THREE.Mesh(tailGeo, hull); tailL.position.set(0.35, 0.2, 1.1); tailL.rotation.z = 0.3; g.add(tailL);
    const tailR = tailL.clone(); tailR.position.x = -0.35; tailR.rotation.z = -0.3; g.add(tailR);
    // cockpit canopy
    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 14), new THREE.MeshStandardMaterial({ color: 0x2b86ff, metalness: 0.4, roughness: 0.05, emissive: 0x0a2a55, emissiveIntensity: 0.6 }));
    cockpit.scale.set(1, 0.7, 1.6); cockpit.position.set(0, 0.28, -0.3); g.add(cockpit);
    // twin engine flames
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.2, 8), new THREE.MeshBasicMaterial({ color: 0x66ddff }));
    flame.rotation.x = Math.PI / 2; flame.position.set(0.22, 0, 1.6); g.add(flame);
    const flame2 = flame.clone(); flame2.position.x = -0.22; g.add(flame2);
    // engine light
    const eng = new THREE.PointLight(0x66ddff, 1.2, 6); eng.position.set(0, 0.3, 1.6); g.add(eng);
    g.userData.flame = flame; g.userData.flame2 = flame2;
    g.scale.setScalar(1.15);
    g.position.set(0, 0, 8);
    return g;
  }

  // ================= ENEMIES =================
  function spawnEnemy() {
    const m = currentMission();
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.ConeGeometry(0.8, 1.8, 6),
      new THREE.MeshStandardMaterial({ color: 0x33cc66, metalness: 0.4, roughness: 0.4, flatShading: true })
    );
    body.rotation.x = Math.PI / 2;
    body.castShadow = true;
    g.add(body);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.7, 0.18, 6, 12),
      new THREE.MeshStandardMaterial({ color: 0x115522, roughness: 0.6 })
    );
    g.add(ring);
    g.position.set((Math.random() - 0.5) * (FIELD_W - 4), 0, FIELD_FAR);
    g.userData = {
      hp: m.enemyHp, maxHp: m.enemyHp, speed: m.enemySpeed,
      sway: Math.random() * Math.PI * 2, swayAmp: 1.5 + Math.random() * 2,
      baseX: g.position.x, fireCd: 1 + Math.random() * 2,
    };
    scene.add(g);
    enemies.push(g);
  }

  function spawnBoss() {
    const m = currentMission();
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.IcosahedronGeometry(3, 1),
      new THREE.MeshStandardMaterial({ color: 0x9922cc, metalness: 0.6, roughness: 0.3, flatShading: true })
    );
    body.castShadow = true;
    g.add(body);
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(1.2, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xff3366, emissive: 0xaa0022, emissiveIntensity: 0.8 })
    );
    g.add(core);
    g.position.set(0, 0, FIELD_FAR + 8);
    g.userData = { hp: m.bossHp, maxHp: m.bossHp, speed: 4, dir: 1, fireCd: 1, isBoss: true };
    scene.add(g);
    enemies.push(g);
    G.boss = g;
  }

  // ================= STARS =================
  function spawnStar() {
    const shape = new THREE.Shape();
    const spikes = 5, outer = 0.55, inner = 0.24;
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(a) * r, py = Math.sin(a) * r;
      if (i === 0) shape.moveTo(px, py); else shape.lineTo(px, py);
    }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 1 });
    geo.center();
    const star = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffcc22, emissive: 0x886600, emissiveIntensity: 0.6, metalness: 0.5, roughness: 0.3 }));
    star.position.set((Math.random() - 0.5) * (FIELD_W - 4), 0.5, FIELD_FAR);
    star.userData = { spin: Math.random() * 2 + 1 };
    scene.add(star);
    starItems.push(star);
  }

  // ================= BULLETS =================
  let _bulletGeo;
  function fireBullet() {
    if (!_bulletGeo) _bulletGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.8, 8);
    const b = new THREE.Mesh(_bulletGeo, new THREE.MeshBasicMaterial({ color: 0x66ffff }));
    b.rotation.x = Math.PI / 2;
    b.position.copy(player.position);
    b.position.z -= 1.2;
    scene.add(b);
    bullets.push(b);
    playBeep(880, 0.04, 0.05);
  }

  function enemyFire(e) {
    const geo = new THREE.SphereGeometry(0.22, 8, 8);
    const b = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xff5533 }));
    b.position.copy(e.position);
    b.position.z += 1;
    scene.add(b);
    enemyBullets.push(b);
  }

  // ================= PARTICLES =================
  function explode(pos, color, count) {
    for (let i = 0; i < count; i++) {
      const p = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.25, 0.25),
        new THREE.MeshBasicMaterial({ color })
      );
      p.position.copy(pos);
      p.userData = {
        v: new THREE.Vector3((Math.random() - 0.5) * 12, Math.random() * 8, (Math.random() - 0.5) * 12),
        life: 0.6,
      };
      scene.add(p);
      particles.push(p);
    }
  }

  // ================= AUDIO (tiny WebAudio) =================
  let actx;
  function playBeep(freq, dur, vol) {
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      o.frequency.value = freq; o.type = "square";
      g.gain.value = vol || 0.08;
      o.connect(g); g.connect(actx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
      o.stop(actx.currentTime + dur);
    } catch (e) {}
  }

  // ================= INPUT =================
  function setupInput() {
    const el = renderer.domElement;
    function toWorldX(clientX) {
      const nx = (clientX / window.innerWidth) * 2 - 1;
      return nx * (FIELD_W / 2);
    }
    function toWorldZ(clientY) {
      const ny = clientY / window.innerHeight; // 0 top .. 1 bottom
      return THREE.MathUtils.lerp(-6, 10, ny);
    }
    function onMove(x, y) {
      input.targetX = THREE.MathUtils.clamp(toWorldX(x), -FIELD_W / 2 + 1, FIELD_W / 2 - 1);
      input.targetZ = THREE.MathUtils.clamp(toWorldZ(y), -6, 10);
    }
    el.addEventListener("pointerdown", (e) => { input.pointerActive = true; onMove(e.clientX, e.clientY); if (actx) actx.resume(); });
    el.addEventListener("pointermove", (e) => { if (input.pointerActive) onMove(e.clientX, e.clientY); });
    window.addEventListener("pointerup", () => { input.pointerActive = false; });
    window.addEventListener("keydown", (e) => { keys[e.key] = true; });
    window.addEventListener("keyup", (e) => { keys[e.key] = false; });
  }

  // ================= MISSION FLOW =================
  function currentMission() { return window.MISSIONS[G.missionIndex]; }

  function startMission(idx) {
    G.missionIndex = idx;
    G.state = "playing";
    G.progress = 0;
    G.missionStars = 0;
    G.hp = 100;
    G.invuln = 1.5;
    G.elapsed = 0;
    G.enemyTimer = 0;
    G.starTimer = 1;
    G.fireTimer = 0;
    G.boss = null;
    clearArray(enemies); clearArray(bullets); clearArray(enemyBullets); clearArray(starItems); clearArray(particles);
    player.position.set(0, 0, 8);
    input.targetX = 0; input.targetZ = 8;
    if (currentMission().type === "boss") spawnBoss();
    UI.showHUD();
    UI.toast("Mission " + currentMission().id + ": " + currentMission().name, currentMission().desc);
  }

  function clearArray(arr) {
    arr.forEach(o => scene.remove(o));
    arr.length = 0;
  }

  function missionComplete() {
    G.state = "missioncomplete";
    G.score += 500 + G.missionStars * 50;
    playBeep(660, 0.15, 0.1); setTimeout(() => playBeep(990, 0.2, 0.1), 120);
    if (G.missionIndex >= window.MISSIONS.length - 1) {
      G.state = "win";
      UI.showWin();
    } else {
      UI.showMissionComplete();
    }
  }

  function gameOver() {
    G.state = "gameover";
    explode(player.position, 0xff5533, 30);
    playBeep(200, 0.4, 0.12);
    UI.showGameOver();
  }

  function hitPlayer(dmg) {
    if (G.invuln > 0 || G.state !== "playing") return;
    G.hp -= dmg;
    G.invuln = 1.2;
    playBeep(300, 0.1, 0.1);
    if (G.hp <= 0) {
      G.lives--;
      if (G.lives <= 0) { gameOver(); }
      else { G.hp = 100; G.invuln = 2; UI.toast("Life Lost!", "Lives left: " + G.lives); }
    }
    UI.updateHUD();
  }

  function addProgress(kind) {
    const m = currentMission();
    if (kind === "kill" && (m.type === "kill")) G.progress++;
    if (kind === "star" && m.type === "stars") G.progress++;
    checkGoal();
  }

  function checkGoal() {
    const m = currentMission();
    if (m.type === "survive") { if (G.elapsed >= m.goal) missionComplete(); }
    else if (m.type === "boss") { if (G.boss && G.boss.userData.hp <= 0) { G.progress = 1; missionComplete(); } }
    else { if (G.progress >= m.goal) missionComplete(); }
    UI.updateHUD();
  }

  // ================= MAIN LOOP =================
  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    scrollGround(dt);
    if (G.state === "playing") updatePlaying(dt);
    updateParticles(dt);
    renderer.render(scene, camera);
  }

  function scrollGround(dt) {
    const sp = 14 * dt;
    [groundA, groundB].forEach(g => {
      g.position.z += sp;
      if (g.position.z > 80) g.position.z -= 160;
    });
  }

  function updatePlaying(dt) {
    const m = currentMission();
    G.elapsed += dt;
    if (G.invuln > 0) G.invuln -= dt;

    // player movement (keyboard adjusts target)
    const kspeed = 18 * dt;
    if (keys["ArrowLeft"] || keys["a"]) input.targetX -= kspeed;
    if (keys["ArrowRight"] || keys["d"]) input.targetX += kspeed;
    if (keys["ArrowUp"] || keys["w"]) input.targetZ -= kspeed;
    if (keys["ArrowDown"] || keys["s"]) input.targetZ += kspeed;
    input.targetX = THREE.MathUtils.clamp(input.targetX, -FIELD_W / 2 + 1, FIELD_W / 2 - 1);
    input.targetZ = THREE.MathUtils.clamp(input.targetZ, -6, 10);
    player.position.x += (input.targetX - player.position.x) * Math.min(1, 12 * dt);
    player.position.z += (input.targetZ - player.position.z) * Math.min(1, 12 * dt);
    // bank/roll
    player.rotation.z = (input.targetX - player.position.x) * -0.25;
    const fl = 0.8 + Math.random() * 0.6;
    player.userData.flame.scale.y = fl;
    if (player.userData.flame2) player.userData.flame2.scale.y = fl;
    // blink when invuln
    player.visible = !(G.invuln > 0 && Math.floor(G.elapsed * 12) % 2 === 0);

    // auto fire
    G.fireTimer -= dt;
    if (G.fireTimer <= 0) { fireBullet(); G.fireTimer = 0.18; }

    // spawns
    if (m.type !== "boss") {
      G.enemyTimer -= dt;
      if (G.enemyTimer <= 0) { spawnEnemy(); G.enemyTimer = m.enemyRate * (0.7 + Math.random() * 0.6); }
    }
    G.starTimer -= dt;
    if (G.starTimer <= 0) { spawnStar(); G.starTimer = m.starRate * (0.7 + Math.random() * 0.6); }

    updateBullets(dt);
    updateEnemies(dt);
    updateEnemyBullets(dt);
    updateStars(dt);

    if (m.type === "survive") checkGoal();
  }

  function updateBullets(dt) {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.position.z -= 40 * dt;
      if (b.position.z < FIELD_FAR - 4) { scene.remove(b); bullets.splice(i, 1); continue; }
      // hit enemies
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        const r = e.userData.isBoss ? 3 : 1.1;
        if (b.position.distanceTo(e.position) < r) {
          scene.remove(b); bullets.splice(i, 1);
          e.userData.hp--;
          explode(b.position, 0x66ffff, 4);
          if (e.userData.hp <= 0) {
            explode(e.position, e.userData.isBoss ? 0xff3366 : 0x33ff88, e.userData.isBoss ? 40 : 12);
            scene.remove(e); enemies.splice(j, 1);
            G.score += e.userData.isBoss ? 5000 : 100;
            playBeep(e.userData.isBoss ? 120 : 440, 0.12, 0.09);
            if (e.userData.isBoss) { G.boss = null; checkGoal(); }
            else addProgress("kill");
          } else { playBeep(660, 0.03, 0.05); if (e.userData.isBoss) checkGoal(); }
          break;
        }
      }
    }
  }

  function updateEnemies(dt) {
    const m = currentMission();
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (e.userData.isBoss) {
        e.position.x += e.userData.dir * e.userData.speed * dt;
        if (Math.abs(e.position.x) > FIELD_W / 2 - 3) e.userData.dir *= -1;
        e.rotation.y += dt * 0.6;
        e.userData.fireCd -= dt;
        if (e.userData.fireCd <= 0) {
          enemyFireFan(e);
          e.userData.fireCd = 1.1;
        }
        continue;
      }
      e.position.z += e.userData.speed * dt;
      e.userData.sway += dt * 2;
      e.position.x = e.userData.baseX + Math.sin(e.userData.sway) * e.userData.swayAmp;
      e.rotation.z += dt * 2;
      // enemy fire sometimes
      e.userData.fireCd -= dt;
      if (e.userData.fireCd <= 0 && m.enemyHp >= 2) { enemyFire(e); e.userData.fireCd = 2 + Math.random() * 2; }
      // reached player line
      if (e.position.z > FIELD_NEAR + 2) { scene.remove(e); enemies.splice(i, 1); continue; }
      // collision with player
      if (e.position.distanceTo(player.position) < 1.4) {
        explode(e.position, 0xff8800, 10);
        scene.remove(e); enemies.splice(i, 1);
        hitPlayer(34);
      }
    }
  }

  function enemyFireFan(e) {
    for (let a = -0.4; a <= 0.4; a += 0.4) {
      const geo = new THREE.SphereGeometry(0.28, 8, 8);
      const b = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xff33aa }));
      b.position.copy(e.position);
      b.userData = { ax: a };
      scene.add(b); enemyBullets.push(b);
    }
  }

  function updateEnemyBullets(dt) {
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const b = enemyBullets[i];
      b.position.z += 22 * dt;
      if (b.userData && b.userData.ax) b.position.x += b.userData.ax * 10 * dt;
      if (b.position.z > FIELD_NEAR + 3) { scene.remove(b); enemyBullets.splice(i, 1); continue; }
      if (b.position.distanceTo(player.position) < 1.0) {
        scene.remove(b); enemyBullets.splice(i, 1);
        explode(b.position, 0xff3366, 6);
        hitPlayer(18);
      }
    }
  }

  function updateStars(dt) {
    for (let i = starItems.length - 1; i >= 0; i--) {
      const s = starItems[i];
      s.position.z += 10 * dt;
      s.rotation.y += s.userData.spin * dt;
      s.rotation.z += dt;
      if (s.position.z > FIELD_NEAR + 2) { scene.remove(s); starItems.splice(i, 1); continue; }
      if (s.position.distanceTo(player.position) < 1.5) {
        scene.remove(s); starItems.splice(i, 1);
        G.stars++; G.missionStars++; G.score += 25;
        playBeep(1200, 0.06, 0.07);
        explode(s.position, 0xffcc22, 5);
        addProgress("star");
        UI.updateHUD();
      }
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.userData.life -= dt;
      if (p.userData.life <= 0) { scene.remove(p); particles.splice(i, 1); continue; }
      p.userData.v.y -= 20 * dt;
      p.position.addScaledVector(p.userData.v, dt);
      p.scale.multiplyScalar(1 - dt * 2);
      p.rotation.x += dt * 5; p.rotation.y += dt * 5;
    }
  }

  // ================= UI =================
  const UI = {
    el(id) { return document.getElementById(id); },
    showHUD() { this.el("hud").style.display = "flex"; this.updateHUD(); },
    hideHUD() { this.el("hud").style.display = "none"; },
    updateHUD() {
      const m = currentMission();
      this.el("score").textContent = bn(G.score);
      this.el("starcount").textContent = bn(G.stars);
      // lives as hearts
      let hearts = ""; for (let i = 0; i < G.lives; i++) hearts += "❤";
      this.el("lives").textContent = hearts || "—";
      // hp bar
      this.el("hpfill").style.width = Math.max(0, G.hp) + "%";
      // mission progress
      let cur, goal;
      if (m.type === "survive") { cur = Math.floor(G.elapsed); goal = m.goal; }
      else if (m.type === "boss") { cur = G.boss ? (m.bossHp - G.boss.userData.hp) : m.bossHp; goal = m.bossHp; }
      else { cur = G.progress; goal = m.goal; }
      this.el("mtitle").textContent = "Mission " + m.id + " — " + m.name;
      this.el("mprog").textContent = bn(cur) + " / " + bn(goal);
      this.el("mfill").style.width = Math.min(100, (cur / goal) * 100) + "%";
    },
    toast(title, sub) {
      const t = this.el("toast");
      t.innerHTML = "<b>" + title + "</b><span>" + (sub || "") + "</span>";
      t.classList.add("show");
      clearTimeout(this._tt);
      this._tt = setTimeout(() => t.classList.remove("show"), 2200);
    },
    showMenu() {
      this.hideHUD();
      this.el("overlay").style.display = "flex";
      this.el("overlay").innerHTML = `
        <div class="panel">
          <h1>SKYFORCE <span>3D</span></h1>
          <p class="sub">War over the desert skies — ${window.MISSIONS.length} missions</p>
          <button id="btnStart" class="btn">▶ Play</button>
          <button id="btnMissions" class="btn ghost">🎯 Select Mission</button>
          <p class="hint">Move ship with mouse / finger · Auto-fire · Keyboard: Arrows / WASD</p>
        </div>`;
      this.el("btnStart").onclick = () => { if (actx) actx.resume(); this.hideOverlay(); startMission(0); };
      this.el("btnMissions").onclick = () => this.showMissionSelect();
    },
    showMissionSelect() {
      const unlocked = +(localStorage.getItem("sf_unlocked") || 1);
      let grid = "";
      window.MISSIONS.forEach((m, i) => {
        const lock = i < unlocked;
        grid += `<button class="mcell ${lock ? "" : "locked"}" data-i="${i}" ${lock ? "" : "disabled"}>
          <span class="mnum">${bn(m.id)}</span><span class="mname">${lock ? m.name : "🔒"}</span></button>`;
      });
      this.el("overlay").innerHTML = `
        <div class="panel wide">
          <h2>Select Mission</h2>
          <div class="mgrid">${grid}</div>
          <button id="btnBack" class="btn ghost">← Back</button>
        </div>`;
      this.el("overlay").querySelectorAll(".mcell:not(.locked)").forEach(b => {
        b.onclick = () => { if (actx) actx.resume(); this.hideOverlay(); G.lives = 3; G.score = 0; G.stars = 0; startMission(+b.dataset.i); };
      });
      this.el("btnBack").onclick = () => this.showMenu();
    },
    showMissionComplete() {
      const next = G.missionIndex + 1;
      const unlocked = +(localStorage.getItem("sf_unlocked") || 1);
      if (next + 1 > unlocked) localStorage.setItem("sf_unlocked", next + 1);
      this.hideHUD();
      this.el("overlay").style.display = "flex";
      this.el("overlay").innerHTML = `
        <div class="panel">
          <h2>✅ Mission Complete!</h2>
          <p class="sub">${currentMission().name}</p>
          <div class="stats">
            <div><span>⭐ Stars</span><b>${G.missionStars}</b></div>
            <div><span>Score</span><b>${G.score}</b></div>
          </div>
          <button id="btnNext" class="btn">▶ Next Mission (${next + 1})</button>
          <button id="btnMenu" class="btn ghost">Menu</button>
        </div>`;
      this.el("btnNext").onclick = () => { this.hideOverlay(); startMission(next); };
      this.el("btnMenu").onclick = () => this.showMenu();
    },
    showGameOver() {
      this.hideHUD();
      this.el("overlay").style.display = "flex";
      this.el("overlay").innerHTML = `
        <div class="panel">
          <h2 class="bad">💥 Game Over</h2>
          <p class="sub">Mission ${currentMission().id} — ${currentMission().name}</p>
          <div class="stats"><div><span>Score</span><b>${G.score}</b></div><div><span>⭐</span><b>${G.stars}</b></div></div>
          <button id="btnRetry" class="btn">↻ Retry</button>
          <button id="btnMenu" class="btn ghost">Menu</button>
        </div>`;
      this.el("btnRetry").onclick = () => { this.hideOverlay(); G.lives = 3; G.hp = 100; startMission(G.missionIndex); };
      this.el("btnMenu").onclick = () => this.showMenu();
    },
    showWin() {
      this.hideHUD();
      this.el("overlay").style.display = "flex";
      this.el("overlay").innerHTML = `
        <div class="panel">
          <h1>🏆 Victory!</h1>
          <p class="sub">You cleared all ${window.MISSIONS.length} missions!</p>
          <div class="stats"><div><span>Score</span><b>${G.score}</b></div><div><span>⭐</span><b>${G.stars}</b></div></div>
          <button id="btnMenu" class="btn">🏠 Menu</button>
        </div>`;
      this.el("btnMenu").onclick = () => { localStorage.setItem("sf_unlocked", window.MISSIONS.length); this.showMenu(); };
    },
    hideOverlay() { this.el("overlay").style.display = "none"; },
  };

  // expose for debugging / pause button
  window.SF = { G, UI, startMission };

  // ================= BOOT =================
  window.addEventListener("DOMContentLoaded", () => {
    initThree();
    UI.showMenu();
    // pause button
    const pb = document.getElementById("pauseBtn");
    if (pb) pb.onclick = () => {
      if (G.state === "playing") { G.state = "paused"; UI.toast("Paused", "Tap again to resume"); }
      else if (G.state === "paused") { G.state = "playing"; }
    };
  });
})();
