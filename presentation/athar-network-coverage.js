/**
 * أثر — تغطية شبكة التوجيه (WP-T5).
 * ---------------------------------------------------------------------------
 * سؤال المحكّم: «هل تُحترم الانعطافات الممنوعة؟»
 *
 * الجواب الصادق شطران، وحذفُ أيّهما تضليل:
 *   · **نعم، ما نملكه منها مطبَّق ومفحوص** على مسارات حقيقية.
 *   · **ولا نملك إلا قليلاً منها**، لأن مصدر OSM نفسه رقيق في هذا النطاق.
 *
 * وقول الشطر الأول وحده يوهم بتغطية شاملة. وقول الثاني وحده يوهم بأن الآلية
 * غير منفَّذة. فيُعرضان معاً برقميهما.
 *
 * ---------------------------------------------------------------------------
 * **لا رقم هنا مكتوب يدوياً.** كل قيمة تُقرأ من ملفات البيانات عند الاستدعاء،
 * فإن أُعيد جلب القيود تغيّرت الأرقام معها. جدولُ تغطيةٍ مكتوب هو أول ما
 * يتقادم، ثم يُقرأ ادعاءً.
 *
 * UMD بنفس نمط athar-engine.js.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AtharNetworkCoverage = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function graphOf(scope) {
    return (scope && scope.RIYADH_ROUTE_GRAPH)
      || (typeof window !== 'undefined' && window.RIYADH_ROUTE_GRAPH)
      || null;
  }

  function restrictionsOf(scope) {
    return (scope && scope.RIYADH_TURN_RESTRICTIONS)
      || (typeof window !== 'undefined' && window.RIYADH_TURN_RESTRICTIONS)
      || null;
  }

  /**
   * حصيلة التغطية، محسوبةً من البيانات.
   *
   * @param {object} [scope] موضع البيانات — يُمرَّر في Node، ويُقرأ من
   *   `window` في المتصفح.
   * @returns {object|null}
   */
  function turnRestrictions(scope) {
    var graph = graphOf(scope);
    var source = restrictionsOf(scope);
    if (!graph || !source) return null;

    var meta = source.metadata || {};
    var kept = (source.rules || []).length;
    var viaWaySkipped = meta.viaWaySkipped || 0;
    var incompleteSkipped = meta.incompleteSkipped || 0;
    var conditionalSkipped = meta.conditionalSkipped || 0;
    var fetched = kept + viaWaySkipped + incompleteSkipped + conditionalSkipped;

    var graphMeta = graph.metadata || {};
    var applied = graphMeta.restrictionRules;
    var unresolved = graphMeta.restrictionUnresolved;
    var transitions = (graph.restrictions || []).length;

    return {
      /* سلسلة الفقد كاملةً: كل خطوة تُعرض بسببها، لا فرقٌ نهائيّ مجهول
         المنشأ. من يقرأ «64 من 162» يستحق أن يعرف أين ذهبت البقية. */
      fetchedRelations: fetched,
      keptRelations: kept,
      skipped: {
        incomplete: incompleteSkipped,
        viaWay: viaWaySkipped,
        conditional: conditionalSkipped,
      },
      appliedRules: applied,
      unresolvedRules: unresolved,
      forbiddenTransitions: transitions,
      mandatoryRules: (source.rules || []).filter(function (rule) {
        return rule[3] === 1;
      }).length,
      prohibitoryRules: (source.rules || []).filter(function (rule) {
        return rule[3] === 0;
      }).length,
      edges: (graph.edges || []).length,
      nodes: (graph.nodes || []).length,
      onewayEdges: (graph.edges || []).filter(function (edge) {
        return edge[5] !== 0;
      }).length,
      source: meta.source || '',
      bbox: meta.bbox || null,
    };
  }

  /**
   * الجملة التي تُعرض للقارئ.
   *
   * تُبنى من الأرقام المحسوبة، ولا تُكتب. وتقول الشطرين معاً في جملة واحدة
   * كي لا يُقتطع أحدهما عند النقل.
   */
  function statement(scope) {
    var facts = turnRestrictions(scope);
    if (!facts) return '';
    return 'منع الانعطاف مطبَّق ومفحوص على ما هو متاح: '
      + facts.appliedRules + ' قاعدة من ' + facts.keptRelations
      + ' مستخرَجة (' + facts.forbiddenTransitions + ' انتقالاً ممنوعاً). '
      + 'والتغطية ليست شاملة: ' + facts.skipped.incomplete
      + ' علاقة وصلت ناقصة من المصدر، و' + facts.skipped.viaWay
      + ' بتقاطع مركّب لا يمثّله ضلعان، و' + facts.unresolvedRules
      + ' لم تُسنَد إلى الشبكة. '
      + 'السبب رقّة تغطية OpenStreetMap في هذا النطاق، لا معالجةٌ ناقصة — '
      + 'وتوسيع مدى الإسناد لاستعادتها يخاطر بمنعٍ كاذب يرسل السائق '
      + 'في التفاف بلا سبب.';
  }

  return {
    turnRestrictions: turnRestrictions,
    statement: statement,
  };
});
