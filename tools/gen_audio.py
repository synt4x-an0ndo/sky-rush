#!/usr/bin/env python3
"""Sky Rush soundtrack and SFX renderer. Usage: gen_audio.py OUT_DIR [--only NAME] [--quality Q]

Each track is composed from a seed, with intro, verse, breakdown and climax sections.
"""
import argparse
import os

import numpy as np
import soundfile as sf
from scipy.signal import lfilter, oaconvolve

SR = 44100
MINOR = [0, 2, 3, 5, 7, 8, 10]
PROGS = [[0, 5, 2, 6], [0, 3, 5, 4], [0, 6, 5, 6], [5, 6, 0, 0], [0, 2, 5, 4]]

# name, seconds, bpm, root midi, seed, intensity (0 calm .. 1 full), lead timbre
TRACKS = [("menu", 180, 92, 45, 1, .25, "sine")]
for i, (w, bpm, root) in enumerate([("desert", 128, 45), ("jungle", 134, 43), ("snow", 122, 50),
                                    ("cyber", 140, 41), ("volcano", 146, 40), ("orbit", 132, 47)]):
    TRACKS.append((f"play_{w}", 210, bpm, root, 10 + i, .7, "saw"))
    TRACKS.append((f"boss_{w}", 150, bpm + 22, root - 1, 30 + i, 1.0, "square"))
TRACKS += [("final_boss", 240, 174, 38, 50, 1.0, "saw"), ("victory", 120, 104, 48, 60, .45, "sine"),
           ("credits", 180, 96, 45, 61, .35, "sine"), ("gameover", 40, 70, 43, 62, .1, "sine")]


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def lowpass(x, cut):
    a = np.exp(-2 * np.pi * cut / SR)
    return lfilter([1 - a], [1, -a], x)


def tone(m, dur, kind, rng=None, cut=None, attack=.006, release=.08):
    n = int(dur * SR)
    t = np.arange(n, dtype=np.float32) / SR
    f = hz(m)
    if kind == "sine":
        y = np.sin(2 * np.pi * f * t) + .25 * np.sin(4 * np.pi * f * t)
    elif kind == "square":
        y = np.sign(np.sin(2 * np.pi * f * t)) * .6 + np.sin(2 * np.pi * f * 1.004 * t) * .4
    elif kind == "super":
        y = sum(2 * ((f * d * t + p) % 1) - 1 for d, p in zip((.993, .997, 1, 1.003, 1.007), rng.random(5))) / 3
    else:
        y = 2 * ((f * t) % 1) - 1
    if cut:
        y = lowpass(y, cut)
    env = np.minimum(1, t / attack) * np.minimum(1, (dur - t) / release)
    return (y * env).astype(np.float32)


def put(bus, pos, x, gain=1.0, pan=0.0):
    i = int(pos * SR)
    if i >= len(bus):
        return
    x = x[: len(bus) - i]
    bus[i: i + len(x), 0] += x * gain * (1 - max(pan, 0))
    bus[i: i + len(x), 1] += x * gain * (1 + min(pan, 0))


def drums(rng):
    def t(s):
        return np.arange(int(s * SR)) / SR
    kt = t(.24)
    kick = np.sin(2 * np.pi * (46 * kt + 11 * (1 - np.exp(-kt * 34)))) * np.exp(-kt * 15)
    st = t(.2)
    snare = (rng.normal(0, .55, len(st)) + np.sin(2 * np.pi * 190 * st)) * np.exp(-st * 20)
    ht = t(.05)
    n = rng.normal(0, 1, len(ht))
    hat = (n - lowpass(n, 6500)) * np.exp(-ht * 90)
    return [a.astype(np.float32) for a in (kick, snare, hat)]


