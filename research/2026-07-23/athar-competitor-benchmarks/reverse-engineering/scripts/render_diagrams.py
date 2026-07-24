#!/usr/bin/env python
"""Render the two Arabic product diagrams to portable PNG files."""

from __future__ import annotations

import math
from pathlib import Path

import arabic_reshaper
from bidi.algorithm import get_display
from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "diagrams"
FONT_REGULAR = Path(r"C:\Windows\Fonts\segoeui.ttf")
FONT_BOLD = Path(r"C:\Windows\Fonts\segoeuib.ttf")

CANVAS = "#ECEFF2"
SURFACE = "#FFFFFF"
INK = "#15202B"
MUTED = "#5A6672"
FAINT = "#8A929B"
LINE = "#D8DEE4"
PRIMARY = "#1D4E77"
PRIMARY_SOFT = "#E9F1F7"
ACCENT = "#A9722B"
ACCENT_SOFT = "#F4EDE1"
SUCCESS = "#2F7A57"
SUCCESS_SOFT = "#E4F1EA"
DANGER = "#B23B32"
DANGER_SOFT = "#F7E4E1"


def rtl(text: str) -> str:
    return get_display(arabic_reshaper.reshape(text))


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(
        str(FONT_BOLD if bold else FONT_REGULAR),
        size=size,
    )


def text_center(
    draw: ImageDraw.ImageDraw,
    center: tuple[int, int],
    value: str,
    size: int,
    fill: str = INK,
    bold: bool = False,
) -> None:
    draw.text(
        center,
        rtl(value),
        font=font(size, bold),
        fill=fill,
        anchor="mm",
    )


def text_right(
    draw: ImageDraw.ImageDraw,
    point: tuple[int, int],
    value: str,
    size: int,
    fill: str = INK,
    bold: bool = False,
) -> None:
    draw.text(
        point,
        rtl(value),
        font=font(size, bold),
        fill=fill,
        anchor="ra",
    )


def add_shadow(
    image: Image.Image,
    box: tuple[int, int, int, int],
    radius: int = 16,
) -> None:
    layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    offset_box = (box[0], box[1] + 8, box[2], box[3] + 8)
    draw.rounded_rectangle(offset_box, radius=radius, fill=(21, 32, 43, 34))
    layer = layer.filter(ImageFilter.GaussianBlur(12))
    image.alpha_composite(layer)


def rounded_box(
    image: Image.Image,
    box: tuple[int, int, int, int],
    fill: str = SURFACE,
    outline: str = LINE,
    width: int = 2,
    radius: int = 16,
) -> None:
    add_shadow(image, box, radius)
    ImageDraw.Draw(image).rounded_rectangle(
        box,
        radius=radius,
        fill=fill,
        outline=outline,
        width=width,
    )


def diamond(
    image: Image.Image,
    center: tuple[int, int],
    rx: int,
    ry: int,
    fill: str = ACCENT_SOFT,
    outline: str = ACCENT,
) -> None:
    x, y = center
    points = [(x, y - ry), (x + rx, y), (x, y + ry), (x - rx, y)]
    shadow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    shadow_points = [(px, py + 8) for px, py in points]
    ImageDraw.Draw(shadow).polygon(shadow_points, fill=(21, 32, 43, 34))
    image.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(12)))
    draw = ImageDraw.Draw(image)
    draw.polygon(points, fill=fill, outline=outline)
    draw.line(points + [points[0]], fill=outline, width=2)


def arrow(
    draw: ImageDraw.ImageDraw,
    start: tuple[int, int],
    end: tuple[int, int],
    fill: str = FAINT,
    width: int = 3,
    dashed: bool = False,
) -> None:
    x1, y1 = start
    x2, y2 = end
    if dashed:
        length = math.hypot(x2 - x1, y2 - y1)
        if length:
            ux = (x2 - x1) / length
            uy = (y2 - y1) / length
            cursor = 0.0
            while cursor < length - 14:
                seg_end = min(cursor + 9, length - 14)
                draw.line(
                    (
                        x1 + ux * cursor,
                        y1 + uy * cursor,
                        x1 + ux * seg_end,
                        y1 + uy * seg_end,
                    ),
                    fill=fill,
                    width=width,
                )
                cursor += 17
    else:
        draw.line((x1, y1, x2, y2), fill=fill, width=width)
    angle = math.atan2(y2 - y1, x2 - x1)
    head = 14
    left = (
        x2 - head * math.cos(angle - math.pi / 6),
        y2 - head * math.sin(angle - math.pi / 6),
    )
    right = (
        x2 - head * math.cos(angle + math.pi / 6),
        y2 - head * math.sin(angle + math.pi / 6),
    )
    draw.polygon([(x2, y2), left, right], fill=fill)


