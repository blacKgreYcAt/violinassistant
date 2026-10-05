#!/usr/bin/env python3
"""
產生 PWA 所需的各尺寸圖示。

為什麼需要這個：原本的 manifest 完全沒有 icons 欄位，專案裡也沒有任何圖片檔，
瀏覽器因此判定這個 App 不可安裝（Chrome/Edge 要求至少 192x192 與 512x512），
「加入主畫面」無法使用 —— 但這個 App 開場就要求「請將平板直式放置」，
顯然是設計成要當平板 App 用的。

圖案沿用 App 標題列既有的識別：橘色圓角方塊 + 深色音符（lucide 的 music 圖示）。
色票取自 src/index.css 的 --color-accent-warm / --color-bg-warm。

用法：
    python scripts/generate-icons.py
輸出到 public/icons/。
"""

from pathlib import Path
from PIL import Image, ImageDraw

ACCENT = "#F27D26"  # --color-accent-warm
DARK = "#080808"    # --color-bg-warm

OUT_DIR = Path(__file__).resolve().parent.parent / "public" / "icons"

# 以 4 倍解析度繪製再縮小，邊緣才會平滑（Pillow 的繪圖沒有抗鋸齒）
SUPERSAMPLE = 4


def draw_music_glyph(draw: ImageDraw.ImageDraw, size: int, offset: float, scale: float) -> None:
    """
    依 lucide `music` 圖示的路徑繪製（原始 viewBox 為 24x24）：
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
    """
    def p(x: float, y: float) -> tuple[float, float]:
        return (offset + x * scale, offset + y * scale)

    stroke = max(1, round(2 * scale))  # 原圖 stroke-width 為 2

    # 直桿與橫樑
    draw.line([p(9, 18), p(9, 5)], fill=DARK, width=stroke)
    draw.line([p(9, 5), p(21, 3)], fill=DARK, width=stroke)
    draw.line([p(21, 3), p(21, 16)], fill=DARK, width=stroke)

    # 轉角補圓點，避免線段接縫出現缺口
    for cx, cy in ((9, 5), (21, 3)):
        r = stroke / 2
        x, y = p(cx, cy)
        draw.ellipse([x - r, y - r, x + r, y + r], fill=DARK)

    # 兩顆實心音符頭（lucide 原圖是空心，實心在小尺寸下辨識度更好）
    for cx, cy in ((6, 18), (18, 16)):
        x, y = p(cx, cy)
        r = 3 * scale
        draw.ellipse([x - r, y - r, x + r, y + r], fill=DARK)


def make_icon(size: int, maskable: bool = False) -> Image.Image:
    s = size * SUPERSAMPLE
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    if maskable:
        # maskable 圖示由系統自行裁切成圓形／方形等形狀，
        # 因此整塊都要填滿底色，圖案則需留在中央約 80% 的安全區內。
        draw.rectangle([0, 0, s, s], fill=ACCENT)
        content = s * 0.56
    else:
        radius = s * 0.22  # 與 App 內 rounded-xl 的視覺比例相近
        draw.rounded_rectangle([0, 0, s - 1, s - 1], radius=radius, fill=ACCENT)
        content = s * 0.62

    scale = content / 24
    offset = (s - content) / 2
    draw_music_glyph(draw, s, offset, scale)

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
