// 60 missions across 6 worlds (10 each). Last mission of each world is a boss.
// world: 0 Desert · 1 Jungle · 2 Snow · 3 Cyber
window.WORLDS = [
  { id: 0, name: "Desert River", boss: "Sandstorm Colossus", story: "The Eclipse fleet crossed the border at dawn. Hold the river." },
  { id: 1, name: "Green Jungle", boss: "Viper Carrier", story: "Their factories hide under the canopy. Burn them out." },
  { id: 2, name: "Snow Mountain", boss: "Glacier Fortress", story: "Follow the supply line over the frozen peaks." },
  { id: 3, name: "Cyber City", boss: "Neon Overlord", story: "The capital has fallen. Take back its skyline." },
  { id: 4, name: "Volcano Rift", boss: "Magma Titan", story: "The fleet draws power from the rift. Cut it off." },
  { id: 5, name: "Eclipse Orbit", boss: "The Eclipse Core", story: "One target remains, above the sky itself." },
];
window.MISSIONS = (function () {
  const pattern = ["kill", "stars", "kill", "survive", "kill", "stars", "kill", "survive", "kill", "boss"];
  const arr = [];
  for (let w = 0; w < 6; w++) {
    for (let i = 0; i < 10; i++) {
      const idx = w * 10 + i, id = idx + 1, t = pattern[i];
      const enemyHp = [1, 2, 3, 4, 5, 6][w] + (i >= 5 ? 1 : 0);
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
        starRate: starRate, bossHp: w === 5 ? 1500 : 140 + w * 90, bossName: window.WORLDS[w].boss, final: idx === 59, desc: desc,
      });
    }
  }
  return arr;
})();
