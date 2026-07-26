'use strict';
/**
 * WP-WZ1 — بوابة بنية WZDx 4.2.
 *
 * الخلفية: التحقق المعزول (research/github-intelligence) شغّل `ajv` على
 * المخطط الرسمي وسجّل **إحدى عشرة مخالفة**، جوهرها أربعة:
 *   · غياب `feed_info`.
 *   · غياب تحقق موضع البداية ودقتها.
 *   · غياب تحقق موضع النهاية ودقتها.
 *   · بنية الحدث لا تطابق فرع المخطط.
 *
 * ---------------------------------------------------------------------------
 * **ما هذه البوابة، وما ليست.**
 *
 * ليست المحقق الرسمي. لا شبكة في هذا المستودع ولا `ajv` ولا نسخة من المخطط،
 * فالقيود هنا **منقولة يدوياً** من مواصفة 4.2 إلى شيفرة. ومنقولٌ يدوياً يعني
 * احتمال خطأ نقل أو قيدٍ فاتني.
 *
 * فما تثبته: أن المخالفات الأربع المسجَّلة **زالت**، وأن البنية تحمل حقول
 * 4.2 الإلزامية بأنواعها وتعداداتها.
 * وما لا تثبته: اجتياز المخطط الرسمي. ذلك يحتاج `ajv` والمخطط المنشور، وهما
 * خارج المستودع.
 *
 * ولذلك **لا يُرفع** وصف «تجريبي» عن التصدير بمجرد خضرة هذه الحزمة. الوصف
 * يتغيّر ليقول ما صار صحيحاً بالضبط، لا أكثر — انظر `athar-desk-plan.js`.
 *
 * التشغيل: node presentation/tests/wzdx-schema-test.js
 */

const assert = require('node:assert');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
global.window = global;
const Engine = require(path.join(ROOT, 'athar-engine.js'));

let count = 0;
function test(name, fn) {
  fn();
  count += 1;
  console.log(`  ok - ${name}`);
}

/* التعدادات منقولة من مواصفة 4.2 ومكتوبة هنا حرفياً — لا تُقرأ من المحرك.
   قائمةٌ تُقرأ من المُختبَر تُوسَّع بإضافة قيمة إليه فتمرّ البوابة. */
const EVENT_TYPES = ['work-zone', 'detour', 'restriction'];
const DIRECTIONS = ['northbound', 'southbound', 'eastbound', 'westbound',
  'inner-loop', 'outer-loop', 'undefined', 'unknown'];
const LOCATION_METHODS = ['channel-device-method', 'sign-method',
  'junction-method', 'other', 'unknown'];
const VEHICLE_IMPACTS = ['all-lanes-closed', 'some-lanes-closed',
  'all-lanes-open', 'alternating-one-way', 'some-lanes-closed-merge-left',
  'some-lanes-closed-merge-right', 'all-lanes-open-shift-left',
  'all-lanes-open-shift-right', 'some-lanes-closed-split', 'flagging',
  'temporary-traffic-signal', 'unknown'];

/** حقول `WorkZoneRoadEvent` الإلزامية في 4.2. */
const WORK_ZONE_REQUIRED = ['core_details', 'start_date', 'end_date',
  'is_start_date_verified', 'is_end_date_verified',
  'is_start_position_verified', 'is_end_position_verified',
  'location_method', 'vehicle_impact'];

/** حقول `RoadEventCoreDetails` الإلزامية. */
const CORE_REQUIRED = ['event_type', 'data_source_id', 'road_names', 'direction'];

/** حقول `FeedInfo` الإلزامية. */
const FEED_REQUIRED = ['publisher', 'version', 'update_date', 'data_sources'];

/** التاريخ في 4.2 نصّ `date-time` بحسب RFC 3339. */
function isDateTime(value) {
  if (typeof value !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(value)) {
    return false;
  }
  return !Number.isNaN(Date.parse(value));
}

/**
 * يجمع كل مخالفات البنية بدل التوقّف عند أولها.
 *
 * التوقّف عند الأولى يجعل كل إصلاح يكشف مخالفة جديدة، فتُقرأ الحزمة تراجعاً
 * بينما هي تتقدّم. والمقارنة بعدد المخالفات المسجَّل (11) لا تصحّ إلا بجرد.
 *
 * @returns {string[]}
 */
