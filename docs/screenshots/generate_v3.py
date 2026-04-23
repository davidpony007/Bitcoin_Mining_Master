#!/usr/bin/env python3
"""
App Store Screenshots v3
Style: dark navy bg + headline text + iPhone frame wrapping real app screenshot
4 screens at 1242x2688 (iPhone 6.5")
Run: python3 generate_v3.py
"""

from PIL import Image, ImageDraw, ImageFont
import os

W, H = 1242, 2688
OUT = os.path.dirname(os.path.abspath(__file__))

# ─── Colors ───────────────────────────────────────────────────────────────────
NAVY      = (8,   15,  35)
NAVY2     = (12,  22,  48)
ORANGE    = (255, 165,  0)
WHITE     = (255, 255, 255)
GRAY_LT   = (200, 205, 220)
FRAME_COL = (30,  35,  55)     # iPhone outer frame
FRAME_IN  = (18,  22,  40)     # inner frame edge
SCREEN_BG = (13,  13,   8)     # app bg color

# ─── Font ─────────────────────────────────────────────────────────────────────
def F(size, bold=False):
    for p in ([
        "/System/Library/Fonts/SFNSDisplay-Bold.otf",
        "/System/Library/Fonts/SFNSDisplay.otf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/Library/Fonts/Arial Bold.ttf",
        "/Library/Fonts/Arial.ttf",
    ] if bold else [
        "/System/Library/Fonts/SFNSDisplay.otf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/Library/Fonts/Arial.ttf",
    ]):
        if os.path.exists(p):
            try: return ImageFont.truetype(p, size)
            except: pass
    return ImageFont.load_default()

# ─── Dot grid background ──────────────────────────────────────────────────────
def dot_bg(img):
    draw = ImageDraw.Draw(img)
    step = 44
    for y in range(0, H, step):
        for x in range(0, W, step):
            draw.ellipse([x, y, x+3, y+3], fill=(255,255,255,18))

def make_bg(img):
    """Dark navy gradient background"""
    draw = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H
        r = int(NAVY[0]*(1-t) + NAVY2[0]*t)
        g = int(NAVY[1]*(1-t) + NAVY2[1]*t)
        b = int(NAVY[2]*(1-t) + NAVY2[2]*t)
        draw.line([(0,y),(W,y)], fill=(r,g,b))

