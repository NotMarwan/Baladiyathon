import fs from "node:fs/promises";
import path from "node:path";

const repo = path.resolve(".");
const lab = path.join(repo, "research/evidence-intelligence/lab");
const visuals = path.join(repo, "research/evidence-intelligence/visuals");
await fs.mkdir(visuals, { recursive: true });

const esc = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const theme = {
  bg: "#08131F",
  panel: "#102235",
  panel2: "#153049",
  text: "#F5F7FA",
  muted: "#A8BACB",
  cyan: "#31D7D0",
  blue: "#4AA8FF",
  orange: "#FFB454",
  red: "#FF6B6B",
  purple: "#B58BFF",
  green: "#51D88A",
  grid: "#27435C",
};

const text = (x, y, value, size = 28, color = theme.text, anchor = "end", weight = 500) =>
  `<text x="${x}" y="${y}" fill="${color}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}">${esc(value)}</text>`;

const ltrText = (x, y, value, size = 28, color = theme.text, anchor = "start", weight = 500) =>
  `<text x="${x}" y="${y}" fill="${color}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" direction="ltr">${esc(value)}</text>`;

const rect = (x, y, width, height, fill, radius = 18, stroke = "none", strokeWidth = 0) =>
  `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;

const base = (title, subtitle, body, width = 1600, height = 900) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${theme.bg}"/>
  <style>
    text { font-family: Tahoma, "Segoe UI", Arial, sans-serif; }
  </style>
  ${rect(70, 58, 12, 92, theme.cyan, 6)}
  ${text(width - 80, 100, title, 42, theme.text, "end", 700)}
  ${text(width - 80, 143, subtitle, 22, theme.muted, "end", 400)}
  ${body}
  ${text(width - 80, height - 32, "منظومة استخبارات الأدلة — 26 يوليو 2026", 18, theme.muted, "end", 400)}
</svg>
`;

const ladderRows = [
  ["A", "دليل ميداني محلي مباشر", "أثر الحالة نفسها", theme.green],
  ["B", "رصد محلي لنفس المسار", "خط أساس فقط", theme.cyan],
  ["C", "حالة سعودية مشابهة", "فرضية محلية", theme.blue],
  ["D", "حالة عالمية مشابهة", "تشبيه وتصميم", theme.orange],
  ["E", "نموذج أو محاكاة", "سيناريو لا مشاهدة", theme.purple],
  ["F", "بيانات تركيبية", "اختبار المنطق فقط", "#718096"],
];
let ladderBody = "";
ladderRows.forEach((row, index) => {
  const y = 195 + index * 101;
  ladderBody += rect(110, y, 1380, 78, index % 2 === 0 ? theme.panel : theme.panel2, 18);
  ladderBody += `<circle cx="1438" cy="${y + 39}" r="27" fill="${row[3]}"/>`;
  ladderBody += text(1438, y + 48, row[0], 28, theme.bg, "middle", 800);
  ladderBody += text(1375, y + 35, row[1], 28, theme.text, "end", 650);
  ladderBody += text(1375, y + 63, row[2], 19, theme.muted, "end", 400);
  ladderBody += text(150, y + 49, index === 0 ? "أعلى صلاحية للأثر" : index === 5 ? "لا يدخل ادعاء أثر" : "", 18, row[3], "start", 600);
});
await fs.writeFile(
  path.join(visuals, "evidence-ladder.svg"),
  base(
    "سلّم الأدلة",
    "قوة الدليل تأتي من القرب من الحالة وجودة القياس، لا من كثرة المصادر",
    ladderBody
  ),
  "utf8"
);