def step_card(
    image: Image.Image,
    box: tuple[int, int, int, int],
    title: str,
    detail: str,
    fill: str = SURFACE,
    outline: str = LINE,
) -> None:
    rounded_box(image, box, fill, outline)
    draw = ImageDraw.Draw(image)
    cx = (box[0] + box[2]) // 2
    text_center(draw, (cx, box[1] + 44), title, 20, bold=True)
    text_center(draw, (cx, box[1] + 78), detail, 15, fill=MUTED)


def render_reviewer_journey() -> Path:
    image = Image.new("RGBA", (1600, 1050), CANVAS)
    draw = ImageDraw.Draw(image)
    text_right(draw, (1500, 82), "رحلة المراجع المقترحة في أثر", 42, bold=True)
    text_right(
        draw,
        (1500, 145),
        "تركيب نظيف من أفضل أنماط المنافسين مع بقاء القرار والتفسير داخل أثر",
        20,
        fill=MUTED,
    )

    text_right(draw, (1470, 165), "الفرز", 19, fill=PRIMARY, bold=True)
    step_card(image, (1120, 210, 1480, 320), "فتح صندوق الأعمال", "عالي الأثر • متعارض • ناقص • جاهز")
    arrow(draw, (1120, 265), (1010, 265))
    step_card(image, (650, 210, 1010, 320), "اختيار العمل", "تركيز الخريطة وفتح ملف القرار")
    arrow(draw, (650, 265), (540, 265))
    diamond(image, (380, 265), 160, 70)
    text_center(draw, (380, 252), "هل البيانات مكتملة؟", 20, bold=True)
    text_center(draw, (380, 286), "المصدر • الحداثة • الثقة", 15, fill=MUTED)

    text_right(draw, (1470, 385), "التحليل", 19, fill=PRIMARY, bold=True)
    arrow(draw, (380, 335), (540, 420))
    step_card(image, (540, 365, 900, 475), "حساب الأثر والتعارض", "الزمن • الأشخاص • الطابور • المحفظة")
    arrow(draw, (540, 420), (430, 420))
    diamond(image, (270, 420), 160, 70)
    text_center(draw, (270, 407), "هل الحالة عالية؟", 20, bold=True)
    text_center(draw, (270, 441), "أثر مرتفع أو ثقة منخفضة", 15, fill=MUTED)
    step_card(
        image,
        (280, 510, 640, 620),
        "محاكاة أو مراجعة متخصصة",
        "تعود المؤشرات ولا تنتقل ملكية القرار",
        fill=DANGER_SOFT,
        outline=DANGER,
    )
    arrow(draw, (270, 490), (460, 510))
    step_card(image, (760, 510, 1120, 620), "ترتيب ثلاثة بدائل", "الطلب الأصلي • نافذة محسنة • مراحل")
    arrow(draw, (640, 565), (760, 565))
    arrow(draw, (270, 490), (760, 565), dashed=True)

    text_right(draw, (1470, 680), "القرار", 19, fill=PRIMARY, bold=True)
    step_card(image, (1120, 645, 1480, 755), "مراجعة الأسباب والقيود", "الفرق الرقمي • المصدر • حدود الثقة")
    arrow(draw, (940, 620), (1120, 700))
    arrow(draw, (1120, 700), (1010, 700))
    step_card(image, (650, 645, 1010, 755), "تحرير مسودة خطة المرور", "المسار • العلامات • المراحل • الطباعة")
    arrow(draw, (650, 700), (540, 700))
    diamond(image, (380, 700), 160, 70)
    text_center(draw, (380, 687), "قرار المراجع", 20, bold=True)
    text_center(draw, (380, 721), "اعتماد • إرجاع • رفض", 15, fill=MUTED)

    text_right(draw, (1470, 850), "التنفيذ والتعلم", 19, fill=PRIMARY, bold=True)
    step_card(
        image,
        (560, 800, 870, 910),
        "النشر والمراقبة",
        "إقرار القناة • حالة ميدانية • تنبيه",
        fill=SUCCESS_SOFT,
        outline=SUCCESS,
    )
    arrow(draw, (380, 770), (560, 855))
    step_card(
        image,
        (980, 800, 1340, 910),
        "المقارنة والمعايرة",
        "المتوقع مقابل المرصود ثم تحديث الذاكرة",
        fill=SUCCESS_SOFT,
        outline=SUCCESS,
    )
    arrow(draw, (870, 855), (980, 855))

    draw.line((70, 970, 1530, 970), fill=LINE, width=2)
    text_right(
        draw,
        (1500, 1015),
        "المبدأ: لا قرار بلا نسخة مدخلات، ولا نشر بلا صلاحية زمنية، ولا معايرة بلا جودة مصدر",
        15,
        fill=MUTED,
    )
    output = OUTPUT / "athar-reviewer-journey.png"
    image.convert("RGB").save(output, quality=95)
    return output


