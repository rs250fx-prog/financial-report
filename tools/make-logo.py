# -*- coding: utf-8 -*-
"""
Organization スキーマ用のロゴ画像（512x512）を生成する。

OG画像（1200x630）は共有時のバナーであって、ロゴではない。
schema.org の Organization.logo は組織のロゴとして扱われるため、
正方形に近い専用画像を別に用意する。

    python tools/make-logo.py
"""
from PIL import Image, ImageDraw, ImageFont

S = 512
BG = (247, 245, 240)      # --bg
INK = (28, 27, 24)        # --ink
ACCENT = (43, 76, 140)    # --accent

LATIN = "C:/Windows/Fonts/segoeuib.ttf"

img = Image.new("RGB", (S, S), BG)
d = ImageDraw.Draw(img)

# favicon と同じ「観測された値動き」のグリフ。
# 定点観測という媒体名に対応させている。
pts = [(126, 300), (212, 204), (283, 255), (399, 126)]
d.line(pts, fill=INK, width=22, joint="curve")
for p in pts[:-1]:
    d.ellipse([p[0] - 11, p[1] - 11, p[0] + 11, p[1] + 11], fill=INK)
# 終点だけアクセント色。最新の観測点を表す
d.ellipse([399 - 26, 126 - 26, 399 + 26, 126 + 26], fill=ACCENT)

# ワードマーク
f = ImageFont.truetype(LATIN, 62)
text, track = "TEITEN", 13
w = sum(d.textlength(c, font=f) for c in text) + track * (len(text) - 1)
x = (S - w) / 2
for ch in text:
    d.text((x, 370), ch, font=f, fill=INK)
    x += d.textlength(ch, font=f) + track

img.save("public/logo.png", "PNG", optimize=True)
print("public/logo.png", img.size)
