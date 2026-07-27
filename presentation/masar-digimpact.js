/**
 * مسار — أثر الحفر على الحركة، مرسوماً على الخريطة
 * ---------------------------------------------------------------------------
 * الطبقات الأخرى تصف **الحاصل**: هنا عمل، وهنا إغلاق، وهذا حمل الشارع. وهذه
 * تصف **ما يفعله العمل بالشارع**: كم يتضاعف زمن العبور بسبب هذا الحفر
 * تحديداً، في ساعةٍ يختارها القارئ.
 *
 * وهي الطبقة الوحيدة التي تتفاوت لكل تصريح على حدة لسببٍ مادي: تصريحان على
 * الشارع نفسه يختلف أثرهما بعدد الحارات المغلقة، وتصريحان بإغلاقٍ متطابق
 * يختلف أثرهما بحمل شارعيهما. فما تعرضه ليس تلويناً لتصنيفٍ بل ناتجَ حساب.
 *
 * ## من أين يأتي كل رقم
 *
 *   · الحمل والحارات والإغلاق — من سجل التصريح، وحمله مقدَّر عبر
 *     `masar-trafficload.js` وقت بناء المحفظة.
 *   · حصة الساعة — `MasarEngine.HOURLY_PROFILE`.
 *   · سعة الحارة داخل منطقة العمل — `MasarEngine.CALIBRATION.WORK_ZONE_LANE_CAPACITY`
 *     (1475 مركبة/ساعة/حارة، مقيسة على خمس وعشرين منطقة عمل في تقرير ديلاوير).
 *   · الأرضية حين يُغلق كل شيء — `MIN_CAPACITY_FRACTION`.
 *   · زمن العبور قبل وبعد — `MasarEngine.bprTravelTime` نفسها لا نسخةٌ منها.
 *
 * لا معادلة مرورية جديدة هنا. كل ما في هذا الملف تركيبُ مدخلاتٍ للمحرك،
 * وتحويلُ ناتجه إلى نطاقاتِ لون.
 *
 * ## لماذا اللون على مضاعف الزمن لا على فرق نسبة السعة
 *
 * «نسبة الحجم إلى السعة ارتفعت 0.34» جملةٌ لا يقرؤها ساكن. و«الرحلة تصير
 * مرّةً ونصفاً» يقرؤها في ثانية، وهي الكمّية التي يشعر بها فعلاً. والاثنان من
 * الحساب نفسه — النسبة تُعرض في البطاقة والمضاعف يلوّن الخريطة.
 *
 * UMD بنفس نمط masar-engine.js.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('./masar-engine.js'),
      require('./masar-trafficload.js')
    );
  } else {
    root.MasarDigImpact = factory(root.MasarEngine, root.MasarTrafficLoad);
  }
})(typeof self !== 'undefined' ? self : this, function (Engine, TrafficLoad) {
  'use strict';

  var SOURCE_ID = 'dig-impact';
  var LAYER_ID = 'dig-impact-glow';
  var GROUP_LABEL = 'أثر الحفر على الحركة';

  /**
   * نطاقات المضاعف — كم تصير الرحلة عبر المقطع.
   * العتبات معلنة: ١٫١ حدُّ ما يُحسّ، و٢ حدُّ ما يدفع السائق إلى تغيير مساره.
   * ليست معايرة على سلوك سائقٍ سعودي مقيس.
   */
  var BANDS = [
    { id: 'none', label: 'أقل من 1.1×', max: 1.1, color: '#adb5bd' },
    { id: 'slight', label: '1.1× – 1.25×', max: 1.25, color: '#ffd43b' },
    { id: 'noticeable', label: '1.25× – 1.5×', max: 1.5, color: '#ff922b' },
    { id: 'heavy', label: '1.5× – 2×', max: 2, color: '#f03e3e' },
    { id: 'severe', label: '2× فأكثر', max: Infinity, color: '#862e2e' },
  ];

  function bandOf(factor) {
    for (var i = 0; i < BANDS.length; i += 1) {
      if (factor < BANDS[i].max) return BANDS[i];
    }
    return BANDS[BANDS.length - 1];
  }

  function isPositive(value) {
    return Number.isFinite(value) && value > 0;
  }

  /**
   * أثر تصريح واحد في ساعة واحدة.
   *
   * @param {object} permit {aadt, lanes, lanesClosed}
   * @param {number} hour ساعة العرض
   * @returns {object|null} null إن نقص مدخل جوهري — لا رقم من فراغ
   */
  function impactOf(permit, hour) {
    var record = permit || {};
    var aadt = Number(record.aadt);
    var lanes = Number(record.lanes);
    var closed = Number(record.lanesClosed);
    if (!isPositive(aadt) || !isPositive(lanes)) return null;
    if (!Number.isFinite(closed) || closed < 0) closed = 0;

    var capacityPerLane = Engine.DEFAULTS.capacityPerLane;
    var full = lanes * capacityPerLane;

    /* السعة أثناء العمل: الحارات الباقية بسعة منطقة العمل لا بالسعة الكاملة.
       والأرضية تمنع القسمة على ما يقارب الصفر حين يُغلق كل شيء — وهي أرضية
       المحرك نفسها لا رقمٌ يُعاد اختراعه هنا. */
    var open = Math.max(0, lanes - closed);
    var during = Math.max(
      open * Engine.CALIBRATION.WORK_ZONE_LANE_CAPACITY,
      full * Engine.CALIBRATION.MIN_CAPACITY_FRACTION
    );

    var share = TrafficLoad.shareAt(hour);
    var volume = aadt * share;
    var freeFlowMin = Engine.DEFAULTS.freeFlowMin;

    var before = Engine.bprTravelTime(freeFlowMin, volume, full);
    var duringT = Math.max(
      Engine.bprTravelTime(freeFlowMin, volume, during),
      // احتكاك منطقة العمل: التضييق والمخاريط تُبطئ ولو كان الطلب منخفضاً.
      before * Engine.CALIBRATION.WORK_ZONE_FRICTION
    );

    var factor = before > 0 ? duringT / before : 1;

    /* حدّ الفحص السريع — نفس الحدّ المعلن في `scripts/build-city-portfolio.js`
       (تأخير يتجاوز 150٪ يعني مضاعفاً فوق 2.5). فوقه يتضخّم BPR لأن الطلب
       تجاوز السعة، والرقم يصير **مؤشّر خطورة لا تقديراً**. وقياس المحفظة
       الحقيقية يعطي 16× على طريق الملك خالد في ذروة المساء — وعرض ذلك رقماً
       دقيقاً بلا هذا الحدّ ادّعاءٌ لا يصمد. */
    var beyondScreening = factor > 2.5;

    return {
      beyondScreening: beyondScreening,
      hour: ((Math.round(hour) % 24) + 24) % 24,
      volume: Math.round(volume),
      lanes: lanes,
      lanesClosed: closed,
      lanesOpen: open,
      capacityBefore: Math.round(full),
      capacityDuring: Math.round(during),
      ratioBefore: volume / full,
      ratioDuring: volume / during,
      minutesBefore: before,
      minutesDuring: duringT,
      addedMinutes: duringT - before,
      factor: factor,
      band: bandOf(factor).id,
      bandLabel: bandOf(factor).label,
    };
  }

  /**
   * يبني مجموعة الأثر من مجموعة الأعمال — الخطوط وحدها.
   * النقاط تُستبعد: أثرُ الحفر خاصيةُ **مقطعٍ** من شارع، ونقطةٌ بلا امتداد لا
   * تحمل زمن عبور. رسمُها بلونٍ في التدرّج يوهم بحسابٍ لم يقع.
   */
  function buildCollection(works, hour) {
    var features = (works && works.features) || [];
    var out = [];
    features.forEach(function (feature) {
      if (!feature.geometry || feature.geometry.type !== 'LineString') return;
      var props = feature.properties || {};
      var impact = impactOf(props, hour);
      if (!impact) return;
      out.push({
        type: 'Feature',
        geometry: feature.geometry,
        properties: {
          id: props.id,
          permitRef: props.permitRef,
          street: props.street,
          dig_factor: Number(impact.factor.toFixed(3)),
          dig_band: impact.band,
          dig_added_min: Number(impact.addedMinutes.toFixed(2)),
          dig_lanes: impact.lanes,
          dig_lanes_closed: impact.lanesClosed,
          dig_hour: impact.hour,
        },
      });
    });
    return { type: 'FeatureCollection', features: out };
  }

  /** حصيلة: كم مقطعاً في كل نطاق، وأشدّها أثراً. */
  function summarize(collection) {
    var features = (collection && collection.features) || [];
    var byBand = {};
    BANDS.forEach(function (band) { byBand[band.id] = 0; });
    var worst = null;
    features.forEach(function (feature) {
      var props = feature.properties;
      byBand[props.dig_band] = (byBand[props.dig_band] || 0) + 1;
      if (!worst || props.dig_factor > worst.dig_factor) worst = props;
    });
    return { segments: features.length, byBand: byBand, worst: worst };
  }

  return {
    SOURCE_ID: SOURCE_ID,
    LAYER_ID: LAYER_ID,
    GROUP_LABEL: GROUP_LABEL,
    BANDS: BANDS,
    bandOf: bandOf,
    impactOf: impactOf,
    buildCollection: buildCollection,
    summarize: summarize,
  };
});
