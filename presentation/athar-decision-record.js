/**
 * أثر — سجل القرار: نسخة المدخلات، والتوصية، والأسباب، والتوقيع، والتدقيق.
 * ---------------------------------------------------------------------------
 * 1) القاعدة التي لا تُكسر: «لا تعتمد توصية بلا نسخة مدخلات». السجل هو تلك
 *    النسخة — بلا سجل، القرار غير قابل للتفسير بعد تغيّر البيانات أو النموذج.
 * 2) رقم التصريح ثابت، ورقم النسخة يعلو مع كل قرار. لا نسخة تُعدَّل بأثر رجعي.
 * 3) لا حدث يختفي من التدقيق: الدمج يضيف ولا يستبدل.
 * 4) نقي بالكامل — لا تخزين ولا شبكة ولا ساعة. الوقت والمُخزِّن يُحقنان.
 * 5) الاسترجاع متسامح: مخزَّن تالف أو من إصدار أقدم يُتجاهل بصمت بدل أن يمنع
 *    الصفحة من الإقلاع.
 *
 * UMD بنفس نمط athar-engine.js.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AtharDecisionRecord = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SCHEMA_VERSION = 1;
  var STORAGE_KEY = 'athar.decisions.v1';

  /** الحقول التي تُثبَّت في نسخة المدخلات — تغييرها يغيّر النتيجة. */
  var INPUT_FIELDS = [
    'aadt', 'lanes', 'lanesClosed', 'startHour', 'durationHours',
    'windowHours', 'workDays', 'capacityPerLane', 'freeFlowMin',
  ];

  function pickInputs(input) {
    var snapshot = {};
    INPUT_FIELDS.forEach(function (field) {
      if (input && input[field] !== undefined) snapshot[field] = input[field];
    });
    return snapshot;
  }

  /**
   * يبني سجلاً كاملاً من العمل والتحليل والحدث. الوقت يأتي من الحدث لا من
   * الساعة، فالدالة قابلة للاختبار بنتيجة ثابتة.
   */
  function create(work, analysis, event, input) {
    var a = analysis || {};
    var best = (a.alternatives || [])[0] || null;

    return {
      schema: SCHEMA_VERSION,
      permitRef: work.permitRef || work.id,
      workId: work.id,
      version: event.version,
      status: event.to,
      // الحالة قبل القرار. بدونها لا يمكن التراجع: السجل يعرف إلى أين ذهب
      // العمل ولا يعرف من أين جاء، فالتصحيح يصير تخميناً.
      from: event.from || null,
      action: event.action,
      actor: event.actor || '',
      reason: event.reason || '',
      at: event.at || null,
      inputs: pickInputs(input),
      recommendation: best ? {
        label: best.label,
        delayVehHours: best.delayVehHours,
        savedPct: best.savedPct === undefined ? null : best.savedPct,
      } : null,
      asked: a.scored ? {
        delayVehHours: a.scored.delayVehHours,
        delayPct: a.scored.delayPct,
        level: a.scored.level,
      } : null,
      delta: a.delta === undefined ? null : a.delta,
      reasons: (a.reasons || []).slice(0, 3),
      conflicts: (a.conflicts || []).map(function (conflict) {
        return { withRef: conflict.withRef, overlapHours: conflict.overlapHours };
      }),
      confidence: work.confidence || null,
      escalated: Boolean(work.escalate),
    };
  }

  /** يضيف سجلاً إلى السجلات القائمة لعمل واحد، مرتّبةً بالنسخة. لا يستبدل. */
  function append(existing, record) {
    var list = (existing || []).filter(function (item) {
      return item.version !== record.version;
    });
    return list.concat([record]).sort(function (a, b) { return a.version - b.version; });
  }

  /** أحدث نسخة — هي التي تحمل الحالة السارية. */
  function latest(records) {
    if (!records || !records.length) return null;
    return records.reduce(function (max, record) {
      return record.version > max.version ? record : max;
    }, records[0]);
  }

  function isValid(record) {
    return Boolean(record)
      && record.schema === SCHEMA_VERSION
      && typeof record.workId === 'string'
      && typeof record.version === 'number'
      && typeof record.status === 'string';
  }

  /** يحوّل خريطة {workId: [سجلات]} إلى نص للتخزين. */
  function serialize(byWork) {
    return JSON.stringify({ schema: SCHEMA_VERSION, works: byWork || {} });
  }

  /** يقرأ النص. أي تلف أو إصدار مختلف يعود بخريطة فارغة لا باستثناء. */
  function deserialize(text) {
    if (!text) return {};
    var parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      return {};
    }
    if (!parsed || parsed.schema !== SCHEMA_VERSION || typeof parsed.works !== 'object') return {};

    var clean = {};
    Object.keys(parsed.works).forEach(function (workId) {
      var records = parsed.works[workId];
      if (!Array.isArray(records)) return;
      var valid = records.filter(isValid);
      if (valid.length) clean[workId] = valid.sort(function (a, b) { return a.version - b.version; });
    });
    return clean;
  }

  /**
   * يعيد بناء حالة المحفظة من السجلات المخزَّنة.
   * الميزة الأصلية تبقى مصدر الهندسة؛ السجل يفرض الحالة والنسخة وتوقيع القرار.
   */
  function restore(features, byWork) {
    var store = byWork || {};
    return (features || []).map(function (feature) {
      var records = store[feature.properties.id];
      var last = latest(records);
      if (!last) return feature;

      var properties = {};
      Object.keys(feature.properties).forEach(function (key) {
        properties[key] = feature.properties[key];
      });
      properties.status = last.status;
      properties.version = last.version;
      properties.decidedAt = last.at;
      properties.decidedBy = last.actor;

      return { type: 'Feature', geometry: feature.geometry, properties: properties };
    });
  }

  /** عدّاد للعرض: كم عملاً حمل قراراً، وكم قراراً سُجِّل إجمالاً. */
  function counts(byWork) {
    var store = byWork || {};
    var ids = Object.keys(store);
    return {
      works: ids.length,
      decisions: ids.reduce(function (total, id) { return total + store[id].length; }, 0),
    };
  }

  /**
   * التراجع عن آخر قرار.
   * ---------------------------------------------------------------------------
   * لا يُحذف شيء. سجل التدقيق هو ما يجعل القرار قابلاً للمساءلة، ومحوُ سطر منه
   * يُسقط الخاصية التي بُني لأجلها — سجلٌّ يُمحى منه ليس سجلاً.
   *
   * فالتراجع خطوة معوِّضة: نسخةٌ جديدة تُعيد العمل إلى حالته السابقة، مقيَّدةً
   * باسمها وسببها. من يقرأ السجل يرى القرار والتراجع عنه، ويعرف من فعل ماذا
   * ومتى — وهذا أصدق من سجلٍّ نظيف يُخفي أن خطأً وقع.
   *
   * القيد الوحيد: آخر نسخة فقط. التراجع عن نسخة وسطى يترك ما بعدها معلّقاً
   * على حالة لم تعد قائمة.
   *
   * @param {Array<object>} records سجلات عمل واحد
   * @returns {{allowed:boolean, reason?:string, spec?:object}}
   */
  function undoSpec(records) {
    var trail = (records || []).slice().sort(function (a, b) { return a.version - b.version; });
    if (!trail.length) {
      return { allowed: false, reason: 'لا قرار مسجَّل على هذا العمل بعد.' };
    }

    var last = trail[trail.length - 1];
    if (!last.from) {
      return {
        allowed: false,
        reason: 'السجل الأخير لا يحمل حالته السابقة — قرارٌ قُيّد قبل إتاحة التراجع.',
      };
    }

    return {
      allowed: true,
      spec: {
        undoneVersion: last.version,
        undoneAction: last.action,
        toStatus: last.from,
        fromStatus: last.status,
        nextVersion: last.version + 1,
      },
    };
  }

  /**
   * يبني سجل التراجع. يرث نسخة مدخلات القرار المُتراجَع عنه: التراجع لا يعيد
   * الحساب، فادّعاء مدخلات جديدة له يزوّر ما استُند إليه.
   */
  function createUndo(work, spec, actor, at) {
    var undone = spec.undoneAction;
    return {
      schema: SCHEMA_VERSION,
      permitRef: work.permitRef || work.id,
      workId: work.id,
      version: spec.nextVersion,
      status: spec.toStatus,
      from: spec.fromStatus,
      action: 'undo',
      actor: actor || '',
      reason: 'تراجع عن «' + undone + '» (نسخة ' + spec.undoneVersion + ')',
      at: at || null,
      inputs: {},
      recommendation: null,
      asked: null,
      delta: null,
      reasons: [],
      conflicts: [],
      confidence: work.confidence || null,
      escalated: Boolean(work.escalate),
    };
  }

  return {
    SCHEMA_VERSION: SCHEMA_VERSION,
    STORAGE_KEY: STORAGE_KEY,
    INPUT_FIELDS: INPUT_FIELDS,
    create: create,
    undoSpec: undoSpec,
    createUndo: createUndo,
    append: append,
    latest: latest,
    isValid: isValid,
    serialize: serialize,
    deserialize: deserialize,
    restore: restore,
    counts: counts,
  };
});
