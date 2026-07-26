/**
 * مسار — الخريطة المملوكة (نسخة «غرفة التحكم»)
 * ---------------------------------------------------------------------------
 * مبرر التصميم (10 أسطر):
 * 1) الاتجاه: غرفة تحكم تنقلات وطنية ليلية — الطرق ضوء فوق إسفلت داكن.
 * 2) الإسفلت #102535 من هوية المنتج، فالخريطة امتداد للعلامة لا خلفية مفقودة.
 * 3) التسلسل بالضوء: سريع كهرماني متوهج ← رئيسي أزرق بارد ← فرعي خيط رفيع.
 * 4) التوهج للسريع فقط (طبقة ضبابية مستقلة) — الفخامة بلا ضوضاء بصرية.
 * 5) الممر بطل المشهد: غلاف داكن + قلب سماوي، فوق كل طبقات الشبكة.
 * 6) الأسماء العربية مرة واحدة لكل طريق، عند التكبير فقط — تايبوغرافي لا فوضى.
 * 7) كل الحركة على transform/opacity/filter — 60fps بلا إجهاد تخطيط.
 * 8) بلا شبكة، بلا تبعيات: Canvas من Leaflet المحلي + CSS نظيف.
 * 9) العقد البرمجي والبيانات لم يتغيرا — نفس API ونفس مدخلات التوجيه.
 * 10) شارة «بيانات توضيحية للعرض» داخل الخريطة دائمًا — الصدق جزء من التصميم.
 *
 * رسم شبكة طرق محلية من GeoJSON بلا بلاط خارجي. بيانات الطرق
 * © مساهمو OpenStreetMap — رخصة ODbL.
 * UMD بنفس نمط masar-engine.js — مسارات Node لا تعتمد Leaflet.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MasarOwnedMap = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // لوحة «البيانات كضوء»: كهرمان دافئ للسريع، أزرق بارد للرئيسي، خيط للفرعي
  var CLASS_STYLES = {
    motorway: { color: '#e8a33d', weight: 3.2 },
    trunk: { color: '#d18a4a', weight: 2.6 },
    primary: { color: '#7fb3d1', weight: 2.1 },
    secondary: { color: '#5b7a94', weight: 1.5 },
    tertiary: { color: '#3d5468', weight: 1.0 },
  };
  var DEFAULT_STYLE = { color: '#46566a', weight: 1.0 };
  // وصلات الطرق (*_link) ترث لون الأم بوزن مخفّض — تنتمي بصريًا بلا صخب
  var LINK_WEIGHT_FACTOR = 0.55;
  // لون التحويم (رفع الطريق: سماكة + سطوع)
  var HOVER_COLORS = {
    motorway: '#ffcf7d',
    trunk: '#eab27f',
    primary: '#a8d8f0',
    secondary: '#8fb0ca',
    tertiary: '#6b87a1',
  };
  // AADT توضيحي افتراضي حسب الصنف — موسوم في لوحة التحرير
  var CLASS_AADT = { motorway: 90000, trunk: 70000, primary: 45000, secondary: 25000, tertiary: 12000 };
  var CLASS_LANES = { motorway: 4, trunk: 4, primary: 3, secondary: 2, tertiary: 2 };
  var MIN_SEGMENT_KM = 0.01;

  // منحدر السماكة حسب التكبير (z≤12 بعيد، 13-14 قياسي، ≥15 قريب)
  function zoomFactor(z) {
    if (z <= 12) return 0.8;
    if (z <= 14) return 1.0;
    return 1.35;
  }

  function baseClass(highway) {
    return String(highway || '').replace(/_link$/, '');
  }

  function isLinkClass(highway) {
    return /_link$/.test(String(highway || ''));
  }

  function styleFor(highwayClass) {
    var base = CLASS_STYLES[baseClass(highwayClass)] || DEFAULT_STYLE;
    if (isLinkClass(highwayClass)) {
      return { color: base.color, weight: Math.max(0.7, base.weight * LINK_WEIGHT_FACTOR) };
    }
    return { color: base.color, weight: base.weight };
  }

  function groupOf(highway) {
    var b = baseClass(highway);
    if (b === 'motorway' || b === 'trunk') return 'A';
    if (b === 'primary') return 'B';
    return 'C';
  }

  function haversineKm(a, b) {
    var R = 6371;
    var dLat = ((b[1] - a[1]) * Math.PI) / 180;
    var dLon = ((b[0] - a[0]) * Math.PI) / 180;
    var lat1 = (a[1] * Math.PI) / 180;
    var lat2 = (b[1] * Math.PI) / 180;
    var h =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function toRoutingSegments(features) {
    return features
      .filter(function (f) { return f.geometry && f.geometry.type === 'LineString'; })
      .map(function (f, i) {
        var coords = f.geometry.coordinates;
        var lengthKm = 0;
        for (var j = 1; j < coords.length; j += 1) {
          lengthKm += haversineKm(coords[j - 1], coords[j]);
        }
        var highway = f.properties.highway;
        return {
          id: f.properties.osmId || 'seg_' + i,
          name: f.properties.name || highway,
          highway: highway,
          coords: coords,
          lengthKm: Math.max(lengthKm, MIN_SEGMENT_KM),
          lanes: f.properties.lanes || CLASS_LANES[highway] || 2,
          aadt: f.properties.aadt || CLASS_AADT[highway] || 10000,
        };
      });
  }

  // اسم واحد لكل طريق: نختار أطول مقطع يحمل الاسم ونثبّت التسمية في منتصفه
  function collectLabels(features) {
    var byName = new Map();
    features.forEach(function (f) {
      var props = f.properties || {};
      var name = props.name;
      var cls = baseClass(props.highway);
      if (!name || isLinkClass(props.highway)) return;
      if (cls !== 'motorway' && cls !== 'trunk' && cls !== 'primary') return;
      var coords = f.geometry && f.geometry.coordinates;
      if (!coords || coords.length < 2) return;
      var current = byName.get(name);
      if (!current || coords.length > current.count) {
        byName.set(name, { name: name, cls: cls, count: coords.length, mid: coords[Math.floor(coords.length / 2)] });
      }
    });
    return Array.from(byName.values());
  }

  function makeLegendControl(L) {
    var legend = L.control({ position: 'bottomleft' });
    legend.onAdd = function () {
      var div = L.DomUtil.create('div', 'masar-legend');
      div.innerHTML =
        '<div class="masar-legend-toggle"><span>دليل الخريطة</span><span class="masar-legend-chevron">▾</span></div>' +
        '<div class="masar-legend-body">' +
        '<div class="masar-legend-row"><span class="masar-swatch" style="background:#e8a33d"></span>طرق سريعة</div>' +
        '<div class="masar-legend-row"><span class="masar-swatch" style="background:#d18a4a"></span>طرق شريانية</div>' +
        '<div class="masar-legend-row"><span class="masar-swatch" style="background:#7fb3d1"></span>طرق رئيسية</div>' +
        '<div class="masar-legend-row"><span class="masar-swatch" style="background:#5b7a94"></span>طرق ثانوية وفرعية</div>' +
        '<div class="masar-legend-row"><span class="masar-swatch" style="background:#59d6f2"></span>الممر — طريق الملك فهد</div>' +
        '<div class="masar-legend-row"><span class="masar-swatch dashed" style="color:#d19231"></span>مسار بديل محسوب</div>' +
        '<div class="masar-legend-row"><span class="masar-swatch dot" style="background:#e5484d"></span>موقع الحفر / إغلاق</div>' +
        '<div class="masar-legend-row"><span class="masar-swatch dot" style="background:#34d399"></span>انسياب بعد الجدولة</div>' +
        '</div>';
      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.disableScrollPropagation(div);
      var toggle = div.querySelector('.masar-legend-toggle');
      L.DomEvent.on(toggle, 'click', function () {
        if (div.classList.contains('collapsed')) {
          div.classList.remove('collapsed');
        } else {
          div.classList.add('collapsed');
        }
      });
      return div;
    };
    return legend;
  }

  function makeTextControl(L, position, className, text, title) {
    var control = L.control({ position: position });
    control.onAdd = function () {
      var div = L.DomUtil.create('div', className);
      div.textContent = text;
      if (title) div.title = title;
      L.DomEvent.disableClickPropagation(div);
      return div;
    };
    return control;
  }

  /**
   * رسم الشبكة على خريطة Leaflet (متصفح فقط) — نسخة غرفة التحكم.
   * @param {object} map - خريطة Leaflet
   * @param {object} geojson - FeatureCollection
   * @param {object} L - كائن Leaflet
   * @param {function} [onRoadClick] - استدعاء عند نقر طريق: (segment, layer)
   * @returns {{layers: object, roads: Array}}
   */
  function load(map, geojson, L, onRoadClick) {
    var roads = toRoutingSegments(geojson.features);
    var byId = new Map(roads.map(function (r) { return [r.id, r]; }));

    // --- طبقات مخصصة: توهج ← سريع ← رئيسي ← فرعي ← تسميات ---
    var paneDefs = [
      ['masar-glow', 380],
      ['masar-r1', 382],
      ['masar-r2', 383],
      ['masar-r3', 384],
      ['masar-labels', 640],
    ];
    paneDefs.forEach(function (def) {
      if (!map.getPane(def[0])) {
        map.createPane(def[0]);
      }
      map.getPane(def[0]).style.zIndex = def[1];
    });

    var glowRenderer = L.canvas({ pane: 'masar-glow', padding: 0.5 });
    var rendererA = L.canvas({ pane: 'masar-r1', padding: 0.5 });
    var rendererB = L.canvas({ pane: 'masar-r2', padding: 0.5 });
    var rendererC = L.canvas({ pane: 'masar-r3', padding: 0.5 });

    function featureStyle(k) {
      return function (f) {
        var s = styleFor(f.properties.highway);
        return { color: s.color, weight: s.weight * k, opacity: isLinkClass(f.properties.highway) ? 0.85 : 1 };
      };
    }

    function interactiveFor(group) {
      return function (feature, layer) {
        if (typeof onRoadClick === 'function') {
          layer.on('click', function () {
            onRoadClick(byId.get(feature.properties.osmId), layer);
          });
        }
        if (group === 'C') return; // الفرعيات ساكنة — التفاعل للشرايين
        var name = feature.properties && feature.properties.name;
        if (name) {
          layer.bindTooltip(name, {
            className: 'masar-hover-tip',
            direction: 'top',
            sticky: true,
            opacity: 1,
          });
        }
        layer.on('mouseover', function () {
          var s = styleFor(feature.properties.highway);
          layer.setStyle({
            color: HOVER_COLORS[baseClass(feature.properties.highway)] || s.color,
            weight: s.weight * zoomFactor(map.getZoom()) * 1.7,
          });
          if (layer.bringToFront) layer.bringToFront();
        });
        layer.on('mouseout', function () {
          var s = styleFor(feature.properties.highway);
          layer.setStyle({
            color: s.color,
            weight: s.weight * zoomFactor(map.getZoom()),
            opacity: isLinkClass(feature.properties.highway) ? 0.85 : 1,
          });
        });
      };
    }

    function inGroup(letter) {
      return function (f) { return groupOf(f.properties.highway) === letter; };
    }

    // التوهج: السريع والشرياني فقط (بلا وصلات)، سماكة زائدة تحت الطبقة الأم
    var glowLayer = L.geoJSON(geojson, {
      filter: function (f) {
        var h = f.properties.highway;
        return h === 'motorway' || h === 'trunk';
      },
      style: function (f) {
        var s = styleFor(f.properties.highway);
        return { color: s.color, weight: (s.weight + 2.5) * zoomFactor(map.getZoom()), opacity: 0.8, lineCap: 'round' };
      },
      renderer: glowRenderer,
      interactive: false,
    }).addTo(map);

    var layerA = L.geoJSON(geojson, {
      filter: inGroup('A'),
      style: featureStyle(zoomFactor(map.getZoom())),
      onEachFeature: interactiveFor('A'),
      renderer: rendererA,
    }).addTo(map);

    var layerB = L.geoJSON(geojson, {
      filter: inGroup('B'),
      style: featureStyle(zoomFactor(map.getZoom())),
      onEachFeature: interactiveFor('B'),
      renderer: rendererB,
    }).addTo(map);

    var layerC = L.geoJSON(geojson, {
      filter: inGroup('C'),
      style: featureStyle(zoomFactor(map.getZoom())),
      renderer: rendererC,
      interactive: false,
    }).addTo(map);

    // --- التسميات الطباعية: اسم واحد لكل طريق، يظهر عند التكبير ---
    var labelDefs = collectLabels(geojson.features);
    var labelLayers = labelDefs.map(function (def) {
      var minZoom = def.cls === 'motorway' ? 13 : 14;
      var tt = L.tooltip({
        pane: 'masar-labels',
        permanent: true,
        direction: 'center',
        interactive: false,
        className: 'masar-road-label' + (def.cls === 'motorway' ? ' masar-label-major' : ''),
      });
      tt.setLatLng([def.mid[1], def.mid[0]]);
      tt.setContent(def.name);
      return { tt: tt, minZoom: minZoom, added: false };
    });

    function syncLabels() {
      var z = map.getZoom();
      labelLayers.forEach(function (entry) {
        if (z >= entry.minZoom && !entry.added) {
          entry.tt.addTo(map);
          entry.added = true;
        } else if (z < entry.minZoom && entry.added) {
          map.removeLayer(entry.tt);
          entry.added = false;
        }
      });
    }

    // --- منحدر السماكة مع التكبير (Canvas يعيد الرسم أصلًا عند كل zoom) ---
    function applyZoomStyles() {
      var k = zoomFactor(map.getZoom());
      layerA.setStyle(featureStyle(k));
      layerB.setStyle(featureStyle(k));
      layerC.setStyle(featureStyle(k));
      glowLayer.setStyle(function (f) {
        var s = styleFor(f.properties.highway);
        return { color: s.color, weight: (s.weight + 2.5) * k, opacity: 0.8, lineCap: 'round' };
      });
    }

    map.on('zoomend', function () {
      applyZoomStyles();
      syncLabels();
    });
    syncLabels();

    // --- فينييت فوق الشبكة وتحت الممر ---
    var container = map.getContainer();
    if (container && typeof getComputedStyle === 'function' && getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }
    var vignette = L.DomUtil.create('div', 'masar-vignette');
    container.appendChild(vignette);

    // --- عناصر التحكم: مقياس، دليل قابل للطي، شارة الصدق، بوصلة ---
    L.control.scale({ imperial: false, maxWidth: 90 }).addTo(map);
    makeLegendControl(L).addTo(map);
    makeTextControl(L, 'topright', 'masar-demo-chip', 'بيانات توضيحية للعرض', 'كل الأرقام المرورية على هذه الخريطة توضيحية للعرض').addTo(map);
    makeTextControl(L, 'topright', 'masar-north', 'ش', 'شمال').addTo(map);

    // --- دخول متدرج: السريع أولًا ثم الرئيسي ثم الفرعي (مرة واحدة) ---
    ['masar-glow', 'masar-r1', 'masar-r2', 'masar-r3'].forEach(function (paneName) {
      var pane = map.getPane(paneName);
      if (pane) pane.classList.add('masar-enter');
    });
    setTimeout(function () {
      ['masar-glow', 'masar-r1', 'masar-r2', 'masar-r3'].forEach(function (paneName) {
        var pane = map.getPane(paneName);
        if (pane) pane.classList.remove('masar-enter');
      });
    }, 2200);

    return { layers: L.layerGroup([glowLayer, layerA, layerB, layerC]), roads: roads };
  }

  return { styleFor: styleFor, toRoutingSegments: toRoutingSegments, load: load, CLASS_AADT: CLASS_AADT, CLASS_LANES: CLASS_LANES };
});
