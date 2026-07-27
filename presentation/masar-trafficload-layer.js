/**
 * مسار — طبقة الحمل المروري على الخريطة
 * ---------------------------------------------------------------------------
 * ترسم تقدير عدد المركبات اليومية تحت الإسفلت لا فوقه: الطبقة تُدرَج قبل
 * `roads`، فتظهر شريطاً ملوّناً حول الشارع ويبقى الشارع نفسه واسمه فوقها
 * مقروءَين. لو رُسمت فوق الطرق لغطّت الشبكة كلها بلونٍ واحد ولصارت الخريطة
 * لوحةَ حرارةٍ لا خريطةَ مدينة.
 *
 * ثلاث قواعد تحكم الشكل:
 *
 * ١) اللون تدرّجٌ بنفسجيٌّ أحادي الصبغة. طبقات الأعمال تملك الأخضر والكهرماني
 *    والأحمر بمعنى الشدّة؛ تدرّجٌ ثانٍ بالألوان نفسها يُقرأ إنذاراً لا كمّية.
 * ٢) العرض من `MasarWorksMapStyle.roadWidth` نفسها بمعامل أوسع — فلا ينحرف
 *    عرض الشريط عن عرض الشارع عند أي تقريب، ولا يُنسخ منحنى العرض هنا.
 * ٣) الطبقة مطفأة عند الفتح. الخريطة عند أول نظرة تعرض ما هو **مسجَّل**
 *    (أعمال وإغلاقات وحوادث)؛ والحمل المروري **مقدَّر**، فلا يُقدَّم على
 *    المسجَّل بلا طلب. من شغّلها رأى معها صنف دليلها في الدليل.
 *
 * UMD بنفس نمط masar-engine.js.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('./masar-trafficload.js'),
      require('./masar-worksmap-style.js')
    );
  } else {
    root.MasarTrafficLoadLayer = factory(root.MasarTrafficLoad, root.MasarWorksMapStyle);
  }
})(typeof self !== 'undefined' ? self : this, function (TrafficLoad, Style) {
  'use strict';

  var SOURCE_ID = 'traffic-load';
  var LAYER_ID = 'traffic-load-lines';
  var WEAK_LAYER_ID = 'traffic-load-lines-weak';
  var GROUP_ID = 'trafficload';
  var GROUP_LABEL = 'الحمل المروري (تقدير)';

  /** الشريط أوسع من حاشية الطريق (1.35) فيظهر من تحتها على الجانبين. */
  var WIDTH_SCALE = 2.3;

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/[&<>"']/g, function (ch) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
      });
  }

  /**
   * وضعان لا واحد.
   * ---------------------------------------------------------------------------
   * «كم مركبة تمرّ؟» و«هل الشارع زحمة؟» سؤالان مختلفان بجوابين مختلفين، وخلطهما
   * في لونٍ واحد يُخفي أحدهما. شارعٌ بست حارات يحمل ثمانين ألفاً هو الأعلى
   * حجماً وقد يكون الأسلس سيراً؛ وشارعٌ بحارتين يحمل عشرين ألفاً هو الأقلّ
   * حجماً وقد يكون المختنق. فالوضعان يُعرضان بمفتاحٍ لا بتخمين.
   */
  var MODES = [
    { id: 'volume', label: 'الحجم اليومي', hint: 'كم مركبة تمرّ في اليوم' },
    { id: 'congestion', label: 'الازدحام', hint: 'نسبة الحجم إلى السعة في ساعة مختارة' },
  ];

  var DEFAULT_MODE = 'volume';

  /**
   * ساعة العرض الافتراضية: ذروة المساء في الملف الساعي.
   * تُقرأ من المحرك لا تُكتب رقماً — إن تغيّر الملف تبعتها الخريطة.
   */
  function defaultHour() {
    return TrafficLoad.peakShare().hour;
  }

  /** تعبير لون الحجم — مبنيٌّ من `BANDS` نفسها لا لوحة ألوان ثانية. */
  function colorExpression() {
    var expression = ['match', ['get', 'load_band']];
    TrafficLoad.BANDS.forEach(function (band) {
      expression.push(band.id, band.color);
    });
    expression.push(TrafficLoad.BANDS[0].color); // ارتداد معلن: أخفّ نطاق
    return expression;
  }

  /**
   * تعبير لون الازدحام — النسبة تُحسب **داخل** تعبير الخريطة.
   * ---------------------------------------------------------------------------
   * `ratio = load_aadt × حصة الساعة ÷ load_capacity`
   *
   * حسابها هنا لا في جافاسكربت هو ما يجعل منزلق الساعة فورياً: تغيير الساعة
   * يُعيد رسم الطبقة بخاصية طلاء واحدة، ولا يلمس البيانات. الحساب في
   * جافاسكربت كان سيعني إعادة بناء مئة ألف كائن عند كل خطوة منزلق.
   *
   * والسعة صفراً تعطي قسمةً على صفر: تُعالَج بـ`max(capacity, 1)` فتصير
   * النسبة صغيرة لا لانهائية — والمقاطع بلا سعة لا وجود لها عملياً لأن جدول
   * الأصناف لا يحمل صفراً.
   *
   * @param {number} share حصة الساعة من AADT (0..1)
   */
  function congestionColorExpression(share) {
    var ratio = [
      '/',
      ['*',
        ['*', ['to-number', ['get', 'load_aadt'], 0], share],
        ['to-number', ['get', 'load_dir_factor'], 1]],
      ['max', ['to-number', ['get', 'load_capacity'], 1], 1],
    ];
    var expression = ['step', ratio, TrafficLoad.CONGESTION_BANDS[0].color];
    TrafficLoad.CONGESTION_BANDS.forEach(function (band, index) {
      if (index === TrafficLoad.CONGESTION_BANDS.length - 1) return;
      expression.push(band.max, TrafficLoad.CONGESTION_BANDS[index + 1].color);
    });
    return expression;
  }

  function colorFor(mode, hour) {
    return mode === 'congestion'
      ? congestionColorExpression(TrafficLoad.shareAt(hour))
      : colorExpression();
  }

  /**
   * @param {string} [sourceId]
   * @returns {object} مواصفة طبقة MapLibre
   */
  /**
   * طبقتان لا طبقة: الأساس المتين مصمت، والضعيف مخطّط.
   * ---------------------------------------------------------------------------
   * 55٪ من مقاطع شبكة الرياض المحمَّلة **بلا `lanes` مسجَّلة**، فتأخذ حاراتها
   * من صنفها. وتقديرها حينئذٍ دالةٌ في وسم `highway` وحده — أي أن لونها يقول
   * «هذا صنف الطريق» لا «هذا حمله». ورسمُها بنفس الخط المصمت الذي يرسم مقطعاً
   * بحاراتٍ مسجَّلة يجعل الشبكة كلها تُقرأ حقلاً مقيساً واحداً.
   *
   * والشكل يقول ما تقوله الحاشية: مصمت = حاراته مسجَّلة، مخطّط = حاراته
   * مفترضة من الصنف. القارئ يرى قوة الأساس قبل أن يقرأ سطراً.
   *
   * (`line-dasharray` ليست خاصيةً تقبل التعبيرات المعتمدة على البيانات في
   * MapLibre، فالتفريق يكون بطبقتين مُرشَّحتين لا بتعبيرٍ واحد.)
   */
  function buildLayer(sourceId, mode, hour) {
    return baseLayer(LAYER_ID, sourceId, mode, hour, ['==', ['get', 'load_lanes_source'], 'osm']);
  }

  function buildWeakLayer(sourceId, mode, hour) {
    var layer = baseLayer(WEAK_LAYER_ID, sourceId, mode, hour,
      ['!=', ['get', 'load_lanes_source'], 'osm']);
    layer.paint['line-dasharray'] = [1.5, 1.4];
    layer.paint['line-opacity'] = 0.55;
    return layer;
  }

  function baseLayer(id, sourceId, mode, hour, filter) {
    return {
      id: id,
      type: 'line',
      source: sourceId || SOURCE_ID,
      filter: filter,
      layout: { 'line-cap': 'butt', 'line-join': 'round', visibility: 'none' },
      paint: {
        'line-color': colorFor(mode || DEFAULT_MODE,
          typeof hour === 'number' ? hour : defaultHour()),
        'line-width': Style.roadWidth(WIDTH_SCALE),
        /* شفافية متوسطة: الشريط يُقرأ كمّيةً تحت الشارع، ولا يطمس الأرضية
           ولا حدود الأحياء التي تحته. */
        'line-opacity': 0.7,
      },
    };
  }

  /** ساعةٌ تُقرأ «06:00» بأرقام لاتينية — الاصطلاح المفروض في هذا المستودع. */
  function formatHour(hour) {
    var value = ((Math.round(hour) % 24) + 24) % 24;
    return (value < 10 ? '0' : '') + value + ':00';
  }

  /** صفوف الدليل — من نطاقات الوضع المعروض نفسها لا لوحة ألوان ثانية. */
  function legendHtml(summary, mode, hour) {
    var congestion = mode === 'congestion';
    var bands = congestion ? TrafficLoad.CONGESTION_BANDS : TrafficLoad.BANDS;
    var unit = congestion ? '' : ' مركبة/يوم';

    var rows = bands.map(function (band) {
      var count = !congestion && summary && summary.byBand ? summary.byBand[band.id] : null;
      return '<div class="wm-legend-row">'
        + '<span class="wm-legend-line wm-legend-solid" style="color:'
        + escapeHtml(band.color) + ';border-top-width:5px"></span>'
        + '<span>' + escapeHtml(band.label) + unit
        + (count === null || count === undefined
          ? ''
          : ' <span class="tl-count">(' + escapeHtml(count) + ')</span>')
        + '</span></div>';
    }).join('');

    var coverage = summary && typeof summary.lanesCoveragePct === 'number'
      ? Math.round(summary.lanesCoveragePct)
      : null;

    /* الازدحام حالةٌ في ساعة، فالعنوان يحمل الساعة. دليلٌ يقول «ازدحام شديد»
       بلا ساعةٍ يُقرأ حكماً دائماً على الشارع — وهو ليس كذلك. */
    var title = congestion
      ? GROUP_LABEL + ' — الساعة ' + formatHour(hour)
      : GROUP_LABEL;

    return '<div class="wm-legend-split">' + escapeHtml(title) + '</div>'
      + rows
      + '<p class="tl-note">لا توجد بيانات أحجام مرور منشورة لشوارع الرياض. '
      + 'هذه الأرقام <strong>تقديرات</strong> من صنف الطريق وعدد حاراته، '
      + 'وصنف دليلها «افتراض توضيحي معلن». كل مقطع يحمل مظروفه في بطاقته.'
      + (congestion
        ? ' وتوزيع الساعات ملفٌّ حضريّ نمطيّ واحد يُطبَّق على كل الشوارع — '
          + 'فالفارق بين شارعين في الساعة نفسها فارقُ سعةٍ لا فارقُ نمطِ طلب مقيس. '
          + 'والمقام هنا تدفق التشبّع؛ وعلى سعةٍ إشارية مقدَّرة (نحو 45٪ منه) '
          + 'يتجاوز أغلبُ الشرايين التشبّعَ في الذروة — والرقمان معاً في بطاقة '
          + 'كل مقطع، لأن التناقض بين افتراضَي الجدول والسعة لم يُحسم ببيانات.'
        : '')
      + (coverage === null
        ? ''
        : ' عدد الحارات مسجَّل في ' + escapeHtml(coverage) + '٪ من المقاطع فقط؛ '
          + 'الباقي يأخذه من صنفه بمظروف أوسع.')
      + '</p>';
  }

  /** مربع التشغيل في لوحة التحكم — مطفأ ابتداءً كما الطبقة. */
  function toggleHtml() {
    return '<label class="masar-map-toggle">'
      + '<input type="checkbox" data-trafficload="1" />'
      + '<span class="masar-map-swatch" style="background:'
      + escapeHtml(TrafficLoad.BANDS[TrafficLoad.BANDS.length - 1].color) + '"></span>'
      + '<span>' + escapeHtml(GROUP_LABEL) + '</span>'
      + '</label>';
  }

  /**
   * مفتاح الوضع ومنزلق الساعة.
   * ---------------------------------------------------------------------------
   * يظهران مع تشغيل الطبقة ويختفيان بإطفائها: عناصرُ تحكّمٍ لطبقةٍ مطفأة
   * ضجيجٌ في لوحةٍ ضيقة. والمنزلق يخصّ وضع الازدحام وحده — الحجم اليومي لا
   * ساعةَ له، فيبقى المنزلق معطَّلاً لا مخفياً كي لا يقفز التخطيط.
   */
  function controlsHtml(mode, hour) {
    var current = mode || DEFAULT_MODE;
    var at = typeof hour === 'number' ? hour : defaultHour();

    var radios = MODES.map(function (item) {
      return '<label class="tl-mode">'
        + '<input type="radio" name="tl-mode" value="' + escapeHtml(item.id) + '"'
        + (item.id === current ? ' checked' : '') + ' />'
        + '<span>' + escapeHtml(item.label) + '</span>'
        + '</label>';
    }).join('');

    return '<div class="tl-controls" data-tl-controls>'
      + '<div class="tl-modes" role="radiogroup" aria-label="وضع عرض الحمل">'
      + radios + '</div>'
      + '<label class="tl-hour">'
      + '<span>ساعة العرض <b data-tl-hour-label>' + escapeHtml(formatHour(at)) + '</b></span>'
      + '<input type="range" min="0" max="23" step="1" value="' + escapeHtml(at) + '"'
      + ' data-tl-hour aria-label="ساعة عرض الازدحام"'
      + (current === 'congestion' ? '' : ' disabled') + ' />'
      + '</label>'
      + '</div>';
  }

  /**
   * كتلة الحمل في بطاقة الطريق.
   * كل رقم مرفقٌ بطريقته وصنف دليله ومظروفه — بطاقةٌ تعرض «٤٢٠٠٠ مركبة/يوم»
   * عاريةً تُقرأ قياساً، وهي ليست قياساً.
   */
  function popupHtml(estimate) {
    if (!estimate) return '';
    var caveats = (estimate.caveats || []).map(function (line) {
      return '<li>' + escapeHtml(line) + '</li>';
    }).join('');

    var band = null;
    TrafficLoad.CONGESTION_BANDS.forEach(function (item) {
      if (item.id === estimate.congestionBand) band = item;
    });

    /* الرقم المعروض مقرَّبٌ إلى رقمين معنويين، والوسم يقول باتجاهٍ أم باتجاهين.
       «101,772 مركبة/يوم» عاريةً تدّعي دقّةً بخمس خانات، ولا تقول أيّ كمّية
       هي أصلاً — و92٪ من مقاطع الشبكة أحادية الاتجاه. */
    return '<section class="tl-popup">'
      + '<h4>الحمل المروري المقدَّر</h4>'
      + '<p class="tl-headline">'
      + escapeHtml(estimate.aadtRounded.toLocaleString('ar-SA-u-nu-latn'))
      + ' <span>مركبة/يوم · ' + escapeHtml(estimate.directionLabel) + '</span></p>'
      + '<p class="tl-range">المظروف المعلن: '
      + escapeHtml(estimate.low.toLocaleString('ar-SA-u-nu-latn')) + ' – '
      + escapeHtml(estimate.high.toLocaleString('ar-SA-u-nu-latn')) + '</p>'
      + (band
        ? '<p class="tl-state"><span class="tl-dot" style="background:'
          + escapeHtml(band.color) + '"></span>'
          + escapeHtml(band.label) + ' في ذروة الساعة '
          + escapeHtml(estimate.peakHour) + '</p>'
        : '')
      + '<dl>'
      + '<dt>الطريقة</dt><dd>' + escapeHtml(estimate.methodLabel) + '</dd>'
      + '<dt>صنف الدليل</dt><dd>' + escapeHtml(estimate.evidence) + '</dd>'
      + '<dt>الحارات</dt><dd>' + escapeHtml(estimate.lanes)
      + (estimate.lanesSource === 'osm' ? ' (مسجَّلة)' : ' (من صنف الطريق)') + '</dd>'
      + '<dt>ذروة الاتجاه</dt><dd>'
      + escapeHtml(estimate.peakVolume.toLocaleString('ar-SA-u-nu-latn'))
      + ' مركبة/ساعة</dd>'
      /* المقامان معاً: الأخضر على تدفق التشبّع لا يُقرأ براءةً حين تكون
         النسبة على سعةٍ إشارية فوق الواحد. */
      + '<dt>حجم/سعة</dt><dd>' + escapeHtml(estimate.peakRatio.toFixed(2))
      + ' على تدفق التشبّع · '
      + escapeHtml(estimate.peakRatioSignalized.toFixed(2))
      + ' على سعة إشارية مقدَّرة</dd>'
      + '</dl>'
      + '<p class="tl-basis">' + escapeHtml(estimate.basis) + '</p>'
      + '<p class="tl-basis">' + escapeHtml(estimate.envelopeNote) + '</p>'
      + (caveats ? '<ul class="tl-caveats">' + caveats + '</ul>' : '')
      + '</section>';
  }

  /**
   * بطاقة شارع كاملة — العنوان والتقدير معاً.
   * الترميز هنا لا في الصفحة: نصُّ اسم الشارع بيانات من OpenStreetMap، وأي
   * ترميزٍ يُكتب في وسم `<script>` داخل صفحة يفلت من الاختبار الذي يفحص هذه
   * الوحدة.
   */
  function roadPopupHtml(name, estimate) {
    return '<article class="works-popup">'
      + '<h3>' + escapeHtml(name || 'مقطع طريق') + '</h3>'
      + popupHtml(estimate)
      + '</article>';
  }

  /**
   * يركّب المصدر والطبقة، ويُرجع مقبضاً للتشغيل والإطفاء.
   * ---------------------------------------------------------------------------
   * **الحساب مؤجَّل إلى أول تشغيل، لا مُجرًى عند التركيب.** الشبكة تصل على
   * ثلاث حلقات: شرايين مع الصفحة (٩ آلاف مقطع)، ثم محلية، ثم شوارع أحياء
   * (اثنا عشر ميغابايت). حسابٌ عند التركيب يقدّر الحلقة الأولى وحدها ثم يكذب
   * على ما بعدها، وحسابٌ بعد كل حلقة يدفع ثمن مئة ألف كائن ثلاث مرات على
   * صفحةٍ عامة قد لا يُطلب فيها التقدير أصلاً.
   *
   * فالمقبض يأخذ **دالةً** تُرجع الطرق الحالية، ويعيد الحساب حين يتغيّر عدد
   * المقاطع فقط. من لم يشغّل الطبقة لم يدفع شيئاً.
   *
   * @param {object} map خريطة MapLibre
   * @param {function} getRoads دالة تُرجع مجموعة الطرق المحمَّلة الآن
   */
  function install(map, getRoads, options) {
    var opts = options || {};
    var cached = null;
    var cachedCount = -1;
    var mode = opts.mode === 'congestion' ? 'congestion' : DEFAULT_MODE;
    var hour = Number.isFinite(opts.hour) ? opts.hour : defaultHour();
    var visible = false;

    function currentRoads() {
      var roads = typeof getRoads === 'function' ? getRoads() : getRoads;
      return roads && roads.features ? roads : { type: 'FeatureCollection', features: [] };
    }

    function ensureData() {
      var roads = currentRoads();
      if (cached && cachedCount === roads.features.length) return cached;
      cached = TrafficLoad.estimateCollection(roads, options);
      cachedCount = roads.features.length;
      var source = map.getSource(SOURCE_ID);
      if (source && source.setData) source.setData(cached);
      return cached;
    }

    /**
     * التركيب لا يفترض أن النمط جاهز.
     * -------------------------------------------------------------------------
     * `map.addSource` يرمي «Style is not done loading» إن نودي قبل اكتمال
     * النمط. و`onReady` في هذه الصفحة قد يُطلَق من مسار المهلة لا من حدث
     * التحميل — وحينها يكون النمط غير مكتمل. والرمية لا تسقط هذه الطبقة
     * وحدها: `onReady` سلسلةٌ واحدة، فما بعدها في الصفحة لا يعمل.
     *
     * فالتركيب يحاول، وإن لم يكن النمط جاهزاً انتظر أول `styledata` وأعاد
     * المحاولة. ولا يرمي في الحالين.
     */
    var installed = false;
    var lastError = null;

    /* المحاولة هي الفحص، لا `isStyleLoaded()`.
       تلك تُرجع false ما دام أيّ مصدرٍ يحمّل — وهذه الصفحة تحمّل الطرق
       والمباني على حلقاتٍ مؤجَّلة طوال عمرها، فالبوابة تبقى مغلقة أبداً
       والطبقة لا تُركَّب. الرمية وحدها هي الإشارة الصادقة. */
    function ensureLayer() {
      if (installed) return true;
      try {
        if (!map.getSource(SOURCE_ID)) {
          map.addSource(SOURCE_ID, {
            type: 'geojson',
            data: cached || { type: 'FeatureCollection', features: [] },
          });
        }
        var before = map.getLayer('roads') ? 'roads' : undefined;
        if (!map.getLayer(LAYER_ID)) {
          map.addLayer(buildLayer(SOURCE_ID, mode, hour), before);
        }
        if (!map.getLayer(WEAK_LAYER_ID)) {
          map.addLayer(buildWeakLayer(SOURCE_ID, mode, hour), before);
        }
        installed = true;
        lastError = null;
      } catch (err) {
        /* لا ابتلاع صامت: المحاولة قد تتكرر مشروعةً (النمط لم يكتمل بعد)، لكن
           السبب يبقى مقروءاً — من فحص المقبض عرف لماذا لا تظهر الطبقة. */
        installed = false;
        lastError = err;
      }
      return installed;
    }

    function eachLayer(fn) {
      [LAYER_ID, WEAK_LAYER_ID].forEach(function (id) {
        if (map.getLayer(id)) fn(id);
      });
    }

    /** إعادة الطلاء وحدها عند تغيير الوضع أو الساعة — البيانات لا تُمسّ. */
    function repaint() {
      var color = colorFor(mode, hour);
      eachLayer(function (id) { map.setPaintProperty(id, 'line-color', color); });
    }

    if (!ensureLayer() && typeof map.on === 'function') {
      map.on('styledata', function retry() {
        if (ensureLayer() && typeof map.off === 'function') map.off('styledata', retry);
      });
    }

    return {
      ensureData: ensureData,
      ensureLayer: ensureLayer,
      lastError: function () { return lastError; },
      mode: function () { return mode; },
      hour: function () { return hour; },
      summary: function () { return TrafficLoad.summarize(ensureData()); },
      /**
       * الشبكة تصل على حلقات بعد أن تكون الطبقة قد شُغِّلت.
       * -----------------------------------------------------------------------
       * بلا هذه الدالة يبقى الشريط مرسوماً على الشرايين وحدها، وكل شارعٍ محلي
       * أو حيّي يصل لاحقاً يظهر **بلا حملٍ إطلاقاً** — والقارئ يقرأ الفراغ
       * «لا حركة هنا» لا «لم يُحسب بعد». تُستدعى من الصفحة عند اكتمال كل حلقة.
       */
      refresh: function () {
        if (!visible || !ensureLayer()) return null;
        return TrafficLoad.summarize(ensureData());
      },
      setVisible: function (nextVisible) {
        visible = !!nextVisible;
        if (!ensureLayer()) return null;
        var summary = null;
        if (visible) summary = TrafficLoad.summarize(ensureData());
        eachLayer(function (id) {
          map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
        });
        return summary;
      },
      setMode: function (nextMode) {
        mode = nextMode === 'congestion' ? 'congestion' : 'volume';
        if (ensureLayer()) repaint();
        return mode;
      },
      setHour: function (nextHour) {
        var value = Number(nextHour);
        hour = Number.isFinite(value) ? ((Math.round(value) % 24) + 24) % 24 : hour;
        if (mode === 'congestion' && ensureLayer()) repaint();
        return hour;
      },
    };
  }

  return {
    SOURCE_ID: SOURCE_ID,
    LAYER_ID: LAYER_ID,
    WEAK_LAYER_ID: WEAK_LAYER_ID,
    MODES: MODES,
    DEFAULT_MODE: DEFAULT_MODE,
    defaultHour: defaultHour,
    formatHour: formatHour,
    congestionColorExpression: congestionColorExpression,
    colorFor: colorFor,
    buildWeakLayer: buildWeakLayer,
    controlsHtml: controlsHtml,
    GROUP_ID: GROUP_ID,
    GROUP_LABEL: GROUP_LABEL,
    WIDTH_SCALE: WIDTH_SCALE,
    colorExpression: colorExpression,
    buildLayer: buildLayer,
    legendHtml: legendHtml,
    toggleHtml: toggleHtml,
    popupHtml: popupHtml,
    roadPopupHtml: roadPopupHtml,
    install: install,
  };
});
