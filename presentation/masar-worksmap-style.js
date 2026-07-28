/**
 * مسار — الخريطة الأساسية الفاتحة (بلا بلاط، بلا خوادم خارجية)
 * ---------------------------------------------------------------------------
 * 1) style JSON مكتوب يدوياً — نملك كل لون وعرض عند كل مستوى تكبير.
 * 2) أرضية فاتحة هادئة — الخريطة تقرأ كمستند حكومي رسمي لا كلوحة عرض.
 * 3) تدرّج الطرق بالعرض لا بالصخب: شرياني كريمي ← رئيسي أبيض ← فرعي أرفع.
 * 4) حافة رمادية تحت كل طريق — العمق من الطبقتين لا من الظل.
 * 5) الخطوط والأيقونات محلية تحت vendor/ — صفر طلبات وقت التشغيل.
 * 6) أسماء الطرق طبقة symbol حقيقية، فتشكيل العربية من إضافة RTL.
 * 7) المياه والخضرة والاستعمال من data/riyadh-base.geojson.
 * 8) المباني من data/riyadh-buildings.geojson — تصل بعد أول إطار.
 *    حقيقيها من OSM ومولَّدها موسوم `f: 1` — راجع src-P03 في سجل المصادر.
 * 9) الدالة نقية تماماً — تُختبر في Node بلا متصفح.
 *
 * بيانات الطرق والمعالم © مساهمو OpenStreetMap — رخصة ODbL.
 * UMD بنفس نمط masar-engine.js.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MasarWorksMapStyle = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var BASE_COLORS = {
    /**
     * الأرض ليست بيضاء.
     * -------------------------------------------------------------------------
     * الشارع أبيض، فإن كانت الأرض بيضاء أيضاً اختفت الشبكة وبقيت الخريطة
     * صفحةً عليها تسميات. تنزل الأرض بضع نقاط عن الأبيض فيظهر الشارع من تلقاء
     * نفسه بلا أن نصرخ بلونه.
     */
    stage: '#eeece8',
    water: '#c3dcf0',
    green: '#dde9d2',
    road: '#ffffff',
    roadMajor: '#fdf6e3',
    casing: '#e2e0db',
    label: '#5b5b60',
    labelHalo: '#ffffff',
    placeLabel: '#3b3b40',

    /**
     * نسيج المدينة: أرض فضاء ← حي سكني ← منطقة عمل ← مبنى.
     * -------------------------------------------------------------------------
     * أربع درجات متقاربة لا أربعة ألوان: الفارق بينها بضع نقاط إضاءة، فتُقرأ
     * الكتلة العمرانية من التفاوت لا من التلوين. أوسع من ذلك يصير الأساس
     * لوحةً تنافس طبقات الأعمال فوقها.
     */
    sand: '#efeadf',
    urban: '#ebe8e2',
    work: '#e8e7e4',
    building: '#ded9d0',
    buildingLarge: '#cfc9be',
    buildingEdge: '#c6c0b4',
    buildingShadow: '#aca699',
  };

  /**
   * ألوان المعالم — مكتومة عمداً.
   * ---------------------------------------------------------------------------
   * الخريطة تحمل فوقها ألوان حالات العمل: أزرق مفتوح، أحمر مغلق، أخضر مُفرَج.
   * ولو أخذت نقاط الاهتمام الدرجات المشبعة نفسها لتنافست نقطةُ سياقٍ مع خطِّ
   * قرار، وضاع أيّهما يقرأ القارئ أولاً. فكل لون هنا أخفض إشباعاً بدرجتين من
   * نظيره في حالات العمل: يُميَّز النوع، ولا يُنازَع القرار.
   *
   * المفاتيح هي `kind` التي يكتبها scripts/fetch-gmaps-poi.js — لا تصنيفات
   * Google الحرفية. تصنيف Google يُحفظ في `cat` للبطاقة وحدها.
   */
  var POI_COLORS = {
    health: '#c25450',
    education: '#5c72c4',
    retail: '#4a83b8',
    food: '#c9743c',
    hospitality: '#9a5aa8',
    government: '#5e6570',
    finance: '#3f8f7a',
    business: '#6b7bb5',
    transport: '#3f8593',
    leisure: '#5a9159',
    worship: '#7a6bb0',
    other: '#7d7a74',
  };

  var POI_KINDS = Object.keys(POI_COLORS).filter(function (k) { return k !== 'other'; });

  /**
   * أسماء المجموعات في الدليل — بنفس ترتيب الجدول أعلاه.
   * قاعدة الطقم: لون الصف في الدليل هو لون النقطة على الخريطة. فالمصدر واحد،
   * ولا يجوز أن يكتب الدليل لوناً ويرسم النمط آخر.
   */
  var POI_LABELS = {
    health: 'صحة',
    education: 'تعليم',
    retail: 'تجارة وتجزئة',
    food: 'مطاعم ومقاهٍ',
    hospitality: 'ضيافة',
    government: 'جهات حكومية',
    finance: 'خدمات مالية',
    business: 'أعمال ومكاتب',
    transport: 'نقل ومحطات',
    leisure: 'ترفيه ومتنزهات',
    worship: 'مساجد',
  };

  /** `match` يريد أزواجاً مسطّحة: قيمة، مخرَج، قيمة، مخرَج… ثم الاحتياطي. */
  function poiColor() {
    var expr = ['match', ['get', 'kind']];
    POI_KINDS.forEach(function (kind) { expr.push(kind, POI_COLORS[kind]); });
    expr.push(POI_COLORS.other);
    return expr;
  }

  /**
   * الظهور على ثلاث رتب — وهي ما يجعل الخريطة تُقرأ بدل أن تمتلئ.
   * ---------------------------------------------------------------------------
   * `t` رتبة البروز التي حسبها الحاصد من عدد التقييمات (١ الأعلى). عند منظر
   * المدينة تظهر الرتبة الأولى وحدها — عشرات المعالم التي يعرفها كل ساكن —
   * ثم تنضم الثانية عند الحيّ والثالثة عند الشارع. هذا اصطلاح كل خريطة ملاحة،
   * وبدونه تصير المدينة عند z11 سحابة نقاط لا معلومة فيها.
   *
   * والتدرّج بين العتبتين لا قفزٌ عندهما: `interpolate` يمزج بين مخرَجَي 0 و1
   * فتصل الرتبة باهتةً ثم تصمت. الظهور المفاجئ يُقرأ خللاً في العرض.
   */
  function poiTierOpacity(z1, z2, z3) {
    return [
      'interpolate', ['linear'], ['zoom'],
      z1 - 0.8, 0,
      z1, ['case', ['==', ['get', 't'], 1], 1, 0],
      z2, ['case', ['<=', ['get', 't'], 2], 1, 0],
      z3, 1,
    ];
  }

  /**
   * لون المبنى يتدرّج مع مساحته.
   * ---------------------------------------------------------------------------
   * `a` شريحة مساحة (0..3) يحسبها scripts/fetch-buildings.js. الفيلا تبقى
   * فاتحة قريبة من الأرض، والمجمّع والبرج يثقلان تدريجياً — فتُقرأ كثافة
   * المكان من درجة الرمادي قبل أن يُقرأ أي اسم.
   */
  function buildingColor() {
    return [
      'interpolate', ['linear'], ['to-number', ['get', 'a'], 0],
      0, BASE_COLORS.building,
      3, BASE_COLORS.buildingLarge,
    ];
  }

  var MAJOR = ['motorway', 'motorway_link', 'trunk', 'trunk_link'];
  var PRIMARY = ['primary', 'primary_link', 'secondary', 'secondary_link'];
  var LOCAL = ['tertiary', 'tertiary_link', 'unclassified'];
  /** ما دون ذلك — `residential` و`living_street` — أرقّها وآخرها ظهوراً. */
  var MINOR = ['residential', 'living_street'];

  /**
   * عرض الطريق: يكبر مع التقريب ويتدرج مع التصنيف. scale يوسّع الحافة.
   * ---------------------------------------------------------------------------
   * أربع رتب لا ثلاث. حين دخلت شوارع الأحياء الشبكة صارت الرتبة الثالثة تجمع
   * الشارع المحلي بالشارع السكني في عرضٍ واحد، فامتلأت المدينة عند التقريب
   * المتوسط شبكةً رمادية متساوية لا تُقرأ منها بنية.
   *
   * والسكني يبدأ من صفر ويظهر بين الثالث عشر والخامس عشر — وهذا اصطلاح كل
   * خريطة ملاحة: شوارع الحيّ تُرى حين ينزل القارئ إلى الحيّ، ورسمُها على مستوى
   * المدينة ضجيجٌ يخفي الشرايين التي جاء يقرأها.
   */
  function roadWidth(scale) {
    function byClass(major, primary, local, minor) {
      return [
        'match', ['get', 'highway'],
        MAJOR, major * scale,
        PRIMARY, primary * scale,
        LOCAL, local * scale,
        minor * scale,
      ];
    }
    return [
      'interpolate', ['exponential', 1.6], ['zoom'],
      10, byClass(1.6, 1, 0.5, 0),
      13, byClass(4.5, 2.6, 1.2, 0),
      15, byClass(11, 7, 3.4, 1.8),
      18, byClass(30, 20, 11, 7),
    ];
  }

  var EMPTY = { type: 'FeatureCollection', features: [] };

  function buildStyle(roads, base, options) {
    var opts = options || {};
    return {
      version: 8,
      glyphs: opts.glyphsUrl,
      sprite: opts.spriteUrl,
      sources: {
        roads: { type: 'geojson', data: roads },
        base: { type: 'geojson', data: base },
        /**
         * مصدران للمباني لا واحد.
         * ---------------------------------------------------------------------
         * نصف مليون مضلع في مصدرٍ واحد كلفتُها على العامل تتبع عرض الشاشة لا
         * حجم الملف: شاشةٌ عند تقريب 13.5 تُدخل خمسة عشر ألف مضلع في الإطار
         * فتستغرق عشرين ثانية بعد وصول البيانات — وهي بالضبط شكوى «افتح على
         * خمسمئة متر فلا تظهر التفاصيل».
         *
         * `buildings-overview` نظرةٌ خشنة لكل المدينة (427 ك.ب) تصل فوراً،
         * و`buildings` بلاطاتٌ تفصيلية تُطلب حسب النطاق المعروض. والخشن ينسحب
         * أمام الدقيق بمرشّح لا بحذف، فلا وميض ولا رسمٌ مزدوج.
         */
        'buildings-overview': { type: 'geojson', data: opts.buildingsOverview || EMPTY },
        buildings: { type: 'geojson', data: opts.buildings || EMPTY },
        /**
         * المعالم — مصدر واحد بلا تجميع.
         * ---------------------------------------------------------------------
         * التجميع (cluster) خطأ هنا: هذه ليست حوادثَ يُعدّ تكرارها بل وجهاتٍ
         * يُقرأ اسمها. ودائرةٌ مكتوب عليها «١٢» مكان مولٍّ يعرفه الناس بالاسم
         * تُسقط بالضبط ما جاءت الطبقة تضيفه. الترقيق يقع بالرتبة وبتصادم
         * التسميات، لا بالدمج.
         */
        poi: { type: 'geojson', data: opts.poi || EMPTY },
      },
      layers: [
        { id: 'bg', type: 'background', paint: { 'background-color': BASE_COLORS.stage } },
        {
          id: 'base-sand', type: 'fill', source: 'base',
          filter: ['==', ['get', 'kind'], 'sand'],
          paint: { 'fill-color': BASE_COLORS.sand },
        },
        {
          id: 'base-urban', type: 'fill', source: 'base',
          filter: ['==', ['get', 'kind'], 'urban'],
          paint: { 'fill-color': BASE_COLORS.urban },
        },
        {
          id: 'base-work', type: 'fill', source: 'base',
          filter: ['==', ['get', 'kind'], 'work'],
          paint: { 'fill-color': BASE_COLORS.work },
        },
        {
          id: 'base-green', type: 'fill', source: 'base',
          filter: ['==', ['get', 'kind'], 'green'],
          paint: { 'fill-color': BASE_COLORS.green },
        },
        {
          id: 'base-water', type: 'fill', source: 'base',
          filter: ['==', ['get', 'kind'], 'water'],
          paint: { 'fill-color': BASE_COLORS.water },
        },
        /**
         * ظل المبنى: نفس المضلع مزاحاً بكسلين وبشفافية منخفضة.
         * ---------------------------------------------------------------------
         * بلا الظل تبدو الكتل ملصقات مسطحة على ورقة. الإزاحة ثابتة بالبكسل لا
         * بالمتر، فالظل يبقى بسمكه نفسه عند كل تقريب — كما في الخرائط
         * التحريرية. يظهر عند z15 فقط: قبله المبنى بضعة بكسلات والظل يجعله
         * لطخة.
         */
        /**
         * النسيج الخشن — يُرسم حيث لم تصل البلاطة التفصيلية بعد.
         * ---------------------------------------------------------------------
         * خليةٌ بمئة وستين متراً تحمل مقدار ما فيها من بناء، وشفافيتُها تتبعه:
         * الحيّ المكتظّ يخرج داكناً والمتفرّق فاتحاً. عند تقريب المدينة هذا هو
         * بالضبط ما تقوله نصفُ مليون مضلع — كثافةً لا مبانيَ — وبأربعمئة
         * كيلوبايت بدل مئة ميغابايت.
         *
         * ويبقى مرسوماً بعد وصول التفاصيل خارجَ البلاطات المحمَّلة وحدها:
         * `MasarBuildingsLazy` يضع المرشّح، فالخريطة لا تُترك فارغةً لحظةً.
         */
        {
          id: 'buildings-overview', type: 'fill', source: 'buildings-overview', minzoom: 10.5,
          paint: {
            'fill-color': BASE_COLORS.building,
            /**
             * التقريب في الأعلى والكثافة في المخرجات.
             * `zoom` لا يُقبل إلا مُدخلاً لـ`interpolate` أو `step` في الأعلى —
             * وضربُ تعبيرِ تقريبٍ في تعبير خاصية يُبطل النمط كله بصمت، فتسقط
             * الخريطة قبل أن تجهز. فالسُلَّم في الأعلى، وكل درجةٍ فيه تقرأ
             * كثافة الخلية.
             */
            'fill-opacity': ['interpolate', ['linear'], ['zoom'],
              10.5, 0,
              11.5, ['*', 0.45, ['min', 1, ['*', 1.6, ['get', 'd']]]],
              13, ['*', 0.75, ['min', 1, ['*', 1.6, ['get', 'd']]]],
              14.5, ['*', 0.9, ['min', 1, ['*', 1.6, ['get', 'd']]]]],
          },
        },
        {
          id: 'buildings-shadow', type: 'fill', source: 'buildings', minzoom: 13.5,
          paint: {
            'fill-color': BASE_COLORS.buildingShadow,
            'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13.5, 0, 14.5, 0.2, 16, 0.24],
            'fill-translate': [1.6, 1.6],
          },
        },
        /**
         * النسيج يبدأ من z11 — منظر المدينة كاملاً.
         * ---------------------------------------------------------------------
         * عند z11 المبنى الواحد أصغر من بكسل، فلا يُقرأ مبنىً بل كثافة: الأحياء
         * المبنية تصير رمادياً ناعماً والفضاء يبقى فاتحاً، وهو أصدق ما تقوله
         * الخريطة عن المدينة من هذا الارتفاع.
         *
         * الشفافية تتدرّج مع التقريب بدل أن تظهر كاملة: عند البعد تكون طبقة
         * ظلٍّ خفيفة لا تنافس خطوط الأعمال فوقها، وعند الاقتراب تصير مبانيَ
         * مصمتة. القفزة المفاجئة عند عتبة واحدة تُقرأ خللاً لا تفصيلاً.
         */
        {
          id: 'buildings', type: 'fill', source: 'buildings', minzoom: 10.5,
          paint: {
            'fill-color': buildingColor(),
            'fill-opacity': [
              'interpolate', ['linear'], ['zoom'],
              10.5, 0,
              11.5, 0.45,
              13, 0.75,
              14.5, 1,
            ],
          },
        },
        /**
         * حافة المبنى من z13.2 — مقياس ٢٠٠ متر.
         * ---------------------------------------------------------------------
         * بلا حافة تلتحم المباني المتلاصقة في كتلة رمادية واحدة، فيضيع أن هذه
         * عشر عمائر لا مبنىً واحداً. الحافة هي ما يجعل النسيج يُقرأ نسيجاً.
         *
         * العرض يتدرّج مع التقريب: عند البعد شعرة تفصل ولا تُثقل، وعند القرب
         * خطٌّ يحمل المبنى. ثابتاً عند 0.8 يختفي بعيداً ويصير قفصاً قريباً.
         */
        {
          id: 'buildings-edge', type: 'line', source: 'buildings', minzoom: 13.2,
          layout: { 'line-join': 'round' },
          paint: {
            'line-color': BASE_COLORS.buildingEdge,
            'line-width': [
              'interpolate', ['exponential', 1.4], ['zoom'],
              13.2, 0.4,
              15, 0.7,
              17, 1.1,
              19, 1.8,
            ],
            'line-opacity': ['interpolate', ['linear'], ['zoom'], 13.2, 0, 14.2, 1],
          },
        },
        {
          id: 'roads-casing', type: 'line', source: 'roads',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': BASE_COLORS.casing, 'line-width': roadWidth(1.35) },
        },
        {
          id: 'roads', type: 'line', source: 'roads',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': [
              'match', ['get', 'highway'],
              MAJOR, BASE_COLORS.roadMajor,
              PRIMARY, BASE_COLORS.roadMajor,
              BASE_COLORS.road,
            ],
            'line-width': roadWidth(1),
          },
        },
        /**
         * نقطة المعلم — تحت طبقات الأعمال وفوق الإسفلت.
         * ---------------------------------------------------------------------
         * موضعها في المصفوفة عقد: `masar-worksmap.js` يُدرج طبقات الأعمال قبل
         * أول طبقة symbol (وهي `road-labels` أدناه)، فتقع الأعمال فوق النقاط
         * حتماً. لو وُضعت النقاط بعد التسميات لغطّت خطَّ العمل المغلق نقطةُ
         * مقهى — وهي أتفه ما على الخريطة وأهمُّ ما فيها بالترتيب المقلوب.
         *
         * حلقة بيضاء حول النقطة لا ظل: النقطة تقع فوق مبانٍ رمادية وشوارع
         * بيضاء، والحلقة هي ما يفصلها عن الاثنين بلا أن تضيف طبقة ثقل ثالثة.
         */
        {
          id: 'poi-dots', type: 'circle', source: 'poi', minzoom: 10.8,
          paint: {
            'circle-color': poiColor(),
            'circle-radius': [
              'interpolate', ['linear'], ['zoom'],
              11, ['case', ['==', ['get', 't'], 1], 3.4, 2.4],
              14, ['case', ['==', ['get', 't'], 1], 5.2, ['==', ['get', 't'], 2], 4.2, 3.2],
              17, ['case', ['==', ['get', 't'], 1], 8, ['==', ['get', 't'], 2], 6.4, 5],
            ],
            'circle-opacity': poiTierOpacity(11.6, 13.2, 14.4),
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 11, 0.8, 15, 1.6],
            'circle-stroke-opacity': poiTierOpacity(11.6, 13.2, 14.4),
          },
        },
        {
          id: 'road-labels', type: 'symbol', source: 'roads', minzoom: 13,
          filter: ['all',
            ['has', 'name'], ['!=', ['get', 'name'], ''],
            ['!', ['in', ['get', 'highway'], ['literal', MINOR]]],
          ],
          layout: {
            'symbol-placement': 'line',
            'text-field': ['get', 'name'],
            'text-font': ['Noto Sans Regular'],
            'text-size': 11,
            'text-max-angle': 30,
          },
          paint: {
            'text-color': BASE_COLORS.label,
            'text-halo-color': BASE_COLORS.labelHalo,
            'text-halo-width': 1.4,
          },
        },
        {
          /**
           * أسماء شوارع الأحياء طبقةٌ على حدة بعتبة تقريبٍ أعلى.
           * وضعُها في الطبقة نفسها يجعل عشرات الآلاف من أسماء الأحياء تنافس
           * أسماء الشرايين على المواضع، فتُزاح الشرايين — والقارئ عند المدينة
           * جاء يقرأ الشرايين. تظهر حين ينزل إلى الحيّ، وأصغر خطاً وأخفت.
           */
          id: 'road-labels-minor', type: 'symbol', source: 'roads', minzoom: 15,
          filter: ['all',
            ['has', 'name'], ['!=', ['get', 'name'], ''],
            ['in', ['get', 'highway'], ['literal', MINOR]],
          ],
          layout: {
            'symbol-placement': 'line',
            'text-field': ['get', 'name'],
            'text-font': ['Noto Sans Regular'],
            'text-size': 9.5,
            'text-max-angle': 30,
            'text-padding': 3,
          },
          paint: {
            'text-color': BASE_COLORS.label,
            'text-halo-color': BASE_COLORS.labelHalo,
            'text-halo-width': 1.4,
            'text-opacity': 0.75,
          },
        },
        {
          id: 'place-labels', type: 'symbol', source: 'base',
          filter: ['==', ['get', 'kind'], 'place'],
          layout: {
            'text-field': ['get', 'name'],
            'text-font': ['Noto Sans Regular'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 11, 11, 15, 14],
          },
          paint: {
            'text-color': BASE_COLORS.placeLabel,
            'text-halo-color': BASE_COLORS.labelHalo,
            'text-halo-width': 1.6,
          },
        },
        /**
         * اسم المعلم — آخر طبقة في النمط عمداً.
         * ---------------------------------------------------------------------
         * MapLibre يضع رموز الطبقات بترتيبها من الأسفل، والموضوع أولاً يحجز
         * مكانه فيُزيح ما بعده. فوضعُ أسماء المعالم أخيراً يعني: أسماء الشوارع
         * والأحياء وعناوين الأعمال تأخذ مواضعها أولاً، وأسماء المعالم تملأ ما
         * فضل. وهو الترتيب الصحيح — القارئ جاء يقرأ شارعاً وعملاً، والمعلم
         * سياقٌ يعينه على ذلك لا يزاحمه.
         *
         * و`symbol-sort-key` بالسالب: داخل الطبقة نفسها يفوز الأكثر تقييماً.
         * المفتاح يُرتَّب تصاعدياً، والأصغر يُوضَع أولاً — فسالبُ عدد التقييمات
         * يجعل مولاً بـ٣٧ ألف تقييم يسبق مقهىً بـ٥٢٠ على الموضع المتنازع عليه.
         */
        {
          id: 'poi-labels', type: 'symbol', source: 'poi', minzoom: 12.4,
          layout: {
            'text-field': ['get', 'name'],
            'text-font': ['Noto Sans Regular'],
            'text-size': [
              'interpolate', ['linear'], ['zoom'],
              12.4, ['case', ['==', ['get', 't'], 1], 11, 9.5],
              16, ['case', ['==', ['get', 't'], 1], 13, 11],
            ],
            'text-anchor': 'top',
            'text-offset': [0, 0.65],
            'text-max-width': 8,
            'text-padding': 3,
            'symbol-sort-key': ['-', 0, ['to-number', ['get', 'rev'], 0]],
          },
          paint: {
            'text-color': poiColor(),
            'text-halo-color': BASE_COLORS.labelHalo,
            'text-halo-width': 1.5,
            'text-opacity': poiTierOpacity(12.4, 13.6, 14.8),
          },
        },
      ],
    };
  }

  return {
    BASE_COLORS: BASE_COLORS,
    POI_COLORS: POI_COLORS,
    POI_KINDS: POI_KINDS,
    POI_LABELS: POI_LABELS,
    poiColor: poiColor,
    roadWidth: roadWidth,
    buildingColor: buildingColor,
    buildStyle: buildStyle,
  };
});
