#!/usr/bin/env python3
"""
產生 PWA 所需的各尺寸圖示。

為什麼需要這個：原本的 manifest 完全沒有 icons 欄位，專案裡也沒有任何圖片檔，
瀏覽器因此判定這個 App 不可安裝（Chrome/Edge 要求至少 192x192 與 512x512），
「加入主畫面」無法使用 —— 但這個 App 開場就要求「請將平板直式放置」，
顯然是設計成要當平板 App 用的。

圖案是小提琴剪影。色票取自 src/index.css 的 --color-accent-warm / --color-bg-warm，
與 App 的視覺一致。

這裡沒有用 SVG：這台機器只有 Pillow，沒有任何 SVG 光柵化工具，
所以輪廓是用 Catmull-Rom 曲線插值控制點後填滿多邊形畫出來的。

用法：
    python scripts/generate-icons.py
輸出到 public/icons/。
"""

import math
from pathlib import Path
from PIL import Image, ImageDraw

ACCENT = "#F27D26"  # --color-accent-warm
DARK = "#080808"    # --color-bg-warm

OUT_DIR = Path(__file__).resolve().parent.parent / "public" / "icons"

# 以 4 倍解析度繪製再縮小，邊緣才會平滑（Pillow 的繪圖沒有抗鋸齒）
SUPERSAMPLE = 4


