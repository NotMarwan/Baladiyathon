'use strict';
/** مُشغّل كل الحزم بمخرج واحد. يخرج بـ 1 إن سقطت حزمة. */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const files = fs.readdirSync(dir).filter((f) => f.endsWith('-test.js')).sort();

let failed = 0;
for (const file of files) {
  process.stdout.write(file.padEnd(34));
  try {
    execFileSync(process.execPath, [path.join(dir, file)], { stdio: 'pipe' });
    console.log('نجح');
  } catch (error) {
    failed += 1;
    console.log('فشل');
    // سبب الخروج قبل مخرجاته: حزمة تُقتل بإشارة تطبع مخرجات ناجحة كاملة ثم
    // تُحسب ساقطة، فيبدو السقوط بلا سبب. الرمز والإشارة يفصلان الحالتين.
    console.log(`  [خروج ${error.status === undefined ? '—' : error.status}`
      + `${error.signal ? ' · إشارة ' + error.signal : ''}]`);
    process.stdout.write(String(error.stdout || '') + String(error.stderr || ''));
  }
}

console.log(`\n${files.length - failed}/${files.length} حزمة نجحت`);
process.exit(failed ? 1 : 0);
