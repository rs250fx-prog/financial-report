# -*- coding: utf-8 -*-
"""
OG画像（1200x630）を生成する。配色は src/styles/global.css の
ライトテーマのトークンに合わせてある。

    python tools/make-og.py

媒体名やタグラインを変えたら、再実行して public/og-default.png を更新する。
"""
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
BG = (247, 245, 240)      # --bg
INK = (28, 27, 24)        # --ink
ACCENT = (43, 76, 140)    # --accent
LINE = (207, 202, 189)    # --line-2

LATIN = "C:/Windows/Fonts/segoeuib.ttf"
JP_BOLD = "C:/Windows/Fonts/YuGothB.ttc"
JP_MED = "C:/Windows/Fonts/YuGothM.ttc"

img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)

# 左端のアクセント帯
d.rectangle([0, 0, 14, H], fill=ACCENT)

def draw_tracked(draw, xy, text, font, fill, tracking=0):
    """字間を空けて描画し、描画後の総幅を返す"""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += draw.textlength(ch, font=font) + tracking
    return x - tracking - xy[0]

def tracked_width(draw, text, font, tracking=0):
    return sum(draw.textlength(c, font=font) for c in text) + tracking * (len(text) - 1)

# ワードマーク
f_mark = ImageFont.truetype(LATIN, 128)
mark, track = "TEITEN", 26
w = tracked_width(d, mark, f_mark, track)
draw_tracked(d, ((W - w) / 2, 196), mark, f_mark, INK, track)

# 漢字表記 ── タグライン
f_ja = ImageFont.truetype(JP_MED, 26)
f_tag = ImageFont.truetype(JP_MED, 26)
ja, tag = "定点", "資金の流れで読む、今日の市場"
gap, rule = 22, 40
w_ja = tracked_width(d, ja, f_ja, 6)
w_tag = tracked_width(d, tag, f_tag, 3)
total = w_ja + gap + rule + gap + w_tag
x = (W - total) / 2
y = 372
draw_tracked(d, (x, y), ja, f_ja, INK, 6)
x += w_ja + gap
d.line([(x, y + 16), (x + rule, y + 16)], fill=LINE, width=2)
x += rule + gap
draw_tracked(d, (x, y), tag, f_tag, INK, 3)

# 下部の発行元
f_pub = ImageFont.truetype(JP_MED, 22)
pub = "Financial and Marketing M16"
w_pub = tracked_width(d, pub, f_pub, 2)
draw_tracked(d, ((W - w_pub) / 2, 520), pub, f_pub, ACCENT, 2)

# 上下の細い罫線
d.line([(120, 150), (W - 120, 150)], fill=LINE, width=1)
d.line([(120, 480), (W - 120, 480)], fill=LINE, width=1)

img.save("public/og-default.png", "PNG", optimize=True)
print("public/og-default.png", img.size)