def catmull_rom(points, samples_per_segment=24):
    """
    以 Catmull-Rom 樣條插值通過所有控制點，得到平滑曲線。
    小提琴的琴身曲線（上弧、腰身內凹、下弧）用直線段畫會很生硬。
    """
    pts = [points[0]] + list(points) + [points[-1]]
    out = []
    for i in range(len(pts) - 3):
        p0, p1, p2, p3 = pts[i], pts[i + 1], pts[i + 2], pts[i + 3]
        for s in range(samples_per_segment):
            t = s / samples_per_segment
            t2, t3 = t * t, t * t * t
            x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t +
                       (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
                       (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)
            y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t +
                       (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
                       (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
            out.append((x, y))
    out.append(points[-1])
    return out


# 琴身右半邊輪廓：(半寬, y)。y=0 是琴身頂端、y=1 是底端。
# 依序是上弧 → 腰身（C 形內凹）→ 下弧 → 收尾。
BODY_HALF = [
    (0.000, -0.015),
    (0.120, 0.015),
    (0.225, 0.070),
    (0.272, 0.150),
    (0.277, 0.225),
    (0.243, 0.315),
    (0.186, 0.395),
    (0.172, 0.455),   # 腰身最窄處
    (0.196, 0.520),
    (0.258, 0.600),
    (0.325, 0.695),
    (0.352, 0.790),
    (0.336, 0.885),
    (0.258, 0.960),
    (0.130, 1.000),
    (0.000, 1.012),
]


def stroke_to_polygon(points, width):
    """
    把一條曲線外擴成有厚度的封閉多邊形。

    直接用 ImageDraw.line(width=...) 畫曲線時，Pillow 是以一段段線段去疊，
    在彎曲處會看到明顯的階梯與凸起（f 孔會變成毛毛蟲）。
    改成自己算法線、產生填滿的多邊形，邊緣才會平滑。
    """
    half = width / 2
    left, right = [], []
    for i, (x, y) in enumerate(points):
        if i == 0:
            dx, dy = points[1][0] - x, points[1][1] - y
        elif i == len(points) - 1:
            dx, dy = x - points[-2][0], y - points[-2][1]
        else:
            dx = points[i + 1][0] - points[i - 1][0]
            dy = points[i + 1][1] - points[i - 1][1]
        length = (dx * dx + dy * dy) ** 0.5 or 1.0
        nx, ny = -dy / length * half, dx / length * half
        left.append((x + nx, y + ny))
        right.append((x - nx, y - ny))
    return left + list(reversed(right))


def violin_outline():
    """回傳琴身的封閉輪廓（右半邊插值後鏡像成左半邊）。"""
    right = catmull_rom(BODY_HALF)
    left = [(-x, y) for x, y in reversed(right)]
    return right + left


def draw_violin(draw: ImageDraw.ImageDraw, cx: float, top: float, unit: float) -> None:
    """
    以琴身高度為 1 單位繪製整把琴。
    cx 是水平中心，top 是琴身頂端的 y 座標。
    """
    def P(x, y):
        return (cx + x * unit, top + y * unit)

    # --- 琴頸與琴頭（畫在琴身之前，讓琴身蓋住接合處）---
    neck_w = 0.055
    draw.polygon(
        [P(-neck_w, 0.06), P(neck_w, 0.06), P(neck_w, -0.34), P(-neck_w, -0.34)],
        fill=DARK,
    )

    # 弦軸箱：比琴頸略寬
    peg_w = 0.085
    draw.polygon(
        [P(-neck_w, -0.30), P(neck_w, -0.30), P(peg_w, -0.46), P(-peg_w, -0.46)],
        fill=DARK,
    )

    # 琴頭渦卷：實心圓 + 一道細弧線暗示捲曲。
    # 不要在中間挖一個圓洞，那會變成鑰匙孔的樣子。
    sx, sy = P(0, -0.505)
    r = 0.10 * unit
    draw.ellipse([sx - r, sy - r, sx + r, sy + r], fill=DARK)
    spiral = []
    for i in range(26):
        t = i / 25
        ang = -1.9 + t * 4.4           # 約 250 度的弧
        rad = r * (0.60 - 0.30 * t)    # 半徑漸縮，形成螺旋感
        spiral.append((sx + rad * math.cos(ang), sy + rad * math.sin(ang)))
    draw.polygon(stroke_to_polygon(spiral, max(1.5, 0.020 * unit)), fill=ACCENT)

    # 弦軸（左右各兩根）
    peg_len = 0.07
    pw = max(1, round(0.024 * unit))
    for py in (-0.355, -0.425):
        draw.line([P(-peg_w * 0.7, py), P(-peg_w - peg_len, py)], fill=DARK, width=pw)
        draw.line([P(peg_w * 0.7, py), P(peg_w + peg_len, py)], fill=DARK, width=pw)

    # --- 指板：真實小提琴的指板是黑檀木，與琴身同為深色。
    #     先畫在琴身之下，讓它自然融進剪影，而不是在琴身上留一條搶眼的色塊。---
    fb_w = 0.047
    draw.polygon(
        [P(-fb_w, -0.32), P(fb_w, -0.32), P(fb_w * 1.15, 0.30), P(-fb_w * 1.15, 0.30)],
        fill=DARK,
    )

    # --- 琴身 ---
    draw.polygon([P(x, y) for x, y in violin_outline()], fill=DARK)

    # --- f 孔：琴身中段左右各一。線條細一點、不加端點圓球，小尺寸下才乾淨 ---
    fh_x = 0.112
    hole_w = max(1, round(0.026 * unit))
    for sign in (-1, 1):
        curve = catmull_rom([
            (sign * (fh_x + 0.016), 0.405),
            (sign * (fh_x - 0.004), 0.470),
            (sign * (fh_x - 0.004), 0.555),
            (sign * (fh_x + 0.016), 0.620),
        ], samples_per_segment=20)
        draw.polygon(stroke_to_polygon([P(x, y) for x, y in curve], hole_w), fill=ACCENT)

    # --- 琴弦：只畫琴身上這一段（指板末端到琴橋），避免整條中線都是橘色 ---
    sw = max(1, round(0.012 * unit))
    for off in (-0.026, -0.009, 0.009, 0.026):
        draw.line([P(off, 0.315), P(off, 0.690)], fill=ACCENT, width=sw)

    # --- 琴橋 ---
    br_w = 0.088
    draw.line([P(-br_w, 0.690), P(br_w, 0.690)], fill=ACCENT, width=max(1, round(0.030 * unit)))

    # --- 拉弦板：細長一點，不要變成一個大三角 ---
    draw.polygon(
        [P(-0.038, 0.710), P(0.038, 0.710), P(0.024, 0.890), P(-0.024, 0.890)],
        fill=ACCENT,
    )


def make_icon(size: int, maskable: bool = False) -> Image.Image:
    s = size * SUPERSAMPLE
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    if maskable:
        # maskable 圖示由系統自行裁切成圓形／方形等形狀，
        # 因此整塊都要填滿底色，圖案則需留在中央約 80% 的安全區內。
        draw.rectangle([0, 0, s, s], fill=ACCENT)
        violin_height = s * 0.52
    else:
        radius = s * 0.22  # 與 App 內 rounded-xl 的視覺比例相近
        draw.rounded_rectangle([0, 0, s - 1, s - 1], radius=radius, fill=ACCENT)
        violin_height = s * 0.60

    # 整把琴（含琴頭）約為琴身高度的 1.56 倍，據此置中
    total = violin_height * 1.56
    top = (s - total) / 2 + violin_height * 0.56
    draw_violin(draw, s / 2, top, violin_height)

    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    targets = [
        ("icon-192.png", 192, False),
        ("icon-512.png", 512, False),
        ("icon-maskable-512.png", 512, True),
        # iOS 不讀 manifest 的 icons，「加入主畫面」要靠 apple-touch-icon
        ("apple-touch-icon.png", 180, False),
        ("favicon-32.png", 32, False),
    ]

    for name, size, maskable in targets:
        icon = make_icon(size, maskable)
        path = OUT_DIR / name
        icon.save(path, "PNG")
        print(f"{path.relative_to(OUT_DIR.parent.parent)}  ({size}x{size}{', maskable' if maskable else ''})")


if __name__ == "__main__":
    main()
