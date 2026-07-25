'use strict';
const assert = require('assert');
const Keys = require('../athar-desk-keys.js');

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

/** حدث لوحة مفاتيح مصغّر — ما تقرأه resolve فقط. */
function press(fields) {
  return Object.assign({
    code: '', key: '', shiftKey: false, ctrlKey: false, metaKey: false, altKey: false,
    target: { tagName: 'BODY' },
  }, fields);
}

/* ---- استقلال اللغة: القلب من هذه الوحدة ---- */

ok('المفتاح يُقرأ بموضعه فيعمل على لوحة عربية كما على لاتينية', () => {
  // المراجع بلوحة عربية يضغط الموضع نفسه فيُنتج «ت» لا «j».
  const arabic = Keys.resolve(press({ code: 'KeyJ', key: 'ت' }));
  const latin = Keys.resolve(press({ code: 'KeyJ', key: 'j' }));
  assert.deepStrictEqual(arabic, latin);
  assert.strictEqual(arabic.intent, 'next');
});

ok('كل اختصار حرفي يعمل بلوحة عربية', () => {
  const ARABIC_AT = {
    KeyK: 'ن', KeyN: 'ى', KeyA: 'ش', KeyR: 'ق', KeyE: 'ث', KeyC: 'ؤ',
  };
  Object.keys(ARABIC_AT).forEach((code) => {
    const got = Keys.resolve(press({ code: code, key: ARABIC_AT[code] }));
    assert.ok(got && got.intent, `${code} لا يعمل بحرف عربي`);
  });
});

/* ---- الحركة والإجراء ---- */

ok('التنقل يعمل بالحرف وبالسهم معاً', () => {
  assert.strictEqual(Keys.resolve(press({ code: 'KeyJ', key: 'j' })).intent, 'next');
  assert.strictEqual(Keys.resolve(press({ key: 'ArrowDown' })).intent, 'next');
  assert.strictEqual(Keys.resolve(press({ code: 'KeyK', key: 'k' })).intent, 'prev');
  assert.strictEqual(Keys.resolve(press({ key: 'ArrowUp' })).intent, 'prev');
});

ok('مفاتيح القرار تحمل اسم الإجراء لا رقمه', () => {
  const cases = { KeyA: 'approve', KeyR: 'return', KeyE: 'escalate', KeyC: 'coordinate' };
  Object.keys(cases).forEach((code) => {
    const got = Keys.resolve(press({ code: code }));
    assert.strictEqual(got.intent, 'action');
    assert.strictEqual(got.arg, cases[code]);
  });
});

ok('الأرقام تختار التبويبات بالترتيب من الصفر', () => {
  assert.strictEqual(Keys.resolve(press({ code: 'Digit1' })).arg, 0);
  assert.strictEqual(Keys.resolve(press({ code: 'Digit7' })).arg, 6);
  assert.strictEqual(Keys.resolve(press({ code: 'Digit8' })), null);
});

/* ---- ما يجب ألا يُختطف ---- */

ok('الحرف داخل حقل بحث حرف لا أمر', () => {
  const typed = press({ code: 'KeyA', key: 'a', target: { tagName: 'INPUT' } });
  assert.strictEqual(Keys.resolve(typed), null);
});

ok('الهروب وحده ينفذ من داخل الحقل — وهو ما يُخرج منه', () => {
  const escaped = press({ key: 'Escape', target: { tagName: 'INPUT' } });
  assert.strictEqual(Keys.resolve(escaped).intent, 'escape');
});

ok('الحقل القابل للتحرير يُعامل كحقل كتابة', () => {
  const editable = press({ code: 'KeyJ', target: { tagName: 'DIV', isContentEditable: true } });
  assert.strictEqual(Keys.resolve(editable), null);
});

ok('اختصارات المتصفح لا تُختطف', () => {
  ['ctrlKey', 'metaKey', 'altKey'].forEach((modifier) => {
    const combo = press({ code: 'KeyA' });
    combo[modifier] = true;
    assert.strictEqual(Keys.resolve(combo), null, `${modifier}+A اختُطف`);
  });
});

ok('Shift مع حرف لا ينفّذ الإجراء — الحرف الكبير ليس أمراً', () => {
  assert.strictEqual(Keys.resolve(press({ code: 'KeyA', shiftKey: true })), null);
});

/* ---- المساعدة ---- */

ok('علامة الاستفهام تفتح المساعدة بالعربية وباللاتينية', () => {
  assert.strictEqual(Keys.resolve(press({ key: '?' })).intent, 'help');
  assert.strictEqual(Keys.resolve(press({ key: '؟' })).intent, 'help');
  assert.strictEqual(Keys.resolve(press({ code: 'Slash', key: '?', shiftKey: true })).intent, 'help');
});

ok('الشرطة المائلة وحدها تفتح البحث لا المساعدة', () => {
  assert.strictEqual(Keys.resolve(press({ code: 'Slash', key: '/' })).intent, 'search');
});

ok('لوحة المساعدة تعرض كل اختصار معرَّف', () => {
  const html = Keys.renderHelp();
  Keys.HELP.forEach((row) => {
    assert.ok(html.indexOf(row.label) !== -1, `اختصار غير معروض: ${row.label}`);
  });
  assert.ok(html.indexOf('<kbd>') !== -1, 'المفاتيح غير موسومة دلالياً');
});

ok('كل نيّة في الجدول لها سطر في المساعدة — لا اختصار سرّي', () => {
  // مفتاح يعمل ولا يُذكر في المساعدة اختصارٌ لا يعرفه أحد.
  const documented = Keys.HELP.map((row) => row.keys.toUpperCase()).join(' ');
  ['J', 'K', 'N', 'D', 'A', 'R', 'E', 'C', '/', 'ESC', 'ENTER'].forEach((token) => {
    assert.ok(documented.indexOf(token) !== -1, `مفتاح غير موثّق: ${token}`);
  });
});

ok('D نيّة مستقلة — لا يخمّن بين اعتماد وإرجاع', () => {
  const got = Keys.resolve(press({ code: 'KeyD' }));
  assert.strictEqual(got.intent, 'decide');
  assert.strictEqual(got.arg, null, 'D يحمل إجراءً بعينه — هذا تخمين');
});

ok('اختصارات الأزرار وجدول المفاتيح مصدر واحد لا نسختان', () => {
  const File = require('../athar-desk-file.js');
  Object.keys(File.ACTION_KEYS).forEach((action) => {
    const letter = File.ACTION_KEYS[action];
    const got = Keys.resolve(press({ code: 'Key' + letter }));
    assert.ok(got && got.intent === 'action' && got.arg === action,
      `الزر يعرض ${letter} لـ ${action} والمفتاح لا يفعله`);
  });
});

ok('حدث فارغ أو مفتاح غير معرَّف يعيد لا شيء بلا استثناء', () => {
  assert.strictEqual(Keys.resolve(null), null);
  assert.strictEqual(Keys.resolve(press({ code: 'KeyZ', key: 'z' })), null);
  assert.strictEqual(Keys.resolve(press({ key: 'F5' })), null);
});

console.log(`\n${passed} اختبارات نجحت`);
