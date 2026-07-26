'use strict';
/**
 * Masar backend — Node stdlib only (http, fs, path, url).
 * Serves static files from presentation/ and a minimal JSON API backed by
 * MasarEngine (presentation/masar-engine.js — the single source of truth
 * for all math, shared with the browser UI and the test suite).
 *
 * Run: node presentation/server.js
 * Listens on http://localhost:8734
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const MasarEngine = require('./masar-engine.js');
const { createLedger } = require('./masar-ledger.js');

const PORT = 8734;
const ROOT_DIR = path.resolve(__dirname);
const WORKS_GEOJSON_PATH = path.join(ROOT_DIR, 'data', 'works.geojson');

// WP-G2 — تركيب مادة التسليم. جذرٌ مستقل بحارسه، لا توسيع لجذر الصفحات.
const SUBMISSION_MOUNT = '/submission';
const SUBMISSION_DIR = path.resolve(path.join(ROOT_DIR, '..', 'output', 'submission'));
const MAX_BODY_BYTES = 1024 * 1024; // 1MB JSON body size limit

// =====================================================================
// WP-D1 — الأمن
// =====================================================================
//
// نموذج التهديد المعلَن، ولا يُدَّعى غيره:
// الخادم نموذج أوليّ يعمل على جهاز واحد. الخطر الواقعي ثلاثة:
//   1) انكشافه على الشبكة المحلية بلا قصد (كان يستمع على كل الواجهات).
//   2) كتابة قرار من طرف غير الواجهة — سجل قرارات يُلوَّث فيفقد قيمته.
//   3) طلب واحد يعلّق العملية (مدّة إغلاق بمليار ساعة تدور في حلقة `score`).
//
// ما **لا** يعالجه هذا العمل، ولا يُدَّعى: لا مصادقة مستخدمين، ولا تشفير
// نقل، ولا عزل مستأجرين. مستخدمٌ آخر على الجهاز نفسه يصل إلى ما تصل إليه
// الواجهة. قول ذلك صراحةً أنفع من ترويسة تُقرأ إقراراً بأمن الإنتاج.

/** الاستماع على الحلقة المحلية وحدها ما لم يُطلب غيرها صراحةً. */
const BIND_HOST = process.env.MASAR_HOST || '127.0.0.1';

// WP-D3 — حُذف `resolveApiKey` والمفتاح الواحد معه.
// مفتاحٌ واحد يفتح كل انتقال يجعل «الأدوار» تسميةً في الواجهة. الأدوار الآن
// مفاتيح مستقلة — انظر `resolveRoleKeys`. وتُرك المفتاح الواحد قائماً بلا
// مستهلك كان سيبقى فحصه أخضر فوق مسار ميت.

// =====================================================================
// WP-D3 — فصل الصلاحيات
// =====================================================================
//
// القاعدة التي تُفرض هنا: **من يفحص الأثر لا يعتمد التصريح.**
//
// وهي لا تُفرض بإخفاء زرّ. الواجهة تستطيع دائماً أن تُظهر ما تشاء، ومن يفتح
// أدوات المطوّر يبدّل أي حقل في الطلب. فالدور **لا يُقرأ من جسم الطلب
// إطلاقاً**: يُشتقّ من المفتاح المرسَل، ويُكتب في السجل من الخادم. حقل `role`
// وارداً في الجسم يُتجاهل ويُستبدل — لا يُرفض بل يُستبدل، كي لا يكون رفضه
// سبيلاً لمعرفة ما يُقبل.
// والتخويل يقع على **الحالة الهدف** لا على اسم الفعل.
//
// `action` نصّ حرّ يرسله العميل: `approve` أو `sign-off` أو أي شيء. التخويل
// عليه يعني التخويل على تسمية يملكها الطرف غير الموثوق. أمّا الحالات فهي آلة
// الحالات المعلنة في `masar-desk-states.js` — وهي ما يعنيه القرار فعلاً.
const ROLES = {
  screener: {
    label: 'فاحص الأثر',
    statuses: ['CompletenessReview', 'ImpactScreening', 'CoordinationRequired',
      'SpecialistSimulation', 'StrategyReview', 'Returned'],
  },
  approver: {
    label: 'معتمِد',
    /* `StrategyReview` مُدرَجة لأنها وجهة التراجع: معتمِدٌ يُبطل اعتماده
       يعيد التصريح إلى المراجعة. حرمانه منها يترك قراراً بلا سبيل لنقضه. */
    statuses: ['Approved', 'Rejected', 'Returned', 'StrategyReview'],
  },
  coordinator: {
    label: 'منسّق',
    statuses: ['CoordinationRequired', 'ImpactScreening', 'Returned'],
  },
  publisher: {
    label: 'ناشر',
    statuses: ['Scheduled', 'Deployed', 'Suspended', 'Completed',
      'ClearanceReview', 'Closed', 'Calibrated'],
  },
};

/**
 * رفضُ تخويلٍ بحمولته.
 *
 * `RequestBodyError` تحمل رمزاً واحداً ولا تكفي هنا: المرفوض يحتاج أن يعرف
 * دوره وما يجيزه هذا الدور، وإلا صار الرفض لغزاً يُقرأ عطلاً في النظام.
 */