function violations(feed) {
  const found = [];
  const note = (message) => found.push(message);

  if (!feed || typeof feed !== 'object') return ['التغذية ليست كائناً'];

  // ---- FeedInfo ----
  const info = feed.feed_info;
  if (!info || typeof info !== 'object') {
    note('feed_info مفقود');
  } else {
    FEED_REQUIRED.forEach((field) => {
      if (info[field] === undefined) note(`feed_info.${field} مفقود`);
    });
    if (info.version !== undefined && info.version !== '4.2') {
      note(`feed_info.version = ${info.version} لا 4.2`);
    }
    if (info.update_date !== undefined && !isDateTime(info.update_date)) {
      note(`feed_info.update_date ليس date-time: ${info.update_date}`);
    }
    if (info.publisher !== undefined && typeof info.publisher !== 'string') {
      note('feed_info.publisher ليس نصّاً');
    }
    if (!Array.isArray(info.data_sources) || info.data_sources.length < 1) {
      note('feed_info.data_sources ليست مصفوفة بعنصر واحد على الأقل');
    } else {
      info.data_sources.forEach((source, index) => {
        ['data_source_id', 'organization_name'].forEach((field) => {
          if (typeof source[field] !== 'string' || !source[field]) {
            note(`feed_info.data_sources[${index}].${field} مفقود أو ليس نصّاً`);
          }
        });
      });
    }
  }

  // ---- FeatureCollection ----
  if (feed.type !== 'FeatureCollection') note(`type = ${feed.type} لا FeatureCollection`);
  if (!Array.isArray(feed.features)) return found.concat(['features ليست مصفوفة']);

  const declaredSources = new Set(
    ((info && info.data_sources) || []).map((source) => source.data_source_id)
  );

  feed.features.forEach((feature, index) => {
    const at = `features[${index}]`;
    if (feature.type !== 'Feature') note(`${at}.type = ${feature.type} لا Feature`);
    if (typeof feature.id !== 'string' || !feature.id) note(`${at}.id مفقود أو ليس نصّاً`);

    const geometry = feature.geometry;
    if (!geometry || ['LineString', 'MultiPoint'].indexOf(geometry.type) === -1) {
      note(`${at}.geometry.type = ${geometry && geometry.type} — يجب LineString أو MultiPoint`);
    } else if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length < 2) {
      note(`${at}.geometry.coordinates أقل من نقطتين`);
    } else {
      geometry.coordinates.forEach((pair, k) => {
        const ok = Array.isArray(pair) && pair.length >= 2
          && Number.isFinite(pair[0]) && Number.isFinite(pair[1])
          && pair[0] >= -180 && pair[0] <= 180 && pair[1] >= -90 && pair[1] <= 90;
        if (!ok) note(`${at}.geometry.coordinates[${k}] خارج المدى أو ليس زوجاً`);
      });
    }

    const properties = feature.properties || {};
    WORK_ZONE_REQUIRED.forEach((field) => {
      if (properties[field] === undefined) note(`${at}.properties.${field} مفقود`);
    });

    ['is_start_date_verified', 'is_end_date_verified',
      'is_start_position_verified', 'is_end_position_verified'].forEach((field) => {
      if (properties[field] !== undefined && typeof properties[field] !== 'boolean') {
        note(`${at}.properties.${field} ليس منطقياً`);
      }
    });

    ['start_date', 'end_date'].forEach((field) => {
      if (properties[field] !== undefined && !isDateTime(properties[field])) {
        note(`${at}.properties.${field} ليس date-time: ${properties[field]}`);
      }
    });
    if (isDateTime(properties.start_date) && isDateTime(properties.end_date)
      && Date.parse(properties.end_date) <= Date.parse(properties.start_date)) {
      note(`${at}: end_date ليس بعد start_date`);
    }

    if (properties.location_method !== undefined
      && LOCATION_METHODS.indexOf(properties.location_method) === -1) {
      note(`${at}.properties.location_method خارج التعداد: ${properties.location_method}`);
    }
    if (properties.vehicle_impact !== undefined
      && VEHICLE_IMPACTS.indexOf(properties.vehicle_impact) === -1) {
      note(`${at}.properties.vehicle_impact خارج التعداد: ${properties.vehicle_impact}`);
    }

    const core = properties.core_details;
    if (!core || typeof core !== 'object') {
      note(`${at}.properties.core_details مفقود`);
    } else {
      CORE_REQUIRED.forEach((field) => {
        if (core[field] === undefined) note(`${at}.core_details.${field} مفقود`);
      });
      if (core.event_type !== undefined && EVENT_TYPES.indexOf(core.event_type) === -1) {
        note(`${at}.core_details.event_type خارج التعداد: ${core.event_type}`);
      }
      if (core.direction !== undefined && DIRECTIONS.indexOf(core.direction) === -1) {
        note(`${at}.core_details.direction خارج التعداد: ${core.direction}`);
      }
      if (!Array.isArray(core.road_names) || core.road_names.length < 1
        || core.road_names.some((name) => typeof name !== 'string' || !name)) {
        note(`${at}.core_details.road_names ليست مصفوفة نصوص غير فارغة`);
      }
      /* المرجعية الداخلية: مصدر البيانات المذكور في الحدث يجب أن يكون معلناً
         في `feed_info`. تغذيةٌ تحيل إلى مصدر لم تعرّفه لا يستطيع مستهلكها
         معرفة من أنتج الحدث — وهو الغرض من الحقل. */
      if (core.data_source_id !== undefined && declaredSources.size
        && !declaredSources.has(core.data_source_id)) {
        note(`${at}.core_details.data_source_id = ${core.data_source_id} غير معلن في feed_info`);
      }
    }
  });

  return found;
}

