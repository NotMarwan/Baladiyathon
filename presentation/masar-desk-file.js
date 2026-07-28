/**
 * مسار — تصيير ملف القرار.
 * ---------------------------------------------------------------------------
 * 1) كل الدوال نقية تُعيد نصاً — تُختبر في Node بلا DOM.
 * 2) شريط الثقة لا يعرض نسبة مجردة: مستوى + سبب الانخفاض + ما يرفعها + آخر
 *    معايرة. النسبة وحدها ادعاء لا تفسير.
 * 3) البطاقة تمتنع صراحة عن التوصية إذا غاب البديل — «لا توصية» أصدق من رقم.
 * 4) أزرار الإجراء مشتقة من آلة الحالة، فلا تفترق عنها.
 * 5) العوائق تُعرض برسائلها العربية؛ الرمز الداخلي لا يظهر للمستخدم.
 *
 * UMD بنفس نمط masar-engine.js.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./masar-desk-states.js'), require('./masar-desk-inbox.js'));
  } else {
    root.MasarDeskFile = factory(root.MasarDeskStates, root.MasarDeskInbox);
  }
})(typeof self !== 'undefined' ? self : this, function (States, Inbox) {
  'use strict';

  var DASH = '—';
  var escapeHtml = Inbox.escapeHtml;

  var TABS = [
    { id: 'summary', label: 'الملخص' },
    { id: 'impact', label: 'الأثر' },
    { id: 'conflict', label: 'التعارض' },
    { id: 'plan', label: 'الخطة' },
    { id: 'history', label: 'التاريخ' },
    { id: 'publication', label: 'النشر' },
    { id: 'measurement', label: 'القياس' },
  ];

  /* الإجراءات ذات المفاتيح المسمّاة. ما ليس هنا يُنفَّذ بـ D حين يكون وحيداً. */
  var ACTION_KEYS = {
    approve: 'A',
    return: 'R',
    escalate: 'E',
    coordinate: 'C',
    screen: 'S',
  };

  var CONFIDENCE = {
    high: { label: 'عالية', tone: 'success' },
    medium: { label: 'متوسطة', tone: 'warning' },
    low: { label: 'منخفضة', tone: 'danger' },
  };

  function text(value) {
    return value === null || value === undefined || value === '' ? DASH : String(value);
  }

  function number(value) {
    var n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString('ar-SA-u-nu-latn', { maximumFractionDigits: 0 }) : DASH;
  }

  function decimal(value) {
    var n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString('ar-SA-u-nu-latn', { maximumFractionDigits: 1 }) : DASH;
  }

  function longDate(value) {
    var ms = Date.parse(value);
    if (!ms) return DASH;
    try {
      return new Intl.DateTimeFormat('ar-SA-u-nu-latn', { dateStyle: 'medium' }).format(new Date(ms));
    } catch (err) {
      return new Date(ms).toISOString().slice(0, 10);
    }
  }

  function renderEmpty() {
    return '<div class="desk-file-empty">'
      + '<p>اختر عملاً من الصندوق لفتح ملف القرار.</p>'
      + '<p class="desk-hint">الصندوق مرتّب بالأثر تنازلياً — أعلى الصف هو أخطر ما ينتظر قراراً.</p>'
      + '</div>';
  }

  /**
   * أين هذا التصريح من الطريق.
   * ---------------------------------------------------------------------------
   * وسم الحالة يقول ما هو، ولا يقول كم بقي. والمراجع الذي لا يعرف موقعه من
   * المسار لا يعرف إن كان قراره يفتح المرحلة التالية أو ينهي الملف. السطر
   * يقول الاثنين: الرقم من الكل، والاسم، وسببَ الخروج عن المسار إن خرج.
   */
  function renderStage(status) {
    var stage = States.stage(status);
    if (!stage.index) return '';

    return '<p class="desk-stage" data-onpath="' + (stage.onPath ? 'true' : 'false') + '">'
      + '<span class="desk-stage-count">المرحلة ' + stage.index + ' من ' + stage.total + '</span>'
      + '<span class="desk-stage-label">' + escapeHtml(stage.label) + '</span>'
      + (stage.note
        ? '<span class="desk-stage-note">' + escapeHtml(stage.note) + '</span>'
        : '')
      + '</p>';
  }

  function renderHeader(feature) {
    var p = (feature && feature.properties) || {};
    return '<header class="desk-file-head">'
      + '<div class="desk-file-titles">'
      + '<p class="desk-ref">' + escapeHtml(text(p.permitRef)) + '</p>'
      + '<h2>' + escapeHtml(text(p.title)) + '</h2>'
      + '<p class="desk-file-sub">' + escapeHtml(text(p.street))
      + ' · ' + escapeHtml(text(p.promoter)) + '</p>'
      + renderStage(p.status)
      + '</div>'
      + '<div class="desk-file-badges">'
      + Inbox.statusTag(p.status)
      + '<span class="desk-version">نسخة ' + escapeHtml(text(p.version)) + '</span>'
      + '</div>'
      + '</header>';
  }

  function renderTabs(active) {
    var tabs = TABS.map(function (tab) {
      var selected = tab.id === active;
      return '<button type="button" role="tab" class="desk-tab"'
        + ' data-tab="' + escapeHtml(tab.id) + '"'
        + ' aria-selected="' + (selected ? 'true' : 'false') + '"'
        + ' tabindex="' + (selected ? '0' : '-1') + '">'
        + escapeHtml(tab.label) + '</button>';
    }).join('');
    return '<div class="desk-tabs" role="tablist" aria-label="أقسام ملف القرار">' + tabs + '</div>';
  }

  /**
   * لماذا الثقة بهذا المستوى، وما الذي يرفعها. النسبة المجردة لا تساعد مراجعاً
   * يريد أن يعرف هل يعتمد الآن أم ينتظر بيانات.
   */
  function confidenceReasons(p) {
    var reasons = [];
    if (p.escalate && p.escalateReason) reasons.push(p.escalateReason);
    if (Number(p.severity) >= 3) reasons.push('أثر مرتفع ونطاق عدم يقين واسع');
    if (!p.observations) reasons.push('لا قياس ميداني على هذا المحور بعد');
    if (!p.aadt) reasons.push('حجم الحركة تقديري لا مقيس');
    return reasons;
  }

  /**
   * @param {object} feature
   * @param {{n:number, factor:number}} [calibration] حالة سجل المعايرة الحيّة.
   *   حين تُمرَّر، يقول الشريط أين بلغت الحلقة فعلاً بدل نصّ ثابت — فوعد
   *   «ما يرفعها: دورة معايرة» يصير قابلاً للتحقّق من الشاشة نفسها.
   */
  function renderConfidence(feature, calibration) {
    var p = (feature && feature.properties) || {};
    var meta = CONFIDENCE[p.confidence] || { label: DASH, tone: 'muted' };
    var reasons = confidenceReasons(p);

    return '<section class="desk-confidence-bar" data-tone="' + escapeHtml(meta.tone) + '">'
      + '<p class="desk-confidence-level">الثقة: <strong>' + escapeHtml(meta.label) + '</strong></p>'
      + (reasons.length
        ? '<ul class="desk-confidence-why">' + reasons.map(function (reason) {
          return '<li>' + escapeHtml(reason) + '</li>';
        }).join('') + '</ul>'
        : '<p class="desk-confidence-why">لا تحفظ مسجَّل على هذه المدخلات.</p>')
      + '<p class="desk-confidence-lift">ما يرفعها: قياس ميداني للطابور والسرعة على المقطع نفسه، '
      + 'ودورة معايرة واحدة بعد التنفيذ.</p>'
      + renderCalibrationLine(p, calibration)
      + '</section>';
  }

  /** سطر المعايرة: عدد الرصدات ومعاملها، أو غيابها صريحاً. */
  function renderCalibrationLine(p, calibration) {
    if (!calibration || !calibration.n) {
      return '<p class="desk-confidence-cal">آخر معايرة: '
        + escapeHtml(text(p.lastCalibration)) + ' · لا رصدات في السجل بعد.</p>';
    }

    var factor = calibration.factor.toFixed(2);
    return '<p class="desk-confidence-cal">سجل المعايرة: <strong>' + calibration.n
      + '</strong> رصدة · معامل <strong>' + factor + '×</strong>'
      + (calibration.n < 30
        ? ' — دون العتبة، لا يُطبَّق على التقدير المعروض.'
        : ' — بلغ العتبة.')
      + '</p>';
  }

  function renderBlockers(blockers) {
    if (!blockers || !blockers.length) return '';
    var items = blockers.map(function (blocker) {
      return '<li>' + escapeHtml(blocker.message) + '</li>';
    }).join('');
    return '<div class="desk-blockers" role="alert">'
      + '<p class="desk-blockers-title">الإجراء محجوب:</p>'
      + '<ul>' + items + '</ul></div>';
  }

  /**
   * حالة استقرار التوصية — تحت العنوان مباشرة لا في ذيل البطاقة.
   *
   * الموضع قرارٌ لا تنسيق: التوصية تُقرأ في سطرها الأول، ومن يقرؤها ثم يجد
   * بعد ثلاث فقرات أنها تنقلب بافتراض واحد يكون قد قرّر. والامتناع يُعرض
   * **بدل** الثقة لا بجوارها.
   *
   * وغياب الوحدة يعطي «غير مفحوص» لا صمتاً: صمتٌ في موضع الحالة يُقرأ
   * استقراراً.
   */
  function renderStability(stability, switchPoints) {
    if (!stability) {
      return '<p class="desk-stability" data-state="unknown">'
        + 'استقرار التوصية: غير مفحوص على هذه الشاشة.</p>';
    }

    var body = '<p class="desk-stability" data-state="'
      + escapeHtml(text(stability.state)) + '">'
      + '<span class="desk-stability-label">' + escapeHtml(text(stability.label))
      + '</span> — ' + escapeHtml(text(stability.reason)) + '</p>';

    if (!stability.decidable) {
      body += '<p class="desk-abstain">' + escapeHtml(text(stability.abstention)) + '</p>';
      var asks = (stability.flippingAssumptions || []).slice(0, 3)
        .map(function (item) {
          return '<li><span>' + escapeHtml(text(item.label)) + '</span>'
            + '<span class="desk-hint">' + escapeHtml(text(item.dataNeeded)) + '</span></li>';
        }).join('');
      if (asks) {
        body += '<p class="desk-card-label">ما يُطلب كي تصير قابلة للقرار</p>'
          + '<ul class="desk-asks">' + asks + '</ul>';
      }
    }

    /* حجم الأثر يُعلن مدىً حتى مع ترتيب صامد: «مستقرّة» بجوار رقمٍ مفرد
       تجعل القارئ يصدّق الرقم، والرقم هو أضعف ما في النموذج. */
    var magnitude = stability.magnitude;
    if (magnitude && !magnitude.defensible) {
      body += '<p class="desk-hint">حجم الأثر يتحرك '
        + escapeHtml(text(magnitude.worstSwingPct)) + '٪ مع «'
        + escapeHtml(text(magnitude.drivenBy)) + '» — الرقم أدناه مركزُ مدى '
        + 'لا قيمة مثبتة.</p>';
    }

    /* نقطة الانقلاب تُعرض ولا تبقى في المخرَج.
       ---------------------------------------------------------------------
       سؤالٌ وجّهه فريق أحمر مستقل: «صنّفتُ تصريحاً بجوار مستشفى فلم تتغيّر
       الجدولة حرفاً — وزنكم إذاً لا يفعل شيئاً». والجواب ليس رفع معامل يُرضي
       السؤال، فالوزن حكمُ جهةٍ لا قياسُ نموذج، ورقمٌ يُرفع ليقنع محكّماً هو
       أول ما يمنعه هذا المستودع.
       الجواب أن يُقال **عند أي وزن ينقلب هذا القرار بعينه**: فيقرأ المراجع
       الوزن بمداه لا كرقم مُنزَل، ويرى إن كان الفارق هامشاً ضيّقاً أم بعيداً.
       ونقطة انقلاب قريبة إقرارٌ بهشاشة التوصية لا دفاعٌ عنها. */
    /* المفتاح يُترجم ولا يُطبع خاماً: `sensitivity` كلمة شيفرة، والمراجع يقرأ
       عربية. وطباعة اسم الحقل كما هو تكشف الداخل بلا أن تفيد القارئ. */
    var WEIGHT_LABEL = {
      sensitivity: 'حسّاسية الجوار',
      nightPremium: 'علاوة العمل الليلي',
    };
    var points = switchPoints || [];
    var flip = points.filter(function (point) {
      return point && point.key === 'sensitivity';
    })[0] || points[0];
    var flipLabel = flip ? (WEIGHT_LABEL[flip.key] || text(flip.key)) : '';

    if (flip && flip.neverFlips) {
      body += '<p class="desk-hint">ترتيب البدائل لا ينقلب مهما ارتفع وزن «'
        + escapeHtml(flipLabel) + '» — الفارق ليس في هذا الوزن.</p>';
    } else if (flip && typeof flip.weight === 'number' && flip.currentWeight > 0) {
      body += '<p class="desk-hint">وزن «' + escapeHtml(flipLabel)
        + '» الآن ' + escapeHtml(flip.currentWeight.toFixed(1))
        + ' — وتنقلب التوصية عند ' + escapeHtml(flip.weight.toFixed(1))
        + ' (×' + escapeHtml((flip.weight / flip.currentWeight).toFixed(2))
        + '). والوزن تضبطه الجهة، لا النموذج.</p>';
    }

    return body;
  }

  /**
   * الامتناع المسمّى — حين ينقص المدخل لا حين يعجز النموذج.
   * ---------------------------------------------------------------------------
   * «أكمل بيانات الحركة والمسارات» جملةٌ صحيحة لا تُنفَّذ: المراجع الذي يقرؤها
   * لا يعرف أيّ حقلٍ يطلبه من مقدّم الطلب. فالبطاقة تسمّي الحقل الناقص وتقول
   * **ما الذي يسدّه** — والفرق بين الاثنين هو الفرق بين شاشةٍ تشتكي وشاشةٍ
   * تُدار منها مكالمة.
   *
   * وما بقي معلوماً يُعرض معه: نسبة تأخير الرحلة خاصيةُ ساعةٍ لا خاصيةُ مدة،
   * فهي محسوبة ولو غابت المدة. حجبُها مع المحجوب امتناعٌ زائد يُفقر الشاشة
   * بلا سبب.
   */
  function renderIncomplete(p, a) {
    var gap = a.incomplete || {};
    var fields = gap.fields || [];
    var failed = !!gap.failure;

    var items = fields.map(function (item) {
      return '<li><span>' + escapeHtml(text(item.label)) + '</span>'
        + '<span class="desk-hint">' + escapeHtml(text(item.needed)) + '</span></li>';
    }).join('');

    var known = a.scored && Number.isFinite(Number(a.scored.delayPct)) && !p.escalate
      ? '<dl class="desk-figures"><div><dt>تأخير الرحلة على نافذة العمل</dt><dd>'
        + escapeHtml(decimal(a.scored.delayPct)) + '٪</dd></div>'
        + '<div><dt>الإغلاق</dt><dd>' + escapeHtml(text(p.lanesClosed)) + ' من '
        + escapeHtml(text(p.lanes)) + ' مسارات · ' + escapeHtml(text(p.direction))
        + '</dd></div></dl>'
        + '<p class="desk-hint">هذه نسبةُ ساعةٍ من اليوم لا حصيلةَ التصريح — '
        + 'وهي معلومة بلا مدة. حصيلةُ التصريح وحدها هي المحجوبة.</p>'
      : '';

    return '<section class="desk-card desk-card-abstain">'
      + '<p class="desk-card-label">التوصية</p>'
      + '<p class="desk-abstain">لا توصية — '
      + (failed ? 'تعذّر حساب البدائل على هذه المدخلات.' : 'مدخلات ناقصة على هذا التصريح.')
      + '</p>'
      + '<p class="desk-card-label">' + (failed ? 'ما أبلغ به المحرك' : 'ما ينقص') + '</p>'
      + '<ul class="desk-asks">' + items + '</ul>'
      + known
      + '<p class="desk-hint">القرار محجوب حتى تكتمل المدخلات. ولا يُقدَّر رقمٌ '
      + 'مكان بيانٍ غائب — تقديرٌ هنا يدخل سجل القرار نسخةَ مدخلاتٍ ملفَّقة.</p>'
      + '<p class="desk-source">المصدر: محرك مسار (BPR) على هندسة OpenStreetMap · '
      + 'الامتناع قاعدةٌ في وحدة التحليل لا حالةُ واجهة.</p>'
      + '</section>';
  }

  function renderSummary(feature, analysis) {
    var p = (feature && feature.properties) || {};
    var a = analysis || {};
    var best = (a.alternatives || [])[0];

    /* الامتناع المسمّى يسبق الامتناع العام: كلاهما «لا توصية»، وأحدهما يقول
       أيّ حقلٍ يُطلب. تقديم العام يبتلع الخاص. */
    if (a.incomplete && (a.incomplete.fields || []).length) {
      return renderIncomplete(p, a);
    }

    if (!best || !a.scored) {
      return '<section class="desk-card desk-card-abstain">'
        + '<p class="desk-card-label">التوصية</p>'
        + '<p class="desk-abstain">لا توصية — البدائل غير محسوبة على هذه المدخلات.</p>'
        + '<p class="desk-hint">أكمل بيانات الحركة والمسارات ثم أعد الفرز.</p>'
        + '</section>';
    }

    /* السبب قد يصل نصاً جاهزاً من المحرك أو زوجاً {label,value}؛ كلاهما يُعرض. */
    var reasons = (a.reasons || []).slice(0, 3).map(function (reason) {
      if (typeof reason === 'string') return '<li><span>' + escapeHtml(reason) + '</span></li>';
      var value = Number(reason.value);
      return '<li><span>' + escapeHtml(text(reason.label)) + '</span>'
        + (Number.isFinite(value)
          ? '<span class="desk-figure">' + escapeHtml(decimal(value * 100)) + '٪</span>'
          : '') + '</li>';
    }).join('');

    var conflicts = (a.conflicts || []).map(function (conflict) {
      return '<li>تعارض مع ' + escapeHtml(text(conflict.withRef))
        + ' — تداخل ' + escapeHtml(number(conflict.overlapHours)) + ' ساعة</li>';
    }).join('');

    return '<section class="desk-card">'
      + '<p class="desk-card-label">التوصية</p>'
      + '<h3 class="desk-recommend">' + escapeHtml(text(best.label)) + '</h3>'
      + renderStability(a.stability, a.switchPoints)
      + '<dl class="desk-figures">'
      + '<div><dt>الأثر كما طُلب</dt><dd>' + escapeHtml(number(a.scored.delayVehHours))
      + ' ساعة-مركبة</dd></div>'
      /* فوق نطاق الفحص السريع لا يُقدَّم الرقم تقديراً — يُقدَّم إحالة. */
      + '<div><dt>تأخير الرحلة</dt><dd>'
      + (p.escalate
        ? '<span class="desk-beyond">خارج نطاق الفحص السريع</span>'
        : escapeHtml(decimal(a.scored.delayPct)) + '٪')
      + '</dd></div>'
      + '<div><dt>الفرق عن الطلب</dt><dd class="desk-delta">'
      + escapeHtml(a.delta === null || a.delta === undefined ? DASH : decimal(a.delta) + '٪')
      + '</dd></div>'
      + '<div><dt>الإغلاق</dt><dd>' + escapeHtml(text(p.lanesClosed)) + ' من '
      + escapeHtml(text(p.lanes)) + ' مسارات · ' + escapeHtml(text(p.direction)) + '</dd></div>'
      + '<div><dt>النافذة</dt><dd>' + escapeHtml(longDate(p.start)) + ' ← '
      + escapeHtml(longDate(p.end)) + '</dd></div>'
      + '</dl>'
      + (reasons ? '<p class="desk-card-label">أكبر ثلاثة أسباب</p>'
        + '<ul class="desk-reasons">' + reasons + '</ul>' : '')
      + renderAlternateLoad(p.permitRef)
      /* أثرٌ ثم إجراء: طور الإشارة يصف ما يفعله هذا التصريح نفسه، وإشعار
         التنسيق يصف ما يمكن فعله حياله. فالوصف قبل المخرج. */
      + renderSignalPhase(p.permitRef)
      /* إشعار التنسيق — سطر واحد عمداً: هذا الملف يُعدَّل بالتوازي من أكثر من
         جهة، والسطر الواحد يجعل الدمج بلا ألم. والوحدة تُقرأ من المضيف كما
         يُقرأ ملخّص حمل البديل: إن غابت لم يُعرض شيء ولم تسقط البطاقة. */
      + (typeof window === 'object' && window.MasarDeskCoordination ? window.MasarDeskCoordination.notice(p) : '')
      + (conflicts ? '<p class="desk-card-label">التعارض</p>'
        + '<ul class="desk-conflicts">' + conflicts + '</ul>'
        : '<p class="desk-none">لا تعارض على المقطع في النافذة نفسها.</p>')
      + renderUnits(a.units, p.escalate)
      + '<p class="desk-source">المصدر: محرك مسار (BPR) على هندسة OpenStreetMap · '
      + 'قيم الحركة والسعة افتراضات معلنة.</p>'
      + '</section>';
  }

  /**
   * هل يتحمّل البديل الحركة المحوَّلة؟
   *
   * أهمّ سؤال يسأله من يقرأ خطة إغلاق، وكان بلا جواب في هذه البطاقة: إغلاقٌ
   * بديلُه فارغ وإغلاقٌ بديلُه مشبَع يعطيان الرقم نفسه في ساعات-المركبة
   * ويعنيان شيئين مختلفين على الأرض. والجواب كان محسوباً في محرك التوجيه
   * ومعروضاً في الخريطة وحدها — والمراجع يقرّر من هنا.
   *
   * يُقرأ من ملخّص مولَّد لا يُحسب في الصفحة: رسم التوجيه يزيد على اثني عشر
   * ميغابايت. وإن غاب الملخّص لا يُعرض شيء — بطاقةٌ صامتة أصدق من تقدير.
   */
  function renderAlternateLoad(permitRef) {
    var host = (typeof window !== 'undefined' && window) || {};
    var source = (host.MASAR_ALTERNATE_LOAD && host.MASAR_ALTERNATE_LOAD.permits)
      || null;
    var entry = source && source[permitRef];
    if (!entry || !entry.verdict) return '';

    var verdict = entry.verdict;
    if (verdict.key === 'unknown') {
      return '<p class="desk-card-label">هل يتحمّل البديل الحركة؟</p>'
        + '<p class="desk-none">' + escapeHtml(entry.reason || verdict.plain) + '</p>';
    }

    /* النسبة قبل وبعد معاً. «١٫٩» وحدها لا تقول إن الطريق كان مزدحماً أصلاً
       أم أن الإغلاق هو ما أغرقه — والفرق يحدّد هل الحلّ نافذة أخرى أم طريق
       آخر. */
    return '<p class="desk-card-label">هل يتحمّل البديل الحركة؟</p>'
      + '<p class="desk-alt-load is-' + escapeHtml(verdict.key) + '">'
      + '<strong>' + escapeHtml(verdict.label) + '</strong> — '
      + escapeHtml(verdict.plain) + '</p>'
      + '<dl class="desk-figures">'
      + '<div><dt>حِمل البديل قبل التحويل</dt><dd>'
      + escapeHtml(decimal(entry.ratioBefore * 100)) + '٪ من طاقته</dd></div>'
      + '<div><dt>بعد التحويل</dt><dd>'
      + escapeHtml(decimal(entry.ratioAfter * 100)) + '٪ من طاقته</dd></div>'
      + '<div><dt>الحركة المحوَّلة</dt><dd>'
      + escapeHtml(text(entry.divertedVehPerHour)) + ' مركبة/ساعة</dd></div>'
      + (entry.bindingStreet
        ? '<div><dt>أضيق مقطع على البديل</dt><dd>'
          + escapeHtml(entry.bindingStreet) + '</dd></div>'
        : '')
      + '</dl>'
      + neighbourhoodBlock(entry.neighbourhood)
      + '<p class="desk-source">مشتقّ من النموذج عند ساعة مرجعية واحدة — '
      + 'الحركة المحوَّلة مقدَّرة من حصة المسارات المغلقة، والسعة افتراض معلن. '
      + 'لا قياس ميداني.</p>';
  }

  /**
   * أين يقع الحمل — على شبكةٍ بُنيت له، أم أمام البيوت؟
   *
   * «لا يتحمّل» وحدها لا تكفي متخذ القرار: طابورٌ على شريان كلفةٌ على من اختار
   * الطريق، وطابورٌ في حيٍّ كلفةٌ على من لم يختر شيئاً ولم يُسأل. والرقم واحد
   * في الحالين، فيُفصَّل هنا.
   *
   * وحين لا يجنّب الحيَّ أيُّ بديل، فالمعروض ليس مساراً بل **قرار**: هذا
   * الإغلاق بلا بديل مقبول، وتصريفه نافذةٌ أخرى أو إغلاقٌ جزئي أو خطة أخرى —
   * لا طريقٌ آخر. وإخفاء ذلك خلف «استخدم البديل» يحوّل المشكلة إلى حيٍّ سكني
   * بلا إعلان.
   */
  function neighbourhoodBlock(hood) {
    if (!hood || !hood.key || hood.key === 'unknown') return '';
    var head = '<p class="desk-card-label">أين يقع الحمل؟</p>'
      + '<p class="desk-hood is-' + escapeHtml(hood.key) + '">'
      + '<strong>' + escapeHtml(hood.label) + '</strong> — '
      + escapeHtml(hood.plain) + '</p>';
    if (hood.key === 'none') return head;

    /* قبل/بعد على الشارع السكني تحديداً. وهو جوهر ما يعيشه الساكن: الشارع
       لم يكن مزدحماً، والإغلاق هو ما أزدحمه. «بعد» وحدها تُقرأ كأن الحيّ
       كان مزدحماً أصلاً فتُبرّئ الإغلاق. */
    var rows = '<dl class="desk-figures">'
      + '<div><dt>أكثر مقطع سكني تحميلاً — قبل</dt><dd>'
      + escapeHtml(decimal(hood.ratioBefore * 100)) + '٪ من سعته</dd></div>'
      + '<div><dt>بعد التحويل</dt><dd>'
      + escapeHtml(decimal(hood.ratioAfter * 100)) + '٪ من سعته</dd></div>'
      + (hood.bindingStreet
        ? '<div><dt>الشارع السكني المقيِّد</dt><dd>'
          + escapeHtml(hood.bindingStreet) + '</dd></div>'
        : '')
      + '</dl>';

    var decision = hood.sparedByAnyAlternative === false
      ? '<p class="desk-hood-decision">لا بديل مقبول: كل بديل محسوب يدفع '
        + 'شارعاً سكنياً فوق سعته. <strong>هذا الإغلاق قرارٌ لا مسار</strong> — '
        + 'تصريفه نافذةٌ أخرى أو إغلاقٌ جزئي أو تنسيقٌ مع جهةٍ أخرى، لا توجيهُ '
        + 'الحركة إلى الحيّ.</p>'
      : '';
    return head + rows + decision;
  }

  /**
   * طور الإشارة عند إغلاق مدخل — تأخيرٌ لا يظهر في أي نموذج وصلات.
   * ---------------------------------------------------------------------------
   * تقاطعٌ بإشارة يُغلق أحد مداخله. والإشارة تبقى تعمل بخطتها الثابتة فتمنح
   * أخضرَ لمدخلٍ لا تأتي منه مركبة، وذلك الأخضر أحمرُ إضافيّ على المداخل
   * الباقية. فينتظر السائق أطول **لا بسبب الحفر بل بسبب خطة لم يعدّلها أحد**.
   * وهذا ليس في الوصلة حتى يقيسه محرك BPR — هو في التقاطع.
   *
   * **ولا رقم ثوانٍ هنا ولا يمكن أن يكون.** طول الدورة ونسبة الأخضر إلى الدورة
   * غير موجودتين في أي مصدر متاح. فيُعرض مظروفٌ معلَن الافتراض: أدناه صفر
   * (الوضع القائم)، وأعلاه حصة مدخلٍ واحد بافتراض توزيع متساوٍ على الأضلاع.
   *
   * والحالة غير المؤكَّدة تُقال غير مؤكَّدة: مصدرٌ واحد يذكر تقاطعاً ليس
   * إشارة، وغياب عقدة إشارة ليس دليل غيابها. وحيث لا مصدر — صمت.
   */
  function renderSignalPhase(permitRef) {
    var host = (typeof window !== 'undefined' && window) || {};
    var source = (host.MASAR_SIGNAL_PHASE && host.MASAR_SIGNAL_PHASE.permits) || null;
    var entry = source && source[permitRef];
    if (!entry) return '';

    var label = '<p class="desk-card-label">طور الإشارة عند إغلاق مدخل</p>';

    /* مصدرٌ واحد يذكر تقاطعاً: يُقال ذلك ولا تُدّعى إشارة، ولا يُقال «لا
       إشارة» أيضاً — المصدر المجتمعي ناقص التغطية بمقدار مقيس. */
    if (entry.control === 'single-source') {
      return label
        + '<p class="desk-none">التحكّم على هذا المقطع <strong>غير مؤكَّد</strong> — '
        + 'مصدرٌ واحد يذكر تقاطعاً ولا يؤكّده الآخر. ولا يُقرأ ذلك نفياً '
        + 'لوجود إشارة: تغطية المصدر المفتوح ناقصة بمقدار معلوم. '
        + 'فلا توصية توقيت على هذه الحالة.</p>';
    }
    if (entry.control !== 'confirmed') return '';

    var junction = (entry.intersections || [])
      .filter(function (one) { return one.nodeStatus === 'resolved'; })[0]
      || (entry.intersections || [])[0];
    if (!junction) return '';

    /* الإجراء يُقرأ من تحليل النقل حين يكون محمَّلاً: هو الذي يعرف أيَّ مدخلٍ
       يسلكه البديل، فيسمّي الطرفين بدل «نسّق». وإن غاب بقيت البطاقة على
       التوصية العامة — بطاقةٌ أضعف أصدق من بطاقة تسقط. */
    var move = (host.MASAR_SIGNAL_REALLOCATION
      && host.MASAR_SIGNAL_REALLOCATION.permits) || null;
    return label + renderSignalPhaseBody(entry, junction, move && move[permitRef]);
  }

  /** تمييز العدد بالعربية: الثلاثة إلى العشرة جمعٌ، وما فوقها مفردٌ منصوب. */
  function legsPhrase(legs) {
    if (legs === 1) return 'ضلع واحد';
    if (legs === 2) return 'ضلعان';
    if (legs >= 3 && legs <= 10) return number(legs) + ' أضلاع';
    return number(legs) + ' ضلعاً';
  }

  /** التقاطع الحاكم في تحليل النقل — أوّل تقاطع يحمل حالة التصريح نفسها. */
  function movingJunction(move) {
    if (!move || !move.junctions) return null;
    var matching = move.junctions.filter(function (one) {
      return one.action === move.action;
    });
    return matching[0] || move.junctions[0] || null;
  }

  /**
   * صدر البطاقة — والفرق الذي يصنعه تحليل النقل.
   *
   * حين يمرّ البديل بالإشارة نفسها فالحال ليست «أخضرٌ مهدور» وحدها: المدخل
   * المغلق يأخذ أخضراً لا يستعمله، **والمدخل الذي حُوِّلت إليه الحركة يزدحم
   * بأخضرٍ لم يزد**. وهذان وجهان لخطة توقيت واحدة لم تتحرك.
   */
  function signalPhaseLede(move) {
    if (move && move.action === 'reallocate') {
      return '<p class="desk-alt-load is-overflows">'
        + '<strong>الطريق البديل يمرّ بالإشارة نفسها</strong> — فالإشارة تمنح '
        + 'أخضرَ لمدخلٍ مغلق لا تأتي منه مركبة، بينما يزدحم المدخل الذي '
        + 'حُوِّلت إليه الحركة بأخضرٍ لم يزد.</p>';
    }
    if (move && move.action === 'no-waste') {
      return '<p class="desk-alt-load is-unknown">'
        + '<strong>تقاطع بإشارة مؤكَّدة من مصدرين</strong> — والعمل ليس ملاصقاً '
        + 'لخط التوقّف. فالمركبات تخرج من الإشارة وتصطفّ عند العمل: المسألة '
        + 'طابورٌ خلف الحفر لا أخضرٌ مهدور عند الإشارة.</p>';
    }
    return '<p class="desk-alt-load is-overflows">'
      + '<strong>تقاطع بإشارة مؤكَّدة من مصدرين</strong> — هذا العمل يغلق مدخلاً '
      + 'على تقاطع بإشارة. الإشارة ستبقى تمنح أخضرَ لمدخلٍ مغلق ما لم تُعدَّل '
      + 'خطتها، فالانتظار على المداخل الباقية يزيد بلا سبب.</p>';
  }

  /** جسم البطاقة المؤكَّدة: الحال، ثم المظروف، ثم الإجراء أو سببُ سقوطه. */
  function renderSignalPhaseBody(entry, junction, move) {
    var moving = movingJunction(move);
    /* «لا أخضر مهدور» يُسقط المظروف كلَّه. عرضُ مدىً للأخضر المهدور تحت عنوانٍ
       يقول إنه غير مهدور تناقضٌ يُقرأ رقماً — والقارئ يصدّق الرقم. */
    var envelope = (moving && moving.action === 'no-waste')
      ? null
      : (moving && moving.envelope) || junction.envelope;

    var body = signalPhaseLede(move)
      + '<dl class="desk-figures">'
      + '<div><dt>التقاطع</dt><dd>' + escapeHtml(text(junction.name)) + '</dd></div>'
      + '<div><dt>على بُعد</dt><dd>' + escapeHtml(number(junction.intersectionToWorkM))
      + ' متراً من مقطع العمل</dd></div>'
      + '<div><dt>أضلاع ملتقية</dt><dd>'
      + (junction.legs ? escapeHtml(legsPhrase(junction.legs)) : DASH)
      + '</dd></div>'
      + (envelope
        ? '<div><dt>الأخضر المهدور</dt><dd>' + escapeHtml(number(envelope.lowPct))
          + '٪ إلى ' + escapeHtml(number(envelope.highPct)) + '٪ من الدورة</dd></div>'
        : '')
      + (moving && moving.action === 'reallocate' && moving.divertedVehPerHour
        ? '<div><dt>الحركة المحوَّلة إلى مدخل البديل</dt><dd>'
          + escapeHtml(number(moving.divertedVehPerHour)) + ' مركبة/ساعة</dd></div>'
        : '')
      + '</dl>';

    if (envelope) {
      body += '<p class="desk-hint">المدى ليس حساباً: أدناه صفر — لا أحد يعدّل '
        + 'الخطة، وهو الوضع القائم. وأعلاه حصة المدخل المغلق بافتراض توزيع '
        + 'متساوٍ على الأضلاع، وهو افتراض معلن لا قياس. ولا يُحوَّل إلى ثوانٍ: '
        + 'طول الدورة غير منشور في أي مصدر متاح.</p>';
    }

    body += renderSignalAction(entry, moving);

    return body + '<p class="desk-source">التحكّم مؤكَّد من مصدرين مستقلين '
      + '(سجل الهيئة الملكية وعقد OpenStreetMap). وما عدا ذلك مشتقّ من النموذج: '
      + 'عدد الأضلاع من هندسة الشبكة، ومسار البديل ومدخله من محرك التوجيه، '
      + 'والمدى من افتراض توزيع معلن. لا توقيت إشارة في أي مصدر.</p>';
  }

  /**
   * الإجراء — ومداره على تسمية الطرفين.
   *
   * «نسّق إعادة توقيت» بلاغٌ يُحال. و«انقل الأخضر من س إلى ص» أمرُ تشغيل.
   * والفرق كله في الاسمين، فحين يغيب أحدهما تمتنع البطاقة **بسببه المكتوب**
   * ولا تتراجع إلى العبارة العامة — التراجع يخفي أن الحالة اكتُشفت.
   */
  function renderSignalAction(entry, moving) {
    if (!moving) {
      /* تحليل النقل غير محمَّل: التوصية العامة من الطور السابق. */
      var eligible = entry.rule && entry.rule.state === 'eligible';
      if (eligible) {
        return '<p class="desk-card-label">الإجراء</p>'
          + '<p class="desk-alt-load is-overflows"><strong>تنسيق إعادة توقيت مع '
          + 'إدارة المرور قبل بدء العمل.</strong></p>';
      }
      return '<p class="desk-abstain">لا توصية توقيت: '
        + escapeHtml(text(entry.rule && entry.rule.why)) + '</p>';
    }

    if (moving.action === 'no-waste') {
      return '<p class="desk-abstain">لا توصية توقيت: ' + escapeHtml(text(moving.why))
        + '</p>';
    }

    var recommendation = moving.recommendation;
    if (!recommendation || recommendation.blockedBy) {
      return '<p class="desk-abstain">الحالة مكتشَفة والتوصية ممتنعة: '
        + escapeHtml(text(recommendation ? recommendation.blockedBy : moving.why))
        + '.</p>';
    }

    return '<p class="desk-card-label">الإجراء</p>'
      + '<p class="desk-alt-load is-overflows"><strong>'
      + escapeHtml(text(recommendation.label)) + '.</strong></p>'
      + (recommendation.toApproach
        ? '<p class="desk-hint">الأخضر المنقول واحد: ما يخسره «'
          + escapeHtml(text(recommendation.fromApproach)) + '» هو عينه ما يكسبه «'
          + escapeHtml(text(recommendation.toApproach)) + '» — لا مكسبان.</p>'
        : '');
  }

  /**
   * الأثر بوحدات القرار لا بوحدات المرور.
   * «ساعة-مركبة» لا تعني شيئاً لمن يوقّع؛ ساعات الناس والريال والكربون تعني.
   * كل قيمة تُعرض بنطاقها لا برقم واحد: الإشغال وحصة قيمة الوقت واستهلاك الوقود
   * كلها مدى معلن في المحرك، وطيّ المدى إلى رقم واحد ادعاء دقة غير موجودة.
   */
  function renderUnits(units, beyondRange) {
    if (!units) return '';

    var rows = [
      {
        label: 'ساعات الأشخاص',
        value: range(units.personHoursLow, units.personHoursHigh),
        note: 'إشغال ' + decimal(units.occLow) + '–' + decimal(units.occHigh) + ' راكب/مركبة',
      },
      {
        label: 'قيمة الوقت',
        value: units.sarLow === null || units.sarHigh === null
          ? DASH
          : range(units.sarLow, units.sarHigh) + ' ريال',
        note: 'أجر ' + number(units.wageHourlySAR) + ' ريال/ساعة · حصة '
          + Math.round(units.shareLow * 100) + '–' + Math.round(units.shareHigh * 100) + '٪',
      },
      {
        label: 'انبعاثات كربون',
        value: range(units.co2Low, units.co2High) + ' كجم',
        note: 'تباطؤ ووقوف فقط — لا يشمل انبعاثات التنفيذ',
      },
    ];

    return '<p class="desk-card-label">الأثر بوحدات القرار</p>'
      + '<dl class="desk-units">' + rows.map(function (row) {
        return '<div><dt>' + escapeHtml(row.label) + '</dt>'
          + '<dd><span class="desk-figure">' + escapeHtml(row.value) + '</span>'
          + '<span class="desk-unit-note">' + escapeHtml(row.note) + '</span></dd></div>';
      }).join('') + '</dl>'
      // القيم مشتقّة من ساعات-المركبة نفسها؛ فإن خرج أصلها عن النطاق خرجت معه.
      // كتم النسبة وحدها وإبقاء الريال دقيقاً تناقض يُقرأ ثقةً زائفة.
      + (beyondRange
        ? '<p class="desk-beyond desk-units-caveat">مشتقّة من تقدير خارج نطاق الفحص السريع'
          + ' — رتبة مقدار للفرز لا تقدير للاعتماد.</p>'
        : '');
  }

  function range(low, high) {
    if (!Number.isFinite(Number(low)) || !Number.isFinite(Number(high))) return DASH;
    return number(low) + ' – ' + number(high);
  }

  function renderActions(feature) {
    var p = (feature && feature.properties) || {};
    var actions = States.actionsFor(p.status);

    if (!actions.length) {
      return '<p class="desk-actions-none">حالة نهائية — لا إجراء متاح على «'
        + escapeHtml((States.LABELS[p.status] || {}).label || text(p.status)) + '».</p>';
    }

    /* الأول دائماً هو الإجراء الذي يدفع العمل للأمام — ترتيب ACTION_TARGET
       يتبع مسار الأنبوب، فلا حاجة لقائمة يدوية تفترق عنه. */
    /* اختصار كل إجراء يُعرض على زره. الاكتشاف يقع حيث يقع الفعل: مراجع لا
       يفتح لوحة المساعدة يتعلّم المفتاح من الزر الذي يضغطه اليوم. المصدر هو
       ACTION_KEYS هنا لا نسخة ثانية في وحدة المفاتيح. */
    // D يُعرض على الإجراء الوحيد فقط: عرضه حين تتعدّد الإجراءات وعدٌ كاذب،
    // فـ D لا يخمّن بينها ولن يفعل شيئاً.
    var soleAction = actions.length === 1;

    var buttons = actions.map(function (action, index) {
      var primary = index === 0;
      var shortcut = ACTION_KEYS[action] || (soleAction ? 'D' : '');
      return '<button type="button" class="desk-action' + (primary ? ' is-primary' : '') + '"'
        + ' data-action="' + escapeHtml(action) + '">'
        + escapeHtml(States.ACTION_LABELS[action] || action)
        + (shortcut ? ' <kbd>' + shortcut + '</kbd>' : '')
        + '</button>';
    }).join('');

    return '<div class="desk-actions">' + buttons + '</div>';
  }

  function renderAudit(events) {
    if (!events || !events.length) {
      return '<p class="desk-none">لا قرارات مسجَّلة على هذا العمل بعد.</p>';
    }
    var items = events.map(function (event) {
      return '<li class="desk-audit-item">'
        + '<p class="desk-audit-head"><strong>'
        + escapeHtml(States.ACTION_LABELS[event.action] || event.action) + '</strong>'
        + ' · نسخة ' + escapeHtml(text(event.version)) + '</p>'
        + '<p class="desk-audit-move">'
        + escapeHtml((States.LABELS[event.from] || {}).label || text(event.from))
        + ' ← ' + escapeHtml((States.LABELS[event.to] || {}).label || text(event.to)) + '</p>'
        + '<p class="desk-audit-meta">' + escapeHtml(text(event.actor))
        + ' · ' + escapeHtml(longDate(event.at)) + '</p>'
        + (event.reason ? '<p class="desk-audit-reason">' + escapeHtml(event.reason) + '</p>' : '')
        + '</li>';
    }).join('');
    return '<ul class="desk-audit">' + items + '</ul>';
  }

  return {
    renderEmpty: renderEmpty,
    renderHeader: renderHeader,
    renderStage: renderStage,
    renderTabs: renderTabs,
    renderConfidence: renderConfidence,
    renderBlockers: renderBlockers,
    renderSummary: renderSummary,
    renderActions: renderActions,
    renderAudit: renderAudit,
    // يُصدَّر ليبقى ترميز HTML مصدراً واحداً: كل نص يمر من هنا أو لا يمر.
    escapeHtml: escapeHtml,
    ACTION_KEYS: ACTION_KEYS,
    TABS: TABS,
  };
});
