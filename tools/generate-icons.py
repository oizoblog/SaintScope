"""Generate opaque PWA icons matching icon.svg. Requires Pillow."""

from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]


def icon(size: int) -> Image.Image:
    scale = 4
    s = size * scale
    image = Image.new("RGB", (s, s), "#173047")
    draw = ImageDraw.Draw(image)
    ratio = s / 192

    def box(x0, y0, x1, y1):
        return tuple(round(value * ratio) for value in (x0, y0, x1, y1))

    draw.rounded_rectangle(box(0, 0, 191, 191), radius=round(36 * ratio), fill="#173047")
    draw.ellipse(box(34, 34, 158, 158), outline="#e6c47b", width=round(8 * ratio))
    stroke = round(12 * ratio)
    draw.line(box(96, 43, 96, 149), fill="#ffffff", width=stroke)
    draw.line(box(61, 82, 131, 82), fill="#ffffff", width=stroke)
    for x, y in ((96, 43), (96, 149), (61, 82), (131, 82)):
        r = stroke / 2
        draw.ellipse((round(x * ratio - r), round(y * ratio - r), round(x * ratio + r), round(y * ratio + r)), fill="#ffffff")
    return image.resize((size, size), Image.Resampling.LANCZOS)


for filename, pixels in (("icon-192.png", 192), ("icon-512.png", 512), ("apple-touch-icon.png", 180)):
    icon(pixels).save(ROOT / filename, optimize=True)
