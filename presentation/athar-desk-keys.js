/**
 * أثر — مفاتيح مكتب المراجع.
 * ---------------------------------------------------------------------------
 * الصندوق فيه 118 عملاً ينتظر قراراً. بالفأرة: نقرة للصف، نقرة للتبويب، نقرة
 * للإجراء — ثلاث نقرات وإعادة تموضع للعين في كل مرة. بالمفاتيح: يد واحدة لا
 * تغادر مكانها. الفرق ليس راحة بل قابلية استعمال الأداة يومياً أصلاً.
 *
 * قرار تصميمي واحد يستحق التوضيح: القراءة من `event.code` لا من `event.key`.
 * `code` هو الموضع الفيزيائي على اللوحة، و`key` هو الحرف المُنتَج. مراجع
 * يكتب بلوحة عربية يُنتج مفتاحُه «ت» لا «j»؛ القراءة من `key` كانت ستُسقط
 * الاختصارات كلها عن كل من يعمل بالعربية — أي عن كل مستعمل هذه الأداة.
 *
 * الوحدة نقية: تأخذ حدثاً وسياقاً وتعيد نيّة. لا DOM ولا تأثير جانبي، فكل
 * جدول المفاتيح يُختبر في Node.
 *
 * UMD بنفس نمط athar-engine.js.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AtharDeskKeys = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** الموضع الفيزيائي إلى نيّة. مستقل عن لغة اللوحة. */
  var BY_CODE = {
    KeyJ: { intent: 'next' },
    KeyK: { intent: 'prev' },
    KeyN: { intent: 'nextPending' },
    KeyA: { intent: 'action', arg: 'approve' },
    KeyR: { intent: 'action', arg: 'return' },
    KeyE: { intent: 'action', arg: 'escalate' },
    KeyC: { intent: 'action', arg: 'coordinate' },
    KeyD: { intent: 'decide' },
    KeyT: { intent: 'session' },
    KeyU: { intent: 'undo' },
    KeyS: { intent: 'action', arg: 'screen' },
    Slash: { intent: 'search' },
    Digit1: { intent: 'tab', arg: 0 },
    Digit2: { intent: 'tab', arg: 1 },
    Digit3: { intent: 'tab', arg: 2 },
    Digit4: { intent: 'tab', arg: 3 },
    Digit5: { intent: 'tab', arg: 4 },
    Digit6: { intent: 'tab', arg: 5 },
    Digit7: { intent: 'tab', arg: 6 },
  };

  /** ما يُقرأ من `key` لأنه محايد اللغة أصلاً. */
  var BY_KEY = {
    ArrowDown: { intent: 'next' },
    ArrowUp: { intent: 'prev' },
    Enter: { intent: 'open' },
    Escape: { intent: 'escape' },
    '?': { intent: 'help' },
  };

  /** جدول العرض في لوحة المساعدة. مصدر واحد للمفاتيح ووصفها. */
  var HELP = [
    { keys: 'J / ↓', label: 'العمل التالي' },
    { keys: 'K / ↑', label: 'العمل السابق' },
    { keys: 'N', label: 'التالي الذي ينتظر قراراً' },
    { keys: 'Enter', label: 'انتقل إلى ملف القرار' },
    { keys: '1 – 7', label: 'تبويبات الملف بالترتيب' },
    { keys: 'D', label: 'ادفع للمحطة التالية — يقف عند ما يحتاج حكمك' },
    { keys: 'A', label: 'اعتماد' },
    { keys: 'R', label: 'إرجاع للمُقدِّم' },
    { keys: 'E', label: 'تصعيد' },
    { keys: 'C', label: 'إحالة للتنسيق' },
    { keys: 'S', label: 'رفع للقرار بعد الفرز' },
    { keys: 'U', label: 'تراجع عن آخر قرار — يُقيَّد ولا يُمحى' },
    { keys: 'T', label: 'حصيلتك في هذه الجلسة' },
    { keys: '/', label: 'البحث' },
    { keys: 'Esc', label: 'إلغاء البحث أو إغلاق هذه اللوحة' },
    { keys: '؟ / ?', label: 'هذه اللوحة' },
  ];

  var TYPING_TAGS = { INPUT: true, TEXTAREA: true, SELECT: true };

  /** هل المؤشر داخل حقل يكتب فيه المراجع؟ عندها الحرف حرف لا أمر. */
  function isTyping(target) {
    if (!target) return false;
    if (TYPING_TAGS[target.tagName]) return true;
    return target.isContentEditable === true;
  }

  /**
   * @param {KeyboardEvent} event
   * @param {object} [context] {typing} — يُحسب من الحدث إن لم يُمرَّر.
   * @returns {{intent:string, arg:*}|null}
   */
  function resolve(event, context) {
    if (!event) return null;

    // اختصار بمُعدِّل ليس اختصارنا: النسخ والتبويب واختصارات المتصفح تمر.
    if (event.ctrlKey || event.metaKey || event.altKey) return null;

    var ctx = context || {};
    var typing = ctx.typing === undefined ? isTyping(event.target) : ctx.typing;

    // داخل حقل: لا ينفذ إلا الهروب — وهو ما يُخرج المراجع من الحقل.
    if (typing) {
      return event.key === 'Escape' ? { intent: 'escape', arg: null } : null;
    }

    var byKey = BY_KEY[event.key];
    if (byKey) return { intent: byKey.intent, arg: byKey.arg === undefined ? null : byKey.arg };

    // «؟» العربية على الموضع نفسه الذي يحمل «/» — كلاهما يفتح المساعدة بـ Shift.
    if (event.key === '؟') return { intent: 'help', arg: null };
    if (event.code === 'Slash' && event.shiftKey) return { intent: 'help', arg: null };

    var byCode = BY_CODE[event.code];
    if (!byCode) return null;
    if (event.shiftKey) return null;

    return { intent: byCode.intent, arg: byCode.arg === undefined ? null : byCode.arg };
  }

  /** لوحة المساعدة كنص. نقية وقابلة للاختبار مثل بقية المُصيّرات. */
  function renderHelp() {
    return '<div class="desk-help-card" role="document">'
      + '<h2 id="deskHelpTitle">اختصارات لوحة المفاتيح</h2>'
      + '<p class="desk-help-note">تعمل على أيّ لغة لوحة — المفتاح يُقرأ بموضعه لا بحرفه.</p>'
      + '<dl class="desk-help-list">'
      + HELP.map(function (row) {
        return '<dt><kbd>' + row.keys + '</kbd></dt><dd>' + row.label + '</dd>';
      }).join('')
      + '</dl>'
      + '<button type="button" class="desk-help-close" id="deskHelpClose">إغلاق</button>'
      + '</div>';
  }

  return { resolve: resolve, renderHelp: renderHelp, HELP: HELP, isTyping: isTyping };
});
