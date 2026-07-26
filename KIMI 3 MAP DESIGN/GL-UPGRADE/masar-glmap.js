/**
 * مسار — خريطة GL المملوكة (MapLibre GL، بلا بلاط، بلا خوادم خطوط)
 * ---------------------------------------------------------------------------
 * المبرر (10 أسطر):
 * 1) style JSON مكتوب يدوياً — نملك كل لون وعرض عند كل مستوى تكبير.
 * 2) WebGL: توهج line-blur حقيقي على كرت الشاشة، لا محاكاة CSS.
 * 3) كاميرا سينمائية: ميلان 45° ودوران خفيف — مشهد مدينة لا مخطط مسطح.
 * 4) لا glyphs ولا sprites — أسماء الطرق عناصر DOM عربية، صفر شبكة.
 * 5) الممر مصدر GeoJSON مستقل بحالة لكل مقطع: مفتوح/مغلق/منساب.
 * 6) موجة الفتح line-gradient على line-progress — الضوء يعبر المقطع فعلاً.
 * 7) أجواء اليوم setPaintProperty بانتقالات GPU — ذروة تتقد، ليل يهدأ.
 * 8) كل طريق قابل للنقر والتحرير — البيانات تعود للتوجيه مباشرة.
 * 9) Leaflet يبقى مساراً احتياطياً كاملاً إن غاب WebGL.
 * 10) شارة الصدق والإسناد ODbL جزء من الخريطة لا زينة خارجها.
 *
 * بيانات الطرق © مساهمو OpenStreetMap — رخصة ODbL.
 * UMD — buildStyle/collectLabelAnchors صرفة وقابلة للاختبار في Node.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MasarGlMap = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STAGE = '#0a1826';
  var COLORS = {
    motorway: '#e8a33d',
    trunk: '#d18a4a',
    primary: '#7fb3d1',
    minor: '#3d5468',
    corridor: '#59d6f2',
    casing: '#08131f',
    closed: '#e5484d',
    unlocked: '#34d399',
  };
  var MAJOR = ['motorway', 'trunk'];
  var MINOR = ['secondary', 'tertiary', 'motorway_link', 'trunk_link',
    'primary_link', 'secondary_link', 'tertiary_link'];

  function buildStyle(geojson) {
    return {
      version: 8,
      sources: {
        roads: { type: 'geojson', data: geojson },
      },
      layers: [
        { id: 'bg', type: 'background', paint: { 'background-color': STAGE } },
        {
          id: 'roads-glow', type: 'line', source: 'roads',
          filter: ['in', ['get', 'highway'], ['literal', MAJOR]],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': COLORS.motorway,
            'line-blur': 6,
            'line-opacity': 0.55,
            'line-opacity-transition': { duration: 800 },
            'line-width': ['interpolate', ['linear'], ['zoom'], 11, 4, 15, 16],
          },
        },
        {
          id: 'roads-minor', type: 'line', source: 'roads',
          filter: ['in', ['get', 'highway'], ['literal', MINOR]],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': COLORS.minor,
            'line-opacity': 0.9,
            'line-opacity-transition': { duration: 800 },
            'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.4, 15, 2.2],
          },
        },
        {
          id: 'roads-primary', type: 'line', source: 'roads',
          filter: ['==', ['get', 'highway'], 'primary'],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': COLORS.primary,
            'line-opacity-transition': { duration: 800 },
            'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.9, 15, 4],
          },
        },
        {
          id: 'roads-motorway', type: 'line', source: 'roads',
          filter: ['in', ['get', 'highway'], ['literal', MAJOR]],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': ['match', ['get', 'highway'], 'motorway', COLORS.motorway, COLORS.trunk],
            'line-opacity-transition': { duration: 800 },
            'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.6, 15, 6.5],
          },
        },
      ],
    };
  }

  // اسم واحد لكل طريق رئيسي: أطول مقطع يحمل الاسم، المرساة عند منتصفه
  function collectLabelAnchors(features) {
    var byName = new Map();
    features.forEach(function (f) {
      var props = f.properties || {};
      var name = props.name;
      var cls = String(props.highway || '');
      if (!name || /_link$/.test(cls)) return;
      if (cls !== 'motorway' && cls !== 'trunk' && cls !== 'primary') return;
      var coords = f.geometry && f.geometry.coordinates;
      if (!coords || coords.length < 2) return;
      var current = byName.get(name);
      if (!current || coords.length > current.count) {
        byName.set(name, {
          name: name,
          cls: cls,
          count: coords.length,
          lngLat: coords[Math.floor(coords.length / 2)],
        });
      }
    });
    // الأسماء الأكبر شبكةً أولاً؛ نكتفي بـ 24 مرساة كحد أقصى ضد الفوضى
    return Array.from(byName.values())
      .sort(function (a, b) { return b.count - a.count; })
      .slice(0, 24);
  }

  function segmentFeature(coordsPair, idx, state) {
    return {
      type: 'Feature',
      properties: { idx: idx, state: state },
      geometry: { type: 'LineString', coordinates: coordsPair },
    };
  }

  function prefersReducedMotion() {
    return typeof window !== 'undefined' && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * تهيئة الخريطة (متصفح فقط). تعيد {map, api}.
   * opts: { center:[lng,lat], zoom, maplibregl } — maplibregl يمرر صراحة أو من window.
   */
  function init(container, geojson, opts) {
    opts = opts || {};
    var maplibregl = opts.maplibregl || (typeof window !== 'undefined' && window.maplibregl);
    if (!maplibregl) throw new Error('maplibregl missing');

    var data = JSON.parse(JSON.stringify(geojson)); // نسخة قابلة للتحرير
    var reduced = prefersReducedMotion();
    var center = opts.center || [46.685, 24.70];
    var targetView = { center: center, zoom: opts.zoom || 12.6, pitch: 45, bearing: -12 };

    var map = new maplibregl.Map({
      container: container,
      style: buildStyle(data),
      center: center,
      zoom: reduced ? targetView.zoom : 11.6,
      pitch: reduced ? 45 : 0,
      bearing: reduced ? -12 : 0,
      attributionControl: false,
      dragRotate: true,
    });
    map.addControl(new maplibregl.AttributionControl({
      compact: true,
      customAttribution: 'بيانات الطرق © مساهمو OpenStreetMap (ODbL)',
    }), 'bottom-left');
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-left');

    var corridorStates = [];
    var roadClickCb = null;
    var labelMarkers = [];

    map.on('load', function () {
      // مصادر ديناميكية
      map.addSource('corridor', { type: 'geojson', lineMetrics: true, data: { type: 'FeatureCollection', features: [] } });
      map.addSource('alternatives', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addSource('sweep', { type: 'geojson', lineMetrics: true, data: { type: 'FeatureCollection', features: [] } });

      map.addLayer({
        id: 'alt-lines', type: 'line', source: 'alternatives',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['case', ['get', 'recommended'], '#ffd98a', '#8fa3b8'],
          'line-width': ['case', ['get', 'recommended'], 4, 2.5],
          'line-opacity': ['case', ['get', 'recommended'], 0.95, 0.6],
          'line-dasharray': [2, 2.5],
        },
      });
      map.addLayer({
        id: 'corridor-casing', type: 'line', source: 'corridor',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': COLORS.casing, 'line-width': 11, 'line-opacity': 0.92 },
      });
      map.addLayer({
        id: 'corridor-core', type: 'line', source: 'corridor',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['coalesce', ['get', 'color'], ['match', ['get', 'state'],
            'closed', COLORS.closed, 'unlocked', COLORS.unlocked, COLORS.corridor]],
          'line-color-transition': { duration: 450 },
          'line-width': 5.5,
        },
      });
      map.addLayer({
        id: 'corridor-glow', type: 'line', source: 'corridor',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['coalesce', ['get', 'color'], ['match', ['get', 'state'],
            'closed', COLORS.closed, 'unlocked', COLORS.unlocked, COLORS.corridor]],
          'line-width': 12,
          'line-blur': 8,
          'line-opacity': 0.5,
        },
      }, 'corridor-casing');
      map.addLayer({
        id: 'sweep-line', type: 'line', source: 'sweep',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-width': 8, 'line-blur': 1.5, 'line-opacity': 0.95, 'line-color': COLORS.unlocked },
      });

      // أسماء الطرق: عناصر DOM عربية — صفر خوادم خطوط
      collectLabelAnchors(data.features).forEach(function (a) {
        var el = document.createElement('div');
        el.className = 'masar-road-label' + (a.cls === 'motorway' ? ' masar-label-major' : '');
        el.textContent = a.name;
        var marker = new maplibregl.Marker({ element: el }).setLngLat(a.lngLat).addTo(map);
        labelMarkers.push(marker);
      });

      // دخول سينمائي
      if (!reduced) {
        map.easeTo({ pitch: targetView.pitch, bearing: targetView.bearing, zoom: targetView.zoom, duration: 2200 });
      }

      // نقر وتحويم الطرق (التحرير)
      var hoverTip = document.createElement('div');
      hoverTip.className = 'masar-hover-tip masar-gl-tip';
      hoverTip.style.display = 'none';
      container.appendChild(hoverTip);

      ['roads-motorway', 'roads-primary'].forEach(function (layerId) {
        map.on('mousemove', layerId, function (e) {
          var f = e.features && e.features[0];
          if (!f) return;
          map.getCanvas().style.cursor = 'pointer';
          var label = f.properties.name || f.properties.highway;
          hoverTip.textContent = label;
          hoverTip.style.display = 'block';
          hoverTip.style.left = (e.point.x + 12) + 'px';
          hoverTip.style.top = (e.point.y - 12) + 'px';
        });
        map.on('mouseleave', layerId, function () {
          map.getCanvas().style.cursor = '';
          hoverTip.style.display = 'none';
        });
        map.on('click', layerId, function (e) {
          var f = e.features && e.features[0];
          if (f && roadClickCb) {
            roadClickCb({
              osmId: f.properties.osmId,
              name: f.properties.name,
              highway: f.properties.highway,
              aadt: f.properties.aadt,
              lanes: f.properties.lanes,
              lngLat: [e.lngLat.lng, e.lngLat.lat],
            });
          }
        });
      });
    });

    if (opts.scrollZoom === false) map.scrollZoom.disable();

    function corridorFC() {
      return { type: 'FeatureCollection', features: corridorStates.map(function (s, i) {
        var f = segmentFeature(s.coords, i, s.state);
        if (s.color) f.properties.color = s.color;
        return f;
      }) };
    }

    var corridorClickCb = null;
    var digMarker = null;

    var api = {
      onReady: function (cb) { map.loaded() ? cb() : map.on('load', cb); },

      setCorridor: function (coordPairs) {
        corridorStates = coordPairs.map(function (pair) { return { coords: pair, state: 'open' }; });
        map.getSource('corridor').setData(corridorFC());
      },

      onCorridorClick: function (cb) {
        corridorClickCb = cb;
        map.on('click', 'corridor-core', function (e) {
          var f = e.features && e.features[0];
          if (f && corridorClickCb) corridorClickCb(Number(f.properties.idx));
        });
        map.on('mouseenter', 'corridor-core', function () { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'corridor-core', function () { map.getCanvas().style.cursor = ''; });
      },

      setCorridorState: function (idx, state) {
        if (corridorStates[idx]) {
          corridorStates[idx].state = state;
          map.getSource('corridor').setData(corridorFC());
        }
      },

      setAllCorridorStates: function (states) {
        corridorStates.forEach(function (s, i) { if (states[i]) s.state = states[i]; });
        map.getSource('corridor').setData(corridorFC());
      },

      // ألوان حرة لكل مقطع (خط الزمن الساعي) — null يعيد لون الحالة
      setCorridorColors: function (colors) {
        corridorStates.forEach(function (s, i) { s.color = colors[i] || null; });
        map.getSource('corridor').setData(corridorFC());
      },

      setCorridorColor: function (idx, color) {
        if (corridorStates[idx]) {
          corridorStates[idx].color = color || null;
          map.getSource('corridor').setData(corridorFC());
        }
      },

      setDigSite: function (lngLat, popupHtml) {
        if (!digMarker) {
          var el = document.createElement('div');
          el.className = 'masar-dig-marker';
          el.innerHTML = '<span class="ring"></span><span class="ring2"></span><span class="pin"></span>';
          digMarker = new maplibregl.Marker({ element: el }).setLngLat(lngLat).addTo(map);
        } else {
          digMarker.setLngLat(lngLat);
        }
        if (!reduced) {
          map.flyTo({ center: lngLat, zoom: Math.max(map.getZoom(), 13.2), duration: 900 });
        }
      },

      setAlternatives: function (featureCollection) {
        map.getSource('alternatives').setData(featureCollection);
      },

      sweepUnlock: function (idx, done) {
        var seg = corridorStates[idx];
        if (!seg) { if (done) done(); return; }
        if (reduced) {
          api.setCorridorState(idx, 'unlocked');
          if (done) done();
          return;
        }
        map.getSource('sweep').setData({ type: 'FeatureCollection', features: [segmentFeature(seg.coords, idx, 'sweep')] });
        var start = null;
        var DURATION = 1200;
        function frame(ts) {
          if (start === null) start = ts;
          var p = Math.min(1, (ts - start) / DURATION);
          var eased = 1 - Math.pow(1 - p, 3);
          // توقفات تصاعدية دائماً: 0 < tail < head < 1
          var head = Math.min(0.999, Math.max(0.002, eased));
          var tail = Math.max(0.001, head - 0.12);
          try {
            map.setPaintProperty('sweep-line', 'line-gradient', [
              'interpolate', ['linear'], ['line-progress'],
              0, COLORS.unlocked,
              tail, COLORS.unlocked,
              head, 'rgba(52,211,153,0.15)',
              1, 'rgba(52,211,153,0)',
            ]);
          } catch (err) { p = 1; }
          if (p < 1) {
            requestAnimationFrame(frame);
          } else {
            api.setCorridorState(idx, 'unlocked');
            map.getSource('sweep').setData({ type: 'FeatureCollection', features: [] });
            if (done) done();
          }
        }
        requestAnimationFrame(frame);
        // إيماءة كاميرا خفيفة تبيع اللحظة
        map.easeTo({ pitch: 52, duration: 600 });
        setTimeout(function () { map.easeTo({ pitch: 45, duration: 700 }); }, 900);
      },

      setPhase: function (phase) {
        var glowOpacity = phase === 'peak' ? 0.85 : phase === 'night' ? 0.28 : 0.55;
        var minorOpacity = phase === 'night' ? 0.55 : 0.9;
        try {
          map.setPaintProperty('roads-glow', 'line-opacity', glowOpacity);
          map.setPaintProperty('roads-minor', 'line-opacity', minorOpacity);
        } catch (err) { /* الطبقات لم تجهز بعد */ }
      },

      updateRoad: function (osmId, props) {
        for (var i = 0; i < data.features.length; i += 1) {
          if (data.features[i].properties.osmId === osmId) {
            if (props.aadt !== undefined) data.features[i].properties.aadt = props.aadt;
            if (props.lanes !== undefined) data.features[i].properties.lanes = props.lanes;
            break;
          }
        }
        map.getSource('roads').setData(data);
        return data;
      },

      onRoadClick: function (cb) { roadClickCb = cb; },

      getData: function () { return data; },
    };

    return { map: map, api: api };
  }

  return {
    buildStyle: buildStyle,
    collectLabelAnchors: collectLabelAnchors,
    init: init,
    COLORS: COLORS,
  };
});
