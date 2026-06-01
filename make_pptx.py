"""
Year-in-Review PPTX builder.
Varies photos per slide (1–4) based on aspect ratio + a cycling size pattern
for landscape photos, adds PowerPoint transitions, and auto-advances for video.

Ratio breakdown of this collection (294 photos):
  landscape 1.3–1.6  : 233  (79%)
  portrait  0.5–0.75 :  41  (14%)
  wide      1.6–2.2  :   8
  other              :  12
"""

import re, os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from lxml import etree
from PIL import Image as PILImage

# ── Paths ─────────────────────────────────────────────────────────────────────
IMG_DIR     = "/Users/raashid/MicroMuhammad"
OUTPUT      = "/Users/raashid/MicroMuhammad/YearInReview.pptx"
FOOTER_TEXT = "Imam Al-Asr Microschool"

# ── Slide geometry ─────────────────────────────────────────────────────────────
SLIDE_W = Inches(13.33)
SLIDE_H = Inches(7.5)

OUTER_M  = Inches(0.18)
TOP_M    = Inches(0.15)
BOTTOM_M = Inches(0.12)
FOOTER_H = Inches(0.45)
GAP      = Inches(0.10)   # gap between adjacent images

FOOTER_Y = SLIDE_H - FOOTER_H
C_LEFT   = OUTER_M
C_TOP    = TOP_M
C_W      = SLIDE_W - 2 * OUTER_M          # 12.97"
C_H      = FOOTER_Y - BOTTOM_M - C_TOP    # 6.72"

# ── Colors ────────────────────────────────────────────────────────────────────
BG   = RGBColor(0x0D, 0x1B, 0x2A)
FBAR = RGBColor(0x1A, 0x3A, 0x5C)
GOLD = RGBColor(0xC8, 0xA0, 0x45)
WHITE= RGBColor(0xFF, 0xFF, 0xFF)

# ── PPTX namespace ────────────────────────────────────────────────────────────
P_NS = "http://schemas.openxmlformats.org/presentationml/2006/main"

# ── Transitions (cycled per photo-slide index) ────────────────────────────────
TRANS = [
    ("fade",    {}),
    ("push",    {"dir": "l"}),
    ("push",    {"dir": "r"}),
    ("fade",    {}),
    ("cover",   {"dir": "l"}),
    ("push",    {"dir": "u"}),
    ("wipe",    {"dir": "r"}),
    ("fade",    {}),
    ("split",   {"orient": "vert",  "dir": "out"}),
    ("push",    {"dir": "d"}),
    ("cover",   {"dir": "r"}),
    ("fade",    {}),
    ("split",   {"orient": "horz", "dir": "out"}),
    ("wipe",    {"dir": "l"}),
    ("dissolve",{}),
    ("fade",    {}),
    ("zoom",    {"dir": "in"}),
    ("push",    {"dir": "l"}),
    ("cover",   {"dir": "l"}),
    ("fade",    {}),
]

# ── Auto-advance timing per photo count ──────────────────────────────────────
ADV_MS = {1: 6000, 2: 5000, 3: 6000, 4: 7000}

# ── Batch-size cycle for standard landscape photos ────────────────────────────
# Creates visual rhythm: mostly 4, interspersed with 3, 2, and occasional solo.
# Average ≈ 3.05 → ~76 slides for the 233 landscape photos.
_LAND_CYCLE = [4, 2, 4, 3, 4, 4, 2, 4, 3, 4, 2, 4, 3, 4, 1, 4, 2, 4, 3, 4,
               4, 3, 4, 2, 4, 4, 3, 4, 1, 4, 2, 4, 3, 4, 4, 2, 4, 3, 4, 4]
_land_ctr = [0]

def next_land_max():
    v = _LAND_CYCLE[_land_ctr[0] % len(_LAND_CYCLE)]
    _land_ctr[0] += 1
    return v


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def img_size(path):
    try:
        with PILImage.open(path) as im:
            return im.size
    except Exception:
        return (4, 3)


def categorize(ratio):
    """
    wide_land  : ratio > 1.7   → solo (hero shot)
    landscape  : 1.0–1.7       → batch via cycle (1–4 per slide)
    portrait   : < 1.0         → pair 2 side-by-side
    """
    if ratio > 1.7:
        return "wide_land"
    if ratio >= 1.0:
        return "landscape"
    return "portrait"


