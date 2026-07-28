/**
 * MasarImpactCalibration — a real, persistable back-test log that turns the
 * "improves with every permit" claim into an actual mechanism instead of a
 * text promise. Each executed permit records predicted vs. observed
 * vehicle-hours; the correction factor is the MEDIAN of observed/predicted
 * ratios across the log, and is re-derived from the log every call.
 *
 * Pure and store-injected: pass localStorage in the browser, or a Map-backed
 * stub in tests. No Date.now(), no globals.
 *
 * UMD export: `window.MasarImpactCalibration` in the browser,
 * `module.exports` in Node.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MasarImpactCalibration = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STORAGE_KEY = 'masar-backtests-v1';

  /**
   * نسبة مقبولة في سجل المعايرة.
   *
   * **لماذا حارسٌ هنا وليس عند العرض.** كان `record` يفحص التوقّع وحده،
   * فتُقبل رصدةٌ بلا مرصود أو بمرصودٍ سالب، ويصير معامل التصحيح `NaN` أو
   * عدداً سالباً — ويصل الشاشة كما هو: تبويب القياس في المكتب يطبع
   * «معامل التصحيح: -0.50×» ، والنموذج التفاعلي يضرب ساعات-المركبة فيه
   * فيعرض أثراً سالباً. أي أن آلية «تتحسّن مع كل تصريح» كانت تتحسّن نحو رقم
   * لا معنى له.
   *
   * والحارس عند الكتابة لا عند العرض لسببين: السجل يُقرأ من أكثر من سطح
   * (المكتب والنموذج)، فحارسُ سطحٍ واحد لا يحمي البقية؛ والسجل **يبقى**
   * في `localStorage` عبر النسخ، فرصدةٌ فاسدة كُتبت مرة تعيش إلى الأبد.
   *
   * ولذلك يُصفّى عند القراءة أيضاً: سجلٌّ كُتب بنسخة سابقة بلا هذا الحارس
   * قد يحمل صفوفاً فاسدة، وحارسُ الكتابة وحده لا ينظّفها.
   */
  function isUsableRatio(record) {
    return record
      && Number.isFinite(record.predictedVehHours) && record.predictedVehHours > 0
      && Number.isFinite(record.observedVehHours) && record.observedVehHours > 0;
  }

  function median(sortedAsc) {
    const n = sortedAsc.length;
    if (n === 0) return 1;
    const mid = Math.floor(n / 2);
    return n % 2 === 1
      ? sortedAsc[mid]
      : (sortedAsc[mid - 1] + sortedAsc[mid]) / 2;
  }

  /**
   * @param {{getItem:(k:string)=>(string|null), setItem:(k:string,v:string)=>void}} store
   */
  function createCalibration(store) {
    function readAll() {
      const raw = store.getItem(STORAGE_KEY);
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    }

    function records() {
      return readAll().slice();
    }

    /**
     * @param {{permitId:string, predictedVehHours:number, observedVehHours:number}} entry
     * @returns {boolean} true if recorded, false if rejected (invalid pair)
     */
    function record(entry) {
      /* الرفض يشمل الطرفين. رصدةٌ بلا مرصود ليست رصدةً ناقصة تُكمَّل لاحقاً —
         هي صفٌّ يفسد الوسيط بصمت، لأن `undefined / 1200` يعطي `NaN` والوسيط
         يعيده كما هو. */
      if (!isUsableRatio(entry)) return false;
      const all = readAll();
      all.push({
        permitId: String(entry.permitId),
        predictedVehHours: entry.predictedVehHours,
        observedVehHours: entry.observedVehHours,
      });
      store.setItem(STORAGE_KEY, JSON.stringify(all));
      return true;
    }

    /**
     * Median observed/predicted ratio across the log. 1 when the log is empty.
     * @returns {number}
     */
    function ratios() {
      return readAll()
        .filter(isUsableRatio)
        .map(function (r) { return r.observedVehHours / r.predictedVehHours; })
        .sort(function (a, b) { return a - b; });
    }

    function correctionFactor() {
      return median(ratios());
    }

    /**
     * `n` عدد النسب **الصالحة** لا عدد الصفوف المكتوبة.
     *
     * الفرق يظهر على سجل كُتب بنسخة سابقة بلا حارس: المكتب يطبع «من 12 رصدة»
     * بينما ستٌّ منها لا تدخل الوسيط أصلاً، فيُقرأ المعامل أمتن مما هو.
     */
    function status() {
      return { n: ratios().length, factor: correctionFactor() };
    }

    return { record, records, ratios, correctionFactor, status };
  }

  return { createCalibration, isUsableRatio, STORAGE_KEY };
});
