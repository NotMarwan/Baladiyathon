'use strict';
/**
 * منفذ عابر يقبله `fetch` — الحارس الذي كان ناقصاً.
 * ---------------------------------------------------------------------------
 * **العطل الذي يغلقه هذا الملف، بدليله لا بترجيحه.**
 *
 * كانت ثلاث حزم (`server-test` · `server-security-test` · `ledger-persistence-test`)
 * تسقط عابرةً بنحو 20٪ من التشغيلات الكاملة، بتوقيعين مختلفين:
 *
 *   (أ) `TypeError: fetch failed` وسببه `Error: bad port`.
 *   (ب) خروج `3221226505` (0xC0000409) بلا أي نصّ خطأ — أي `abort()` أصلي.
 *
 * وكان المرجَّح أنهما أثر ضغط بيئة أو تشغيل بارد. **ليسا كذلك.** السبب واحد
 * وقابل للتكرار:
 *
 * نطاق المنافذ العابرة على هذا الجهاز يبدأ من **1024** لا من 49152:
 *
 * ```
 * netsh int ipv4 show dynamicport tcp
 *   Start Port      : 1024
 *   Number of Ports : 13977
 * ```
 *
 * وهذا النطاق **يتقاطع** مع قائمة المنافذ المحظورة في معيار fetch (WHATWG) —
 * وهي منافذ يرفض `fetch` الاتصال بها مهما كان الخادم سليماً. فحين يمنح النظام
 * `server.listen(0)` أحدَ تلك المنافذ، يصير العنوان صالحاً للخادم ومرفوضاً
 * للعميل.
 *
 * **القياس المباشر:** ثلاثة آلاف فتح منفذ عابر ⇒ المدى المشاهَد 1026–15000،
 * وصفر منفذ بقيمة صفر، ومنفذ محظور واحد (`10080`) — وسقط `fetch` عليه وحده
 * بـ`bad port` بالنصّ نفسه.
 *
 * والتوقيع (ب) **تابع** للأول لا مستقل: حين يسقط `fetch`، يمرّ التنظيف في
 * `finally` على `closeAllConnections()` ثم `close()` لخادم لا اتصال حيّاً
 * عليه، فيصطدم libuv بتأكيده الأصلي:
 *
 * ```
 * Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 76
 * ```
 *
 * وهو `abort()` يخرج بـ 0xC0000409 بلا رسالة JavaScript — وهذا بالضبط ما كان
 * يُقرأ «سقوطاً بلا سبب».
 *
 * **لماذا لم يمسكه الحارس القديم:** كان يعيد المحاولة حين يكون المنفذ **صفراً**
 * وحده. والصفر لم يقع ولا مرة في ثلاثة آلاف محاولة. الحارس كان يحرس بابًا
 * غير الباب الذي يدخل منه العطل.
 *
 * وهذا ليس تليينًا لاختبار كي يمرّ: المنفذ المحظور خاصية لبيئة التشغيل لا
 * سلوكٌ للمنتج، والحزم تفحص الخادم لا توزيع المنافذ في ويندوز.
 */

/**
 * قائمة المنافذ المحظورة في معيار fetch (WHATWG Fetch — "bad port").
 * تُكتب كاملةً لا مقتطعةً عند 1024: النطاق العابر خاصية جهاز تتغيّر، والقائمة
 * خاصية معيار لا تتغيّر معها.
 */
const FETCH_BLOCKED_PORTS = new Set([
  1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 69, 77, 79,
  87, 95, 101, 102, 103, 104, 109, 110, 111, 113, 115, 117, 119, 123, 135, 137,
  139, 143, 161, 179, 389, 427, 465, 512, 513, 514, 515, 526, 530, 531, 532,
  540, 548, 554, 556, 563, 587, 601, 636, 989, 990, 993, 995, 1719, 1720, 1723,
  2049, 3659, 4045, 4190, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669,
  6697, 10080,
]);

const PORT_ATTEMPTS = 8;

/** هل يقبل `fetch` الاتصال بهذا المنفذ أصلاً؟ */
function isFetchUsablePort(port) {
  return Number.isInteger(port) && port > 0 && !FETCH_BLOCKED_PORTS.has(port);
}

/**
 * يفتح منفذاً عابراً يقبله `fetch`، ويعيد المحاولة إن منح النظام منفذاً
 * صفرياً أو محظوراً.
 *
 * @param {import('node:net').Server} server خادم غير مستمع بعد.
 * @param {number} [attempt] رقم المحاولة، يبدأ من 1.
 * @returns {Promise<number>} رقم المنفذ.
 */
async function listenOnFreePort(server, attempt = 1) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = address && address.port;
  if (isFetchUsablePort(port)) return port;

  await new Promise((resolve) => server.close(resolve));
  if (attempt >= PORT_ATTEMPTS) {
    throw new Error(`تعذّر الحصول على منفذ عابر يقبله fetch بعد ${PORT_ATTEMPTS}`
      + ` محاولات — آخر منفذ ممنوح: ${port}`);
  }
  /* المهلة التصاعدية باقية للحالة الصفرية (نفاد لحظي). والمنفذ المحظور لا
     يحتاج انتظاراً — إعادة الفتح تعطي منفذاً آخر فوراً. */
  if (!port) {
    await new Promise((resolve) => setTimeout(resolve, attempt * 25));
  }
  return listenOnFreePort(server, attempt + 1);
}

module.exports = { listenOnFreePort, isFetchUsablePort, FETCH_BLOCKED_PORTS };
