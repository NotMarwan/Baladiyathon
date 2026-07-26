/**
 * أثر — المباني حسب ما يُرى، لا حسب أين كانت الكاميرا.
 * ---------------------------------------------------------------------------
 * الشكوى كانت: «انزل إلى مئة متر تظهر التفاصيل، وافتح الخريطة على خمسمئة فلا
 * تظهر». وقيست على متصفح نظيف:
 *
 *   فتحٌ عند 500 متر: 123 ميغابايت مُنزَّلة، ولا مبنى مرسوم حتى **40 ثانية**.
 *   فتحٌ عند 100 متر: نفس الحمولة، والرسم عند **10 ثوانٍ**.
 *
 * ولم تكن في الشيفرة عتبةُ تكبيرٍ أصلاً — لا `zoomend` ولا `alreadyLoaded`.
 * السبب أن المدينة كلها كانت تُحمَّل مرّةً واحدة (456,252 مضلعاً، 101 ميغابايت)
 * وتُسلَّم مصدراً واحداً، فتقع كلفةُ التبليط على عاملٍ واحد: شاشةٌ عريضة تُدخل
 * خمسة عشر ألف مضلع في الإطار فتستغرق عشرين ثانية بعد وصول البيانات، وشاشةٌ
 * ضيّقة تُدخل مئتين وستّين فتظهر فوراً. فمن نزل إلى مئة متر انتظر هناك حتى
 * انتهى العامل، ثم رأى المباني معه صاعداً — فقرأها شرطاً على النزول.
 *
 * فالإصلاح ليس تقييم عتبةٍ عند الإقلاع بل إسقاط الحمولة الواحدة:
 *
 * ١) **نظرة عامة** لكل المدينة، 427 كيلوبايت: شبكةُ خلايا بمقدار التغطية
 *    المبنية لكل خلية. عند تقريب المدينة يُقرأ النسيج كثافةً لا مبانيَ — وهو
 *    ما يقوله تعليق الطبقة نفسه — فتُرسل الكثافة كثافة.
 *
 * ٢) **بلاطات تفصيلية** بمضلعاتها الحقيقية، تُطلب حسب `getBounds()` و`getZoom()`
 *    الحاليَّين. والقراءة تقع **فور التركيب** لا عند أول حركة، ثم عند كل
 *    `moveend` — فالنتيجة تابعةٌ لحالة الكاميرا لا لتاريخها.
 *
 * ٣) **النظرة العامة تنسحب من البلاطات المحمَّلة** بمرشّحٍ لا بحذف: الخلية
 *    الخشنة تبقى مرسومةً حتى تصل مضلعاتها الحقيقية، فلا تختفي المباني ولا
 *    تُرسم مرتين.
 *
 * الفشل لا يكسر شيئاً: بلاطةٌ تعذّرت تبقى نظرتُها العامة مرسومة، ويُسجَّل الخطأ،
 * ويُمسح أثرها من الجاري فتُطلب ثانيةً عند العودة إليها.
 *
 * UMD بنفس نمط athar-engine.js. الدوال الحاسبة نقية — تُختبر في Node بلا خريطة.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AtharBuildingsLazy = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var INDEX_SRC = 'data/buildings-index.json';
  var OVERVIEW_SRC = 'data/buildings-overview.js';

  /**
   * دون هذا التقريب لا تُطلب بلاطة.
   * عند التقريب الثاني عشر تبتلع الشاشةُ المدينةَ كلها، وطلبُ تفاصيلها يعيد
   * المشكلة بشكل آخر. والنظرة العامة تكفي هناك: المبنى الواحد دون البكسل.
   */
  var DETAIL_MIN_ZOOM = 12.6;

  /**
   * سقفُ البلاطات في الطلب الواحد.
   * حارسٌ صريح لا تحسين: نطاقٌ يتجاوزه يعني أن المستعمل يرى مساحةً لا تُقرأ
   * تفاصيلها أصلاً، وتحميلُها ذاكرةٌ تُدفع مقابل لا شيء يُرى.
   */
  var MAX_TILES_IN_VIEW = 48;

  /** تحميلٌ مسبق محدود حول الشاشة — حركةٌ صغيرة لا تبدأ من الصفر. */
  var PREFETCH_RATIO = 0.18;

  /** سقف الذاكرة: أقدمُ ما زار المستعمل يُسقَط أولاً. */
  var MAX_CACHED_TILES = 96;

  /** أقصى طلبات متزامنة — الشبكة لا تُغرَق فتتأخّر البلاطة التي تحت العين. */
  var MAX_PARALLEL = 6;

  /** تجميع الوصول: عشرُ بلاطات تصل معاً تعني تحديثاً واحداً لا عشرة. */
  var FLUSH_MS = 120;

  /** مدى المعرّفات داخل البلاطة الواحدة — أكبر بلاطة نحو ثلاثة آلاف مبنى. */
  var IDS_PER_TILE = 100000;

  /* ---- حساب نقي ---- */

  /** رقم البلاطة من مفتاحها — أساسُ معرّفات ميزاتها. */
  function ordinalOf(index, key) {
    var parts = String(key).split('-');
    return (Number(parts[0]) * index.rows + Number(parts[1])) * IDS_PER_TILE;
  }

  /**
   * مفاتيح البلاطات التي تمسّ النطاق المعروض، مرتّبةً من مركز الشاشة إلى حافتها.
   * ---------------------------------------------------------------------------
   * الترتيب ليس زينة: البلاطات تُطلب على دفعات، وما تحت عين المستعمل يجب أن
   * يصل أولاً. والهامش تحميلٌ مسبق محدود، فحركةٌ صغيرة لا تبدأ من الصفر.
   *
   * @param {object} index {origin, cell, cols, rows, tiles}
   * @param {object} bounds {west, south, east, north}
   */
  function keysForBounds(index, bounds, marginRatio, maxTiles) {
    if (!index || !index.tiles) return [];
    var margin = marginRatio === undefined ? PREFETCH_RATIO : marginRatio;
    var cap = maxTiles === undefined ? MAX_TILES_IN_VIEW : maxTiles;
    var padLon = (bounds.east - bounds.west) * margin;
    var padLat = (bounds.north - bounds.south) * margin;
    var west = bounds.west - padLon;
    var east = bounds.east + padLon;
    var south = bounds.south - padLat;
    var north = bounds.north + padLat;

    var minCol = Math.floor((west - index.origin[0]) / index.cell);
    var maxCol = Math.floor((east - index.origin[0]) / index.cell);
    var minRow = Math.floor((south - index.origin[1]) / index.cell);
    var maxRow = Math.floor((north - index.origin[1]) / index.cell);
    var midLon = (bounds.west + bounds.east) / 2;
    var midLat = (bounds.south + bounds.north) / 2;

    var found = [];
    for (var col = Math.max(0, minCol); col <= Math.min(index.cols - 1, maxCol); col += 1) {
      for (var row = Math.max(0, minRow); row <= Math.min(index.rows - 1, maxRow); row += 1) {
        var key = col + '-' + row;
        if (!index.tiles[key]) continue;
        var centreLon = index.origin[0] + (col + 0.5) * index.cell;
        var centreLat = index.origin[1] + (row + 0.5) * index.cell;
        var dx = (centreLon - midLon) / index.cell;
        var dy = (centreLat - midLat) / index.cell;
        found.push({ key: key, far: dx * dx + dy * dy });
      }
    }
    found.sort(function (a, b) { return a.far - b.far; });
    return found.slice(0, cap).map(function (entry) { return entry.key; });
  }

  /**
   * قرارُ الدورة: ما يُطلب، وما يُلغى، وما يُسقَط من الذاكرة.
   * ---------------------------------------------------------------------------
   * دالةٌ نقية عمداً: هذا هو المنطق الذي يقرّر عدد الطلبات وحجمها، وهو ما يجب
   * أن يُختبر بلا خريطة ولا شبكة.
   *
   * @param {object} state {cache:{key:true}, inflight:{key:true}, order:[key]}
   * @param {Array} wanted مفاتيح النطاق الحالي
   */
  function planTiles(state, wanted, limit) {
    var cap = limit === undefined ? MAX_CACHED_TILES : limit;
    var need = {};
    wanted.forEach(function (key) { need[key] = true; });

    var fetch = wanted.filter(function (key) {
      return !state.cache[key] && !state.inflight[key];
    });

    // الطلبات الجارية خارج النطاق تُلغى: تحريكٌ سريع يُنتج طلباتٍ لا أحد ينتظرها.
    var abort = Object.keys(state.inflight).filter(function (key) { return !need[key]; });

    /**
     * الإسقاط بالأقدم زيارةً، والمعروضُ محميّ.
     * إسقاطُ ما يُرى الآن يعني وميضاً؛ والحدّ يُحترم بإسقاط ما وراءه فقط.
     */
    var evict = [];
    var room = state.order.length - cap;
    for (var i = 0; i < state.order.length && evict.length < room; i += 1) {
      if (!need[state.order[i]]) evict.push(state.order[i]);
    }
    return { fetch: fetch, abort: abort, evict: evict };
  }

  /**
   * النظرة العامة: ثلاثة أعداد لكل خلية تصير مستطيلاً.
   * الشبكة منتظمة، فإرسال مضلعٍ كامل لكل خلية إعادةٌ لما يُشتقّ حساباً — 427
   * كيلوبايت بدل ثلاثة ميغابايت ونصف. والبناء هنا مرةً واحدة عند الإقلاع.
   *
   * كل خلية تحمل مفتاح بلاطتها التفصيلية `t`، وبه ينسحب الخشن أمام الدقيق.
   */
  function expandOverview(payload) {
    if (!payload || !payload.cells) return { type: 'FeatureCollection', features: [] };
    var cell = payload.cell;
    var split = payload.split || 1;
    var features = payload.cells.map(function (entry) {
      var col = entry[0];
      var row = entry[1];
      var west = payload.origin[0] + col * cell;
      var south = payload.origin[1] + row * cell;
      var east = west + cell;
      var north = south + cell;
      return {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]],
        },
        properties: {
          d: entry[2] / 100,
          t: Math.floor(col / split) + '-' + Math.floor(row / split),
        },
      };
    });
    return { type: 'FeatureCollection', features: features };
  }

  /** مرشّح النظرة العامة: تُرسَم الخلية ما لم تصل بلاطتُها التفصيلية. */
  function overviewFilter(loadedKeys) {
    if (!loadedKeys || !loadedKeys.length) return null;
    return ['!', ['in', ['get', 't'], ['literal', loadedKeys]]];
  }

  /* ---- التركيب ---- */

  function loadScript(src, done) {
    var script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = function () { done(null); };
    script.onerror = function () { done(new Error('تعذّر تحميل ' + src)); };
    document.head.appendChild(script);
  }

  /**
   * يربط المصدرين بالخريطة ويقرأ حالة الكاميرا فوراً.
   *
   * @param {object} map خريطة MapLibre جاهزة
   * @param {object} [options] {detailSource, overviewSource, overviewLayers, onChange}
   * @returns {object} {refresh, stats, destroy}
   */
  function install(map, options) {
    var opts = options || {};
    var detailSource = opts.detailSource || 'buildings';
    var overviewSource = opts.overviewSource || 'buildings-overview';
    var overviewLayers = opts.overviewLayers || ['buildings-overview'];
    var onChange = opts.onChange || function () {};

    var state = {
      index: null,
      cache: {},
      counts: {},
      inflight: {},
      controllers: {},
      order: [],
      loaded: [],
      requests: 0,
      bytes: 0,
      failures: 0,
    };
    var pending = [];
    var removing = [];
    var flushTimer = null;
    var stopped = false;

    function currentBounds() {
      var b = map.getBounds();
      return { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() };
    }

    /** تحديثٌ واحد لكل دفعة وصول: `setData` لكل بلاطة يعني تحليلاً كاملاً لكلٍّ منها. */
    function flush() {
      flushTimer = null;
      if (stopped) return;
      var source = map.getSource(detailSource);
      if (!source) return;
      var add = pending;
      var remove = removing;
      pending = [];
      removing = [];
      if (!add.length && !remove.length) return;

      if (typeof source.updateData === 'function') {
        source.updateData({ add: add, remove: remove });
      } else {
        // متصفّحٌ بمكتبةٍ أقدم: إعادةُ بناء المجموعة كلها — أبطأ وصحيح.
        var all = [];
        Object.keys(state.cache).forEach(function (key) {
          all = all.concat(state.cache[key]);
        });
        source.setData({ type: 'FeatureCollection', features: all });
      }

      /**
       * الخشن لا ينسحب قبل أن يُرسم الدقيق.
       * ---------------------------------------------------------------------
       * تسليمُ البيانات ليس رسمَها: `updateData` يوقظ العامل، والتبليط بعده.
       * وسحبُ المرشّح في اللحظة نفسها يترك فجوةً قيست — عند 3.5 ثانية كان
       * الخشن قد هبط إلى 65 خلية والدقيق ما زال صفراً، وهي بالضبط الوميضة
       * الممنوعة. فالمرشّح ينتظر أول خمولٍ بعد التسليم: عنده يكون المصدر قد
       * بُلِّط ورُسم، فيقع التبديل في إطارٍ واحد لا في فجوة.
       */
      retireOverview();
      onChange(stats());
    }

    var retiring = false;

    function retireOverview() {
      if (retiring) return;
      retiring = true;
      map.once('idle', function () {
        retiring = false;
        if (stopped) return;
        state.loaded = Object.keys(state.cache);
        var filter = overviewFilter(state.loaded);
        overviewLayers.forEach(function (id) {
          if (map.getLayer(id)) map.setFilter(id, filter);
        });
      });
    }

    function schedule() {
      if (flushTimer !== null) return;
      flushTimer = setTimeout(flush, FLUSH_MS);
    }

    function drop(key) {
      var count = state.counts[key] || 0;
      var base = ordinalOf(state.index, key);
      for (var i = 0; i < count; i += 1) removing.push(base + i);
      delete state.cache[key];
      delete state.counts[key];
      var at = state.order.indexOf(key);
      if (at >= 0) state.order.splice(at, 1);
    }

    function fetchTile(key) {
      var controller = typeof AbortController === 'function' ? new AbortController() : null;
      state.inflight[key] = true;
      if (controller) state.controllers[key] = controller;
      var url = (state.index.dir || 'data/buildings/') + key + '.json';
      state.requests += 1;

      window.fetch(url, controller ? { signal: controller.signal } : undefined)
        .then(function (response) {
          if (!response.ok) throw new Error('HTTP ' + response.status);
          return response.text();
        })
        .then(function (text) {
          state.bytes += text.length;
          var collection = JSON.parse(text);
          var base = ordinalOf(state.index, key);
          var features = collection.features.map(function (feature, at) {
            return {
              type: 'Feature',
              id: base + at,
              geometry: feature.geometry,
              properties: feature.properties,
            };
          });
          delete state.inflight[key];
          delete state.controllers[key];
          if (stopped) return;
          state.cache[key] = features;
          state.counts[key] = features.length;
          state.order.push(key);
          pending = pending.concat(features);
          schedule();
          pump();
        })
        .catch(function (err) {
          // الإلغاء ليس فشلاً: هو نتيجة تحريكٍ أسرع من الشبكة.
          delete state.inflight[key];
          delete state.controllers[key];
          if (err && err.name === 'AbortError') { pump(); return; }
          state.failures += 1;
          // البلاطة لا تُعلَّم محمَّلة، فتبقى نظرتُها العامة مرسومة وتُطلب ثانيةً.
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('أثر: تعذّرت بلاطة المباني ' + key + ' — ' + (err && err.message));
          }
          pump();
        });
    }

    var queue = [];

    /** يُبقي الطلبات الجارية دون السقف، ويبدأ من الأقرب إلى مركز الشاشة. */
    function pump() {
      if (stopped) return;
      while (queue.length && Object.keys(state.inflight).length < MAX_PARALLEL) {
        var key = queue.shift();
        if (state.cache[key] || state.inflight[key]) continue;
        fetchTile(key);
      }
    }

    /**
     * يقرأ حالة الكاميرا **الآن** ويحمّل ما يخصّها.
     * لا شرط على عبور عتبة، ولا انتظار لحركة: تُنادى فور التركيب، وعند كل
     * استقرارٍ بعده. وهذا هو إصلاح السبب الجذري لا التفافٌ حوله.
     */
    function refresh() {
      if (stopped || !state.index) return;
      if (map.getZoom() < DETAIL_MIN_ZOOM) {
        // لا تُسقَط البلاطات المحمَّلة عند الابتعاد: إسقاطها وميضٌ بلا مكسب.
        queue = [];
        Object.keys(state.controllers).forEach(function (key) {
          state.controllers[key].abort();
        });
        return;
      }
      var wanted = keysForBounds(state.index, currentBounds());
      var plan = planTiles(state, wanted);
      plan.abort.forEach(function (key) {
        if (state.controllers[key]) state.controllers[key].abort();
      });
      if (plan.evict.length) {
        plan.evict.forEach(drop);
        schedule();
      }
      queue = plan.fetch;
      pump();
    }

    function stats() {
      return {
        tiles: state.order.length,
        requests: state.requests,
        bytes: state.bytes,
        failures: state.failures,
        inflight: Object.keys(state.inflight).length,
        features: state.order.reduce(function (sum, key) {
          return sum + (state.counts[key] || 0);
        }, 0),
      };
    }

    function ready() {
      // الاستقرار وحده كافٍ: `moveend` يقع بعد التكبير والتحريك معاً.
      map.on('moveend', refresh);
      refresh();
    }

    window.fetch(INDEX_SRC)
      .then(function (response) { return response.json(); })
      .then(function (index) {
        state.index = index;
        ready();
      })
      .catch(function (err) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('أثر: تعذّر فهرس المباني — ' + (err && err.message));
        }
      });

    function paintOverview() {
      if (!window.RIYADH_BUILDINGS_OVERVIEW) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('أثر: تعذّرت نظرة المباني العامة');
        }
        return;
      }
      var source = map.getSource(overviewSource);
      if (source && source.setData) source.setData(expandOverview(window.RIYADH_BUILDINGS_OVERVIEW));
    }

    // الصفحة تحمّلها مع وسومها كي تُرسم في الثانية الأولى؛ وإن غابت تُجلب هنا.
    if (window.RIYADH_BUILDINGS_OVERVIEW) paintOverview();
    else loadScript(opts.overviewSrc || OVERVIEW_SRC, paintOverview);

    return {
      refresh: refresh,
      stats: stats,
      state: state,
      destroy: function () {
        stopped = true;
        map.off('moveend', refresh);
        Object.keys(state.controllers).forEach(function (key) {
          state.controllers[key].abort();
        });
      },
    };
  }

  return {
    INDEX_SRC: INDEX_SRC,
    OVERVIEW_SRC: OVERVIEW_SRC,
    DETAIL_MIN_ZOOM: DETAIL_MIN_ZOOM,
    MAX_TILES_IN_VIEW: MAX_TILES_IN_VIEW,
    MAX_CACHED_TILES: MAX_CACHED_TILES,
    PREFETCH_RATIO: PREFETCH_RATIO,
    MAX_PARALLEL: MAX_PARALLEL,
    ordinalOf: ordinalOf,
    keysForBounds: keysForBounds,
    planTiles: planTiles,
    expandOverview: expandOverview,
    overviewFilter: overviewFilter,
    install: install,
  };
});
