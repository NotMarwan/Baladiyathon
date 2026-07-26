/**
 * مسار — المسارات البديلة على شبكة الرياض كاملة.
 * ---------------------------------------------------------------------------
 * نصّ التحدي الثالث يطلب «اقتراح مسارات بديلة». والاقتراح حُسب أولاً على شبكة
 * اثني عشر ممراً مرسومة يدوياً، ثم على شبكة الشرايين وحدها. كلاهما صحيح
 * الخوارزمية وغير قابل للتصديق: شبكةٌ بلا شوارع أحياء تجبر البديل على الدوران
 * حول الحيّ كله، فيخرج التفافٌ يعرف قارئ الخريطة أنه ليس ما سيفعله أحد.
 *
 * الآن يُحسب على الرسم الكامل — شرايين وشوارع أحياء — وبأربعة حدود تفصل
 * «أقصر مسار في مخطط» عن «طريقٍ يسلكه سائق»:
 *
 * ١) **الاتجاه الواحد يُحترم.** الضلع الموسوم `oneway` يُعبر في جهته وحدها.
 *    بدونه تخرج مساراتٌ أقصر من أي مسار ممكن، ولا يُكتشف الخطأ إلا على الأرض.
 *
 * ٢) **الانعطاف يُحاسَب.** الوزن على الأضلاع وحدها يجعل اختراق خمسين مربعاً
 *    سكنياً مجانياً، فيخرج زمنٌ مضاف مستحيل الصغر. الانعطاف يكلّف: اليسار
 *    يقطع الحركة المقابلة (السعودية تسير يميناً) فيكلّف أضعاف اليمين، والدوران
 *    الكامل أغلاها. ولهذا يبحث المسار على *الأضلاع المتجهة* لا على العقد —
 *    كلفةُ الوصول إلى تقاطع تتوقف على الضلع الذي جئتَ منه.
 *
 * ٣) **الإشارة تأخير.** تأخير التقاطع نصفُ زمن الرحلة داخل مدينة، ولا يُستنتج
 *    من الهندسة. مواقع الإشارات من OSM، وتُسنَد إلى عقد الرسم عند البناء.
 *
 * ٤) **A\* لا ديكسترا بمسحٍ خطي.** الرسم كبر من عشرة آلاف ضلع إلى مئات الآلاف،
 *    ثم تضاعف بالاتجاه. المسح الذي كان يكفي صار ثوانيَ في المتصفح. الكومة
 *    الثنائية تُصلح رتبة الترتيب، والتقدير المتفائل (مسافة مستقيمة ÷ أقصى
 *    سرعة) يحصر البحث حول الإغلاق — والاستعلامات هنا محلية كلها.
 *
 * ونقطة أخيرة تخصّ الصدق: الزمن الحرّ من التصنيف، والحمل مفترض، وعقوبات
 * الانعطاف من رتبة دليل سعة الطرق (HCM). كلها معلنة في صفحة المصادر، ومقيسة
 * مقابل محرّك توجيه مفتوح مستقل — `scripts/calibrate-routing.js`.
 *
 * بيانات الطرق © مساهمو OpenStreetMap — رخصة ODbL.
 *
 * UMD بنفس نمط masar-engine.js. نقية تماماً — تأخذ رسماً وتعيد مسارات،
 * وتُختبر في Node بلا خريطة.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MasarCityRouting = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var METRES_PER_DEGREE = 111320;
  var RIYADH_LAT = 24.71;
  var LON_SCALE = Math.cos((RIYADH_LAT * Math.PI) / 180);

  /** BPR — نفس معاملات المحرك، فيتّفق التوجيه والتقدير على شكل التأخير. */
  var BPR_ALPHA = 0.15;
  var BPR_BETA = 4;

  /**
   * حصة الساعة من الحركة اليومية — نفس ملف masar-routing.js.
   * افتراض توضيحي للعرض: شكلٌ لا عدّاً مقيساً.
   */
  var HOURLY_PROFILE = [
    0.010, 0.007, 0.005, 0.005, 0.007, 0.015,
    0.035, 0.070, 0.080, 0.060, 0.045, 0.045,
    0.048, 0.045, 0.045, 0.048, 0.058, 0.075,
    0.090, 0.070, 0.050, 0.038, 0.028, 0.021,
  ];

  /** مضاعف وزن أضلاع مسارٍ سابق كي ينحرف التالي عنه. توضيحي. */
  var DIVERSITY_PENALTY = 2.4;

  /**
   * أهداف البحث.
   * ---------------------------------------------------------------------------
   * البدائل بعقوبةٍ على أضلاع السابق تنتج مساراتٍ متشابهة: نفس القرار الكبير
   * مع انحرافٍ في آخر مئتي متر. والسائق لا يحتاج نسخةً من مساره، بل قراراً
   * آخر — أقصر، أو داخل الحيّ، أو على الطرق الواسعة.
   *
   * **الهدف سؤالٌ لا قياس.** أوزان البحث هنا تُقرّر أي مسارٍ يُعثر عليه؛ والزمن
   * المعروض يأتي كله من `measure` بالأوزان الحقيقية بلا خصمٍ ولا عقوبة. فخصمُ
   * الشارع الفرعي يسأل «ما أفضل مسارٍ داخل الحيّ؟» ولا يزعم أنه أسرع.
   *
   * `minor` مضاعفُ وزنِ الشارع الفرعي: دونَ الواحد يفضّله، وفوقه يتجنّبه.
   * `junction` مضاعفُ كلفة الانعطاف والتقاطع — دونه لا يدخل بحثٌ حيّاً أبداً:
   *   الحيّ عشرون تقاطعاً في كيلومتر، والشريان اثنان.
   * `corridor` يربط الوزن ببُعد الضلع عن خط العمل، فيبحث عن *تحويلة* لا عن
   *   إعادة تخطيطٍ للرحلة عبر المدينة.
   * `distance` يبدّل وحدة الوزن من الدقيقة إلى الكيلومتر، فتسقط معه كلفة
   *   الانعطاف والتقاطع — وهي كلفةُ زمنٍ لا مسافة.
   *
   * ولماذا لم يكفِ الخصم وحده؟ قيس: بمضاعف 0.65 خرج مسار «الحيّ» مطابقاً
   * لمسار «الأسرع» في 95 من 124 سجلاً. الحساب يقوله: شريانٌ بسبعين كيلومتراً
   * في الساعة يكلّف 0.86 دقيقة للكيلومتر، وسكنيٌّ بثلاثين يكلّف 2.0 — فبعد
   * الخصم يبقى السكني أغلى مرةً ونصفاً، وكلفةُ انعطافاته فوق ذلك بلا خصم.
   * الرقم الذي يقلب القرار ليس تجميلاً بل تصحيحٌ لسؤالٍ كان يُطرح خطأً.
   */
  var OBJECTIVES = {
    fastest: { key: 'fastest', minor: 1, junction: 1, corridor: 0, distance: false },
    local: { key: 'local', minor: 0.7, junction: 0.6, corridor: 1, distance: false },
    minor: { key: 'minor', minor: 0.42, junction: 0.45, corridor: 0.35, distance: false },
    shortest: { key: 'shortest', minor: 1, junction: 0.6, corridor: 0, distance: true },
    major: { key: 'major', minor: 2.2, junction: 1, corridor: 0, distance: false },
  };

  /** مساران يتقاطعان بأكثر من هذا في الطول نسخةٌ من بعضهما لا بديلان. */
  var SAME_ROUTE_OVERLAP = 0.8;

  /** فوق هذه الحصة يُقرأ المسار «داخل الحيّ». */
  var NEIGHBOURHOOD_SHARE = 0.35;

  /**
   * مقياس «داخل الحيّ» شوطٌ متصل لا حصةٌ متفرقة.
   * ---------------------------------------------------------------------------
   * حصةُ الفرعية من الطول تُرضي الإحصاء وتكذب على العين: مسارٌ يلمس شارعاً
   * سكنياً عند بدايته ثم آخرَ عند نهايته يبلغ ثلاثين بالمئة ولم يدخل حيّاً قط.
   * والذي يُرى على الخريطة تحويلةً داخل حيّ هو شوطٌ *متصل* من الشوارع الفرعية
   * يغادر الشبكة الكبرى ويعود إليها. فيُقاس أطول شوطٍ متصل، لا المجموع.
   */
  var EXCURSION_M = 300;

  /**
   * سياسة التوصية بين بدائل متقاربة زمناً.
   * ---------------------------------------------------------------------------
   * الزمن مُقدَّر: سرعات من التصنيف، وحملٌ مفترض، وعقوباتُ انعطافٍ من رتبة
   * دليل السعة. والمسافة *مقيسة* من هندسة الطريق. فحين يفصل بين بديلين فرقٌ
   * زمني أصغر من خطأ النموذج نفسه، الترجيح بالزمن ترجيحٌ بالضجيج.
   *
   * والقاعدة المعلنة: بين ما تقارب زمنُه يُوصى بالأقصر مسافةً — أقلّ انكشافاً
   * لخطأ التقدير، وأقلّ وقوداً، وأوضحُ على الخريطة. وهذا بالضبط ما يقلب
   * التفافاً شريانياً بعشرة كيلومترات إلى تحويلةٍ محلية بأربعة.
   */
  var TOLERANCE_MIN = 3;
  var TOLERANCE_PCT = 0.15;

  /** أبطأ من هذا المضاعف لا يُعرض مسار الحيّ ولو كان الوحيد الداخل. */
  var NEIGHBOUR_MAX_FACTOR = 1.6;

  /** مقياس البعد في وزن الممر: على هذا تُقسم المسافة عن خط العمل. */
  var CORRIDOR_M = 400;

  /** سقف مضاعف البعد — وإلا صار البعيد ممنوعاً لا مكلّفاً. */
  var CORRIDOR_CAP = 6;

  /**
   * نافذة البحث المحلي.
   * ---------------------------------------------------------------------------
   * ضربُ الوزن بالبعد يُبطئ A\* إبطاءً شديداً: التقدير يبقى صغيراً بينما الكلفة
   * تتضخّم سبعة أضعاف، فينهار البحث الموجَّه إلى مسحٍ شبه شامل — قيس 494 مللي
   * للسجل الواحد، وهو زمنٌ يُحسّ تحت الإصبع.
   *
   * والحدّ هنا ليس تحسيناً فحسب بل تعريف: تحويلةٌ تبتعد ثلاثة كيلومترات عن
   * العمل لم تعد تحويلة. فالبحث المحلي يُحبس في نافذةٍ حول خط العمل، والبحث
   * غير المحلي (الأسرع والأوسع) يبقى بلا حدّ — فهو الذي يجيب عن الإغلاقات
   * التي لا جوار لها أصلاً.
   */
  var WINDOW_MIN_M = 2500;
  var WINDOW_SPAN_FACTOR = 3;

  /**
   * صرفُ كلفةِ التقاطع إلى مسافة، لهدف المسافة وحده.
   * ---------------------------------------------------------------------------
   * «الأقصر» بلا حسابٍ للانعطاف ليس أقصر بل أكثر تعرّجاً: قيس فبلغ 9.2 انعطافاً
   * في الكيلومتر — شبكةُ حيٍّ تُقطَع مربعاً مربعاً لتوفير أمتار. ولا سائق يفعله.
   *
   * والصرف بسرعة شارع الحيّ: دقيقةٌ تساوي نصف كيلومتر. فالانعطاف يميناً (أربع
   * ثوانٍ) يساوي 33 متراً، والإشارة (اثنتان وعشرون) تساوي 183 — وهي بالضبط رتبةُ
   * ما يقبله سائقٌ من لفّةٍ ليتجنّب إشارة.
   */
  var DISTANCE_KM_PER_MIN = 0.5;

  /** أقصرُ بأقلّ من هذا ليس أقصر — لا تُقلب التوصية لأجل خمسين متراً. */
  var MEANINGFUL_SHORTER_M = 400;
  var MEANINGFUL_SHORTER_PCT = 0.08;

  /** أبعد من هذا عن أقرب عقدة يعني أن الموقع خارج الشبكة المعروفة. */
  var MAX_SNAP_M = 900;

  /** الضلع مغلق إن مرّ ضمن هذه المسافة من خط العمل. */
  var CLOSURE_NEAR_M = 45;

  /** أقصى سرعة في الشبكة — أساس التقدير المتفائل في A\*. */
  var MAX_KMH = 100;

  /** ملامح احتياطية إن لم يحمل الرسم جدوله (رسمٌ من نسخة أقدم). */
  var FALLBACK_CLASS = { kmh: 45, lanes: 2, capacity: 1800, aadt: 9000 };
  var FALLBACK_TURN = {
    straightDeg: 25, uTurnDeg: 135, rightSec: 4, leftSec: 11, uTurnSec: 25,
  };
  var FALLBACK_CONTROL = [0, 6, 22];

  function metresBetween(a, b) {
    var dx = (a[0] - b[0]) * METRES_PER_DEGREE * LON_SCALE;
    var dy = (a[1] - b[1]) * METRES_PER_DEGREE;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** أقرب مسافة من نقطة إلى قطعة مستقيمة، بالمتر. */
  function distanceToSegment(point, a, b) {
    var px = (point[0] - a[0]) * METRES_PER_DEGREE * LON_SCALE;
    var py = (point[1] - a[1]) * METRES_PER_DEGREE;
    var dx = (b[0] - a[0]) * METRES_PER_DEGREE * LON_SCALE;
    var dy = (b[1] - a[1]) * METRES_PER_DEGREE;
    var span = dx * dx + dy * dy;
    var t = span > 0 ? Math.max(0, Math.min(1, (px * dx + py * dy) / span)) : 0;
    return Math.hypot(px - dx * t, py - dy * t);
  }

  /**
   * فرق اتجاهين إلى النطاق (−180، 180].
   * الموجب انعطافٌ مع عقارب الساعة — يميناً في اصطلاح البوصلة.
   */
  function angleDelta(to, from) {
    return ((to - from) % 360 + 540) % 360 - 180;
  }

  /* ---- كومة ثنائية صغرى ---- */

  /**
   * مصفوفتان متوازيتان لا مصفوفة كائنات: عشرات الآلاف من الكائنات الصغيرة
   * تُتعب جامع المهملات أثناء تفاعلٍ يُنتظر منه أن يكون فورياً.
   */
  function Heap() {
    this.priority = [];
    this.state = [];
  }
  Heap.prototype.size = function () { return this.state.length; };
  Heap.prototype.swap = function (i, j) {
    var p = this.priority[i]; this.priority[i] = this.priority[j]; this.priority[j] = p;
    var s = this.state[i]; this.state[i] = this.state[j]; this.state[j] = s;
  };
  Heap.prototype.push = function (priority, state) {
    var at = this.state.length;
    this.priority.push(priority);
    this.state.push(state);
    while (at > 0) {
      var parent = (at - 1) >> 1;
      if (this.priority[parent] <= this.priority[at]) break;
      this.swap(parent, at);
      at = parent;
    }
  };
  Heap.prototype.pop = function () {
    var top = this.state[0];
    var last = this.state.length - 1;
    this.priority[0] = this.priority[last];
    this.state[0] = this.state[last];
    this.priority.pop();
    this.state.pop();
    var at = 0;
    var count = this.state.length;
    for (;;) {
      var left = 2 * at + 1;
      var right = left + 1;
      var best = at;
      if (left < count && this.priority[left] < this.priority[best]) best = left;
      if (right < count && this.priority[right] < this.priority[best]) best = right;
      if (best === at) break;
      this.swap(best, at);
      at = best;
    }
    return top;
  };

  /* ---- التهيئة ---- */

  /**
   * يهيّئ الرسم للاستعلام: الأضلاع الخارجة من كل عقدة، وشبكةٌ مكانية للإسناد.
   * يُنادى مرة؛ الاستعلامات بعده تقرأ ولا تبني.
   *
   * الحالة في البحث ضلعٌ متجه لا عقدة: `2*e` عبورُ الضلع من a إلى b،
   * و`2*e+1` عكسه. وهذا شرط عقوبة الانعطاف — كلفةُ تقاطعٍ تتوقف على ضلع الدخول.
   */
  function prepare(graph) {
    var meta = graph.metadata || {};
    var outgoing = [];
    var incoming = [];
    var adjacency = [];
    var i;
    for (i = 0; i < graph.nodes.length; i += 1) {
      outgoing.push([]); incoming.push([]); adjacency.push([]);
    }

    for (i = 0; i < graph.edges.length; i += 1) {
      var edge = graph.edges[i];
      var direction = edge[5] || 0;
      adjacency[edge[0]].push(i);
      adjacency[edge[1]].push(i);
      // الحالة الزوجية a→b والفردية b→a؛ الاتجاه يقرّر أيّهما مسموح.
      if (direction >= 0) { outgoing[edge[0]].push(2 * i); incoming[edge[1]].push(2 * i); }
      if (direction <= 0) { outgoing[edge[1]].push(2 * i + 1); incoming[edge[0]].push(2 * i + 1); }
    }

    /**
     * قيود الانعطاف جدولٌ مُسطَّح: `ضلعُ الدخول:العقدة:ضلعُ الخروج`.
     * البحث يسأل عنه عند كل انتقال، فيجب أن يكون السؤال ثابت الزمن — ومصفوفةٌ
     * تُمسح عند كل جار تحوّل بحثاً محلياً إلى بحثٍ تربيعي.
     */
    var forbidden = {};
    var rules = graph.restrictions || [];
    for (i = 0; i < rules.length; i += 1) {
      forbidden[rules[i][0] + ':' + rules[i][1] + ':' + rules[i][2]] = 1;
    }

    // خلية بحجم الإسناد الأقصى: البحث يبقى في تسع خلايا مهما كبرت الشبكة.
    var cell = MAX_SNAP_M / (METRES_PER_DEGREE * LON_SCALE);
    var buckets = {};
    for (i = 0; i < graph.nodes.length; i += 1) {
      if (!graph.inMain[i]) continue;
      var node = graph.nodes[i];
      var key = Math.floor(node[0] / cell) + ':' + Math.floor(node[1] / cell);
      (buckets[key] || (buckets[key] = [])).push(i);
    }

    return {
      graph: graph,
      outgoing: outgoing,
      incoming: incoming,
      adjacency: adjacency,
      buckets: buckets,
      cell: cell,
      classes: meta.classes || null,
      turn: meta.turn || FALLBACK_TURN,
      controlSeconds: meta.controlSeconds || FALLBACK_CONTROL,
      control: graph.control || null,
      forbidden: forbidden,
    };
  }

  /** أقرب عقدة في المكوّن الرئيس، أو -1 إن كان الموقع خارج الشبكة. */
  function nearestNode(prepared, point) {
    var gx = Math.floor(point[0] / prepared.cell);
    var gy = Math.floor(point[1] / prepared.cell);
    var best = -1;
    var bestDistance = MAX_SNAP_M;
    for (var dx = -1; dx <= 1; dx += 1) {
      for (var dy = -1; dy <= 1; dy += 1) {
        var list = prepared.buckets[(gx + dx) + ':' + (gy + dy)];
        if (!list) continue;
        for (var i = 0; i < list.length; i += 1) {
          var distance = metresBetween(point, prepared.graph.nodes[list[i]]);
          if (distance < bestDistance) { bestDistance = distance; best = list[i]; }
        }
      }
    }
    return best;
  }

  /* ---- الأوزان ---- */

  /** ملامح تصنيف الضلع — من جدول الرسم، أو الاحتياطي لرسمٍ لا يحمله. */
  function classOf(prepared, edge) {
    if (!prepared.classes) return FALLBACK_CLASS;
    return prepared.classes[edge[6]] || FALLBACK_CLASS;
  }

  /** الشوارع التي يسكنها الناس لا التي تعبرهم — أساس حصة «داخل الحيّ». */
  var MINOR_NAMES = { residential: 1, living_street: 1, unclassified: 1 };

  function isMinorClass(prepared, edge) {
    var profile = classOf(prepared, edge);
    return !!MINOR_NAMES[profile.name];
  }

  /**
   * زمن عبور الضلع بالدقائق عند ساعة معطاة.
   * الحمل المفترض من التصنيف وعدد المسارات: البيانات المفتوحة لا تحمل عدّاً
   * لكل مقطع، والتصنيف أفضل ما يتاح. معلنٌ في البيانات الوصفية.
   */
  function edgeMinutes(prepared, edge, hour) {
    return edgeLoad(prepared, edge, hour, 0).minutes;
  }

  /**
   * حمل الضلع وزمنه عند ساعة، مع حركة محوَّلة إضافية اختيارية (WP-R1).
   *
   * كان الزمن يُحسب من الحركة الأساسية وحدها، فيُعرض بديلٌ يبدو سالكاً وهو
   * الذي سيستقبل حركة الإغلاق. **البديل الذي لا يُحمَّل ليس بديلاً بل خطّ
   * على خريطة.**
   *
   * الدالة واحدة عمداً: `edgeMinutes` تناديها بصفر. حسابُ حملٍ في مكان وحسابُ
   * زمنٍ في مكان آخر يفترقان عند أول تعديل، فيصير الزمن المعروض من معادلة
   * والسعة المعروضة من أخرى.
   *
   * @param {number} extraVehPerHour حركة محوَّلة تُضاف إلى حجم الضلع
   * @returns {{minutes:number, volume:number, capacity:number, ratio:number}}
   */
  function edgeLoad(prepared, edge, hour, extraVehPerHour) {
    var freeFlow = edge[3];
    var profile = classOf(prepared, edge);
    var lanes = edge[4] || profile.lanes;
    var capacity = lanes * profile.capacity;
    var share = HOURLY_PROFILE[((hour % 24) + 24) % 24];
    var volume = lanes * profile.aadt * share + Math.max(0, extraVehPerHour || 0);
    if (!(capacity > 0)) {
      return { minutes: freeFlow, volume: volume, capacity: 0, ratio: Infinity };
    }
    var ratio = volume / capacity;
    return {
      minutes: freeFlow * (1 + BPR_ALPHA * Math.pow(ratio, BPR_BETA)),
      volume: volume,
      capacity: capacity,
      ratio: ratio,
    };
  }

  /**
   * الحركة المحوَّلة عن الإغلاق، مركبةً في الساعة.
   *
   * القاعدة هي المعلنة نفسها في محرك الممر (`masar-routing.js`): حصةُ الطلب
   * المرتبطة بالمسارات المغلقة تتحوّل. قاعدة عرضٍ صريحة، لا معايرةَ اختيارِ
   * سائقٍ مقيسة.
   *
   * والطلب يُؤخذ **أقصى ضلع مغلق لا مجموع الأضلاع**: الإغلاق مقطعٌ من ممر،
   * وأضلاعه تحمل التدفق نفسه تقريباً. جمعُها يعدّ المركبات نفسها مرات.
   *
   * @returns {{vehPerHour:number, lanesClosed:number, lanes:number, rule:string}}
   */
  function divertedDemand(prepared, banned, hour, lanesClosed) {
    var graph = prepared.graph;
    var share = HOURLY_PROFILE[((hour % 24) + 24) % 24];
    var peak = 0;
    var peakLanes = 0;
    Object.keys(banned || {}).forEach(function (key) {
      var edge = graph.edges[Number(key)];
      if (!edge) return;
      var profile = classOf(prepared, edge);
      var lanes = edge[4] || profile.lanes;
      var demand = lanes * profile.aadt * share;
      if (demand > peak) { peak = demand; peakLanes = lanes; }
    });

    var closed = Math.max(0, Math.min(lanesClosed || 0, peakLanes));
    var fraction = peakLanes > 0 ? closed / peakLanes : 0;
    return {
      vehPerHour: peak * fraction,
      lanesClosed: closed,
      lanes: peakLanes,
      rule: 'حصة الطلب المرتبطة بالمسارات المغلقة تتحوّل — قاعدة عرض معلنة، '
        + 'لا معايرة اختيار سائق مقيسة.',
    };
  }

  /**
   * أثر تحميل البديل بالحركة المحوَّلة.
   *
   * تُوزَّع الحركة المحوَّلة على **كل** ضلع من البديل بالكامل: من خرج عند
   * بداية التحويلة يسير عليها إلى نهايتها. توزيعها بالحصص يفترض تسرّباً
   * جانبياً لا تملك الشبكة دليلاً عليه.
   *
   * @returns {object} النسب قبل وبعد، والضلع الحاكم، والزمن بعد التحميل
   */
  function loadRoute(prepared, route, divertedVehPerHour, hour) {
    var graph = prepared.graph;
    var edges = route.edges || [];
    var before = 0;
    var after = 0;
    var bindingIndex = -1;
    var minutesAfter = 0;

    edges.forEach(function (index) {
      var edge = graph.edges[index];
      var plain = edgeLoad(prepared, edge, hour, 0);
      var loaded = edgeLoad(prepared, edge, hour, divertedVehPerHour);
      if (plain.ratio > before) before = plain.ratio;
      if (loaded.ratio > after) { after = loaded.ratio; bindingIndex = index; }
      minutesAfter += loaded.minutes;
    });

    /* زمن الانعطاف والتحكّم لا يتغيّر بالحجم في هذا النموذج، فيُنقل كما هو
       بدل إسقاطه — إسقاطه يجعل الزمن المحمَّل يبدو أقلّ من غير المحمَّل. */
    minutesAfter += (route.turnMinutes || 0) + (route.controlMinutes || 0);

    return {
      divertedVehPerHour: divertedVehPerHour,
      maxRatioBefore: before,
      maxRatioAfter: after,
      overflows: after > 1,
      bindingStreet: bindingIndex >= 0 ? nameOf(graph, bindingIndex) : '',
      bindingEdge: bindingIndex,
      minutesAfter: minutesAfter,
    };
  }

  /** اتجاه السير خارجاً من طرفٍ من الضلع: من a أو من b. */
  function bearingAt(edge, atA) { return atA ? edge[7] : edge[8]; }

  /** رأس الحالة المتجهة: العقدة التي نصل إليها. */
  function headOf(graph, state) {
    var edge = graph.edges[state >> 1];
    return (state & 1) === 0 ? edge[1] : edge[0];
  }

  /** ذيل الحالة المتجهة: العقدة التي انطلقنا منها. */
  function tailOf(graph, state) {
    var edge = graph.edges[state >> 1];
    return (state & 1) === 0 ? edge[0] : edge[1];
  }

  /**
   * عقوبة الانعطاف بالدقائق بين ضلعين متجهين يلتقيان في عقدة.
   * `arrive` الضلع المتجه الذي وصلنا به، و`leave` الذي سنغادر به.
   */
  function turnMinutes(prepared, arrive, leave) {
    var graph = prepared.graph;
    var arriveEdge = graph.edges[arrive >> 1];
    var leaveEdge = graph.edges[leave >> 1];
    // بالحالة الزوجية a→b رأسُنا b فاتجاه الوصول عكسُ اتجاه الخروج من b.
    var arriveHeading = bearingAt(arriveEdge, (arrive & 1) === 1) + 180;
    var leaveHeading = bearingAt(leaveEdge, (leave & 1) === 0);
    var delta = angleDelta(leaveHeading, arriveHeading);
    var turn = prepared.turn;
    var seconds;
    if (Math.abs(delta) <= turn.straightDeg) seconds = 0;
    else if (Math.abs(delta) >= turn.uTurnDeg) seconds = turn.uTurnSec;
    else seconds = delta > 0 ? turn.rightSec : turn.leftSec;
    return seconds / 60;
  }

  /** متوسط حصة الساعة — أساس نسبة الذروة إلى اليوم. */
  var MEAN_SHARE = 1 / 24;

  /** حدّا مضاعف التقاطع: لا تختفي الإشارة ليلاً ولا تبتلع الرحلة ذروةً. */
  var CONTROL_MIN_FACTOR = 0.4;
  var CONTROL_MAX_FACTOR = 1.8;

  /**
   * تأخير عقدة التحكّم بالدقائق، تابعاً للساعة.
   * ---------------------------------------------------------------------------
   * تأخيرٌ ثابت على مدار اليوم يجعل الثالثة فجراً كالثامنة صباحاً، وقيس ذلك:
   * ×1.171 مقابل ×1.194 من مرجع مستقل — فرقٌ لا يُقرأ. والواقع أن دورة الإشارة
   * تطول في الذروة ويتراكم الطابور خلفها، فالتأخير يتبع الحمل لا الساعة وحدها.
   *
   * المضاعف نسبةُ حصة الساعة إلى متوسط اليوم، محدودةً من الطرفين: الإشارة لا
   * تختفي ليلاً، ولا تبتلع الرحلة كلها ذروةً.
   */
  function controlMinutes(prepared, node, hour) {
    if (!prepared.control) return 0;
    var level = prepared.control[node] || 0;
    var seconds = prepared.controlSeconds[level] || 0;
    if (!seconds) return 0;
    if (typeof hour !== 'number') return seconds / 60;
    var share = HOURLY_PROFILE[((hour % 24) + 24) % 24];
    var factor = Math.max(CONTROL_MIN_FACTOR,
      Math.min(CONTROL_MAX_FACTOR, share / MEAN_SHARE));
    return (seconds * factor) / 60;
  }

  /* ---- البحث ---- */

  /**
   * أقصر مسار زمناً بين عقدتين، بعقوبات الانعطاف والتحكّم.
   * ---------------------------------------------------------------------------
   * A\* على الأضلاع المتجهة. التقدير مسافةٌ مستقيمة من رأس الحالة إلى الهدف
   * مقسومةً على أقصى سرعة في الشبكة — متفائل دائماً، فالنتيجة مثلى لا تقريبية.
   *
   * خرائطُ بدل مصفوفات كاملة: البحث محليّ (حول إغلاق) فيلمس آلافاً من مئات
   * الآلاف، وتخصيصُ مصفوفتين بحجم الشبكة عند كل نداء يكلّف أكثر من البحث نفسه.
   */
  function shortestPath(prepared, from, to, options) {
    var opts = options || {};
    var hour = typeof opts.hour === 'number' ? opts.hour : 8;
    var banned = opts.banned || {};
    var penalised = opts.penalised || {};
    var objective = opts.objective || OBJECTIVES.fastest;
    var corridor = opts.corridor || null;
    // النافذة تخصّ البحث المحلي وحده — بلا ممر لا معنى لحدٍّ حول العمل.
    var window = (corridor && opts.window) ? opts.window : 0;
    var junctionFactor = objective.junction === undefined ? 1 : objective.junction;
    var graph = prepared.graph;
    var target = graph.nodes[to];

    /**
     * وزن الضلع بوحدة الهدف: كيلومتراً في هدف المسافة، ودقيقةً فيما عداه.
     * مضاعفُ الممر يزيد ولا ينقص، فيبقى تقديرُ A\* متفائلاً والنتيجةُ مثلى.
     */
    function weightOf(index) {
      var edge = graph.edges[index];
      var base = objective.distance
        ? edge[2] / 1000
        : edgeMinutes(prepared, edge, hour);
      if (objective.minor !== 1 && isMinorClass(prepared, edge)) base *= objective.minor;
      if (objective.corridor && corridor) {
        var away = corridor(index);
        base *= 1 + objective.corridor * Math.min(CORRIDOR_CAP, away / CORRIDOR_M);
      }
      return base;
    }

    /** التقدير يبقى متفائلاً بعد التخفيض، وإلا لم تعد النتيجة مثلى. */
    var floor = Math.min(1, objective.minor);

    if (from === to) {
      return {
        edges: [], states: [], minutes: 0, driveMinutes: 0,
        turnMinutes: 0, controlMinutes: 0, lengthM: 0,
      };
    }

    var best = {};
    var cameFrom = {};
    var settled = {};
    var heap = new Heap();

    function estimate(node) {
      var km = metresBetween(graph.nodes[node], target) / 1000;
      return (objective.distance ? km : (km / MAX_KMH) * 60) * floor;
    }

    var start = prepared.outgoing[from];
    for (var s = 0; s < start.length; s += 1) {
      var first = start[s];
      if (banned[first >> 1]) continue;
      if (window && corridor(first >> 1) > window) continue;
      var weight = weightOf(first >> 1);
      if (penalised[first >> 1]) weight *= DIVERSITY_PENALTY;
      if (best[first] === undefined || weight < best[first]) {
        best[first] = weight;
        cameFrom[first] = -1;
        heap.push(weight + estimate(headOf(graph, first)), first);
      }
    }

    var goal = -1;
    while (heap.size()) {
      var state = heap.pop();
      if (settled[state]) continue;
      settled[state] = 1;
      var head = headOf(graph, state);
      if (head === to) { goal = state; break; }

      var cost = best[state];
      var exits = prepared.outgoing[head];
      for (var x = 0; x < exits.length; x += 1) {
        var next = exits[x];
        if (settled[next]) continue;
        var edgeIndex = next >> 1;
        if (banned[edgeIndex]) continue;
        if (window && corridor(edgeIndex) > window) continue;
        // منعُ الانعطاف يُقرأ من ضلع الدخول والعقدة وضلع الخروج معاً — ولهذا
        // وحدَه لا يكفي بحثٌ على العقد: العقدة لا تعرف من أين جئت.
        if (prepared.forbidden[(state >> 1) + ':' + head + ':' + edgeIndex]) continue;
        // العودة على الضلع نفسه دورانٌ كامل — مسموحٌ بكلفته لا ممنوع.
        var step = weightOf(edgeIndex);
        if (penalised[edgeIndex]) step *= DIVERSITY_PENALTY;
        // كلفة الانعطاف والتقاطع زمنٌ؛ وفي هدف المسافة تُصرَف إلى كيلومترات.
        var junctionCost = 0;
        if (junctionFactor !== 0) {
          junctionCost = junctionFactor * (turnMinutes(prepared, state, next)
            + controlMinutes(prepared, head, hour));
          if (objective.distance) junctionCost *= DISTANCE_KM_PER_MIN;
        }
        var through = cost + step + junctionCost;
        if (best[next] !== undefined && through >= best[next]) continue;
        best[next] = through;
        cameFrom[next] = state;
        heap.push(through + estimate(headOf(graph, next)), next);
      }
    }

    if (goal === -1) return null;

    var states = [];
    var at = goal;
    while (at !== -1 && at !== undefined) {
      states.push(at);
      at = cameFrom[at];
    }
    states.reverse();

    return measure(prepared, states, hour);
  }

  /**
   * قياس مسارٍ جاهز: كل رقمٍ يُعرض للمستعمل يُحسب هنا من هندسة المسار نفسها.
   * ---------------------------------------------------------------------------
   * لا رقم تقريبي ولا ثابت: الطول مجموع أطوال الأضلاع المسلوكة، والزمن مجموع
   * أزمنتها زائد كلفة كل انعطافٍ وتقاطعٍ فعليّين، وحصةُ الشوارع الفرعية طولٌ
   * مقسومٌ على طول لا تخمين. ما لا يُحسب لا يُعرض.
   */
  function measure(prepared, states, hour) {
    var graph = prepared.graph;
    var turn = prepared.turn;
    var edges = [];
    var lengthM = 0;
    var minorM = 0;
    var majorM = 0;
    var driveMinutes = 0;
    var turnTotal = 0;
    var controlTotal = 0;
    var turns = 0;
    var signals = 0;
    var stops = 0;
    // أطول شوطٍ متصل من الشوارع الفرعية — مقياسُ «دخل الحيّ» فعلاً.
    var runM = 0;
    var runStart = -1;
    var bestRun = 0;
    var bestFrom = -1;
    var bestTo = -1;

    for (var i = 0; i < states.length; i += 1) {
      var index = states[i] >> 1;
      var edge = graph.edges[index];
      edges.push(index);
      lengthM += edge[2];
      if (isMinorClass(prepared, edge)) {
        if (runStart < 0) runStart = i;
        runM += edge[2];
      } else {
        if (runM > bestRun) { bestRun = runM; bestFrom = runStart; bestTo = i - 1; }
        runM = 0;
        runStart = -1;
      }
      if (isMinorClass(prepared, edge)) minorM += edge[2];
      else majorM += edge[2];
      driveMinutes += edgeMinutes(prepared, edge, hour);
      if (i > 0) {
        var junction = tailOf(graph, states[i]);
        var cost = turnMinutes(prepared, states[i - 1], states[i]);
        turnTotal += cost;
        // الانعطاف المعدود هو ما يكلّف: المرور المستقيم عبر تقاطع ليس انعطافاً.
        if (cost > 0) turns += 1;
        controlTotal += controlMinutes(prepared, junction, hour);
        var level = prepared.control ? prepared.control[junction] || 0 : 0;
        if (level === 2) signals += 1;
        else if (level === 1) stops += 1;
      }
    }

    if (runM > bestRun) { bestRun = runM; bestFrom = runStart; bestTo = states.length - 1; }

    return {
      edges: edges,
      states: states,
      minutes: driveMinutes + turnTotal + controlTotal,
      driveMinutes: driveMinutes,
      turnMinutes: turnTotal,
      controlMinutes: controlTotal,
      lengthM: lengthM,
      minorMetres: minorM,
      majorMetres: majorM,
      minorShare: lengthM > 0 ? minorM / lengthM : 0,
      excursionM: bestRun,
      insideNeighbourhood: bestRun >= EXCURSION_M,
      excursion: excursionDetail(prepared, edges, bestFrom, bestTo, bestRun),
      turns: turns,
      signals: signals,
      stops: stops,
      turnBudget: turn,
    };
  }

  /** اسم الشارع الذي يحمله ضلع، أو فراغ. */
  function nameOf(graph, edgeIndex) {
    var ref = graph.edges[edgeIndex][9];
    if (ref === undefined || ref < 0) return '';
    return (graph.names || [])[ref] || '';
  }

  /**
   * تفصيل الشوط داخل الحيّ: من أين غادر، وبأي شوارع مرّ، وأين عاد.
   * ---------------------------------------------------------------------------
   * هذا ما يطلبه قارئ الخريطة: لا «٦٥٪ فرعية» بل «اخرج من طريق الأمير، ادخل
   * الشوكي وعمرو بن العاص، وعُد إلى طريق الملك». الشارع قبل الشوط هو المغادرة،
   * والشارع بعده هو العودة — ويُقرآن من المسار لا يُخمَّنان.
   */
  function excursionDetail(prepared, edges, from, to, lengthM) {
    if (from < 0 || lengthM < EXCURSION_M) return null;
    var graph = prepared.graph;
    var streets = [];
    for (var i = from; i <= to; i += 1) {
      var name = nameOf(graph, edges[i]);
      if (name && name !== streets[streets.length - 1]) streets.push(name);
    }
    return {
      lengthM: lengthM,
      leaveAt: from > 0 ? nameOf(graph, edges[from - 1]) : '',
      rejoinAt: to < edges.length - 1 ? nameOf(graph, edges[to + 1]) : '',
      streets: streets,
      fromEdge: edges[from],
      toEdge: edges[to],
    };
  }

  /* ---- الإغلاق ---- */

  /**
   * الأضلاع التي يغلقها خط عمل — بالقرب لا بالاسم.
   * اسم الشارع يتكرر على مقاطع متباعدة في المدينة، فإغلاقٌ باسمٍ يغلق شوارع
   * لم تُغلق. القرب يصيب المقطع وحده.
   */
  function edgesUnderClosure(prepared, line) {
    var graph = prepared.graph;
    var closed = {};
    if (!line || line.length < 2) return closed;

    /** صندوقٌ حول خط العمل بهامش القرب — يُسقط جسد الشبكة قبل أي قياس دقيق. */
    var minLon = Infinity; var maxLon = -Infinity;
    var minLat = Infinity; var maxLat = -Infinity;
    var v;
    for (v = 0; v < line.length; v += 1) {
      if (line[v][0] < minLon) minLon = line[v][0];
      if (line[v][0] > maxLon) maxLon = line[v][0];
      if (line[v][1] < minLat) minLat = line[v][1];
      if (line[v][1] > maxLat) maxLat = line[v][1];
    }
    var padLon = CLOSURE_NEAR_M / (METRES_PER_DEGREE * LON_SCALE);
    var padLat = CLOSURE_NEAR_M / METRES_PER_DEGREE;
    minLon -= padLon; maxLon += padLon; minLat -= padLat; maxLat += padLat;

    /**
     * القرب يُقاس في الاتجاهين.
     * قياسُ مركز الضلع وحده إلى الخط يُسقط ضلعاً طويلاً يمرّ خط عملٍ قصيرٌ على
     * طرفه — مركزه بعيد وجسده ملامس. وقياسُ رؤوس الخط وحدها إلى الضلع يُسقط
     * خطاً طويلاً يعبر ضلعاً قصيراً بين رأسين. فيُقاس الاثنان.
     */
    for (var e = 0; e < graph.edges.length; e += 1) {
      var edge = graph.edges[e];
      var a = graph.nodes[edge[0]];
      var b = graph.nodes[edge[1]];
      if (Math.max(a[0], b[0]) < minLon || Math.min(a[0], b[0]) > maxLon) continue;
      if (Math.max(a[1], b[1]) < minLat || Math.min(a[1], b[1]) > maxLat) continue;

      var hit = false;
      for (v = 0; v < line.length && !hit; v += 1) {
        if (distanceToSegment(line[v], a, b) <= CLOSURE_NEAR_M) hit = true;
      }
      if (!hit) {
        var middle = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        for (var i = 1; i < line.length && !hit; i += 1) {
          if (distanceToSegment(a, line[i - 1], line[i]) <= CLOSURE_NEAR_M
            || distanceToSegment(b, line[i - 1], line[i]) <= CLOSURE_NEAR_M
            || distanceToSegment(middle, line[i - 1], line[i]) <= CLOSURE_NEAR_M) hit = true;
        }
      }
      if (hit) closed[e] = true;
    }
    return closed;
  }

  /**
   * طرفا الإغلاق: العقدتان اللتان يدخل الإغلاق من إحداهما ويخرج من الأخرى.
   * ---------------------------------------------------------------------------
   * أول صياغة أسندت طرفَي خط العمل إلى أقرب عقدتين ثم وجّهت بينهما. وقيس أثرها:
   * في 46 من 73 حالة لم تقع الأضلاع المغلقة على المسار الأساس أصلاً — لأن
   * الإسناد التقط عقدة على شارع موازٍ، فخرج «بديل» يساوي الأصل ولا يقول شيئاً.
   *
   * الصياغة الصحيحة تبدأ من الإغلاق لا من الخط: العقد التي تمسّ ضلعاً مغلقاً
   * ولها ضلع مفتوح هي حافة الإغلاق. وتُعاد هنا *كل* الأزواج مرتّبةً بالبُعد،
   * لأن الأبعد ليس دائماً الصالح — والاختيار بينها في `solveBoundary`.
   */
  function closureBoundaries(prepared, banned, line) {
    var graph = prepared.graph;
    var touched = {};
    Object.keys(banned).forEach(function (id) {
      var edge = graph.edges[id];
      touched[edge[0]] = true;
      touched[edge[1]] = true;
    });

    /**
     * الطرفان ليسا متكافئين حين تُحترم الاتجاهات.
     * ---------------------------------------------------------------------------
     * أول صياغة أخذت أبعد عقدتين تمسّان الإغلاق ولهما ضلعٌ مفتوح — أي ضلع.
     * وعلى مسارٍ باتجاه واحد يعني «مفتوح» أحياناً *داخلاً* فقط: تصل العقدة ولا
     * تغادرها إلا عبر المغلق. فيخرج «لا التفاف» في 42 من 134 سجلاً، والحقيقة
     * أن الالتفاف موجود ويبدأ من تقاطعٍ قبلها — كما يفعل السائق حين يرى اللوحة.
     *
     * فالبداية تشترط مخرجاً مفتوحاً، والنهاية تشترط مدخلاً مفتوحاً. والقديم
     * يبقى احتياطاً: شرطٌ لا يجد مرشحاً خيرٌ منه شرطٌ يُسقط الحالة كلها.
     */
    var starts = [];
    var ends = [];
    var loose = [];
    Object.keys(touched).forEach(function (key) {
      var node = Number(key);
      if (!graph.inMain[node]) return;
      var out = prepared.outgoing[node].some(function (s) { return !banned[s >> 1]; });
      var into = prepared.incoming[node].some(function (s) { return !banned[s >> 1]; });
      if (out) starts.push(node);
      if (into) ends.push(node);
      if (out || into) loose.push(node);
    });

    var pairs = rankedPairs(graph, starts, ends, line);
    if (!pairs.length) pairs = rankedPairs(graph, loose, loose, line);
    return pairs;
  }

  /**
   * أقصى نسبة بين طول الأساس والفجوة قبل أن يُقرأ الزوج «ليسا طرفَي مقطع».
   * ---------------------------------------------------------------------------
   * جُرّب الضعفُ وشيء فسقطت اثنتا عشرة حالة صالحة: على مسارٍ باتجاه واحد يكون
   * الوصول من طرفٍ إلى طرف عبر الإغلاق أطول من الخط المستقيم أربعة أضعاف —
   * لا لأن الطرفين على فرعين مختلفين بل لأن العودة ممنوعة. والشرط الذي يفصل
   * فعلاً هو عبورُ الأساس للإغلاق، والنسبةُ سقفٌ فضفاض يمنع الشاذّ وحده.
   */
  var BOUNDARY_RATIO = 5;

  /**
   * سقف المحاولات: كل محاولة بحثان، والتفاعل يُنتظر منه أن يكون فورياً.
   * والانحراف متماثل بين الجهتين، فكل زوجٍ يُجرَّب بجهتيه متتاليتين — وهذا
   * مقصود: جهةٌ واحدة من الاثنتين هي التي تعبر الإغلاق.
   */
  var BOUNDARY_TRIES = 8;

  /** زوجٌ أضيق من هذه الحصة من الأوسع يؤطّر جزءاً من الإغلاق لا الإغلاق. */
  var BOUNDARY_MIN_SHARE = 0.45;

  /**
   * الأزواج الممكنة مرتّبةً بمحاذاة خط العمل ثم بالبُعد.
   * ---------------------------------------------------------------------------
   * الترتيب بالبُعد وحده يُقدّم أزواجاً على فرعين مختلفين تصادف تباعدُهما،
   * فتُهدر المحاولات على أسئلةٍ خاطئة قبل الوصول إلى الصحيح — وكل محاولة بحثان.
   * والصواب أن طرفَي الإغلاق هما الأقرب إلى طرفَي خط العمل: عقدةٌ عند بدايته
   * وأخرى عند نهايته. والاتجاهان يُجرَّبان معاً، فجهةُ رسم الخط في البيانات
   * لا تلزم أن توافق جهة السير.
   */
  function rankedPairs(graph, starts, ends, line) {
    var head = line && line.length ? line[0] : null;
    var tail = line && line.length ? line[line.length - 1] : null;
    var pairs = [];
    for (var i = 0; i < starts.length; i += 1) {
      for (var j = 0; j < ends.length; j += 1) {
        if (starts[i] === ends[j]) continue;
        var a = graph.nodes[starts[i]];
        var b = graph.nodes[ends[j]];
        var span = metresBetween(a, b);
        if (span < 1) continue;
        var drift = 0;
        if (head) {
          drift = Math.min(
            metresBetween(a, head) + metresBetween(b, tail),
            metresBetween(a, tail) + metresBetween(b, head)
          );
        }
        pairs.push({ from: starts[i], to: ends[j], span: span, drift: drift });
      }
    }
    // الانحراف أولاً، والبُعد يفصل عند التساوي — فالأوسع بين المحاذين هو الأصلح.
    pairs.sort(function (x, y) {
      if (Math.abs(x.drift - y.drift) > 1) return x.drift - y.drift;
      return y.span - x.span;
    });
    return pairs;
  }

  /**
   * طرفا الإغلاق: أوّل زوجٍ يصمد للاختبار.
   * ---------------------------------------------------------------------------
   * قيس على BLD-2026-0001: الزوج الأبعد يفصله في الهواء 2254 متراً ويفصله على
   * الشبكة 5410 — أي أنهما ليسا طرفَي مقطعٍ واحد بل عقدتان على فرعين مختلفين
   * يمسّان العمل. والسؤال «كيف أصل من هذه إلى تلك؟» سؤالٌ لا يخصّ الإغلاق،
   * وجوابه التفافٌ بعشرة كيلومترات وأربعة انعطافات بلا شارع حيٍّ واحد: خمسةُ
   * أهدافٍ مختلفة أعادت المسار نفسه حرفاً بحرف — لأن البديل غير موجودٍ أصلاً
   * لهذا الزوج، لا لأن الأوزان أخطأت.
   *
   * فالزوج يُختبر لا يُفترض، بثلاثة شروط: أن يمرّ أساسُه بالإغلاق فعلاً، وأن
   * يكون طولُه قريباً من الفجوة، وأن يوجد له التفافٌ أصلاً. وأوّل زوجٍ يصمد
   * للثلاثة هو الأوسع الصالح. وتحته ثلاثة تراجعات مرتّبة: زوجٌ له التفافٌ بتأطيرٍ
   * أوسع، ثم زوجٌ صالحُ التأطير بلا التفاف — وهذا خبرٌ صحيح يُقال —، ثم الأبعد.
   * شرطٌ لا يجد مرشحاً خيرٌ منه شرطٌ يُسقط الحالة كلها.
   */
  function solveBoundary(prepared, banned, hour, line, corridor) {
    var pairs = closureBoundaries(prepared, banned, line);
    if (!pairs.length) return null;
    var crossing = null;
    var anyCross = null;
    var widest = 0;
    var k;
    for (k = 0; k < pairs.length; k += 1) {
      if (pairs[k].span > widest) widest = pairs[k].span;
    }
    var floor = widest * BOUNDARY_MIN_SHARE;

    var tries = Math.min(BOUNDARY_TRIES, pairs.length);
    for (k = 0; k < tries; k += 1) {
      var pair = pairs[k];
      if (pair.span < floor) continue;
      var baseline = shortestPath(prepared, pair.from, pair.to, { hour: hour });
      if (!baseline) continue;
      if (!baseline.edges.some(function (edge) { return banned[edge]; })) continue;
      pair.baseline = baseline;
      // زوجٌ يعبر الإغلاق بتأطيرٍ واسع يبقى احتياطاً أخيراً قبل السقوط.
      if (!anyCross) anyCross = pair;
      if (baseline.lengthM > BOUNDARY_RATIO * pair.span) continue;
      // زوجٌ صالحُ التأطير بلا التفاف يُحفظ: إن لم يوجد أفضل منه فهو الخبر.
      if (!crossing) crossing = pair;
      /**
       * السبرُ محليٌّ محبوس أولاً، لا بحثاً شاملاً.
       * السؤال هنا «هل لهذا الزوج التفافٌ أصلاً؟»، وأرخص جوابٍ صادق عليه بحثٌ
       * داخل نافذةٍ حول العمل. وإن خلت النافذة انتقلنا إلى الزوج التالي؛ ولا
       * يُفتح البحث الشامل إلا مرةً واحدة في النهاية، على أصلح زوجٍ وُجد.
       */
      var probe = shortestPath(prepared, pair.from, pair.to, {
        hour: hour,
        banned: banned,
        objective: OBJECTIVES.local,
        corridor: corridor,
        window: windowFor(pair.span),
      });
      if (!probe) continue;
      pair.local = probe;
      return pair;
    }

    // لا زوج له التفافٌ محلي: يُفتح البحث الشامل مرةً واحدة على أصلح ما وُجد.
    var wide = crossing || anyCross;
    if (wide) {
      wide.probe = shortestPath(prepared, wide.from, wide.to, {
        hour: hour, banned: banned,
      });
      return wide;
    }

    // آخرُ ملاذ هو الأوسع لا الأقرب محاذاةً: المحاذاة رجّحت ولم تُثمر، والأوسع
    // يضمن على الأقل أن الإغلاق واقعٌ بين الطرفين.
    var fallback = pairs[0];
    for (k = 1; k < pairs.length; k += 1) {
      if (pairs[k].span > fallback.span) fallback = pairs[k];
    }
    fallback.baseline = shortestPath(prepared, fallback.from, fallback.to, { hour: hour });
    return fallback.baseline ? fallback : null;
  }

  /** نصف قطر البحث المحلي حول العمل، تابعاً لطول الإغلاق. */
  function windowFor(span) {
    return Math.max(WINDOW_MIN_M, WINDOW_SPAN_FACTOR * (span || 0));
  }

  /** أصلح زوجٍ بلا بحث — يبقى للتوافق ولاختبارٍ لا يريد توجيهاً. */
  function closureBoundary(prepared, banned, line) {
    var pairs = closureBoundaries(prepared, banned, line);
    return pairs.length ? pairs[0] : null;
  }

  /** أبعد زوج بين مجموعتين، بشرط ألا يكون الطرفان عقدة واحدة. */
  function widestPair(graph, starts, ends) {
    var from = -1;
    var to = -1;
    var widest = -1;
    for (var i = 0; i < starts.length; i += 1) {
      for (var j = 0; j < ends.length; j += 1) {
        if (starts[i] === ends[j]) continue;
        var span = metresBetween(graph.nodes[starts[i]], graph.nodes[ends[j]]);
        if (span > widest) { widest = span; from = starts[i]; to = ends[j]; }
      }
    }
    if (from === -1) return null;
    return { from: from, to: to, span: widest };
  }

  /**
   * هندسة المسار من الرسم نفسه.
   * الضلع يحمل رؤوسه الوسيطة، فلا يلزم أن تكون طبقة العرض هي طبقة البناء —
   * وهذا ما كان يربط التوجيه بملف عرضٍ قد يُبسَّط بعده فتنكسر الفهارس.
   */
  function pathGeometry(prepared, states) {
    var graph = prepared.graph;
    var coordinates = [];
    function push(point) {
      var last = coordinates[coordinates.length - 1];
      if (last && last[0] === point[0] && last[1] === point[1]) return;
      coordinates.push(point);
    }
    for (var i = 0; i < states.length; i += 1) {
      var state = states[i];
      var edge = graph.edges[state >> 1];
      var forward = (state & 1) === 0;
      var shape = edge[10] || [];
      push(graph.nodes[forward ? edge[0] : edge[1]]);
      for (var s = 0; s < shape.length; s += 1) {
        push(shape[forward ? s : shape.length - 1 - s]);
      }
      push(graph.nodes[forward ? edge[1] : edge[0]]);
    }
    return coordinates;
  }

  /** أسماء الشوارع التي يمرّ بها المسار، بالترتيب وبلا تكرار متجاور. */
  function pathStreets(prepared, edges) {
    var graph = prepared.graph;
    var names = graph.names || [];
    var out = [];
    for (var i = 0; i < edges.length; i += 1) {
      var ref = graph.edges[edges[i]][9];
      if (ref === undefined || ref < 0) continue;
      var name = names[ref];
      if (!name || name === out[out.length - 1]) continue;
      out.push(name);
    }
    return out;
  }

  /**
   * بُعد الضلع عن خط العمل، بذاكرةٍ لأن البحث يسأل عن الضلع مراراً.
   * يُقاس من منتصف الضلع: طرفٌ واحد قد يلامس العمل بينما جسدُ الضلع بعيد.
   */
  function corridorField(prepared, line) {
    var graph = prepared.graph;
    var cache = {};
    return function (index) {
      var hit = cache[index];
      if (hit !== undefined) return hit;
      var edge = graph.edges[index];
      var a = graph.nodes[edge[0]];
      var b = graph.nodes[edge[1]];
      var mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      var near = Infinity;
      for (var i = 1; i < line.length; i += 1) {
        var d = distanceToSegment(mid, line[i - 1], line[i]);
        if (d < near) near = d;
      }
      cache[index] = near;
      return near;
    };
  }

  /**
   * البدائل حول إغلاق.
   * ---------------------------------------------------------------------------
   * الأساس هو المسار كما هو اليوم — عبر الشارع نفسه قبل إغلاقه. والبدائل تُحسب
   * بعد منع أضلاع الإغلاق، بخمسة أهدافٍ مختلفة لا بعقوبةٍ على ما سبق.
   *
   * **السؤال كان خطأً قبل الأوزان.** «ما أسرع مسار من طرف الإغلاق إلى طرفه
   * الآخر؟» سؤالٌ على مقياس المدينة، وجوابه التفافٌ شرياني: قيس فبلغ وسيطُه
   * 2.81 ضعف فجوة الإغلاق ويبتعد عنها 951 متراً، وفي أسوأ حالة 30.7 كيلومتراً
   * لفجوة 1.4. والسائق لا يفعل ذلك: يخرج قبل العمل، ويلتفّ بجواره، ويعود بعده.
   * ولهذا صار الهدف `local` يربط الوزن ببُعد الضلع عن خط العمل — تحويلةٌ لا
   * إعادةَ تخطيط. وحين يكون الجوار حيّاً سكنياً، فالحيّ هو الجواب بالضرورة.
   *
   * الفشل يُسمّى ولا يُبتلع: «خارج الشبكة» و«لا التفاف» حالتان مختلفتان،
   * والثانية خبرٌ يخصّ متخذ القرار — شارعٌ لا بديل له إغلاقُه قرارٌ آخر.
   *
   * @param {object} prepared ناتج prepare
   * @param {Array} line خط العمل [[lon,lat],…]
   * @param {object} [options] {hour, count}
   */
  function alternativesAround(prepared, line, options) {
    var opts = options || {};
    var hour = typeof opts.hour === 'number' ? opts.hour : 8;
    var wanted = opts.count || 2;
    if (!line || line.length < 2) return { ok: false, reason: 'no-line' };

    var banned = edgesUnderClosure(prepared, line);
    if (!Object.keys(banned).length) return { ok: false, reason: 'off-network' };

    var corridor = corridorField(prepared, line);
    var ends = solveBoundary(prepared, banned, hour, line, corridor);
    if (!ends) return { ok: false, reason: 'no-boundary' };

    var from = ends.from;
    var to = ends.to;
    var baseline = ends.baseline;
    if (!baseline) return { ok: false, reason: 'no-baseline' };

    var window = windowFor(ends.span);
    var seeds = [OBJECTIVES.fastest, OBJECTIVES.local, OBJECTIVES.minor,
      OBJECTIVES.shortest, OBJECTIVES.major];
    var candidates = [];
    for (var s = 0; s < seeds.length; s += 1) {
      // ما حُسب أثناء اختبار الزوج لا يُعاد حسابه.
      var ready = null;
      if (seeds[s] === OBJECTIVES.local && ends.local) ready = ends.local;
      if (seeds[s] === OBJECTIVES.fastest && ends.probe) ready = ends.probe;
      var route = ready || shortestPath(prepared, from, to, {
        hour: hour,
        banned: banned,
        objective: seeds[s],
        corridor: corridor,
        window: window,
      });
      if (!route) continue;
      route.objective = seeds[s].key;
      candidates.push(route);
    }
    if (!candidates.length) {
      return { ok: false, reason: 'no-detour', closedEdges: Object.keys(banned).length };
    }

    var kept = chooseAlternatives(prepared, candidates, wanted);
    var best = kept[0];

    /* WP-R1 — الحركة المحوَّلة تُحسب مرة وتُحمَّل على كل بديل.
       بلا هذا يُعرض بديلٌ بزمنٍ يفترض أنه فارغ، وهو الذي سيستقبل حركة
       الإغلاق. عدد المسارات المغلقة من المُدخل؛ وإن غاب فمسارٌ واحد —
       أقلّ افتراضٍ يُنتج تحويلاً، لا صفرٌ يُلغي الحساب بصمت. */
    var diverted = divertedDemand(prepared, banned, hour,
      typeof opts.lanesClosed === 'number' ? opts.lanesClosed : 1);

    return {
      ok: true,
      hour: hour,
      from: from,
      to: to,
      banned: banned,
      closedEdges: Object.keys(banned).length,
      baseline: baseline,
      considered: candidates.length,
      diverted: diverted,
      alternatives: kept.map(function (route) {
        var load = loadRoute(prepared, route, diverted.vehPerHour, hour);
        return {
          edges: route.edges,
          states: route.states,
          objective: route.objective,
          minutes: route.minutes,
          /* WP-R1 — الحمل معروضٌ لا محسوبٌ في الخفاء.
             `minutes` يبقى الزمن قبل التحويل ولا يُعاد تعريفه بصمت؛ و
             `load.minutesAfter` هو ما يجب أن تعرضه الواجهة. */
          load: load,
          minutesAfterDiversion: load.minutesAfter,
          addedMinutesAfterDiversion: load.minutesAfter - baseline.minutes,
          driveMinutes: route.driveMinutes,
          turnMinutes: route.turnMinutes,
          controlMinutes: route.controlMinutes,
          lengthM: route.lengthM,
          minorShare: route.minorShare,
          minorMetres: route.minorMetres,
          excursionM: route.excursionM,
          insideNeighbourhood: route.insideNeighbourhood,
          excursion: route.excursion,
          turns: route.turns,
          signals: route.signals,
          stops: route.stops,
          streets: pathStreets(prepared, route.edges),
          addedMinutes: route.minutes - baseline.minutes,
          addedMetres: route.lengthM - baseline.lengthM,
          addedPct: baseline.minutes > 0
            ? (100 * (route.minutes - baseline.minutes)) / baseline.minutes
            : 0,
          reasons: reasonsFor(route, best, kept),
        };
      }),
    };
  }

  /**
   * اختيار البدائل المعروضة وترتيبها.
   * ---------------------------------------------------------------------------
   * ثلاث قواعد، كلٌّ منها يعالج عيباً مقيساً:
   *
   * ١) **التوصية بالأقصر بين المتقارب زمنُه.** الفرز بالزمن وحده كان يقدّم
   *    التفافاً شريانياً بعشرة كيلومترات على تحويلةٍ محلية بأربعة لأنه أسرع
   *    بدقيقتين — وهما داخل خطأ النموذج. المسافة مقيسة والزمن مقدَّر، فالترجيح
   *    بالمقيس عند التقارب.
   *
   * ٢) **الإسقاط بالتطابق.** بديلان يشتركان في أكثر من ثمانين بالمئة من طولهما
   *    خيارٌ واحد معروضٌ مرتين.
   *
   * ٣) **مقعدٌ محفوظ لمسار الحيّ.** إن نجا من الإسقاط بديلٌ يدخل حيّاً دخولاً
   *    حقيقياً ولم يبلغ العرض، ولم يكن أبطأ من الأسرع بأكثر من الحدّ، أُحلّ محلّ
   *    آخر المعروضين. فالسؤال الذي طُرح على المنتج هو الشوارع بين البيوت، وبديلٌ
   *    يجيبه ثم يُسقطه الفرز جوابٌ حُسب ولم يُعرض.
   */
  function chooseAlternatives(prepared, candidates, wanted) {
    var ranked = candidates.slice().sort(function (a, b) { return a.minutes - b.minutes; });
    var quickest = ranked[0];
    var tolerance = Math.max(TOLERANCE_MIN, quickest.minutes * TOLERANCE_PCT);
    var near = ranked.filter(function (one) {
      return one.minutes <= quickest.minutes + tolerance;
    });
    var briefest = near.reduce(function (min, one) {
      return one.lengthM < min.lengthM ? one : min;
    }, near[0]);
    // القلب لا يقع لأجل أمتار: الأسرع يبقى موصىً به ما لم يكن الوفر في المسافة
    // فرقاً يُقرأ على الخريطة ويُحسّ في القيادة.
    var gain = quickest.lengthM - briefest.lengthM;
    var enough = Math.max(MEANINGFUL_SHORTER_M, quickest.lengthM * MEANINGFUL_SHORTER_PCT);
    var recommended = gain >= enough ? briefest : quickest;

    /**
     * البديل الثاني يُختار بالاختلاف لا بالسرعة.
     * ---------------------------------------------------------------------------
     * «التالي في الزمن» يقع عادةً على نفس الطريق مع انحرافٍ في آخره: قيس فبلغ
     * وسيط التطابق 68٪ — أي أن الخيار الثاني يكرّر ثلثَي الأول. والذي يفيد
     * السائق قرارٌ آخر: بين ما يقارب الأسرعَ زمناً، يُقدَّم أقلُّها تطابقاً مع
     * الموصى به. والسقف يمنع أن يُشترى الاختلاف بمسارٍ سخيف.
     */
    var rest = ranked.filter(function (one) { return one !== recommended; });
    var ceiling = quickest.minutes * NEIGHBOUR_MAX_FACTOR;
    var different = rest.filter(function (one) { return one.minutes <= ceiling; })
      .map(function (one) {
        return { route: one, overlap: overlapShare(prepared, recommended, one) };
      })
      .sort(function (a, b) { return a.overlap - b.overlap; })
      .map(function (entry) { return entry.route; });

    var order = [recommended].concat(different, rest);

    var kept = [];
    order.forEach(function (one) {
      if (kept.length >= wanted) return;
      if (kept.indexOf(one) !== -1) return;
      var twin = kept.some(function (existing) {
        return overlapShare(prepared, existing, one) >= SAME_ROUTE_OVERLAP;
      });
      if (!twin) kept.push(one);
    });

    var shown = kept.some(function (one) { return one.insideNeighbourhood; });
    if (!shown && kept.length >= wanted) {
      var hood = null;
      order.forEach(function (one) {
        if (!one.insideNeighbourhood) return;
        if (one.minutes > quickest.minutes * NEIGHBOUR_MAX_FACTOR) return;
        var twin = overlapShare(prepared, kept[0], one) >= SAME_ROUTE_OVERLAP;
        if (twin) return;
        if (!hood || one.excursionM > hood.excursionM) hood = one;
      });
      if (hood) kept[kept.length - 1] = hood;
    }
    return kept;
  }

  /**
   * حصة التطابق بين مسارين: طول ما يشتركان فيه على طول أقصرهما.
   * القسمة على الأقصر لا على الأطول: مسارٌ قصير يقع كلّه داخل مسارٍ طويل ليس
   * بديلاً عنه بل جزءاً منه.
   */
  function overlapShare(prepared, a, b) {
    var graph = prepared.graph;
    var inA = {};
    var i;
    for (i = 0; i < a.edges.length; i += 1) inA[a.edges[i]] = 1;
    var shared = 0;
    for (i = 0; i < b.edges.length; i += 1) {
      if (inA[b.edges[i]]) shared += graph.edges[b.edges[i]][2];
    }
    var floor = Math.min(a.lengthM, b.lengthM);
    return floor > 0 ? shared / floor : 0;
  }

  /**
   * سبب اقتراح البديل — مشتقٌّ من قياسه لا مكتوبٌ سلفاً.
   * كل عبارة هنا تقابل مقارنةً بين أرقامٍ محسوبة، فإن لم تصدق المقارنة لم
   * تُعرض العبارة. بديلٌ بلا سبب يصدق لا يُعطى سبباً مخترعاً.
   */
  function reasonsFor(route, best, all) {
    var out = [];
    var quickest = all.reduce(function (min, one) {
      return one.minutes < min.minutes ? one : min;
    }, all[0]);
    var shortest = all.reduce(function (min, one) {
      return one.lengthM < min.lengthM ? one : min;
    }, all[0]);

    if (route === best && all.length > 1) {
      // التوصية تُعلن سببها: أسرع فعلاً، أم أقصر بفارقٍ زمني داخل خطأ التقدير؟
      if (route === quickest) out.push('الأسرع بين البدائل');
      else {
        out.push('الموصى به — أقصر بـ '
          + Math.round((quickest.lengthM - route.lengthM) / 100) / 10
          + ' كم مقابل ' + Math.round(10 * (route.minutes - quickest.minutes)) / 10
          + ' دقيقة');
      }
    } else if (route === quickest) out.push('الأسرع بين البدائل');
    else if (route === shortest) out.push('الأقصر مسافةً وإن كان أبطأ');

    // «داخل الحيّ» تُقال عن شوطٍ متصل يُرى على الخريطة، لا عن حصةٍ متفرقة.
    if (route.insideNeighbourhood && route.excursion) {
      out.push('تحويلة داخل الحيّ — '
        + Math.round(route.excursion.lengthM) + ' متراً متصلة في شوارع فرعية');
    } else if (route.minorShare <= 0.1) {
      out.push('يبقى على الطرق الواسعة');
    }

    var fewest = all.reduce(function (min, one) {
      return one.signals < min.signals ? one : min;
    }, all[0]);
    if (route === fewest && all.length > 1 && fewest.signals < quickest.signals) {
      out.push('إشارات أقل — ' + route.signals + ' بدل ' + quickest.signals);
    }
    return out;
  }

  return {
    BPR_ALPHA: BPR_ALPHA,
    BPR_BETA: BPR_BETA,
    DIVERSITY_PENALTY: DIVERSITY_PENALTY,
    MAX_SNAP_M: MAX_SNAP_M,
    MAX_KMH: MAX_KMH,
    CLOSURE_NEAR_M: CLOSURE_NEAR_M,
    OBJECTIVES: OBJECTIVES,
    SAME_ROUTE_OVERLAP: SAME_ROUTE_OVERLAP,
    NEIGHBOURHOOD_SHARE: NEIGHBOURHOOD_SHARE,
    EXCURSION_M: EXCURSION_M,
    TOLERANCE_MIN: TOLERANCE_MIN,
    TOLERANCE_PCT: TOLERANCE_PCT,
    NEIGHBOUR_MAX_FACTOR: NEIGHBOUR_MAX_FACTOR,
    CORRIDOR_M: CORRIDOR_M,
    CORRIDOR_CAP: CORRIDOR_CAP,
    corridorField: corridorField,
    chooseAlternatives: chooseAlternatives,
    Heap: Heap,
    metresBetween: metresBetween,
    distanceToSegment: distanceToSegment,
    angleDelta: angleDelta,
    prepare: prepare,
    nearestNode: nearestNode,
    closureBoundary: closureBoundary,
    closureBoundaries: closureBoundaries,
    solveBoundary: solveBoundary,
    windowFor: windowFor,
    BOUNDARY_RATIO: BOUNDARY_RATIO,
    WINDOW_MIN_M: WINDOW_MIN_M,
    classOf: classOf,
    edgeMinutes: edgeMinutes,
    edgeLoad: edgeLoad,
    divertedDemand: divertedDemand,
    loadRoute: loadRoute,
    isMinorClass: isMinorClass,
    measure: measure,
    overlapShare: overlapShare,
    reasonsFor: reasonsFor,
    turnMinutes: turnMinutes,
    controlMinutes: controlMinutes,
    headOf: headOf,
    tailOf: tailOf,
    shortestPath: shortestPath,
    edgesUnderClosure: edgesUnderClosure,
    pathGeometry: pathGeometry,
    pathStreets: pathStreets,
    alternativesAround: alternativesAround,
  };
});
