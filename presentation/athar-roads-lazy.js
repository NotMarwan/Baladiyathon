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
   * @param {object} api واجهة AtharWorksMap — يجب أن تحمل appendRoads.
   * @param {object} [options] {src, globalName, onDone}
   */
  function attach(api, options) {
    var opts = options || {};
    var src = opts.src || DEFAULT_SRC;
    var globalName = opts.globalName || DEFAULT_GLOBAL;
    var done = opts.onDone || function () {};

    if (!api || typeof api.appendRoads !== 'function') {
      done(new Error('الواجهة بلا appendRoads'));
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
        api.appendRoads(collection);
        done(null, collection.features.length);
      });
    });
  }

  return { attach: attach, merge: merge, DEFAULT_SRC: DEFAULT_SRC, DEFAULT_GLOBAL: DEFAULT_GLOBAL };
});