const INPUT = {
  id: 'BLD-2026-0001',
  roadName: 'طريق الملك فهد',
  direction: 'northbound',
  lanes: 4,
  lanesClosed: 1,
  startISO: '2026-08-01T22:00:00.000Z',
  durationHours: 8,
  coordinates: [[46.6753, 24.7136], [46.6801, 24.7192]],
  dataSourceId: 'athar-reviewer-desk',
};

// ---- المخالفات المسجَّلة زالت -------------------------------------------

test('التصدير خالٍ من مخالفات البنية', () => {
  const found = violations(Engine.wzdx(INPUT));
  assert.deepStrictEqual(found, [], `${found.length} مخالفة:\n    ${found.join('\n    ')}`);
});

test('المخالفات الأربع المسجَّلة في التحقق المعزول: كلٌّ منها مفحوصة باسمها', () => {
  /* الفحص أعلاه يقول «لا مخالفة». هذا يقول **أي** مخالفة كانت، ويثبت أن
     الحقل الذي غاب صار حاضراً — لا أن الفحص عنه سقط. */
  const feed = Engine.wzdx(INPUT);
  const properties = feed.features[0].properties;

  assert.ok(feed.feed_info, 'غياب معلومات التغذية — المخالفة الأولى عادت');
  assert.strictEqual(typeof properties.is_start_position_verified, 'boolean',
    'غياب تحقق موضع البداية — المخالفة الثانية عادت');
  assert.strictEqual(typeof properties.is_start_date_verified, 'boolean',
    'غياب دقة البداية — المخالفة الثالثة عادت');
  assert.strictEqual(typeof properties.is_end_position_verified, 'boolean',
    'غياب تحقق موضع النهاية — المخالفة الرابعة عادت');
  assert.strictEqual(typeof properties.is_end_date_verified, 'boolean',
    'غياب دقة النهاية — المخالفة الخامسة عادت');
});

test('حقول الإصدار الثالث المنسوخة غائبة', () => {
  /* `start_date_accuracy` و`end_date_accuracy` من الإصدار الثالث، وحلّت
     محلّهما `is_*_verified` في الرابع. بقاؤهما كان يمنع مطابقة الفرع. */
  const properties = Engine.wzdx(INPUT).features[0].properties;
  ['start_date_accuracy', 'end_date_accuracy'].forEach((field) => {
    assert.strictEqual(properties[field], undefined,
      `حقل من الإصدار الثالث باقٍ: ${field}`);
  });
});

test('لا دفتر حساب داخلي في خصائص الحدث', () => {
  /* `dayOffset` و`durationHours` ليسا من المواصفة. صيغةٌ للتبادل تحمل دفتر
     المنتِج الداخلي تُلزم كل مستهلك بتجاهل ما لا يفهمه. */
  const properties = Engine.wzdx(INPUT).features[0].properties;
  ['dayOffset', 'durationHours'].forEach((field) => {
    assert.strictEqual(properties[field], undefined, `حقل غير معياري: ${field}`);
  });
});

