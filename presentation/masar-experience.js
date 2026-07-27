/**
 * مسار — تجربة الجهة.
 * ---------------------------------------------------------------------------
 * واجهة قراءة محلية لسيناريو التنسيق. الحالة في الذاكرة فقط: لا شبكة، لا تخزين،
 * ولا كتابة في ملفات المحفظة. كل رقم يأتي من نموذج الصفحة أو يوسم بوضوح كمقترح.
 */
(function () {
  'use strict';

  var state = {
    coordination: 'new',
    permitFilter: 'all',
    detailsOpen: false,
  };

  var statusLabels = {
    Submitted: 'مستلم',
    CompletenessReview: 'مراجعة الاكتمال',
    ImpactScreening: 'فحص الأثر',
    StrategyReview: 'مراجعة الاستراتيجية',
    CoordinationRequired: 'يحتاج تنسيقاً',
    Approved: 'معتمد',
    Scheduled: 'مجدول',
    Deployed: 'قيد التنفيذ',
  };

  var bucketLabels = {
    action: 'يحتاج إجراء',
    waiting: 'بانتظار خطوة',
    scheduled: 'مجدول',
    coordinated: 'منسق',
  };

  var filterLabels = {
    all: 'الكل',
    action: 'يحتاج إجراء',
    waiting: 'بانتظار خطوة',
    coordinated: 'منسق',
    scheduled: 'مجدول',
  };

  var refs = {};
  var viewModel = null;

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function permitRef(value) {
    return '<bdi class="experience-ref" dir="ltr">' +
      escapeHtml(value) + '</bdi>';
  }

  function number(value) {
    return window.MasarExperienceModel.formatNumber(value);
  }

  function date(value) {
    return window.MasarExperienceModel.formatDate(value);
  }

  function relationLabel(value) {
    if (value === 'ongoing') return 'الفترتان متداخلتان';
    if (value === 'before') return 'عمل المياه يسبق عمل الكهرباء';
    if (value === 'after') return 'عمل الكهرباء يسبق عمل المياه';
    return 'تقارب زمني يحتاج مراجعة';
  }

  function icon(name) {
    var paths = {
      alert:
        '<path d="M12 3 2.8 19h18.4L12 3Z"/>' +
        '<path d="M12 8v5M12 16.5v.1"/>',
      route:
        '<path d="M4 18c4-8 7-10 11-10h5"/>' +
        '<path d="m17 5 3 3-3 3"/><circle cx="4" cy="18" r="2"/>',
      layers:
        '<path d="m12 3 9 5-9 5-9-5 9-5Z"/>' +
        '<path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
      check:
        '<path d="m5 12 4 4L19 6"/>',
      clock:
        '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      building:
        '<path d="M4 21V5l8-3v19M12 8h8v13M8 7v1M8 11v1M8 15v1M16 12v1M16 16v1M2 21h20"/>',
      arrow:
        '<path d="M5 12h14M13 6l6 6-6 6"/>',
      info:
        '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
    };
    return '<svg class="experience-icon" viewBox="0 0 24 24" ' +
      'aria-hidden="true" focusable="false">' + paths[name] + '</svg>';
  }

  function cacheRefs() {
    [
      'experienceSummary',
      'experienceAlert',
      'experienceMap',
      'experienceAction',
      'experienceComparison',
      'experienceAutomation',
      'experiencePermits',
      'experienceCapabilities',
      'experienceLive',
    ].forEach(function (id) {
      refs[id] = document.getElementById(id);
    });
  }

  function renderSummary() {
    var summary = viewModel.summary;
    var items = [
      {
        value: summary.permitCount,
        label: 'تصريح كهرباء في المحفظة',
      },
      {
        value: summary.actionCount,
        label: 'تحتاج إجراءً',
      },
      {
        value: summary.waitingCount,
        label: 'بانتظار خطوة',
      },
      {
        value: summary.coordinationCount,
        label: 'إشعارات تنسيق',
      },
    ];

    refs.experienceSummary.innerHTML = items.map(function (item) {
      return '<div class="experience-summary-item">' +
        '<strong>' + number(item.value) + '</strong>' +
        '<span>' + escapeHtml(item.label) + '</span>' +
        '</div>';
    }).join('');
  }

  function renderAlert() {
    var scenario = viewModel.scenario;
    var current = scenario.current.properties;
    var other = scenario.other.properties;

    refs.experienceAlert.innerHTML =
      '<div class="experience-panel-head">' +
        '<span class="experience-status experience-status-alert">' +
          icon('alert') + 'تنبيه تنسيق جديد' +
        '</span>' +
        '<span class="experience-time">الآن</span>' +
      '</div>' +
      '<div class="experience-alert-title">' +
        '<span class="experience-alert-mark" aria-hidden="true">' +
          icon('route') +
        '</span>' +
        '<div>' +
          '<p class="experience-kicker">فرصة قبل اعتماد الجدول</p>' +
          '<h2>تصريح مياه يلتقي بعملكم على الشارع نفسه</h2>' +
        '</div>' +
      '</div>' +
      '<p class="experience-lead">يمكن للجهتين مراجعة نافذة مشتركة قبل أن يصبح ' +
        'فتح الموقع مرتين أمراً واقعاً.</p>' +
      '<dl class="experience-facts">' +
        '<div><dt>الشارع</dt><dd>' + escapeHtml(current.street) + '</dd></div>' +
        '<div><dt>العلاقة</dt><dd>' +
          escapeHtml(relationLabel(scenario.relation)) + '</dd></div>' +
        '<div><dt>تصريح الكهرباء</dt><dd>' +
          permitRef(current.permitRef) + '</dd></div>' +
        '<div><dt>تصريح المياه</dt><dd>' +
          permitRef(other.permitRef) + '</dd></div>' +
        '<div><dt>نافذة الكهرباء</dt><dd>' +
          escapeHtml(date(current.start)) + ' — ' +
          escapeHtml(date(current.end)) + '</dd></div>' +
        '<div><dt>نافذة المياه</dt><dd>' +
          escapeHtml(date(other.start)) + ' — ' +
          escapeHtml(date(other.end)) + '</dd></div>' +
      '</dl>' +
      '<p class="experience-source-note">' + icon('info') +
        'مطابقة تمثيلية من المحفظة المعروضة، وليست إشعاراً فعلياً من الجهة.' +
      '</p>';
  }

  function renderMap() {
    var scenario = viewModel.scenario;
    var current = scenario.current.properties;
    var other = scenario.other.properties;
    var geometry = scenario.geometry;

    refs.experienceMap.innerHTML =
      '<div class="experience-map-head">' +
        '<div>' +
          '<p class="experience-kicker">لوحة تنسيق الشارع</p>' +
          '<h2>عملان، مقطع واحد، قرار واحد محتمل</h2>' +
        '</div>' +
        '<span class="experience-map-signal">' +
          '<span aria-hidden="true"></span>تداخل نشط' +
        '</span>' +
      '</div>' +
      '<div class="experience-map-canvas">' +
        '<svg viewBox="' + escapeHtml(geometry.viewBox) + '" role="img" ' +
          'aria-labelledby="experienceMapSvgTitle experienceMapSvgDesc">' +
          '<title id="experienceMapSvgTitle">مسارا تصريحي الكهرباء والمياه</title>' +
          '<desc id="experienceMapSvgDesc">إسقاط تمثيلي يوضح تداخل مساري ' +
            'العملين على شارع واحد.</desc>' +
          '<defs>' +
            '<pattern id="experienceGrid" width="32" height="32" ' +
              'patternUnits="userSpaceOnUse">' +
              '<path d="M32 0H0V32" class="experience-map-grid"/>' +
            '</pattern>' +
            '<filter id="experienceGlow" x="-30%" y="-30%" width="160%" height="160%">' +
              '<feGaussianBlur stdDeviation="5" result="blur"/>' +
              '<feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>' +
            '</filter>' +
          '</defs>' +
          '<rect width="640" height="260" rx="16" class="experience-map-field"/>' +
          '<rect width="640" height="260" rx="16" fill="url(#experienceGrid)"/>' +
          '<path d="' + escapeHtml(geometry.otherPath) + '" ' +
            'class="experience-road-underlay"/>' +
          '<path d="' + escapeHtml(geometry.currentPath) + '" ' +
            'class="experience-road-underlay"/>' +
          '<path d="' + escapeHtml(geometry.otherPath) + '" ' +
            'class="experience-route experience-route-water"/>' +
          '<path d="' + escapeHtml(geometry.currentPath) + '" ' +
            'class="experience-route experience-route-electricity"/>' +
          '<path d="M459 233 C520 118 290 60 181 24" ' +
            'class="experience-alert-route" pathLength="1"/>' +
          '<circle cx="459" cy="233" r="7" ' +
            'class="experience-node experience-node-electricity"/>' +
          '<circle cx="181" cy="24" r="7" ' +
            'class="experience-node experience-node-water"/>' +
          '<circle cx="389" cy="210" r="13" ' +
            'class="experience-overlap-glow" filter="url(#experienceGlow)"/>' +
          '<circle cx="389" cy="210" r="5" class="experience-overlap"/>' +
        '</svg>' +
        '<div class="experience-map-card experience-map-card-electricity">' +
          '<span class="experience-entity-dot is-electricity"></span>' +
          '<div><strong>الكهرباء</strong><span>' +
            permitRef(current.permitRef) + '</span></div>' +
        '</div>' +
        '<div class="experience-map-card experience-map-card-water">' +
          '<span class="experience-entity-dot is-water"></span>' +
          '<div><strong>المياه</strong><span>' +
            permitRef(other.permitRef) + '</span></div>' +
        '</div>' +
        '<div class="experience-map-overlap-label">نطاق التداخل</div>' +
      '</div>' +
      '<figcaption class="experience-map-caption">' +
        '<span><i class="experience-legend is-electricity"></i>مسار الكهرباء</span>' +
        '<span><i class="experience-legend is-water"></i>مسار المياه</span>' +
        '<span><i class="experience-legend is-overlap"></i>صلة التنبيه</span>' +
      '</figcaption>';
  }

  function detailsMarkup() {
    if (!state.detailsOpen) return '';
    var scenario = viewModel.scenario;
    return '<div class="experience-action-details" id="experienceActionDetails">' +
      '<h4>ما الذي سيُراجع؟</h4>' +
      '<ul>' +
        '<li>' + icon('check') + 'حدود المقطع المشترك</li>' +
        '<li>' + icon('check') + 'نافذتا التنفيذ للجهتين</li>' +
        '<li>' + icon('check') + 'إمكانية فتح الطريق مرة واحدة</li>' +
        '<li>' + icon('check') + 'قياس الأثر الميداني قبل الاعتماد</li>' +
      '</ul>' +
      '<p>المقترح يخفض مرات الفتح من ' +
        number(scenario.before.openings) + ' إلى ' +
        number(scenario.proposed.openings) +
        '، لكنه لا يحسب أثراً مرورياً جديداً قبل القياس.</p>' +
    '</div>';
  }

  function renderAction() {
    var html =
      '<div class="experience-action-icon">' + icon('building') + '</div>';

    if (state.coordination === 'sent') {
      html +=
        '<span class="experience-status experience-status-success">' +
          icon('check') + 'سُجل داخل العرض' +
        '</span>' +
        '<h2>طلب النافذة المشتركة بانتظار موافقة المياه</h2>' +
        '<p>أصبح التنبيه خطوة متابعة في هذه الجلسة فقط. لم يُرسل أي شيء خارج الصفحة.</p>' +
        '<div class="experience-next-step">' +
          '<span>' + icon('clock') + '</span>' +
          '<div><strong>الخطوة التالية</strong>' +
          '<p>مراجعة نافذة العمل واعتمادها من الجهتين.</p></div>' +
        '</div>' +
        '<button class="experience-button experience-button-quiet" ' +
          'type="button" data-action="review-details" aria-expanded="' +
          String(state.detailsOpen) + '" aria-controls="experienceActionDetails">' +
          'مراجعة التفاصيل' +
        '</button>' +
        '<button class="experience-button experience-button-link" ' +
          'type="button" data-action="reset">إعادة العرض</button>';
    } else if (state.coordination === 'deferred') {
      html +=
        '<span class="experience-status experience-status-muted">مؤجل في هذه الجلسة</span>' +
        '<h2>يبقى التنبيه مفتوحاً قبل اعتماد الجدول</h2>' +
        '<p>يمكن العودة إلى الخطوة الأساسية وطلب نافذة مشتركة متى اكتملت المراجعة.</p>' +
        '<button class="experience-button experience-button-primary" ' +
          'type="button" data-action="request-coordination">' +
          'طلب نافذة مشتركة' + icon('arrow') +
        '</button>' +
        '<button class="experience-button experience-button-link" ' +
          'type="button" data-action="reset">إعادة العرض</button>';
    } else {
      html +=
        '<span class="experience-status experience-status-warning">ينتظر قرارك</span>' +
        '<h2>وحّد النافذة بدل فتح الطريق مرتين</h2>' +
        '<p>ابدأ طلباً تمثيلياً لمراجعة الموعد والمقطع مع شركة المياه الوطنية.</p>' +
        '<button class="experience-button experience-button-primary" ' +
          'type="button" data-action="request-coordination">' +
          'طلب نافذة مشتركة' + icon('arrow') +
        '</button>' +
        '<button class="experience-button experience-button-quiet" ' +
          'type="button" data-action="review-details" aria-expanded="' +
          String(state.detailsOpen) + '" aria-controls="experienceActionDetails">' +
          'مراجعة التفاصيل' +
        '</button>' +
        '<button class="experience-button experience-button-link" ' +
          'type="button" data-action="defer">تأجيل المتابعة</button>';
    }

    refs.experienceAction.innerHTML = html + detailsMarkup();
  }

  function comparisonRow(title, note, before, proposed, formatter, unmeasured) {
    var max = Math.max(Number(before) || 0, Number(proposed) || 0, 1);
    var beforeText = formatter(before);
    var proposedText = unmeasured ? 'غير محسوب' : formatter(proposed);

    return '<article class="experience-comparison-row">' +
      '<div class="experience-comparison-label">' +
        '<h3>' + escapeHtml(title) + '</h3>' +
        '<p>' + escapeHtml(note) + '</p>' +
      '</div>' +
      '<div class="experience-bar-group">' +
        '<div class="experience-bar-line">' +
          '<span>قبل التنسيق</span>' +
          '<meter min="0" max="' + max + '" value="' + Number(before || 0) +
            '"> ' + escapeHtml(beforeText) + '</meter>' +
          '<strong>' + escapeHtml(beforeText) + '</strong>' +
        '</div>' +
        '<div class="experience-bar-line is-proposed">' +
          '<span>المقترح</span>' +
          (unmeasured
            ? '<span class="experience-unmeasured">يلزم قياس ميداني</span>'
            : '<meter min="0" max="' + max + '" value="' +
              Number(proposed || 0) + '">' + escapeHtml(proposedText) +
              '</meter>') +
          '<strong>' + escapeHtml(proposedText) + '</strong>' +
        '</div>' +
      '</div>' +
    '</article>';
  }

  function renderComparison() {
    var scenario = viewModel.scenario;
    refs.experienceComparison.innerHTML =
      '<div class="experience-section-head">' +
        '<div><p class="experience-eyebrow">قراءة القرار</p>' +
        '<h2 id="experienceComparisonTitle">قبل التنسيق والمقترح</h2></div>' +
        '<p>المقارنة تفصل ما اشتُق من الجدول عما لم يحسبه المحرك.</p>' +
      '</div>' +
      '<div class="experience-comparison">' +
        comparisonRow(
          'مرات فتح الطريق',
          'جمع العملين في نافذة واحدة',
          scenario.before.openings,
          scenario.proposed.openings,
          function (value) {
            if (Number(value) === 1) return 'فتحة واحدة';
            if (Number(value) === 2) return 'فتحتان';
            return number(value) + ' فتحات';
          },
          false,
        ) +
        comparisonRow(
          'مدة إشغال الشارع',
          'اتحاد نافذتي العمل بدلاً من جمعهما',
          scenario.before.occupiedDays,
          scenario.proposed.occupiedDays,
          function (value) { return number(value) + ' يوماً'; },
          false,
        ) +
        comparisonRow(
          'أثر الحركة',
          'لا يعتمد المقترح رقماً بلا قياس',
          scenario.before.impactVehHours,
          null,
          function (value) {
            return number(value) + ' ساعة-مركبة';
          },
          true,
        ) +
      '</div>' +
      '<p class="experience-comparison-note">' + icon('info') +
        'النافذة المشتركة مقترح للمراجعة وليست قراراً معتمداً.' +
      '</p>';
  }

  function renderAutomation() {
    var steps = [
      {
        title: 'استلام التصريح',
        text: 'قراءة بيانات الكهرباء والمياه.',
        status: 'done',
      },
      {
        title: 'مطابقة المكان والوقت',
        text: 'اكتشاف الشارع والتداخل الزمني.',
        status: 'done',
      },
      {
        title: 'إرسال التنبيه للجهة',
        text: 'عرض الفرصة قبل اعتماد الجدول.',
        status: state.coordination === 'new' ? 'active' : 'done',
      },
      {
        title: 'طلب نافذة مشتركة',
        text: 'تسجيل قرار موظف الكهرباء.',
        status: state.coordination === 'sent'
          ? 'done'
          : state.coordination === 'deferred' ? 'paused' : 'next',
      },
      {
        title: 'موافقة الجهتين',
        text: 'تثبيت الجدول بعد المراجعة البشرية.',
        status: state.coordination === 'sent' ? 'active' : 'next',
      },
    ];

    refs.experienceAutomation.innerHTML =
      '<div class="experience-section-head">' +
        '<div><p class="experience-eyebrow">رحلة الأتمتة</p>' +
        '<h2 id="experienceAutomationTitle">من التصريح إلى النافذة المشتركة</h2></div>' +
        '<span class="experience-representative">مسار تمثيلي</span>' +
      '</div>' +
      '<ol class="experience-steps">' +
        steps.map(function (step, index) {
          var symbol = step.status === 'done'
            ? icon('check')
            : number(index + 1);
          return '<li class="is-' + step.status + '">' +
            '<span class="experience-step-number">' + symbol + '</span>' +
            '<div><strong>' + escapeHtml(step.title) + '</strong>' +
            '<p>' + escapeHtml(step.text) + '</p></div>' +
          '</li>';
        }).join('') +
      '</ol>';
  }

  function permitsForDisplay() {
    return viewModel.permits.map(function (permit) {
      var item = Object.assign({}, permit);
      if (
        state.coordination === 'sent' &&
        permit.permitRef === viewModel.scenario.current.properties.permitRef
      ) {
        item.bucket = 'waiting';
        item.nextAction = 'انتظر موافقة المياه';
      }
      return item;
    });
  }

  function renderPermits() {
    var permits = permitsForDisplay();
    var counts = permits.reduce(function (result, permit) {
      result[permit.bucket] = (result[permit.bucket] || 0) + 1;
      return result;
    }, { all: permits.length, coordinated: 0 });
    var visible = state.permitFilter === 'all'
      ? permits
      : permits.filter(function (permit) {
        return permit.bucket === state.permitFilter;
      });

    refs.experiencePermits.innerHTML =
      '<div class="experience-section-head">' +
        '<div><p class="experience-eyebrow">محفظة الجهة</p>' +
        '<h2 id="experiencePermitsTitle">ما يحتاج انتباه الكهرباء</h2></div>' +
        '<p>' + number(permits.length) + ' تصاريح مختارة للعرض السريع</p>' +
      '</div>' +
      '<div class="experience-filters" role="group" aria-label="ترشيح التصاريح">' +
        Object.keys(filterLabels).map(function (filter) {
          var selected = state.permitFilter === filter;
          return '<button type="button" data-permit-filter="' + filter + '" ' +
            'aria-pressed="' + String(selected) + '">' +
            escapeHtml(filterLabels[filter]) +
            '<span>' + number(counts[filter] || 0) + '</span>' +
          '</button>';
        }).join('') +
      '</div>' +
      (visible.length
        ? '<div class="experience-permit-list">' +
          visible.map(function (permit) {
            var bucket = permit.bucket;
            return '<article class="experience-permit-card">' +
              '<div class="experience-permit-main">' +
                '<div class="experience-permit-ref">' +
                  permitRef(permit.permitRef) +
                  '<span class="experience-bucket is-' + bucket + '">' +
                    escapeHtml(bucketLabels[bucket]) +
                  '</span>' +
                '</div>' +
                '<h3>' + escapeHtml(permit.street) + '</h3>' +
                '<p>' + escapeHtml(date(permit.start)) + ' — ' +
                  escapeHtml(date(permit.end)) + '</p>' +
              '</div>' +
              '<div class="experience-permit-meta">' +
                '<span>الحالة<strong>' +
                  escapeHtml(statusLabels[permit.status] || permit.status) +
                '</strong></span>' +
                '<span>الإجراء التالي<strong>' +
                  escapeHtml(permit.nextAction) +
                '</strong></span>' +
              '</div>' +
            '</article>';
          }).join('') +
        '</div>'
        : '<div class="experience-empty">' +
          icon('layers') +
          '<h3>لا توجد تصاريح في هذه الحالة</h3>' +
          '<p>لم تدّعِ المحفظة تنسيقاً لم يُثبت في بياناتها.</p>' +
        '</div>');
  }

  function renderCapabilities() {
    refs.experienceCapabilities.innerHTML =
      '<div class="experience-section-head">' +
        '<div><p class="experience-eyebrow">قدرات مسار</p>' +
        '<h2 id="experienceCapabilitiesTitle">من التنبيه إلى قرار يمكن مراجعته</h2></div>' +
        '<p>كل قدرة توضح ما تستقبله وما تنتجه.</p>' +
      '</div>' +
      '<div class="experience-capability-grid">' +
        viewModel.capabilities.map(function (capability, index) {
          return '<article class="experience-capability">' +
            '<span class="experience-capability-index">' +
              number(index + 1) +
            '</span>' +
            '<h3>' + escapeHtml(capability.title) + '</h3>' +
            '<p>' + escapeHtml(capability.purpose) + '</p>' +
            '<dl>' +
              '<div><dt>المدخل</dt><dd>' +
                escapeHtml(capability.input) + '</dd></div>' +
              '<div><dt>المخرج</dt><dd>' +
                escapeHtml(capability.output) + '</dd></div>' +
            '</dl>' +
          '</article>';
        }).join('') +
      '</div>';
  }

  function announce(message) {
    refs.experienceLive.textContent = '';
    window.setTimeout(function () {
      refs.experienceLive.textContent = message;
    }, 20);
  }

  function updateStateMarker() {
    document.body.setAttribute(
      'data-coordination-state',
      state.coordination,
    );
  }

  function renderStateful() {
    updateStateMarker();
    renderAction();
    renderAutomation();
    renderPermits();
  }

  function renderUnavailable() {
    var main = document.getElementById('experienceMain');
    main.innerHTML =
      '<section class="experience-unavailable">' +
        icon('info') +
        '<h1>تعذر إعداد تجربة الجهة</h1>' +
        '<p>لم تصل محفظة العرض أو لم توجد حالة كهرباء ومياه على الشارع نفسه. ' +
          'لم تُنشأ بيانات بديلة.</p>' +
      '</section>';
  }

  function handleAction(action) {
    if (action === 'request-coordination') {
      state.coordination = 'sent';
      state.detailsOpen = false;
      renderStateful();
      announce('سُجل طلب النافذة المشتركة داخل العرض، وهو بانتظار موافقة المياه.');
    } else if (action === 'defer') {
      state.coordination = 'deferred';
      state.detailsOpen = false;
      renderStateful();
      announce('أُجلت متابعة التنبيه داخل هذه الجلسة.');
    } else if (action === 'review-details') {
      state.detailsOpen = !state.detailsOpen;
      renderAction();
      announce(state.detailsOpen ? 'ظهرت تفاصيل المراجعة.' : 'أُغلقت تفاصيل المراجعة.');
    } else if (action === 'reset') {
      state.coordination = 'new';
      state.detailsOpen = false;
      state.permitFilter = 'all';
      renderStateful();
      announce('عادت تجربة التنسيق إلى حالتها الأولى.');
    }
  }

  function bindEvents() {
    document.addEventListener('click', function (event) {
      var actionButton = event.target.closest('[data-action]');
      if (actionButton) {
        handleAction(actionButton.getAttribute('data-action'));
        return;
      }

      var filterButton = event.target.closest('[data-permit-filter]');
      if (filterButton) {
        state.permitFilter = filterButton.getAttribute('data-permit-filter');
        renderPermits();
        announce(
          'عُرضت تصاريح حالة ' + filterLabels[state.permitFilter] + '.',
        );
      }
    });
  }

  function init() {
    cacheRefs();
    if (
      !window.MasarExperienceModel ||
      typeof window.MasarExperienceModel.buildViewModel !== 'function'
    ) {
      renderUnavailable();
      return;
    }

    viewModel = window.MasarExperienceModel.buildViewModel(
      window.MASAR_CITY_PORTFOLIO,
      window.MASAR_DIGONCE_COMPLIANCE,
      {
        currentRef: 'BLD-2026-0077',
        otherRef: 'BLD-2026-0076',
      },
    );

    if (!viewModel.available || !viewModel.scenario) {
      renderUnavailable();
      return;
    }

    renderSummary();
    renderAlert();
    renderMap();
    renderComparison();
    renderCapabilities();
    renderStateful();
    bindEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