def render_architecture() -> Path:
    image = Image.new("RGBA", (1600, 980), CANVAS)
    draw = ImageDraw.Draw(image)
    text_right(draw, (1500, 82), "معمار القدرات: ما يملكه أثر وما يتكامل معه", 42, bold=True)
    text_right(
        draw,
        (1500, 145),
        "الهدف منع إعادة بناء التصاريح والملاحة والمحاكاة والأجهزة داخل منتج واحد",
        20,
        fill=MUTED,
    )

    text_right(draw, (1470, 170), "الواجهات", 23, bold=True)
    step_card(image, (1040, 215, 1470, 335), "مكتب المراجع", "صندوق الأعمال • الخريطة • ملف القرار")
    step_card(image, (585, 215, 975, 335), "واجهة الميدان", "مهام • بدء وإيقاف • قياس • صور")
    step_card(image, (130, 215, 520, 335), "الخريطة العامة", "بحث • وصف مبسط • تحويلة • حداثة")

    arrow(draw, (1255, 335), (1255, 440))
    arrow(draw, (780, 335), (780, 440))
    arrow(draw, (325, 335), (325, 440))

    text_right(draw, (1470, 390), "قلب أثر", 23, bold=True)
    step_card(
        image,
        (1040, 440, 1470, 610),
        "محرك القرار",
        "الأثر • البدائل • التفسير • الثقة",
        fill=PRIMARY_SOFT,
        outline=PRIMARY,
    )
    text_center(draw, (1255, 565), "ميزانية المحور • قواعد التصعيد", 15, fill=MUTED)
    step_card(
        image,
        (585, 440, 975, 610),
        "التنسيق والخطة",
        "التعارض • الحفر المشترك • الخطة",
        fill=PRIMARY_SOFT,
        outline=PRIMARY,
    )
    text_center(draw, (780, 565), "الحالات • النسخ • سجل التدقيق", 15, fill=MUTED)
    step_card(
        image,
        (130, 440, 520, 610),
        "النشر والتعلم",
        "التحقق • القنوات • المراقبة",
        fill=PRIMARY_SOFT,
        outline=PRIMARY,
    )
    text_center(draw, (325, 565), "المتوقع مقابل المرصود • المعايرة", 15, fill=MUTED)

    text_right(draw, (1470, 665), "التكاملات", 23, bold=True)
    step_card(
        image,
        (1150, 715, 1470, 835),
        "التصاريح الوطنية",
        "الهوية • الطلب • الحالة • القرار",
        fill=SUCCESS_SOFT,
        outline=SUCCESS,
    )
    step_card(
        image,
        (800, 715, 1100, 835),
        "الحركة والتوجيه",
        "سرعات • طلب • مسارات",
        fill=SUCCESS_SOFT,
        outline=SUCCESS,
    )
    step_card(
        image,
        (450, 715, 750, 835),
        "النشر والخرائط",
        "سجل معياري • إقرار • انتهاء",
        fill=SUCCESS_SOFT,
        outline=SUCCESS,
    )
    step_card(
        image,
        (130, 715, 400, 835),
        "الميدان والبيانات",
        "أجهزة • مرافق • نقل عام",
        fill=SUCCESS_SOFT,
        outline=SUCCESS,
    )

    arrow(draw, (1255, 610), (1310, 715))
    arrow(draw, (1120, 610), (950, 715))
    arrow(draw, (780, 610), (600, 715))
    arrow(draw, (325, 610), (265, 715))

    rounded_box(image, (535, 875, 1065, 955), ACCENT_SOFT, ACCENT)
    text_center(draw, (800, 906), "محاكاة متخصصة للحالات العالية فقط", 18, bold=True)
    text_center(draw, (800, 935), "تستقبل حزمة سيناريو وتعيد مؤشرات قابلة للمقارنة", 15, fill=MUTED)
    arrow(draw, (950, 835), (950, 875))

    output = OUTPUT / "athar-capability-architecture.png"
    image.convert("RGB").save(output, quality=95)
    return output


def main() -> int:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    outputs = [render_reviewer_journey(), render_architecture()]
    for output in outputs:
        print(f"{output.name}: {output.stat().st_size}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