def group_images(images):
    """
    images = [(path, w, h), ...]
    Returns list of batches.
      wide_land → solo (1 per slide)
      landscape → 1–4 per slide using _LAND_CYCLE
      portrait  → pair 2; if unpaired → solo
    """
    groups, i, n = [], 0, len(images)

    while i < n:
        _, w, h = images[i]
        cat = categorize(w / h)

        if cat == "wide_land":
            # Wide shot: give it a slide of its own
            groups.append([images[i]])
            i += 1

        elif cat == "landscape":
            max_n = next_land_max()
            batch = [images[i]]
            j = i + 1
            while j < n and len(batch) < max_n:
                _, wj, hj = images[j]
                if categorize(wj / hj) == "landscape":
                    batch.append(images[j])
                    j += 1
                else:
                    break
            groups.append(batch)
            i = j

        else:   # portrait
            batch = [images[i]]
            if i + 1 < n:
                _, wn, hn = images[i + 1]
                if categorize(wn / hn) == "portrait":
                    batch.append(images[i + 1])
                    i += 2
                else:
                    i += 1
            else:
                i += 1
            groups.append(batch)

    return groups


# ─────────────────────────────────────────────────────────────────────────────
# Slide builders
# ─────────────────────────────────────────────────────────────────────────────

def set_bg(slide, color):
    fill = slide.background.fill
    fill.solid()
    fill.fore_color.rgb = color


def add_rect(slide, x, y, w, h, color):
    s = slide.shapes.add_shape(1, x, y, w, h)
    s.fill.solid()
    s.fill.fore_color.rgb = color
    s.line.fill.background()


def add_text(slide, x, y, w, h, text, size, bold, color,
             align=PP_ALIGN.LEFT, font="Calibri"):
    txb = slide.shapes.add_textbox(x, y, w, h)
    tf  = txb.text_frame
    tf.word_wrap = False
    p   = tf.paragraphs[0]
    p.alignment = align
    r   = p.add_run()
    r.text           = text
    r.font.size      = Pt(size)
    r.font.bold      = bold
    r.font.color.rgb = color
    r.font.name      = font


def add_footer(slide, page_num, total):
    add_rect(slide, 0, FOOTER_Y, SLIDE_W, FOOTER_H, FBAR)
    mid = FOOTER_Y + Inches(0.07)
    add_text(slide, Inches(0.25), mid, Inches(9), FOOTER_H,
             FOOTER_TEXT, 13, True, GOLD, PP_ALIGN.LEFT)
    add_text(slide, Inches(12.1), mid, Inches(1.0), FOOTER_H,
             f"{page_num} / {total}", 11, False, WHITE, PP_ALIGN.RIGHT)


def fit_image(slide, path, left, top, width, height):
    """Add image scaled to fill box (aspect-preserved, centred)."""
    iw, ih = img_size(path)
    box_r = width / height
    img_r = iw / ih
    if img_r > box_r:
        dw = width;  dh = width  / img_r
    else:
        dh = height; dw = height * img_r
    slide.shapes.add_picture(path,
                             left + (width  - dw) / 2,
                             top  + (height - dh) / 2,
                             dw, dh)


def render_photos(slide, batch):
    """Place 1–4 photos with an appropriate layout."""
    n = len(batch)
    L, T, W, H, G = C_LEFT, C_TOP, C_W, C_H, GAP

    if n == 1:
        # Full slide — hero shot
        fit_image(slide, batch[0][0], L, T, W, H)

    elif n == 2:
        # Side-by-side (good for both portrait and landscape)
        cw = (W - G) / 2
        fit_image(slide, batch[0][0], L,          T, cw, H)
        fit_image(slide, batch[1][0], L + cw + G, T, cw, H)

    elif n == 3:
        # 1 large on the left, 2 stacked on the right
        cw = (W - G) / 2
        ch = (H - G) / 2
        fit_image(slide, batch[0][0], L,          T,          cw, H)
        fit_image(slide, batch[1][0], L + cw + G, T,          cw, ch)
        fit_image(slide, batch[2][0], L + cw + G, T + ch + G, cw, ch)

    else:   # n == 4  →  2 × 2 grid
        cw = (W - G) / 2
        ch = (H - G) / 2
        for i, img in enumerate(batch):
            row, col = divmod(i, 2)
            fit_image(slide, img[0],
                      L + col * (cw + G),
                      T + row * (ch + G),
                      cw, ch)


