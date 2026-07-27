/**
 * مسار — نموذج بيانات تجربة الجهة.
 * ---------------------------------------------------------------------------
 * طبقة نقية بين المحفظة وصفحة العرض: تختار حالة موجودة، تشتق المقاييس
 * المباشرة، وتمتنع عن اختراع أثر النافذة المشتركة. لا شبكة ولا تخزين ولا DOM.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MasarExperienceModel = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ELECTRICITY = 'الشركة السعودية للكهرباء';
  var WATER = 'شركة المياه الوطنية';
  var DEFAULT_CURRENT = 'BLD-2026-0077';
  var DEFAULT_OTHER = 'BLD-2026-0076';
  var DAY_MS = 86400000;
  var VIEWBOX = { width: 640, height: 260, inset: 24 };
  var WAITING_STATUSES = [
    'Submitted',
    'CompletenessReview',
    'ImpactScreening',
    'StrategyReview',
  ];
  var SCHEDULED_STATUSES = ['Scheduled', 'Deployed'];

  function featuresOf(portfolio) {
    return portfolio && Array.isArray(portfolio.features) ? portfolio.features : [];
  }

  function byRef(features, ref) {
    return features.filter(function (feature) {
      return feature && feature.properties &&
        feature.properties.permitRef === ref;
    })[0] || null;
  }

  function noticeFor(compliance, ref) {
    return compliance && compliance.notices && compliance.notices[ref] || null;
  }

  function othersOf(compliance, ref) {
    var notice = noticeFor(compliance, ref);
    return notice && Array.isArray(notice.others) ? notice.others : [];
  }

  function validPair(current, other) {
    return Boolean(
      current && other &&
      current.properties && other.properties &&
      current.properties.promoter === ELECTRICITY &&
      other.properties.promoter === WATER &&
      current.properties.street === other.properties.street
    );
  }

  function findScenario(features, compliance, options) {
    var requested = options || {};
    var current = byRef(features, requested.currentRef || DEFAULT_CURRENT);
    var other = byRef(features, requested.otherRef || DEFAULT_OTHER);

    if (validPair(current, other)) {
      return { current: current, other: other };
    }

    var electricity = features.filter(function (feature) {
      return feature && feature.properties &&
        feature.properties.promoter === ELECTRICITY;
    });

    for (var i = 0; i < electricity.length; i += 1) {
      var waterNotice = othersOf(
        compliance,
        electricity[i].properties.permitRef,
      ).filter(function (candidate) {
        return candidate.promoter === WATER;
      })[0];

      if (waterNotice) {
        other = byRef(features, waterNotice.permitRef);
        if (validPair(electricity[i], other)) {
          return { current: electricity[i], other: other };
        }
      }
    }

    return null;
  }

  function parseDate(value) {
    var ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
  }

  function inclusiveDays(start, end) {
    var startMs = parseDate(start);
    var endMs = parseDate(end);
    if (startMs === null || endMs === null || endMs < startMs) return 0;
    return Math.max(1, Math.ceil((endMs - startMs) / DAY_MS));
  }

  function unionDays(current, other) {
    var starts = [
      parseDate(current.properties.start),
      parseDate(other.properties.start),
    ].filter(function (value) { return value !== null; });
    var ends = [
      parseDate(current.properties.end),
      parseDate(other.properties.end),
    ].filter(function (value) { return value !== null; });
    if (starts.length !== 2 || ends.length !== 2) return 0;
    return Math.max(1, Math.ceil((Math.max.apply(null, ends) -
      Math.min.apply(null, starts)) / DAY_MS));
  }

  function numeric(value) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function coordinatesOf(feature) {
    var geometry = feature && feature.geometry;
    if (!geometry || geometry.type !== 'LineString' ||
        !Array.isArray(geometry.coordinates)) {
      return [];
    }
    return geometry.coordinates.filter(function (point) {
      return Array.isArray(point) && point.length >= 2 &&
        Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1]));
    }).map(function (point) {
      return [Number(point[0]), Number(point[1])];
    });
  }

  function pathFrom(points, bounds) {
    if (!points.length || !bounds) return '';
    var drawableWidth = VIEWBOX.width - VIEWBOX.inset * 2;
    var drawableHeight = VIEWBOX.height - VIEWBOX.inset * 2;
    var dx = Math.max(bounds.maxX - bounds.minX, 0.000001);
    var dy = Math.max(bounds.maxY - bounds.minY, 0.000001);
    var scale = Math.min(drawableWidth / dx, drawableHeight / dy);
    var usedWidth = dx * scale;
    var usedHeight = dy * scale;
    var offsetX = VIEWBOX.inset + (drawableWidth - usedWidth) / 2;
    var offsetY = VIEWBOX.inset + (drawableHeight - usedHeight) / 2;

    return points.map(function (point, index) {
      var x = offsetX + (point[0] - bounds.minX) * scale;
      var y = offsetY + (bounds.maxY - point[1]) * scale;
      return (index ? 'L ' : 'M ') + x.toFixed(1) + ' ' + y.toFixed(1);
    }).join(' ');
  }

  function projectGeometry(current, other) {
    var currentPoints = coordinatesOf(current);
    var otherPoints = coordinatesOf(other);
    var points = currentPoints.concat(otherPoints);
    if (!points.length) {
      return { currentPath: '', otherPath: '', viewBox: '0 0 640 260' };
    }

    var xs = points.map(function (point) { return point[0]; });
    var ys = points.map(function (point) { return point[1]; });
    var bounds = {
      minX: Math.min.apply(null, xs),
      maxX: Math.max.apply(null, xs),
      minY: Math.min.apply(null, ys),
      maxY: Math.max.apply(null, ys),
    };

    return {
      currentPath: pathFrom(currentPoints, bounds),
      otherPath: pathFrom(otherPoints, bounds),
      viewBox: '0 0 640 260',
    };
  }

  function formatNumber(value, digits) {
    var parsed = Number(value);
    if (!Number.isFinite(parsed)) return '—';
    try {
      return parsed.toLocaleString('ar-SA-u-nu-latn', {
        maximumFractionDigits: digits === undefined ? 0 : digits,
      });
    } catch (err) {
      return String(Math.round(parsed));
    }
  }

  function formatDate(value) {
    var ms = parseDate(value);
    if (ms === null) return '—';
    try {
      return new Intl.DateTimeFormat('ar-SA-u-nu-latn', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(new Date(ms));
    } catch (err) {
      return new Date(ms).toISOString().slice(0, 10);
    }
  }

  function bucketFor(feature, compliance) {
    var properties = feature.properties || {};
    if (othersOf(compliance, properties.permitRef).length) return 'action';
    if (SCHEDULED_STATUSES.indexOf(properties.status) !== -1) return 'scheduled';
    if (WAITING_STATUSES.indexOf(properties.status) !== -1) return 'waiting';
    return 'all';
  }

  function permitItem(feature, compliance) {
    var properties = feature.properties || {};
    return {
      permitRef: properties.permitRef || '',
      title: properties.title || '',
      street: properties.street || '',
      promoter: properties.promoter || '',
      status: properties.status || '',
      nextAction: properties.nextAction || '',
      start: properties.start || '',
      end: properties.end || '',
      impactVehHours: numeric(properties.impactVehHours),
      confidence: properties.confidence || '',
      bucket: bucketFor(feature, compliance),
      noticeCount: othersOf(compliance, properties.permitRef).length,
    };
  }

  function permitsOf(electricity, compliance) {
    var items = electricity.map(function (feature) {
      return permitItem(feature, compliance);
    }).sort(function (a, b) {
      if (a.bucket === 'action' && b.bucket !== 'action') return -1;
      if (a.bucket !== 'action' && b.bucket === 'action') return 1;
      return b.impactVehHours - a.impactVehHours;
    });

    var selected = [];
    ['action', 'waiting', 'scheduled'].forEach(function (bucket) {
      items.filter(function (item) {
        return item.bucket === bucket;
      }).slice(0, 2).forEach(function (item) {
        if (selected.indexOf(item) === -1) selected.push(item);
      });
    });

    items.forEach(function (item) {
      if (selected.length < 8 && selected.indexOf(item) === -1) selected.push(item);
    });
    return selected.slice(0, 8);
  }

  function summaryOf(electricity, compliance) {
    var items = electricity.map(function (feature) {
      return permitItem(feature, compliance);
    });
    var actionCount = items.filter(function (item) {
      return item.bucket === 'action';
    }).length;
    return {
      permitCount: items.length,
      actionCount: actionCount,
      waitingCount: items.filter(function (item) {
        return item.bucket === 'waiting';
      }).length,
      coordinationCount: actionCount,
    };
  }

  function relationOf(compliance, currentRef, otherRef) {
    var entry = othersOf(compliance, currentRef).filter(function (candidate) {
      return candidate.permitRef === otherRef;
    })[0];
    return entry && entry.relation || 'ongoing';
  }

  function scenarioOf(pair, compliance) {
    var current = pair.current;
    var other = pair.other;
    var currentProperties = current.properties || {};
    var otherProperties = other.properties || {};
    return {
      current: current,
      other: other,
      notice: noticeFor(compliance, currentProperties.permitRef) || {
        street: currentProperties.street || '',
        others: [],
      },
      relation: relationOf(
        compliance,
        currentProperties.permitRef,
        otherProperties.permitRef,
      ),
      before: {
        openings: 2,
        occupiedDays: inclusiveDays(
          currentProperties.start,
          currentProperties.end,
        ) + inclusiveDays(otherProperties.start, otherProperties.end),
        impactVehHours: numeric(currentProperties.impactVehHours) +
          numeric(otherProperties.impactVehHours),
      },
      proposed: {
        openings: 1,
        occupiedDays: unionDays(current, other),
        impactVehHours: null,
      },
      geometry: projectGeometry(current, other),
    };
  }

  function capabilities() {
    return [
      {
        title: 'قياس الأثر',
        purpose: 'تحويل إغلاق المسارات إلى كلفة مرورية قابلة للمقارنة.',
        input: 'الحركة والمسارات ووقت العمل',
        output: 'ساعة-مركبة وشدة وتأخير',
      },
      {
        title: 'تحسين نافذة العمل',
        purpose: 'اقتراح وقت أقل كلفة من النافذة المطلوبة.',
        input: 'مدة العمل ومنحنى الطلب',
        output: 'ثلاث نوافذ مفسرة',
      },
      {
        title: 'كشف التعارض',
        purpose: 'إظهار الأعمال المتزامنة على المقطع نفسه.',
        input: 'الموقع والنافذة',
        output: 'علاقة زمنية ومكانية',
      },
      {
        title: 'التنسيق بين الجهات',
        purpose: 'إخبار الجهة قبل أن تتحول الفرصة إلى إغلاق ثانٍ.',
        input: 'تصريح جديد ومحفظة قائمة',
        output: 'تنبيه وإجراء تالٍ',
      },
      {
        title: 'الحفر مرة واحدة',
        purpose: 'اقتراح جمع الأعمال المتجاورة في نافذة مشتركة.',
        input: 'التصاريح على الشارع',
        output: 'مرشحو دمج وحدود القرار',
      },
      {
        title: 'خطة إدارة المرور',
        purpose: 'تحويل النافذة المعتمدة إلى خطة قابلة للتنفيذ.',
        input: 'التصريح والتوصية',
        output: 'خطة مطبوعة',
      },
      {
        title: 'النشر',
        purpose: 'إخراج الإغلاق بصيغة قابلة للتبادل.',
        input: 'الهندسة والوقت والاتجاه',
        output: 'تغذية إغلاق معيارية',
      },
      {
        title: 'القياس والمعايرة',
        purpose: 'مقارنة التوقع بما رُصد بعد التنفيذ.',
        input: 'رصد ميداني',
        output: 'انحراف ومعامل تصحيح',
      },
      {
        title: 'تفسير الثقة',
        purpose: 'شرح ما يثبت التوصية وما قد يقلبها.',
        input: 'الافتراضات والحساسية',
        output: 'مستوى وثغرات بيانات',
      },
      {
        title: 'سجل القرار',
        purpose: 'حفظ ما دخل القرار وما خرج منه ومن وقّعه.',
        input: 'نسخة المدخلات والإجراء',
        output: 'سجل قابل للمراجعة',
      },
    ];
  }

  function buildViewModel(portfolio, compliance, options) {
    var features = featuresOf(portfolio);
    var available = Boolean(portfolio && compliance);
    var pair = available ? findScenario(features, compliance, options || {}) : null;
    var electricity = features.filter(function (feature) {
      return feature && feature.properties &&
        feature.properties.promoter === ELECTRICITY;
    });

    return {
      available: available,
      actor: { name: ELECTRICITY, shortName: 'هيئة الكهرباء' },
      dataLimit: compliance &&
        (compliance.portfolioLimit || compliance.dataLimit) || '',
      summary: summaryOf(electricity, compliance),
      scenario: pair ? scenarioOf(pair, compliance) : null,
      permits: permitsOf(electricity, compliance),
      capabilities: capabilities(),
    };
  }

  return {
    buildViewModel: buildViewModel,
    findScenario: findScenario,
    projectGeometry: projectGeometry,
    formatNumber: formatNumber,
    formatDate: formatDate,
  };
});
