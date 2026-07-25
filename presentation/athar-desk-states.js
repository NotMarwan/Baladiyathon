/**
 * أثر — آلة حالة العمل وحُرّاسها وسجل التدقيق.
 * ---------------------------------------------------------------------------
 * 1) الانتقالات من data-model-and-state-machines.md حرفياً — لا اجتهاد.
 * 2) «القواعد التي لا تُكسر» في تلك الوثيقة صارت هنا حُرّاساً يفشل الاختبار عند
 *    خرقها. قاعدة بلا حارس شعار.
 * 3) apply لا يعدّل الأصل: نسخة جديدة برقم أعلى + حدث تدقيق.
 * 4) الوقت يُحقن من المستدعي — الدالة نقية وقابلة للاختبار بلا Date.now().
 * 5) كل حالة تحمل نبرة ورمزاً ونصاً؛ اللون وحده لا ينقل حالة.
 *
 * UMD بنفس نمط athar-engine.js.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AtharDeskStates = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TRANSITIONS = {
    Draft: ['Submitted'],
    Submitted: ['CompletenessReview'],
    CompletenessReview: ['Returned', 'ImpactScreening'],
    Returned: ['Submitted'],
    ImpactScreening: ['CoordinationRequired', 'SpecialistSimulation', 'StrategyReview'],
    CoordinationRequired: ['ImpactScreening'],
    SpecialistSimulation: ['StrategyReview'],
    StrategyReview: ['Approved', 'Rejected', 'Returned'],
    Approved: ['Scheduled'],
    Scheduled: ['Deployed'],
    Deployed: ['Suspended', 'Completed'],
    Suspended: ['Deployed'],
    Completed: ['ClearanceReview'],
    ClearanceReview: ['Closed'],
    Closed: ['Calibrated'],
    Calibrated: [],
    Rejected: [],
  };

  var LABELS = {
    Draft: { label: 'مسودة', icon: '○', tone: 'muted' },
    Submitted: { label: 'مُرسل', icon: '▸', tone: 'info' },
    CompletenessReview: { label: 'فحص الاكتمال', icon: '⚑', tone: 'warning' },
    Returned: { label: 'مُرجَع', icon: '↩', tone: 'warning' },
    ImpactScreening: { label: 'فرز الأثر', icon: '◈', tone: 'info' },
    CoordinationRequired: { label: 'يحتاج تنسيقاً', icon: '⇄', tone: 'warning' },
    SpecialistSimulation: { label: 'محاكاة متخصصة', icon: '◎', tone: 'info' },
    StrategyReview: { label: 'مراجعة القرار', icon: '◆', tone: 'danger' },
    Approved: { label: 'معتمد', icon: '✓', tone: 'success' },
    Rejected: { label: 'مرفوض', icon: '✕', tone: 'danger' },
    Scheduled: { label: 'مجدول', icon: '⌚', tone: 'success' },
    Deployed: { label: 'قيد التنفيذ', icon: '▣', tone: 'info' },
    Suspended: { label: 'موقوف', icon: '‖', tone: 'warning' },
    Completed: { label: 'منتهٍ', icon: '▤', tone: 'muted' },
    ClearanceReview: { label: 'فحص إعادة الطريق', icon: '⚐', tone: 'info' },
    Closed: { label: 'مغلق', icon: '■', tone: 'muted' },
    Calibrated: { label: 'مُعايَر', icon: '↺', tone: 'success' },
  };

  var NEXT_ACTION = {
    Draft: 'أكمل الطلب',
    Submitted: 'ابدأ فحص الاكتمال',
    CompletenessReview: 'أكمل البيانات الناقصة',
    Returned: 'أعد الإرسال بعد التصحيح',
    ImpactScreening: 'افحص الأثر',
    CoordinationRequired: 'نسّق مع الجهة المتعارضة',
    SpecialistSimulation: 'استلم مؤشرات المحاكاة',
    StrategyReview: 'اعتمد أو أرجع',
    Approved: 'ثبّت الجدول',
    Scheduled: 'انشر الإغلاق',
    Deployed: 'راقب القياس',
    Suspended: 'عالج سبب الإيقاف',
    Completed: 'افحص إعادة الطريق',
    ClearanceReview: 'أغلق العمل',
    Closed: 'شغّل المعايرة',
    Calibrated: 'لا إجراء',
    Rejected: 'لا إجراء',
  };

  /** الإجراء يترجم إلى حالة هدف؛ التوفر يُشتق من TRANSITIONS لا يُكتب يدوياً. */
  var ACTION_TARGET = {
    submit: 'Submitted',
    check: 'CompletenessReview',
    screen: 'StrategyReview',
    coordinate: 'CoordinationRequired',
    rescreen: 'ImpactScreening',
    escalate: 'SpecialistSimulation',
    approve: 'Approved',
    reject: 'Rejected',
    return: 'Returned',
    schedule: 'Scheduled',
    publish: 'Deployed',
    resume: 'Deployed',
    complete: 'Completed',
    suspend: 'Suspended',
    clear: 'ClearanceReview',
    close: 'Closed',
    calibrate: 'Calibrated',
  };

  /**
   * التوجيه مقابل الحكم.
   * ---------------------------------------------------------------------------
   * بعض الإجراءات تنقل العمل إلى المحطة التالية على الأنبوب ولا تقرّر شيئاً في
   * حقّه: «ابدأ فحص الاكتمال» و«ارفع للقرار» و«أعد الفرز بعد التنسيق» و«استأنف».
   * وبعضها حكم يترتّب عليه أثر على الأرض: اعتماد، رفض، إرجاع، تصعيد، جدولة،
   * نشر، إيقاف، إغلاق.
   *
   * التمييز حقيقة في مجال العمل لا تفصيلة واجهة، فمكانه هنا لا في وحدة المفاتيح:
   * أيّ سطح يريد أتمتة خطوة يعرف من هذا الجدول ما يجوز أتمتته وما لا يجوز.
   * قاعدة واحدة تحكمه: ما يمكن أتمتته هو ما لا يندم عليه المراجع.
   */
  var ROUTING_ACTIONS = ['check', 'screen', 'rescreen', 'resume'];

  function isRouting(action) {
    return ROUTING_ACTIONS.indexOf(action) !== -1;
  }

  /**
   * حالتان تصلان إلى Deployed بمعنيين مختلفين: نشر أول من «مجدول»، واستئناف من
   * «موقوف». تقييد المصدر يمنع عرض «نشر الإغلاق» على عمل موقوف أصلاً.
   */
  var ACTION_SOURCES = {
    publish: ['Scheduled'],
    resume: ['Suspended'],
  };

  var ACTION_LABELS = {
    submit: 'إرسال',
    check: 'ابدأ فحص الاكتمال',
    screen: 'ارفع للقرار',
    coordinate: 'أحل للتنسيق',
    rescreen: 'أعد الفرز بعد التنسيق',
    escalate: 'أحل لمحاكاة متخصصة',
    approve: 'اعتماد',
    reject: 'رفض',
    return: 'إرجاع',
    schedule: 'تثبيت الجدول',
    publish: 'نشر الإغلاق',
    resume: 'استئناف',
    suspend: 'إيقاف',
    complete: 'إنهاء',
    clear: 'فحص إعادة الطريق',
    close: 'إغلاق',
    calibrate: 'معايرة',
  };

  function can(from, to) {
    return (TRANSITIONS[from] || []).indexOf(to) !== -1;
  }

  /** الإجراءات المتاحة من حالة ما — مشتقة، فلا تفترق عن الآلة. */
  function actionsFor(status) {
    return Object.keys(ACTION_TARGET).filter(function (action) {
      if (!can(status, ACTION_TARGET[action])) return false;
      var sources = ACTION_SOURCES[action];
      return !sources || sources.indexOf(status) !== -1;
    });
  }

  function blocker(field, reason, message) {
    return { field: field, reason: reason, message: message };
  }

  function labelOf(status) {
    return (LABELS[status] || {}).label || status;
  }

  /**
   * الحُرّاس. كل واحد يقابل بنداً في «قواعد لا تقبل الكسر».
   * الإرجاع والرفض لا يخضعان لحارس اكتمال المدخلات: النقص نفسه سبب الإرجاع.
   */
  function guard(work, action) {
    var blockers = [];
    var target = ACTION_TARGET[action];

    if (!target) {
      return {
        allowed: false,
        blockers: [blocker('action', 'unknown-action', 'إجراء غير معروف: ' + action)],
      };
    }

    if (!can(work.status, target)) {
      blockers.push(blocker('status', 'illegal-transition',
        'لا يمكن الانتقال من «' + labelOf(work.status) + '» إلى «' + labelOf(target) + '».'));
    }

    var isRejection = action === 'return' || action === 'reject';

    if (action === 'approve' && !work.inputsVersion) {
      blockers.push(blocker('inputsVersion', 'snapshot-required',
        'لا اعتماد بلا نسخة مدخلات مثبّتة — النتيجة لن تكون قابلة للتفسير لاحقاً.'));
    }

    if (action === 'publish') {
      if (!work.end) {
        blockers.push(blocker('end', 'end-required',
          'لا ينشر إغلاق بلا زمن انتهاء — القنوات تحتاج موعد رفع النشر.'));
      }
      if (!work.direction) {
        blockers.push(blocker('direction', 'direction-required',
          'لا ينشر إغلاق بلا اتجاه — الملاحة لا تستطيع تفسير مقطع بلا اتجاه.'));
      }
    }

    if (!isRejection) {
      if (Number(work.lanesClosed) > Number(work.lanes)) {
        blockers.push(blocker('lanesClosed', 'exceeds-total',
          'المسارات المغلقة (' + work.lanesClosed + ') تتجاوز الكلية (' + work.lanes + ').'));
      }
      if (work.start && work.end && Date.parse(work.end) <= Date.parse(work.start)) {
        blockers.push(blocker('end', 'end-before-start', 'زمن الانتهاء ليس بعد زمن البدء.'));
      }
    }

    return { allowed: blockers.length === 0, blockers: blockers };
  }

  /** ينتج نسخة جديدة وحدث تدقيق. لا يعدّل الأصل ولا يقرأ الساعة. */
  function apply(work, action, actor, reason, at) {
    var check = guard(work, action);
    if (!check.allowed) {
      throw new Error('blocked: ' + check.blockers.map(function (b) { return b.field; }).join(','));
    }

    var target = ACTION_TARGET[action];
    var next = JSON.parse(JSON.stringify(work));
    next.status = target;
    next.version = Number(work.version || 1) + 1;
    next.nextAction = NEXT_ACTION[target];
    next.decidedAt = at || null;
    next.decidedBy = actor || '';

    return {
      work: next,
      event: {
        entity: work.permitRef || work.id,
        version: next.version,
        action: action,
        from: work.status,
        to: target,
        actor: actor || '',
        reason: reason || '',
        at: at || null,
      },
    };
  }

  function nextAction(status) {
    return NEXT_ACTION[status] || 'راجع';
  }

  return {
    TRANSITIONS: TRANSITIONS,
    LABELS: LABELS,
    ACTION_TARGET: ACTION_TARGET,
    ACTION_LABELS: ACTION_LABELS,
    can: can,
    actionsFor: actionsFor,
    guard: guard,
    apply: apply,
    nextAction: nextAction,
    isRouting: isRouting,
    ROUTING_ACTIONS: ROUTING_ACTIONS,
  };
});
