// 20 missions — gradually harder
// type: "kill" (destroy enemies), "stars" (collect stars), "survive" (last for time), "boss"
window.MISSIONS = [
  { id: 1,  name: "First Flight",     type: "kill",    goal: 8,   enemyRate: 1.6, enemyHp: 1, enemySpeed: 7,  starRate: 2.2, desc: "Destroy 8 enemies" },
  { id: 2,  name: "Desert Skies",     type: "stars",   goal: 15,  enemyRate: 1.5, enemyHp: 1, enemySpeed: 7,  starRate: 1.4, desc: "Collect 15 stars" },
  { id: 3,  name: "First Swarm",      type: "kill",    goal: 14,  enemyRate: 1.3, enemyHp: 1, enemySpeed: 8,  starRate: 2.2, desc: "Destroy 14 enemies" },
  { id: 4,  name: "Hold the Line",    type: "survive", goal: 30,  enemyRate: 1.2, enemyHp: 1, enemySpeed: 8,  starRate: 2.0, desc: "Survive 30 seconds" },
  { id: 5,  name: "The Canyon",       type: "kill",    goal: 20,  enemyRate: 1.1, enemyHp: 2, enemySpeed: 8,  starRate: 2.2, desc: "Destroy 20 enemies" },
  { id: 6,  name: "Star Rain",        type: "stars",   goal: 25,  enemyRate: 1.1, enemyHp: 2, enemySpeed: 9,  starRate: 1.1, desc: "Collect 25 stars" },
  { id: 7,  name: "Hard Resistance",  type: "kill",    goal: 26,  enemyRate: 1.0, enemyHp: 2, enemySpeed: 9,  starRate: 2.2, desc: "Destroy 26 enemies" },
  { id: 8,  name: "Eye of the Storm", type: "survive", goal: 40,  enemyRate: 0.9, enemyHp: 2, enemySpeed: 9,  starRate: 2.0, desc: "Survive 40 seconds" },
  { id: 9,  name: "Warrior's Path",   type: "kill",    goal: 32,  enemyRate: 0.9, enemyHp: 2, enemySpeed: 10, starRate: 2.2, desc: "Destroy 32 enemies" },
  { id: 10, name: "Halfway",          type: "kill",    goal: 38,  enemyRate: 0.8, enemyHp: 3, enemySpeed: 10, starRate: 2.2, desc: "Destroy 38 enemies" },
  { id: 11, name: "Iron Sky",         type: "stars",   goal: 35,  enemyRate: 0.8, enemyHp: 3, enemySpeed: 10, starRate: 1.0, desc: "Collect 35 stars" },
  { id: 12, name: "Endless Battle",   type: "kill",    goal: 44,  enemyRate: 0.75,enemyHp: 3, enemySpeed: 11, starRate: 2.2, desc: "Destroy 44 enemies" },
  { id: 13, name: "Long Night",       type: "survive", goal: 50,  enemyRate: 0.7, enemyHp: 3, enemySpeed: 11, starRate: 2.0, desc: "Survive 50 seconds" },
  { id: 14, name: "Line of Fire",     type: "kill",    goal: 50,  enemyRate: 0.7, enemyHp: 3, enemySpeed: 11, starRate: 2.2, desc: "Destroy 50 enemies" },
  { id: 15, name: "Last Frontier",    type: "kill",    goal: 56,  enemyRate: 0.65,enemyHp: 4, enemySpeed: 12, starRate: 2.2, desc: "Destroy 56 enemies" },
  { id: 16, name: "Sea of Stars",     type: "stars",   goal: 50,  enemyRate: 0.65,enemyHp: 4, enemySpeed: 12, starRate: 0.9, desc: "Collect 50 stars" },
  { id: 17, name: "Steel Storm",      type: "kill",    goal: 62,  enemyRate: 0.6, enemyHp: 4, enemySpeed: 12, starRate: 2.2, desc: "Destroy 62 enemies" },
  { id: 18, name: "Final Test",       type: "survive", goal: 60,  enemyRate: 0.55,enemyHp: 4, enemySpeed: 13, starRate: 2.0, desc: "Survive 60 seconds" },
  { id: 19, name: "King of Darkness", type: "kill",    goal: 70,  enemyRate: 0.5, enemyHp: 5, enemySpeed: 13, starRate: 2.2, desc: "Destroy 70 enemies" },
  { id: 20, name: "The Great War (Boss)", type: "boss", goal: 1, enemyRate: 0.8, enemyHp: 5, enemySpeed: 13, starRate: 2.0, bossHp: 120, desc: "Defeat the final boss" },
];