let timelineBody = "";
timelineBody += `<line x1="160" y1="480" x2="1440" y2="480" stroke="${theme.grid}" stroke-width="10" stroke-linecap="round"/>`;
const phases = [
  [170, 315, theme.blue, "قبل", "أسبوعان", "خط أساس وأيام مماثلة"],
  [650, 300, theme.orange, "أثناء", "الإغلاق الفعلي كاملاً", "كل مرحلة منفصلة"],
  [1080, 315, theme.green, "بعد", "أسبوع على الأقل", "الاستشفاء والعودة"],
];
phases.forEach(([x, w, color, label, duration, note]) => {
  timelineBody += rect(x, 410, w, 140, color, 22);
  timelineBody += text(x + w - 28, 456, label, 32, theme.bg, "end", 800);
  timelineBody += text(x + w - 28, 493, duration, 21, theme.bg, "end", 600);
  timelineBody += text(x + w - 28, 525, note, 18, theme.bg, "end", 450);
});
timelineBody += rect(170, 620, 1225, 92, theme.panel, 18);
timelineBody += text(1360, 655, "طريق المقارنة يعمل طوال الفترات الثلاث", 25, theme.text, "end", 650);
timelineBody += text(1360, 690, "يُختار قبل رؤية النتيجة ويُفحص تشابه نمطه قبل العمل", 20, theme.muted, "end", 400);
timelineBody += `<path d="M250 620 L250 575 M760 620 L760 575 M1250 620 L1250 575" stroke="${theme.cyan}" stroke-width="3" stroke-dasharray="8 8"/>`;
await fs.writeFile(
  path.join(visuals, "before-during-after.svg"),
  base(
    "تصميم قبل / أثناء / بعد",
    "التوقيت الفعلي ومقارنة الأيام جزء من الدليل، وليسا تفاصيل إدارية",
    timelineBody
  ),
  "utf8"
);

let counterBody = "";
counterBody += rect(120, 235, 600, 250, theme.panel, 24);
counterBody += text(680, 285, "الطريق المتأثر", 30, theme.orange, "end", 750);
counterBody += text(680, 340, "قبل: ١٠ دقائق", 24);
counterBody += text(680, 390, "أثناء: ١٦ دقيقة", 24);
counterBody += text(680, 445, "التغير: +٦ دقائق", 28, theme.orange, "end", 750);
counterBody += rect(880, 235, 600, 250, theme.panel, 24);
counterBody += text(1440, 285, "طريق المقارنة", 30, theme.cyan, "end", 750);
counterBody += text(1440, 340, "قبل: ١٠ دقائق", 24);
counterBody += text(1440, 390, "أثناء: ١٢ دقيقة", 24);
counterBody += text(1440, 445, "التغير: +٢ دقيقة", 28, theme.cyan, "end", 750);
counterBody += `<path d="M720 360 C790 360 810 360 880 360" stroke="${theme.muted}" stroke-width="4" marker-end="url(#arrow)"/>`;
counterBody += `<defs><marker id="arrow" markerWidth="12" markerHeight="12" refX="8" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${theme.muted}"/></marker></defs>`;
counterBody += rect(320, 585, 960, 120, theme.panel2, 24, theme.cyan, 2);
counterBody += text(1230, 635, "أثر العمل = تغير المتأثر − تغير المقارنة", 30, theme.text, "end", 750);
counterBody += text(1230, 680, "٤ دقائق في المثال، لا ٦ دقائق", 27, theme.green, "end", 750);
await fs.writeFile(
  path.join(visuals, "counterfactual.svg"),
  base(
    "لماذا نحتاج طريق مقارنة؟",
    "المدينة قد تتغير في اليوم نفسه؛ الفرق وحده يخلط أثر العمل مع الاتجاه العام",
    counterBody
  ),
  "utf8"
);

