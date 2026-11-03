// data.js — aircraft catalog (12), save system & economy for Sky Rush.
// Loaded before game2d.js. Exposes window.PLANES, window.UPGRADES, window.SAVE.
(function () {
  "use strict";

  // Each plane: base stats + a sprite palette. Stats are BASE; upgrades add on top.
  // dmg = damage per bullet, hp = max hull, speed = move responsiveness, fire = shots/sec.
  window.PLANES = [
    { id: 0,  name: "Basic Fighter",  price: 0,     rarity: "Common",    dmg: 1, hp: 100, speed: 12, fire: 6.0,  palette: { base: "#6f7e3e", dark: "#3f4a22", wing: "#58662e", camo: ["#4a5a28", "#8a9a50", "#6b7a3a", "#c9b878"], nose: "#c0392b" } },
    { id: 1,  name: "Green Falcon",   price: 500,   rarity: "Common",    dmg: 1, hp: 110, speed: 13, fire: 6.5,  palette: { base: "#2f8a4a", dark: "#17502a", wing: "#246e38", camo: ["#1f6e38", "#3fae5a", "#6ad07a"], nose: "#ffd23a" } },
    { id: 2,  name: "Blue Thunder",   price: 1000,  rarity: "Common",    dmg: 2, hp: 115, speed: 13, fire: 6.5,  palette: { base: "#2f66c0", dark: "#163a78", wing: "#2450a0", camo: ["#1f4e9e", "#3f82de", "#7ab0ff"], nose: "#ffffff" } },
    { id: 3,  name: "Desert Eagle",   price: 1800,  rarity: "Uncommon",  dmg: 2, hp: 125, speed: 14, fire: 7.0,  palette: { base: "#b79352", dark: "#6e5428", wing: "#9a7a40", camo: ["#8a6a3a", "#caa968", "#6a4f28"], nose: "#8a2b1a" } },
    { id: 4,  name: "Red Phantom",    price: 2500,  rarity: "Uncommon",  dmg: 3, hp: 130, speed: 15, fire: 7.2,  palette: { base: "#c0342f", dark: "#6e1816", wing: "#9e2824", camo: ["#9e2824", "#e05550", "#ff8a84"], nose: "#2a2a2a" } },
    { id: 5,  name: "Purple Shadow",  price: 3500,  rarity: "Rare",      dmg: 3, hp: 140, speed: 15, fire: 7.6,  palette: { base: "#7a3ab0", dark: "#45206a", wing: "#5e2e8a", camo: ["#5e2e8a", "#9a5ad0", "#c48aff"], nose: "#ffd23a" } },
    { id: 6,  name: "Golden Hawk",    price: 5000,  rarity: "Rare",      dmg: 4, hp: 150, speed: 16, fire: 8.0,  palette: { base: "#d9a62a", dark: "#8a6410", wing: "#bb8c1e", camo: ["#bb8c1e", "#f0c84a", "#fff0a0"], nose: "#8a2b1a" } },
    { id: 7,  name: "Night Hunter",   price: 7000,  rarity: "Epic",      dmg: 4, hp: 160, speed: 17, fire: 8.4,  palette: { base: "#2a2f3a", dark: "#12151c", wing: "#1f2430", camo: ["#1f2430", "#3a4253", "#55607a"], nose: "#36e0ff" } },
    { id: 8,  name: "Sky Dragon",     price: 10000, rarity: "Epic",      dmg: 5, hp: 175, speed: 17, fire: 8.8,  palette: { base: "#1aa0a0", dark: "#0c5858", wing: "#148080", camo: ["#148080", "#2fcfc0", "#8af0e0"], nose: "#ff4a4a" } },
    { id: 9,  name: "Thunder X",      price: 15000, rarity: "Legendary", dmg: 6, hp: 190, speed: 18, fire: 9.2,  palette: { base: "#394150", dark: "#1a1f29", wing: "#2b3240", camo: ["#2b3240", "#5a6a88", "#8ad0ff"], nose: "#ffd23a" } },
    { id: 10, name: "Phoenix",        price: 20000, rarity: "Legendary", dmg: 7, hp: 210, speed: 19, fire: 9.6,  palette: { base: "#e0541a", dark: "#8a2e08", wing: "#c04010", camo: ["#c04010", "#ff8a2a", "#ffd23a"], nose: "#ffffff" } },
    { id: 11, name: "Galaxy Fighter", price: 30000, rarity: "Mythic",    dmg: 9, hp: 240, speed: 20, fire: 10.5, palette: { base: "#5a2aa0", dark: "#2a1458", wing: "#7a3ad0", camo: ["#7a3ad0", "#b06aff", "#4affd0"], nose: "#ffe84a" } },
  ];

  // Upgrade config: each category has 10 levels; cost grows; effect per level.
  window.UPGRADES = {
    dmg:   { label: "Damage",    per: 0.6, base: 120, grow: 1.5 },
    fire:  { label: "Fire Rate", per: 0.5, base: 120, grow: 1.5 },
    hp:    { label: "Hull",      per: 18,  base: 120, grow: 1.5 },
    speed: { label: "Speed",     per: 0.8, base: 120, grow: 1.5 },
  };
  window.UPG_MAX = 10;

  // ----- Save system -----
  const KEY = "skyrush_save_v1";
  const DEFAULT = { coins: 0, stars: 0, owned: [0], equipped: 0, upg: {}, unlocked: 1, hi: 0, stats: { kills: 0, coins: 0 }, daily: { last: "", day: 0 } };
  const DAILY_REWARDS = [100, 150, 200, 300, 400, 600, 1000];
  const clone = (o) => JSON.parse(JSON.stringify(o));

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return clone(DEFAULT);
      const s = JSON.parse(raw);
      const out = Object.assign(clone(DEFAULT), s);
      out.stats = Object.assign({ kills: 0, coins: 0 }, s.stats || {});
      out.daily = Object.assign({ last: "", day: 0 }, s.daily || {});
      if (!Array.isArray(out.owned)) out.owned = [0];
      if (out.owned.indexOf(0) < 0) out.owned.push(0);
      return out;
    } catch (e) { return clone(DEFAULT); }
  }

  const state = load();

  window.SAVE = {
    get: () => state,
    persist() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} },
    addCoins(n) { state.coins += n; state.stats.coins += n; this.persist(); },
    spend(n) { if (state.coins >= n) { state.coins -= n; this.persist(); return true; } return false; },
    own(id) { if (state.owned.indexOf(id) < 0) state.owned.push(id); this.persist(); },
    has(id) { return state.owned.indexOf(id) >= 0; },
    equip(id) { if (this.has(id)) { state.equipped = id; this.persist(); } },
    upgLevel(id, cat) { return (state.upg[id] && state.upg[id][cat]) || 0; },
    setUpg(id, cat, lv) { if (!state.upg[id]) state.upg[id] = {}; state.upg[id][cat] = lv; this.persist(); },
    unlock(mission) { if (mission > state.unlocked) { state.unlocked = mission; this.persist(); } },
    setHi(v) { if (v > state.hi) { state.hi = v; this.persist(); } },
    stats(id) {
      const p = window.PLANES[id], u = state.upg[id] || {}, U = window.UPGRADES;
      return {
        dmg: p.dmg + (u.dmg || 0) * U.dmg.per,
        fire: p.fire + (u.fire || 0) * U.fire.per,
        hp: Math.round(p.hp + (u.hp || 0) * U.hp.per),
        speed: p.speed + (u.speed || 0) * U.speed.per,
      };
    },
    upgCost(cat, level) { const U = window.UPGRADES[cat]; return Math.round(U.base * Math.pow(U.grow, level)); },
    todayStr() { const d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); },
    canClaimDaily() { return state.daily.last !== this.todayStr(); },
    dailyDay() { return state.daily.day % 7; },
    dailyRewards() { return DAILY_REWARDS; },
    claimDaily() {
      if (!this.canClaimDaily()) return 0;
      const amt = DAILY_REWARDS[state.daily.day % 7];
      state.coins += amt; state.stats.coins += amt;
      state.daily.last = this.todayStr(); state.daily.day += 1;
      this.persist(); return amt;
    },
  };
})();
