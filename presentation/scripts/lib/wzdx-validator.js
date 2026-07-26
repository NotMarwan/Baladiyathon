'use strict';
/**
 * أثر — المحقّق الرسمي لمخطط WZDx 4.2.
 * ---------------------------------------------------------------------------
 * **ما هذا، وما كان قبله.**
 *
 * قبله كان في المستودع فاحصٌ داخلي (`tests/wzdx-schema-test.js`) قيودُه
 * **منقولة يدوياً** من المواصفة إلى شيفرة. وهو مفيد كطبقة تحقق مبكر، لكنه لا
 * يملك أن يمنح وصف «متوافق مع WZDx»: منقولٌ يدوياً يعني احتمال قيدٍ فات
 * الناقل، وبوابةٌ تفحص ما كتبه صاحبها لا تُثبت توافقاً مع أحد.
 *
 * هذا الملف يشغّل **المخطط الرسمي نفسه** عبر AJV:
 *   · الملفات مثبَّتة في `presentation/vendor/wzdx-4.2/` من وسم `v4.2`
 *     بالتزام محدَّد (انظر `COMMIT.txt`) — لا فرع متحرّك.
 *   · هندسة GeoJSON من `geojson.org` مثبَّتة كذلك في `vendor/geojson/`.
 *   · Adapter: المنتج لا يعرف AJV، ولا يرى رسائله الخام. يعرف هذا الملف فقط.
 *
 * **ولماذا لا تُعرض رسائل AJV كما هي.**
 *
 * `must match exactly one schema in oneOf` جملةٌ صحيحة عديمة النفع: هي تصف
 * آلية المحقق لا عيب البيانات. الموظف الذي يقرأها لا يعرف أي حقل يصلح.
 * `translate()` يحوّلها إلى ما يمكن فعله، ويحتفظ بالرسالة الخام في `raw`
 * لمن يصحّح المحقق نفسه.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const WZDX_DIR = path.join(ROOT, 'vendor', 'wzdx-4.2');
const GEOJSON_DIR = path.join(ROOT, 'vendor', 'geojson');

/** ملفات المخطط الرسمية المثبّتة. الترتيب لا يهم — AJV يحلّ المراجع بالمعرّف. */
const WZDX_FILES = ['WorkZoneFeed.json', 'RoadEventFeature.json',
  'FeedInfo.json', 'Direction.json', 'BoundingBox.json'];
const GEOJSON_FILES = ['LineString.json', 'MultiPoint.json'];

/** الالتزام المثبَّت — يظهر في كل تقرير كي لا يُدّعى توافقٌ بلا نسخة. */
function pinnedCommit() {
  const file = path.join(WZDX_DIR, 'COMMIT.txt');
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim() : '(غير مثبَّت)';
}

let cachedValidate = null;
let cachedMeta = null;

/**
 * يبني المحقق مرة واحدة.
 *
 * `strict: false` مقصود: مخططات WZDx تستعمل مفاتيح خارج مفردات draft-07
 * (مثل `title` داخل تعريفات مضمَّنة) ولا شأن لصرامة AJV بصحّة بياناتنا.
 * `allErrors: true` لأن التوقّف عند أول خطأ يجعل كل إصلاح يكشف خطأً جديداً،
 * فيُقرأ التقدّم تراجعاً.
 */
function build() {
  if (cachedValidate) return { validate: cachedValidate, meta: cachedMeta };

  let Ajv;
  let addFormats;
  try {
    Ajv = require('ajv');
    addFormats = require('ajv-formats');
  } catch (error) {
    const hint = new Error(
      'AJV غير مثبَّت. المحقق الرسمي لا يعمل بدونه.\n'
      + '  التثبيت: npm install ajv@8 ajv-formats@3\n'
      + '  السبب الأصلي: ' + error.message
    );
    hint.code = 'AJV_MISSING';
    throw hint;
  }

  const ajv = new Ajv({ allErrors: true, strict: false, validateFormats: true });
  addFormats(ajv);

  const loaded = [];
  for (const file of GEOJSON_FILES) {
    const schema = JSON.parse(fs.readFileSync(path.join(GEOJSON_DIR, file), 'utf8'));
    ajv.addSchema(schema);
    loaded.push('geojson/' + file);
  }
  let feedSchema = null;
  for (const file of WZDX_FILES) {
    const schema = JSON.parse(fs.readFileSync(path.join(WZDX_DIR, file), 'utf8'));
    if (file === 'WorkZoneFeed.json') feedSchema = schema;
    else ajv.addSchema(schema);
    loaded.push('wzdx-4.2/' + file);
  }

  cachedValidate = ajv.compile(feedSchema);
  cachedMeta = {
    schema: 'WZDx 4.2 — WorkZoneFeed.json (رسمي)',
    schemaId: feedSchema.$id,
    commit: pinnedCommit(),
    validator: 'ajv@' + require('ajv/package.json').version,
    formats: 'ajv-formats@' + require('ajv-formats/package.json').version,
    files: loaded,
  };
  return { validate: cachedValidate, meta: cachedMeta };
}

/**
 * يترجم خطأ AJV واحداً إلى جملة تقول ما يُصلَح.
 *
 * ما لا يُترجَم يبقى بنصّه: ترجمةٌ تخترع معنى لخطأ لم تفهمه أسوأ من رسالة
 * إنجليزية صريحة.
 */
