import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const partsDir = path.join(root, "tmp", "masar-deck-parts");
const outDir = path.join(root, "output", "submission");
const finalHtml = path.join(outDir, "masar-baladiyathon-judging-deck.html");

const partFiles = [
  "slides-00-team.html",
  "slides-01-03.html",
  "slides-04-06.html",
  "slides-07-09.html",
  "slides-10-12.html",
  "slides-13-15.html",
  "slides-16-18.html",
];

const assets = [
  "masar-logo.png",
  "challenge-brief.png",
  "judging-criteria.png",
  "masar-current-prototype-journey.png",
  "masar-actors-use-cases.png",
  "masar-target-operating-sequence.png",
  "masar-reviewer-decision-journey.png",
];

function pngData(name) {
  const file = path.join(outDir, name);
  return `data:image/png;base64,${fs.readFileSync(file).toString("base64")}`;
}

const assetMap = Object.fromEntries(assets.map((name) => [name, pngData(name)]));
let slides = partFiles.map((name) => fs.readFileSync(path.join(partsDir, name), "utf8")).join("\n");

let slideSequence = 0;
slides = slides.replace(/data-slide="\d+"/g, () => `data-slide="${++slideSequence}"`);
let pageSequence = 0;
slides = slides.replace(/<span class="slide-no">[^<]+<\/span>/g, () => {
  pageSequence += 1;
  return `<span class="slide-no">${String(pageSequence).padStart(2, "0")} / 19</span>`;
});

for (const [name, uri] of Object.entries(assetMap)) {
  slides = slides.replaceAll(`src="${name}"`, `src="${uri}"`);
}

const baseCss = fs.readFileSync(path.join(partsDir, "design-contract.css"), "utf8");
const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>مسار — عرض بلدياثون التفصيلي</title>
<style>
${baseCss}
html,body{margin:0;background:#071c27;font-family:"Tahoma","Arial",sans-serif}
body{display:grid;place-items:center}
#deck{width:100%;height:100svh;overflow-y:auto;scroll-snap-type:y mandatory}
.slide{margin:0 auto;scroll-snap-align:start;transform-origin:top center}
.nav{position:fixed;right:18px;bottom:18px;z-index:40;display:flex;gap:8px;direction:ltr}
.nav button{border:0;border-radius:999px;width:44px;height:44px;background:#fffdf8;color:#102535;font-size:22px;box-shadow:0 6px 24px rgba(0,0,0,.22);cursor:pointer}
@media screen and (max-width:1599px){
  .slide{transform:scale(var(--deck-scale,1));margin-bottom:calc((900px * var(--deck-scale,1)) - 900px)}
}
@media print{
  @page{size:16in 9in;margin:0}
  html,body,#deck{width:auto;height:auto;overflow:visible;background:#fff}
  .nav{display:none!important}
  .slide{width:16in;height:9in;transform:none!important;margin:0!important;break-after:page;page-break-after:always}
}
</style>
</head>
<body>
<main id="deck">${slides}</main>
<nav class="nav" aria-label="التنقل بين الشرائح">
  <button id="prev" type="button" aria-label="الشريحة السابقة">←</button>
  <button id="next" type="button" aria-label="الشريحة التالية">→</button>
</nav>
<script>
const deck=document.getElementById("deck");
const slides=[...document.querySelectorAll(".slide")];
let current=0;
function scaleDeck(){
  const scale=Math.min(innerWidth/1600,innerHeight/900);
  document.documentElement.style.setProperty("--deck-scale",String(scale));
}
function go(index){
  current=Math.max(0,Math.min(slides.length-1,index));
  slides[current].scrollIntoView({behavior:"smooth",block:"start"});
}
document.getElementById("prev").onclick=()=>go(current-1);
document.getElementById("next").onclick=()=>go(current+1);
addEventListener("keydown",event=>{
  if(["ArrowRight","PageDown"," "].includes(event.key))go(current+1);
  if(["ArrowLeft","PageUp"].includes(event.key))go(current-1);
  if(event.key==="Home")go(0);
  if(event.key==="End")go(slides.length-1);
});
deck.addEventListener("scroll",()=>{current=Math.max(0,Math.min(slides.length-1,Math.round(deck.scrollTop/(900*parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--deck-scale")||1)))))});
addEventListener("resize",scaleDeck);
scaleDeck();
</script>
</body>
</html>`;

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(finalHtml, html, "utf8");
console.log(finalHtml);