class DeniedError extends Error {
  constructor(statusCode, payload) {
    super(payload.error);
    this.statusCode = statusCode;
    this.payload = payload;
  }
}

/** الحالات التي تُنشئ التزاماً، فيقع عليها قيد فصل الواجبات. */
const BINDING_STATUSES = ['Approved', 'Rejected'];

/** الحالة التي تجعل صاحبها طرفاً في التحليل، فلا يحكم عليه. */
const SCREENING_STATUS = 'ImpactScreening';

/**
 * مفتاح لكل دور.
 *
 * ولا يُسلَّم منها عبر HTTP إلا مفتاح الفاحص. الباقي يُطبع في طرفية الخادم
 * عند الإقلاع. السبب أن الجهاز الواحد لا يفصل هويات: لو سلّمت نقطةُ المفتاح
 * مفاتيح الأدوار كلها لأخذ من يفتح أدوات المطوّر مفتاح المعتمِد في ثانية،
 * وصار الفصل زينة. أمّا من يملك الطرفية فهو المشغّل، وهذا حدّ معلن لا ثغرة.
 */
function resolveRoleKeys() {
  const keys = {};
  const generated = [];
  Object.keys(ROLES).forEach((role) => {
    const fromEnv = String(process.env[`MASAR_KEY_${role.toUpperCase()}`] || '').trim();
    if (fromEnv) {
      keys[role] = fromEnv;
    } else {
      keys[role] = crypto.randomBytes(24).toString('hex');
      generated.push(role);
    }
  });
  return { keys, generated };
}

/**
 * الدور المستحَقّ لمفتاح.
 *
 * تُفحص كل الأدوار ولا يُخرَج عند أول تطابق: الخروج المبكر يجعل زمن الردّ
 * دالّةً في ترتيب الدور، وهو تسريب صغير بلا مقابل.
 */
function roleForKey(keys, given) {
  let match = null;
  Object.keys(keys).forEach((role) => {
    if (keyMatches(keys[role], given)) match = role;
  });
  return match;
}

function mayPerform(role, status) {
  const definition = ROLES[role];
  return Boolean(definition) && definition.statuses.indexOf(status) !== -1;
}

/**
 * هل يخالف هذا القرار فصل الواجبات؟
 *
 * الشرط ليس «دور مختلف» بل **شخص مختلف**: معتمِدٌ فحص التصريح بنفسه صار
 * طرفاً في التحليل الذي يحكم عليه، ولو كان دوره يجيز الاعتماد. الفحص يقع على
 * سجلّ العمل نفسه لا على الطلب.
 *
 * @returns {string|null} سبب المنع، أو `null` إن لم يوجد
 */
function segregationBreach(existing, status, actor) {
  if (BINDING_STATUSES.indexOf(status) === -1) return null;
  const screened = (existing || []).some((record) => (
    record.status === SCREENING_STATUS && record.actor === actor
  ));
  if (!screened) return null;
  return `فاحص هذا التصريح لا يعتمده — «${actor}» سجّل الفحص`;
}

/** مقارنة بزمن ثابت — مقارنة `===` تسرّب طول البادئة المطابقة. */
function keyMatches(expected, given) {
  const a = Buffer.from(String(expected));
  const b = Buffer.from(String(given || ''));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** هل الطلب من الحلقة المحلية؟ */
function isLoopback(req) {
  const address = (req.socket && req.socket.remoteAddress) || '';
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

/**
 * سياسة أمن المحتوى.
 *
 * `'unsafe-inline'` مرفوض للنصوص البرمجية. الصفحات تحمل تسع كتل نصية مضمَّنة
 * وتسع كتل أنماط، فيُحقن `nonce` لكل طلب عند التقديم. الأنماط المضمَّنة تأخذ
 * `nonce` كذلك لا `'unsafe-inline'`.
 *
 * `connect-src 'self'` وحده: الصفحات لا تجلب من مضيف خارجي — الروابط الخارجية
 * روابط `href` لا موارد. أي إضافة لاحقة لمضيف خارجي ستسقط هنا، وهو المطلوب.
 */
function contentSecurityPolicy(nonce) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    `style-src 'self' 'nonce-${nonce}'`,
    /* WP-G2 — `style-src-attr` منفصل عن `style-src` عن عمد، لا تساهلاً.
     *
     * الـ`nonce` **لا يسري على سمات `style=""`** بنصّ المواصفة. فالسياسة
     * السابقة كانت تحجبها كلها: ثلاث وثلاثون سمة في صفحات المشروع وستّ
     * وعشرون في العرض، **حُجبت بصمت منذ WP-D1**. بلا سجلّ طرفية لأن السمات
     * الساكنة تُحجب دون تبليغ — ولذلك لم تلتقطها بوابة التخطيط.
     *
     * والفصل قائم في المواصفة (CSP Level 3) لهذا الغرض بالضبط: سمة نمط لا
     * تنفّذ شيفرة، وناقل XSS الذي تحرسه السياسة هو `script-src` وهو يبقى
     * على الـ`nonce` بلا تساهل. أمّا كتل `<style>` فتبقى على الـ`nonce`
     * كذلك عبر `style-src` أعلاه.
     *
     * الثمن المقبول: من يحقن HTML يستطيع تغيير مظهر عنصر. ومن يستطيع حقن
     * HTML لديه ما هو أسوأ من ذلك أصلاً. */
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}

const BASE_SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  // لا `Strict-Transport-Security`: الخادم على http محلي، وإرسالها هنا
  // ادعاءُ نقلٍ مشفَّر لا وجود له.
};

