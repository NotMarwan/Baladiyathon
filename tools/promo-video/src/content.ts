// ============================================================================
// content.ts — EVERY on-screen string lives here. Final copy merged from
// docs/script.md (story pass), with two deliberate deviations decided at
// integration, so on-screen overlays always match the real screenshots behind
// them (judges cross-check):
//
//   1. The schedule-fix example uses permit BLD-2026-0001 as captured in
//      public/screens/schedule-fix.png: impact as-submitted 3,912 vehicle-hours,
//      recommended night window saves 3,344 (−85.5%) → 568. The script's
//      original 7,025→1,383 README example is NOT on any captured screen.
//   2. The refusal beat wording matches the real refusal captured in
//      refusal.png («الإجراء محجوب…» — invalid state transition), not the
//      "missing direction" example.
//
// Numerals are Latin everywhere (repo rule, numerals-test.js).
// Evidence classes: مُثبَت عملياً (proven) · مُتحقَّق خارجياً (verified) ·
// متوقَّع من تجربة (expected) · سيناريو توسّع مشروط (scenario).
// ============================================================================

import type { EvidenceChipColorKey } from "./components/EvidenceChip";

/** Filenames expected in public/screens/. Flip an entry to `true` if the file
 * goes missing and <ScreenPanel> will render a labeled placeholder instead. */
export const MISSING_SCREENS: Record<string, boolean> = {
  "home.png": false,
  "desk.png": false,
  "desk-selected.png": false,
  "desk-decision.png": false, // history tab — audit trail
  "map.png": false,
  "prototype.png": false,
  "schedule-fix.png": false, // BLD-2026-0001 decision file
  "refusal.png": false, // blocked-action message on «النشر» tab
  "recalc-before.png": false,
  "recalc-after.png": false,
};

export interface StatBlock {
  label: string;
  from: number;
  to: number;
  suffix: string;
  chip: string;
  chipColor: EvidenceChipColorKey;
  /** render the capacity bar under this stat (the 12%→145% story) */
  capacityBar?: boolean;
}

export const content = {
  s1: {
    // Cold open — resident's words, no logo, no UI. Script scene 01.
    quote1: "«الطريق العام مغلق،",
    quote2: "فصار الزحام عند بيتي»",
    attribution: "قول ساكن — نقله منظّم الفعالية",
    q1: "كل حفرية تسأل السؤال نفسه:",
    q2: "متى يكون الأذى أخف؟",
  },
  s2: {
    stats: [
      {
        label: "حِمل شارع الحيّ بعد إغلاق قربه",
        from: 12,
        to: 145,
        suffix: "٪",
        chip: "متوقَّع من تجربة",
        chipColor: "warning",
        capacityBar: true,
      },
      {
        label: "أسوأ حالة في المحفظة",
        from: 100,
        to: 592,
        suffix: "٪",
        chip: "متوقَّع من تجربة",
        chipColor: "warning",
      },
      {
        label: "ساعة-مركبة يكلّفها تصريح واحد",
        from: 0,
        to: 42350,
        suffix: "",
        chip: "محرك مسار · محفظة العرض",
        chipColor: "warning",
      },
    ] as StatBlock[],
    closing: "أرقام لا تُعرف اليوم إلا بعد الشكوى",
  },
  s3: {
    line1: "ماذا لو عرفنا الأثر",
    line2: "قبل التوقيع، لا بعده؟",
    logoSubtitle: "قرار قبل الحفر، لا بعده",
  },
  s4: {
    b1: {
      heading: "150 تصريح حفر — مكتب واحد",
      sub: "كل تصريح يمرّ من هنا أولاً",
      screen: "desk.png",
      chip: "بيانات توضيحية · شوارع رياض حقيقية",
      chipColor: "muted" as EvidenceChipColorKey,
    },
    b2: {
      heading: "التوصية: عمل ليلي بدل نهاري",
      sub: "وفر 3,344 ساعة-مركبة — أقل بنسبة 85.5 بالمئة",
      screen: "schedule-fix.png",
      counterFrom: 3912,
      counterTo: 568,
      counterSuffix: "",
      counterLabel: "ساعة-مركبة تأخيراً",
      chip: "متوقَّع من تجربة",
      chipColor: "warning" as EvidenceChipColorKey,
      lower: "BLD-2026-0001 · أعمال على أبو عبيدة عامر بن الجراح",
    },
    b3: {
      heading: "بديل حقيقي لكل إغلاق تقريباً",
      sub: "118 من 134 سجلاً — 3.7 دقائق إضافية وسيطاً",
      screen: "map.png",
      chip: "118,893 عقدة · 174,113 ضلعاً — مُثبَت عملياً",
      chipColor: "success" as EvidenceChipColorKey,
    },
    b4: {
      heading: "لا يُحفر الشارع مرتين",
      sub: "الحفر الموحّد يوفّر ما بين 25 و33 بالمئة",
      permitA: "تصريح اتصالات",
      permitB: "تصريح مياه",
      merged: "حفر واحد منسَّق",
      chip: "مُتحقَّق خارجياً — GAO / FHWA",
      chipColor: "verified" as EvidenceChipColorKey,
    },
    b5: {
      heading: "النظام يمتنع — ويشرح السبب",
      sub: "حين لا يصحّ الإجراء، لا ينفَّذ",
      screen: "refusal.png",
      lower: "من يفحص لا يعتمد · وكل قرار موقَّع ومؤرَّخ",
    },
    b6: {
      heading: "والخريطة نفسها تُنشر للسكان",
      sub: "شفافية قبل أن تُغلق الشوارع",
      screen: "map.png",
    },
  },
  s5: {
    recalc: {
      heading: "رقم يتغيّر مع كل مُدخل",
      sub: "لا لقطة مسجّلة ولا رقم مزروع",
      before: "recalc-before.png",
      after: "recalc-after.png",
    },
    osrm: {
      heading: "قِسنا مساراتنا مقابل محرك مستقل",
      sub: "OSRM — مفتوح المصدر",
      chip: "مُتحقَّق خارجياً",
      chipColor: "verified" as EvidenceChipColorKey,
      sideScreen: "desk-decision.png", // audit-trail view, docked small
      sideCaption: "سجل قرارات مؤرَّخ",
    },
    ladder: {
      heading: "كل رقم يحمل تصنيف دليله",
      chips: [
        { label: "مُثبَت عملياً", colorKey: "success" },
        { label: "مُتحقَّق خارجياً", colorKey: "verified" },
        { label: "متوقَّع من تجربة", colorKey: "warning" },
        { label: "سيناريو توسّع مشروط", colorKey: "muted" },
      ] as { label: string; colorKey: EvidenceChipColorKey }[],
    },
  },
  s6: {
    tag1: "قرار واحد،",
    tag2: "قبل كل حفرية",
    logoSubtitle: "بلدياثون 2026 — التحدي الثالث",
  },
} as const;
