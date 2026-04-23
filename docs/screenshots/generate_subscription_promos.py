#!/usr/bin/env python3
"""Generate distinct promoted in-app purchase images for App Store Connect.

Outputs 4 square RGB PNG files at 1024x1024 with no alpha channel:
- promo_starter_plan.png
- promo_standard_plan.png
- promo_advanced_plan.png
- promo_premium_plan.png
"""

from PIL import Image, ImageDraw, ImageFont, ImageFilter
from pathlib import Path

W = H = 1024
OUT_DIR = Path(__file__).resolve().parent

BG_TOP = (7, 15, 28)
BG_BOTTOM = (5, 10, 20)
CARD = (14, 24, 42)
CARD_2 = (10, 18, 34)
WHITE = (245, 248, 255)
SOFT = (168, 183, 210)
SOFT_2 = (120, 136, 166)
BITCOIN = (255, 184, 43)
BLACK = (6, 8, 12)

PLANS = [
    {
        "file": "promo_starter_plan.png",
        "name": "Starter Plan",
        "subtitle": "Beginner Friendly",
        "hashrate": "176.3 GH/s",
        "duration": "1 Month",
        "accent": (74, 144, 226),
        "accent_2": (92, 176, 255),
        "chip_count": 1,
        "badge": "ENTRY",
    },
    {
        "file": "promo_standard_plan.png",
        "name": "Standard Plan",
        "subtitle": "Most Popular Choice",
        "hashrate": "305.6 GH/s",
        "duration": "1 Month",
        "accent": (80, 200, 120),
        "accent_2": (118, 232, 143),
        "chip_count": 2,
        "badge": "POPULAR",
    },
    {
        "file": "promo_advanced_plan.png",
        "name": "Advanced Plan",
        "subtitle": "Serious Mining Power",
        "hashrate": "611.2 GH/s",
        "duration": "1 Month",
        "accent": (255, 107, 53),
        "accent_2": (255, 154, 102),
        "chip_count": 3,
        "badge": "BOOST",
    },
    {
        "file": "promo_premium_plan.png",
        "name": "Premium Plan",
        "subtitle": "Maximum Hashrate",
        "hashrate": "1326.4 GH/s",
        "duration": "1 Month",
        "accent": (255, 215, 0),
        "accent_2": (255, 236, 107),
        "chip_count": 4,
        "badge": "MAX",
    },
]