function translate(error) {
  const at = error.instancePath || '(الجذر)';
  const params = error.params || {};

  switch (error.keyword) {
    case 'required':
      return `${at}: حقل إلزامي مفقود — \`${params.missingProperty}\``;
    case 'enum':
      return `${at}: قيمة خارج التعداد المسموح — المسموح: `
        + (params.allowedValues || []).join(' | ');
    case 'const':
      return `${at}: القيمة يجب أن تكون \`${params.allowedValue}\` بالضبط`;
    case 'type':
      return `${at}: النوع يجب أن يكون ${params.type}`;
    case 'format':
      return `${at}: الصيغة يجب أن تكون ${params.format}`
        + (params.format === 'date-time' ? ' (RFC 3339، مثل 2026-08-01T22:00:00Z)' : '');
    case 'minItems':
      return `${at}: العناصر أقل من ${params.limit}`;
    case 'minimum':
      return `${at}: القيمة أقل من ${params.limit}`;
    case 'oneOf':
      /* هذا الخطأ يظهر عند كل حدث لا يطابق فرع `WorkZoneRoadEvent`.
         وحده لا يفيد — الأخطاء المرافقة له في نفس `instancePath` هي التي
         تسمّي الحقل. تُترك مع الإشارة إلى ذلك بدل حذفها: حذفها يخفي أن
         الحدث لم يطابق أي فرع أصلاً. */
      return `${at}: لا يطابق أي فرع من فروع المخطط (work-zone أو detour) `
        + '— السبب في الأخطاء الأخرى على نفس المسار';
    case 'anyOf':
      return `${at}: لا يطابق أي بديل مسموح`;
    default:
      return `${at}: ${error.message}`;
  }
}

/**
 * يفحص تغذية WZDx كاملة أمام المخطط الرسمي.
 *
 * @param {object} feed
 * @returns {{valid:boolean, errorCount:number, errors:Array, fields:string[], meta:object}}
 */
function validateFeed(feed) {
  const { validate, meta } = build();
  const valid = validate(feed);
  const rawAll = validate.errors || [];

  /* AJV يفحص **كل** فرع في `oneOf` ثم يجمع أخطاء الفروع الساقطة. فحدثٌ من نوع
     `work-zone` فيه عيب واحد يُنتج ذلك العيب مرتين (مرة في فرع work-zone ومرة
     في نسخة `properties` العامة) زائد «event_type يجب أن يكون detour» — وهو
     خطأ فرعٍ لم يُقصد أصلاً. عرض هذا الركام على موظف يجعل عيباً واحداً يبدو
     خمسة، فيُقرأ ملفٌ شبه صحيح كأنه منهار.
     يُطوى الركام هنا ويبقى عدده الخام في `rawErrorCount` لمن يصحّح المحقق. */
  const raw = rawAll.filter((error) => !isBranchNoise(error, feed));

  const seen = new Set();
  const errors = [];
  for (const error of raw) {
    const entry = {
      at: error.instancePath || '',
      keyword: error.keyword,
      message: translate(error),
      raw: error.message,
    };
    const key = entry.at + '|' + entry.keyword + '|' + entry.message;
    if (seen.has(key)) continue;
    seen.add(key);
    errors.push(entry);
  }

  /* الحقول الفاشلة بأسمائها: التقرير يسأل «أي الحقول فشلت» لا «كم خطأ».
     المسار `/features/0/properties/core_details/direction` يُختصر إلى
     `core_details.direction` كي يُجمَّع عبر التصاريح. */
  const fields = [];
  for (const error of raw) {
    const field = fieldOf(error);
    if (field && fields.indexOf(field) === -1) fields.push(field);
  }

  return {
    valid: Boolean(valid),
    errorCount: errors.length,
    rawErrorCount: rawAll.length,
    errors,
    fields,
    meta,
  };
}

/**
 * هل هذا الخطأ ناتجٌ عن فرعٍ لم يُقصد؟
 *
 * الحدث في أثر دائماً `work-zone`. فكل خطأ يشترط `detour` هو AJV يجرّب الفرع
 * الآخر ويفشل — لا عيب في بياناتنا. وتمييزه بشرطٍ صريح على `allowedValue`
 * أضيق من حذف كل أخطاء `const`: عيبُ `event_type` الحقيقي (قيمة ثالثة غير
 * `work-zone`) يُنتج خطأ الفرعين معاً، فيبقى واحدٌ منهما ظاهراً.
 */
function isBranchNoise(error, feed) {
  if (error.keyword !== 'const') return false;
  const allowed = error.params && error.params.allowedValue;
  if (allowed !== 'detour') return false;
  const match = /^\/features\/(\d+)\//.exec(error.instancePath || '');
  if (!match) return false;
  const feature = feed && feed.features && feed.features[Number(match[1])];
  const core = feature && feature.properties && feature.properties.core_details;
  return Boolean(core) && core.event_type === 'work-zone';
}

/** يستخرج اسم الحقل المسؤول من مسار الخطأ. */
function fieldOf(error) {
  const at = error.instancePath || '';
  const missing = error.keyword === 'required'
    ? (error.params && error.params.missingProperty)
    : null;
  const parts = at.split('/').filter((part) => part && !/^\d+$/.test(part));
  const trimmed = parts.filter((part) => part !== 'features' && part !== 'properties');
  const tail = missing ? trimmed.concat([missing]) : trimmed;
  return tail.length ? tail.join('.') : (missing || '(الجذر)');
}

module.exports = {
  validateFeed,
  translate,
  pinnedCommit,
  meta: () => build().meta,
};
