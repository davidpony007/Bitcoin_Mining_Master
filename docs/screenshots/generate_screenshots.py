#!/usr/bin/env python3
"""
Generate 3 App Store screenshots (1242x2688px) for Bitcoin Mining Master
Run: pip install Pillow && python generate_screenshots.py
"""

from PIL import Image, ImageDraw, ImageFont
import math, os

W, H = 1242, 2688
OUT_DIR = os.path.dirname(os.path.abspath(__file__))

# ── Colors ──────────────────────────────────────────────────────────────────
BG        = (10,  22, 12)
BG_CARD   = (18,  38, 22)
BG_CARD2  = (22,  48, 28)
ORANGE    = (255, 149,  0)
ORANGE_DK = (200, 110,  0)
GREEN_ACC = ( 52, 211, 120)
WHITE     = (255, 255, 255)
GRAY      = (150, 165, 155)
GRAY2     = (100, 120, 105)
GRID_LINE = ( 20,  50, 25)

# ── Fonts ───────────────────────────────────────────────────────────────────
def get_font(size, bold=False):
    paths = [
        f"/System/Library/Fonts/{'SFNSDisplay-Bold' if bold else 'SFNSDisplay'}.otf",
        f"/System/Library/Fonts/Helvetica{'Neue' if not bold else 'Neue Bold'}.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/Arial.ttf",
    ]
    for p in paths:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except:
                pass
    # Try macOS SF Pro
    sf_paths = [
        "/System/Library/Fonts/SFNS.ttf",
        "/System/Library/Fonts/SFNSRounded.ttf",
        "/Library/Fonts/Arial.ttf",
    ]
    for p in sf_paths:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except:
                pass
    return ImageFont.load_default()

# ── Helpers ─────────────────────────────────────────────────────────────────
def draw_grid(img):
    draw = ImageDraw.Draw(img)
    step = 80
    gc = (18, 44, 22)  # slightly lighter than BG for grid
    for x in range(0, W, step):
        draw.line([(x, 0), (x, H)], fill=gc, width=1)
    for y in range(0, H, step):
        draw.line([(0, y), (W, y)], fill=gc, width=1)

def rounded_rect(draw, x1, y1, x2, y2, r, fill, outline=None, outline_width=2):
    draw.rounded_rectangle([x1, y1, x2, y2], radius=r, fill=fill,
                            outline=outline, width=outline_width)

