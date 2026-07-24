'use strict';
/**
 * توحيد الأرقام.
 * الأرقام العربية-الهندية (٩٤٠) والأرقام اللاتينية (940) على شاشتين متجاورتين
 * تُقرأ كإهمال لا كخيار. المشروع لاتيني في كل موضع — والبوابة هنا تمنع الانزلاق.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

const ROOT = path.join(__dirname, '..');
const files = fs.readdirSync(ROOT)
  .filter((f) => f.endsWith('.html') || f.endsWith('.js'))
  .filter((f) => f !== 'server.js');

ok('لا مُنسّق أرقام أو تواريخ بلا نظام لاتيني صريح', () => {
  const offenders = [];
  files.forEach((file) => {
    const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const matches = text.match(/(?:toLocaleString|NumberFormat|DateTimeFormat)\(\s*['"]ar[^'"]*['"]/g) || [];
    matches.forEach((match) => {
      if (match.indexOf('u-nu-latn') === -1) offenders.push(`${file}: ${match}`);
    });
  });
  assert.deepStrictEqual(offenders, [], `منسّقات بلا نظام لاتيني:\n  ${offenders.join('\n  ')}`);
});

ok('لا أرقام عربية-هندية مكتوبة داخل شيفرة العرض', () => {
  const offenders = [];
  files.forEach((file) => {
    const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
    // داخل سلاسل جافاسكربت فقط — النص العربي في HTML قد يحمل أرقاماً مقصودة.
    const strings = text.match(/'[^'\n]*[٠-٩][^'\n]*'/g) || [];
    strings.forEach((s) => offenders.push(`${file}: ${s.slice(0, 40)}`));
  });
  assert.deepStrictEqual(offenders, [], `أرقام هندية مثبتة:\n  ${offenders.join('\n  ')}`);
});

console.log(`\n${passed} اختبارات نجحت`);