function securityHeaders(extra) {
  return { ...BASE_SECURITY_HEADERS, ...(extra || {}) };
}

/**
 * حدّ المعدّل — دلو رموز لكل عنوان.
 *
 * الغرض منع تعليق العملية بطلبات حسابية متلاحقة، لا صدّ هجوم موزَّع. عدّاد في
 * الذاكرة يسقط بسقوط العملية، وهذا مقبول لأن الخادم نفسه بلا ديمومة.
 */
const RATE_LIMIT = { capacity: 60, refillPerSecond: 1, maxBuckets: 1024 };

/**
 * حدود المعقولية للمدخلات الرقمية.
 *
 * `durationHoursMax` = 2160 ساعة (تسعون يوماً): أبعد ممّا تحتمله المحفظة
 * التوضيحية (سقفها 240) وأقصر من أن تعلّق العملية. وما فوقه ليس مُدخلاً
 * متطرفاً يستحق حساباً، بل مُدخل خاطئ يجب أن يُرفض.
 */
const BOUNDS = {
  aadtMax: 500000,
  lanesMax: 12,
  durationHoursMax: 2160,
  capacityPerLaneMax: 3000,
  freeFlowMinMax: 240,
  trenchKmMax: 100,
  permitsMergedMax: 500,
};

function createRateLimiter(options) {
  const settings = { ...RATE_LIMIT, ...(options || {}) };
  const buckets = new Map();

  return function take(address, nowMs) {
    const now = typeof nowMs === 'number' ? nowMs : Date.now();
    /* حدّ لعدد الدلاء: خريطة تنمو بعنوان مزوَّر لكل طلب هي تسريب ذاكرة
       بثوب حماية. عند الامتلاء يُطرح الأقدم مساساً. */
    if (!buckets.has(address) && buckets.size >= settings.maxBuckets) {
      let oldestKey = null;
      let oldestAt = Infinity;
      buckets.forEach((bucket, key) => {
        if (bucket.at < oldestAt) { oldestAt = bucket.at; oldestKey = key; }
      });
      if (oldestKey !== null) buckets.delete(oldestKey);
    }

    const bucket = buckets.get(address) || { tokens: settings.capacity, at: now };
    const elapsedSeconds = Math.max(0, (now - bucket.at) / 1000);
    bucket.tokens = Math.min(settings.capacity,
      bucket.tokens + elapsedSeconds * settings.refillPerSecond);
    bucket.at = now;

    if (bucket.tokens < 1) {
      buckets.set(address, bucket);
      const waitSeconds = Math.ceil((1 - bucket.tokens) / settings.refillPerSecond);
      return { allowed: false, retryAfterSeconds: Math.max(1, waitSeconds) };
    }

    bucket.tokens -= 1;
    buckets.set(address, bucket);
    return { allowed: true, remaining: Math.floor(bucket.tokens) };
  };
}

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.geojson': 'application/geo+json; charset=utf-8',
  '.pbf': 'application/x-protobuf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return CONTENT_TYPES[ext] || 'application/octet-stream';
}

function sendJson(res, statusCode, payload, extraHeaders) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, securityHeaders({
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    // استجابات الواجهة لا تُخزَّن: قرار مخزَّن في وسيط يُقرأ لاحقاً كحالة راهنة.
    'Cache-Control': 'no-store',
    ...(extraHeaders || {}),
  }));
  res.end(body);
}

function sendPlainError(res, statusCode, message) {
  res.writeHead(statusCode, securityHeaders({
    'Content-Type': 'text/plain; charset=utf-8',
  }));
  res.end(message);
}

/**
 * Read and JSON-parse a request body with a hard size limit.
 * Rejects with an Error on overflow or invalid JSON.
 */
class RequestBodyError extends Error {
  constructor(statusCode, code) {
    super(code);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let totalBytes = 0;
    let chunks = [];
    let tooLarge = false;

    req.on('data', (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_BODY_BYTES) {
        tooLarge = true;
        chunks = [];
        return;
      }
      if (!tooLarge) chunks.push(chunk);
    });

    req.on('end', () => {
      if (tooLarge) {
        reject(new RequestBodyError(413, 'PAYLOAD_TOO_LARGE'));
        return;
      }
      const raw = Buffer.concat(chunks).toString('utf8');
      if (raw.trim() === '') {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new RequestBodyError(400, 'INVALID_JSON'));
      }
    });

    req.on('error', (err) => reject(err));
  });
}

function isPlainObject(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value);
}