def center_text(draw, y, text, font, color):
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    draw.text(((W - tw) // 2, y), text, font=font, fill=color)

def draw_bitcoin_logo(draw, cx, cy, r, color=ORANGE):
    """Draw a BTC circle logo"""
    # Outer glow rings (simulate alpha by blending with BG)
    for i in range(4, 0, -1):
        glow_r = r + i * 14
        blend = 0.06 * i
        gc = tuple(int(BG[j] * (1-blend) + color[j] * blend) for j in range(3))
        draw.ellipse([cx-glow_r, cy-glow_r, cx+glow_r, cy+glow_r], fill=gc)
    # Main circle
    draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=color)
    # Inner dark circle
    ir = int(r * 0.72)
    draw.ellipse([cx-ir, cy-ir, cx+ir, cy+ir], fill=BG_CARD)
    # "B" symbol
    font = get_font(int(r * 0.82), bold=True)
    bbox = draw.textbbox((0, 0), "B", font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    draw.text((cx - tw//2, cy - th//2 - 4), "B", font=font, fill=color)

def draw_pill(draw, cx, cy, w, h, text, font, bg, fg):
    rounded_rect(draw, cx-w//2, cy-h//2, cx+w//2, cy+h//2, h//2, bg)
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    draw.text((cx - tw//2, cy - th//2), text, font=font, fill=fg)

def status_bar(draw):
    """Draw a fake iOS status bar"""
    f = get_font(34)
    draw.text((80, 62), "9:41", font=f, fill=WHITE)
    # Battery icon area (right side)
    for i, icon_x in enumerate([1100, 1060, 1025]):
        draw.rectangle([icon_x, 72, icon_x+26, 86], fill=(*WHITE, 180))

def gradient_overlay(img, top_color, bottom_color):
    """Add a subtle gradient overlay (blend with bg)"""
    draw = ImageDraw.Draw(img)
    for y in range(0, H, 2):
        t = y / H
        # Blend overlay color with existing pixel (simplified — just tint)
        ta = top_color[3] / 255.0 * (1 - t) + bottom_color[3] / 255.0 * t
        if ta < 0.01:
            continue
        r = int(top_color[0] * (1-t) + bottom_color[0] * t)
        g = int(top_color[1] * (1-t) + bottom_color[1] * t)
        b = int(top_color[2] * (1-t) + bottom_color[2] * t)
        # Blend with BG
        br = int(BG[0] * (1-ta) + r * ta)
        bg2 = int(BG[1] * (1-ta) + g * ta)
        bb = int(BG[2] * (1-ta) + b * ta)
        draw.line([(0, y), (W, y)], fill=(br, bg2, bb))


# ══════════════════════════════════════════════════════════════════════════════
# SCREENSHOT 1 — Mining Dashboard
# ══════════════════════════════════════════════════════════════════════════════
def make_screenshot_1():
    img = Image.new('RGB', (W, H), BG)
    draw_grid(img)
    draw = ImageDraw.Draw(img)

    # Top gradient fade
    gradient_overlay(img, (0,30,0,80), (0,0,0,0))
    draw = ImageDraw.Draw(img)

    status_bar(draw)

    # App name
    f_small = get_font(38)
    center_text(draw, 160, "BITCOIN MINING MASTER", f_small, GRAY)

    # Main headline
    f_title = get_font(96, bold=True)
    center_text(draw, 230, "Earn Bitcoin", f_title, WHITE)
    f_title2 = get_font(96, bold=True)
    center_text(draw, 340, "24/7 — Free", f_title2, ORANGE)

    # Bitcoin logo
    draw_bitcoin_logo(draw, W//2, 680, 200)

    # Mining status badge
    f_badge = get_font(38)
    rounded_rect(draw, W//2-160, 910, W//2+160, 968, 29,
                 (12, 55, 30), GREEN_ACC, 2)
    center_text(draw, 922, "* Mining Active", f_badge, GREEN_ACC)

    # Balance card
    rounded_rect(draw, 80, 1010, W-80, 1230, 36, BG_CARD)
    f_label = get_font(40)
    f_balance = get_font(108, bold=True)
    f_sub = get_font(38)
    center_text(draw, 1038, "Current Balance", f_label, GRAY)
    center_text(draw, 1090, "0.08234", f_balance, WHITE)
    center_text(draw, 1210, "BTC  ≈  $8,234.50 USD", f_sub, GRAY)

    # Stats row
    stats = [("120 TH/s", "Hash Rate"), ("+$23.40", "Daily Earn"), ("99.9%", "Uptime")]
    sx = 80
    sw = (W - 160 - 40) // 3
    for i, (val, lbl) in enumerate(stats):
        x1 = sx + i * (sw + 20)
        rounded_rect(draw, x1, 1280, x1+sw, 1440, 28, BG_CARD)
        f_sv = get_font(58, bold=True)
        f_sl = get_font(34)
        bbox = draw.textbbox((0,0), val, font=f_sv)
        tw = bbox[2]-bbox[0]
        draw.text((x1 + (sw-tw)//2, 1305), val, font=f_sv,
                  fill=ORANGE if i==0 else (GREEN_ACC if i==1 else WHITE))
        bbox2 = draw.textbbox((0,0), lbl, font=f_sl)
        tw2 = bbox2[2]-bbox2[0]
        draw.text((x1 + (sw-tw2)//2, 1385), lbl, font=f_sl, fill=GRAY)

    # Features list
    features = [
        (ORANGE,    "[+]", "Mining Contracts  24/7 Auto Earnings"),
        (GREEN_ACC, "[G]", "Free Contracts  Daily Check-in Rewards"),
        (ORANGE,    "[@]", "Referral Rebates  Invite & Earn Together"),
        (GREEN_ACC, "[$]", "BEP20 Withdrawal  Direct to Wallet"),
    ]
    fy = 1500
    for col, badge, text in features:
        rounded_rect(draw, 80, fy, W-80, fy+102, 24, BG_CARD)
        f_feat_badge = get_font(38, bold=True)
        f_feat_text = get_font(44)
        draw.text((110, fy + 30), badge, font=f_feat_badge, fill=col)
        draw.text((210, fy + 30), text, font=f_feat_text, fill=WHITE)
        fy += 122

    # CTA button
    rounded_rect(draw, 80, 2000, W-80, 2140, 50, ORANGE)
    f_cta = get_font(72, bold=True)
    center_text(draw, 2040, "Start Mining Free  >>", f_cta, BG)

    # Bottom tagline
    f_tag = get_font(40)
    center_text(draw, 2200, "No Hardware Needed • 100% Cloud Mining", f_tag, GRAY)

    # Decorative bottom glow
    gradient_overlay(img, (0,0,0,0), (255,149,0,20))
    draw = ImageDraw.Draw(img)
    f_brand = get_font(34)
    center_text(draw, 2580, "Bitcoin Mining Master — Crypto", f_brand, (*GRAY2,))

    return img


# ══════════════════════════════════════════════════════════════════════════════
# SCREENSHOT 2 — Mining Contracts
# ══════════════════════════════════════════════════════════════════════════════
def make_screenshot_2():
    img = Image.new('RGB', (W, H), BG)
    draw_grid(img)
    draw = ImageDraw.Draw(img)
    gradient_overlay(img, (0,30,0,60), (0,0,0,0))
    draw = ImageDraw.Draw(img)

    status_bar(draw)

    # Header
    f_label = get_font(38)
    center_text(draw, 160, "MINING CONTRACTS", f_label, GRAY)
    f_title = get_font(90, bold=True)
    center_text(draw, 230, "Choose Your", f_title, WHITE)
    center_text(draw, 338, "Mining Power", f_title, ORANGE)

    f_sub = get_font(44)
    center_text(draw, 460, "Earn BTC automatically, every minute", f_sub, GRAY)

    # Contracts
    contracts = [
        {
            "name": "Free Starter",
            "badge": "FREE",
            "hashrate": "5 TH/s",
            "daily": "+$0.12 / day",
            "duration": "3 Days",
            "highlight": False,
            "badge_color": GREEN_ACC,
        },
        {
            "name": "Basic Miner",
            "badge": "POPULAR",
            "hashrate": "100 TH/s",
            "daily": "+$2.40 / day",
            "duration": "30 Days",
            "highlight": True,
            "badge_color": ORANGE,
        },
        {
            "name": "Pro Miner",
            "badge": "BEST ROI",
            "hashrate": "500 TH/s",
            "daily": "+$14.00 / day",
            "duration": "90 Days",
            "highlight": False,
            "badge_color": (180, 100, 255),
        },
    ]

    cy = 560
    for i, c in enumerate(contracts):
        card_h = 380
        is_hl = c["highlight"]
        outline_col = ORANGE if is_hl else None
        bg_col = (25, 55, 32) if is_hl else BG_CARD
        rounded_rect(draw, 60, cy, W-60, cy+card_h, 36, bg_col,
                     outline_col if is_hl else None, 3)

        # Badge
        bc = c["badge_color"]
        badge_bg = tuple(max(0, min(255, int(x * 0.25 + BG_CARD[i] * 0.75)))
                         for i, x in enumerate(bc))
        rounded_rect(draw, 90, cy+24, 90+len(c["badge"])*22+40, cy+80, 20,
                     badge_bg, bc, 2)
        f_badge = get_font(32, bold=True)
        draw.text((110, cy + 34), c["badge"], font=f_badge, fill=bc)

        # Name
        f_name = get_font(62, bold=True)
        draw.text((90, cy + 96), c["name"], font=f_name, fill=WHITE)

        # Hashrate big
        f_hash = get_font(86, bold=True)
        draw.text((90, cy + 172), c["hashrate"], font=f_hash, fill=ORANGE)

        # Daily earn
        f_daily = get_font(46)
        draw.text((90, cy + 278), c["daily"], font=f_daily, fill=GREEN_ACC)

        # Duration
        f_dur = get_font(38)
        draw.text((90, cy + 332), c["duration"], font=f_dur, fill=GRAY)

        # Arrow button
        rounded_rect(draw, W-220, cy+card_h//2-42, W-80, cy+card_h//2+42, 28,
                     ORANGE if is_hl else BG_CARD2)
        f_arr = get_font(48, bold=True)
        arr_bbox = draw.textbbox((0,0), "→", font=f_arr)
        atw = arr_bbox[2]-arr_bbox[0]
        draw.text((W-220 + (140-atw)//2, cy+card_h//2-22), "→", font=f_arr,
                  fill=BG if is_hl else ORANGE)

        cy += card_h + 30

    # Bottom info row
    rounded_rect(draw, 60, 1850, W-60, 1980, 28, BG_CARD)
    info_items = [("[S]", "Secure"), ("+", "Instant"), ["$", "Daily Pay"]]
    iw = (W - 120) // 3
    for i, (icon, txt) in enumerate(info_items):
        ix = 60 + i * iw + iw//2
        f_iico = get_font(52)
        f_itxt = get_font(38)
        bbox = draw.textbbox((0,0), icon, font=f_iico)
        tw = bbox[2]-bbox[0]
        draw.text((ix - tw//2, 1870), icon, font=f_iico, fill=WHITE)
        bbox2 = draw.textbbox((0,0), txt, font=f_itxt)
        tw2 = bbox2[2]-bbox2[0]
        draw.text((ix - tw2//2, 1930), txt, font=f_itxt, fill=GRAY)

    # CTA
    rounded_rect(draw, 80, 2030, W-80, 2180, 50, ORANGE)
    f_cta = get_font(68, bold=True)
    center_text(draw, 2076, "Get Your Free Contract Now  >>", f_cta, BG)

    # Guarantee line
    f_guar = get_font(40)
    center_text(draw, 2240, "No credit card • Cancel anytime", f_guar, GRAY)

    # Footer
    f_foot = get_font(34)
    center_text(draw, 2580, "BTC payouts every 24 hours to your wallet", f_foot, GRAY2)
    f_brand = get_font(34)
    center_text(draw, 2630, "Bitcoin Mining Master — Crypto", f_brand, GRAY2)

    return img


# ══════════════════════════════════════════════════════════════════════════════
# SCREENSHOT 3 — Invite & Earn
# ══════════════════════════════════════════════════════════════════════════════
def make_screenshot_3():
    img = Image.new('RGB', (W, H), BG)
    draw_grid(img)
    draw = ImageDraw.Draw(img)
    gradient_overlay(img, (0, 25, 0, 80), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    status_bar(draw)

    # Header
    f_label = get_font(38)
    center_text(draw, 160, "REFERRAL PROGRAM", f_label, GRAY)
    f_title = get_font(90, bold=True)
    center_text(draw, 230, "Invite Friends,", f_title, WHITE)
    center_text(draw, 338, "Earn Together", f_title, ORANGE)

    # People icons row
    person_y = 490
    for i, (x, scale) in enumerate([(320, 0.8), (621, 1.0), (922, 0.8)]):
        r = int(54 * scale)
        draw.ellipse([x-r, person_y-r, x+r, person_y+r], fill=ORANGE if i==1 else BG_CARD2)
        f_p = get_font(int(55*scale), bold=True)
        label = ["U", "YOU", "U"][i]
        bbox = draw.textbbox((0,0), label, font=f_p)
        tw = bbox[2]-bbox[0]; th = bbox[3]-bbox[1]
        draw.text((x-tw//2, person_y-th//2), label, font=f_p,
                  fill=BG if i==1 else GRAY)
    # Connecting lines
    draw.line([(374, person_y), (567, person_y)], fill=(*ORANGE, 120), width=4)
    draw.line([(675, person_y), (868, person_y)], fill=(*ORANGE, 120), width=4)
    f_arrow = get_font(36)
    draw.text((460, person_y-28), "invite", font=f_arrow, fill=GRAY)
    draw.text((714, person_y-28), "invite", font=f_arrow, fill=GRAY)

    # Commission badge
    comm_bg = tuple(int(BG[i] * 0.8 + ORANGE[i] * 0.2) for i in range(3))
    rounded_rect(draw, 100, 600, W-100, 720, 36, comm_bg, ORANGE, 2)
    f_comm = get_font(52, bold=True)
    center_text(draw, 620, "Earn 10% Commission on Every Friend", f_comm, WHITE)

    # Stats cards
    stats = [
        ("247", "Friends Invited", GREEN_ACC),
        ("$1,284", "Total Earned", ORANGE),
        ("10%", "Commission Rate", WHITE),
    ]
    sw = (W - 160 - 40) // 3
    sx = 80
    for i, (val, lbl, col) in enumerate(stats):
        x1 = sx + i * (sw + 20)
        rounded_rect(draw, x1, 770, x1+sw, 960, 28, BG_CARD)
        f_sv = get_font(72, bold=True)
        bbox = draw.textbbox((0,0), val, font=f_sv)
        tw = bbox[2]-bbox[0]
        draw.text((x1+(sw-tw)//2, 800), val, font=f_sv, fill=col)
        f_sl = get_font(34)
        bbox2 = draw.textbbox((0,0), lbl, font=f_sl)
        tw2 = bbox2[2]-bbox2[0]
        draw.text((x1+(sw-tw2)//2, 900), lbl, font=f_sl, fill=GRAY)

    # Referral code card
    rounded_rect(draw, 80, 1010, W-80, 1210, 36, BG_CARD)
    f_rc_label = get_font(40)
    center_text(draw, 1035, "Your Referral Code", f_rc_label, GRAY)
    rounded_rect(draw, 140, 1080, W-140, 1180, 24, BG_CARD2)
    f_code = get_font(80, bold=True)
    center_text(draw, 1094, "BTC-A8X2KP", f_code, ORANGE)

    # How it works steps
    f_how_title = get_font(58, bold=True)
    center_text(draw, 1256, "How It Works", f_how_title, WHITE)

    steps = [
        ("1", "Share your referral code with friends"),
        ("2", "Friend signs up and starts mining"),
        ("3", "Earn 10% of their mining income forever"),
    ]
    sy = 1330
    for num, text in steps:
        rounded_rect(draw, 80, sy, W-80, sy+110, 28, BG_CARD)
        # Circle number
        draw.ellipse([100, sy+18, 160, sy+78], fill=ORANGE)
        f_num = get_font(44, bold=True)
        bbox = draw.textbbox((0,0), num, font=f_num)
        tw = bbox[2]-bbox[0]; th = bbox[3]-bbox[1]
        draw.text((130-tw//2, sy+38-th//2+2), num, font=f_num, fill=BG)
        f_step = get_font(44)
        draw.text((190, sy + 34), text, font=f_step, fill=WHITE)
        sy += 130

    # Check-in bonus banner
    rounded_rect(draw, 80, 1755, W-80, 1910, 36, (15, 50, 28))
    f_ci = get_font(52, bold=True)
    center_text(draw, 1778, "[+] Daily Check-in Bonus", f_ci, GREEN_ACC)
    f_ci2 = get_font(42)
    center_text(draw, 1848, "Log in daily to earn extra free mining time", f_ci2, GRAY)

    # Check-in days row
    days = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
    dw = (W - 160) // 7
    for i, day in enumerate(days):
        dx = 80 + i * dw + dw//2
        done = i < 4
        bg_d = ORANGE if done else BG_CARD
        draw.ellipse([dx-34, 1940, dx+34, 2008], fill=bg_d)
        f_day = get_font(32, bold=done)
        label = "ok" if done else day
        bbox = draw.textbbox((0,0), label, font=f_day)
        tw = bbox[2]-bbox[0]; th = bbox[3]-bbox[1]
        draw.text((dx-tw//2, 1966-th//2), label,
                  font=f_day, fill=BG if done else GRAY)

    # CTA
    rounded_rect(draw, 80, 2060, W-80, 2210, 50, ORANGE)
    f_cta = get_font(68, bold=True)
    center_text(draw, 2106, "Invite Friends & Earn Now  >>", f_cta, BG)

    f_foot = get_font(40)
    center_text(draw, 2276, "Unlimited referrals • Lifetime commissions", f_foot, GRAY)

    f_brand = get_font(34)
    center_text(draw, 2600, "Bitcoin Mining Master — Crypto", f_brand, GRAY2)

    return img


# ══════════════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    print("Generating screenshots...")
    screenshots = [
        ("screenshot_1_dashboard.png", make_screenshot_1),
        ("screenshot_2_contracts.png", make_screenshot_2),
        ("screenshot_3_referral.png",  make_screenshot_3),
    ]
    for filename, fn in screenshots:
        print(f"  Creating {filename}...")
        img = fn()
        path = os.path.join(OUT_DIR, filename)
        img.save(path, "PNG", optimize=False)
        print(f"  ✓ Saved: {path}  ({img.size[0]}×{img.size[1]})")

    print("\n✅ Done! Upload these 3 PNG files to App Store Connect.")
    print("   (iPhone 6.5\" — 1242×2688px, landscape also accepted)")
