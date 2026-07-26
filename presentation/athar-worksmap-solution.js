/**
 * أثر — الحل على الخريطة: البطاقة تصير قراراً، والشريط يعلن الوفر.
 * ---------------------------------------------------------------------------
 * المنتج كان يقيس الأثر ولا يعرض الحل. المحرك يحسب النافذة المثلى لكل تصريح
 * ويكتبها مع البيانات (scripts/build-city-portfolio.js)، والخريطة — الصفحة التي
 * يقضي فيها المراجع والساكن والمحكّم وقتهم — كانت تعرض أين الأعمال فقط. تشخيصٌ
 * بلا علاج.
 *
 * هنا مكانان يظهر فيهما الحل:
 * 1) داخل بطاقة السجل: سطران يقولان «كما قُدّم» و«الموصى به» بأرقامهما، فتتحول
 *    البطاقة من تعريف إلى قرار.
 * 2) شريط فوق الخريطة: وفر المحفظة المعروضة الآن، يتحرك مع الفلتر الزمني
 *    والبحث. رقم واحد يُقرأ بنظرة، في المكان الذي ينظر إليه المحكّم.
 *
 * 1) الدوال نقية — تأخذ خصائص وتعيد نصاً، وتُختبر في Node بلا DOM.
 * 2) كل قيمة تمر بترميز HTML؛ بيانات التصاريح نص لا شيفرة.
 * 3) الأرقام تُقرأ ولا تُحسب هنا — الحساب تم عند البناء بمحرك أثر نفسه.
 * 4) غياب التوصية حالةٌ معلنة لا فراغ: «الجدول المقدَّم هو الأفضل المتاح» خبر
 *    صحيح ومفيد، وإخفاؤه يجعل البطاقة تبدو ناقصة.
 *
 * UMD بنفس نمط athar-engine.js.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AtharWorksMapSolution = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * تحت هذه النسبة لا تُعرض التوصية بوصفها مكسباً.
   * فرقٌ دون خمسة بالمئة يقع داخل خطأ النموذج نفسه، وعرضه «وفراً» يبيع دقةً
   * لا يملكها المحرك.
   */
  var MEANINGFUL_SAVING_PCT = 5;

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/[&<>"']/g, function (ch) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
      });
  }

  /** أرقام لاتينية داخل نص عربي — كما في كل أرقام المنتج. */
  function number(value) {
    var rounded = Math.round(Number(value) || 0);
    try {
      return rounded.toLocaleString('ar-SA-u-nu-latn');
    } catch (err) {
      return String(rounded);
    }
  }

  function readSolution(properties) {
    var p = properties || {};
    var asIs = Number(p.impactVehHours) || 0;
    var best = Number(p.bestVehHours);
    if (!asIs || !isFinite(best)) return null;
    var savedPct = Number(p.savedPct);
    if (!isFinite(savedPct)) savedPct = asIs > 0 ? (100 * (asIs - best)) / asIs : 0;
    return {
      asIsVehHours: asIs,
      asIsWindow: p.asIsWindow || '',
      bestVehHours: best,
      bestWindow: p.bestWindow || '',
      savedPct: savedPct,
      reason: p.bestReason || '',
      meaningful: savedPct >= MEANINGFUL_SAVING_PCT,
    };
  }

  /**
   * كتلة الحل داخل البطاقة.
   * صفّان متقابلان لا فقرة: العين تقارن عمودين ولا تقارن جملتين.
   */
  function solutionHtml(properties) {
    var solution = readSolution(properties);
    if (!solution) return '';

    if (!solution.meaningful) {
      return '<section class="works-solution works-solution-best">'
        + '<h4>الجدول المقدَّم هو الأفضل المتاح</h4>'
        + '<p>' + number(solution.asIsVehHours) + ' ساعة-مركبة'
        + (solution.asIsWindow ? ' · ' + escapeHtml(solution.asIsWindow) : '')
        + ' — لا نافذة أقل أثراً ضمن الخيارات المفحوصة.</p>'
        + '</section>';
    }

    return '<section class="works-solution">'
      + '<h4>الحل الموصى به</h4>'
      // ترويسة الوحدة مرة واحدة فوق العمود: تكرار «ساعة-مركبة» في كل صف يضاعف
      // النص ولا يضيف معنى، وحذفها يترك رقمين بلا وحدة.
      + '<table class="works-solution-table">'
      + '<thead><tr><td></td><td></td>'
      + '<th class="works-solution-num" scope="col">ساعة-مركبة</th></tr></thead>'
      + '<tbody>'
      + '<tr class="works-solution-asis"><th>كما قُدّم</th>'
      + '<td>' + escapeHtml(solution.asIsWindow) + '</td>'
      + '<td class="works-solution-num">' + number(solution.asIsVehHours) + '</td></tr>'
      + '<tr class="works-solution-best"><th>الموصى به</th>'
      + '<td>' + escapeHtml(solution.bestWindow) + '</td>'
      + '<td class="works-solution-num">' + number(solution.bestVehHours) + '</td></tr>'
      + '</tbody></table>'
      + '<p class="works-solution-gain">وفر ' + Math.round(solution.savedPct) + '٪ '
      + '— ' + number(solution.asIsVehHours - solution.bestVehHours) + ' ساعة-مركبة'
      + (solution.reason ? ' · ' + escapeHtml(solution.reason) : '') + '</p>'
      + '</section>';
  }

  /**
   * حصيلة ما تعرضه الخريطة الآن.
   * ---------------------------------------------------------------------------
   * المجموع على المعروض لا على المحفظة كلها: المحكّم يغيّر الفترة ويكتب في
   * البحث، ورقمٌ ثابت تحت يديه بينما تتغيّر الخريطة يُقرأ لافتةً لا قياساً.
   *
   * الخطوط والنقاط تُعدّ مرة واحدة: كل خط يولّد مرساة نقطية تحمل خصائصه، فعدّ
   * المجموعتين معاً يضاعف كل سجل خطّي.
   */
  function summarize(features) {
    var seen = {};
    var summary = { count: 0, asIsVehHours: 0, bestVehHours: 0, savedVehHours: 0, savedPct: 0 };

    (features || []).forEach(function (feature) {
      var p = (feature && feature.properties) || {};
      var key = p.id || p.permitRef;
      if (key && seen[key]) return;
      if (key) seen[key] = true;
      var solution = readSolution(p);
      if (!solution) return;
      summary.count += 1;
      summary.asIsVehHours += solution.asIsVehHours;
      summary.bestVehHours += solution.bestVehHours;
    });

    summary.savedVehHours = Math.max(0, summary.asIsVehHours - summary.bestVehHours);
    summary.savedPct = summary.asIsVehHours > 0
      ? (100 * summary.savedVehHours) / summary.asIsVehHours
      : 0;
    return summary;
  }

  /** شريط الوفر فوق الخريطة. */
  function barHtml(summary) {
    if (!summary || !summary.count) {
      return '<span class="works-bar-empty">لا سجل معروض ضمن الفترة المختارة</span>';
    }
    return '<span class="works-bar-lead">لو طُبّقت التوصية على المعروض الآن</span>'
      + '<span class="works-bar-figure">'
      + '<b>' + number(summary.savedVehHours) + '</b> ساعة-مركبة موفَّرة'
      + '</span>'
      + '<span class="works-bar-detail">'
      + number(summary.asIsVehHours) + ' ← ' + number(summary.bestVehHours)
      + ' · وفر ' + Math.round(summary.savedPct) + '٪'
      + ' · ' + summary.count + ' سجلاً'
      + '</span>';
  }

  /* ==========================================================================
     المسار البديل — الشقّ الثاني من «رؤى وتوصيات» في نص التحدي
     ========================================================================== */

  /**
   * لونان لكل مسار: حشوٌ وحاشيةٌ أغمق منه بدرجة.
   * ---------------------------------------------------------------------------
   * الحاشية البيضاء تصنع هالةً حول المسار، فيبدو ملصقاً فوق الخريطة لا جارياً
   * فيها — وهي شكوى «طبقة منفصلة». والحاشية بلونٍ آخر (رمادي تحت أزرق) تصنع
   * مشكلةً ثانية: خطٌّ من لونين مختلفين يُقرأ خطّين متجاورين.
   *
   * والاصطلاح في عارضات الملاحة أن الحاشية **نفس اللون أغمق بدرجة**: تفصل عن
   * الإسفلت بحدٍّ نظيف، وتبقى العينُ ترى خطّاً واحداً لا اثنين.
   *
   * والبديل المطروح ليس لوناً آخر بل **الدرجة الفاتحة من العائلة نفسها**، وله
   * حاشيته الأغمق كذلك. فالثلاثة تُقرأ عائلةً واحدة مرتّبة — والحاشية هي التي
   * تُبقي الفاتحَ مرئياً رغم خفوته، فلا يحتاج إلى سماكةٍ ولا إلى لونٍ غريب.
   */
  var ROUTE_COLORS = {
    closed: '#D93025',
    first: '#1A73E8',
    second: '#AEC9F5',
  };

  var ROUTE_CASING_COLORS = {
    closed: '#B3261E',
    first: '#0F5BC4',
    second: '#7BA3DF',
  };

  var ROUTE_LAYERS_NOTE = 'الأفضلية درجةٌ في اللون لا لونٌ آخر: الموصى به مشبع، والمطروح فاتح — وكلاهما بحاشيةٍ أغمق منه بدرجة.';

  /**
   * سُلَّم السماكة لكل رتبة.
   * ---------------------------------------------------------------------------
   * أول رسم أعطى الثلاثة سماكةً واحدة وعتامةً واحدة، فبدت ثلاثة خطوط متساوية
   * يختار المستعمل بينها بلا دليل — وهي الحال التي تتجنّبها خرائط التوجيه كلها.
   * الاصطلاح المستقر فيها: المسار الموصى به مصمتٌ ملوّن، والمطروح رمادي أرفع،
   * ويقع تحته في ترتيب الرسم. الأفضلية تُقرأ قبل أن تُقرأ الأرقام.
   *
   * والعرض أقلّ من ثلث ما كان: خطٌّ بسمك اثني عشر بكسلاً يبتلع الشبكة تحته،
   * فيصير المسار لطخةً لا طريقاً. والفرق بين الرتبتين صار في *اللون* أولاً لا
   * في الشفافية: خطٌّ شفّاف فوق شبكةٍ ملوّنة يتلوّن بما تحته فيُقرأ وسخاً.
   */
  var ROUTE_RANK = {
    second: { width: [12, 1.4, 14, 2, 16, 2.6, 18, 3.2], opacity: 0.85, casing: 0.8 },
    first: { width: [12, 2, 14, 3, 16, 4, 18, 4.8], opacity: 0.9, casing: 0.9 },
    closed: { width: [12, 2, 14, 3, 16, 3.6, 18, 4], opacity: 0.9, casing: 0.85 },
  };

  /**
   * الحاشية تفصل ولا تُسمّن.
   * ---------------------------------------------------------------------------
   * كانت تزيد 3.5 بكسل على كل جانبٍ ضمناً، فيصير عرض المسار الظاهر عند التقريب
   * السادس عشر أربعةَ عشر بكسلاً بينما الشارع تحته سبعة — فيبدو الخطّ طريقاً
   * مستقلاً أعرض من الطريق الحقيقي، وهي بالضبط الشكوى.
   *
   * والزيادة الآن **تتبع التقريب** لا ثابتاً واحداً. الحدّ يجب أن يُرى بوضوح
   * حيث ينظر المستعمل عن قرب، ولا يجوز أن يتجاوز الشارع الذي يعلّمه حيث الشارع
   * نفسه شعرة: عند التقريب الرابع عشر يبلغ الشارع الرئيسي 4.3 بكسل، وحاشيةٌ
   * ثابتة بمقدار 2.2 تجعل المسار بحاشيته 5.2 — أعرض من الطريق، وهي الشكوى
   * الأولى بعينها. فقيمةٌ لكل تقريب: شعرةٌ بعيداً وحدٌّ واضح قريباً.
   *
   * القيم بترتيب سُلَّم العرض نفسه [12, 14, 16, 18].
   */
  var CASING_EXTRA = [1, 1.2, 2, 2.6];

  /**
   * شرطة المقطع المغلق — بوحدة عرض الخط، فتتناسب مع التقريب تلقائياً.
   * والحاشية تُشرَط معها: حاشيةٌ مصمتة تحت خطٍّ مشروط تملأ فجواته فيُقرأ مصمتاً،
   * وقد رُئي ذلك في اللقطة. والنسبة هي نسبة العرضين، فيتطابق طول الشرطة عندهما.
   */
  var CLOSED_DASH = [1.7, 1.2];
  var CLOSED_DASH_CASING = [1.1, 0.78];

  /** طرفا التحويلة: نقطتان تقولان «اخرج من هنا» و«عُد من هنا». */
  var ROUTE_POINT_RADIUS = ['interpolate', ['linear'], ['zoom'], 12, 3, 15, 4.5, 18, 6];

  /** `extra` رقمٌ واحد أو قيمةٌ لكل درجة في السُلَّم — الحاشية تتبع التقريب. */
  function widthOf(stops, extra) {
    var expression = ['interpolate', ['linear'], ['zoom']];
    for (var i = 0, step = 0; i < stops.length; i += 2, step += 1) {
      var add = Array.isArray(extra) ? (extra[step] || 0) : (extra || 0);
      expression.push(stops[i], stops[i + 1] + add);
    }
    return expression;
  }

  /**
   * طبقات المسارات: طبقتان لكل رتبة، مرتّبة من الأدنى أفضليةً إلى الأعلى.
   * طبقةٌ واحدة لكل الرتب تعني سماكةً وعتامةً واحدة — والفرز بـ line-sort-key
   * يرتّب الرسم ولا يفرّق الشكل.
   *
   * `line-join: round` يُدوّر الانعطاف بدل أن يخرج له شوكة عند الزاوية الحادة،
   * و`line-cap: round` يُنهي الطرف نهايةً ناعمة. الاثنان معاً هما الفرق بين
   * خطٍّ يبدو مرسوماً على الشبكة وخطٍّ يبدو ملصقاً فوقها.
   */
  function buildRouteLayers(sourceId) {
    var layers = [];
    ['second', 'first', 'closed'].forEach(function (kind) {
      var rank = ROUTE_RANK[kind];
      var filter = ['==', ['get', 'kind'], kind];

      var casing = {
        'line-color': ROUTE_CASING_COLORS[kind],
        'line-width': widthOf(rank.width, CASING_EXTRA),
        'line-opacity': rank.casing,
      };
      if (kind === 'closed') casing['line-dasharray'] = CLOSED_DASH_CASING;

      layers.push({
        id: 'route-' + kind + '-casing', type: 'line', source: sourceId, filter: filter,
        layout: { 'line-cap': kind === 'closed' ? 'butt' : 'round', 'line-join': 'round' },
        paint: casing,
      });

      var paint = {
        'line-color': ROUTE_COLORS[kind],
        'line-width': widthOf(rank.width, 0),
        'line-opacity': rank.opacity,
      };
      // المغلق يختلف بالنمط لا باللون وحده: عمى الألوان يقرأ الشرطة ولا يقرأ الأحمر.
      if (kind === 'closed') paint['line-dasharray'] = CLOSED_DASH;

      layers.push({
        id: 'route-' + kind, type: 'line', source: sourceId, filter: filter,
        layout: { 'line-cap': kind === 'closed' ? 'butt' : 'round', 'line-join': 'round' },
        paint: paint,
      });
    });

    /**
     * طرفا التحويلة.
     * ---------------------------------------------------------------------------
     * الرسالة المطلوبة جملةٌ من ثلاثة أجزاء: «الشارع مغلق · اخرج من هنا · عُد
     * من هنا». الجزءان الأخيران موضعان على الخريطة، ولا يقولهما خطٌّ أزرق مهما
     * حُسِّن — العين تتبع الخط ولا تعرف أين ابتدأ القرار. فنقطتان تقولانهما.
     */
    layers.push({
      id: 'route-ends', type: 'circle', source: sourceId,
      filter: ['==', ['get', 'kind'], 'end'],
      paint: {
        'circle-radius': ROUTE_POINT_RADIUS,
        'circle-color': ['match', ['get', 'role'], 'exit', '#FFFFFF', ROUTE_COLORS.first],
        'circle-stroke-color': ['match', ['get', 'role'], 'exit', ROUTE_COLORS.first, '#FFFFFF'],
        'circle-stroke-width': 2,
      },
    });

    layers.push({
      id: 'route-ends-labels', type: 'symbol', source: sourceId,
      filter: ['==', ['get', 'kind'], 'end'],
      minzoom: 13,
      layout: {
        'text-field': ['get', 'label'],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 13, 10, 16, 12],
        'text-offset': [0, 1.1],
        'text-anchor': 'top',
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: {
        'text-color': '#1F2933',
        'text-halo-color': '#FFFFFF',
        'text-halo-width': 2,
      },
    });

    /**
     * الزمن المضاف على الخط نفسه.
     * الجدول في البطاقة يقول «بديل 1: +6.5 د» ويُلزم العين بالانتقال بينه وبين
     * الخريطة لتعرف أيّهما. الوسم على المسار يزيل تلك الرحلة — وهو ما يفعله كل
     * عارض مسار: الرقم حيث الخط.
     */
    /**
     * الوسم على نقطةٍ لا على خط.
     * ---------------------------------------------------------------------------
     * `line-center` يضع وسماً في منتصف كل قطعةٍ *داخل بلاطة*، فمسارٌ يعبر ثلاث
     * بلاطات يحمل ثلاثة أرقامٍ متطابقة — رُئي ذلك في اللقطة عند التقريب السابع
     * عشر. وإسكات التصادم يُلغي الوسم كله (قيس: صفر وسمٍ مرسوم). فالحلّ أن
     * يُحمل الرقم على معلمٍ نقطي واحد تُنتجه المجموعة عند منتصف الموصى به:
     * ميزةٌ واحدة، ووسمٌ واحد، مهما تقسّمت البلاطات.
     */
    layers.push({
      id: 'route-labels', type: 'symbol', source: sourceId,
      filter: ['==', ['get', 'kind'], 'tag'],
      layout: {
        'text-field': ['concat', '+', ['to-string', ['round', ['get', 'addedMinutes']]], ' د'],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 10, 12, 15, 14],
        // قائمٌ بجانب المسار لا مائلٌ فوقه: رقمٌ أزرق على خطٍّ أزرق مائلٍ بزاوية
        // الشارع يُقرأ بجهد أو لا يُقرأ.
        'text-offset': [0, -1.2],
        'text-anchor': 'bottom',
        'text-allow-overlap': true,
        'text-ignore-placement': true,
        'text-padding': 4,
      },
      paint: {
        'text-color': ROUTE_COLORS.first,
        'text-halo-color': '#FFFFFF',
        // هالة سميكة تقوم مقام الشارة: النص على خطٍّ ملوّن يحتاج أرضيةً بيضاء.
        'text-halo-width': 2.6,
        'text-halo-blur': 0.4,
      },
    });

    return layers;
  }

  var EMPTY_COLLECTION = { type: 'FeatureCollection', features: [] };

  /**
   * مجموعة الخطوط المرسومة: المغلق ثم البدائل بترتيب الأفضلية.
   * @param {object} result ناتج AtharCityRouting.alternativesAround
   * @param {function} geometryFor يحوّل قائمة أضلاع إلى إحداثيات
   */
  function routeCollection(result, geometryFor) {
    if (!result || !result.ok) return EMPTY_COLLECTION;
    var features = [];
    var recommended = null;

    result.alternatives.forEach(function (route, index) {
      // الحالات لا الأضلاع: الضلع لا يعرف جهة عبوره، والهندسة تُقلب بالجهة.
      var coordinates = geometryFor(route.states || route.edges);
      if (!coordinates || coordinates.length < 2) return;
      if (index === 0) recommended = coordinates;
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coordinates },
        properties: {
          kind: index === 0 ? 'first' : 'second',
          order: index + 2,
          addedMinutes: route.addedMinutes,
        },
      });
    });

    // طرفا التحويلة من هندسة الموصى به نفسها — لا من عقدتين تُقرآن من الرسم.
    if (recommended) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: recommended[0] },
        properties: { kind: 'end', role: 'exit', label: 'اخرج هنا', order: 90 },
      });
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: recommended[recommended.length - 1] },
        properties: { kind: 'end', role: 'rejoin', label: 'عُد هنا', order: 91 },
      });
      var added = result.alternatives[0].addedMinutes;
      if (typeof added === 'number' && isFinite(added)) {
        features.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: recommended[Math.floor(recommended.length / 2)],
          },
          properties: { kind: 'tag', addedMinutes: added, order: 92 },
        });
      }
    }

    var baselineStates = result.baseline.states || result.baseline.edges;
    var closedCoordinates = geometryFor(baselineStates.filter(function (state) {
      // الحالة تحمل الضلع في بتاتها العليا؛ المنع يقع على الضلع لا على جهته.
      return result.banned[result.baseline.states ? state >> 1 : state];
    }));
    if (closedCoordinates && closedCoordinates.length >= 2) {
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: closedCoordinates },
        properties: { kind: 'closed', order: 1 },
      });
    }

    return { type: 'FeatureCollection', features: features };
  }

  var DETOUR_REASONS = {
    'off-network': 'الموقع خارج شبكة الطرق المحمَّلة — لا يمكن حساب بديل.',
    'no-boundary': 'الإغلاق لا يمسّ الشبكة الرئيسية — لا طرف يُوجَّه منه.',
    'no-baseline': 'لا مسار قائم بين طرفي الإغلاق في الشبكة المحمَّلة.',
    'no-detour': 'لا التفاف: الشبكة المحمَّلة لا تصل الطرفين إلا عبر المقطع نفسه.',
    'no-line': 'السجل نقطة لا مقطعاً — لا إغلاق يُلتفّ حوله.',
  };

  /** دقائق مقروءة: «٤.٤ د» لا «4.4166666». */
  function minutes(value) {
    return (Math.round(Number(value) * 10) / 10).toString();
  }

  function kilometres(metres) {
    return (Math.round((Number(metres) || 0) / 100) / 10).toString();
  }

  /**
   * كتلة البديل داخل البطاقة.
   * الدقائق المضافة هي المقياس لا النسبة: مقطعٌ يُقطع في دقيقة، والالتفاف حوله
   * ثلاث — «+200٪» صحيحة وتُقرأ كارثةً، و«+٢ دقيقة» تُقرأ قراراً.
   */
  function detourHtml(result) {
    if (!result) return '';
    if (!result.ok) {
      var reason = DETOUR_REASONS[result.reason];
      if (!reason) return '';
      return '<section class="works-detour works-detour-none">'
        + '<h4>المسار البديل</h4><p>' + escapeHtml(reason) + '</p></section>';
    }

    /* WP-R1 — المعروض هو الزمن **بعد تحميل الحركة المحوَّلة**.
       عرضُ الزمن قبل التحميل يصف طريقاً فارغاً لن يوجد: البديل هو الذي
       سيستقبل حركة الإغلاق. و`addedMinutes` (قبل التحميل) لم يُحذف من
       المخرجات، لكنه لا يُعرض — رقمٌ صحيح في سياقٍ خاطئ يبقى خاطئاً. */
    var rows = result.alternatives.map(function (route, index) {
      var added = typeof route.addedMinutesAfterDiversion === 'number'
        ? route.addedMinutesAfterDiversion
        : route.addedMinutes;
      var load = route.load || {};
      var strain = load.overflows
        ? '<p class="works-detour-strain">الطلب بعد التحويل يتجاوز سعة '
          + (load.bindingStreet
            ? '«' + escapeHtml(String(load.bindingStreet)) + '»'
            : 'أضيق مقطع في البديل')
          + ' — نسبة الحجم إلى السعة ' + (load.maxRatioAfter || 0).toFixed(2)
          + ' بعد التحويل مقابل ' + (load.maxRatioBefore || 0).toFixed(2)
          + ' قبله. البديل ينقل الازدحام ولا يمتصّه.</p>'
        : '';
      return '<tr class="works-detour-' + (index === 0 ? 'first' : 'second')
        + (load.overflows ? ' works-detour-strained' : '') + '">'
        + '<th>بديل ' + (index + 1) + '</th>'
        + '<td>' + kilometres(route.lengthM) + ' كم</td>'
        + '<td class="works-solution-num">+' + minutes(added) + ' د</td>'
        + '</tr>'
        + (strain ? '<tr class="works-detour-detail"><td colspan="3">'
          + strain + '</td></tr>' : '')
        + detailRow(route, index);
    }).join('');

    var diverted = result.diverted || {};

    return '<section class="works-detour">'
      + '<h4>المسار البديل</h4>'
      + '<table class="works-solution-table"><tbody>'
      + '<tr class="works-detour-closed"><th>المقطع المغلق</th>'
      + '<td>' + (result.closedEdges) + ' مقطعاً</td>'
      + '<td class="works-solution-num">' + minutes(result.baseline.minutes) + ' د</td></tr>'
      + rows
      + '</tbody></table>'
      + '<p class="works-detour-note">محسوب على شبكة الرياض كاملةً (شرايين وشوارع أحياء) — '
      + 'أزمنة رحلة BPR وعقوبات انعطاف وتقاطعات عند الساعة '
      + escapeHtml(String(result.hour === undefined ? 8 : result.hour)) + ':00. '
      + '<strong>والزمن معروضٌ بعد تحميل البديل بالحركة المحوَّلة</strong>'
      + (typeof diverted.vehPerHour === 'number'
        ? ' (' + Math.round(diverted.vehPerHour) + ' مركبة/ساعة من '
          + diverted.lanesClosed + ' من ' + diverted.lanes + ' مسارات)'
        : '')
      + '. قاعدة التحويل معلنة لا مقيسة: حصة الطلب المرتبطة بالمسارات المغلقة.</p>'
      + '</section>';
  }

  /** رقمٌ لم يُحسب يُقال «غير محسوب» — لا يُملأ برقمٍ يُكمل الجدول. */
  function computed(value, render) {
    return typeof value === 'number' && isFinite(value) ? render(value) : 'غير محسوب';
  }

  /**
   * تفصيل البديل تحت سطره.
   * ---------------------------------------------------------------------------
   * «+٣.٧ دقيقة» وحدها لا تُقنع من يعرف المدينة: يريد أن يعرف من أين يمرّ.
   * وكل رقمٍ هنا مقيسٌ على هندسة المسار نفسها — الحصة طولٌ على طول، والانعطافات
   * ما كلّف منها فعلاً، والإشارات ما مرّ به. ما لا يُحسب يُقال إنه لم يُحسب.
   */
  function detailRow(route, index) {
    var bits = [];
    bits.push(computed(route.minorShare, function (v) {
      return 'شوارع فرعية ' + Math.round(100 * v) + '٪';
    }));
    bits.push(computed(route.turns, function (v) { return v + ' انعطافاً'; }));
    bits.push(computed(route.signals, function (v) { return v + ' إشارة'; }));

    var reasons = (route.reasons || []).map(escapeHtml).join(' · ');
    return '<tr class="works-detour-detail works-detour-detail-'
      + (index === 0 ? 'first' : 'second') + '"><td colspan="3">'
      + '<span class="works-detour-facts">' + escapeHtml(bits.join(' · ')) + '</span>'
      + (reasons ? '<span class="works-detour-why">' + reasons + '</span>' : '')
      + viaHtml(route)
      + '</td></tr>';
  }

  /**
   * مسار التحويلة كما يُقال شفاهاً.
   * ---------------------------------------------------------------------------
   * «عبر: ثلاثة أسماء» تسرد ولا توجّه. والذي يفيد قارئ الخريطة ثلاث خطوات:
   * من أين يغادر الشبكة الكبرى، وبأي شوارع يمرّ داخل الحيّ، وأين يعود. وهي
   * محسوبة من الشوط المتصل نفسه — فإن لم يوجد شوط، لا تُقال العبارة أصلاً
   * ويعود السرد إلى أسماء الشوارع كما هي.
   */
  function viaHtml(route) {
    var trip = route.excursion;
    if (!trip || !trip.streets || !trip.streets.length) {
      return route.streets && route.streets.length
        ? '<span class="works-detour-via">عبر: '
          + escapeHtml(route.streets.slice(0, 3).join(' · ')) + '</span>'
        : '';
    }
    var steps = [];
    if (trip.leaveAt) steps.push('اخرج من ' + trip.leaveAt);
    steps.push('ادخل ' + trip.streets.slice(0, 3).join(' · '));
    if (trip.rejoinAt) steps.push('عُد إلى ' + trip.rejoinAt);
    return '<span class="works-detour-via">' + escapeHtml(steps.join(' ← ')) + '</span>';
  }

  return {
    MEANINGFUL_SAVING_PCT: MEANINGFUL_SAVING_PCT,
    ROUTE_COLORS: ROUTE_COLORS,
    ROUTE_CASING_COLORS: ROUTE_CASING_COLORS,
    ROUTE_RANK: ROUTE_RANK,
    CASING_EXTRA: CASING_EXTRA,
    CLOSED_DASH: CLOSED_DASH,
    ROUTE_LAYERS_NOTE: ROUTE_LAYERS_NOTE,
    DETOUR_REASONS: DETOUR_REASONS,
    readSolution: readSolution,
    solutionHtml: solutionHtml,
    summarize: summarize,
    barHtml: barHtml,
    buildRouteLayers: buildRouteLayers,
    routeCollection: routeCollection,
    detourHtml: detourHtml,
  };
});
