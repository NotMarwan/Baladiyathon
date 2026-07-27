/**
 * مسار — إشعار التنسيق: قبل العقوبة، الإخبار.
 * ---------------------------------------------------------------------------
 * **الشقّ البنّاء، ولماذا هو أولاً.**
 *
 * شركة المياه تحفر شارعاً وتغلقه شهراً، تنتهي فيُفتح، ثم تأتي الكهرباء بعد
 * أيام وتحفر الشارع نفسه. والسبب في الغالب ليس تجاهلاً: **الجهة الثانية لا
 * تعرف**. لا شيء في مسار التصريح يقول لها إن الشارع مشغول، ولا من يشغله، ولا
 * إلى متى.
 *
 * فالإشعار ليس تلطيفاً لمؤشّر الامتثال — هو شرطه السابق. غرامةٌ على جهةٍ لم
 * تُخبَر عقوبةٌ على جهل صنعه النظام. ولذلك يظهر هنا، على البطاقة التي يُفتح
 * فيها الملف، لا في تقرير يُقرأ بعد أن أُغلق الشارع مرتين.
 *
 * **وما يعرضه بلغة غير متخصصة.**
 *
 *   • من يعمل على هذا الشارع، وبأي تواريخ — بالاسم لا بالمرجع وحده.
 *   • علاقة النافذتين: قائم، أم منتهٍ قبل بدئك، أم قادم بعد انتهائك.
 *   • الإجراء: طلب نافذة مشتركة. لا زرّ «ادمج» — الدمج يتطلّب موافقة كل جهة
 *     وتوافق أعماق الخدمات، وقرارٌ لا نملك مدخلاته لا يُعرض كأنه بضغطة.
 *   • حالة هذا التصريح في الكشف الاتجاهيّ، **ومعها استثناؤه إن كان مستثنى** —
 *     «أول على الشارع» و«عمل طارئ» يُعرضان بوضوح كما تُعرض المخالفة، وإلّا
 *     صار غيابُ التبرئة اتهاماً.
 *   • مؤشّر الجهة ببسطه ومقامه معاً. «واحد من ثلاثين» لا «ثلاثة بالمئة».
 *
 * **الحدّ الذي يسافر مع كل رقم هنا.**
 *
 * المحفظة مولَّدة ببذرة ثابتة. الأسماء المعروضة أسماء جهات حقيقية، والسلوك
 * المنسوب إليها **ليس سلوكها** — بل سلوك تصاريح مولَّدة. ومؤشّرٌ يُقرأ حكماً
 * على شركة حقيقية وهو من بيانات مولَّدة ضررٌ لا فائدة، فالحدّ معروض في
 * البطاقة نفسها لا في حاشية بعيدة.
 *
 * **والصياغة قرارٌ لا تنسيق:** «فرص تنسيق فائتة» لا «مخالفات». لوحة العار
 * تدفع الجهة إلى إخفاء الطلب، وأداة التنسيق تدفعها إلى الاتصال بجارها.
 *
 * تُقرأ من ملخّص مولَّد (`data/digonce-compliance.js`). وإن غاب لا يُعرض شيء —
 * بطاقةٌ صامتة أصدق من تقدير.
 *
 * UMD بنفس نمط masar-engine.js.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MasarDeskCoordination = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DASH = '—';

  /** علاقة النافذتين بلغة من يقرأ خطة إغلاق، لا بلغة من كتب الحقل. */
  var RELATIONS = {
    ongoing: {
      label: 'قائم الآن',
      lead: 'نافذتها تتداخل مع نافذتك على الشارع نفسه',
      consequence: 'الشارع مغلق من الجهتين في الوقت نفسه — والسكان يدفعون '
        + 'الثمن مرتين في مرة واحدة.',
    },
    'recently-ended': {
      label: 'انتهى حديثاً',
      lead: 'انتهت من هذا الشارع قبل بدء عملك',
      consequence: 'بدء عملك بعد انتهائهم يغلق الشارع مرة ثانية على السكان — '
        + 'وقد كان مفتوحاً أمامك قبل أيام.',
    },
    upcoming: {
      label: 'قادم',
      lead: 'ستعمل في هذا الشارع بعد انتهاء عملك',
      consequence: 'إن مضى العملان منفصلين أُغلق الشارع مرتين. وهذه هي الحالة '
        + 'الوحيدة التي ما زال بإمكانك أن تلحق بها.',
    },
  };

  /**
   * حالة التصريح في الكشف الاتجاهيّ.
   *
   * الاستثناء يُعرض كما تُعرض المخالفة عمداً: قائمةٌ تذكر المخالفات وتصمت عن
   * المستثنيات تجعل الصمت اتهاماً، وتحرم الجهة من رؤية أن نظامها أنصفها.
   */
  var STATUSES = {
    overlapping: {
      tone: 'danger',
      label: 'فرصة تنسيق فائتة — تداخل زمني',
      plain: 'بدأتَ عملك والخندق ما زال مفتوحاً لجهة أخرى على الشارع نفسه. '
        + 'كان بإمكانك أن تحفر معهم.',
    },
    'missed-window': {
      tone: 'warning',
      label: 'فرصة تنسيق فائتة — نافذة قريبة',
      plain: 'بدأتَ عملك بعد انتهائهم بفجوة قصيرة. كان بإمكانك أن تنضم إلى '
        + 'نافذتهم بدل أن تفتح الشارع مرة أخرى.',
    },
    'exempt-emergency': {
      tone: 'muted',
      label: 'مستثنى — عمل طارئ',
      plain: 'العمل الطارئ لا يُخطَّط، فلا يُحاسب صاحبه على عدم التنسيق. '
        + 'لا تُحسب هذه الحالة على الجهة.',
    },
    'exempt-unplannable-predecessor': {
      tone: 'muted',
      label: 'مستثنى — العمل السابق كان طارئاً',
      plain: 'النافذة السابقة فُتحت طارئةً بلا إعلان مسبق، فلم تكن أمامك نافذة '
        + 'تلحق بها حين خطّطت. لا تُحسب هذه الحالة عليك.',
    },
    'too-far-apart': {
      tone: 'muted',
      label: 'متباعد — لا فرصة تنسيق',
      plain: 'الفجوة أطول من أن يبقى «كان بإمكانك أن تبدأ معهم» قولاً معقولاً.',
    },
    'first-on-street': {
      tone: 'success',
      label: 'الأول على هذا الشارع',
      plain: 'لم يسبقك أحد، فلا شيء كان بإمكانك الانضمام إليه. المؤشّر اتجاهيّ '
        + 'ولا يحاسب الأول.',
    },
    'alone-on-street': {
      tone: 'success',
      label: 'وحيد على هذا الشارع',
      plain: 'لا تصريح آخر على هذا الشارع — لا فرصة تنسيق فائتة.',
    },
    unjudgeable: {
      tone: 'muted',
      label: 'غير قابل للحكم',
      plain: 'ينقص شارعٌ أو تاريخ. الحالة الناقصة بياناتها لا تُحسب مخالفةً — '
        + 'الاستثناء قبل الاتهام.',
    },
  };

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/[&<>"']/g, function (ch) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
      });
  }

  function integer(value) {
    var n = Number(value);
    if (!Number.isFinite(n)) return DASH;
    try {
      return new Intl.NumberFormat('ar-SA-u-nu-latn', { maximumFractionDigits: 0 })
        .format(Math.round(n));
    } catch (err) {
      return String(Math.round(n));
    }
  }

  function date(value) {
    var ms = Date.parse(value);
    if (!ms) return DASH;
    try {
      return new Intl.DateTimeFormat('ar-SA-u-nu-latn', { dateStyle: 'medium' })
        .format(new Date(ms));
    } catch (err) {
      return new Date(ms).toISOString().slice(0, 10);
    }
  }

  /** الملخّص المولَّد، أو `null` إن لم يُحمَّل. لا اختراع بديل عنه. */
  function source(host) {
    var scope = host || (typeof window !== 'undefined' ? window : null) || {};
    var data = scope.MASAR_DIGONCE_COMPLIANCE;
    return data && data.notices && data.permits ? data : null;
  }

  function promoterRow(data, name) {
    return (data.promoters || []).filter(function (row) {
      return row.promoter === name;
    })[0] || null;
  }

  /**
   * سطر واحد لكل عمل آخر على الشارع: من، ومتى، وماذا يعني ذلك.
   * المرجع يُلفّ بـ`bdi` — معرّف لاتيني وسط نصّ عربي ينكسر ترتيبه بلا ذلك.
   */
  function renderOther(other) {
    var relation = RELATIONS[other.relation] || RELATIONS.ongoing;
    var gap = other.relation === 'ongoing'
      ? ''
      : ' (' + integer(other.gapDays) + ' يوماً)';

    return '<li class="desk-coord-other" data-relation='
      + '"' + escapeHtml(other.relation) + '">'
      + '<p class="desk-coord-who"><strong>' + escapeHtml(other.promoter || 'جهة غير مسمّاة')
      + '</strong> ' + escapeHtml(relation.lead) + gap + ' — من '
      + escapeHtml(date(other.start)) + ' إلى ' + escapeHtml(date(other.end))
      + ' <bdi class="desk-ref">' + escapeHtml(other.permitRef) + '</bdi></p>'
      + '<p class="desk-coord-why">' + escapeHtml(relation.consequence) + '</p>'
      + '</li>';
  }

  /**
   * الإشعار كاملاً لتصريح واحد.
   *
   * @param {object} properties خصائص التصريح المفتوح
   * @param {object} [host] مضيف الملخّص — يُحقن في الفحص، ونافذة المتصفح خارجه
   * @returns {string} HTML، أو نصّ فارغ إن غاب الملخّص
   */
  function notice(properties, host) {
    var data = source(host);
    var p = properties || {};
    if (!data || !p.permitRef) return '';

    var entry = data.permits[p.permitRef];
    var context = data.notices[p.permitRef];
    if (!entry || !context) return '';

    var others = context.others || [];
    var status = STATUSES[entry.status] || STATUSES.unjudgeable;
    var row = promoterRow(data, entry.promoter);

    /* لا عمل آخر على الشارع: يُقال صراحةً ولا يُحذف القسم.
       حذفه يجعل «لا شيء» و«لم يُفحص» شكلاً واحداً على الشاشة، وهما مختلفان. */
    if (!others.length) {
      return '<section class="desk-coord" data-state="clear">'
        + '<p class="desk-card-label">تنسيق الشارع</p>'
        + '<p class="desk-none">لا عمل آخر على «' + escapeHtml(p.street || DASH)
        + '» في نافذة ' + integer(data.windowDays) + ' يوماً حول عملك — '
        + 'لا فرصة تنسيق فائتة.</p>'
        + renderLimit(data)
        + '</section>';
    }

    return '<section class="desk-coord" data-state="' + escapeHtml(status.tone) + '">'
      + '<p class="desk-card-label">تنبيه تنسيق</p>'
      + '<p class="desk-coord-lead">على «' + escapeHtml(p.street || DASH)
      + '» ' + escapeHtml(others.length === 1 ? 'عملٌ آخر' : 'أعمال أخرى')
      + ' في نافذة ' + integer(data.windowDays) + ' يوماً حول عملك.</p>'
      + '<ul class="desk-coord-others">' + others.map(renderOther).join('') + '</ul>'
      + '<p class="desk-coord-action"><strong>الإجراء المقترح: طلب نافذة '
      + 'مشتركة.</strong> اقتراحٌ للتنسيق لا أمر تنفيذ — الدمج يتطلّب موافقة '
      + 'كل جهة وتوافق أعماق الخدمات ومواصفات الردم.</p>'
      + renderStatus(status, entry)
      + renderIndicator(row, data)
      + renderLimit(data)
      + '</section>';
  }

  function renderStatus(status, entry) {
    var against = entry.earlierRef
      ? ' مقابل <bdi class="desk-ref">' + escapeHtml(entry.earlierRef) + '</bdi>'
        + ' (' + escapeHtml(entry.earlierPromoter || 'جهة غير مسمّاة') + ')'
      : '';

    return '<p class="desk-card-label">حالة هذا التصريح</p>'
      + '<p class="desk-coord-status" data-tone="' + escapeHtml(status.tone) + '">'
      + '<strong>' + escapeHtml(status.label) + '</strong>' + against + ' — '
      + escapeHtml(status.plain) + '</p>';
  }

  /**
   * مؤشّر الجهة — بالبسط والمقام معاً، دائماً.
   *
   * «٤٠٪ عدم امتثال» من خمس حالات ليست كـ٤٠٪ من خمسين، وإخفاء المقام يصنع
   * رقماً يُساء استعماله. والمقام تصاريح الجهة غير الطارئة: الطوارئ خارج
   * البسط، فبقاؤها في المقام يخفض نسبة من عملها كله طارئ لسبب لا علاقة له
   * بتنسيقها.
   */
  function renderIndicator(row, data) {
    if (!row) return '';
    if (!row.nonEmergencyPermits) {
      return '<p class="desk-card-label">فرص التنسيق الفائتة لهذه الجهة</p>'
        + '<p class="desk-none">كل تصاريح هذه الجهة طارئة — لا مقام، فلا نسبة.</p>';
    }

    return '<p class="desk-card-label">فرص التنسيق الفائتة لهذه الجهة</p>'
      + '<p class="desk-coord-rate"><strong>' + integer(row.missedCases)
      + '</strong> من <strong>' + integer(row.nonEmergencyPermits)
      + '</strong> تصريحاً غير طارئ'
      + (row.ratePct === null ? '' : ' (' + escapeHtml(String(row.ratePct)) + '٪)')
      + '</p>'
      + '<p class="desk-hint">البسط والمقام معاً دائماً: نسبةٌ بلا مقامها رقمٌ '
      + 'يُساء استعماله. و' + integer(row.emergencyPermits) + ' من تصاريح هذه '
      + 'الجهة طارئة، وهي خارج البسط والمقام معاً.</p>'
      + '<p class="desk-hint">الصياغة «فرص تنسيق فائتة» لا «مخالفات»: المؤشّر '
      + 'أداة تنسيق لا لوحة عار، والنظام لا يغرّم — الغرامة صلاحية الجهة '
      + 'البلدية، ولا تعدل إلا إذا أُثبت أن الإشعار وصل. '
      + escapeHtml(labelOfWindow(data)) + '</p>';
  }

  function labelOfWindow(data) {
    return 'وعتبة «النافذة القريبة» ' + integer(data.windowDays)
      + ' يوماً — اصطلاح إداريّ لا قياس.';
  }

  /**
   * الحدّ الحاكم على هذا السطح كله.
   *
   * أسماء الجهات حقيقية والسلوك المنسوب إليها مولَّد. فبلا هذا السطر يُقرأ
   * المؤشّر حكماً على شركة قائمة، وهو ضرر لا فائدة.
   */
  function renderLimit(data) {
    return '<p class="desk-source">' + escapeHtml(data.portfolioLimit || '')
      + ' الأسماء المعروضة أسماء جهات حقيقية، والسلوك المنسوب إليها سلوك '
      + 'تصاريح مولَّدة لا سلوكها. لا قياس ميداني ولا سجلّ تصاريح رسمي.</p>';
  }

  return {
    notice: notice,
    renderIndicator: renderIndicator,
    RELATIONS: RELATIONS,
    STATUSES: STATUSES,
    escapeHtml: escapeHtml,
  };
});
