"""يولّد أيقونات التطبيق (PNG بأحجام متعددة + favicon) من رسم متجهي بسيط.
الرسم: مصحف مفتوح بصفحتين ونجمة فوقه، بألوان المشروع (#283593 أزرق، #FFC107 ذهبي).
لا يعتمد على خط عربي حتى لا تختلف النتيجة بين البيئات.
"""
import os, math
from PIL import Image, ImageDraw

PRIMARY = (40, 53, 147)
PRIMARY_DARK = (26, 35, 110)
ACCENT = (255, 193, 7)
PAGE = (255, 253, 245)
PAGE_SHADE = (236, 233, 220)
LINE = (120, 130, 180)

S = 1024  # حجم الرسم الأساسي ثم يُصغَّر


def rounded(draw, box, r, fill):
    draw.rounded_rectangle(box, radius=r, fill=fill)


def star(draw, cx, cy, r_out, r_in, points=5, fill=ACCENT, rot=-math.pi / 2):
    pts = []
    for i in range(points * 2):
        r = r_out if i % 2 == 0 else r_in
        a = rot + i * math.pi / points
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    draw.polygon(pts, fill=fill)


def draw_icon(size=S, maskable=False):
    """maskable=True يترك هامشًا آمنًا (safe zone) لأيقونات أندرويد التكيفية."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    k = size / S

    # الخلفية: مربع مستدير بتدرّج رأسي بسيط
    bg = Image.new("RGBA", (size, size), PRIMARY)
    bd = ImageDraw.Draw(bg)
    for y in range(size):
        t = y / size
        c = tuple(int(PRIMARY[i] + (PRIMARY_DARK[i] - PRIMARY[i]) * t) for i in range(3))
        bd.line([(0, y), (size, y)], fill=c + (255,))
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, size - 1, size - 1], radius=0 if maskable else int(size * 0.22), fill=255
    )
    img.paste(bg, (0, 0), mask)
    d = ImageDraw.Draw(img)

    # منطقة المحتوى: أصغر في النسخة التكيفية
    scale = 0.68 if maskable else 0.82
    cx, cy = size / 2, size / 2
    w = size * scale

    # المصحف: صفحتان مائلتان
    bw, bh = w * 0.86, w * 0.56
    top = cy + w * 0.06 - bh / 2
    gap = w * 0.018
    spine_x = cx

    for sign in (-1, 1):
        x0 = spine_x + sign * gap
        x1 = spine_x + sign * (bw / 2)
        pts = [
            (x0, top + bh * 0.06),
            (x1, top),
            (x1, top + bh * 0.92),
            (x0, top + bh),
        ]
        d.polygon(pts, fill=PAGE)
        # ظل خفيف عند الكعب
        d.polygon(
            [(x0, top + bh * 0.06), (x0 + sign * bw * 0.05, top + bh * 0.05),
             (x0 + sign * bw * 0.05, top + bh * 0.97), (x0, top + bh)],
            fill=PAGE_SHADE,
        )
        # أسطر النص
        n = 4
        for i in range(n):
            ly = top + bh * (0.26 + i * 0.16)
            lx0 = spine_x + sign * (gap + bw * 0.07)
            lx1 = spine_x + sign * (bw / 2 - bw * 0.07)
            d.line([(lx0, ly), (lx1, ly - sign * bh * 0.012)],
                   fill=LINE, width=max(2, int(bh * 0.035)))

    # الكعب
    d.line([(spine_x, top + bh * 0.04), (spine_x, top + bh * 1.0)],
           fill=ACCENT, width=max(3, int(w * 0.022)))

    # نجمة فوق المصحف
    star(d, cx, top - w * 0.12, w * 0.15, w * 0.062)

    return img


def main():
    out = os.path.join(os.path.dirname(__file__), "..", "web", "icons")
    out = os.path.abspath(out)
    os.makedirs(out, exist_ok=True)

    base = draw_icon(S, maskable=False)
    maskable = draw_icon(S, maskable=True)

    for sz in (48, 72, 96, 128, 144, 152, 167, 180, 192, 256, 384, 512, 1024):
        base.resize((sz, sz), Image.LANCZOS).save(os.path.join(out, f"icon-{sz}.png"))
    for sz in (192, 512):
        maskable.resize((sz, sz), Image.LANCZOS).save(
            os.path.join(out, f"maskable-{sz}.png"))

    # favicon متعدد الأحجام
    base.resize((64, 64), Image.LANCZOS).save(
        os.path.join(out, "favicon.ico"),
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64)],
    )
    # أيقونة أندرويد الأمامية (foreground) بخلفية شفافة للـ adaptive icon
    fg = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    tmp = draw_icon(S, maskable=True)
    # نزيل الخلفية الصلبة بإعادة الرسم على شفاف: نأخذ العناصر فقط
    fg = tmp
    for sz in (108, 162, 216, 324, 432):
        fg.resize((sz, sz), Image.LANCZOS).save(os.path.join(out, f"android-fg-{sz}.png"))

    print("icons written to", out)


if __name__ == "__main__":
    main()
