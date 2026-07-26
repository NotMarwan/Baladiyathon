/**
 * أثر — الحلقة الثانية من شبكة الطرق.
 * ---------------------------------------------------------------------------
 * الشبكة مقسومة قسمين: شرايين تصل مع الصفحة، وفرعية تصل بعد أول إطار. السبب
 * أن ما يُقرأ عند تقريب المدينة هو الشرايين وحدها؛ الفرعية لا تُميَّز بالعين
 * قبل أن يقترب المراجع، فتحميلها قبل أول إطار ثمن يُدفع مقابل لا شيء يُرى.
 *
 * التحميل يبدأ عند الخمول لا فور الجاهزية: المراجع في ثانيته الأولى يقرأ
 * الصندوق ويحرّك الخريطة، ومنافسة سكربت 700 ك.ب على الخيط في تلك اللحظة
 * تسرق منه استجابة يشعر بها مقابل تفاصيل لا ينظر إليها.
 *
 * الفشل صامت ومقبول: خريطة بشرايينها خريطة صحيحة، ناقصة زينة لا معنى.
 *
 * UMD بنفس نمط athar-engine.js.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AtharRoadsLazy = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEFAULT_SRC = 'data/riyadh-roads-local.geojson.js';
  var DEFAULT_GLOBAL = 'RIYADH_ROADS_LOCAL';
  var IDLE_TIMEOUT_MS = 1200;

  /** نسيج المباني: نفس المنطق، حمل أثقل، وأهمية بصرية أقل — فيأتي أخيراً. */
  var BUILDINGS = {
    src: 'data/riyadh-buildings.geojson.js',
    globalName: 'RIYADH_BUILDINGS',
    apply: 'setBuildings',
  };

  /** دمج مجموعتين في مجموعة ثالثة. لا تُعدَّل أيّ منهما. */
  function merge(first, second) {
    return {
      type: 'FeatureCollection',
      features: (first.features || []).concat(second.features || []),
    };
  }

  /** أول لحظة خمول، أو مهلة قصيرة على متصفح لا يعرف requestIdleCallback. */
  function whenIdle(fn) {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(fn, { timeout: IDLE_TIMEOUT_MS });
      return;
    }
    setTimeout(fn, IDLE_TIMEOUT_MS);
  }

  function loadScript(src, done) {
    var script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = function () { done(null); };
    script.onerror = function () { done(new Error('تعذّر تحميل ' + src)); };
    document.head.appendChild(script);
  }

  /**
   * @param {object} api واجهة AtharWorksMap — يجب أن تحمل الدالة المطبِّقة.
   * @param {object} [options] {src, globalName, apply, onDone}
   */
  function attach(api, options) {
    var opts = options || {};
    var src = opts.src || DEFAULT_SRC;
    var globalName = opts.globalName || DEFAULT_GLOBAL;
    var applyName = opts.apply || 'appendRoads';
    var done = opts.onDone || function () {};

    if (!api || typeof api[applyName] !== 'function') {
      done(new Error('الواجهة بلا ' + applyName));
      return;
    }

    whenIdle(function () {
      loadScript(src, function (err) {
        if (err) { done(err); return; }
        var collection = window[globalName];
        if (!collection || !collection.features) {
          done(new Error('الملف حُمّل بلا ' + globalName));
          return;
        }
        api[applyName](collection);
        done(null, collection.features.length);
      });
    });
  }

  /**
   * تحميل حمولة غير جغرافية عند الخمول — رسم التوجيه مثلاً.
   * ---------------------------------------------------------------------------
   * `attach` يشترط مجموعة ميزات لأنه يسلّمها لواجهة الخريطة. ورسم التوجيه ليس
   * مجموعة ميزات بل عقد وأضلاع، ولا يذهب إلى الخريطة بل إلى المحسِّن. فالمشترك
   * بينهما التأجيل لا التسليم، وهذا يعرضه وحده.
   */
  function load(src, globalName, done) {
    var finish = done || function () {};
    whenIdle(function () {
      loadScript(src, function (err) {
        if (err) { finish(err); return; }
        var payload = window[globalName];
        if (!payload) { finish(new Error('الملف حُمّل بلا ' + globalName)); return; }
        finish(null, payload);
      });
    });
  }

  /** المباني بعد الطرق: الأثقل آخراً كي لا يزاحم ما يُقرأ قبله. */
  function attachBuildings(api, options) {
    var opts = options || {};
    attach(api, {
      src: opts.src || BUILDINGS.src,
      globalName: opts.globalName || BUILDINGS.globalName,
      apply: BUILDINGS.apply,
      onDone: opts.onDone,
    });
  }

  return {
    attach: attach,
    attachBuildings: attachBuildings,
    load: load,
    merge: merge,
    DEFAULT_SRC: DEFAULT_SRC,
    DEFAULT_GLOBAL: DEFAULT_GLOBAL,
    BUILDINGS: BUILDINGS,
  };
});