def render(name, secs, bpm, root, seed, power, lead_kind, out, quality):
    rng = np.random.default_rng(seed)
    n = int(secs * SR)
    dry, wet = np.zeros((n, 2), np.float32), np.zeros((n, 2), np.float32)
    beat = 60 / bpm
    bar = beat * 4
    kick, snare, hat = drums(rng)
    motif = rng.integers(0, 7, 8)
    prog_a, prog_b = PROGS[seed % 5], PROGS[(seed + 2) % 5]
    bars = int(secs / bar)

    def note(d, oct_=0):
        return root + MINOR[d % 7] + 12 * (d // 7 + oct_)

    for b in range(bars):
        pos = b * bar
        part = b % 32
        section = "intro" if b < 8 else "break" if 16 <= part < 20 else "climax" if part >= 24 else "verse"
        prog = prog_b if (b // 16) % 2 else prog_a
        d = prog[b % 4]
        chord = [note(d, 1), note(d + 2, 1), note(d + 4, 1)]
        pad_gain = .05 + .05 * (section == "break")
        for m in chord:
            put(wet, pos, tone(m, bar * 1.02, "super", rng, 900 + 2400 * power, .04, .15), pad_gain, float(rng.uniform(-.4, .4)))
        if section != "break" and (power > .2 or b % 2 == 0):
            steps = 8 if power > .5 else 4
            for s in range(steps):
                put(dry, pos + s * bar / steps, tone(note(d) - 12, bar / steps * .85, "saw", cut=320 + 700 * power, release=.03), .22 * (.45 + power * .55))
        if section in ("verse", "climax"):
            for s in range(16):
                m = chord[(s * (seed % 3 + 1)) % 3] + 12
                put(wet, pos + s * bar / 16, tone(m, bar / 16, "saw", cut=3000, attack=.002, release=.05), .035 + .02 * power, .5 if s % 2 else -.5)
        if section == "climax" or (section == "verse" and b % 8 >= 4) or power < .5:
            var = (b // 8) % 3
            for s in range(8):
                if (motif[s] + var) % 4 == 3:
                    continue
                m = note(d + int(motif[s]) + var, 2)
                put(wet, pos + s * bar / 8, tone(m, bar / 8 * 1.3, lead_kind, cut=5200, release=.05), .075 if lead_kind != "sine" else .11)
        if power > .2 and section not in ("intro", "break"):
            for s in range(16):
                t = pos + s * bar / 16
                if s % 4 == 0:
                    put(dry, t, kick, .75 * power + .1)
                if s % 8 == 4:
                    put(dry, t, snare, .34 * power + .05)
                if s % 2 == 0 or power > .8:
                    put(dry, t, hat, .13, .25)
        elif section == "intro" and power > .2 and b % 2:
            put(dry, pos, kick, .45)
    ir_t = np.arange(int(2.2 * SR)) / SR
    irr = np.random.default_rng(seed + 1)
    for ch in (0, 1):
        ir = (irr.normal(0, 1, len(ir_t)) * np.exp(-ir_t * 3.1)).astype(np.float32)
        ir /= np.sqrt((ir ** 2).sum())
        dry[:, ch] += wet[:, ch] + oaconvolve(wet[:, ch], ir)[:n] * .55
    del wet
    fade = np.ones(n, np.float32)
    k = int(SR * 1.5)
    fade[-k:] = np.linspace(1, 0, k)
    dry *= fade[:, None]
    dry = np.tanh(dry / max(1e-6, np.percentile(np.abs(dry), 99.9)) * 1.05) * .92
    os.makedirs(os.path.join(out, "music"), exist_ok=True)
    path = os.path.join(out, "music", name + ".ogg")
    with sf.SoundFile(path, "w", SR, 2, format="OGG", subtype="VORBIS", compression_level=1 - quality) as f:
        for i in range(0, n, 16384):  # large single writes crash libsndfile's Vorbis encoder
            f.write(dry[i:i + 16384])
    print(name, f"{os.path.getsize(path) / 1e6:.1f} MB", flush=True)


def sfx(out):
    os.makedirs(os.path.join(out, "sfx"), exist_ok=True)
    rng = np.random.default_rng(7)

    def save(name, y):
        y = np.asarray(y, np.float32)
        y = y / max(1e-6, np.abs(y).max()) * .9
        sf.write(os.path.join(out, "sfx", name + ".ogg"), y, SR, format="OGG", subtype="VORBIS")

    def T(s):
        return np.arange(int(s * SR)) / SR

    for i, (s, base) in enumerate([(.09, 1500), (.1, 1100), (.12, 800)]):
        t = T(s)
        save(f"shot{i}", np.sin(2 * np.pi * np.cumsum(base * np.exp(-t * 16) + 200) / SR) * np.exp(-t * 34) + lowpass(rng.normal(0, .3, len(t)), 5000) * np.exp(-t * 50))
    for i, s in enumerate((.6, 1.1, 2.6, 5.5)):  # small, medium, large, final-boss
        t = T(s)
        rumble = lowpass(rng.normal(0, 1, len(t)), 1400 / (i + 1)) * np.exp(-t * 5.5 / s)
        save(f"boom{i}", rumble + np.sin(2 * np.pi * (70 - i * 10) * t) * np.exp(-t * 7 / s))
    t = T(.07); save("hit", np.sin(2 * np.pi * 620 * t) * np.exp(-t * 60) + rng.normal(0, .25, len(t)) * np.exp(-t * 90))
    t = T(.4); save("hurt", np.sign(np.sin(2 * np.pi * (240 - 300 * t) * t)) * np.exp(-t * 7))
    t = T(.13); save("coin", np.sin(2 * np.pi * np.where(t < .05, 1320, 1760) * t) * np.exp(-t * 18))
    t = T(.2); save("star", sum(np.sin(2 * np.pi * f * t) for f in (1320, 1660, 1980)) * np.exp(-t * 14))
    t = T(.5); save("power", np.sin(2 * np.pi * (500 + 1500 * t) * t) * np.exp(-t * 4))
    t = T(.6); save("shield", np.sin(2 * np.pi * (240 + 700 * t) * t) * (.5 + .5 * np.sin(2 * np.pi * 22 * t)) * np.exp(-t * 3))
    t = T(1.5); save("bomb", lowpass(rng.normal(0, 1, len(t)), 1800) * np.exp(-t * 2.4) + np.sin(2 * np.pi * (180 - 90 * t) * t) * np.exp(-t * 2))
    t = T(2.4); save("alarm", np.sign(np.sin(2 * np.pi * (520 + 180 * np.sin(2 * np.pi * 1.6 * t)) * t)) * np.minimum(1, (2.4 - t) * 3))
    t = T(.1); save("click", np.sin(2 * np.pi * 900 * t) * np.exp(-t * 50))


def main():
    a = argparse.ArgumentParser()
    a.add_argument("out")
    a.add_argument("--only")
    a.add_argument("--quality", type=float, default=.9)
    o = a.parse_args()
    sfx(o.out)
    for tr in TRACKS:
        if not o.only or tr[0] == o.only:
            render(*tr, o.out, o.quality)


if __name__ == "__main__":
    main()
