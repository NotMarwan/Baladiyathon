'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');
const presentationDir = path.join(root, 'presentation');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

const artifacts = [
  { file: 'presentation/athar-pitch.html', html: read('presentation/athar-pitch.html') },
  { file: 'presentation/athar.html', html: read('presentation/athar.html') },
  { file: 'presentation/athar-merged.html', html: read('presentation/athar-merged.html') },
];
const pitch = artifacts[0].html;
const sources = read('presentation/athar-sources.html');
const ideaCard = read('بطاقة-الفكرة.md');
const allOwnedNarrative = [...artifacts.map((item) => item.html), sources, ideaCard].join('\n');

const forbiddenClaims = [
  'أول أداة',
  'الأولى من نوعها',
  'أول منصة',
  '10,000,000',
  '10,000',
  '10 مليون',
  '10 million',
  '20,800',
  '11.1%',
  '11.1٪',
  'ACO',
  'Ant Colony Optimization',
  'خوارزمية مستعمرة النمل',
  'يعمل مباشرة على بيانات بلدي دون بنية إضافية',
  'يعمل مباشرة فوق بيانات بلدي الحالية',
  'دون الحاجة لبنية تحتية جديدة',
  '+2M',
  '+2 مليون',
  '2.5 مليون عملية',
];

const expectedStory = [
  'permit-network',
  'current-gap',
  'evidence-boundary',
  'baseline-alternative',
  'decision-path',
  'impact-range',
  'shadow-gate',
  'supervised-ask',
];

let count = 0;
function test(name, fn) {
  fn();
  count += 1;
  console.log(`  ok - ${name}`);
}

test('the timed pitch has exactly eight main slides', () => {
  const mainSlides = [...pitch.matchAll(
    /<section class="slide main"[^>]*data-story="([^"]+)"[^>]*>/g
  )];
  assert.strictEqual(mainSlides.length, 8);
  assert.deepStrictEqual(mainSlides.map((match) => match[1]), expectedStory);
});

test('the two appendices are labeled Appendix A and Appendix B outside the main count', () => {
  const appendixLabels = [...pitch.matchAll(
    /<section class="slide appendix"[^>]*data-appendix="([AB])"[^>]*>/g
  )].map((match) => match[1]);
  assert.deepStrictEqual(appendixLabels, ['A', 'B']);
  assert.ok(/Appendix A/.test(pitch));
  assert.ok(/Appendix B/.test(pitch));
  assert.ok(/id="counter">1 \/ 8</.test(pitch));
  assert.ok(/var total = mainSlides\.length;/.test(pitch));
});

test('main slide timing is continuous and totals exactly 180 seconds', () => {
  const timings = [...pitch.matchAll(
    /<section class="slide main"[^>]*data-start="(\d+)"[^>]*data-end="(\d+)"[^>]*data-seconds="(\d+)"[^>]*>/g
  )].map((match) => ({
    start: Number(match[1]),
    end: Number(match[2]),
    seconds: Number(match[3]),
  }));

  assert.strictEqual(timings.length, 8);
  let cursor = 0;
  timings.forEach((timing) => {
    assert.strictEqual(timing.start, cursor);
    assert.strictEqual(timing.end - timing.start, timing.seconds);
    cursor = timing.end;
  });
  assert.strictEqual(cursor, 180);
  assert.strictEqual(
    timings.reduce((sum, timing) => sum + timing.seconds, 0),
    180
  );
});

test('every numeric metric card has a matching local source or formula link', () => {
  const metricBlocks = [...pitch.matchAll(
    /<article class="metric"([^>]*)>([\s\S]*?)<\/article>/g
  )];
  assert.ok(metricBlocks.length >= 3, 'expected at least three numeric metric cards');

  metricBlocks.forEach((match) => {
    const attributes = match[1];
    const body = match[2];
    const sourceMatch = attributes.match(/data-source="([^"]+)"/);
    const formulaMatch = attributes.match(/data-formula="([^"]+)"/);
    assert.ok(sourceMatch || formulaMatch, `unclassified metric:\n${match[0]}`);

    if (sourceMatch) {
      assert.ok(
        body.includes(`href="athar-sources.html#${sourceMatch[1]}"`),
        `metric does not link to ${sourceMatch[1]}`
      );
    }
    if (formulaMatch) {
      assert.ok(
        /href="\.\.\/docs\/SHADOW-PILOT\.md#[^"]+"/.test(body),
        `formula metric ${formulaMatch[1]} lacks a protocol link`
      );
    }
  });
});

