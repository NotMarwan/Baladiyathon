/**
 * مسار — خطة إدارة المرور: مخرَج ملموس من المكتب.
 * ---------------------------------------------------------------------------
 * تبويب الخطة كان يقول «مسودة تُبنى من البديل الفائز… التصدير متاح في النموذج
 * التفاعلي». إحالةٌ إلى صفحة أخرى ليست مخرَجاً؛ والمراجع الذي اعتمد عملاً
 * يحتاج ورقةً يرسلها للمقاول، لا رابطاً يفتحه.
 *
 * حدّ هذه الوحدة معلن في وجهها: **خطة إدارة المرور الكاملة تحتاج مهندس مرور.**
 * النظام يملك التعريف والنطاق والجدول والأثر — ولا يملك أطوال الانتقال ولا
 * جداول اللوحات ولا مسار التحويلة ولا ترتيب المشاة. اختراع تلك الأرقام كان
 * سيجعل الوثيقة تبدو أكمل وتصير أخطر: مقاولٌ ينفّذ رقماً لم يحسبه أحد.
 *
 * لذلك الوثيقة قسمان صريحان: **ما حسبه النظام** و**ما يستكمله المهندس** —
 * والثاني مكتوب بنداً بنداً لا مذكوراً في هامش.
 *
 * كل شيء هنا نقي: يأخذ عملاً وتحليلاً وختماً زمنياً ويعيد نصاً. لا DOM، ولا
 * Date.now() — الختم يُحقن كي يبقى الخرج قابلاً لإعادة الإنتاج في الاختبار.
 *
 * UMD بنفس نمط masar-engine.js.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MasarDeskPlan = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DASH = '—';

  /**
   * ما لا يملكه النظام ولا يخمّنه.
   * كل بند هنا يحتاج قياساً ميدانياً أو حكماً هندسياً، ولا يُشتقّ من مدخلات
   * التصريح. عرضها كقائمة مفتوحة أصدق من ملئها بقيَم افتراضية تُقرأ كقرار.
   */
  var ENGINEER_ITEMS = [
    'أطوال مناطق الانتقال والتحذير المسبق حسب السرعة التصميمية للمقطع.',
    'جدول اللوحات والمعدّات الإرشادية ومواضعها.',
    'مسار التحويلة وطاقتها الاستيعابية، إن لزمت.',
    'ترتيب حركة المشاة وذوي الإعاقة حول منطقة العمل.',
    'خطة الدخول والخروج لمعدّات المقاول.',
    'إجراءات الطوارئ ومسار مركبات الإسعاف والدفاع المدني.',
  ];

  function text(value) {
    return value === null || value === undefined || value === '' ? DASH : String(value);
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/[&<>"']/g, function (ch) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
      });
  }

  function integer(value) {
    try {
      return new Intl.NumberFormat('ar-SA-u-nu-latn', { maximumFractionDigits: 0 })
        .format(Math.round(value));
    } catch (err) {
      return String(Math.round(value));
    }
  }

  function stamp(iso) {
    if (!iso) return DASH;
    try {
      return new Intl.DateTimeFormat('ar-SA-u-nu-latn', {
        dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC',
      }).format(new Date(iso));
    } catch (err) {
      return String(iso).slice(0, 16).replace('T', ' ');
    }
  }

  function day(iso) {
    if (!iso) return DASH;
    try {
      return new Intl.DateTimeFormat('ar-SA-u-nu-latn', { dateStyle: 'medium' })
        .format(new Date(iso));
    } catch (err) {
      return String(iso).slice(0, 10);
    }
  }

  /**
   * يبني الخطة من العمل وتحليله.
   * @param {object} feature ميزة العمل
   * @param {object} analysis خرج analyze في المكتب
   * @param {string} at ختم التوليد بصيغة ISO — يُحقن ولا يُقرأ من الساعة
   */
  function build(feature, analysis, at) {
    var p = (feature && feature.properties) || {};
    var winner = ((analysis && analysis.alternatives) || [])[0] || null;

    return {
      permitRef: p.permitRef || p.id,
      street: p.street,
      promoter: p.promoter,
      contractor: p.contractor,
      status: p.status,
      version: p.version,
      lanes: p.lanes,
      lanesClosed: p.lanesClosed,
      direction: p.direction,
      start: p.start,
      end: p.end,
      windowHours: p.windowHours,
      workDays: p.workDays,
      recommendation: winner ? winner.label : null,
      reasons: (winner && winner.reasons) || [],
      windows: (winner && winner.windows) || [],
      impactVehHours: analysis && analysis.scored ? analysis.scored.delayVehHours : null,
      level: analysis && analysis.scored ? analysis.scored.level : null,
      confidence: p.confidence,
      escalated: Boolean(p.escalate),
      escalateReason: p.escalateReason || '',
      conflicts: (analysis && analysis.conflicts) || [],
      generatedAt: at || null,
      engineerItems: ENGINEER_ITEMS,
    };
  }

  /** بند «ما حسبه النظام» كصفوف. مُستعمل في التبويب والوثيقة معاً. */
  function computedRows(plan) {
    return [
      ['المرجع', plan.permitRef],
      ['الشارع', plan.street],
      ['الجهة الطالبة', plan.promoter],
      ['المقاول', plan.contractor],
      ['المسارات', plan.lanes],
      ['المغلق منها', plan.lanesClosed],
      ['الاتجاه', plan.direction],
      ['من', day(plan.start)],
      ['إلى', day(plan.end)],
      ['النافذة اليومية', plan.windowHours ? plan.windowHours + ' ساعات' : DASH],
      ['عدد الأيام', plan.workDays],
      ['النافذة الموصى بها', plan.recommendation],
      ['الأثر المقدَّر', plan.impactVehHours === null ? DASH
        : integer(plan.impactVehHours) + ' ساعة-مركبة'],
    ];
  }

  function rowsHtml(rows) {
    return rows.map(function (row) {
      return '<tr><th scope="row">' + escapeHtml(row[0]) + '</th><td>'
        + escapeHtml(text(row[1])) + '</td></tr>';
    }).join('');
  }

  function engineerHtml(plan) {
    return '<ul class="plan-engineer-list">'
      + plan.engineerItems.map(function (item) {
        return '<li>' + escapeHtml(item) + '</li>';
      }).join('')
      + '</ul>';
  }

  /** تبويب الخطة داخل المكتب. */
  function renderTab(plan) {
    if (!plan.recommendation) {
      return '<p class="desk-none">لا بديل مرجَّح على هذا العمل بعد — '
        + 'الخطة تُبنى من النافذة الموصى بها، وهي تُحسب في تبويب الأثر.</p>';
    }

    return '<section class="desk-plan">'
      + '<table class="desk-plan-table"><tbody>' + rowsHtml(computedRows(plan)) + '</tbody></table>'

      + (plan.reasons.length
        ? '<div class="desk-plan-reasons"><p class="desk-plan-sub">سبب النافذة:</p><ul>'
          + plan.reasons.slice(0, 3).map(function (reason) {
            return '<li>' + escapeHtml(typeof reason === 'string' ? reason : reason.label) + '</li>';
          }).join('') + '</ul></div>'
        : '')

      + '<div class="desk-plan-gap">'
      + '<p class="desk-plan-sub">ما يستكمله مهندس المرور — لا يحسبه هذا النظام:</p>'
      + engineerHtml(plan)
      + '</div>'

      + '<div class="desk-plan-actions">'
      + '<button type="button" class="desk-action is-primary" id="deskExportPlan">'
      + 'نزّل خطة إدارة المرور</button>'
      + '<button type="button" class="desk-action" id="deskExportWzdx">'
      + 'نزّل WZDx</button>'
      + '</div>'
      /* WP-WZ3 — العبارة تتبع الدليل، والدليل تحرّك مرتين.
         (WZ1) كانت «تصدير تجريبي… لم يجتز بعد مخطط 4.2» — دقيقة يومها.
         (WZ2) صارت «يجتاز فحصاً بنيوياً داخلياً؛ لم يُشغَّل عليه المحقق
         الرسمي بعد» — دقيقة يومها أيضاً: لم يكن في المستودع `ajv` ولا نسخة
         من المخطط.
         (WZ3) وصارت الآن **غير صحيحة**: المخطط الرسمي مثبَّت من وسم `v4.2`
         بالتزام `42b98fc`، و`build-wzdx-conformance.js` يشغّله على مُخرَج
         المنتج الفعلي. عبارةٌ تنفي إنجازاً محقَّقاً كذبٌ في الاتجاه الآمن —
         وهي في وثيقة تذهب إلى جهة، فيُقرأ منها أن المنتج أضعف مما هو.
         والقيد الباقي حقيقي ويُقال: المتصفح لا يشغّل AJV. ما يعرفه هذا
         السطح أن حرّاس المُصدِّر مرّت؛ والاجتياز الرسمي يثبته التقرير
         المولَّد، ومنه يُقرأ. */
      + '<p class="desk-plan-note">الخطة وثيقة واحدة تُفتح وتُطبع بلا برنامج. '
      + 'وWZDx صيغة تبادل لمناطق العمل تقرؤها أنظمة الملاحة — '
      + '<strong>وهذا تصدير مبنيّ على مخطط WZDx 4.2 الرسمي (التزام '
      + '<code>42b98fc</code>)، اجتازه في تقرير المطابقة المولَّد؛ '
      + 'والمحقق الرسمي لا يعمل داخل المتصفح، فما يضمنه هذا الزرّ هو حرّاس '
      + 'المُصدِّر</strong>.</p>'
      + '</section>';
  }

  /**
   * الوثيقة القابلة للطباعة — HTML مكتفٍ بذاته، بلا ملف تنسيق خارجي ولا خط
   * من الشبكة. تُفتح من القرص كما تُفتح من الخادم.
   */
  function toDocument(plan) {
    var title = 'خطة إدارة المرور — ' + text(plan.permitRef);

    return '<!doctype html>\n<html lang="ar" dir="rtl">\n<head>\n'
      + '<meta charset="utf-8">\n'
      + '<title>' + escapeHtml(title) + '</title>\n'
      + '<style>\n'
      + 'body{font-family:"Noto Sans Arabic",system-ui,sans-serif;color:#15202B;'
      + 'max-width:46rem;margin:2rem auto;padding:0 1.5rem;line-height:1.7}\n'
      + 'h1{font-size:1.35rem;margin-bottom:.25rem}\n'
      + 'h2{font-size:1rem;margin:1.75rem 0 .5rem;padding-top:.75rem;border-top:1px solid #D8DEE4}\n'
      + '.sub{color:#5A6672;font-size:.85rem}\n'
      + 'table{border-collapse:collapse;width:100%;font-size:.9rem}\n'
      + 'th,td{border-bottom:1px solid #D8DEE4;padding:.45rem .6rem;text-align:start}\n'
      + 'th{width:12rem;color:#5A6672;font-weight:600}\n'
      + 'td{font-variant-numeric:tabular-nums}\n'
      + 'ul{margin-inline-start:1.25rem}\n'
      + 'li{margin-bottom:.3rem}\n'
      + '.gap{background:#F4EDE1;border:1px solid #D8DEE4;border-radius:8px;padding:.75rem 1rem}\n'
      + '.gap p{font-weight:700;color:#8C5C1C;margin-bottom:.4rem}\n'
      + '.foot{margin-top:2rem;font-size:.78rem;color:#5A6672}\n'
      + '@media print{body{margin:0}}\n'
      + '</style>\n</head>\n<body>\n'

      + '<h1>' + escapeHtml(title) + '</h1>\n'
      + '<p class="sub">' + escapeHtml(text(plan.street)) + ' · '
      + escapeHtml(text(plan.promoter)) + ' · نسخة ' + escapeHtml(text(plan.version)) + '</p>\n'

      + '<h2>ما حسبه النظام</h2>\n'
      + '<table><tbody>' + rowsHtml(computedRows(plan)) + '</tbody></table>\n'

      + (plan.reasons.length
        ? '<h2>سبب النافذة الموصى بها</h2>\n<ul>'
          + plan.reasons.slice(0, 3).map(function (reason) {
            return '<li>' + escapeHtml(typeof reason === 'string' ? reason : reason.label) + '</li>';
          }).join('') + '</ul>\n'
        : '')

      + (plan.conflicts.length
        ? '<h2>تعارضات على المقطع نفسه</h2>\n<ul>'
          + plan.conflicts.map(function (conflict) {
            return '<li>' + escapeHtml(conflict.withRef) + ' — تداخل '
              + integer(conflict.overlapHours) + ' ساعة</li>';
          }).join('') + '</ul>\n'
        : '')

      + (plan.escalated
        ? '<h2>تنبيه نطاق</h2>\n<p>هذا العمل خارج نطاق الفحص السريع: '
          + escapeHtml(plan.escalateReason)
          + '. الأثر المذكور رتبة مقدار للفرز لا تقدير للاعتماد.</p>\n'
        : '')

      + '<h2>ما يستكمله مهندس المرور</h2>\n'
      + '<div class="gap"><p>البنود التالية لا يحسبها هذا النظام، '
      + 'ولا تكتمل الخطة بدونها:</p>\n' + engineerHtml(plan) + '</div>\n'

      + '<p class="foot">وُلّدت من مكتب المراجع — أثر · '
      + escapeHtml(stamp(plan.generatedAt)) + ' UTC · '
      + 'الأثر من محرك مسار (BPR) على هندسة OpenStreetMap · بيانات توضيحية للعرض.</p>\n'
      + '</body>\n</html>\n';
  }

  /** اسم ملف آمن مشتقّ من المرجع — لا مسارات ولا محارف تكسر نظام الملفات. */
  function fileName(plan, extension) {
    var safe = String(plan.permitRef || 'work').replace(/[^A-Za-z0-9_-]/g, '-');
    return 'masar-' + safe + '.' + extension;
  }

  return {
    build: build,
    renderTab: renderTab,
    toDocument: toDocument,
    computedRows: computedRows,
    fileName: fileName,
    ENGINEER_ITEMS: ENGINEER_ITEMS,
  };
});
