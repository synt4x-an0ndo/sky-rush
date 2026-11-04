#!/usr/bin/env python3
"""Sky Rush terrain generator: long, seamless, non-repeating world maps split into chunks.

Usage: gen_terrain.py OUT_DIR [--chunks N] [--worlds 0,1,..] [--only-chunk K] [--jobs J]
Every chunk joins the next one exactly, and the last joins the first.
"""
import argparse
import math
import os
from concurrent.futures import ProcessPoolExecutor

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H = 1440, 2880
QUALITY = 96

WORLDS = [
    dict(name="desert", low=(150, 104, 54), mid=(214, 170, 96), high=(244, 216, 158), wet=(186, 140, 80),
         river=((22, 44, 88), (40, 92, 140), (92, 170, 190)), bank=(120, 92, 66), stamp="rock", relief=1.0),
    dict(name="jungle", low=(18, 62, 30), mid=(44, 112, 46), high=(112, 166, 66), wet=(14, 74, 50),
         river=((10, 50, 50), (22, 96, 82), (70, 170, 130)), bank=(70, 62, 40), stamp="tree", relief=1.25),
    dict(name="snow", low=(150, 172, 200), mid=(214, 226, 240), high=(252, 254, 255), wet=(176, 200, 226),
         river=((26, 84, 124), (72, 150, 190), (190, 232, 245)), bank=(112, 130, 150), stamp="pine", relief=1.5),
    dict(name="cyber", low=(10, 14, 28), mid=(22, 30, 54), high=(44, 58, 92), wet=(14, 24, 48),
         river=((4, 26, 52), (6, 90, 130), (40, 230, 255)), bank=(50, 60, 96), stamp="tower", relief=0.5),
    dict(name="volcano", low=(20, 14, 16), mid=(58, 40, 40), high=(112, 84, 74), wet=(40, 22, 22),
         river=((170, 30, 6), (250, 110, 12), (255, 226, 110)), bank=(30, 20, 20), stamp="basalt", relief=1.7),
    dict(name="orbit", low=(4, 5, 16), mid=(16, 14, 44), high=(62, 34, 96), wet=(8, 34, 66),
         river=((8, 8, 30), (20, 22, 66), (70, 90, 170)), bank=(14, 12, 34), stamp="asteroid", relief=0.0),
]

_tables = {}


def table(seed, rows, cols):
    key = (seed, rows, cols)
    if key not in _tables:
        _tables.clear() if len(_tables) > 24 else None
        _tables[key] = np.random.default_rng(seed).random((rows, cols), dtype=np.float32)
    return _tables[key]


def noise(xs, ys, wavelength, total_h, seed):
    """Smooth value noise, periodic across the whole world height and the map width."""
    cols, rows = max(2, round(W / wavelength)), max(2, round(total_h / wavelength))
    t = table(seed, rows, cols)
    fx, fy = xs * cols / W, ys * rows / total_h
    ix, iy = np.floor(fx).astype(int), np.floor(fy).astype(int)
    ax, ay = fx - ix, fy - iy
    ax, ay = ax * ax * (3 - 2 * ax), ay * ay * (3 - 2 * ay)
    x0, x1 = ix % cols, (ix + 1) % cols
    y0, y1 = iy % rows, (iy + 1) % rows
    top = t[np.ix_(y0, x0)] * (1 - ax) + t[np.ix_(y0, x1)] * ax
    bot = t[np.ix_(y1, x0)] * (1 - ax) + t[np.ix_(y1, x1)] * ax
    return top * (1 - ay)[:, None] + bot * ay[:, None]


def fbm(xs, ys, wavelength, octaves, total_h, seed, gain=0.52):
    out, amp, norm = 0.0, 1.0, 0.0
    for o in range(octaves):
        out = out + noise(xs, ys, max(3.0, wavelength / 2 ** o), total_h, seed + o * 101) * amp
        norm += amp
        amp *= gain
    return out / norm


def channel(y, total_h):
    """River centre and half-width at world row y; periodic, so the map loops."""
    p = 2 * np.pi * y / total_h
    centre = W / 2 + 190 * np.sin(p * 3) + 90 * np.sin(p * 7 + 1.3) + 46 * np.sin(p * 13 + 0.4)
    half = 170 + 70 * np.sin(p * 5 + 2.0) + 34 * np.sin(p * 11)
    return centre, half


def ramp(v, a, b, c):
    a, b, c = (np.array(k, dtype=np.float32) for k in (a, b, c))
    v = np.clip(v, 0, 1)[..., None]
    lo = np.clip(v * 2, 0, 1)
    hi = np.clip(v * 2 - 1, 0, 1)
    return a * (1 - lo) + b * lo + (c - b) * hi


