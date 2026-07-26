/**
 * أثر — الحفر مرة واحدة: من عرض التعارض إلى اقتراح الدمج.
 * ---------------------------------------------------------------------------
 * تبويب التعارض كان يقول «تعارض مع BLD-0064 — تداخل 96 ساعة». صحيح، وبلا
 * فائدة: المراجع يعرف أن هناك تعارضاً، وسؤاله هو ماذا يفعل به.
 *
 * هذه الوحدة تجيب: تجمع التصاريح المتجاورة على المقطع نفسه، وتحسب ما يوفّره
 * دمجها — بعدد التصاريح الزائدة عن واحد، وبساعة-مركبة من فرق الإغلاق.
 *
 * النموذج مُعلن لا مضمر:
 *
 *   • **التصاريح الإضافية في المجموعة = الأعضاء ناقص واحد.** عدّ لا ادعاء
 *     أثر: المجموعة تُبنى بتجاور الشارع والنافذة، وقد تكون نطاقات مختلفة
 *     نُسّقت توقيتاً فقط. «حفريات متجنَّبة» تحتاج هندسة النطاقات.
 *
 *   • **الطول المكرر مفترَض لا محسوب.** يستلزم تداخلاً تاماً بين المسارات،
 *     والتداخل الهندسي الفعلي غير محسوب هنا. لذلك يُسمّى «طول حفر مكرر مكافئ»
 *     ويحمل افتراضه معه أينما عُرض (WP-A2).
 *
 *   • **طول الخندق المشترك = أقصر الأعضاء.** أطولها لا يشارك غيره إلا بقدر
 *     أقصرها؛ أخذُ الأطول يضخّم الوفر باختلاف لا يقع.
 *
 *   • **التأخير بعد الدمج = أكبر عضو وحده.** إغلاق واحد يحلّ محل إغلاقات،
 *     وأثره أثر أشدّها لا مجموعها. والوفر هو ما عدا الأكبر.
 *
 *   • **الاقتراح ليس جدولة.** الدمج يتطلّب موافقة كل جهة، وقد تختلف أعماق
 *     الخدمات ومواصفاتها. الوحدة تُخرج ما يجب التحقّق منه مع الرقم، ولا
 *     تعرض زرّ «ادمج» — قرار لا نملك مدخلاته لا يُعرض كأنه بضغطة.
 *
 * UMD بنفس نمط athar-engine.js.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AtharDeskDigOnce = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var KM_PER_DEGREE = 111.32;

  /** أقصى فجوة بين نافذتين تبقى الدمج معقولاً — أسبوع. */
  var MERGE_GAP_DAYS = 7;

  function lengthKm(geometry) {
    if (!geometry || geometry.type !== 'LineString') return 0;
    var points = geometry.coordinates || [];
    var total = 0;
    for (var i = 1; i < points.length; i += 1) {
      var dx = (points[i][0] - points[i - 1][0])
        * Math.cos((points[i][1] + points[i - 1][1]) * Math.PI / 360);
      var dy = points[i][1] - points[i - 1][1];
      total += Math.sqrt(dx * dx + dy * dy);
    }
    return total * KM_PER_DEGREE;
  }

  function windowOf(properties) {
    return { from: Date.parse(properties.start), to: Date.parse(properties.end) };
  }

  /**
   * التصاريح المرشّحة للدمج مع هذا العمل.
   * الشرط: الشارع نفسه، ونافذة متداخلة أو تفصلها فجوة أصغر من الحدّ.
   * @returns {Array<object>} الأعضاء الآخرون، بلا العمل نفسه.
   */
  function candidates(feature, all, options) {
    var gapDays = (options && options.gapDays) || MERGE_GAP_DAYS;
    var gapMs = gapDays * 86400000;
    var p = feature.properties;
    var here = windowOf(p);

    return (all || []).filter(function (other) {
      var q = other.properties;
      if (q.id === p.id) return false;
      if (q.street !== p.street) return false;

      var there = windowOf(q);
      if (isNaN(there.from) || isNaN(there.to)) return false;

      var overlaps = there.from < here.to && there.to > here.from;
      if (overlaps) return true;

      var gap = there.from > here.to ? there.from - here.to : here.from - there.to;
      return gap <= gapMs;
    });
  }

  /**
   * يقيّم دمج مجموعة.
   * @param {object} feature العمل المحدَّد
   * @param {Array<object>} others الأعضاء الآخرون
   * @param {function} impactOf يعيد ساعة-مركبة لعمل — يُحقن ليبقى نقياً
   * @param {object} engine AtharEngine
   */
  function evaluate(feature, others, impactOf, engine) {
    var all = [feature].concat(others || []);
    if (all.length < 2) return null;

    /**
     * ما ليس خندقاً لا يدخل حساب الخندق.
     * -------------------------------------------------------------------------
     * بعض السجلات نقاط لا خطوط — نقطة اهتمام أو حادث. طولها صفر، وأقصر
     * الأعضاء يصير صفراً، فيسقط الاقتراح كله بسبب عضو لا يُحفر أصلاً. تُستبعد
     * من الحساب ويُذكر استبعادها: التداخل الزمني معها قائم وإن لم يكن خندقاً.
     */
    var lengths = all.map(function (member) { return lengthKm(member.geometry); });
    var members = all.filter(function (member, at) { return lengths[at] > 0; });
    var excluded = all.length - members.length;

    if (members.length < 2) return null;
    if (lengthKm(feature.geometry) <= 0) return null;

    lengths = members.map(function (member) { return lengthKm(member.geometry); });
    var trenchKm = Math.min.apply(null, lengths);
    if (!(trenchKm > 0)) return null;

    var dig = engine.digOnce({ trenchKm: trenchKm, permitsMerged: members.length });

    var impacts = members.map(function (member) { return Number(impactOf(member)) || 0; });
    var separateVehHours = impacts.reduce(function (sum, value) { return sum + value; }, 0);
    var mergedVehHours = Math.max.apply(null, impacts);

    var windows = members.map(function (member) { return windowOf(member.properties); });
    var from = Math.min.apply(null, windows.map(function (w) { return w.from; }));
    var to = Math.max.apply(null, windows.map(function (w) { return w.to; }));

    var promoters = {};
    members.forEach(function (member) {
      var name = member.properties.promoter || 'جهة غير مسمّاة';
      promoters[name] = true;
    });

    return {
      members: members,
      count: members.length,
      trenchKm: trenchKm,
      longestKm: Math.max.apply(null, lengths),
      street: feature.properties.street,
      // WP-A2: كمية مادية بدل تقدير مالي — وكلاهما عدٌّ لا ادعاء أثر:
      // التصاريح الإضافية عدد، والطول مكافئ يحمل افتراض التداخل معه.
      separateTrenchKm: dig.separateTrenchKm,
      sharedTrenchKm: dig.sharedTrenchKm,
      duplicateTrenchKmEquivalent: dig.duplicateTrenchKmEquivalent,
      additionalPermitsInGroups: dig.additionalPermitsInGroups,
      overlapAssumption: dig.overlapAssumption,
      costNote: dig.costNote,
      separateVehHours: separateVehHours,
      mergedVehHours: mergedVehHours,
      savedVehHours: separateVehHours - mergedVehHours,
      spanFrom: from,
      spanTo: to,
      promoters: Object.keys(promoters),
      excluded: excluded,
    };
  }

  function integer(value) {
    try {
      return new Intl.NumberFormat('ar-SA-u-nu-latn', { maximumFractionDigits: 0 })
        .format(Math.round(value));
    } catch (err) {
      return String(Math.round(value));
    }
  }

  function decimal(value, digits) {
    try {
      return new Intl.NumberFormat('ar-SA-u-nu-latn', {
        minimumFractionDigits: digits, maximumFractionDigits: digits,
      }).format(value);
    } catch (err) {
      return value.toFixed(digits);
    }
  }

  function date(ms) {
    try {
      return new Intl.DateTimeFormat('ar-SA-u-nu-latn', { dateStyle: 'medium' })
        .format(new Date(ms));
    } catch (err) {
      return new Date(ms).toISOString().slice(0, 10);
    }
  }

  /**
   * تمييز العدد بالعربية.
   * ---------------------------------------------------------------------------
   * «2 تصاريح» خطأ يُقرأ فوراً، و«11 تصاريح» مثله. العربية تُفرد وتُثنّي وتجمع
   * جمع قلّة ثم تنصب المفرد تمييزاً بعد العشرة. أداةٌ تدّعي الدقّة في الأرقام
   * ثم تُخطئ في عدّها بلغتها تفقد الادّعاءين معاً.
   */
  function counted(n, forms) {
    if (n === 1) return forms.one;
    if (n === 2) return forms.two;
    if (n >= 3 && n <= 10) return integer(n) + ' ' + forms.few;
    return integer(n) + ' ' + forms.many;
  }

  var PERMIT_FORMS = {
    one: 'تصريح واحد', two: 'تصريحان', few: 'تصاريح', many: 'تصريحاً',
  };
  var BODY_FORMS = { one: 'جهة واحدة', two: 'جهتين', few: 'جهات', many: 'جهة' };

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/[&<>"']/g, function (ch) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
      });
  }

  /** @param {object|null} merge خرج evaluate */
  function render(merge, street) {
    if (!merge) {
      return '<p class="desk-none">لا تعارض على «' + escapeHtml(street)
        + '» في النافذة نفسها، ولا تصريح قريب يستحق الدمج.</p>';
    }

    var refs = merge.members.map(function (member) {
      var p = member.properties;
      return '<li><bdi class="desk-ref">' + escapeHtml(p.permitRef) + '</bdi> · '
        + escapeHtml(p.promoter || 'جهة غير مسمّاة') + ' · '
        + date(Date.parse(p.start)) + ' ← ' + date(Date.parse(p.end)) + '</li>';
    }).join('');

    return '<section class="desk-merge">'
      + '<h3 class="desk-merge-title">مرشّح للحفر مرة واحدة</h3>'
      + '<p class="desk-merge-lead"><strong>' + counted(merge.count, PERMIT_FORMS)
      + '</strong> على «' + escapeHtml(merge.street) + '» بين '
      + date(merge.spanFrom) + ' و' + date(merge.spanTo) + '.</p>'

      + '<ul class="desk-merge-members">' + refs + '</ul>'

      + '<dl class="desk-merge-figures">'
      /* WP-A2: كان هنا نطاق «وفر الحفر … ريال». حُذف لأن مُدخله الوحيد كلفة
         خندق افتراضية لم تكن تُعرض، ومضروبة في نطاق يقول سجل المصادر إنه لا
         يدعم هذا الاستعمال. ما يحلّ محلّه محسوب من بيانات التصريح وحدها. */
      + '<div><dt>تصاريح إضافية في المجموعة</dt><dd><bdi>'
      + integer(merge.additionalPermitsInGroups) + '</bdi> تصريحاً</dd></div>'
      + '<div><dt>طول حفر مكرر مكافئ</dt><dd><bdi>'
      + decimal(merge.duplicateTrenchKmEquivalent, 2) + '</bdi> كم</dd></div>'
      + '<div><dt>وفر التأخير</dt><dd><bdi>' + integer(merge.savedVehHours)
      + '</bdi> ساعة-مركبة</dd></div>'
      + '</dl>'

      + '<p class="desk-merge-cost-note">' + escapeHtml(merge.overlapAssumption)
      + ' ' + escapeHtml(merge.costNote) + '</p>'

      + '<p class="desk-merge-basis">الأساس: خندق مشترك بطول <strong>'
      + decimal(merge.trenchKm, 2) + '</strong> كم — وهو أقصر الأعضاء، لأن أطولها '
      + 'لا يشارك غيره إلا بقدر أقصرها. والتأخير بعد الدمج هو أثر أشدّ الأعضاء '
      + 'وحده (<bdi>' + integer(merge.mergedVehHours) + '</bdi> من <bdi>'
      + integer(merge.separateVehHours) + '</bdi>)، لأن إغلاقاً واحداً يحلّ محل '
      + counted(merge.count, { one: 'واحد', two: 'اثنين', few: 'إغلاقات', many: 'إغلاقاً' })
      + '.</p>'

      + '<div class="desk-merge-verify">'
      + '<p class="desk-merge-verify-title">قبل أن يصير هذا قراراً، يُتحقّق من:</p>'
      + '<ul>'
      + '<li>موافقة ' + (merge.promoters.length > 1
        ? '<strong>' + counted(merge.promoters.length, BODY_FORMS) + '</strong>: '
          + merge.promoters.map(escapeHtml).join('، ')
        : 'الجهة المنفّذة') + '.</li>'
      + '<li>توافق أعماق الخدمات ومواصفات الردم بين الأعضاء.</li>'
      + '<li>أن النافذة المدمجة تسع أطول الأعمال لا أقصرها.</li>'
      + '</ul>'
      + '</div>'

      + (merge.excluded
        ? '<p class="desk-merge-excluded">'
          + counted(merge.excluded, { one: 'سجل واحد', two: 'سجلان', few: 'سجلات', many: 'سجلاً' })
          + ' في النافذة نفسها ليس خندقاً (نقطة اهتمام أو حادث) — '
          + 'خارج حساب الحفر، وتداخله الزمني قائم.</p>'
        : '')
      + '<p class="desk-merge-note">نطاق وفر الحفر من نموذج «احفر مرة واحدة» '
      + 'بحدّيه المعلنين (' + integer(merge.savedPctLow) + '–' + integer(merge.savedPctHigh)
      + '٪). اقتراح للتنسيق لا أمر تنفيذ.</p>'
      + '</section>';
  }

  return {
    candidates: candidates,
    evaluate: evaluate,
    render: render,
    lengthKm: lengthKm,
    counted: counted,
    MERGE_GAP_DAYS: MERGE_GAP_DAYS,
  };
});