test('forbidden unsupported or misleading claims are absent from every owned narrative file', () => {
  forbiddenClaims.forEach((claim) => {
    assert.ok(!allOwnedNarrative.includes(claim), `forbidden claim present: ${claim}`);
  });
});

test('all three presentation artifacts share the same ordered eight-part story', () => {
  artifacts.forEach((artifact) => {
    const order = [...artifact.html.matchAll(
      /<section[^>]*data-story="([^"]+)"[^>]*>/g
    )].map((match) => match[1]);
    assert.deepStrictEqual(order, expectedStory, `${artifact.file} story drift`);
  });
});

test('the current England roadworks figure is identical and uses one stable source id', () => {
  artifacts.forEach((artifact) => {
    assert.ok(artifact.html.includes('2.2 مليون'), `${artifact.file} missing current figure`);
    assert.ok(
      artifact.html.includes('href="athar-sources.html#src-031"'),
      `${artifact.file} missing src-031`
    );
  });
});

test('the source registry links the roadworks figure to the official page that states it', () => {
  const sourceBlock = sources.match(
    /<article id="src-031"[\s\S]*?<\/article>/
  );
  assert.ok(sourceBlock, 'src-031 missing');
  assert.ok(sourceBlock[0].includes('2.2 مليون'));
  assert.ok(sourceBlock[0].includes('بين أبريل 2023 ومارس 2024'));
  assert.ok(sourceBlock[0].includes(
    'https://www.gov.uk/government/publications/street-works-lane-rental/lane-rental-schemes-guidance-for-english-highway-authorities'
  ));
});

test('the dig-once range links directly to the primary GAO report', () => {
  const sourceBlock = sources.match(
    /<article id="src-041"[\s\S]*?<\/article>/
  );
  assert.ok(sourceBlock, 'src-041 missing');
  assert.ok(sourceBlock[0].includes('25–33%'));
  assert.ok(sourceBlock[0].includes('https://www.gao.gov/assets/gao-12-687r.pdf'));
  assert.ok(ideaCard.includes('https://www.gao.gov/assets/gao-12-687r.pdf'));
});

test('every source entry declares provenance type and an access date', () => {
  const sourceEntries = [...sources.matchAll(
    /<article id="([^"]+)" data-type="([^"]+)">([\s\S]*?)<\/article>/g
  )];
  assert.ok(sourceEntries.length >= 6);
  sourceEntries.forEach((entry) => {
    assert.ok(['primary', 'secondary', 'local'].includes(entry[2]));
    assert.ok(
      entry[3].includes('وصول 2026-07-23'),
      `${entry[1]} lacks an access date`
    );
  });
});

test('the idea card uses the four honest replacement claims', () => {
  [
    'حزمة قرار كمية قبل التصريح',
    'الحالة الحالية توضيحية',
    'مسار نشر مقترح',
    'بحث محدود وشفاف',
  ].forEach((claim) => {
    assert.ok(ideaCard.includes(claim), `idea card missing: ${claim}`);
  });
});

test('team placeholders remain explicit instead of being invented or hidden', () => {
  const placeholders = ideaCard.match(/\[الاسم\]/g) || [];
  assert.ok(placeholders.length >= 1);
  assert.ok(ideaCard.includes('مانع تسليم خارجي'));
});

test('all local presentation links resolve to existing owned or project files', () => {
  const localHrefs = [...pitch.matchAll(/href="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((href) =>
      !href.startsWith('http')
      && !href.startsWith('#')
      && !href.startsWith('mailto:')
    )
    .map((href) => href.split('#')[0]);

  localHrefs.forEach((href) => {
    const resolved = path.resolve(presentationDir, href);
    assert.ok(fs.existsSync(resolved), `missing local link target: ${href}`);
  });
});

console.log(`ALL PITCH INTEGRITY TESTS PASSED (${count})`);