function validateScoreInput(input) {
  const fields = {};
  const required = ['aadt', 'lanes', 'lanesClosed', 'startHour', 'durationHours'];

  required.forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(input, field)
        || input[field] === undefined) {
      fields[field] = 'required';
    }
  });

  function requireFinite(field) {
    if (Object.prototype.hasOwnProperty.call(fields, field)) return false;
    if (typeof input[field] !== 'number' || !Number.isFinite(input[field])) {
      fields[field] = 'must be a finite number';
      return false;
    }
    return true;
  }

  /* WP-D1 — حدود عليا، لا حدود دنيا فقط.
     `durationHours` بلا سقف تدور في حلقة `score` مرة لكل ساعة: مليار ساعة
     تعلّق العملية بطلب واحد. والبقية حدود معقولية: مقطعٌ حضري بحركة نصف
     مليون أو بأربع عشرة حارة ليس مُدخلاً متطرفاً بل مُدخلاً خاطئاً، والرقم
     الخارج منه يبدو سليماً ويُقرأ. */
  if (requireFinite('aadt') && (input.aadt <= 0 || input.aadt > BOUNDS.aadtMax)) {
    fields.aadt = `must be between 1 and ${BOUNDS.aadtMax}`;
  }
  if (requireFinite('lanes')) {
    if (!Number.isInteger(input.lanes) || input.lanes <= 0 || input.lanes > BOUNDS.lanesMax) {
      fields.lanes = `must be an integer between 1 and ${BOUNDS.lanesMax}`;
    }
  }
  if (requireFinite('lanesClosed')) {
    if (!Number.isInteger(input.lanesClosed)
        || !Number.isInteger(input.lanes)
        || input.lanesClosed < 1
        || input.lanesClosed > input.lanes) {
      fields.lanesClosed = 'must be between 1 and lanes';
    }
  }
  if (requireFinite('startHour')) {
    if (!Number.isInteger(input.startHour)
        || input.startHour < 0
        || input.startHour > 23) {
      fields.startHour = 'must be an integer between 0 and 23';
    }
  }
  if (requireFinite('durationHours')
    && (input.durationHours <= 0 || input.durationHours > BOUNDS.durationHoursMax)) {
    fields.durationHours = `must be between 1 and ${BOUNDS.durationHoursMax}`;
  }

  const OPTIONAL_BOUNDS = {
    capacityPerLane: BOUNDS.capacityPerLaneMax,
    freeFlowMin: BOUNDS.freeFlowMinMax,
  };
  Object.keys(OPTIONAL_BOUNDS).forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(input, field)) return;
    if (typeof input[field] !== 'number' || !Number.isFinite(input[field])) {
      fields[field] = 'must be a finite number';
    } else if (input[field] <= 0 || input[field] > OPTIONAL_BOUNDS[field]) {
      fields[field] = `must be between 1 and ${OPTIONAL_BOUNDS[field]}`;
    }
  });

  return { valid: Object.keys(fields).length === 0, fields };
}

function validateDigOnceInput(input) {
  const fields = {};
  for (const field of ['trenchKm', 'permitsMerged']) {
    if (!Object.prototype.hasOwnProperty.call(input, field)
        || input[field] === undefined) {
      fields[field] = 'required';
    } else if (typeof input[field] !== 'number' || !Number.isFinite(input[field])) {
      fields[field] = 'must be a finite number';
    }
  }
  if (!fields.trenchKm && (input.trenchKm <= 0 || input.trenchKm > BOUNDS.trenchKmMax)) {
    fields.trenchKm = `must be between 1 and ${BOUNDS.trenchKmMax}`;
  }
  if (!fields.permitsMerged
      && (!Number.isInteger(input.permitsMerged)
        || input.permitsMerged < 1
        || input.permitsMerged > BOUNDS.permitsMergedMax)) {
    fields.permitsMerged = `must be an integer between 1 and ${BOUNDS.permitsMergedMax}`;
  }
  return { valid: Object.keys(fields).length === 0, fields };
}

async function handleJsonEndpoint(req, res, validate, execute) {
  try {
    const body = await readJsonBody(req);
    if (!isPlainObject(body)) {
      sendJson(res, 400, { error: 'INVALID_JSON_STRUCTURE' });
      return;
    }
    const validation = validate(body);
    if (!validation.valid) {
      sendJson(res, 422, {
        error: 'VALIDATION_ERROR',
        fields: validation.fields,
      });
      return;
    }
    sendJson(res, 200, execute(body));
  } catch (err) {
    if (err instanceof DeniedError) {
      sendJson(res, err.statusCode, err.payload);
      return;
    }
    if (err instanceof RequestBodyError) {
      sendJson(res, err.statusCode, { error: err.code });
      return;
    }
    sendJson(res, 500, { error: 'INTERNAL_ERROR' });
  }
}

async function handleApiScore(req, res) {
  return handleJsonEndpoint(req, res, validateScoreInput, (body) =>
    MasarEngine.score({ ...MasarEngine.DEFAULTS, ...body })
  );
}

async function handleApiOptimize(req, res) {
  return handleJsonEndpoint(req, res, validateScoreInput, (body) =>
    MasarEngine.optimize({ ...MasarEngine.DEFAULTS, ...body })
  );
}

async function handleApiDigOnce(req, res) {
  return handleJsonEndpoint(
    req,
    res,
    validateDigOnceInput,
    (body) => MasarEngine.digOnce(body)
  );
}

