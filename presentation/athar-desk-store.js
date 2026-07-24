/**
 * أثر — مخزن حالة مكتب المراجع.
 * ---------------------------------------------------------------------------
 * 1) مصدر حقيقة واحد: القائمة والخريطة وملف القرار تقرأ من هنا فقط. بلا هذا
 *    يعود المكتب بطاقات منفصلة لا تشترك في حالة — وهو المرض الذي شخّصه بحث
 *    المقارنات في النموذج السابق.
 * 2) نقي بالكامل — لا DOM ولا خريطة — فيُختبر في Node.
 * 3) المرشحات تتراكم؛ ضبط مرشح لا يمحو غيره.
 * 4) الفرز الافتراضي بالأثر تنازلياً: الصندوق يفتح على أخطر عمل ينتظر قراراً.
 * 5) لا يعدّل المصفوفة الواردة، ولا يسرّب حالته الداخلية للتعديل من الخارج.
 *
 * UMD بنفس نمط athar-engine.js.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AtharDeskStore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** الحالات التي تنتظر فعلاً بشرياً — عدّادها هو ما يهم المراجع. */
  var DECISION_STATUSES = [
    'CompletenessReview', 'ImpactScreening', 'CoordinationRequired', 'StrategyReview',
  ];

  var SEARCH_FIELDS = ['street', 'permitRef', 'title', 'promoter', 'contractor', 'id'];

  function matchesQuery(properties, query) {
    var needle = String(query).trim();
    if (!needle) return true;
    for (var i = 0; i < SEARCH_FIELDS.length; i += 1) {
      if (String(properties[SEARCH_FIELDS[i]] || '').indexOf(needle) !== -1) return true;
    }
    return false;
  }

  function matches(feature, filters) {
    var p = feature.properties;
    if (filters.status && p.status !== filters.status) return false;
    if (filters.severity && Number(p.severity) !== Number(filters.severity)) return false;
    if (filters.group && p.group !== filters.group) return false;
    if (filters.sensitivity && p.sensitivity !== filters.sensitivity) return false;
    if (filters.query !== undefined && !matchesQuery(p, filters.query)) return false;
    return true;
  }

  function pending(feature) {
    return DECISION_STATUSES.indexOf(feature.properties.status) !== -1 ? 1 : 0;
  }

  var SORTERS = {
    /**
     * صندوق وارد لا جدول بيانات: ما ينتظر قراراً يتقدّم دائماً، ثم الأثر داخل
     * كل مجموعة. بلا هذا يفتح المكتب على عمل منتهٍ لأن أثره التراكمي أعلى.
     */
    impact: function (a, b) {
      var byPending = pending(b) - pending(a);
      if (byPending !== 0) return byPending;
      return (b.properties.impactVehHours || 0) - (a.properties.impactVehHours || 0);
    },
    severity: function (a, b) {
      return (b.properties.severity || 0) - (a.properties.severity || 0);
    },
    start: function (a, b) {
      return Date.parse(a.properties.start || 0) - Date.parse(b.properties.start || 0);
    },
    street: function (a, b) {
      return String(a.properties.street).localeCompare(String(b.properties.street), 'ar');
    },
  };

  var DEFAULT_SORT = 'impact';

  function createStore(features) {
    var all = (features || []).slice();
    var state = { selectedId: null, filters: {}, sort: DEFAULT_SORT };
    var listeners = [];

    function emit() {
      // نسخة من القائمة: مستمع يلغي اشتراكه أثناء البث لا يزيح من بعده.
      listeners.slice().forEach(function (fn) { fn(); });
    }

    function indexOf(id) {
      for (var i = 0; i < all.length; i += 1) {
        if (all[i].properties.id === id) return i;
      }
      return -1;
    }

    function find(id) {
      var at = indexOf(id);
      return at === -1 ? null : all[at];
    }

    function getVisible() {
      var sorter = SORTERS[state.sort] || SORTERS[DEFAULT_SORT];
      return all.filter(function (feature) {
        return matches(feature, state.filters);
      }).sort(sorter);
    }

    return {
      getState: function () {
        return {
          selectedId: state.selectedId,
          filters: JSON.parse(JSON.stringify(state.filters)),
          sort: state.sort,
          features: all.slice(),
        };
      },

      subscribe: function (fn) {
        listeners.push(fn);
        return function () {
          var at = listeners.indexOf(fn);
          if (at !== -1) listeners.splice(at, 1);
        };
      },

      select: function (id) {
        state.selectedId = find(id) ? id : null;
        emit();
      },

      setFilter: function (key, value) {
        state.filters[key] = value;
        emit();
      },

      clearFilter: function (key) {
        delete state.filters[key];
        emit();
      },

      setSort: function (key) {
        state.sort = SORTERS[key] ? key : DEFAULT_SORT;
        emit();
      },

      /** يستبدل سجلاً بنسخته الجديدة بعد قرار — لا يضيف سجلاً غير موجود. */
      replace: function (feature) {
        var at = indexOf(feature.properties.id);
        if (at === -1) return;
        all = all.slice();
        all[at] = feature;
        emit();
      },

      getVisible: getVisible,

      getSelected: function () {
        return state.selectedId ? find(state.selectedId) : null;
      },

      counts: function () {
        var byStatus = {};
        var needsDecision = 0;
        all.forEach(function (feature) {
          var status = feature.properties.status;
          byStatus[status] = (byStatus[status] || 0) + 1;
          if (DECISION_STATUSES.indexOf(status) !== -1) needsDecision += 1;
        });
        return {
          total: all.length,
          visible: getVisible().length,
          byStatus: byStatus,
          needsDecision: needsDecision,
        };
      },
    };
  }

  return {
    createStore: createStore,
    DECISION_STATUSES: DECISION_STATUSES,
    SORTERS: SORTERS,
    DEFAULT_SORT: DEFAULT_SORT,
  };
});