def font(size: int, bold: bool = False):
    candidates = [
        "/System/Library/Fonts/SFNSDisplay-Bold.otf" if bold else "/System/Library/Fonts/SFNSDisplay.otf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    for path in candidates:
        p = Path(path)
        if p.exists():
            try:
                return ImageFont.truetype(str(p), size)
            except Exception:
                continue
    return ImageFont.load_default()


def lerp(a, b, t):
    return int(a * (1 - t) + b * t)


def make_background(plan):
    img = Image.new("RGB", (W, H), BG_TOP)
    draw = ImageDraw.Draw(img)

    # Vertical background gradient.
    for y in range(H):
        t = y / (H - 1)
        color = (
            lerp(BG_TOP[0], BG_BOTTOM[0], t),
            lerp(BG_TOP[1], BG_BOTTOM[1], t),
            lerp(BG_TOP[2], BG_BOTTOM[2], t),
        )
        draw.line([(0, y), (W, y)], fill=color)

    # Soft accent bloom in the top-right and lower-left for depth.
    bloom = Image.new("RGB", (W, H), (0, 0, 0))
    bdraw = ImageDraw.Draw(bloom)
    accent = plan["accent"]
    accent_2 = plan["accent_2"]
    for radius in range(420, 0, -16):
        t = radius / 420
        c1 = tuple(lerp(accent[i], BG_TOP[i], t) for i in range(3))
        c2 = tuple(lerp(accent_2[i], BG_TOP[i], t) for i in range(3))
        bdraw.ellipse((620 - radius, 40 - radius, 620 + radius, 40 + radius), fill=c1)
        bdraw.ellipse((-40 - radius, 780 - radius, -40 + radius, 780 + radius), fill=c2)
    bloom = bloom.filter(ImageFilter.GaussianBlur(70))
    img = Image.blend(img, bloom, 0.22)
    draw = ImageDraw.Draw(img)

    # Circuit grid/dot texture.
    dot = tuple(lerp(plan["accent"][i], BG_TOP[i], 0.75) for i in range(3))
    for y in range(34, H, 42):
        for x in range(34, W, 42):
            draw.ellipse((x, y, x + 4, y + 4), fill=dot)

    # Corner line work.
    line_col = tuple(lerp(plan["accent"][i], 255, 0.25) for i in range(3))
    for offset in range(0, 280, 28):
        draw.line((0, 230 + offset, 260 - offset // 2, 0), fill=line_col, width=1)
        draw.line((W, 720 - offset, W - 260 + offset // 2, H), fill=line_col, width=1)

    return img


def rounded_rect(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def center_text(draw, text, y, fill, size, bold=False):
    f = font(size, bold)
    bbox = draw.textbbox((0, 0), text, font=f)
    tw = bbox[2] - bbox[0]
    draw.text(((W - tw) / 2, y), text, font=f, fill=fill)


def draw_chip(draw, cx, cy, size_px, accent, accent_2, chip_count):
    # Concentric glow.
    for i, radius in enumerate((210, 170, 130)):
        mix = 0.2 + i * 0.1
        c = tuple(lerp(accent[j], BG_TOP[j], 1 - mix) for j in range(3))
        draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), outline=c, width=2)

    # Decorative powered nodes.
    node_col = tuple(lerp(accent_2[j], 255, 0.1) for j in range(3))
    for idx in range(chip_count + 4):
        x = cx - 210 + idx * 70
        draw.ellipse((x - 10, cy - 170, x + 10, cy - 150), fill=node_col)
        draw.line((x, cy - 150, x, cy - 96), fill=node_col, width=3)

    # Base plate.
    plate_box = (cx - 210, cy - 160, cx + 210, cy + 160)
    rounded_rect(draw, plate_box, 38, fill=(11, 18, 34), outline=accent, width=4)
    rounded_rect(draw, (cx - 178, cy - 128, cx + 178, cy + 128), 30, fill=(12, 27, 52), outline=accent_2, width=2)

    # Signal bars.
    bar_base_x = cx - 150
    for idx in range(8):
        x = bar_base_x + idx * 38
        top = cy + 110 - idx % 4 * 18
        rounded_rect(draw, (x, top, x + 20, cy + 130), 5, fill=accent_2)

    # Inner chip.
    inner_box = (cx - 98, cy - 98, cx + 98, cy + 98)
    rounded_rect(draw, inner_box, 24, fill=(18, 34, 62), outline=accent_2, width=3)

    # Side pins.
    pin_col = tuple(lerp(accent[j], 255, 0.2) for j in range(3))
    for idx in range(7):
        py = cy - 72 + idx * 24
        draw.line((cx - 98, py, cx - 128, py), fill=pin_col, width=5)
        draw.line((cx + 98, py, cx + 128, py), fill=pin_col, width=5)

    # Bitcoin mark.
    f = font(112, True)
    label = "B"
    bbox = draw.textbbox((0, 0), label, font=f)
    draw.text((cx - (bbox[2] - bbox[0]) / 2, cy - (bbox[3] - bbox[1]) / 2 - 10), label, font=f, fill=BITCOIN)

    # Small tier indicators.
    for idx in range(chip_count):
        x = cx - 78 + idx * 52
        rounded_rect(draw, (x, cy - 146, x + 40, cy - 116), 10, fill=accent)


def draw_stat_card(draw, plan):
    # Floating contract card.
    card = (94, 110, 930, 928)
    rounded_rect(draw, card, 44, fill=(10, 18, 33), outline=tuple(lerp(plan["accent"][i], 255, 0.15) for i in range(3)), width=2)

    # Accent ribbon.
    badge_box = (134, 146, 314, 194)
    rounded_rect(draw, badge_box, 20, fill=plan["accent"])
    badge_font = font(26, True)
    draw.text((156, 157), plan["badge"], font=badge_font, fill=BLACK)

    # Title and subtitle.
    title_font = font(64, True)
    sub_font = font(32, False)
    draw.text((132, 230), plan["name"], font=title_font, fill=WHITE)
    draw.text((132, 304), plan["subtitle"], font=sub_font, fill=SOFT)

    # Chip centerpiece.
    draw_chip(draw, 512, 518, 0, plan["accent"], plan["accent_2"], plan["chip_count"])

    # Bottom metrics area.
    metric_y = 724
    metric_h = 148
    pill_w = 352
    gap = 24
    pills = [
        (plan["hashrate"], "Hashrate"),
        (plan["duration"], "Duration"),
    ]
    for idx, (value, label) in enumerate(pills):
        x1 = 132 + idx * (pill_w + gap)
        x2 = x1 + pill_w
        rounded_rect(draw, (x1, metric_y, x2, metric_y + metric_h), 26, fill=(15, 25, 46), outline=tuple(lerp(plan["accent"][i], BG_TOP[i], 0.25) for i in range(3)), width=2)
        value_font = font(40, True)
        label_font = font(24, False)
        draw.text((x1 + 26, metric_y + 30), value, font=value_font, fill=WHITE)
        draw.text((x1 + 26, metric_y + 86), label, font=label_font, fill=SOFT_2)

    # Footer line to make each asset clearly subscription-related.
    footer_font = font(26, False)
    center_text(draw, "Auto-Renewable Subscription", 956, SOFT_2, 26, False)


def generate_one(plan):
    img = make_background(plan)
    draw = ImageDraw.Draw(img)
    draw_stat_card(draw, plan)
    out_path = OUT_DIR / plan["file"]
    img.save(out_path, "PNG")
    return out_path


def main():
    print("Generating promoted IAP artwork...")
    for plan in PLANS:
        path = generate_one(plan)
        print(f"Saved {path.name}")
    print("Done")


if __name__ == "__main__":
    main()