/**
 * سجل القرارات — ثابتٌ على القرص (WP-L1).
 * ---------------------------------------------------------------------------
 * كان هنا مكتوباً أن حفظ السجل على القرص «يوهم بديمومة لا وجود لها». كان ذلك
 * صحيحاً حين كان السجل أثراً معمارياً يثبت أن دورة القرار تعبر واجهة.
 *
 * ثم جعلته WP-D3 **مستنداً يُفرَض به قيد**: `segregationBreach` تقرأ من السجل
 * لتمنع فاحصاً من اعتماد ما فحصه. وسجلٌّ في الذاكرة يعني أن إعادة تشغيل
 * الخادم تُفرغه فيسقط القيد — **قاعدةٌ تُهزَم بإعادة تشغيل، لا بثغرة**.
 *
 * فالثبات شرطُ بقاءِ ما أُعلن، لا ترقية تخزين. التفاصيل في `masar-ledger.js`.
 *
 * ويبقى المتصفح مخزناً موازياً: سقوط الخادم لا يفقد المراجع قراره.
 *
 * السجل يخص نسخة الخادم لا الوحدة: خادمان في العملية نفسها لا يتشاركان
 * قرارات ما لم يُمرَّر لهما المسار نفسه صراحةً — وإلا تسرّبت حالة اختبار إلى
 * اختبار.
 */
const DEFAULT_LEDGER_PATH = path.resolve(process.env.MASAR_LEDGER
  || path.join(ROOT_DIR, '..', '.masar', 'decisions.jsonl'));

/* خارج جذر الصفحات عمداً: ملفٌ تحت `presentation/` يُقدَّم عبر HTTP، فيصير
   سجل القرارات مقروءاً لأي طالب. */
const DECISION_REQUIRED = ['version', 'status', 'action', 'actor', 'at'];

function validateDecision(body) {
  const fields = {};

  DECISION_REQUIRED.forEach((field) => {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      fields[field] = 'required';
    }
  });

  if (body.version !== undefined
    && (!Number.isInteger(body.version) || body.version < 2)) {
    // النسخة الأولى هي الطلب نفسه؛ أول قرار ينتج النسخة الثانية.
    fields.version = 'must be an integer greater than 1';
  }
  if (body.at !== undefined && body.at !== null && Number.isNaN(Date.parse(body.at))) {
    fields.at = 'must be an ISO date-time';
  }
  if (body.inputs !== undefined && !isPlainObject(body.inputs)) {
    fields.inputs = 'must be an object';
  }

  /**
   * قاعدة نسخة المدخلات، وحدُّها.
   * ---------------------------------------------------------------------------
   * القاعدة: لا قرار بلا نسخة مدخلاته — لأن قراراً لا يُعرف ما استُند إليه
   * قرارٌ غير قابل للتفسير.
   *
   * والتراجع ليس قراراً بهذا المعنى: لم يُعد حساباً ولم يستند إلى مدخلات، بل
   * يُبطل قراراً سابقاً ويستند إليه هو. اشتراط نسخة مدخلات له كان يدفع إلى
   * أحد أمرين، كلاهما أسوأ من الاستثناء: إمّا أن يُلفَّق له مدخلات لم تُستعمل،
   * أو أن يُرفض فينفصل سجل الخادم عن سجل المتصفح ويظهر القرار بلا تراجعه.
   *
   * فالبديل أن يُسأل التراجع عمّا يملكه فعلاً: أن يسمّي ما أبطله.
   */
  const isUndo = body.action === 'undo';

  if (!isUndo && (!body.inputs || Object.keys(body.inputs).length === 0)) {
    fields.inputs = 'inputs snapshot is required — a decision without it is not explainable';
  }

  if (isUndo && !String(body.reason || '').trim()) {
    fields.reason = 'an undo must name the decision it reverses';
  }

  return { valid: Object.keys(fields).length === 0, fields };
}

/* WP-L1 — الدمج والتثبيت صارا في السجل نفسه: قاعدة استبدال النسخة تعيش في
   مكان واحد. بقاؤها هنا كان سيعني نسختين تفترقان عند أول تعديل. */
function storeDecision(store, workId, record) {
  return store.append({ ...record, workId }) || [];
}

function workIdFromPath(pathname) {
  const match = pathname.match(/^\/api\/works\/([A-Za-z0-9_-]{1,64})\/decisions$/);
  return match ? match[1] : null;
}

/**
 * WP-D3 — التخويل يقع **بعد** التحقق من الشكل و**قبل** التخزين.
 *
 * ترتيبٌ مقصود: قبل التحقق لا يُعرف الفعل، وبعد التخزين يكون الضرر وقع.
 * والرفض لا يكفي أن يكون `403`: البوابة تقرأ السجل بعده وتشترط أنه لم يتغيّر.
 */
