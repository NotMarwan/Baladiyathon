/**
 * مسار — خريطة الأعمال (لغة one.network البصرية فوق بيانات محلية)
 * ---------------------------------------------------------------------------
 * 1) بديل مباشر لـ masar-glmap.js: نفس init ونفس أربع عشرة دالة api.
 * 2) الخريطة الأساسية فاتحة من GeoJSON محلي — صفر طلبات شبكة وقت التشغيل.
 * 3) طبقات الأعمال ثلاثية casing/line/symbol متقطعة على محور الشارع.
 * 4) مصدران للأعمال: نقاط مجمَّعة وخطوط غير مجمَّعة — التجميع يُسقط الخطوط.
 * 5) طبقات الأعمال تُدرج تحت التسميات فتبقى أسماء الشوارع مقروءة فوقها.
 * 6) الطرق تبقى قابلة للنقر والتحرير — التوجيه يقرأ نفس البيانات كما قبل.
 * 7) إضافة RTL محلية تُسجَّل قبل إنشاء الخريطة وإلا ظهرت العربية منفصلة.
 * 8) الفلترة الزمنية تدمج مع الفلتر الأساسي؛ setFilter وحده يمحو شرط المجموعة.
 * 9) طبقة corridor-glow يبقى اسمها كما كان — النموذج يُدرج طبقاته الزخرفية قبلها.
 *
 * بيانات الطرق والمعالم © مساهمو OpenStreetMap — رخصة ODbL.
 * UMD — _buildApi نقية وقابلة للاختبار في Node ببديل بسيط للخريطة.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('./masar-worksmap-style.js'),
      require('./masar-worksmap-layers.js'),
      require('./masar-worksmap-data.js')
    );
  } else {
    root.MasarWorksMap = factory(
      root.MasarWorksMapStyle, root.MasarWorksMapLayers, root.MasarWorksMapData
    );
  }
})(typeof self !== 'undefined' ? self : this, function (Style, Layers, Data) {
  'use strict';

  var API_METHODS = [
    'onReady', 'setCorridor', 'onCorridorClick', 'setCorridorState',
    'setAllCorridorStates', 'setCorridorColors', 'setCorridorColor',
    'setDigSite', 'setAlternatives', 'sweepUnlock', 'setPhase',
    'updateRoad', 'onRoadClick', 'getData',
    'setWorks', 'setDateRange', 'toggleGroup',
    'highlightWork', 'onWorkClick',
    'isDegraded', 'degradedReason',
  ];

  /*
   * مهلة إقلاع الخريطة.
   * ---------------------------------------------------------------------------
   * كان كل ما على هذه الصفحة معلَّقاً على `map.on('load')` وحده: لا مستمع خطأ،
   * ولا مهلة، ولا مسار بديل. فإن تعثّر WebGL أو النمط — بطاقة قديمة، أو تسريع
   * معطَّل، أو لوحة لا تركّب إطاراً فلا يعمل `requestAnimationFrame` — بقيت
   * الصفحة على «جارٍ التحميل…» بصفر سجل و**صفر خطأ في الـconsole**، والمئة
   * والخمسون معلماً محمَّلة في الذاكرة وغير معروضة. صفحةٌ تَعِد بأن «السجلات
   * مسرودة أزراراً» ثم لا تسرد شيئاً ولا تقول لماذا.
   *
   * وهذه صفحة السكان — طبقة الشفافية العامة. تعليقها الصامت أسوأ من سقوطها:
   * الساقط يُصلَح، والمعلَّق يُنتظر.
   *
   * ثماني ثوانٍ: أطول من إقلاع سليم على جهاز بطيء بفارق مريح (المقيس هنا دون
   * الثانيتين مع 6,114 شرياناً)، وأقصر من صبر إنسانٍ أمام شاشة لا تتحرك.
   */
  var READY_TIMEOUT_MS = 8000;

  var POINT_SOURCE = 'works';
  var LINE_SOURCE = 'works-lines';
  var CORRIDOR_SOURCE = 'corridor';
  var HIGHLIGHT_SOURCE = 'work-highlight';

  // ألوان مشبعة تُقرأ فوق أرضية فاتحة — لا ألوان نيون مصممة للداكن.
  var CORRIDOR_STATE_COLORS = {
    open: '#1c7ed6',
    closed: '#c92a2a',
    unlocked: '#2f9e44',
  };

  function featureCollection(features) {
    return { type: 'FeatureCollection', features: features || [] };
  }

  /**
   * يبني كائن الـ api فوق أي خريطة تحقق الحد الأدنى من واجهة MapLibre.
   * مفصولة عن init كي تُختبر في Node ببديل بسيط.
   */
  function buildApi(map, state) {
    var corridor = [];
    var corridorClickCb = null;
    var roadClickCb = null;
    var readyCbs = [];
    var phase = 'idle';
    var works = state.works || featureCollection([]);
    var roads = state.roads || featureCollection([]);
    var dateRange = null;
    var hiddenGroups = {};
    /* سبب التدهور — `null` يعني خريطة سليمة.
       يُقرأ من الصفحة لتعرف أنها تعرض قائمةً بلا رسم، لا لتخفي الفرق. */
    var degradedReason = null;

    function corridorFC() {
      return featureCollection(corridor.map(function (segment, idx) {
        return {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: segment.coords },
          properties: {
            idx: idx,
            state: segment.state,
            color: segment.color || CORRIDOR_STATE_COLORS[segment.state] || CORRIDOR_STATE_COLORS.open,
          },
        };
      }));
    }

    function pushCorridor() {
      var source = map.getSource(CORRIDOR_SOURCE);
      if (source && source.setData) source.setData(corridorFC());
    }

    function layerIdsForGroup(groupId) {
      var ids = [];
      Layers.LAYER_GROUPS.forEach(function (group) {
        if (group.id !== groupId) return;
        group.configs.forEach(function (config) {
          ids.push(config.name + '-lines-casing');
          ids.push(config.name + '-lines');
          ids.push(config.name + '-symbols');
        });
      });
      return ids;
    }

    function allWorksLayerIds() {
      var ids = [];
      Layers.LAYER_GROUPS.forEach(function (group) {
        ids = ids.concat(layerIdsForGroup(group.id));
      });
      return ids;
    }

    function applyFilters() {
      var base = Layers.baseFilters();
      var dateFilter = Layers.buildDateFilter(dateRange);
      allWorksLayerIds().forEach(function (id) {
        if (!map.getLayer(id)) return;
        map.setFilter(id, Layers.composeFilter(base[id], dateFilter));
      });
    }

    return {
      onReady: function (cb) {
        if (typeof cb === 'function') readyCbs.push(cb);
      },

      isDegraded: function () { return degradedReason !== null; },
      degradedReason: function () { return degradedReason; },
      _setDegraded: function (reason) { degradedReason = reason || null; },

      /*
       * تُنفَّذ كل ردّة نداء داخل حاجزها.
       *
       * الحلقة العارية كانت تعني أن أول ردّة تُلقي خطأً تُسقط ما بعدها بلا أثر:
       * ردّة تلمس طبقة غير موجودة (وهو الحال بالضبط في الوضع المتدهور) تُلغي
       * تركيب القائمة والبحث والعدّاد. فتصير نتيجة الخطأ الواحد صفحةً فارغة.
       *
       * والابتلاع ليس البديل: الخطأ يُسجَّل باسم موضعه ويُعاد في `failures`
       * ليعرضه المتصل. حاجزٌ يُبلِّغ، لا حاجزٌ يكتم.
       */
      _fireReady: function () {
        var pending = readyCbs;
        var failures = [];
        readyCbs = [];
        pending.forEach(function (cb, index) {
          try {
            cb();
          } catch (error) {
            failures.push({ index: index, error: error });
            if (typeof console !== 'undefined' && console.error) {
              console.error('[masar-worksmap] onReady#' + index + ' سقطت:', error);
            }
          }
        });
        return failures;
      },

      setCorridor: function (coordPairs) {
        corridor = (coordPairs || []).map(function (coords) {
          return { coords: coords, state: 'open', color: null };
        });
        pushCorridor();
      },

      onCorridorClick: function (cb) { corridorClickCb = cb; },

      _corridorClicked: function (idx) {
        if (corridorClickCb) corridorClickCb(idx);
      },

      setCorridorState: function (idx, nextState) {
        if (!corridor[idx]) return;
        corridor[idx].state = nextState;
        corridor[idx].color = null;
        pushCorridor();
      },

      setAllCorridorStates: function (states) {
        (states || []).forEach(function (nextState, idx) {
          if (corridor[idx]) {
            corridor[idx].state = nextState;
            corridor[idx].color = null;
          }
        });
        pushCorridor();
      },

      setCorridorColors: function (colors) {
        (colors || []).forEach(function (color, idx) {
          if (corridor[idx]) corridor[idx].color = color;
        });
        pushCorridor();
      },

      setCorridorColor: function (idx, color) {
        if (!corridor[idx]) return;
        corridor[idx].color = color;
        pushCorridor();
      },

      setDigSite: function (lngLat, popupHtml) {
        var source = map.getSource('dig-site');
        var data = featureCollection(lngLat ? [{
          type: 'Feature',
          geometry: { type: 'Point', coordinates: lngLat },
          properties: { popupHtml: popupHtml || '' },
        }] : []);
        if (source && source.setData) source.setData(data);
      },

      setAlternatives: function (collection) {
        var source = map.getSource('alternatives');
        if (source && source.setData) {
          source.setData(collection || featureCollection([]));
        }
      },

      sweepUnlock: function (idx, done) {
        if (corridor[idx]) {
          corridor[idx].state = 'unlocked';
          corridor[idx].color = null;
          pushCorridor();
        }
        if (typeof done === 'function') done();
      },

      setPhase: function (nextPhase) { phase = nextPhase; },

      updateRoad: function (osmId, props) {
        var features = roads.features || [];
        for (var i = 0; i < features.length; i += 1) {
          if (features[i].properties.osmId !== osmId) continue;
          var target = features[i].properties;
          Object.keys(props || {}).forEach(function (key) {
            target[key] = props[key];
          });
          var source = map.getSource('roads');
          if (source && source.setData) source.setData(roads);
          return;
        }
      },

      /**
       * إلحاق حلقة طرق ثانية بالمعروضة.
       * الحالة تُستبدل ولا تُحوَّر: المجموعة الواردة تبقى كما هي، والمرجع
       * الجديد هو ما تراه getData بعدها — فلا يرى مستدعٍ سابق تغيّراً تحته.
       * يُستدعى مرة أو مرات: الإلحاق تراكمي بطبيعته ولا يفترض حلقة واحدة.
       */
      appendRoads: function (collection) {
        if (!collection || !collection.features || !collection.features.length) return 0;
        roads = {
          type: 'FeatureCollection',
          features: (roads.features || []).concat(collection.features),
        };
        var source = map.getSource('roads');
        if (source && source.setData) source.setData(roads);
        return roads.features.length;
      },

      /**
       * نسيج المباني — يصل بعد أول إطار.
       * ---------------------------------------------------------------------
       * ٤٣ ألف مضلع لا تُنتظر قبل رسم الخريطة: القاعدة صالحة بدونها، والنسيج
       * لا يُرى أصلاً قبل z13.5. الفشل صامت — خريطة بلا مبانٍ خريطة ناقصة
       * زينة لا معنى.
       */
      setBuildings: function (collection) {
        if (!collection || !collection.features) return 0;
        var source = map.getSource('buildings');
        if (source && source.setData) source.setData(collection);
        return collection.features.length;
      },

      onRoadClick: function (cb) { roadClickCb = cb; },

      _roadClicked: function (segment) {
        if (roadClickCb) roadClickCb(segment);
      },

      getData: function () {
        return { roads: roads, works: works, corridor: corridor, phase: phase };
      },

      setWorks: function (rawWorks) {
        works = Data.normalizeWorks(rawWorks);
        var split = Data.splitByGeometry(works);
        var pointSource = map.getSource(POINT_SOURCE);
        var lineSource = map.getSource(LINE_SOURCE);
        if (pointSource && pointSource.setData) pointSource.setData(split.points);
        if (lineSource && lineSource.setData) lineSource.setData(split.lines);
        applyFilters();
      },

      setDateRange: function (range) {
        dateRange = range || null;
        applyFilters();
      },

      toggleGroup: function (groupId, visible) {
        hiddenGroups[groupId] = !visible;
        layerIdsForGroup(groupId).forEach(function (id) {
          if (!map.getLayer(id)) return;
          map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
        });
      },

      /**
       * يبرز عملاً واحداً ويطير إليه. الربط بين القائمة والخريطة يمر من هنا:
       * تمرير null يمسح الإبراز بدل أن يترك عملاً مضيئاً بلا تحديد.
       */
      highlightWork: function (id, options) {
        var source = map.getSource(HIGHLIGHT_SOURCE);
        if (!source || !source.setData) return null;

        var found = null;
        (works.features || []).forEach(function (feature) {
          if (feature.properties.id === id) found = feature;
        });

        source.setData(featureCollection(found ? [found] : []));
        if (!found || (options && options.fly === false)) return found;

        var coords = found.geometry.type === 'Point'
          ? [found.geometry.coordinates]
          : found.geometry.coordinates;
        var west = coords[0][0], east = coords[0][0];
        var south = coords[0][1], north = coords[0][1];
        coords.forEach(function (point) {
          west = Math.min(west, point[0]);
          east = Math.max(east, point[0]);
          south = Math.min(south, point[1]);
          north = Math.max(north, point[1]);
        });

        // maxZoom منخفض عمداً: المراجع يحتاج المقطع في سياق شبكته، لا مقطعاً
        // يملأ الشاشة بمقياس مئة متر فيفقد الشوارع المجاورة والتعارض المحتمل.
        if (west === east && south === north) {
          map.easeTo({ center: [west, south], zoom: 14, duration: 500 });
        } else {
          map.fitBounds([[west, south], [east, north]], { padding: 180, maxZoom: 13.8, duration: 500 });
        }
        return found;
      },

      /**
       * يؤطّر المحفظة كلها.
       * ---------------------------------------------------------------------
       * المنظر الافتتاحي يجب أن يكون «تصاريحك الـ150 على المدينة» لا مقطعاً
       * واحداً يملأ الشاشة: المراجع يقرأ التوزيع والتكتّل قبل أن يقرأ حالة.
       * يُحسب من الأعمال المعروضة فعلاً — فالتأطير يتبع المرشِّح لا الأصل.
       */
      frameWorks: function (options) {
        var opts = options || {};
        var features = works.features || [];
        if (!features.length) return null;

        var west = Infinity, east = -Infinity, south = Infinity, north = -Infinity;

        features.forEach(function (feature) {
          var geometry = feature.geometry || {};
          var points = geometry.type === 'Point'
            ? [geometry.coordinates]
            : (geometry.coordinates || []);
          points.forEach(function (point) {
            if (!point || point.length < 2) return;
            west = Math.min(west, point[0]);
            east = Math.max(east, point[0]);
            south = Math.min(south, point[1]);
            north = Math.max(north, point[1]);
          });
        });

        if (west === Infinity) return null;

        var bounds = [[west, south], [east, north]];
        map.fitBounds(bounds, {
          padding: opts.padding === undefined ? 56 : opts.padding,
          maxZoom: opts.maxZoom === undefined ? 12.4 : opts.maxZoom,
          duration: opts.duration === undefined ? 0 : opts.duration,
        });
        return bounds;
      },

      /** يبلّغ بمعرّف العمل المنقور على الخريطة — الاتجاه المعاكس للربط. */
      onWorkClick: function (callback) {
        var layers = [];
        (Layers.LAYER_GROUPS || []).forEach(function (group) {
          group.configs.forEach(function (config) {
            layers.push(config.name + '-symbols');
            layers.push(config.name + '-lines');
          });
        });

        map.on('click', function (event) {
          var available = layers.filter(function (id) { return map.getLayer(id); });
          if (!available.length) return;
          var hit = map.queryRenderedFeatures(event.point, { layers: available })[0];
          if (hit) callback(hit.properties.id, hit);
        });
      },
    };
  }

  /** المعرّف الذي تُدرج قبله طبقات الأعمال — أول طبقة تسميات. */
  function firstLabelLayerId(style) {
    for (var i = 0; i < style.layers.length; i += 1) {
      if (style.layers[i].type === 'symbol') return style.layers[i].id;
    }
    return undefined;
  }

  function init(container, roadsGeoJSON, options) {
    var opts = options || {};
    var maplibre = opts.maplibregl || (typeof maplibregl !== 'undefined' ? maplibregl : null);
    if (!maplibre) throw new Error('maplibregl غير متوفر');

    // إضافة RTL تُحمَّل داخل عامل (worker) قاعدته blob:، فالمسار النسبي يفشل عنده.
    // الحل: تحويله إلى مسار مطلق مقابل عنوان المستند قبل تمريره.
    if (maplibre.getRTLTextPluginStatus() === 'unavailable') {
      var pluginUrl = opts.rtlPluginUrl || 'vendor/mapbox-gl-rtl-text.js';
      if (typeof document !== 'undefined' && document.baseURI) {
        pluginUrl = new URL(pluginUrl, document.baseURI).href;
      }
      maplibre.setRTLTextPlugin(pluginUrl, false);
    }

    var style = Style.buildStyle(roadsGeoJSON, opts.baseGeoJSON || featureCollection([]), {
      glyphsUrl: opts.glyphsUrl || 'vendor/glyphs/{fontstack}/{range}.pbf',
      spriteUrl: opts.spriteUrl || 'vendor/sprite/sprite',
      poi: opts.poi || null,
    });

    var map = new maplibre.Map({
      container: container,
      style: style,
      center: opts.center || [46.685, 24.7],
      zoom: opts.zoom || 13,
      pitch: opts.pitch || 0,
      scrollZoom: opts.scrollZoom !== false,
      attributionControl: { compact: true },
    });

    var api = buildApi(map, { roads: roadsGeoJSON, works: featureCollection([]) });
    var labelLayerId = firstLabelLayerId(style);

    /*
     * إقلاعٌ يُطلق مرة واحدة، من ثلاثة أبواب.
     * -------------------------------------------------------------------------
     * الباب السليم `map.on('load')`، وبابان للفشل: خطأ يمنع الإقلاع، ومهلة
     * تنقضي بلا خطأ ولا حِمل — وهذه الأخيرة هي الحالة الخبيثة، لأن الخريطة
     * التي لا تُقلع ولا تُخطئ لا تترك في الـconsole سطراً واحداً.
     *
     * وفي البابين تُطلق `onReady` **كما هي**: تركيب القائمة والبحث والعدّاد
     * والفلاتر لا يحتاج WebGL، وكل دوال الـapi التي تلمس الخريطة محروسة أصلاً
     * بـ`getSource`/`getLayer` فتصير لا-عمليات. النتيجة أن المحكّم يرى مئة
     * وخمسين سجلاً في قائمة بدل شاشة تدور — وهذا هو الفرق كله.
     */
    var readyFired = false;
    var readyTimer = null;

    /* الإعلان يُنسَّق من CSSOM لا من ورقة أنماط.
       السياسة الأمنية على هذه الصفحة تمنع `style=` المضمَّن، و`element.style`
       ليس منه — فيبقى الإعلان مستقلاً بذاته: لا صنف ينتظر ورقةً، ولا ورقةَ
       تنتظر تحميلاً قد يكون هو نفسه ما فشل. */
    function announce(reason) {
      if (!reason || !container || typeof document === 'undefined') return;
      var note = document.createElement('div');
      note.className = 'wm-degraded';
      note.setAttribute('role', 'alert');
      note.dir = 'rtl';
      note.textContent = 'تعذّر رسم الخريطة على هذا الجهاز (' + reason + '). '
        + 'السجلات معروضة كاملةً في قائمة «السجلات المعروضة» — '
        + 'الأرقام والتواريخ والحالات كلها كما هي، والمفقود هو الرسم وحده.';
      var css = {
        position: 'absolute', insetInlineStart: '12px', insetInlineEnd: '12px',
        top: '12px', zIndex: '900', padding: '12px 14px', borderRadius: '10px',
        background: '#fff4e6', color: '#7a3e00', border: '1px solid #f0a868',
        font: '500 14px/1.6 system-ui, sans-serif', boxShadow: '0 2px 10px rgba(0,0,0,.12)',
        maxWidth: '640px', marginInline: 'auto',
      };
      Object.keys(css).forEach(function (key) { note.style[key] = css[key]; });
      if (container.style && !container.style.position) container.style.position = 'relative';
      container.appendChild(note);
    }

    function fireReadyOnce(reason) {
      if (readyFired) return;
      readyFired = true;
      if (readyTimer !== null) { clearTimeout(readyTimer); readyTimer = null; }
      api._setDegraded(reason || null);
      announce(reason);
      api._fireReady();
    }

    /* مستمع الخطأ. أخطاء maplibre بعد الإقلاع (بلاطة ناقصة، مصدر متأخر) لا
       تُسقط الصفحة ولا تستحق إعلاناً؛ وما يقع **قبله** يعني أن الإقلاع لن
       يتم. فالتمييز بالزمن لا بنوع الخطأ. */
    map.on('error', function (event) {
      var detail = (event && event.error && event.error.message)
        || (event && event.message) || 'خطأ غير مسمّى';
      if (typeof console !== 'undefined' && console.error) {
        console.error('[masar-worksmap] maplibre:', detail);
      }
      if (!readyFired) fireReadyOnce('خطأ في محرك الرسم: ' + detail);
    });

    if (typeof setTimeout === 'function') {
      readyTimer = setTimeout(function () {
        fireReadyOnce('انقضت مهلة ' + (READY_TIMEOUT_MS / 1000) + ' ثوانٍ بلا إقلاع');
      }, READY_TIMEOUT_MS);
      if (readyTimer && typeof readyTimer.unref === 'function') readyTimer.unref();
    }

    map.on('load', function () {
      map.addSource(POINT_SOURCE, Object.assign(
        { type: 'geojson', data: featureCollection([]) }, Layers.POINT_SOURCE_OPTIONS
      ));
      map.addSource(LINE_SOURCE, { type: 'geojson', data: featureCollection([]) });
      map.addSource(CORRIDOR_SOURCE, { type: 'geojson', data: featureCollection([]) });
      map.addSource('dig-site', { type: 'geojson', data: featureCollection([]) });
      map.addSource('alternatives', { type: 'geojson', data: featureCollection([]) });
      map.addSource(HIGHLIGHT_SOURCE, { type: 'geojson', data: featureCollection([]) });

      var worksLayers = Layers.buildWorksLayers({ points: POINT_SOURCE, lines: LINE_SOURCE });

      // ترتيب مقصود: الممر أولاً ثم الأعمال فوقه. الأعمال تقع على نفس الإسفلت،
      // فإخفاؤها تحت الممر يُلغي الرسالة: هذا المقطع فيه عمل قائم.
      // هالة خافتة تحت الممر. اسمها جزء من العقد: النموذج يُدرج طبقاته الزخرفية قبلها.
      map.addLayer({
        id: 'corridor-glow', type: 'line', source: CORRIDOR_SOURCE,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 20,
          'line-opacity': 0.16,
          'line-blur': 8,
        },
      }, labelLayerId);
      map.addLayer({
        id: 'corridor-casing', type: 'line', source: CORRIDOR_SOURCE,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': 14 },
      }, labelLayerId);
      map.addLayer({
        id: 'corridor-core', type: 'line', source: CORRIDOR_SOURCE,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ['get', 'color'], 'line-width': 7 },
      }, labelLayerId);

      map.addLayer({
        id: 'alternatives-line', type: 'line', source: 'alternatives',
        paint: { 'line-color': '#2f9e44', 'line-width': 4, 'line-dasharray': [2, 2] },
      }, labelLayerId);

      // هالة العمل المحدد تحت مقاطع الأعمال: تحيط بها ولا تحجبها.
      map.addLayer({
        id: 'work-highlight-glow', type: 'line', source: HIGHLIGHT_SOURCE,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#1D4E77',
          'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 10, 12, 15, 26, 20, 54],
          'line-opacity': 0.22,
          'line-blur': 6,
        },
      }, labelLayerId);
      map.addLayer({
        id: 'work-highlight-ring', type: 'line', source: HIGHLIGHT_SOURCE,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#1D4E77',
          'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 10, 6, 15, 15, 20, 44],
          'line-opacity': 0.9,
        },
      }, labelLayerId);

      worksLayers.forEach(function (layer) {
        if (layer.type === 'line') map.addLayer(layer, labelLayerId);
      });

      worksLayers.forEach(function (layer) {
        if (layer.type !== 'line') map.addLayer(layer);
      });

      map.addLayer({
        id: 'dig-site-symbol', type: 'symbol', source: 'dig-site',
        layout: { 'icon-image': 'works-emergency', 'icon-size': 1, 'icon-allow-overlap': true },
      });

      map.on('click', 'corridor-core', function (event) {
        var feature = event.features && event.features[0];
        if (feature) api._corridorClicked(Number(feature.properties.idx));
      });

      map.on('click', 'roads', function (event) {
        var feature = event.features && event.features[0];
        if (feature) api._roadClicked(feature.properties);
      });

      ['corridor-core', 'roads'].forEach(function (layerId) {
        map.on('mouseenter', layerId, function () {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', layerId, function () {
          map.getCanvas().style.cursor = '';
        });
      });

      fireReadyOnce(null);
    });

    /**
     * تحميل المعالم بعد الإطار الأول.
     * ---------------------------------------------------------------------
     * المعالم زينةٌ سياقية لا شرطَ عرض، وملفها بالميغابايت. تمريرها في
     * `opts.poi` يؤخّر أول رسم بقدر تحليلها — وأول رسم هو ما يحكم عليه
     * المحكّم. فالمسار المفضّل: افتح الخريطة فارغةً منها، ثم استدعِ هذه بعد
     * `onReady`. والمصدر موجود سلفاً في النمط فارغاً، فلا إعادة بناء للنمط
     * ولا وميض طبقات.
     */
    function setPoi(collection) {
      var source = map.getSource && map.getSource('poi');
      if (!source || !source.setData) return false;
      source.setData(collection || featureCollection([]));
      return true;
    }

    return { map: map, api: api, setPoi: setPoi };
  }

  return { init: init, API_METHODS: API_METHODS, _buildApi: buildApi };
});
