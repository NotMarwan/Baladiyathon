/**
 * مسار — تطبيع بيانات الأعمال إلى المخطط الذي ترسمه الطبقات
 * ---------------------------------------------------------------------------
 * 1) مخطط واحد يفصل الرسم عن مصدر البيانات — تغيير المصدر لا يمس الطبقات.
 * 2) impactLevel العربي يتحول إلى شدة رقمية تقود اللون وترتيب الرموز.
 * 3) المجموعة معلنة في البيانات؛ حالة سير المعاملة لا تشتق منها مجموعةَ رسم.
 * 4) التواريخ إلى epoch — الفلترة الزمنية تقارن أرقاماً لا نصوصاً.
 * 5) الميزات بلا هندسة تُسقط بصمت بدل أن تُسقط الخريطة كلها.
 * 6) الفصل حسب الهندسة إجباري: التجميع يُسقط كل ما ليس Point.
 * 7) المرجع المنشور هو رقم التصريح لا مفتاح السجل الداخلي.
 * 8) البحث يطابق بعد تطبيع الإملاء — الساكن يكتب بلا همزة.
 * 9) الحدود تُمشى مركّبةً فلا تنكسر على MultiLineString.
 * 10) دوال نقية — تُختبر في Node.
 *
 * UMD بنفس نمط masar-engine.js.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MasarWorksMapData = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var IMPACT_SEVERITY = { high: 3, medium: 2, low: 1 };
  var IMPACT_SUBTYPE = { high: 'emergency', medium: 'development', low: 'default' };

  function text(value, fallback) {
    return typeof value === 'string' && value.length > 0 ? value : (fallback || '');
  }

  /** رقم أو صفر — والصفر هنا «لا قيمة» لا قيمةً محسوبة، فتقرؤه البطاقة غياباً. */
  function number(value) {
    var parsed = Number(value);
    return isFinite(parsed) ? parsed : 0;
  }

  function epoch(value) {
    if (typeof value === 'number') return value;
    var parsed = typeof value === 'string' ? Date.parse(value) : NaN;
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * المجموعة تُقرأ من البيانات لا من حالة المعاملة.
   * ---------------------------------------------------------------------------
   * كان هنا اشتقاقٌ من `status`: «مغلق» ← إغلاقات. والحالة في محفظة المدينة
   * حالةُ سيرٍ إداري (ImpactScreening · StrategyReview · Approved · Deployed)
   * لا حالةَ طريق — لا واحدة منها تعني «الشارع مغلق»، فالفرع لم يكن يشتعل أصلاً.
   * وإبقاؤه يوهم بقاعدةٍ تحكم التصنيف بينما `group` هي المصدر الوحيد له.
   * حُذف عمداً: تصنيفُ الرسم إعلانٌ في البيانات، لا استنتاجٌ من دورة العمل.
   */
  function groupOf(properties) {
    return text(properties.group, 'roadworks');
  }

  var HAMZA_ALEF = /[أإآٱ]/g;
  // بالترميز لا بالحرف: التشكيل (064B–0652) والتطويل (0640) علامات غير مرئية،
  // وكتابتها حرفياً داخل صنف محارف تجعل الصنف يُقرأ فارغاً في أي محرر لا يُظهرها.
  var DIACRITICS = /[\u064B-\u0652\u0640]/g;

  /**
   * تطبيع الإملاء قبل المطابقة.
   * ---------------------------------------------------------------------------
   * ٣٨ من ١١٤ شارعاً في المحفظة فيها همزة و٢٣ فيها تاء مربوطة، والساكن يكتب
   * «ابو عبيده» لا «أبو عبيدة»: البحث بالمقارنة الخام كان يعيد صفراً على
   * الإملاء الشائع ويعيد نتيجة على الإملاء المدقَّق وحده — أي أنه يخدم من
   * يعرف الجواب سلفاً. التطبيع يطال الطرفين معاً وإلا بقي أحدهما بهمزته.
   * ولاتينيةُ المرجع تُخفَّض: «bld-2026-0001» و«BLD-2026-0001» مرجع واحد.
   */
  function normalizeArabic(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(DIACRITICS, '')
      .replace(HAMZA_ALEF, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[ؤئ]/g, 'ء')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  // ما يطابقه البحث العام: اسم الشارع والعنوان والجهة والمرجع المنشور. المفتاح
  // الداخلي معهم لأن المراجع يتداوله في الروابط، لا لأن الساكن يعرفه.
  var SEARCH_FIELDS = ['street', 'title', 'promoter', 'contractor', 'permitRef', 'id'];

  /** هل يطابق سجلٌ نصَّ بحث؟ نقية — تُختبر بلا خريطة. */
  function matchesQuery(properties, needle) {
    var query = normalizeArabic(needle);
    if (!query) return true;
    var p = properties || {};
    for (var i = 0; i < SEARCH_FIELDS.length; i += 1) {
      if (normalizeArabic(p[SEARCH_FIELDS[i]]).indexOf(query) !== -1) return true;
    }
    return false;
  }

  /**
   * ما تُظهره الخريطة فعلاً: بحثٌ ثم فترةٌ ثم إظهار طبقات.
   * ---------------------------------------------------------------------------
   * الثلاثة تُطبَّق على الخريطة في ثلاثة أمكنة — مصدرُ الميزات للبحث، وفلتر
   * الطبقة للفترة، و`visibility` للمجموعة — فتُقرأ قاعدة «ما هو ظاهر» من ثلاثة
   * مواضع. هنا تُكتب مرة واحدة، فتسرد القائمةُ ما يُرسم لا ما يُظن أنه يُرسم،
   * وتُختبر المزامنة بدل أن تُدَّعى.
   * التداخل لا الاحتواء — كما في `buildDateFilter`: عملٌ بدأ أمس وينتهي غداً
   * عملٌ قائم اليوم.
   */
  function filterRecords(features, options) {
    var opts = options || {};
    var range = opts.range || null;
    var hidden = opts.hiddenGroups || {};

    return (features || []).filter(function (feature) {
      var p = (feature && feature.properties) || {};
      if (hidden[p.group]) return false;
      if (range && !(p.start_ts < range.to && p.end_ts > range.from)) return false;
      return matchesQuery(p, opts.query);
    });
  }

  function toCanonical(properties) {
    var impact = text(properties.impactLevel, 'low');
    var from = text(properties.from);
    var to = text(properties.to);
    var span = from && to ? from + ' ← ' + to : text(properties.description);
    var id = text(properties.id, 'WORK-?');

    return {
      id: id,
      // المرجع المنشور رقم التصريح: هو ما يذكره مكتب المراجع وما يحمله اسم ملف
      // القرار المُنزَّل. `id` مفتاح داخلي (p001) لا يعني شيئاً خارج المخزن،
      // وعرضه بوصفه «المرجع» يعطي الساكن رقماً لا يستطيع أن يراجع به أحداً.
      permitRef: text(properties.permitRef, id),
      group: groupOf(properties),
      subtype: text(properties.subtype, IMPACT_SUBTYPE[impact] || 'default'),
      title: text(properties.road, text(properties.title, 'أعمال طرق')),
      description: span,
      start_ts: epoch(properties.start || properties.start_ts),
      end_ts: epoch(properties.end || properties.end_ts),
      severity: typeof properties.severity === 'number'
        ? properties.severity
        : (IMPACT_SEVERITY[impact] || 0),
      promoter: text(properties.promoter),
      contractor: text(properties.contractor),
      road: text(properties.road),
      // الشارع يبقى حقلاً مستقلاً: البحث العام يطابق عليه، والعنوان قد يتغير.
      street: text(properties.street, text(properties.road)),
      /**
       * الحل يعبر التطبيع مع المشكلة.
       * -----------------------------------------------------------------------
       * المخطط كان يحمل «أين العمل ومتى ومن» ويسقط «وماذا نفعل به». فكانت
       * الخريطة تشخيصاً: تعرض مئة وخمسين تصريحاً ولا تعرض قراراً واحداً، مع أن
       * التوصية محسوبة ومكتوبة مع البيانات.
       * الأرقام تمرّ كما هي — الحساب تمّ عند البناء بمحرك مسار، والتطبيع ينقل
       * ولا يحسب.
       */
      impactVehHours: number(properties.impactVehHours),
      bestVehHours: number(properties.bestVehHours),
      savedPct: number(properties.savedPct),
      asIsWindow: text(properties.asIsWindow),
      bestWindow: text(properties.bestWindow),
      bestReason: text(properties.bestReason),
    };
  }

  function normalizeWorks(raw) {
    var source = raw || {};
    var input = Array.isArray(source.features) ? source.features : [];
    var features = [];

    for (var i = 0; i < input.length; i += 1) {
      var item = input[i];
      if (!item || !item.geometry) continue;
      features.push({
        type: 'Feature',
        geometry: item.geometry,
        properties: toCanonical(item.properties || {}),
      });
    }

    return { type: 'FeatureCollection', features: features };
  }

  /**
   * يمشي أي عمق من مصفوفات الإحداثيات.
   * ---------------------------------------------------------------------------
   * `coordinates` ليست مصفوفةَ مواضع مسطحة إلا في Point و LineString. المحفظة
   * اليوم ١٣٤ خطاً و١٦ نقطة فيمرّ المشي المسطّح، لكن أول MultiLineString يجعل
   * كل عنصر مصفوفةً فتصير المقارنة `Math.min(x, [ ])` ← NaN، وتنهار الحدود
   * صامتةً: `fitBounds` على NaN لا يرمي، يطير بالخريطة إلى العدم.
   * الموضع يُعرف بأن أول عنصريه رقمان — لا بعمق الهندسة.
   */
  function eachPosition(coordinates, visit) {
    if (!Array.isArray(coordinates) || coordinates.length === 0) return;
    if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
      visit(coordinates);
      return;
    }
    for (var i = 0; i < coordinates.length; i += 1) eachPosition(coordinates[i], visit);
  }

  /** حدود مجموعة ميزات: [[غرب، جنوب]، [شرق، شمال]] أو null إن لم يكن فيها موضع. */
  function boundsOf(features) {
    var west = Infinity;
    var south = Infinity;
    var east = -Infinity;
    var north = -Infinity;

    (features || []).forEach(function (feature) {
      if (!feature || !feature.geometry) return;
      eachPosition(feature.geometry.coordinates, function (point) {
        if (point[0] < west) west = point[0];
        if (point[0] > east) east = point[0];
        if (point[1] < south) south = point[1];
        if (point[1] > north) north = point[1];
      });
    });

    if (west === Infinity) return null;
    return [[west, south], [east, north]];
  }

  /** يسطّح LineString و MultiLineString إلى قائمة إحداثيات واحدة. */
  function positionsOf(geometry) {
    var coordinates = geometry.coordinates || [];
    if (geometry.type === 'MultiLineString') {
      return coordinates.reduce(function (all, part) { return all.concat(part); }, []);
    }
    return coordinates;
  }

  /**
   * منتصف المسار بالطول لا بعدد النقاط.
   * ---------------------------------------------------------------------------
   * محاور الشوارع تأتي بكثافة إحداثيات متفاوتة: المنعطف يحمل عشر نقاط في خمسين
   * متراً والمستقيم نقطتين في كيلومتر. أخذ العنصر الأوسط من المصفوفة يرمي
   * المرساة داخل المنعطف، فتظهر الأيقونة في طرف المقطع لا في وسطه.
   */
  function midpoint(positions) {
    if (positions.length === 0) return null;
    if (positions.length === 1) return positions[0];

    var spans = [];
    var total = 0;
    for (var i = 1; i < positions.length; i += 1) {
      var dx = positions[i][0] - positions[i - 1][0];
      var dy = positions[i][1] - positions[i - 1][1];
      var length = Math.sqrt(dx * dx + dy * dy);
      spans.push(length);
      total += length;
    }
    if (total === 0) return positions[0];

    var target = total / 2;
    var walked = 0;
    for (var j = 0; j < spans.length; j += 1) {
      if (walked + spans[j] >= target) {
        var ratio = spans[j] === 0 ? 0 : (target - walked) / spans[j];
        return [
          positions[j][0] + (positions[j + 1][0] - positions[j][0]) * ratio,
          positions[j][1] + (positions[j + 1][1] - positions[j][1]) * ratio,
        ];
      }
      walked += spans[j];
    }
    return positions[positions.length - 1];
  }

  /**
   * مرساة نقطية لكل خط.
   * ---------------------------------------------------------------------------
   * طبقة الرموز لا ترسم فوق LineString — MapLibre يضع الرمز على هندسة نقطية
   * فقط. ومحفظة الرياض ١٣٤ خطاً مقابل ١٦ نقطة، فبلا مرساة تختفي أيقونات
   * الأعمال والإغلاقات والحوادث كلها وتبقى نقاط الاهتمام وحدها ظاهرة.
   * one.network يرسل نقطة مع كل مقطع؛ هنا تُشتق من منتصف المسار.
   * المرساة تحمل نفس الخصائص، فالبوب-أب والفلترة والتجميع تعمل عليها كما على
   * أي نقطة أصلية.
   */
  function anchorOf(feature) {
    var center = midpoint(positionsOf(feature.geometry));
    if (!center) return null;
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: center },
      properties: feature.properties,
    };
  }

  function splitByGeometry(collection) {
    var points = { type: 'FeatureCollection', features: [] };
    var lines = { type: 'FeatureCollection', features: [] };

    (collection.features || []).forEach(function (feature) {
      var type = feature.geometry.type;
      if (type === 'Point' || type === 'MultiPoint') {
        points.features.push(feature);
        return;
      }
      lines.features.push(feature);
      var anchor = anchorOf(feature);
      if (anchor) points.features.push(anchor);
    });

    return { points: points, lines: lines };
  }

  return {
    normalizeWorks: normalizeWorks,
    splitByGeometry: splitByGeometry,
    midpoint: midpoint,
    // مُصدَّرة كي تفتح القائمة البطاقة عند نفس النقطة التي رُسم عليها الرمز:
    // موضعان مختلفان لسجل واحد يقرآن سجلين.
    anchorOf: anchorOf,
    normalizeArabic: normalizeArabic,
    matchesQuery: matchesQuery,
    filterRecords: filterRecords,
    SEARCH_FIELDS: SEARCH_FIELDS,
    boundsOf: boundsOf,
  };
});