async function handleApiDecisionPost(req, res, store, workId) {
  const role = req.masarRole;

  return handleJsonEndpoint(req, res, validateDecision, (body) => {
    if (!mayPerform(role, body.status)) {
      throw new DeniedError(403, {
        error: 'ROLE_NOT_PERMITTED',
        role: role,
        roleLabel: ROLES[role] ? ROLES[role].label : '',
        status: body.status,
        allowed: ROLES[role] ? ROLES[role].statuses : [],
      });
    }

    const breach = segregationBreach(store.get(workId), body.status, body.actor);
    if (breach) {
      throw new DeniedError(403, {
        error: 'SEGREGATION_OF_DUTIES',
        reason: breach,
      });
    }

    /* الدور يُكتب من الخادم فوق أي قيمة واردة. لا يُرفض الوارد بل يُستبدل:
       رفضه يخبر المُرسِل أن الحقل مقروء، والاستبدال لا يخبره بشيء. */
    const record = { ...body, role: role, roleLabel: ROLES[role].label };

    return {
      workId,
      role: role,
      stored: storeDecision(store, workId, record).length,
      decisions: store.get(workId),
    };
  });
}

function handleApiDecisionGet(res, store, workId) {
  sendJson(res, 200, { workId, decisions: store.get(workId) || [] });
}

function handleApiDecisionsAll(res, store) {
  const works = {};
  store.forEach((records, workId) => { works[workId] = records; });
  sendJson(res, 200, {
    works,
    counts: {
      works: store.size,
      decisions: Object.keys(works).reduce((total, id) => total + works[id].length, 0),
    },
  });
}

function handleApiWorks(req, res) {
  fs.readFile(WORKS_GEOJSON_PATH, 'utf8', (err, data) => {
    if (err) {
      sendJson(res, 404, { error: 'works.geojson not found' });
      return;
    }
    res.writeHead(200, { 'Content-Type': CONTENT_TYPES['.geojson'] });
    res.end(data);
  });
}

/**
 * يحلّ مساراً نسبياً داخل جذر محدَّد، ويعيد `null` إن خرج عنه.
 *
 * WP-G2 — الحارس **مُعامَل لا موسَّع**.
 * الطريق الأقصر لتقديم مادة التسليم كان توسيع `ROOT_DIR` ليشمل أباه. ذلك
 * يفتح المستودع كلّه — الاختبارات، والخطط، وسجلّ العمل — على الشبكة، ويجعل
 * حارس اجتياز المسار حارساً على لا شيء. فالجذر صار مُعامَلاً: كل تركيب يحرس
 * نفسه، وتوسيع أحدهما لا يوسّع الآخر.
 */
function resolveWithin(rootDir, relativePath) {
  const resolved = path.resolve(path.join(rootDir, relativePath));
  if (resolved !== rootDir && !resolved.startsWith(rootDir + path.sep)) return null;
  return resolved;
}

/**
 * Serve a static file from a mount root, guarding against path traversal.
 */
function serveFrom(req, res, rootDir, relativePath) {
  const requestedPath = resolveWithin(rootDir, relativePath);
  if (requestedPath === null) {
    sendPlainError(res, 403, 'Forbidden');
    return;
  }

  fs.stat(requestedPath, (statErr, stats) => {
    if (statErr || !stats.isFile()) {
      sendPlainError(res, 404, 'Not Found');
      return;
    }

    fs.readFile(requestedPath, (readErr, data) => {
      if (readErr) {
        sendPlainError(res, 500, 'Internal Server Error');
        return;
      }

      const nonce = crypto.randomBytes(16).toString('base64');
      const headers = securityHeaders({
        'Content-Type': contentTypeFor(requestedPath),
        'Content-Security-Policy': contentSecurityPolicy(nonce),
      });

      /* حقن الـ`nonce` في الصفحات وحدها. البديل — `'unsafe-inline'` —
         يبطل الحماية التي تدّعيها السياسة نفسها. */
      if (/\.html$/i.test(requestedPath)) {
        const body = injectNonce(data.toString('utf8'), nonce);
        headers['Content-Length'] = Buffer.byteLength(body);
        res.writeHead(200, headers);
        res.end(body);
        return;
      }

      headers['Content-Length'] = data.length;
      res.writeHead(200, headers);
      res.end(data);
    });
  });
}

/**
 * صفحات المشروع.
 *
 * الجذر يفتح على الصفحة الأولى في شريط التنقل نفسه: من كتب العنوان بلا مسار
 * كان يهبط على النموذج التفاعلي — الصفحة التي أزاحها الهيكل إلى «التفاصيل
 * المتقدمة» — فيقرأها المنتج.
 */
/**
 * ما لا يُقدَّم من جذر الصفحات وإن كان داخله.
 *
 * WP-G2 — انكشف أثناء فحص التركيب: `GET /submission/../server.js` يعود
 * `200`. السبب أن `new URL()` تطبّع `..` **قبل** أي فحص، فيصير المسار
 * `/server.js` ويقع على جذر الصفحات. وحارس الاجتياز سليم — الملف فعلاً داخل
 * الجذر. العيب أن الجذر يحوي ما ليس صفحة.
 *
 * فالخادم كان يقدّم شيفرته نفسها، وحزم اختباره، وسكربتات بنائه. ليس تسريب
 * سرّ — لا سرّ في المستودع — لكنه سطح لا سبب له، وأول ما يجرّبه من يفحص.
 */
