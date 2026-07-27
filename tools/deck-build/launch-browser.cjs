/*
 * متصفّح التصيير — مضمَّن، وإلا فمتصفّح النظام.
 * ---------------------------------------------------------------------------
 * كان كل مُصدِّر يكتب `chromium.launch()` وحده. وترقية playwright ترفع رقم
 * النسخة التي يطلبها فيسقط التوليد بـ«Executable doesn't exist» — على جهازٍ
 * فيه Chrome مثبَّت وجاهز. وثمن ذلك تنزيل مئة وثلاثين ميغابايت في اللحظة التي
 * لا يُنزَّل فيها شيء: قبل الرفع مباشرة، حيث يوجب `اجوبة-الفورم.md` إعادة
 * توليد الـPDF «آخر خطوة».
 *
 * الترتيب: المضمَّن أولاً لأنه المطابق للمرجع، ثم Chrome ثم Edge — وكلاهما على
 * أي ويندوز حديث. والسبب يُطبع كي لا يُقرأ اختلافُ تصييرٍ لاحقاً بوصفه انحداراً
 * في العرض.
 */
const { chromium } = require('playwright');

async function launchBrowser() {
  const attempts = [
    { label: 'chromium المضمَّن', options: { headless: true } },
    { label: 'Chrome النظام', options: { headless: true, channel: 'chrome' } },
    { label: 'Edge النظام', options: { headless: true, channel: 'msedge' } },
  ];
  const failures = [];
  for (const attempt of attempts) {
    try {
      const browser = await chromium.launch(attempt.options);
      if (failures.length) {
        console.error(`[deck] صُيِّر بـ${attempt.label} — المضمَّن غير متاح.`);
      }
      return browser;
    } catch (error) {
      failures.push(`${attempt.label}: ${String(error.message).split('\n')[0]}`);
    }
  }
  throw new Error('تعذّر تشغيل أي متصفّح للتصيير:\n  ' + failures.join('\n  '));
}

module.exports = { launchBrowser };