def world_stamps(world, chunks):
    """Scene objects are placed in world space so one crossing a seam is drawn in both chunks."""
    total = H * chunks
    rng = np.random.default_rng(9000 + world)
    out = []
    for _ in range(chunks * 150):
        y = float(rng.random() * total)
        c, hw = channel(np.array([y]), total)
        side = 1 if rng.random() < 0.5 else -1
        x = float(c[0] + side * (hw[0] + 50 + rng.random() * 760))
        if -60 < x < W + 60:
            out.append((x, y, 26 + float(rng.random()) * 62, int(rng.integers(1 << 30))))
    return out


def draw_stamp(kind, d, x, y, s, seed):
    r = np.random.default_rng(seed)

    def blob(cx, cy, rad, col):
        d.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=col)

    if kind == "tree":
        blob(x + s * .3, y + s * .35, s, (0, 16, 4, 110))
        for _ in range(9):
            a, q = r.random() * 6.28, r.random() * s * .65
            g = int(70 + r.random() * 90)
            blob(x + math.cos(a) * q, y + math.sin(a) * q, s * (.28 + r.random() * .3), (int(g * .45), g, int(g * .35), 255))
    elif kind == "pine":
        d.ellipse([x - s * .2, y + s * .2, x + s * 1.2, y + s * .7], fill=(60, 84, 120, 90))
        for i in range(4):
            q = s * (1 - i * .22)
            yy = y - i * s * .3
            d.polygon([(x, yy - q), (x + q * .7, yy + q * .5), (x - q * .7, yy + q * .5)], fill=(20 + i * 8, 62 + i * 12, 54 + i * 8, 255))
        d.polygon([(x, y - s * 1.75), (x + s * .3, y - s * 1.1), (x - s * .3, y - s * 1.1)], fill=(244, 250, 255, 255))
    elif kind == "tower":
        w, h = s * (.8 + r.random()), s * (.8 + r.random())
        d.rectangle([x - w + s * .3, y - h + s * .3, x + w + s * .3, y + h + s * .3], fill=(0, 0, 0, 130))
        base = int(24 + r.random() * 26)
        d.rectangle([x - w, y - h, x + w, y + h], fill=(base, base + 8, base + 26, 255), outline=(60, 120, 170, 255))
        neon = [(40, 230, 255, 255), (255, 60, 210, 255), (255, 210, 70, 255)][int(r.integers(3))]
        for yy in np.arange(y - h + 8, y + h - 6, 13):
            for xx in np.arange(x - w + 7, x + w - 6, 13):
                if r.random() < .5:
                    d.rectangle([xx, yy, xx + 6, yy + 5], fill=neon if r.random() < .5 else (90, 110, 150, 255))
    elif kind == "asteroid":
        pts = [(x + math.cos(a) * s * (.6 + r.random() * .55), y + math.sin(a) * s * (.6 + r.random() * .55)) for a in np.linspace(0, 6.28, 13)[:-1]]
        d.polygon(pts, fill=(74, 68, 84, 255))
        for _ in range(6):
            a, q, cr = r.random() * 6.28, r.random() * s * .6, s * (.08 + r.random() * .14)
            blob(x + math.cos(a) * q, y + math.sin(a) * q, cr, (40, 36, 50, 255))
    else:  # rock and basalt
        col = (66, 44, 44) if kind == "basalt" else (128, 102, 76)
        d.ellipse([x - s * .7, y, x + s * 1.2, y + s * .85], fill=(0, 0, 0, 90))
        pts = [(x + math.cos(a) * s * (.5 + r.random() * .5), y + math.sin(a) * s * (.5 + r.random() * .4)) for a in np.linspace(0, 6.28, 10)[:-1]]
        d.polygon(pts, fill=col + (255,))
        d.polygon([(a, b) for a, b in pts if b < y], fill=tuple(min(255, c + 34) for c in col) + (255,))