const PRIVATE_PATHS = [
  { test: (rel) => rel === 'server.js', why: 'شيفرة الخادم' },
  { test: (rel) => rel.startsWith('tests/'), why: 'حزم الاختبار' },
  { test: (rel) => rel.startsWith('scripts/'), why: 'سكربتات البناء' },
];

function isPrivatePath(relativePath) {
  const normalized = relativePath.replace(/^\/+/, '').split(path.sep).join('/');
  return PRIVATE_PATHS.some((entry) => entry.test(normalized));
}

function serveStatic(req, res, pathname) {
  const decodedPath = decodeURIComponent(pathname);
  const relativePath = decodedPath === '/' ? '/masar-home.html' : decodedPath;
  if (isPrivatePath(relativePath)) {
    sendPlainError(res, 403, 'Forbidden');
    return;
  }
  serveFrom(req, res, ROOT_DIR, relativePath);
}

/**
 * مادة التسليم — للقراءة فقط.
 *
 * كانت خارج جذر الخادم فيردّ عليها `403`: **الخادم لا يستطيع تقديم عرض
 * مشروعه**. والأثر ليس شكلياً — عرضٌ لا يُقدَّم لا يُفحَص، فتبقى مدّته
 * وتنقّله وسلوكه على الشاشات كلها غير متحقَّقة، ويُحتسب غير المتحقَّق فشلاً.
 *
 * القراءة فقط: لا `POST` يصل إلى هنا لأن التوجيه لا يمرّره أصلاً.
 */
function serveSubmission(req, res, pathname) {
  const decoded = decodeURIComponent(pathname);
  const relative = decoded.slice(SUBMISSION_MOUNT.length) || '/';
  serveFrom(req, res, SUBMISSION_DIR, relative === '/' ? '/' : relative);
}

/**
 * يضيف `nonce` إلى كل وسم نصّي أو نمطيّ مضمَّن.
 *
 * الوسوم ذات `src` لا تحتاجه (`'self'` يغطيها). والاستبدال يشترط أن يكون
 * التالي حرفَ مسافة أو `>` كي لا يلتقط `<scripting>` أو `<styles>` لو ظهرا.
 */
function injectNonce(html, nonce) {
  return html
    /* WP-G2 — الـ`nonce` يذهب إلى **كل** وسم نصّي، بما فيه ذو `src`.
     *
     * الوسوم الخارجية لا تحتاجه لتُنفَّذ (`'self'` تغطيها). لكنها تحتاجه
     * لتستطيع حقن نمط وقت التشغيل: `masar-nav.js` ينشئ `<style>` ويضيفه إلى
     * الرأس، فتحجبه `style-src-elem` لأنه بلا `nonce` — وشريط التنقل يبقى
     * بلا أنماط في كل صفحة. حُجب بصمت منذ WP-D1 ولم تلتقطه بوابة التخطيط.
     *
     * ومع الـ`nonce` على الوسم يقرؤه السكربت من `document.currentScript.nonce`
     * ويمرّره إلى ما ينشئه. */
    .replace(/<script(\s|>)/gi, `<script nonce="${nonce}"$1`)
    .replace(/<style(\s|>)/gi, `<style nonce="${nonce}"$1`);
}

/**
 * نقاط النهاية التي تغيّر حالة الخادم.
 *
 * الحساب (`score`/`optimize`/`digonce`) رياضيات صرفة بلا حالة، فحمايته
 * بمفتاح تمنع الواجهة من العمل بلا فائدة أمنية مقابلة — يكفيها حدّ المعدّل
 * والحدود. **الكتابة** في سجل القرارات هي ما يستحق مفتاحاً: سجلٌّ يقبل
 * الكتابة من أي طرف سجلٌّ بلا قيمة إثباتية.
 */
function isWriteRoute(pathname, method) {
  return method === 'POST' && /^\/api\/works\/[A-Za-z0-9_-]{1,64}\/decisions$/.test(pathname);
}