def add_transition(slide, idx, n_photos):
    t_type, t_kwargs = TRANS[idx % len(TRANS)]
    sld_el = slide._element

    old = sld_el.find(f"{{{P_NS}}}transition")
    if old is not None:
        sld_el.remove(old)

    tr = etree.Element(f"{{{P_NS}}}transition")
    tr.set("spd",      "med")
    tr.set("advClick", "1")
    tr.set("advTm",    str(ADV_MS.get(n_photos, 5000)))

    if t_type == "fade":
        etree.SubElement(tr, f"{{{P_NS}}}fade")
    elif t_type == "push":
        etree.SubElement(tr, f"{{{P_NS}}}push").set("dir", t_kwargs.get("dir","l"))
    elif t_type == "cover":
        etree.SubElement(tr, f"{{{P_NS}}}cover").set("dir", t_kwargs.get("dir","l"))
    elif t_type == "wipe":
        etree.SubElement(tr, f"{{{P_NS}}}wipe").set("dir", t_kwargs.get("dir","l"))
    elif t_type == "split":
        s = etree.SubElement(tr, f"{{{P_NS}}}split")
        s.set("orient", t_kwargs.get("orient","vert"))
        s.set("dir",    t_kwargs.get("dir","out"))
    elif t_type == "dissolve":
        etree.SubElement(tr, f"{{{P_NS}}}dissolve")
    elif t_type == "zoom":
        etree.SubElement(tr, f"{{{P_NS}}}zoom").set("dir", t_kwargs.get("dir","in"))

    timing = sld_el.find(f"{{{P_NS}}}timing")
    if timing is not None:
        timing.addprevious(tr)
    else:
        sld_el.append(tr)


# ─────────────────────────────────────────────────────────────────────────────
# Build
# ─────────────────────────────────────────────────────────────────────────────

prs = Presentation()
prs.slide_width  = SLIDE_W
prs.slide_height = SLIDE_H
blank = prs.slide_layouts[6]

all_files = sorted(
    [f for f in os.listdir(IMG_DIR) if f.upper().endswith((".JPEG",".JPG"))],
    key=lambda x: int(re.search(r"-(\d+)\.JPEG$", x, re.IGNORECASE).group(1))
)
print(f"Found {len(all_files)} images")

print("Reading dimensions...")
images = []
for i, fname in enumerate(all_files):
    path = os.path.join(IMG_DIR, fname)
    w, h  = img_size(path)
    images.append((path, w, h))
    if (i+1) % 60 == 0:
        print(f"  {i+1}/{len(all_files)}")

groups = group_images(images)
total  = len(groups)

print(f"\n{total} photo slides")
dist = {}
for g in groups:
    dist[len(g)] = dist.get(len(g), 0) + 1
for k in sorted(dist):
    pct = dist[k] * 100 / total
    print(f"  {k}-photo slides: {dist[k]:3d}  ({pct:.0f}%)")
photos_used = sum(len(g) for g in groups)
print(f"Photos placed: {photos_used}")

# ── Title slide ───────────────────────────────────────────────────────────────
ts = prs.slides.add_slide(blank)
set_bg(ts, BG)
add_rect(ts, 0, 0,                         SLIDE_W, Inches(0.08), GOLD)
add_rect(ts, 0, SLIDE_H - Inches(0.08),    SLIDE_W, Inches(0.08), GOLD)
add_rect(ts, Inches(1.18),                 Inches(1.8), Inches(0.05), Inches(3.9), GOLD)
add_rect(ts, SLIDE_W - Inches(1.23),       Inches(1.8), Inches(0.05), Inches(3.9), GOLD)

add_text(ts, Inches(1.5), Inches(2.05), Inches(10.33), Inches(0.9),
         "IMAM AL-ASR MICROSCHOOL", 30, True, GOLD, PP_ALIGN.CENTER)
add_text(ts, Inches(1.5), Inches(3.1),  Inches(10.33), Inches(1.8),
         "Year in Review", 64, True, WHITE, PP_ALIGN.CENTER)
add_rect(ts, Inches(4.5), Inches(5.05), Inches(4.33), Inches(0.05), GOLD)
add_transition(ts, 0, 1)

# ── Photo slides ──────────────────────────────────────────────────────────────
for idx, batch in enumerate(groups):
    slide = prs.slides.add_slide(blank)
    set_bg(slide, BG)
    add_footer(slide, idx + 1, total)
    render_photos(slide, batch)
    add_transition(slide, idx + 1, len(batch))

prs.save(OUTPUT)
print(f"\nSaved → {OUTPUT}")
print(f"Total: 1 title + {total} photo slides = {1 + total} slides")