// ---- الأمانة في قيم التحقق ----------------------------------------------

test('حقول التحقق تُعلن false ما لم يُثبَت العكس بمُدخل صريح', () => {
  /* الحقول الأربع منطقية، فأسهل طريق لاجتياز المخطط أن تُكتب `true` وتُنسى.
     وذلك يعلن للمستهلك أن التاريخ مثبَّت ميدانياً وهو مقترح، والموقع ممسوح
     وهو مشتقّ من الهندسة. الاجتياز البنيوي لا يبرّر ادعاءً في المحتوى. */
  const plain = Engine.wzdx(INPUT).features[0].properties;
  assert.strictEqual(plain.is_start_date_verified, false);
  assert.strictEqual(plain.is_end_date_verified, false);
  assert.strictEqual(plain.is_start_position_verified, false);
  assert.strictEqual(plain.is_end_position_verified, false);

  const verified = Engine.wzdx({ ...INPUT, startDateVerified: true,
    startPositionVerified: true }).features[0].properties;
  assert.strictEqual(verified.is_start_date_verified, true,
    'المُدخل الصريح لا يرفع العلم');
  assert.strictEqual(verified.is_start_position_verified, true);
  assert.strictEqual(verified.is_end_date_verified, false,
    'علمٌ ارتفع بلا مُدخل يخصّه');
});

// ---- سلوك عبر مُدخلات مختلفة --------------------------------------------

test('كل جدول مرحلي يبقى مطابقاً — لا حالة واحدة منتقاة', () => {
  const windows = Engine.buildNightWindows(22, 40, 8);
  const feed = Engine.wzdx({ ...INPUT, windows, durationHours: 40 });
  assert.strictEqual(feed.features.length, windows.length);
  const found = violations(feed);
  assert.deepStrictEqual(found, [], `${found.length} مخالفة في جدول مرحلي:\n    ${found.join('\n    ')}`);

  const ids = feed.features.map((feature) => feature.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'معرّفات مكرّرة بين النوافذ');
});

test('حالات الإغلاق الثلاث تعطي vehicle_impact صحيحاً', () => {
  const cases = [
    { lanesClosed: 0, expected: 'all-lanes-open' },
    { lanesClosed: 1, expected: 'some-lanes-closed' },
    { lanesClosed: 4, expected: 'all-lanes-closed' },
  ];
  cases.forEach((item) => {
    const feed = Engine.wzdx({ ...INPUT, lanesClosed: item.lanesClosed });
    assert.strictEqual(feed.features[0].properties.vehicle_impact, item.expected);
    assert.deepStrictEqual(violations(feed), []);
  });
});

test('كل اتجاه معياري يمرّ، وغير المعياري يسقط', () => {
  DIRECTIONS.forEach((direction) => {
    assert.deepStrictEqual(violations(Engine.wzdx({ ...INPUT, direction })), [],
      `اتجاه معياري رُفض: ${direction}`);
  });
  /* كان هذا البند يفحص أن الفاحص **يلتقط** الاتجاه العربي بعد إنتاجه.
     وبعد WP-WZ2 لم يعد يُنتَج أصلاً: المحرك يرفض القيمة خارج التعداد عند
     المدخل. الرفض المبكر أفضل من التقاط متأخر — ملفٌ فاسد لا يُصنَع فلا
     يُنزَّل ولا يصل جهةً ترفضه. */
  assert.throws(() => Engine.wzdx({ ...INPUT, direction: 'شمالاً' }),
    /direction خارج تعداد WZDx/, 'اتجاه غير معياري مرّ');
});

// ---- الحتمية -------------------------------------------------------------

test('التصدير حتميّ — ملفّان لنفس المُدخل يتطابقان بايتاً ببايت', () => {
  /* `update_date` أسهل موضع لتسرّب `Date.now()`. وتسرّبه يجعل كل تصدير
     يختلف عن سابقه، فيستحيل تمييز تغيّر البيانات من تغيّر الساعة. */
  const first = JSON.stringify(Engine.wzdx(INPUT));
  const second = JSON.stringify(Engine.wzdx(INPUT));
  assert.strictEqual(first, second);
  assert.strictEqual(Engine.wzdx(INPUT).feed_info.update_date,
    Engine.wzdx(INPUT).features.slice(-1)[0].properties.end_date,
    'update_date لا يشتقّ من البيانات');
});