const matrixRows = [
  ["الحجم اليومي", 0, 0, 1, "امتناع"],
  ["النمط الساعي", 0, 0, 1, "امتناع"],
  ["سعة منطقة العمل", 0, 1, 1, "تشبيه فقط"],
  ["زمن السريان الحر", 0, 0, 1, "طلب مزود"],
  ["السعة المتبقية", 0, 0, 1, "أعلى فجوة"],
  ["توقيت الإغلاق", 0, 0, 1, "حاجب"],
  ["الطقس والفعاليات", 1, 0, 0, "مربكات"],
];
let matrixBody = "";
matrixBody += text(900, 220, "مشاهدة محلية", 20, theme.cyan, "middle", 650);
matrixBody += text(1085, 220, "تشبيه عالمي", 20, theme.orange, "middle", 650);
matrixBody += text(1270, 220, "افتراض/نموذج", 20, theme.purple, "middle", 650);
matrixBody += text(1450, 220, "القرار", 20, theme.muted, "middle", 650);
matrixRows.forEach((row, index) => {
  const y = 245 + index * 76;
  matrixBody += rect(120, y, 1360, 60, index % 2 === 0 ? theme.panel : theme.panel2, 12);
  matrixBody += text(700, y + 39, row[0], 23, theme.text, "end", 600);
  [row[1], row[2], row[3]].forEach((value, col) => {
    const colors = [theme.cyan, theme.orange, theme.purple];
    matrixBody += `<circle cx="${900 + col * 185}" cy="${y + 30}" r="14" fill="${value ? colors[col] : theme.grid}"/>`;
  });
  matrixBody += text(1450, y + 38, row[4], 19, row[4].includes("امتناع") || row[4] === "حاجب" ? theme.red : theme.muted, "middle", 600);
});
await fs.writeFile(
  path.join(visuals, "assumption-evidence-matrix.svg"),
  base(
    "مصفوفة الافتراض والدليل",
    "وجود تشبيه عالمي لا يساوي معايرة محلية",
    matrixBody
  ),
  "utf8"
);

const routeData = JSON.parse(
  await fs.readFile(path.join(repo, "presentation/data/monitored-routes.json"), "utf8")
);
const rcrcMatch = JSON.parse(
  await fs.readFile(path.join(lab, "rcrc-intersection-route-match.json"), "utf8")
);
const ministry = JSON.parse(
  await fs.readFile(path.join(lab, "route-match-results.json"), "utf8")
);
const routeFeatures = routeData.groups.flatMap((group) =>
  group.routes.map((route) => ({
    groupId: group.groupId,
    street: group.street,
    role: route.role,
    coordinates: route.geometry.coordinates,
  }))
);
const bbox = { minLon: 46.64, maxLon: 46.87, minLat: 24.58, maxLat: 24.83 };
const mapX = (lon) => 120 + ((lon - bbox.minLon) / (bbox.maxLon - bbox.minLon)) * 930;
const mapY = (lat) => 760 - ((lat - bbox.minLat) / (bbox.maxLat - bbox.minLat)) * 560;
const routeColors = {
  "BLD-2026-0020": "#4AA8FF",
  "BLD-2026-0063": "#31D7D0",
  "BLD-2026-0045": "#FFB454",
  "BLD-2026-0025": "#B58BFF",
  "BLD-2026-0108": "#51D88A",
  "BLD-2026-0133": "#FF7DA8",
};
let coverageBody = "";
coverageBody += rect(85, 185, 1010, 615, theme.panel, 22);
coverageBody += `<path d="M${mapX(46.64)} ${mapY(24.7)} L${mapX(46.87)} ${mapY(24.7)} M${mapX(46.75)} ${mapY(24.58)} L${mapX(46.75)} ${mapY(24.83)}" stroke="${theme.grid}" stroke-width="1" stroke-dasharray="8 10"/>`;
routeFeatures.forEach((route) => {
  const points = route.coordinates.map(([lon, lat]) => `${mapX(lon)},${mapY(lat)}`).join(" ");
  coverageBody += `<polyline points="${points}" fill="none" stroke="${routeColors[route.groupId]}" stroke-width="${route.role === "work-segment" ? 8 : 3}" stroke-linecap="round" stroke-linejoin="round" opacity="${route.role === "work-segment" ? 1 : 0.55}"/>`;
});
const workMatches = rcrcMatch.findings.workSegments.flatMap((row) => row.within100m);
const uniquePoints = new Map(workMatches.map((point) => [point.intersectionCode, point]));
for (const point of uniquePoints.values()) {
  coverageBody += `<circle cx="${mapX(point.longitude)}" cy="${mapY(point.latitude)}" r="10" fill="${theme.blue}" stroke="${theme.text}" stroke-width="3"/>`;
}
const nearestCounter = ministry.counters.find((row) => row.counterId === "MOT-13");
coverageBody += `<path d="M${mapX(nearestCounter.longitude) - 10} ${mapY(nearestCounter.latitude) - 10} L${mapX(nearestCounter.longitude) + 10} ${mapY(nearestCounter.latitude) + 10} M${mapX(nearestCounter.longitude) + 10} ${mapY(nearestCounter.latitude) - 10} L${mapX(nearestCounter.longitude) - 10} ${mapY(nearestCounter.latitude) + 10}" stroke="${theme.red}" stroke-width="5"/>`;
coverageBody += text(1050, 785, "مخطط مكاني تقريبي — لا يشمل خريطة أساس", 16, theme.muted, "end", 400);
coverageBody += rect(1130, 185, 390, 615, theme.panel, 22);
coverageBody += text(1480, 235, "نتيجة التغطية", 30, theme.text, "end", 750);
coverageBody += text(1480, 315, "عدادات الوزارة", 23, theme.red, "end", 700);
coverageBody += ltrText(1170, 365, "0 / 21", 48, theme.red, "start", 800);
coverageBody += text(1480, 402, "ضمن ٥٠٠ متر", 18, theme.muted, "end", 400);
coverageBody += text(1480, 485, "تقاطعات رسمية", 23, theme.blue, "end", 700);
coverageBody += ltrText(1170, 535, "13 / 21", 48, theme.blue, "start", 800);
coverageBody += text(1480, 572, "ضمن ١٠٠ متر", 18, theme.muted, "end", 400);
coverageBody += rect(1160, 640, 330, 105, "#2A2130", 16);
coverageBody += text(1465, 680, "الهندسة ليست أداءً", 23, theme.orange, "end", 750);
coverageBody += text(1465, 715, "لا سرعة ولا حجم", 18, theme.muted, "end", 450);
await fs.writeFile(
  path.join(visuals, "route-source-coverage.svg"),
  base(
    "تغطية الأدلة على مسارات «أثر»",
    "المسارات ملوّنة، نقاط التقاطع الرسمية زرقاء، وأقرب عداد وزارة ظاهر بعلامة حمراء",
    coverageBody
  ),
  "utf8"
);

