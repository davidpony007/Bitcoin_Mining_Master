#!/usr/bin/env python3
"""
App Store Screenshots v2 — based on real app UI
4 screens: Dashboard / Contracts / Referral / Settings
Size: 1242x2688 (iPhone 6.5")
Run: python3 generate_v2.py
"""

from PIL import Image, ImageDraw, ImageFont
import os, math

W, H = 1242, 2688
OUT = os.path.dirname(os.path.abspath(__file__))

# ─── Real App Colors ──────────────────────────────────────────────────────────
BG       = (13,  13,  8)    # near-black warm
CARD     = (30,  30,  18)   # dark warm card
CARD2    = (40,  40,  24)   # slightly lighter card
ORANGE   = (255, 165,  0)
ORANGE2  = (255, 149,  0)
ORANGE_DK= (180, 110,  0)
TEAL     = ( 0,  180, 200)
GREEN    = ( 76, 175,  80)
GREEN_LT = (102, 210,  80)
RED      = (220,  60,  60)
WHITE    = (255, 255, 255)
GRAY     = (160, 160, 140)
GRAY2    = (100, 100,  85)
DIVIDER  = ( 45,  45,  28)

# ─── Font ─────────────────────────────────────────────────────────────────────
def F(size, bold=False):
    candidates = [
        "/System/Library/Fonts/SFNSDisplay.otf",
        "/System/Library/Fonts/SFNSRounded.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/Library/Fonts/Arial.ttf",
        "/System/Library/Fonts/Arial.ttf",
    ]
    bold_candidates = [
        "/System/Library/Fonts/SFNSDisplay-Bold.otf",
        "/System/Library/Fonts/SFNSDisplay.otf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/Library/Fonts/Arial Bold.ttf",
        "/Library/Fonts/Arial.ttf",
    ]
    for p in (bold_candidates if bold else candidates):
        if os.path.exists(p):
            try: return ImageFont.truetype(p, size)
            except: pass
    return ImageFont.load_default()

# ─── Helpers ──────────────────────────────────────────────────────────────────
def rr(draw, x1, y1, x2, y2, r, fill, outline=None, ow=2):
    draw.rounded_rectangle([x1,y1,x2,y2], radius=r, fill=fill,
                            outline=outline, width=ow)