# ─── Headline renderer ────────────────────────────────────────────────────────
def draw_headline(draw, lines, y_start):
    """
    lines: list of list of (text, color) tuples per line
    Renders centered multi-color text.
    """
    line_gap = 20
    for line_parts in lines:
        # Measure total line width
        total_w = 0
        sizes = []
        for text, color, bold, size in line_parts:
            f = F(size, bold)
            bb = draw.textbbox((0,0), text, font=f)
            tw = bb[2]-bb[0]
            th = bb[3]-bb[1]
            sizes.append((f, tw, th, color))
            total_w += tw
        # Draw centered
        x = (W - total_w) // 2
        max_h = max(s[2] for s in sizes)
        for (f, tw, th, color), (text, _, _, _) in zip(sizes, line_parts):
            draw.text((x, y_start + (max_h - th)//2), text, font=f, fill=color)
            x += tw
        y_start += max_h + line_gap
    return y_start

# ─── iPhone frame ─────────────────────────────────────────────────────────────
def draw_iphone_frame(img, px1, py1, px2, py2):
    """
    Draw an iPhone 14 Pro style frame.
    Returns (screen_x1, screen_y1, screen_x2, screen_y2)
    """
    draw = ImageDraw.Draw(img)
    pw = px2 - px1
    ph = py2 - py1
    corner_r = int(pw * 0.115)
    border = 18

    # Outer shadow glow (simulate depth)
    for i in range(8, 0, -1):
        alpha_blend = 0.03 * i
        sc = tuple(int(NAVY[j]*(1-alpha_blend) + 80*alpha_blend) for j in range(3))
        draw.rounded_rectangle(
            [px1-i*2, py1-i*2, px2+i*2, py2+i*2],
            radius=corner_r+i*2, fill=sc
        )

    # Outer frame (silver-ish dark)
    draw.rounded_rectangle([px1, py1, px2, py2],
                            radius=corner_r, fill=FRAME_COL)

    # Inner frame
    draw.rounded_rectangle(
        [px1+border, py1+border, px2-border, py2-border],
        radius=corner_r-border+4, fill=FRAME_IN
    )

    # Screen area
    sx1 = px1 + border + 2
    sy1 = py1 + border + 2
    sx2 = px2 - border - 2
    sy2 = py2 - border - 2
    scr = corner_r - border

    draw.rounded_rectangle([sx1, sy1, sx2, sy2],
                            radius=max(scr, 10), fill=SCREEN_BG)

    # Dynamic Island (pill cutout at top of screen)
    di_w = int(pw * 0.26)
    di_h = int(pw * 0.036)
    di_cx = (px1 + px2) // 2
    di_y = sy1 + int(ph * 0.012)
    draw.rounded_rectangle(
        [di_cx - di_w//2, di_y, di_cx + di_w//2, di_y + di_h],
        radius=di_h//2, fill=FRAME_COL
    )

    # Side buttons (volume on left, power on right)
    btn_r = 6
    btn_col = (50, 55, 80)
    for by in [py1 + int(ph*0.18), py1 + int(ph*0.26)]:
        draw.rounded_rectangle([px1-12, by, px1-2, by+int(ph*0.07)],
                                radius=btn_r, fill=btn_col)
    draw.rounded_rectangle([px2+2, py1+int(ph*0.22), px2+12, py1+int(ph*0.32)],
                            radius=btn_r, fill=btn_col)

    return sx1, sy1, sx2, sy2

# ─── Paste screenshot into phone screen ───────────────────────────────────────
def paste_screenshot(img, src_path, sx1, sy1, sx2, sy2):
    src = Image.open(src_path).convert("RGB")
    sw = sx2 - sx1
    sh = sy2 - sy1
    # Scale src to fill screen width, crop height if needed
    scale = sw / src.width
    new_h = int(src.height * scale)
    src_resized = src.resize((sw, new_h), Image.LANCZOS)
    # Crop to screen height (from top)
    crop_h = min(sh, new_h)
    cropped = src_resized.crop((0, 0, sw, crop_h))
    img.paste(cropped, (sx1, sy1))

# ─── Soft vignette on phone edges ─────────────────────────────────────────────
def phone_vignette(img, sx1, sy1, sx2, sy2):
    draw = ImageDraw.Draw(img)
    # Darken bottom edge of screen
    for i in range(60):
        t = i / 60
        alpha = int(160 * t)
        c = tuple(int(SCREEN_BG[j]*(t) + 0*(1-t)) for j in range(3))
        draw.line([(sx1, sy2-i), (sx2, sy2-i)], fill=c)

# ══════════════════════════════════════════════════════════════════════════════
# Build one screenshot
# ══════════════════════════════════════════════════════════════════════════════
def build(src_filename, headline_lines, out_filename):
    img = Image.new('RGB', (W, H), NAVY)
    make_bg(img)

    draw = ImageDraw.Draw(img)

    # Subtle dot texture on bg
    step = 44
    for dy in range(0, H, step):
        for dx in range(0, W, step):
            # blend with bg at that y
            t = dy/H
            br = int(NAVY[0]*(1-t)+NAVY2[0]*t)
            bg = int(NAVY[1]*(1-t)+NAVY2[1]*t)
            bb2 = int(NAVY[2]*(1-t)+NAVY2[2]*t)
            dr = min(255, br+14)
            dg = min(255, bg+14)
            db = min(255, bb2+14)
            draw.ellipse([dx, dy, dx+3, dy+3], fill=(dr, dg, db))

    # Subtle radial glow behind phone (center, y~60%)
    glow_cx, glow_cy = W//2, int(H*0.62)
    for r in range(600, 0, -30):
        t = r/600
        alpha = 0.025 * (1-t)
        c = tuple(int(NAVY2[j]*(1-alpha) + 40*alpha) for j in range(3))
        draw.ellipse([glow_cx-r, glow_cy-r, glow_cx+r, glow_cy+r], fill=c)

    # ── Headline ────────────────────────────────────────────────────────────
    y = draw_headline(draw, headline_lines, 90)

    # ── iPhone frame ────────────────────────────────────────────────────────
    # Phone occupies from y+gap to bottom with margins
    top_gap = 30
    py1 = y + top_gap
    phone_w = 920
    px1 = (W - phone_w) // 2
    px2 = px1 + phone_w
    # Height based on iPhone aspect ratio (9:19.5)
    phone_h = int(phone_w * 19.5 / 9)
    py2 = min(py1 + phone_h, H - 20)

    sx1, sy1, sx2, sy2 = draw_iphone_frame(img, px1, py1, px2, py2)

    # ── Paste app screenshot ────────────────────────────────────────────────
    src_path = os.path.join(OUT, src_filename)
    paste_screenshot(img, src_path, sx1, sy1, sx2, sy2)
    phone_vignette(img, sx1, sy1, sx2, sy2)

    # ── Re-draw frame on top so edges look clean ────────────────────────────
    draw = ImageDraw.Draw(img)
    corner_r = int(phone_w * 0.115)
    border = 18
    # Frame outline
    draw.rounded_rectangle([px1, py1, px2, py2],
                            radius=corner_r, outline=(60,65,90), width=3)
    draw.rounded_rectangle(
        [px1+border, py1+border, px2-border, py2-border],
        radius=corner_r-border+4, outline=(40,45,70), width=2
    )

    # Re-draw Dynamic Island on top of screenshot
    di_w = int(phone_w * 0.26)
    di_h = int(phone_w * 0.036)
    di_cx = W // 2
    di_y = sy1 + int(phone_h * 0.012)
    draw.rounded_rectangle(
        [di_cx - di_w//2, di_y, di_cx + di_w//2, di_y + di_h],
        radius=di_h//2, fill=FRAME_COL
    )
    draw.rounded_rectangle(
        [di_cx - di_w//2, di_y, di_cx + di_w//2, di_y + di_h],
        radius=di_h//2, outline=(50,55,80), width=2
    )

    # Save
    out_path = os.path.join(OUT, out_filename)
    img.save(out_path, "PNG")
    print(f"  Saved: {out_path}")

# ══════════════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    print("Generating v3 App Store screenshots...")

    SIZE_TITLE = 118
    SIZE_TITLE2 = 110
    SIZE_SUB = 70

    screens = [
        {
            "src": "screen1_mining_dashboard.png",
            "out": "store_1_dashboard.png",
            "lines": [
                [("Bitcoin", ORANGE, True, SIZE_TITLE), (" Mining", WHITE, True, SIZE_TITLE)],
                [("Earn BTC ", WHITE, True, SIZE_TITLE2), ("Easily", ORANGE, True, SIZE_TITLE2)],
                [("Cloud mining · No hardware needed", GRAY_LT, False, SIZE_SUB)],
            ],
        },
        {
            "src": "screen2_contracts.png",
            "out": "store_2_contracts.png",
            "lines": [
                [("Choose Your", WHITE, True, SIZE_TITLE)],
                [("Mining ", ORANGE, True, SIZE_TITLE2), ("Contract", WHITE, True, SIZE_TITLE2)],
                [("Free starter plan available for everyone", GRAY_LT, False, SIZE_SUB)],
            ],
        },
        {
            "src": "screen3_referral.png",
            "out": "store_3_referral.png",
            "lines": [
                [("Mine ", WHITE, True, SIZE_TITLE), ("Bitcoin", ORANGE, True, SIZE_TITLE), (" Together", WHITE, True, SIZE_TITLE)],
                [("Maximize Your ", WHITE, True, SIZE_TITLE2), ("Rewards!", ORANGE, True, SIZE_TITLE2)],
                [("20% lifetime referral commission", GRAY_LT, False, SIZE_SUB)],
            ],
        },
        {
            "src": "screen4_settings.png",
            "out": "store_4_settings.png",
            "lines": [
                [("Secure", ORANGE, True, SIZE_TITLE), (" Account,", WHITE, True, SIZE_TITLE)],
                [("Full ", WHITE, True, SIZE_TITLE2), ("Privacy", ORANGE, True, SIZE_TITLE2), (" Protection", WHITE, True, SIZE_TITLE2)],
                [("Apple Sign-In · Multi-language support", GRAY_LT, False, SIZE_SUB)],
            ],
        },
    ]

    for s in screens:
        print(f"  Building {s['out']}...")
        build(s["src"], s["lines"], s["out"])

    print("\nDone! Upload store_1~4 PNG files to App Store Connect.")