let cardBody = "";
cardBody += rect(100, 185, 1400, 570, theme.panel, 28);
cardBody += rect(1235, 225, 210, 70, theme.cyan, 35);
cardBody += text(1340, 272, "المستوى B", 28, theme.bg, "middle", 800);
cardBody += text(1180, 270, "خط أساس محلي", 31, theme.text, "end", 750);
cardBody += `<line x1="160" y1="330" x2="1440" y2="330" stroke="${theme.grid}" stroke-width="2"/>`;
cardBody += text(1410, 385, "المصدر", 20, theme.muted, "end", 500);
cardBody += text(1410, 430, "نفس المسار والاتجاه — ١٥ دقيقة — اكتمال ٩٦ من ١٠٠", 24, theme.text, "end", 650);
cardBody += rect(820, 490, 590, 165, "#123829", 20);
cardBody += text(1375, 535, "ما يثبته", 22, theme.green, "end", 750);
cardBody += text(1375, 580, "زمن الرحلة المعتاد في فترة القياس", 22, theme.text, "end", 500);
cardBody += text(1375, 620, "ومدى تغيره حسب الساعة", 22, theme.text, "end", 500);
cardBody += rect(190, 490, 590, 165, "#3A2628", 20);
cardBody += text(745, 535, "ما لا يثبته", 22, theme.red, "end", 750);
cardBody += text(745, 580, "لا يثبت أثر الإغلاق", 22, theme.text, "end", 500);
cardBody += text(745, 620, "ولا يوفر حجم الحركة", 22, theme.text, "end", 500);
await fs.writeFile(
  path.join(visuals, "evidence-card.svg"),
  base(
    "بطاقة دليل قابلة للتدقيق",
    "تظهر القوة والحد في المكان نفسه",
    cardBody
  ),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      generated: [
        "evidence-ladder.svg",
        "before-during-after.svg",
        "counterfactual.svg",
        "assumption-evidence-matrix.svg",
        "route-source-coverage.svg",
        "evidence-card.svg",
      ],
    },
    null,
    2
  )
);