def ct(draw, y, text, font, color, x_offset=0):
    bb = draw.textbbox((0,0), text, font=font)
    tw = bb[2]-bb[0]
    draw.text(((W-tw)//2 + x_offset, y), text, font=font, fill=color)

def rt(draw, x, y, text, font, color):
    """Right-aligned text"""
    bb = draw.textbbox((0,0), text, font=font)
    tw = bb[2]-bb[0]
    draw.text((x-tw, y), text, font=font, fill=color)

def status_bar(draw, time_str="22:05"):
    f = F(48, bold=True)
    draw.text((72, 56), time_str, font=f, fill=WHITE)
    # wifi dots
    for i, (bx, by) in enumerate([(1090,72),(1120,72),(1150,72)]):
        draw.ellipse([bx,by,bx+18,by+18], fill=WHITE)
    # battery
    rr(draw, 1180, 68, 1228, 94, 4, ORANGE)
    draw.text((1184, 68), "100", font=F(22), fill=BG)

def gradient_card(img, x1, y1, x2, y2, r, color_left, color_right):
    """Horizontal gradient rectangle"""
    w = x2 - x1
    h = y2 - y1
    strip = Image.new('RGB', (w, h), color_left)
    draw = ImageDraw.Draw(strip)
    for xi in range(w):
        t = xi / w
        c = tuple(int(color_left[j]*(1-t)+color_right[j]*t) for j in range(3))
        draw.line([(xi,0),(xi,h)], fill=c)
    # Round corners via mask
    mask = Image.new('L', (w, h), 0)
    mdraw = ImageDraw.Draw(mask)
    mdraw.rounded_rectangle([0,0,w,h], radius=r, fill=255)
    img.paste(strip, (x1, y1), mask)

def orange_btn(draw, x1, y1, x2, y2, text, font, r=36):
    rr(draw, x1, y1, x2, y2, r, ORANGE)
    bb = draw.textbbox((0,0), text, font=font)
    tw, th = bb[2]-bb[0], bb[3]-bb[1]
    cx = (x1+x2)//2 - tw//2
    cy = (y1+y2)//2 - th//2
    draw.text((cx, cy), text, font=font, fill=BG)

def outline_btn(draw, x1, y1, x2, y2, text, font, r=36):
    rr(draw, x1, y1, x2, y2, r, CARD, ORANGE, 3)
    bb = draw.textbbox((0,0), text, font=font)
    tw, th = bb[2]-bb[0], bb[3]-bb[1]
    cx = (x1+x2)//2 - tw//2
    cy = (y1+y2)//2 - th//2
    draw.text((cx, cy), text, font=font, fill=ORANGE)

def promo_banner(img, text1, text2=None):
    """Add a dark promo banner at bottom"""
    draw = ImageDraw.Draw(img)
    # Gradient fade to black at very bottom
    for y in range(H-220, H):
        t = (y-(H-220))/220
        c = int(BG[0]*(1-t)+0*t), int(BG[1]*(1-t)+0*t), int(BG[2]*(1-t)+0*t)
        draw.line([(0,y),(W,y)], fill=c)
    f1 = F(56, bold=True)
    f2 = F(40)
    ct(draw, H-180, text1, f1, WHITE)
    if text2:
        ct(draw, H-110, text2, f2, GRAY)

# ══════════════════════════════════════════════════════════════════════════════
# SCREEN 1: Mining Dashboard
# ══════════════════════════════════════════════════════════════════════════════
def screen1():
    img = Image.new('RGB', (W,H), BG)
    draw = ImageDraw.Draw(img)

    status_bar(draw)

    # Title bar
    draw.text((72, 140), "Mining Dashboard", font=F(72, bold=True), fill=WHITE)

    # Calendar icon circle
    rr(draw, 1070, 138, 1152, 220, 22, CARD2)
    draw.text((1090, 147), "[=]", font=F(44), fill=WHITE)

    # Star icon circle
    rr(draw, 1162, 138, 1244, 220, 22, CARD2)
    draw.text((1178, 147), "[*]", font=F(44), fill=WHITE)

    # Balance card (orange-to-blue gradient)
    gradient_card(img, 60, 248, W-60, 470, 36,
                  (220, 120, 0), (80, 100, 180))
    draw = ImageDraw.Draw(img)
    draw.text((96, 268), "Total Balance", font=F(44), fill=(255,255,255,200))
    draw.text((96, 320), "0.000000410 BTC", font=F(72, bold=True), fill=WHITE)
    draw.text((96, 418), "1 BTC = $76,819.90 USD", font=F(42), fill=(230,230,200))

    # Level card
    rr(draw, 60, 494, W-60, 616, 28, CARD)
    rr(draw, 86, 514, 192, 596, 18, CARD2, ORANGE, 3)
    draw.text((108, 530), "Lv.3", font=F(48, bold=True), fill=ORANGE)
    draw.text((220, 518), "Experience", font=F(44), fill=WHITE)
    draw.text((640, 518), "+20%", font=F(44, bold=True), fill=GREEN)
    rt(draw, W-90, 518, "38 / 50", F(44), GRAY)
    # Progress bar bg
    rr(draw, 216, 568, W-88, 604, 12, CARD2)
    # Progress fill 76%
    prog_w = int((W-88-216) * 0.76)
    rr(draw, 216, 568, 216+prog_w, 604, 12, ORANGE)

    # Quick Actions title
    draw.text((72, 648), "Quick Actions", font=F(56, bold=True), fill=WHITE)

    # Free Ad Mining button
    rr(draw, 60, 706, 596, 858, 28, ORANGE)
    draw.text((160, 726), "Free Ad Mining", font=F(52, bold=True), fill=BG)
    draw.text((196, 796), "> 5.5Gh/s", font=F(44), fill=BG)

    # Daily Check-in button
    rr(draw, 622, 706, W-60, 858, 28, CARD2, ORANGE, 3)
    draw.text((680, 720), "Daily Check-in", font=F(46, bold=True), fill=ORANGE)
    draw.text((680, 786), "Reward", font=F(46, bold=True), fill=ORANGE)
    draw.text((698, 814), "7.5Gh/s", font=F(40), fill=GRAY)

    # Mining Pool section
    draw.text((72, 892), "Mining Pool", font=F(56, bold=True), fill=WHITE)
    draw.text((560, 898), "[ = ] = mine 1 hour", font=F(38), fill=GRAY)
    rt(draw, W-72, 898, "7 / 48", F(44, bold=True), ORANGE)

    # Battery grid
    rr(draw, 60, 950, W-60, 1560, 28, CARD)
    bw, bh, gap = 102, 162, 18
    cols = 8
    bx0, by0 = 98, 980
    for row in range(6):
        for col in range(cols):
            bx = bx0 + col*(bw+gap)
            by = by0 + row*(bh+gap)
            active = (row == 0 and col < 7)
            # Battery body
            fill_c = CARD2 if not active else CARD2
            outline_c = ORANGE if active else GRAY2
            rr(draw, bx, by, bx+bw, by+bh, 10, fill_c, outline_c, 3)
            if active:
                # Fill bars
                bar_h = int((bh-20) * 0.75)
                rr(draw, bx+8, by+bh-8-bar_h, bx+bw-8, by+bh-8, 6, ORANGE)
                rr(draw, bx+bw//2-12, by-8, bx+bw//2+12, by+4, 3, ORANGE)

    # Promo overlay
    promo_banner(img,
        "Mine Bitcoin 24/7 — Free to Start",
        "Cloud Mining  |  No Hardware Needed")
    return img


# ══════════════════════════════════════════════════════════════════════════════
# SCREEN 2: Contracts
# ══════════════════════════════════════════════════════════════════════════════
def screen2():
    img = Image.new('RGB', (W,H), BG)
    draw = ImageDraw.Draw(img)

    status_bar(draw)

    # Title bar
    draw.text((72, 140), "Contracts", font=F(72, bold=True), fill=WHITE)
    # Buy Contract button
    rr(draw, 900, 145, W-60, 225, 22, CARD2)
    draw.text((780, 152), "[ + ]", font=F(44), fill=ORANGE)
    draw.text((830, 152), "Buy Contract", font=F(44, bold=True), fill=ORANGE)

    # Tab bar
    draw.text((120, 280), "All", font=F(52, bold=True), fill=ORANGE)
    rr(draw, 110, 334, 220, 344, 5, ORANGE)
    draw.text((560, 280), "Expired", font=F(52), fill=GRAY)
    draw.line([(60, 350),(W-60,350)], fill=DIVIDER, width=2)

    # Chip illustration card
    rr(draw, 60, 368, W-60, 820, 36, CARD)
    # Chip grid decoration
    chip_cx, chip_cy = W//2, 594
    # Outer border
    rr(draw, chip_cx-240, chip_cy-190, chip_cx+240, chip_cy+190, 24,
       (20,35,50), (0,140,180), 3)
    # Inner grid lines
    for gx in range(chip_cx-200, chip_cx+210, 40):
        draw.line([(gx, chip_cy-160),(gx, chip_cy+160)], fill=(40,100,80), width=1)
    for gy in range(chip_cy-160, chip_cy+170, 40):
        draw.line([(chip_cx-200, gy),(chip_cx+200, gy)], fill=(40,100,80), width=1)
    # Center chip
    rr(draw, chip_cx-90, chip_cy-90, chip_cx+90, chip_cy+90, 18, (30,40,55))
    draw.text((chip_cx-52, chip_cy-64), "B", font=F(130, bold=True), fill=ORANGE)
    # Corner fans
    for fx, fy in [(chip_cx-210,chip_cy-170),(chip_cx+210,chip_cy-170),
                   (chip_cx-210,chip_cy+170),(chip_cx+210,chip_cy+170)]:
        draw.ellipse([fx-32,fy-32,fx+32,fy+32], fill=(40,160,200))
        draw.ellipse([fx-20,fy-20,fx+20,fy+20], fill=(20,80,100))
    # LV badge
    rr(draw, chip_cx-50, chip_cy-230, chip_cx+50, chip_cy-180, 12, (0,140,180))
    draw.text((chip_cx-38, chip_cy-228), "LV.3", font=F(42, bold=True), fill=WHITE)

    # Pin row at bottom of chip
    for pi in range(10):
        px = chip_cx - 180 + pi*40
        rr(draw, px, chip_cy+190, px+22, chip_cy+230, 4, ORANGE)

    # Contract items
    contracts = [
        ("7.5 Gh/s", "Daily Check-in Reward", None, RED,    "Not Active"),
        ("5.5 Gh/s", "Free Ad Reward",         "06h 53m 02s", GREEN, "Active"),
        ("5.5 Gh/s", "Invite Friend Reward",   None, RED,    "Not Active"),
    ]
    cy2 = 848
    for hashrate, name, timer, dot_col, status_text in contracts:
        rr(draw, 60, cy2, W-60, cy2+136, 28, CARD, ORANGE, 2)
        # BTC icon circle
        draw.ellipse([84, cy2+22, 180, cy2+118], fill=CARD2)
        draw.text((110, cy2+34), "B", font=F(62, bold=True), fill=ORANGE)
        # Hashrate
        draw.text((206, cy2+24), hashrate, font=F(62, bold=True), fill=WHITE)
        draw.text((206, cy2+88), name, font=F(40), fill=GRAY)
        # Status dot + text
        dot_x = W - 340
        draw.ellipse([dot_x, cy2+52, dot_x+22, cy2+74], fill=dot_col)
        st_text = timer if timer else status_text
        st_col = GREEN if timer else GRAY
        draw.text((dot_x+34, cy2+44), st_text, font=F(42, bold=True), fill=st_col)
        cy2 += 158

    # Subscription section
    draw.text((72, cy2+14), "Subscription Contract Queue",
              font=F(52, bold=True), fill=WHITE)
    # Starter Plan card
    rr(draw, 60, cy2+80, W-60, cy2+220, 28, (15,30,50), (0,100,180), 3)
    draw.text((100, cy2+100), "Starter Plan", font=F(56, bold=True), fill=WHITE)
    rt(draw, W-90, cy2+100, "176.3 Gh/s", F(52, bold=True), TEAL)
    draw.text((100, cy2+168), "Active  30 days remaining", font=F(42), fill=GRAY)

    promo_banner(img,
        "Auto-Mining Contracts — Set & Forget",
        "Free Contracts Available  |  No Investment Required")
    return img


# ══════════════════════════════════════════════════════════════════════════════
# SCREEN 3: Referral / Invite Friends
# ══════════════════════════════════════════════════════════════════════════════
def screen3():
    img = Image.new('RGB', (W,H), BG)
    draw = ImageDraw.Draw(img)

    status_bar(draw)

    # Title
    draw.text((72, 140), "Invite Friends", font=F(72, bold=True), fill=WHITE)
    # Help icon
    rr(draw, 1130, 140, 1212, 222, 36, CARD2)
    ct(draw, 150, "?", F(56, bold=True), WHITE)

    # Rebate earnings card (orange-to-green gradient)
    gradient_card(img, 60, 256, W-60, 480, 36,
                  (200, 120, 0), (50, 160, 60))
    draw = ImageDraw.Draw(img)
    # People icon
    draw.text((96, 276), "(@)", font=F(48), fill=WHITE)
    draw.text((240, 280), "Total Rebate Earnings", font=F(48), fill=WHITE)
    # 20% badge
    rr(draw, W-210, 276, W-80, 336, 28, (255,255,255,60))
    rr(draw, W-210, 276, W-80, 336, 28, (80,200,80), None)
    draw.text((W-198, 280), "20%", font=F(48, bold=True), fill=WHITE)
    draw.text((96, 348), "0.000000000 BTC", font=F(72, bold=True), fill=WHITE)

    # Invitation code card
    rr(draw, 60, 504, W-60, 720, 28, CARD)
    draw.text((96, 524), "My Invitation Code", font=F(44), fill=GRAY)
    rr(draw, 86, 572, W-86, 668, 20, CARD2, ORANGE, 2)
    ct(draw, 588, "INV20260417083555562799", F(52, bold=True), ORANGE)
    # Copy + Share buttons
    orange_btn(draw, 86, 682, 584, 786, "[ ] Copy", F(52, bold=True), 28)
    outline_btn(draw, 608, 682, W-86, 786, "< > Share", F(52, bold=True), 28)

    # Invited Friends section
    draw.text((72, 826), "Invited Friends", font=F(56, bold=True), fill=WHITE)
    rt(draw, W-72, 832, "Total: 0", F(48, bold=True), ORANGE)
    draw.line([(60,880),(W-60,880)], fill=DIVIDER, width=1)

    # Empty state
    rr(draw, 60, 896, W-60, 1140, 28, CARD)
    # Person add icon
    draw.text((520, 938), "+@", font=F(72), fill=GRAY2)
    ct(draw, 1040, "No invited friends yet", F(48), GRAY)

    # Rebate Records section
    draw.text((72, 1176), "Rebate Records", font=F(56, bold=True), fill=WHITE)
    rr(draw, 500, 1180, 690, 1236, 18, CARD2)
    draw.text((514, 1188), "Last 3 Days", font=F(38), fill=ORANGE)
    rt(draw, W-72, 1182, "View All", F(48, bold=True), ORANGE)

    # How to earn steps
    draw.line([(60,1252),(W-60,1252)], fill=DIVIDER, width=1)
    draw.text((72, 1274), "How to Earn", font=F(56, bold=True), fill=WHITE)
    steps = [
        ("1", "Share your invitation code with friends"),
        ("2", "Friend registers and starts mining"),
        ("3", "Earn 20% of their mining income forever"),
    ]
    sy = 1358
    for num, txt in steps:
        rr(draw, 60, sy, W-60, sy+118, 28, CARD)
        draw.ellipse([82, sy+20, 148, sy+96], fill=ORANGE)
        f_n = F(52, bold=True)
        nb = draw.textbbox((0,0),num,font=f_n)
        draw.text((115-(nb[2]-nb[0])//2, sy+30), num, font=f_n, fill=BG)
        draw.text((174, sy+34), txt, font=F(44), fill=WHITE)
        sy += 140

    # CTA button
    rr(draw, 60, sy+30, W-60, sy+168, 50, ORANGE)
    ct(draw, sy+56, "Invite Now & Earn Together", F(60, bold=True), BG)

    promo_banner(img,
        "20% Lifetime Referral Commission",
        "Unlimited Invites  |  Instant BTC Rewards")
    return img


# ══════════════════════════════════════════════════════════════════════════════
# SCREEN 4: Settings
# ══════════════════════════════════════════════════════════════════════════════
def screen4():
    img = Image.new('RGB', (W,H), BG)
    draw = ImageDraw.Draw(img)

    status_bar(draw)

    # Title
    draw.text((72, 140), "Settings", font=F(72, bold=True), fill=WHITE)

    # User profile card
    rr(draw, 60, 248, W-60, 464, 28, CARD)
    # Avatar circle
    draw.ellipse([88, 274, 228, 414], fill=CARD2)
    draw.text((130, 296), "(@)", font=F(66), fill=GRAY)
    # Name + ID
    draw.text((268, 278), "Guest User", font=F(64, bold=True), fill=WHITE)
    draw.text((268, 356), "User ID:", font=F(42), fill=GRAY)
    draw.text((268, 356+2), "        U20260417083555562799", font=F(42), fill=ORANGE)
    # Level badge
    rr(draw, 268, 408, 388, 456, 14, CARD2, ORANGE, 2)
    draw.text((284, 412), "Lv.3", font=F(42, bold=True), fill=ORANGE)
    # Edit icon
    draw.text((W-148, 290), "/ Edit", font=F(46), fill=GRAY)

    # System time card
    rr(draw, 60, 488, W-60, 624, 28, CARD, ORANGE, 2)
    # Clock icon circle
    draw.ellipse([86, 510, 176, 600], fill=CARD2)
    draw.text((106, 520), "(o)", font=F(54), fill=ORANGE)
    draw.text((210, 516), "System Time (UTC+00:00)", font=F(40), fill=GRAY)
    draw.text((210, 562), "2026-04-17  14:05:50", font=F(54, bold=True), fill=WHITE)
    rr(draw, W-190, 538, W-86, 594, 18, (30,60,30))
    draw.text((W-182, 542), "UTC", font=F(42, bold=True), fill=GREEN)

    # General section
    draw.text((72, 660), "General", font=F(50), fill=GRAY)

    rr(draw, 60, 712, W-60, 964, 28, CARD)
    # Language row
    draw.ellipse([86, 728, 176, 818], fill=CARD2)
    draw.text((104, 738), "(@)", font=F(54), fill=ORANGE)
    draw.text((210, 742), "Language", font=F(52, bold=True), fill=WHITE)
    draw.text((210, 800), "English", font=F(44), fill=GRAY)
    rt(draw, W-90, 760, ">", F(60), GRAY)
    draw.line([(210, 850),(W-60,850)], fill=DIVIDER, width=1)
    # Push notifications row
    draw.ellipse([86, 866, 176, 956], fill=CARD2)
    draw.text((104, 876), "(^)", font=F(54), fill=ORANGE)
    draw.text((210, 880), "Push Notifications", font=F(52, bold=True), fill=WHITE)
    draw.text((210, 936), "Receive important messages", font=F(38), fill=GRAY)
    # Toggle (ON)
    toggle_x = W - 200
    rr(draw, toggle_x, 888, toggle_x+130, 944, 28, ORANGE)
    draw.ellipse([toggle_x+68, 894, toggle_x+124, 938], fill=WHITE)

    # Account section
    draw.text((72, 1002), "Account", font=F(50), fill=GRAY)
    rr(draw, 60, 1054, W-60, 1196, 28, CARD)
    # Apple icon circle
    draw.ellipse([86, 1070, 176, 1160], fill=(20, 80, 30))
    draw.text((108, 1080), "[A]", font=F(54, bold=True), fill=GREEN)
    draw.text((210, 1086), "Apple Account", font=F(52, bold=True), fill=WHITE)
    draw.text((210, 1144), "Linked  ...1215", font=F(44), fill=GRAY)
    # Lock icon
    rt(draw, W-90, 1100, "[lock]", F(44), GRAY)

    # Subscriptions section
    draw.text((72, 1234), "Subscriptions", font=F(50), fill=GRAY)
    rr(draw, 60, 1286, W-60, 1428, 28, CARD)
    draw.ellipse([86, 1302, 176, 1392], fill=CARD2)
    draw.text((104, 1312), "[=]", font=F(54), fill=ORANGE)
    draw.text((210, 1316), "Manage Subscriptions", font=F(52, bold=True), fill=WHITE)
    draw.text((210, 1374), "View active plans & billing", font=F(44), fill=GRAY)
    rt(draw, W-90, 1334, ">", F(60), GRAY)

    # Wallet section
    draw.text((72, 1466), "Wallet", font=F(50), fill=GRAY)
    rr(draw, 60, 1518, W-60, 1660, 28, CARD)
    draw.ellipse([86, 1534, 176, 1624], fill=CARD2)
    draw.text((104, 1544), "[$]", font=F(54), fill=ORANGE)
    draw.text((210, 1548), "Withdrawal Address", font=F(52, bold=True), fill=WHITE)
    draw.text((210, 1606), "BEP20 (BSC) Network", font=F(44), fill=GRAY)
    rt(draw, W-90, 1566, ">", F(60), GRAY)

    # About section
    draw.text((72, 1698), "About", font=F(50), fill=GRAY)
    rr(draw, 60, 1750, W-60, 1892, 28, CARD)
    draw.ellipse([86, 1766, 176, 1856], fill=CARD2)
    draw.text((106, 1776), "(i)", font=F(54), fill=ORANGE)
    draw.text((210, 1780), "Version", font=F(52, bold=True), fill=WHITE)
    rt(draw, W-90, 1786, "1.0.2 (22)", F(48), GRAY)
    draw.text((210, 1838), "Bitcoin Mining Master", font=F(40), fill=GRAY)

    promo_banner(img,
        "Secure  |  Apple Sign-In  |  Multi-Language",
        "Your account & privacy fully protected")
    return img


# ─── Bottom nav bar ────────────────────────────────────────────────────────────
def add_navbar(img, active_index):
    draw = ImageDraw.Draw(img)
    nav_y = H - 200
    draw.rectangle([(0, nav_y),(W, H)], fill=(18,18,10))
    draw.line([(0, nav_y),(W, nav_y)], fill=DIVIDER, width=2)
    items = ["Mining", "Contracts", "Referral", "Wallet", "Settings"]
    icons = ["[##]", "[=]", "[<>]", "[w]", "[*]"]
    nw = W // len(items)
    for i, (icon, name) in enumerate(zip(icons, items)):
        cx = i * nw + nw//2
        col = ORANGE if i == active_index else GRAY
        f_ic = F(44, bold=i==active_index)
        f_nm = F(34, bold=i==active_index)
        ib = draw.textbbox((0,0), icon, font=f_ic)
        draw.text((cx-(ib[2]-ib[0])//2, nav_y+22), icon, font=f_ic, fill=col)
        nb = draw.textbbox((0,0), name, font=f_nm)
        draw.text((cx-(nb[2]-nb[0])//2, nav_y+90), name, font=f_nm, fill=col)


# ═══════════════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    tasks = [
        ("screen1_mining_dashboard.png",  screen1,  0),
        ("screen2_contracts.png",         screen2,  1),
        ("screen3_referral.png",          screen3,  2),
        ("screen4_settings.png",          screen4,  4),
    ]
    print("Generating App Store screenshots v2...")
    for fname, fn, nav_idx in tasks:
        print(f"  Creating {fname}...")
        img = fn()
        add_navbar(img, nav_idx)
        path = os.path.join(OUT, fname)
        img.save(path, "PNG")
        print(f"  Saved: {path}  {img.size}")
    print("\nDone! 4 screenshots ready for App Store Connect.")
