// 40 missions across 4 worlds (10 each). Last mission of each world is a boss.
// world: 0 Desert · 1 Jungle · 2 Snow · 3 Cyber
window.WORLDS = [
  { id: 0, name: "Desert River" },
  { id: 1, name: "Green Jungle" },
  { id: 2, name: "Snow Mountain" },
  { id: 3, name: "Cyber City" },
];
window.MISSIONS = (function () {
  const pattern = ["kill", "stars", "kill", "survive", "kill", "stars", "kill", "survive", "kill", "boss"];
  const arr = [];
  for (let w = 0; w < 4; w++) {
    for (let i = 0; i < 10; i++) {
      const idx = w * 10 + i, id = idx + 1, t = pattern[i];
      const enemyHp = [1, 2, 3, 4][w] + (i >= 5 ? 1 : 0);
      const enemySpeed = 7 + w * 1.5 + i * 0.25;
      const enemyRate = Math.max(0.5, 1.5 - w * 0.12 - i * 0.02);
      let goal, desc, starRate = 2.0;
      if (t === "kill") { goal = 8 + idx * 2; desc = "Destroy " + goal + " enemies"; }
      else if (t === "stars") { goal = 12 + idx; desc = "Collect " + goal + " stars"; starRate = 1.2; }
      else if (t === "survive") { goal = 25 + idx * 2; desc = "Survive " + goal + " seconds"; }
      else { goal = 1; desc = "Defeat the world boss"; }
      const wn = window.WORLDS[w].name;
      arr.push({
        id: id, world: w, worldName: wn,
        name: t === "boss" ? (wn + " — Boss") : (wn + " " + (i + 1)),
        type: t, goal: goal, enemyRate: enemyRate, enemyHp: enemyHp, enemySpeed: enemySpeed,
        starRate: starRate, bossHp: 140 + w * 90, desc: desc,
      });
    }
  }
  return arr;
})();
