/**
 * مسار — حصيلة جلسة المراجع.
 * ---------------------------------------------------------------------------
 * بعد أن يفرز المراجع ستين عملاً، السؤال الذي يستحق جواباً: ماذا صنعتُ؟
 * والجواب الصادق أضيق من الجواب المُغري.
 *
 * ما نملك قوله:
 *   • كم عملاً مرّ بك، وبأيّ قرارات.
 *   • كم يبلغ الأثر الذي فحصتَه — مجموع ما تطلبه هذه الأعمال من تأخير.
 *   • كم من ذلك **قابل للتفادي** بحسب البديل الذي رجّحه المحرك.
 *
 * ما لا نملك قوله: إن وفراً تحقّق. القرار لا يُنفَّذ على الأسفلت لحظة اتخاذه،
 * والبديل اقتراح لا التزام. لذلك الرقم هنا اسمه «فرق متاح» لا «وفر محقّق»،
 * ولا يتحوّل إلى محقّق إلا بقياس ميداني — وهو ما لم يقع.
 *
 * والأعمال المُصعَّدة تخرج من الحساب المالي كلّه: تقديرها خارج نطاق الفحص
 * السريع، فضمّها إلى رقم بالريال يمنح رتبة مقدار دقّةَ محاسبة.
 *
 * الوحدة نقية: تأخذ سجلات القرار وتعيد أرقاماً. تُختبر في Node بلا DOM.
 * UMD بنفس نمط masar-engine.js.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MasarDeskSession = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function latestOf(records) {
    return (records || []).reduce(function (best, record) {
      return !best || record.version > best.version ? record : best;
    }, null);
  }

  /**
   * @param {object} byWork خريطة workId إلى مصفوفة سجلات.
   * @returns {object} الحصيلة. كل حقل مشتقّ من السجل لا من حالة الشاشة.
   */
  function summarize(byWork) {
    var summary = {
      works: 0,
      decisions: 0,
      actions: {},
      reviewedVehHours: 0,
      headroomVehHours: 0,
      headroomWorks: 0,
      escalatedExcluded: 0,
      conflictsSeen: 0,
      firstAt: null,
      lastAt: null,
    };

    Object.keys(byWork || {}).forEach(function (workId) {
      var records = byWork[workId] || [];
      if (!records.length) return;

      summary.works += 1;
      summary.decisions += records.length;

      records.forEach(function (record) {
        summary.actions[record.action] = (summary.actions[record.action] || 0) + 1;
        if (!record.at) return;
        if (!summary.firstAt || record.at < summary.firstAt) summary.firstAt = record.at;
        if (!summary.lastAt || record.at > summary.lastAt) summary.lastAt = record.at;
      });

      // الأثر يُحسب من آخر نسخة فقط: عمل مرّ بثلاثة قرارات ليس ثلاثة أعمال،
      // وجمع نسخه يضاعف رقماً واحداً بعدد المرات التي لمسه فيها المراجع.
      var latest = latestOf(records);
      if (!latest || !latest.asked) return;

      var asked = Number(latest.asked.delayVehHours) || 0;
      summary.reviewedVehHours += asked;
      summary.conflictsSeen += (latest.conflicts || []).length;

      if (latest.escalated) { summary.escalatedExcluded += 1; return; }

      var recommended = latest.recommendation
        ? Number(latest.recommendation.delayVehHours) : null;
      if (recommended === null || !isFinite(recommended)) return;

      var gap = asked - recommended;
      if (gap <= 0) return;

      summary.headroomVehHours += gap;
      summary.headroomWorks += 1;
    });

    return summary;
  }

  function integer(value) {
    try {
      return new Intl.NumberFormat('ar-SA-u-nu-latn', { maximumFractionDigits: 0 })
        .format(Math.round(value));
    } catch (err) {
      return String(Math.round(value));
    }
  }

  /**
   * نطاق يُكتب بحدّيه دائماً — رقم واحد يوهم بدقّة ليست فيه.
   * كل حدّ في bdi لا ينكسر: قيمة الوقت تبلغ ثمانية أرقام، وكسرها داخل الرقم
   * يصنع رقمين كاذبين؛ الكسر يقع بين الحدّين وحدهما.
   */
  function range(low, high) {
    return '<bdi class="desk-num">' + integer(low) + '</bdi>'
      + ' – <bdi class="desk-num">' + integer(high) + '</bdi>';
  }

  /**
   * @param {object} summary خرج summarize
   * @param {object} engine MasarEngine — للتحويل إلى وحدات القرار
   * @param {number} stillPending ما بقي في الطابور
   */
  function render(summary, engine, stillPending) {
    if (!summary.works) {
      return '<div class="desk-session-card" role="document">'
        + '<h2 id="deskSessionTitle">حصيلتك</h2>'
        + '<p class="desk-session-empty">لم تُقرّر شيئاً بعد في هذه الجلسة. '
        + 'اضغط <kbd>N</kbd> لأول عمل ينتظر قراراً.</p>'
        + '<button type="button" class="desk-help-close" id="deskSessionClose">إغلاق</button>'
        + '</div>';
    }

    var ph = engine.personHours(summary.headroomVehHours);
    var money = engine.timeValueSAR(ph);
    var carbon = engine.co2Range(summary.headroomVehHours);

    return '<div class="desk-session-card" role="document">'
      + '<h2 id="deskSessionTitle">حصيلتك</h2>'

      + '<dl class="desk-session-figures">'
      + '<div><dt>أعمال قرّرتها</dt><dd>' + integer(summary.works) + '</dd></div>'
      + '<div><dt>قرارات مسجّلة</dt><dd>' + integer(summary.decisions) + '</dd></div>'
      + '<div><dt>ما زال ينتظر</dt><dd>' + integer(stillPending || 0) + '</dd></div>'
      + '</dl>'

      + '<p class="desk-session-line">الأثر الذي فحصتَه: <strong>'
      + integer(summary.reviewedVehHours) + '</strong> ساعة-مركبة'
      + (summary.conflictsSeen
        ? ' · و<strong>' + integer(summary.conflictsSeen) + '</strong> تعارضاً ظهر لك'
        : '')
      + '.</p>'

      + '<h3 class="desk-session-sub">فرق متاح — لم يتحقّق بعد</h3>'
      + '<p class="desk-session-note">هذا ما كان البديل الذي رجّحه المحرك سيخفضه على '
      + integer(summary.headroomWorks) + ' عملاً. اقتراحٌ محسوب لا وفرٌ مقيس: '
      + 'لا يصير محقّقاً إلا برصد ميداني بعد التنفيذ.</p>'

      + '<dl class="desk-session-units">'
      + '<div><dt>ساعة-مركبة</dt><dd>' + integer(summary.headroomVehHours) + '</dd></div>'
      + '<div><dt>ساعات أشخاص</dt><dd>'
      + range(ph.lowPersonHours, ph.highPersonHours) + '</dd></div>'
      + '<div><dt>قيمة الوقت (ريال)</dt><dd>'
      + range(money.lowSAR, money.highSAR) + '</dd></div>'
      + '<div><dt>انبعاثات (كجم)</dt><dd>'
      + range(carbon.lowCo2Kg, carbon.highCo2Kg) + '</dd></div>'
      + '</dl>'

      + (summary.escalatedExcluded
        ? '<p class="desk-session-caveat">' + integer(summary.escalatedExcluded)
          + ' عملاً مُصعَّداً خارج هذا الحساب: تقديره خارج نطاق الفحص السريع، '
          + 'وضمّه إلى رقم بالريال يمنح رتبة مقدار دقّةَ محاسبة.</p>'
        : '')

      + '<button type="button" class="desk-help-close" id="deskSessionClose">إغلاق</button>'
      + '</div>';
  }

  /**
   * السطر المختصر في شريط المنتج. يبقى صامتاً قبل أول قرار.
   * حين لا يكون هناك فرق متاح — وهو وارد: بعض الأعمال لا بديل لها أفضل —
   * تعرض الشارة ما تملكه فعلاً بدل صفرٍ صحيحٍ لا يقول شيئاً.
   */
  function renderBadge(summary) {
    if (!summary.works) return '';

    var head = 'قرّرت <strong>' + integer(summary.works) + '</strong> · ';
    return summary.headroomVehHours > 0
      ? head + 'فرق متاح <strong>' + integer(summary.headroomVehHours) + '</strong> ساعة-مركبة'
      : head + 'فحصت <strong>' + integer(summary.reviewedVehHours) + '</strong> ساعة-مركبة';
  }

  return { summarize: summarize, render: render, renderBadge: renderBadge, latestOf: latestOf };
});
