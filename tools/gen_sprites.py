#!/usr/bin/env python3
"""Renders aircraft, bosses, explosions, clouds and world art. Usage: gen_sprites.py OUT_DIR REPO_DIR

Aircraft are drawn as silhouettes, inflated into a height field and lit, so they have real bevels.
All sprites point nose-up.
"""
import os
import re
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as ndi

SS = 2  # supersampling


def hexrgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def shape(size, polys, ellipses=()):
    w, h = size
    im = Image.new("L", (w * SS, h * SS), 0)
    d = ImageDraw.Draw(im)
    for p in polys:
        for sx in (1, -1):  # aircraft are symmetric about the centre line
            d.polygon([((w / 2 + sx * x) * SS, y * SS) for x, y in p], fill=255)
    for cx, cy, rx, ry in ellipses:
        for sx in (1, -1):
            d.ellipse([(w / 2 + sx * cx - rx) * SS, (cy - ry) * SS, (w / 2 + sx * cx + rx) * SS, (cy + ry) * SS], fill=255)
    return np.asarray(im) > 127


def lit(mask, base, seed, panel=56, camo=None, glow=()):
    """mask: bool at SS resolution. base: rgb. Returns an RGBA image at final resolution."""
    rng = np.random.default_rng(seed)
    dist = ndi.distance_transform_edt(mask)
    height = np.sqrt(np.minimum(dist, 46) * 46)
    height = ndi.gaussian_filter(height, 2.0)
    gy, gx = np.gradient(height)
    nz = 1 / np.sqrt(gx * gx + gy * gy + 1)
    nx, ny = -gx * nz, -gy * nz
    lx, ly, lz = -.45, -.55, .7
    diff = np.clip(nx * lx + ny * ly + nz * lz, 0, 1)
    spec = np.clip(nx * lx * 2 * nz + ny * ly * 2 * nz + (2 * nz * nz - 1) * lz, 0, 1) ** 26
    rgb = np.ones(mask.shape + (3,), np.float32) * np.array(base, np.float32)
    if camo:
        small = rng.random((mask.shape[0] // 44 + 2, mask.shape[1] // 44 + 2))
        idx = ndi.zoom(small, 44, order=1)[: mask.shape[0], : mask.shape[1]]
        for i, col in enumerate(camo):
            band = (idx > .34 + i * .15) & (idx < .42 + i * .15)
            rgb[band] = np.array(col, np.float32)
    rows, cols = np.indices(mask.shape)
    seams = (rows % (panel * SS) < 2) | (cols % (panel * SS) < 2)
    rivets = (rows % (panel * SS // 4) < 2) & (cols % (panel * SS // 4) < 2)
    rgb[seams] *= .68
    rgb[rivets] *= .8
    grime = ndi.gaussian_filter(rng.normal(0, 1, mask.shape), 9)
    rgb *= (1 + grime / max(1e-6, grime.std()) * .07)[..., None]
    rgb = rgb * (.34 + diff[..., None] * .95) + spec[..., None] * 170
    for cx, cy, r, col in glow:
        yy, xx = rows - cy * SS, cols - cx * SS
        q = np.clip(1 - np.sqrt(xx * xx + yy * yy) / (r * SS), 0, 1) ** 1.6
        rgb += q[..., None] * np.array(col, np.float32)
    alpha = ndi.gaussian_filter(mask.astype(np.float32), .8) * 255
    out = np.dstack([np.clip(rgb, 0, 255), alpha]).astype(np.uint8)
    im = Image.fromarray(out, "RGBA")
    return im.resize((mask.shape[1] // SS, mask.shape[0] // SS), Image.LANCZOS)


# Half-outlines in (offset from centre, y) on a 480x600 canvas, one per plane-silhouette family.
FAMILY = [
    dict(body=[(0, 16), (26, 110), (34, 470), (20, 560), (0, 560)], wing=[(30, 215), (226, 400), (220, 438), (30, 372)], tail=[(26, 450), (106, 548), (96, 570), (20, 520)]),
    dict(body=[(0, 8), (22, 90), (30, 480), (16, 570), (0, 570)], wing=[(28, 280), (232, 330), (232, 372), (28, 410)], tail=[(24, 490), (118, 526), (112, 556), (20, 552)]),
    dict(body=[(0, 22), (34, 130), (42, 450), (28, 552), (0, 552)], wing=[(36, 160), (236, 448), (214, 470), (36, 410)], tail=[(32, 440), (86, 568), (66, 576), (26, 540)]),
    dict(body=[(0, 4), (18, 120), (28, 500), (22, 582), (0, 582)], wing=[(26, 300), (236, 250), (238, 292), (28, 392)], tail=[(22, 500), (96, 566), (84, 586), (18, 566)]),
]
CANOPY = (0, 165, 15, 50)


def plane(pal, i):
    fam = FAMILY[i % len(FAMILY)]
    mask = shape((480, 600), [fam["body"], fam["wing"], fam["tail"]])
    base = hexrgb(pal["base"])
    camo = [hexrgb(c) for c in pal["camo"]]
    engines = [(240 + s * 16, 572, 26, (255, 150, 50)) for s in (-1, 1)]
    im = lit(mask, base, 100 + i, camo=camo, glow=engines)
    canopy = lit(shape((480, 600), [], [CANOPY]), (24, 44, 70), 7, panel=500, glow=[(232, 138, 18, (120, 180, 230))])
    im.alpha_composite(canopy)
    d = ImageDraw.Draw(im)
    nose = hexrgb(pal["nose"])
    d.polygon([(240, 18), (250, 56), (230, 56)], fill=nose + (255,))
    for s in (-1, 1):
        cx = 240 + s * 120
        d.ellipse([cx - 21, 330, cx + 21, 372], fill=(28, 63, 138, 255))
        d.ellipse([cx - 13, 338, cx + 13, 364], fill=(232, 237, 242, 255))
        d.ellipse([cx - 6, 345, cx + 6, 357], fill=(192, 57, 43, 255))
    return im


ENEMY_TINTS = [((150, 66, 52), (98, 88, 72)), ((54, 96, 44), (150, 120, 40)), ((94, 122, 150), (210, 224, 236)),
               ((30, 46, 86), (40, 210, 240)), ((96, 28, 22), (240, 110, 30)), ((70, 40, 120), (130, 240, 210))]
ENEMY_SHAPES = [
    dict(size=(240, 260), polys=[[(0, 8), (22, 70), (24, 230), (0, 250)], [(20, 90), (112, 180), (106, 206), (20, 160)]], ell=[]),
    dict(size=(300, 280), polys=[[(0, 10), (34, 80), (34, 230), (0, 270)], [(30, 60), (146, 110), (146, 150), (30, 190)], [(30, 206), (90, 262), (30, 250)]], ell=[]),
    dict(size=(240, 240), polys=[[(0, 30), (40, 120), (0, 214)], [(30, 96), (112, 40), (110, 74), (36, 150)], [(30, 130), (112, 208), (110, 170), (36, 100)]], ell=[(0, 120, 40, 40)]),
    dict(size=(340, 300), polys=[[(0, 6), (50, 90), (56, 240), (0, 292)], [(50, 110), (166, 90), (166, 240), (50, 220)]], ell=[(100, 190, 34, 60)]),
]
BOSS = [
    dict(polys=[[(0, 40), (120, 140), (130, 620), (0, 720)], [(120, 200), (460, 360), (450, 470), (120, 460)], [(110, 520), (250, 680), (110, 640)]], ell=[(280, 400, 62, 120)]),
    dict(polys=[[(0, 20), (90, 240), (110, 660), (0, 740)], [(90, 240), (440, 180), (470, 300), (100, 460)], [(100, 480), (340, 600), (320, 680), (100, 600)]], ell=[(220, 300, 54, 90)]),
    dict(polys=[[(0, 60), (160, 240), (160, 560), (0, 720)], [(150, 280), (460, 80), (470, 200), (160, 460)], [(150, 480), (470, 660), (450, 720), (150, 590)]], ell=[(0, 380, 150, 150)]),
    dict(polys=[[(0, 10), (70, 180), (70, 690), (0, 750)], [(70, 140), (440, 280), (440, 340), (70, 300)], [(70, 400), (470, 520), (470, 580), (70, 560)]], ell=[(300, 310, 44, 44), (360, 550, 44, 44)]),
    dict(polys=[[(0, 30), (140, 150), (190, 590), (0, 740)], [(150, 200), (470, 470), (390, 560), (170, 500)], [(160, 540), (300, 730), (150, 660)]], ell=[(310, 470, 60, 60)]),
    dict(polys=[[(0, 0), (120, 110), (210, 400), (120, 680), (0, 760)], [(180, 240), (476, 100), (476, 240), (210, 400)], [(180, 560), (476, 700), (476, 560), (210, 400)]], ell=[(0, 380, 190, 190), (380, 400, 80, 80)]),
]
BOSS_COL = [(92, 66, 118), (52, 106, 52), (110, 146, 178), (34, 54, 92), (120, 40, 26), (70, 40, 130)]
BOSS_CORE = [(255, 70, 130), (170, 255, 80), (150, 230, 255), (40, 240, 255), (255, 170, 40), (210, 110, 255)]


def fire_sheet(path, seed, frames=36, size=170, cols=6, hue=(1.0, .6, .2)):
    """Offline particle simulation of one explosion, stored as a sprite sheet."""
    rng = np.random.default_rng(seed)
    n = 240
    ang = rng.random(n) * 6.283
    speed = rng.uniform(.15, 1, n) ** .6 * size * .44
    radius = rng.uniform(5, size * .13, n)
    sheet = np.zeros((size * (frames // cols), size * cols, 4), np.float32)
    yy, xx = np.indices((size, size))
    for f in range(frames):
        t = (f + 1) / frames
        ease = 1 - (1 - t) ** 3
        heat = np.zeros((size, size), np.float32)
        smoke = np.zeros((size, size), np.float32)
        for a, sp, r in zip(ang, speed, radius):
            cx, cy = size / 2 + np.cos(a) * sp * ease, size / 2 + np.sin(a) * sp * ease
            rr = r * (.7 + t * 1.3)
            x0, x1 = max(0, int(cx - rr)), min(size, int(cx + rr) + 1)
            y0, y1 = max(0, int(cy - rr)), min(size, int(cy + rr) + 1)
            if x0 >= x1 or y0 >= y1:
                continue
            q = np.clip(1 - np.hypot(xx[y0:y1, x0:x1] - cx, yy[y0:y1, x0:x1] - cy) / rr, 0, 1)
            heat[y0:y1, x0:x1] += q * q * .5
            smoke[y0:y1, x0:x1] += q * .22
        heat *= (1 - t) ** 1.6
        smoke = np.clip(smoke * np.clip(t * 2.2, 0, 1) * (1 - t) ** .8, 0, .75)
        h = np.clip(heat, 0, 1)
        col = np.stack([h ** .5 * hue[0], h ** 1 * hue[1], h ** 2 * hue[2]], -1) * 255
        col += (1 - h)[..., None] * 44
        a = np.clip(h * 1.6 + smoke, 0, 1)
        r, c = f // cols, f % cols
        sheet[r * size:(r + 1) * size, c * size:(c + 1) * size] = np.dstack([col, a * 255])
    Image.fromarray(np.clip(sheet, 0, 255).astype(np.uint8), "RGBA").save(path, "WEBP", quality=90, method=4)


def clouds(path, seed, tint=(255, 255, 255), W=1024, H=2048):
    rng = np.random.default_rng(seed)
    f = np.zeros((H, W), np.float32)
    for o in range(6):
        c = max(2, 3 * 2 ** o)
        grid = rng.random((c * 2, c))
        grid = np.vstack([grid, grid[:1]])  # loops vertically
        grid = np.hstack([grid, grid[:, :1]])
        z = ndi.zoom(grid, (H / (grid.shape[0] - 1), W / (grid.shape[1] - 1)), order=3)[:H, :W]
        f += z * .55 ** o
    f = (f - f.min()) / (f.max() - f.min())
    a = np.clip((f - .56) * 4.4, 0, 1) * 215
    arr = np.dstack([np.full((H, W), c, np.uint8) for c in tint] + [a.astype(np.uint8)])
    Image.fromarray(arr, "RGBA").save(path, "WEBP", quality=88, method=4)


def key_art(path, terrain_path, sprite, boss):
    bg = Image.open(terrain_path).convert("RGB").resize((1080, 2160)).crop((0, 280, 1080, 1880)).filter(ImageFilter.GaussianBlur(1.4))
    arr = np.asarray(bg, np.float32)
    h = arr.shape[0]
    vign = np.linspace(.3, 1, h // 2)
    arr[: h // 2] *= vign[:, None, None]
    arr[h // 2:] *= vign[::-1][:, None, None]
    bg = Image.fromarray(arr.clip(0, 255).astype(np.uint8)).convert("RGBA")
    b = boss.rotate(180).resize((760, 760))
    bg.alpha_composite(b, (160, 40))
    s = sprite.resize((340, 425))
    bg.alpha_composite(s, (370, 1040))
    bg.convert("RGB").save(path, "WEBP", quality=90, method=5)


def main():
    out, repo = sys.argv[1], sys.argv[2]
    for sub in ("planes", "enemies", "bosses", "fx", "clouds", "art"):
        os.makedirs(os.path.join(out, sub), exist_ok=True)
    src = open(os.path.join(repo, "www/js/data.js"), encoding="utf-8").read()
    pals = []
    for m in re.finditer(r'palette: \{ base: "(#\w+)", dark: "(#\w+)", wing: "(#\w+)", camo: \[([^\]]+)\], nose: "(#\w+)"', src):
        pals.append(dict(base=m[1], dark=m[2], wing=m[3], camo=re.findall(r"#\w+", m[4]), nose=m[5]))
    assert len(pals) == 12, len(pals)
    first = None
    for i, p in enumerate(pals):
        im = plane(p, i)
        first = first or im
        im.save(f"{out}/planes/{i:02d}.webp", "WEBP", quality=94, method=5)
    for w, (body, trim) in enumerate(ENEMY_TINTS):
        for t, e in enumerate(ENEMY_SHAPES):
            sw, sh = e["size"]
            im = lit(shape(e["size"], e["polys"], e["ell"]), body, w * 10 + t, panel=36, camo=[trim],
                     glow=[(sw / 2, sh * .55, 26, tuple(int(c * .9) for c in trim))])
            im.save(f"{out}/enemies/{w}_{t}.webp", "WEBP", quality=94, method=5)
    bosses = []
    for w, b in enumerate(BOSS):
        size = (960, 780)
        core = BOSS_CORE[w]
        im = lit(shape(size, b["polys"], b["ell"]), BOSS_COL[w], 500 + w, panel=64,
                 glow=[(480, 390, 110, core), (160, 400, 44, core), (800, 400, 44, core)])
        im.save(f"{out}/bosses/{w}.webp", "WEBP", quality=94, method=5)
        bosses.append(im)
    for i, hue in enumerate([(1, .6, .2), (1, .45, .1), (.5, .85, 1), (.8, .45, 1), (1, .85, .5), (.5, 1, .6)]):
        for size_i, size in enumerate((128, 220)):
            fire_sheet(f"{out}/fx/boom{i}_{size_i}.webp", 40 + i * 7 + size_i, size=size, hue=hue)
    for w, t in enumerate([(255, 244, 224), (232, 255, 236), (255, 255, 255), (150, 210, 255), (90, 70, 70), (190, 160, 255)]):
        for layer in range(2):
            clouds(f"{out}/clouds/{w}_{layer}.webp", 70 + w * 3 + layer, t)
    names = "desert jungle snow cyber volcano orbit".split()
    for w, n in enumerate(names):
        if not os.path.exists(f"{out}/terrain/{n}/00.webp"):
            print("skipping key art, terrain not ready:", n)
            continue
        key_art(f"{out}/art/{n}.webp", f"{out}/terrain/{n}/00.webp", first, bosses[w])
    print("sprites done")


if __name__ == "__main__":
    main()
