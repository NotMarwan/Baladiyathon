/**
 * أثر — خريطة الأعمال (لغة one.network البصرية فوق بيانات محلية)
 * ---------------------------------------------------------------------------
 * 1) بديل مباشر لـ athar-glmap.js: نفس init ونفس أربع عشرة دالة api.
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
      require('./athar-worksmap-style.js'),
      require('./athar-worksmap-layers.js'),
      require('./athar-worksmap-data.js')
    );
  } else {
    root.AtharWorksMap = factory(
      root.AtharWorksMapStyle, root.AtharWorksMapLayers, root.AtharWorksMapData
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
  ];

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

      _fireReady: function () {
        readyCbs.forEach(function (cb) { cb(); });
        readyCbs = [];
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

    map.on('load', function () {
      map.addSource(POINT_SOURCE, Object.assign(
        { type: 'geojson', data: featureCollection([]) }, Layers.CLUSTER_OPTIONS
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
      Layers.buildClusterLayers(POINT_SOURCE).forEach(function (layer) {
        map.addLayer(layer);
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

      api._fireReady();
    });

    return { map: map, api: api };
  }

  return { init: init, API_METHODS: API_METHODS, _buildApi: buildApi };
});
