/**
 * أثر — نموذج رحلة المستخدم (UML Activity Diagram).
 * ---------------------------------------------------------------------------
 * تبويب مؤقّت. حذفه سطرٌ في `athar-nav.js` وثلاثة ملفات — لا يمسّ المنتج.
 *
 * القاعدة التي يقوم عليها هذا الملف: **لا عقدة بلا مرجع**. كل نشاط وكل قرار
 * وكل حالة استثنائية هنا تحمل `ref` يشير إلى الملف والرمز الذي ينفّذها فعلاً،
 * ويفشل `journey-test.js` إن أشار مرجعٌ إلى ما ليس في الشيفرة. مخططُ رحلةٍ
 * يصف ما ليس موجوداً أسوأ من غياب المخطط: الأول يوهم بميزة، والثاني يسكت.
 *
 * والعكس محروس كذلك: التبويبات السبعة وحالات الفشل المعلنة في المنتج يجب أن
 * تظهر كلها في المخطط، وإلا فالرحلة تصف منتجاً أصغر من المنتج.
 *
 * التخطيط شبكي: كل عقدة تحمل `lane` (المراجع أو النظام) و`row` و`side`.
 * العمود الجانبي داخل كل مسار مخصّص لفروع الفشل والاستثناء، فيبقى العمود
 * الأوسط هو المسار السعيد — يُقرأ من أعلى إلى أسفل بلا تعرّج.
 *
 * UMD بنفس نمط athar-engine.js.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AtharJourneyModel = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LANES = [
    { id: 'user', label: 'المراجع (المستخدم)' },
    { id: 'system', label: 'النظام (المحرك والمخزن والخادم)' },
  ];

  /**
   * الأنشطة والقرارات بالترتيب.
   * kind: start · end · action (نشاط المستخدم) · system (نشاط النظام) ·
   *       decision (معيّن قرار) · error (حالة استثنائية) · terminal (نهاية فرع)
   */
  var NODES = [
    /* ---- ١) الدخول ---- */
    { id: 'start', lane: 'user', row: 0, kind: 'start', label: 'يفتح المراجع الأداة',
      note: 'athar-desk.html', ref: 'athar-desk.html#desk-shell' },

    { id: 'load', lane: 'system', row: 1, kind: 'system',
      label: 'تحميل المحفظة المحلية — 150 تصريحاً',
      note: 'بلا شبكة: الملف محلي',
      ref: 'athar-desk-boot.js#ATHAR_CITY_PORTFOLIO' },

    { id: 'skeleton', lane: 'system', row: 1, side: true, kind: 'system',
      label: 'هيكل انتظار + غطاء الخريطة',
      note: 'سقف زمني 25 ثانية يرفعه مهما حدث',
      ref: 'athar-desk-boot.js#BOOT_CEILING_MS' },

    { id: 'restore', lane: 'system', row: 2, kind: 'system',
      label: 'استرجاع القرارات المحفوظة وإعادة بناء الحالات',
      note: 'localStorage + سجل القرار',
      ref: 'athar-decision-record.js#restore' },

    { id: 'recall', lane: 'system', row: 3, kind: 'system',
      label: 'استعادة العرض السابق: بحث · حالة · فرز · تبويب',
      ref: 'athar-desk-recall.js#read' },

    { id: 'hasSession', lane: 'system', row: 4, kind: 'decision',
      label: 'جلسة سابقة؟', ref: 'athar-desk-recall.js#resume' },

    { id: 'resumeBar', lane: 'user', row: 5, kind: 'action',
      label: 'شريط الاستئناف: «عُد إلى آخر عمل» أو تجاهل',
      ref: 'athar-desk-boot.js#showResume' },

    /* ---- ٢) اختيار المهمة ---- */
    { id: 'sort', lane: 'system', row: 6, kind: 'system',
      label: 'فرز الصندوق: ما ينتظر قراراً أولاً ثم الأثر تنازلياً',
      ref: 'athar-desk-store.js#SORTERS' },

    { id: 'autoSelect', lane: 'system', row: 7, kind: 'system',
      label: 'تحديد أخطر عمل ينتظر قراراً — بلا انتظار الخريطة',
      ref: 'athar-desk-boot.js#selectInitial' },

    { id: 'mapReady', lane: 'system', row: 8, kind: 'decision',
      label: 'الخريطة جاهزة؟', ref: 'athar-worksmap.js#onReady' },

    { id: 'mapDown', lane: 'system', row: 9, side: true, kind: 'error',
      label: 'تعذّر رسم الخريطة — يُعلَن، والفرز يكمل',
      note: 'حالة استثنائية: غياب WebGL أو فشل أصل',
      ref: 'athar-desk-boot.js#mapUnavailable' },

    { id: 'highlight', lane: 'system', row: 9, kind: 'system',
      label: 'إبراز العمل على الخريطة — بلا طيران',
      ref: 'athar-worksmap.js#highlightWork' },

    /* ---- ٣) إدخال البيانات: الترشيح والبحث ---- */
    { id: 'filter', lane: 'user', row: 10, kind: 'action',
      label: 'بحث · مرشّح حالة · ترتيب',
      note: 'الإدخال الوحيد المطلوب — لا إعادة إدخال بيانات التصريح',
      ref: 'athar-desk-inbox.js#renderToolbar' },

    /* ---- ٤) التحقق من صحة المدخلات ---- */
    { id: 'normalize', lane: 'system', row: 11, kind: 'system',
      label: 'تطبيع نص البحث: همزة · تاء مربوطة · تشكيل · خفض اللاتينية',
      ref: 'athar-worksmap-data.js#normalizeArabic' },

    { id: 'hasResults', lane: 'system', row: 12, kind: 'decision',
      label: 'نتائج مطابقة؟', ref: 'athar-desk-store.js#getVisible' },

    { id: 'noResults', lane: 'system', row: 13, side: true, kind: 'error',
      label: '«لا نتائج مطابقة — وسّع المرشحات أو امسح البحث»',
      note: 'حالة لا نتائج',
      ref: 'athar-desk-inbox.js#renderList' },

    { id: 'pick', lane: 'user', row: 13, kind: 'action',
      label: 'اختيار تصريح: نقر · J/K · لوحة الأوامر · نقر على الخريطة',
      ref: 'athar-desk-boot.js#selectRow' },

    /* ---- ٥+٦) المعالجة والاتصال بالمحرك ---- */
    { id: 'evaluate', lane: 'system', row: 14, kind: 'system',
      label: 'حساب الأثر: BPR على النافذة اليومية + أفضل ثلاث نوافذ على المدة الكلية',
      note: 'مصدر واحد للرقم — نفس ما تعرضه بطاقة الخريطة',
      ref: 'athar-desk-analysis.js#evaluate' },

    { id: 'conflicts', lane: 'system', row: 15, kind: 'system',
      label: 'استرجاع التعارض ومرشّحي الحفر مرة واحدة من المحفظة',
      ref: 'athar-desk-digonce.js#candidates' },

    /* ---- ٧+٨) استرجاع البيانات والتحقق من دقتها ---- */
    { id: 'hasAlt', lane: 'system', row: 16, kind: 'decision',
      label: 'بديل محسوب؟', ref: 'athar-engine.js#optimize' },

    { id: 'abstain', lane: 'system', row: 17, side: true, kind: 'error',
      label: '«لا توصية — البدائل غير محسوبة على هذه المدخلات»',
      note: 'امتناع معلن لا رقم مُخترع',
      ref: 'athar-desk-file.js#renderSummary' },

    { id: 'inRange', lane: 'system', row: 17, kind: 'decision',
      label: 'داخل نطاق الفحص السريع؟',
      ref: 'athar-desk-file.js#desk-beyond' },

    { id: 'beyond', lane: 'system', row: 18, side: true, kind: 'error',
      label: '«خارج نطاق الفحص السريع» — رتبة مقدار للفرز، وثقة منخفضة',
      note: 'نقص دقة معلن',
      ref: 'athar-desk-file.js#desk-units-caveat' },

    /* ---- ٩+١٠) عرض النتيجة الأولية ---- */
    { id: 'file', lane: 'system', row: 19, kind: 'system',
      label: 'ملف القرار: التوصية · الوفر · الأسباب · شريط الثقة وسببها',
      ref: 'athar-desk-file.js#renderConfidence' },

    { id: 'tabs', lane: 'user', row: 20, kind: 'action',
      label: 'قراءة التبويبات: الملخص · الأثر · التعارض · الخطة · التاريخ · النشر · القياس',
      ref: 'athar-desk-file.js#TABS' },

    /* ---- ١١) تفاعل المستخدم مع النتيجة ---- */
    { id: 'measure', lane: 'user', row: 21, side: true, kind: 'action',
      label: 'تبويب القياس: استيراد رصد',
      note: 'أرصاد تركيبية معلَّمة — لا قياس ميداني',
      ref: 'athar-desk-measurement.js#syntheticObservation' },

    { id: 'measurable', lane: 'system', row: 22, side: true, kind: 'decision',
      label: 'العمل نُفِّذ؟', ref: 'athar-desk-measurement.js#isMeasurable' },

    { id: 'notYet', lane: 'system', row: 23, side: true, kind: 'error',
      label: '«لا يُرصد عمل قبل تنفيذه»',
      note: 'بيانات غير متوفرة بعد',
      ref: 'athar-desk-measurement.js#MEASURABLE' },

    { id: 'chooseAction', lane: 'user', row: 21, kind: 'action',
      label: 'اختيار إجراء: اعتماد · إرجاع · تصعيد · تنسيق · نشر · إغلاق…',
      ref: 'athar-desk-states.js#ACTION_LABELS' },

    /* ---- ١٢) التحقق قبل التنفيذ ---- */
    { id: 'guard', lane: 'system', row: 22, kind: 'system',
      label: 'الحارس: انتقال مشروع؟ نسخة مدخلات؟ اتجاه وزمن انتهاء؟ مسارات؟ تواريخ؟',
      ref: 'athar-desk-states.js#guard' },

    { id: 'allowed', lane: 'system', row: 23, kind: 'decision',
      label: 'الإجراء مسموح؟', ref: 'athar-desk-states.js#actionsFor' },

    { id: 'blocked', lane: 'system', row: 24, side: true, kind: 'error',
      label: 'حجب معلَّل: «لا اعتماد بلا نسخة مدخلات» · «لا نشر بلا اتجاه وزمن انتهاء»',
      note: 'إدخال غير صحيح — يُشرح ولا يُنفَّذ',
      ref: 'athar-desk-file.js#renderBlockers' },

    /* ---- ١٣) اعتماد النتيجة ---- */
    { id: 'apply', lane: 'system', row: 25, kind: 'system',
      label: 'نسخة جديدة + حدث تدقيق — لا تعديل بأثر رجعي',
      ref: 'athar-desk-states.js#apply' },

    { id: 'record', lane: 'system', row: 26, kind: 'system',
      label: 'سجل القرار: نسخة المدخلات والتوصية والتوقيع → التخزين المحلي',
      ref: 'athar-decision-record.js#create' },

    { id: 'push', lane: 'system', row: 27, kind: 'system',
      label: 'إرسال إلى الخادم: POST /api/works/:id/decisions',
      ref: 'athar-desk-boot.js#pushToServer' },

    { id: 'serverOk', lane: 'system', row: 28, kind: 'decision',
      label: 'الخادم استجاب؟', ref: 'server.js#validateDecision' },

    { id: 'localOnly', lane: 'system', row: 29, side: true, kind: 'error',
      label: 'فشل الاتصال — القرار محفوظ محلياً والشارة تقوله',
      note: 'فشل مصدر بيانات لا يُسقط القرار',
      ref: 'athar-desk-boot.js#serverLedger' },

    { id: 'confirm', lane: 'system', row: 30, kind: 'system',
      label: 'شريط التأكيد: ✓ المرجع · رقم النسخة · [تراجع] [التالي]',
      ref: 'athar-desk-boot.js#flash' },

    /* ---- ١٤) التعديل أو إعادة المحاولة أو الإنهاء ---- */
    { id: 'after', lane: 'user', row: 31, kind: 'decision',
      label: 'ماذا بعد؟', ref: 'athar-desk-boot.js#stepPending' },

    { id: 'undo', lane: 'user', row: 32, side: true, kind: 'action',
      label: 'تراجع: نسخة معوِّضة تُقيَّد ولا تُمحى',
      ref: 'athar-decision-record.js#createUndo' },

    { id: 'export', lane: 'user', row: 34, side: true, kind: 'action',
      label: 'تصدير: خطة إدارة المرور أو WZDx من النافذة الموصى بها',
      ref: 'athar-desk-boot.js#exportPlan' },

    { id: 'hasWindow', lane: 'system', row: 35, kind: 'decision',
      label: 'نافذة موصى بها؟', ref: 'athar-desk-plan.js#build' },

    { id: 'noWindow', lane: 'system', row: 36, side: true, kind: 'error',
      label: '«لا نافذة موصى بها — الخطة تُبنى منها»',
      note: 'امتناع عن مخرَج لا أساس له',
      ref: 'athar-desk-boot.js#exportPlan' },

    { id: 'next', lane: 'system', row: 32, kind: 'system',
      label: 'العمل التالي الذي ينتظر قراراً — بالتفاف مُعلَن',
      ref: 'athar-desk-store.js#nextPending' },

    { id: 'queueLeft', lane: 'system', row: 33, kind: 'decision',
      label: 'بقي عمل ينتظر؟', ref: 'athar-desk-store.js#DECISION_STATUSES' },

    // في العمود الجانبي: العمود الأوسط ممرُّ «إنهاء» من القرار إلى النهاية،
    // ووضعُ نهاية فرعٍ فيه يجعل السهم يمرّ خلف الشكل.
    { id: 'done', lane: 'user', row: 36, side: true, kind: 'terminal',
      label: '«لا عمل آخر ينتظر قراراً في القائمة المعروضة»',
      ref: 'athar-desk-boot.js#stepPending' },

    { id: 'end', lane: 'user', row: 38, kind: 'end',
      label: 'انتهاء الجلسة — الحالة محفوظة وتُستأنف',
      ref: 'athar-desk-boot.js#saveView' },
  ];

  /**
   * الانتقالات. `back: true` يرسم سهم العودة إلى خطوة سابقة على حافة اللوحة.
   */
  var EDGES = [
    { from: 'start', to: 'load' },
    { from: 'load', to: 'skeleton', label: 'بالتوازي' },
    // الغطاء يبقى حتى يُحسم أمر الخريطة — نجاحاً أو فشلاً أو بالسقف الزمني.
    { from: 'skeleton', to: 'mapReady', label: 'ينتظر الحسم' },
    { from: 'load', to: 'restore' },
    { from: 'restore', to: 'recall' },
    { from: 'recall', to: 'hasSession' },
    { from: 'hasSession', to: 'resumeBar', label: 'نعم' },
    { from: 'hasSession', to: 'sort', label: 'لا' },
    { from: 'resumeBar', to: 'sort' },
    { from: 'sort', to: 'autoSelect' },
    { from: 'autoSelect', to: 'mapReady' },
    { from: 'mapReady', to: 'mapDown', label: 'لا' },
    { from: 'mapReady', to: 'highlight', label: 'نعم' },
    { from: 'mapDown', to: 'filter' },
    { from: 'highlight', to: 'filter' },
    { from: 'filter', to: 'normalize' },
    { from: 'normalize', to: 'hasResults' },
    { from: 'hasResults', to: 'noResults', label: 'لا' },
    { from: 'hasResults', to: 'pick', label: 'نعم' },
    { from: 'noResults', to: 'filter', label: 'عدّل المرشحات', back: true },
    { from: 'pick', to: 'evaluate' },
    { from: 'evaluate', to: 'conflicts' },
    { from: 'conflicts', to: 'hasAlt' },
    { from: 'hasAlt', to: 'abstain', label: 'لا' },
    { from: 'hasAlt', to: 'inRange', label: 'نعم' },
    { from: 'abstain', to: 'file' },
    { from: 'inRange', to: 'beyond', label: 'لا' },
    { from: 'inRange', to: 'file', label: 'نعم' },
    { from: 'beyond', to: 'file' },
    { from: 'file', to: 'tabs' },
    { from: 'tabs', to: 'chooseAction' },
    { from: 'tabs', to: 'measure', label: 'القياس' },
    { from: 'measure', to: 'measurable' },
    { from: 'measurable', to: 'notYet', label: 'لا' },
    { from: 'measurable', to: 'chooseAction', label: 'نعم — يُسجَّل الانحراف' },
    { from: 'notYet', to: 'tabs', label: 'عُد للتبويبات', back: true },
    { from: 'chooseAction', to: 'guard' },
    { from: 'guard', to: 'allowed' },
    { from: 'allowed', to: 'blocked', label: 'لا' },
    { from: 'allowed', to: 'apply', label: 'نعم' },
    { from: 'blocked', to: 'tabs', label: 'صحّح ثم أعد', back: true },
    { from: 'apply', to: 'record' },
    { from: 'record', to: 'push' },
    { from: 'push', to: 'serverOk' },
    { from: 'serverOk', to: 'localOnly', label: 'لا' },
    { from: 'serverOk', to: 'confirm', label: 'نعم' },
    { from: 'localOnly', to: 'confirm' },
    { from: 'confirm', to: 'after' },
    { from: 'after', to: 'undo', label: 'تراجع' },
    { from: 'after', to: 'next', label: 'التالي' },
    { from: 'after', to: 'export', label: 'تصدير' },
    { from: 'after', to: 'end', label: 'إنهاء' },
    { from: 'undo', to: 'confirm', label: 'نسخة معوّضة', back: true },
    { from: 'export', to: 'hasWindow' },
    { from: 'hasWindow', to: 'noWindow', label: 'لا' },
    { from: 'hasWindow', to: 'end', label: 'نعم — يُنزَّل الملف' },
    { from: 'noWindow', to: 'tabs', label: 'راجع المدخلات', back: true },
    { from: 'next', to: 'queueLeft' },
    { from: 'queueLeft', to: 'pick', label: 'نعم', back: true },
    { from: 'queueLeft', to: 'done', label: 'لا' },
    { from: 'done', to: 'end' },
  ];

  /** ما يجب أن يظهر في المخطط لأنه موجود في المنتج — يحرسه الاختبار. */
  var COVERAGE = {
    tabs: ['الملخص', 'الأثر', 'التعارض', 'الخطة', 'التاريخ', 'النشر', 'القياس'],
    exceptions: ['mapDown', 'noResults', 'abstain', 'beyond', 'notYet', 'blocked',
      'localOnly', 'noWindow', 'done'],
  };

  function byId(id) {
    for (var i = 0; i < NODES.length; i += 1) {
      if (NODES[i].id === id) return NODES[i];
    }
    return null;
  }

  /** العقد التي تُبلَغ من البداية — عقدة لا تُبلَغ خطوةٌ لا يصلها أحد. */
  function reachable() {
    var seen = { start: true };
    var frontier = ['start'];
    while (frontier.length) {
      var current = frontier.pop();
      EDGES.forEach(function (edge) {
        if (edge.from !== current || seen[edge.to]) return;
        seen[edge.to] = true;
        frontier.push(edge.to);
      });
    }
    return seen;
  }

  return {
    LANES: LANES,
    NODES: NODES,
    EDGES: EDGES,
    COVERAGE: COVERAGE,
    byId: byId,
    reachable: reachable,
  };
});
