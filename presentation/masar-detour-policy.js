/**
 * مسار — بوابات سلامة البديل.
 * ---------------------------------------------------------------------------
 * لماذا وُجد هذا الملف: مراجعة يدوية لتصريح على طريق صلاح الدين الأيوبي أظهرت
 * بديلاً موصىً به يخرج بانعطافات يسارٍ غير محمية عند تقاطعات بلا تحكم، ويدفع
 * حركة الإغلاق داخل حيّ سكني لا علاقة لساكنيه بالتصريح.
 *
 * والعيب لم يكن في التوجيه بل في **نوع الحكم**: `masar-city-routing.js` يجعل
 * الانعطاف الخطر *مكلفاً* (اليسار ١١ ثانية) فيفضَّل غيره حين يوجد — لكنه لا
 * يرفضه أبداً حين يكون الأرخص. والكلفة تصلح للمفاضلة لا للسلامة: انعطافٌ
 * يقطع تياراً معاكساً عند تقاطع بلا إشارة ليس «أبطأ بإحدى عشرة ثانية»، بل
 * موضعُ تصادمٍ لا يُشترى بوفر زمن. وكذلك `minorOverflows`: يُحسب ويُعاد في
 * المخرجات ولا يمنع التوصية.
 *
 * فهذه الوحدة تضيف الطبقة الناقصة: **بوابات صلبة تُصدر حكماً مسمّىً بسببه**،
 * لا وزناً يذوب في مجموع. البديل يمرّ أو يُعلَّل رفضه، وحين لا يمرّ بديلٌ
 * واحد يُقال ذلك صراحةً (`escalate`) — والجواب حينها تعديل التصريح نفسه
 * (انظر `masar-closure-ladder.js`) لا قبول مسارٍ سيّئ.
 *
 * قاعدة «الحساب له مصدر واحد» محفوظة: لا معادلة مرورية هنا. الأحمال تُقرأ من
 * `loadRoute` القائمة، والهندسة (زوايا، تحكم، أصناف) تُقرأ من رسم
 * `masar-city-routing.js` بنفس اصطلاحاته — عدٌّ وقراءة، لا اشتقاق.
 *
 * UMD بنمط المحرك. نقية: تأخذ `prepared` وناتج `alternativesAround` وتعيد
 * نسخة مزيَّنة — لا DOM ولا حالة.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(function () { return require('./masar-city-routing.js'); });
  } else {
    root.MasarDetourPolicy = factory(function () { return root.MasarCityRouting; });
  }
})(typeof self !== 'undefined' ? self : this, function (loadRouting) {
  'use strict';

  /**
   * التبعية تُحَلّ عند أول استعمال لا عند التحميل، كي لا يفرض هذا الملف
   * ترتيبَ وسوم `<script>` على الصفحات — خطأُ ترتيبٍ صامت يظهر عند المستخدم
   * لا في الاختبار.
   */
  var Routing = null;
  function routing() {
    if (!Routing) Routing = loadRouting();
    return Routing;
  }

  // ---------------------------------------------------------------------
  // العتبات — كلها افتراضات معلنة قابلة للتجاوز عبر `options`
  // ---------------------------------------------------------------------

  var DEFAULTS = {
    /**
     * الاندماج الحاد: انحرافٌ مطلق فوق هذه الزاوية عند الدخول إلى طريق سريع
     * بلا تحكم. افتراض توضيحي للعرض — الأدلة الهندسية تفضّل زوايا تقاطع
     * قريبة من التعامد وتعدّ ما جاوز ذلك اندماجاً بزاوية ضيقة يضعف الرؤية،
     * ولا رقم سعودي منشور يحسمها، فالعتبة معلنة هنا وتسافر مع كل مخالفة.
     */
    sharpMergeDeg: 100,
    /**
     * «طريق سريع» لغرض بوابتي الاندماج واليسار: سرعة تصنيفٍ من هذا الحد
     * فأعلى. افتراض توضيحي للعرض — يلتقط الشرايين في جدول أصناف الرسم.
     */
    fastKmh: 60,
    /**
     * اليسار غير المحمي يقطع التيار المقابل، فخطره من الطريق المقطوع لا من
     * سرعة المنعطِف. البوابة تعمل حين يكون أيٌّ من ضلعي الانعطاف غير سكني
     * (بحسب `isMinorClass`) والعقدة بلا أي تحكم. داخل الشبكة السكنية الصرفة
     * يبقى اليسار مقبولاً — منعه هناك يمنع كل تحويلة حيّ عملياً.
     */
    failUnprotectedLeft: true,
    /** الدوران الكامل عند عقدة بلا تحكم — تحذير لا رفض: قد يكون منعطف شارع خلفي مقبولاً. */
    warnUncontrolledUTurn: true,
  };

  /** أسماء القواعد — ثابتة كي تُختبر وتُترجم في الواجهة من موضع واحد. */
  var RULES = {
    UNPROTECTED_LEFT: 'unprotected-left',
    SHARP_MERGE: 'sharp-merge',
    U_TURN: 'u-turn',
    RESIDENTIAL_OVERFLOW: 'residential-overflow',
    ARTERIAL_OVERFLOW: 'arterial-overflow',
    CLASS_DROP: 'class-drop',
  };

  /** درجات الحكم مرتّبةً — القياس عليها لا على سلاسل متناثرة. */
  var VERDICTS = { PASS: 'pass', WARN: 'warn', FAIL: 'fail' };

  /**
   * انحراف الانعطاف بين حالتين متجهتين — نفس تعريف `turnMinutes` حرفاً:
   * اتجاه الوصول هو عكس الاتجاه الخارج من رأس ضلع الوصول، والسالب يسار.
   * (اُثبت الاصطلاح بقياسٍ مباشر: شرقٌ ثم شمالٌ يعطي −٩٠ ويُحاسَب يساراً.)
   */
  function junctionDelta(graph, arrive, leave) {
    var arriveEdge = graph.edges[arrive >> 1];
    var leaveEdge = graph.edges[leave >> 1];
    var arriveHeading = ((arrive & 1) === 1 ? arriveEdge[7] : arriveEdge[8]) + 180;
    var leaveHeading = (leave & 1) === 0 ? leaveEdge[7] : leaveEdge[8];
    return routing().angleDelta(leaveHeading, arriveHeading);
  }

  /** اسم شارع الضلع أو فراغ — قراءة نفس تخطيط بيانات الرسم. */
  function streetOf(graph, edgeIndex) {
    var ref = graph.edges[edgeIndex][9];
    if (ref === undefined || ref < 0) return '';
    return (graph.names || [])[ref] || '';
  }

  /** مستوى التحكم في عقدة: 0 لا شيء، 1 قف، 2 إشارة. */
  function controlLevel(prepared, node) {
    if (!prepared.control) return 0;
    return prepared.control[node] || 0;
  }

  /** سرعة تصنيف الضلع من جدول أصناف الرسم. */
  function kmhOf(prepared, edgeIndex) {
    var profile = routing().classOf(prepared, prepared.graph.edges[edgeIndex]);
    return profile.kmh || 0;
  }

  /** هل الضلع غير سكني؟ (شريان أو مجمّع — ما يعبر الناسَ لا ما يسكنونه) */
  function isMajor(prepared, edgeIndex) {
    return !routing().isMinorClass(prepared, prepared.graph.edges[edgeIndex]);
  }

  /**
   * فحص هندسة مسارٍ واحد: يمشي على أزواج الحالات المتجهة ويجمع المخالفات.
   * ---------------------------------------------------------------------------
   * كل مخالفة تحمل موضعها (عقدة وإحداثيات وشارعين) كي تُرسم وتُقرأ، وسببها
   * نصاً — بديلٌ مرفوض بلا «أين ولماذا» لا يُصلح تصريحاً.
   */
  function geometryViolations(prepared, states, opts) {
    var graph = prepared.graph;
    var turn = prepared.turn;
    var out = [];
    if (!states || states.length < 2) return out;

    for (var i = 1; i < states.length; i += 1) {
      var arrive = states[i - 1];
      var leave = states[i];
      var node = routing().tailOf(graph, leave);
      var level = controlLevel(prepared, node);
      if (level !== 0) continue; // إشارة أو «قف» يحميان الحركة — البوابات هنا للعقد العارية

      var delta = junctionDelta(graph, arrive, leave);
      var magnitude = Math.abs(delta);
      if (magnitude <= turn.straightDeg) continue;

      var arriveEdge = arrive >> 1;
      var leaveEdge = leave >> 1;
      var place = {
        node: node,
        at: graph.nodes[node],
        from: streetOf(graph, arriveEdge),
        to: streetOf(graph, leaveEdge),
      };

      if (magnitude >= turn.uTurnDeg) {
        if (opts.warnUncontrolledUTurn) {
          out.push(violation(RULES.U_TURN, VERDICTS.WARN, place,
            'دوران كامل عند تقاطع بلا تحكم'));
        }
        continue;
      }

      var majorInvolved = isMajor(prepared, arriveEdge) || isMajor(prepared, leaveEdge);
      if (opts.failUnprotectedLeft && delta < 0 && majorInvolved) {
        out.push(violation(RULES.UNPROTECTED_LEFT, VERDICTS.FAIL, place,
          'يسار غير محمي يقطع التيار المقابل عند تقاطع بلا إشارة'));
        continue;
      }

      if (magnitude >= opts.sharpMergeDeg && kmhOf(prepared, leaveEdge) >= opts.fastKmh) {
        out.push(violation(RULES.SHARP_MERGE, VERDICTS.FAIL, place,
          'اندماج بزاوية حادة (' + Math.round(magnitude) + '°) في طريق سريع بلا تحكم'));
      }
    }
    return out;
  }

  /**
   * بوابات الحمل — قراءةُ ما حسبه `loadRoute` أصلاً، لا حسابٌ جديد.
   * فيضان الشارع السكني رفضٌ: من يسكنه لم يطلب التصريح ولا سُئل عنه.
   * فيضان الشريان تحذير: الطريق بُني ليحمل، والطابور عليه كلفةٌ لا خطر.
   */
  function loadViolations(route) {
    var out = [];
    var load = route.load;
    if (!load) return out;
    if (load.minorOverflows) {
      out.push(violation(RULES.RESIDENTIAL_OVERFLOW, VERDICTS.FAIL,
        { street: load.minorBindingStreet || '' },
        'الحركة المحوَّلة تتجاوز سعة شارع سكني'
        + (load.minorBindingStreet ? ' — ' + load.minorBindingStreet : '')
        + ' (النسبة ' + ratioText(load.minorMaxRatioAfter) + ')'));
    } else if (load.overflows) {
      out.push(violation(RULES.ARTERIAL_OVERFLOW, VERDICTS.WARN,
        { street: load.bindingStreet || '' },
        'البديل يتجاوز سعته بعد التحويل'
        + (load.bindingStreet ? ' — ' + load.bindingStreet : '')
        + ' (النسبة ' + ratioText(load.maxRatioAfter) + ')'));
    }
    return out;
  }

  /**
   * هبوط الدرجة: إغلاقٌ على طريق غير سكني وبديله يدخل حيّاً دخولاً متصلاً.
   * تحذيرٌ لا رفض — فالتحويلة المحلية أحياناً هي الجواب الصحيح المقصود
   * (هدف `local` كله مبني عليها)، والرفض هنا يقع حين **يفيض** الحيّ لا حين
   * يُستعمل. البوابة تُعلِم القارئ أن حركة شريانٍ ستمرّ بين البيوت.
   */
  function classDropViolation(route, closedMajor) {
    if (!closedMajor || !route.insideNeighbourhood) return null;
    var streets = (route.excursion && route.excursion.streets) || [];
    return violation(RULES.CLASS_DROP, VERDICTS.WARN,
      { streets: streets },
      'إغلاق شرياني يُحوَّل عبر شوارع حيّ'
      + (streets.length ? ' — ' + streets.join('، ') : ''));
  }

  function violation(rule, severity, place, text) {
    return { rule: rule, severity: severity, place: place, text: text };
  }

  function ratioText(ratio) {
    if (!isFinite(ratio)) return '∞';
    return (Math.round(ratio * 100) / 100).toString();
  }

  /** الحكم من المخالفات: أي رفضٍ يرفض، وإلا فأي تحذيرٍ يحذّر، وإلا مرّ. */
  function verdictOf(violations) {
    var worst = VERDICTS.PASS;
    for (var i = 0; i < violations.length; i += 1) {
      if (violations[i].severity === VERDICTS.FAIL) return VERDICTS.FAIL;
      worst = VERDICTS.WARN;
    }
    return worst;
  }

  /**
   * فحص مسارٍ واحد. `context.closedMajor` يفعّل بوابة هبوط الدرجة.
   * يعيد كائن حكمٍ جديداً ولا يلمس المسار — الزينة شأن `audit`.
   */
  function auditRoute(prepared, route, context) {
    var opts = withDefaults(context && context.options);
    var violations = geometryViolations(prepared, route.states, opts)
      .concat(loadViolations(route));
    var drop = classDropViolation(route, !!(context && context.closedMajor));
    if (drop) violations.push(drop);
    return { verdict: verdictOf(violations), violations: violations };
  }

  function withDefaults(options) {
    var opts = {};
    Object.keys(DEFAULTS).forEach(function (key) {
      opts[key] = options && options[key] !== undefined ? options[key] : DEFAULTS[key];
    });
    return opts;
  }

  /** هل بين الأضلاع المغلقة ضلعٌ غير سكني؟ — يقرّر بوابة هبوط الدرجة. */
  function closureIsMajor(prepared, banned) {
    var keys = Object.keys(banned || {});
    for (var i = 0; i < keys.length; i += 1) {
      if (isMajor(prepared, Number(keys[i]))) return true;
    }
    return false;
  }

  /**
   * تزيين ناتج `alternativesAround` بالأحكام — نسخٌ لا تعديلٌ في المكان.
   * ---------------------------------------------------------------------------
   * `escalate` هو جوهر الانقلاب المطلوب: حين لا يمرّ بديلٌ واحد، الخبر ليس
   * «خذ أقلّها سوءاً» بل «هذا الإغلاق بهذا الشكل لا بديل مقبولاً له — عدّل
   * التصريح»: قلّص الإغلاق (سلّم `masar-closure-ladder.js`) أو غيّر نافذته
   * (`MasarEngine.optimize`). البديل يقيّد التصريح، لا العكس.
   */
  function audit(prepared, result, options) {
    if (!result || !result.ok) return result;
    var closedMajor = closureIsMajor(prepared, result.banned);
    var context = { closedMajor: closedMajor, options: options };

    var alternatives = result.alternatives.map(function (route) {
      var copy = {};
      Object.keys(route).forEach(function (key) { copy[key] = route[key]; });
      copy.policy = auditRoute(prepared, route, context);
      return copy;
    });

    var passing = alternatives.filter(function (route) {
      return route.policy.verdict !== VERDICTS.FAIL;
    }).length;

    var out = {};
    Object.keys(result).forEach(function (key) { out[key] = result[key]; });
    out.alternatives = alternatives;
    out.policy = {
      closedMajor: closedMajor,
      passing: passing,
      escalate: passing === 0,
      note: passing === 0
        ? 'لا بديل يمرّ بوابات السلامة — عدّل التصريح: قلّص الإغلاق (سلّم '
          + 'الاستمرارية) أو غيّر نافذته الزمنية، ولا يُقبل مسارٌ يكسر البوابات.'
        : null,
    };
    return out;
  }

  return {
    DEFAULTS: DEFAULTS,
    RULES: RULES,
    VERDICTS: VERDICTS,
    junctionDelta: junctionDelta,
    geometryViolations: geometryViolations,
    loadViolations: loadViolations,
    auditRoute: auditRoute,
    audit: audit,
    closureIsMajor: closureIsMajor,
  };
});