def render_chunk(world, k, chunks, out_dir):
    cfg = WORLDS[world]
    total = H * chunks
    pad = 2
    ys = np.arange(k * H - pad, k * H + H + pad, dtype=np.float64) % total
    xs = np.arange(W, dtype=np.float64)
    s = world * 1000 + 17
    h = fbm(xs, ys, 560, 7, total, s)
    fine = fbm(xs, ys, 26, 3, total, s + 500)
    moist = fbm(xs, ys, 780, 4, total, s + 700)
    ridge = 1 - np.abs(2 * fbm(xs, ys, 210, 4, total, s + 900) - 1)
    c, hw = channel(ys, total)
    dist = np.abs(xs[None, :] - c[:, None]) - hw[:, None]
    bank = np.clip(1 - np.abs(dist) / 34, 0, 1)
    land = np.clip((h - .5) * 2.3 + .5 + (ridge - .5) * .42 + (fine - .5) * .24, 0, 1)
    rgb = ramp(land, cfg["low"], cfg["mid"], cfg["high"])
    wet = np.clip((moist - .52) * 3.2, 0, .7)[..., None]
    rgb = rgb * (1 - wet) + np.array(cfg["wet"], np.float32) * wet
    if cfg["name"] == "desert":  # wind-carved dunes
        rgb = rgb * (1 + .13 * np.sin(ys[:, None] / 13 + xs[None, :] / 40 + h * 34))[..., None]
    if cfg["name"] == "cyber":  # street grid with lit traffic lanes
        grid = (np.mod(xs[None, :] + 40 * np.floor(ys[:, None] / 720), 240) < 5) | (np.mod(ys, 240)[:, None] < 5)
        rgb[grid] = np.array((30, 110, 150), np.float32)
    height = land * 90 * cfg["relief"] + np.clip(dist, -60, 40) * .7
    gy, gx = np.gradient(height)
    shade = np.clip(1 + (gx * -.62 + gy * -.62) * .13, .42, 1.55)[..., None]
    if cfg["name"] != "orbit":
        rgb = rgb * shade
    ripples = fbm(xs, ys, 46, 3, total, s + 1200)
    depth = np.clip(-dist / hw[:, None], 0, 1)
    water = ramp(np.clip(1 - depth + (ripples - .5) * .95, 0, 1), *cfg["river"])
    if cfg["name"] == "volcano":
        water = ramp(np.clip(.28 + (ripples - .42) * 2.6, 0, 1), *cfg["river"])
    mask = np.clip(-dist / 4, 0, 1)[..., None]
    rgb = rgb * (1 - mask) + water * mask
    bank_mask = (bank * (dist > -6) * .9)[..., None]
    rgb = rgb * (1 - bank_mask) + np.array(cfg["bank"], np.float32) * shade * bank_mask * (.74 + fine[..., None] * .52)
    if cfg["name"] == "volcano":  # heat glow beside lava
        rgb = rgb + np.array((190, 58, 8), np.float32) * (np.clip(1 - np.maximum(dist, 0) / 120, 0, 1) ** 2.2)[..., None] * .55
    if cfg["name"] == "orbit":
        nebula = np.clip((moist - .42) * 2.1, 0, 1)[..., None] * np.clip((fine * .3 + h * .9), 0, 1)[..., None]
        rgb = rgb + np.array((96, 46, 150), np.float32) * nebula
        star_rng = np.random.default_rng(55000 + k)
        sx, sy = star_rng.integers(0, W, 2600), star_rng.integers(pad, H + pad, 2600)
        rgb[sy, sx] = np.maximum(rgb[sy, sx], star_rng.uniform(110, 255, (2600, 1)))
    grain = np.random.default_rng(world * 4096 + k).normal(0, 3.6, rgb.shape[:2])[..., None]
    rgb = np.clip(rgb + grain, 0, 255).astype(np.uint8)[pad:-pad]
    img = Image.fromarray(rgb, "RGB").convert("RGBA")
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for x, y, size, seed in world_stamps(world, chunks):
        rel = y - k * H
        if rel < -200:
            rel += total
        if rel > H + 200:
            rel -= total
        if -200 <= rel <= H + 200:
            draw_stamp(cfg["stamp"], d, x, rel, size, seed)
    img = Image.alpha_composite(img, layer.filter(ImageFilter.GaussianBlur(.6))).convert("RGB")
    path = os.path.join(out_dir, "terrain", cfg["name"])
    os.makedirs(path, exist_ok=True)
    name = os.path.join(path, f"{k:02d}.webp")
    img.save(name, "WEBP", quality=QUALITY, method=4)
    return os.path.getsize(name)


def main():
    a = argparse.ArgumentParser()
    a.add_argument("out")
    a.add_argument("--chunks", type=int, default=16)
    a.add_argument("--worlds", default="0,1,2,3,4,5")
    a.add_argument("--only-chunk", type=int)
    a.add_argument("--jobs", type=int, default=2)
    o = a.parse_args()
    jobs = []
    for w in map(int, o.worlds.split(",")):
        for k in ([o.only_chunk] if o.only_chunk is not None else range(o.chunks)):
            jobs.append((w, k, o.chunks, o.out))
    with ProcessPoolExecutor(o.jobs) as ex:
        sizes = list(ex.map(render_chunk, *zip(*jobs)))
    print(f"{len(sizes)} chunks, {sum(sizes) / 1e6:.1f} MB, avg {sum(sizes) / len(sizes) / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
