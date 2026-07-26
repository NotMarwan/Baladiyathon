'use strict';
/**
 * سجل المحوّلات — نقطة واحدة تعرف من يوجد وما يحتاجه كلٌّ منهم للعمل.
 *
 * وأهم ما تعلنه: **لا مزوّد واحد بينهم ينتج حجم حركة**. هذه ليست ملاحظة
 * عابرة — هي السبب في أن `v/c` سيبقى مشتقّاً من افتراض مهما طال الرصد،
 * وفي أن مصدر الحجم يجب أن يُطلب من جهة رسمية لا أن يُشترى من مزوّد مسبار.
 */

const here = require('./here.js');
const tomtom = require('./tomtom.js');
const googleRoutes = require('./google-routes.js');

const PROVIDERS = [here, tomtom, googleRoutes];

function byKey(key) {
  return PROVIDERS.find((provider) => provider.KEY === key) || null;
}

/** أي مزوّد يعطي حجماً؟ */
function volumeProviders() {
  return PROVIDERS.filter((provider) => provider.providesVolume);
}

/**
 * ما الذي يلزم لتشغيل الاتصال الحيّ، ومن ينقصه مفتاحه الآن.
 *
 * @param {object} env عادةً `process.env`.
 */
function readiness(env) {
  const source = env || {};
  return PROVIDERS.map((provider) => {
    const missing = provider.REQUIRED_CREDENTIALS
      .filter((credential) => !source[credential.env]);
    return {
      key: provider.KEY,
      name: provider.name,
      providesVolume: provider.providesVolume,
      ready: missing.length === 0,
      missing: missing.map((credential) => ({
        env: credential.env, what: credential.what, how: credential.how,
      })),
    };
  });
}

module.exports = { PROVIDERS, byKey, readiness, volumeProviders };
