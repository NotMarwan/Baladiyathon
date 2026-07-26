'use strict';
/**
 * أثر — سجل القرارات الثابت (WP-L1).
 * ---------------------------------------------------------------------------
 * قيل في `server.js` سابقاً إن حفظ السجل على القرص «يوهم بديمومة لا وجود
 * لها». كان ذلك دفاعاً سليماً حين كان السجل أثراً معمارياً يثبت أن دورة
 * القرار تعبر واجهة.
 *
 * ثم جاءت WP-D3 فجعلت السجل **مستنداً يُفرَض به قيد**: «من فحص التصريح لا
 * يعتمده» يُقرأ من السجل نفسه. وسجلٌّ في الذاكرة يعني أن إعادة تشغيل الخادم
 * تُفرغه، فيعود الفاحص قادراً على اعتماد ما فحصه — **قيدٌ يسقط بإعادة تشغيل،
 * لا بثغرة**.
 *
 * فالثبات هنا ليس ترقية تخزين، بل شرطُ بقاءِ قاعدةٍ أُعلنت.
 *
 * ---------------------------------------------------------------------------
 * لماذا الإلحاق لا إعادة الكتابة:
 *
 * إعادة كتابة الملف كاملاً عند كل قرار تعني أن انقطاعاً في منتصف الكتابة
 * يُتلف **كل** ما سبق. والإلحاق يجعل أسوأ حالةٍ سطراً أخيراً ناقصاً، وما قبله
 * سليم. سجلُّ تدقيقٍ يخسر تاريخه كلّه عند أول انقطاع أسوأ من غياب السجل:
 * غيابه معروف، وخسارته صامتة.
 *
 * والسطر التالف **لا يُحذف ولا يُسقط العملية**: يُعدّ ويُبلَّغ ويُتخطّى.
 * حذفه بصمت يجعل السجل يبدو متسقاً وهو ناقص.
 */

const fs = require('node:fs');
const path = require('node:path');

/**
 * يبني سجلاً ثابتاً فوق ملف JSON Lines.
 *
 * @param {string|null} filePath مسار الملف، أو `null` لسجل في الذاكرة وحدها
 * @param {{onWarn?:function}} [options]
 * @returns {{get:function, set:function, forEach:function, append:function,
 *            size:number, stats:object}}
 */
function createLedger(filePath, options) {
  const settings = options || {};
  const warn = settings.onWarn || function () {};
  const byWork = new Map();
  const stats = { loaded: 0, skipped: 0, corruptLines: [], path: filePath || null };

  function place(record) {
    if (!record || typeof record.workId !== 'string' || !record.workId) return false;
    const existing = byWork.get(record.workId) || [];
    const merged = existing
      .filter((item) => item.version !== record.version)
      .concat([record])
      .sort((a, b) => a.version - b.version);
    byWork.set(record.workId, merged);
    return true;
  }

  /* القراءة نفسها قد تفشل: مسارٌ مجلدٌ لا ملف، أو صلاحية مفقودة. وإسقاط
     الخادم عند الإقلاع لعطلٍ في وسيط يمنع كل عمل — بينما السجل الفارغ يمنع
     ما بُني عليه وحده. الفشل يُبلَّغ ويُعدّ ولا يُبتلع. */
  let raw = null;
  if (filePath && fs.existsSync(filePath)) {
    try {
      raw = fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      stats.readFailed = error.message;
      warn(`سجل القرارات: تعذّرت قراءة «${filePath}» — ${error.message}`);
    }
  }

  if (raw !== null) {
    raw.split('\n').forEach((line, index) => {
      const text = line.trim();
      if (!text) return;
      let record = null;
      try {
        record = JSON.parse(text);
      } catch (error) {
        record = null;
      }
      if (record && place(record)) {
        stats.loaded += 1;
        return;
      }
      /* سطرٌ لا يُقرأ يُعدّ ويُسمّى برقمه. الصمت عنه يجعل السجل يبدو كاملاً. */
      stats.skipped += 1;
      if (stats.corruptLines.length < 20) stats.corruptLines.push(index + 1);
      warn(`سجل القرارات: سطر ${index + 1} تالف — تُخطّي ولم يُحذف`);
    });
  }

  return {
    get: (workId) => byWork.get(workId),
    set: (workId, records) => { byWork.set(workId, records); },
    forEach: (fn) => { byWork.forEach(fn); },
    get size() { return byWork.size; },
    stats,

    /**
     * يثبّت قراراً: في الذاكرة أولاً ثم على القرص.
     *
     * الترتيب مقصود عكسَ الحدس: الكتابة على القرص قد تفشل (قرص ممتلئ، صلاحية
     * مفقودة)، وإسقاطُ الطلب حينها يفقد المراجع قراره لعطلٍ في وسيط. فيبقى
     * القرار في الذاكرة، ويُبلَّغ عن فشل التثبيت بدل ابتلاعه.
     */
    append(record) {
      if (!place(record)) return null;
      if (filePath) {
        try {
          fs.mkdirSync(path.dirname(filePath), { recursive: true });
          fs.appendFileSync(filePath, JSON.stringify(record) + '\n', 'utf8');
        } catch (error) {
          stats.writeFailures = (stats.writeFailures || 0) + 1;
          warn(`سجل القرارات: تعذّر التثبيت على القرص — ${error.message}`);
        }
      }
      return byWork.get(record.workId);
    },
  };
}

module.exports = { createLedger };
