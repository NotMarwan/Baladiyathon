'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const out = path.join(root, 'output', 'submission');
const htmlPath = path.join(out, 'masar-baladiyathon-judging-deck.html');
let passed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('  ok - ' + name);
  } catch (error) {
    console.error('FAIL - ' + name);
    console.error(error.message);
    process.exitCode = 1;
  }
}

const html = fs.readFileSync(htmlPath, 'utf8');
const slides = html.match(/<section\b[^>]*class="[^"]*\bslide\b[^"]*"[^>]*>/g) || [];

/* تسعة عشر حتى ٢٦ يوليو ٢٠٢٦. صارت إحدى وعشرين بإضافة شريحتين: حكم حمل
   البديل (١١٢ من ١٥٠)، وبرهان التبادلية (٥٧٦ منطقة عمل بصفر أخطاء). العدد
   مثبَّت عمداً — شريحة تُضاف بلا قصد تغيّر مدة العرض ونصيب كل فكرة منه. */
const EXPECTED_SLIDES = 21;

test(`detailed judging deck has exactly ${EXPECTED_SLIDES} slides`, () => {
  if (slides.length !== EXPECTED_SLIDES) {
    throw new Error(`expected ${EXPECTED_SLIDES} slides, found ${slides.length}`);
  }
});

test('every slide carries one Masar corner logo', () => {
  const logos = html.match(/class="corner-logo"/g) || [];
  if (logos.length !== EXPECTED_SLIDES) {
    throw new Error(`expected ${EXPECTED_SLIDES} logos, found ${logos.length}`);
  }
});

test('first slide contains all four team members', () => {
  const firstSlide = html.match(/<section\b[^>]*class="[^"]*\bslide\b[^"]*"[\s\S]*?<\/section>/)?.[0] || '';
  for (const member of ['مروان صلاح', 'وسن صلاح', 'سمية صلاح', 'مصعب صلاح']) {
    if (!firstSlide.includes(member)) throw new Error(`missing team member on first slide: ${member}`);
  }
});

test('all four journey diagrams are embedded', () => {
  const expected = [
    'masar-current-prototype-journey',
    'masar-actors-use-cases',
    'masar-target-operating-sequence',
    'masar-reviewer-decision-journey',
  ];
  for (const token of expected) {
    if (!html.includes(`data-asset="${token}"`)) throw new Error(`missing embedded diagram marker: ${token}`);
  }
});

test('deck contains no Amad or Jazan project residue', () => {
  for (const forbidden of ['أمد', 'عهد موبايل', 'مجد جازان', 'مصرف الإنماء']) {
    if (html.includes(forbidden)) throw new Error(`forbidden reference residue: ${forbidden}`);
  }
});

test('field readiness remains explicitly conditional', () => {
  for (const phrase of ['عشرون حالة', 'غير معتمدة', 'غير منفذ']) {
    if (!html.includes(phrase)) throw new Error(`missing honesty phrase: ${phrase}`);
  }
});

test('project GitHub link is visible and clickable', () => {
  const url = 'https://github.com/NotMarwan/Baladiyathon';
  if (!html.includes(`href="${url}"`) || !html.includes(url)) {
    throw new Error('missing project GitHub link');
  }
});

test('sidecar assets exist and are non-empty', () => {
  for (const name of [
    'masar-current-prototype-journey.png',
    'masar-actors-use-cases.png',
    'masar-target-operating-sequence.png',
    'masar-reviewer-decision-journey.png',
  ]) {
    const file = path.join(out, name);
    if (!fs.existsSync(file) || fs.statSync(file).size < 1000) throw new Error(`missing or empty asset: ${name}`);
  }
});

if (!process.exitCode) console.log(`ALL SUBMISSION DECK TESTS PASSED (${passed})`);