test('مُدخل تاريخ معطوب يُرفض ولا يُنتج تغذية', () => {
  assert.throws(() => Engine.wzdx({ ...INPUT, startISO: 'ليس تاريخاً' }),
    /startISO/, 'تاريخ معطوب أنتج تغذية');
});

// ---- الفحص يفحص فعلاً ----------------------------------------------------

test('الفاحص يلتقط كل مخالفة يدّعي التقاطها', () => {
  /* بوابةٌ لا تسقط على مُدخل معطوب متعمَّد ليست بوابة. كل بند هنا يحذف أو
     يفسد حقلاً ويشترط ظهور مخالفة تسمّيه. */
  const damage = [
    { what: 'feed_info', apply: (f) => { delete f.feed_info; }, expect: /feed_info مفقود/ },
    { what: 'version', apply: (f) => { f.feed_info.version = '4.1'; }, expect: /version = 4\.1/ },
    { what: 'data_sources', apply: (f) => { f.feed_info.data_sources = []; }, expect: /data_sources/ },
    { what: 'organization_name', apply: (f) => { delete f.feed_info.data_sources[0].organization_name; }, expect: /organization_name/ },
    { what: 'is_start_position_verified', apply: (f) => { delete f.features[0].properties.is_start_position_verified; }, expect: /is_start_position_verified مفقود/ },
    { what: 'is_end_date_verified', apply: (f) => { f.features[0].properties.is_end_date_verified = 'yes'; }, expect: /is_end_date_verified ليس منطقياً/ },
    { what: 'start_date', apply: (f) => { f.features[0].properties.start_date = '2026-08-01 22:00'; }, expect: /start_date ليس date-time/ },
    { what: 'ترتيب التواريخ', apply: (f) => { f.features[0].properties.end_date = f.features[0].properties.start_date; }, expect: /end_date ليس بعد start_date/ },
    { what: 'vehicle_impact', apply: (f) => { f.features[0].properties.vehicle_impact = 'closed'; }, expect: /vehicle_impact خارج التعداد/ },
    { what: 'location_method', apply: (f) => { f.features[0].properties.location_method = 'gps'; }, expect: /location_method خارج التعداد/ },
    { what: 'core_details', apply: (f) => { delete f.features[0].properties.core_details; }, expect: /core_details مفقود/ },
    { what: 'road_names', apply: (f) => { f.features[0].properties.core_details.road_names = []; }, expect: /road_names/ },
    { what: 'geometry', apply: (f) => { f.features[0].geometry.type = 'Point'; }, expect: /geometry\.type/ },
    { what: 'إحداثيات خارج المدى', apply: (f) => { f.features[0].geometry.coordinates[0] = [200, 24]; }, expect: /خارج المدى/ },
    { what: 'مصدر غير معلن', apply: (f) => { f.features[0].properties.core_details.data_source_id = 'other'; }, expect: /غير معلن في feed_info/ },
    { what: 'id', apply: (f) => { delete f.features[0].id; }, expect: /id مفقود/ },
  ];

  damage.forEach((item) => {
    const feed = JSON.parse(JSON.stringify(Engine.wzdx(INPUT)));
    item.apply(feed);
    const found = violations(feed);
    assert.ok(found.some((message) => item.expect.test(message)),
      `الفاحص لم يلتقط إفساد «${item.what}» — وجد: ${found.join(' · ') || 'لا شيء'}`);
  });
});

test('الفاحص يجمع المخالفات ولا يتوقف عند أولها', () => {
  const feed = JSON.parse(JSON.stringify(Engine.wzdx(INPUT)));
  delete feed.feed_info;
  delete feed.features[0].properties.core_details;
  delete feed.features[0].properties.vehicle_impact;
  const found = violations(feed);
  assert.ok(found.length >= 3,
    `${found.length} مخالفة فقط — الفاحص يتوقف عند الأولى فيُقرأ التقدّم تراجعاً`);
});

console.log(`ALL TESTS PASSED (${count})`);