function createServer(options) {
  const settings = options || {};
  /* WP-L1 — السجل يُحمَّل من القرص عند الإنشاء.
     تمرير `ledgerPath: null` يعطي سجلاً في الذاكرة وحدها: تستعمله الحزم التي
     لا تفحص الثبات، فلا تتلوّث حالةُ اختبارٍ بحالة آخر. */
  const ledgerPath = settings.ledgerPath === undefined
    ? DEFAULT_LEDGER_PATH
    : settings.ledgerPath;
  const decisions = createLedger(ledgerPath, {
    onWarn: settings.onWarn || ((message) => console.warn(message)),
  });
  const roleKeys = settings.roleKeys || resolveRoleKeys().keys;
  const takeToken = settings.rateLimiter || createRateLimiter(settings.rateLimit);

  return http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, 'http://localhost');
    const pathname = parsedUrl.pathname || '/';

    if (pathname.startsWith('/api/')) {
      const address = (req.socket && req.socket.remoteAddress) || 'unknown';
      const verdict = takeToken(address);
      if (!verdict.allowed) {
        sendJson(res, 429, { error: 'RATE_LIMITED' },
          { 'Retry-After': String(verdict.retryAfterSeconds) });
        return;
      }
    }

    /* المفتاح يُسلَّم لطالبٍ من الحلقة المحلية وحدها.
       ما يمنعه: الوصول من الشبكة. ما لا يمنعه — ويُقال صراحةً: مستخدمٌ آخر
       على الجهاز نفسه. هذا حدُّ نموذجٍ يعمل على جهاز واحد، لا ثغرة مخفية. */
    if (pathname === '/api/session-key' && req.method === 'GET') {
      if (!isLoopback(req)) {
        sendJson(res, 403, { error: 'LOOPBACK_ONLY' });
        return;
      }
      /* WP-D3 — لا يُسلَّم إلا مفتاح الفاحص.
         تسليم مفاتيح الأدوار كلها هنا يجعل الفصل زينة: من يفتح أدوات المطوّر
         يأخذ مفتاح المعتمِد في ثانية. مفاتيح الأدوار الأعلى تُطبع في طرفية
         الخادم — ومن يملك الطرفية هو المشغّل. */
      sendJson(res, 200, {
        key: roleKeys.screener,
        role: 'screener',
        scope: `${ROLES.screener.label} — ${ROLES.screener.statuses.join('، ')}`,
        limits: 'يُمنح للحلقة المحلية وحدها، ولا يعتمد. '
          + 'مفاتيح الأدوار الأخرى تُطبع في طرفية الخادم عند الإقلاع.',
      });
      return;
    }

    if (isWriteRoute(pathname, req.method)) {
      const role = roleForKey(roleKeys, req.headers['x-masar-key']);
      if (!role) {
        sendJson(res, 401, {
          error: 'MISSING_OR_INVALID_KEY',
          hint: 'أرسل ترويسة X-Masar-Key — مفتاح الفاحص من GET /api/session-key، '
            + 'ومفاتيح الأدوار الأخرى من طرفية الخادم',
        });
        return;
      }
      req.masarRole = role;
    }

    if (pathname === '/api/score' && req.method === 'POST') {
      handleApiScore(req, res);
      return;
    }
    if (pathname === '/api/optimize' && req.method === 'POST') {
      handleApiOptimize(req, res);
      return;
    }
    if (pathname === '/api/digonce' && req.method === 'POST') {
      handleApiDigOnce(req, res);
      return;
    }
    if (pathname === '/api/works' && req.method === 'GET') {
      handleApiWorks(req, res);
      return;
    }
    if (pathname === '/api/decisions' && req.method === 'GET') {
      handleApiDecisionsAll(res, decisions);
      return;
    }

    const decisionWorkId = workIdFromPath(pathname);
    if (decisionWorkId && req.method === 'POST') {
      handleApiDecisionPost(req, res, decisions, decisionWorkId);
      return;
    }
    if (decisionWorkId && req.method === 'GET') {
      handleApiDecisionGet(res, decisions, decisionWorkId);
      return;
    }
    if (pathname.startsWith('/api/')) {
      sendJson(res, 404, { error: 'Unknown API route' });
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      sendPlainError(res, 405, 'Method Not Allowed');
      return;
    }

    if (pathname === SUBMISSION_MOUNT || pathname.startsWith(SUBMISSION_MOUNT + '/')) {
      serveSubmission(req, res, pathname);
      return;
    }

    serveStatic(req, res, pathname);
  });
}

if (require.main === module) {
  const resolved = resolveRoleKeys();
  const server = createServer({ roleKeys: resolved.keys });
  server.listen(PORT, BIND_HOST, () => {
    console.log(`Masar server listening on http://${BIND_HOST}:${PORT}`);
    /* مفاتيح الأدوار تُطبع هنا ولا تُقدَّم عبر HTTP إلا مفتاح الفاحص.
       الطرفية هي حدّ المشغّل على جهاز واحد. */
    console.log('مفاتيح الأدوار (WP-D3):');
    Object.keys(ROLES).forEach((role) => {
      const source = resolved.generated.indexOf(role) === -1
        ? `MASAR_KEY_${role.toUpperCase()}` : 'مولَّد لهذه الجلسة';
      console.log(`  ${ROLES[role].label.padEnd(12)} ${role.padEnd(12)} `
        + `${resolved.keys[role]}  (${source})`);
    });
    console.log('  مفتاح الفاحص وحده يُسلَّم عبر GET /api/session-key');
    if (BIND_HOST !== '127.0.0.1') {
      console.log('تحذير: الاستماع خارج الحلقة المحلية — الخادم نموذج أولي '
        + 'بلا مصادقة مستخدمين ولا تشفير نقل.');
    }
  });
}

module.exports = {
  createServer,
  validateScoreInput,
  validateDigOnceInput,
  validateDecision,
  // WP-D1
  BOUNDS,
  BASE_SECURITY_HEADERS,
  contentSecurityPolicy,
  createRateLimiter,
  injectNonce,
  isWriteRoute,
  ROLES,
  BINDING_STATUSES,
  SCREENING_STATUS,
  resolveRoleKeys,
  roleForKey,
  mayPerform,
  segregationBreach,
  resolveWithin,
  isPrivatePath,
  PRIVATE_PATHS,
  SUBMISSION_DIR,
  SUBMISSION_MOUNT,
  DEFAULT_LEDGER_PATH,
  keyMatches,
};
