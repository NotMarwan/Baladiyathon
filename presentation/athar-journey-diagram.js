/**
 * أثر — راسم مخطط النشاط (UML Activity Diagram) من نموذج الرحلة.
 * ---------------------------------------------------------------------------
 * تبويب مؤقّت — انظر رأس `athar-journey-model.js`.
 *
 * الأشكال قياسية ولا تُجتهد: قرصٌ مصمت للبداية، وقرصٌ بحلقة للنهاية، ومستطيلٌ
 * مستدير الأركان للنشاط، ومعيّنٌ للقرار، وسهمٌ لكل انتقال. والمساران — المراجع
 * والنظام — شريطان رأسيان معنونان، فيُقرأ من كل خطوة من ينفّذها.
 *
 * التخطيط شبكي لا محسوب بخوارزمية: `row` يعطي الارتفاع، و`lane` و`side`
 * يعطيان العمود. مخططٌ يُرتَّب تلقائياً يتغيّر شكله مع كل تعديل فلا يُقارَن
 * بنسخته السابقة؛ والشبكة الثابتة تجعل الفرق في المخطط فرقاً في الرحلة.
 *
 * الراسم نقي: يأخذ النموذج ويعيد نصاً. لا DOM — يُختبر في Node.
 *
 * UMD بنفس نمط athar-engine.js.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AtharJourneyDiagram = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var W = 1420;
  var ROW_H = 104;
  var TOP = 78;
  var NODE_W = 240;
  var NODE_H = 56;
  var DEC_W = 172;
  var DEC_H = 70;

  /* المساران شريطان، والقنوات على الطرفين لأسهم العودة. */
  var LANE_BOX = {
    system: { x: 100, w: 664 },
    user: { x: 772, w: 562 },
  };

  var COLUMN = {
    system: { main: 622, side: 250 },
    user: { main: 902, side: 1212 },
  };

  var RETURN = { user: 1352, system: 76 };

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/[&<>"']/g, function (ch) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
      });
  }

  function centerX(node) {
    return COLUMN[node.lane][node.side ? 'side' : 'main'];
  }

  function centerY(node) {
    return TOP + node.row * ROW_H + NODE_H / 2;
  }

  function isDecision(node) {
    return node.kind === 'decision';
  }

  function box(node) {
    var cx = centerX(node);
    var cy = centerY(node);
    var w = isDecision(node) ? DEC_W : NODE_W;
    var h = isDecision(node) ? DEC_H : NODE_H;
    return {
      cx: cx, cy: cy,
      top: cy - h / 2, bottom: cy + h / 2,
      left: cx - w / 2, right: cx + w / 2,
    };
  }

  /**
   * لفّ النص على أسطر بعدد محارف تقريبي.
   * SVG لا يلفّ النص من نفسه — سطرٌ واحد طويل يخرج من الشكل ويُقرأ فوق جاره.
   */
  function wrap(text, perLine) {
    var words = String(text).split(/\s+/);
    var lines = [];
    var line = '';
    words.forEach(function (word) {
      var candidate = line ? line + ' ' + word : word;
      if (candidate.length > perLine && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    });
    if (line) lines.push(line);
    return lines;
  }

  function label(x, y, text, cls, perLine) {
    var lines = wrap(text, perLine || 32);
    var start = y - ((lines.length - 1) * 15) / 2;
    return lines.map(function (line, index) {
      return '<text class="' + cls + '" x="' + x + '" y="' + (start + index * 15).toFixed(1)
        + '">' + escapeHtml(line) + '</text>';
    }).join('');
  }

  function renderNode(node) {
    var b = box(node);

    if (node.kind === 'start' || node.kind === 'end') {
      var disc = '<circle class="jn-disc jn-' + node.kind + '" cx="' + b.cx + '" cy="' + b.cy
        + '" r="15"/>'
        + (node.kind === 'end'
          ? '<circle class="jn-disc-inner" cx="' + b.cx + '" cy="' + b.cy + '" r="8"/>' : '');
      return '<g class="jn jn-terminal-node">' + disc
        + label(b.cx, b.cy + 38, node.label, 'jn-text jn-text-strong', 34) + '</g>';
    }

    if (isDecision(node)) {
      var points = [
        b.cx + ',' + (b.cy - DEC_H / 2),
        (b.cx + DEC_W / 2) + ',' + b.cy,
        b.cx + ',' + (b.cy + DEC_H / 2),
        (b.cx - DEC_W / 2) + ',' + b.cy,
      ].join(' ');
      return '<g class="jn"><polygon class="jn-decision" points="' + points + '"/>'
        + label(b.cx, b.cy, node.label, 'jn-text jn-text-decision', 18) + '</g>';
    }

    // الحاشية تقع تحت الشكل، والسهم النازل يمرّ من موضعها. هالةٌ بلون السطح
    // تحت الحرف تفصله عن الخط بدل أن يتقاطعا فيُقرأ الاثنان بصعوبة.
    var note = node.note
      ? label(b.cx, b.bottom + 15, node.note, 'jn-note jn-note-halo', 44)
      : '';

    return '<g class="jn">'
      + '<rect class="jn-box jn-' + node.kind + '" x="' + b.left + '" y="' + b.top
      + '" width="' + NODE_W + '" height="' + NODE_H + '" rx="10"/>'
      + label(b.cx, b.cy, node.label, 'jn-text', 34)
      + note
      + '</g>';
  }

  function path(points, cls) {
    var d = points.map(function (point, index) {
      return (index ? 'L' : 'M') + point[0].toFixed(1) + ' ' + point[1].toFixed(1);
    }).join(' ');
    return '<path class="' + cls + '" d="' + d + '" marker-end="url(#jnArrow)"/>';
  }

  function edgeLabel(x, y, text) {
    if (!text) return '';
    var width = text.length * 7.4 + 14;
    return '<g class="jn-edge-label">'
      + '<rect x="' + (x - width / 2).toFixed(1) + '" y="' + (y - 10) + '" width="' + width.toFixed(1)
      + '" height="20" rx="5"/>'
      + '<text x="' + x.toFixed(1) + '" y="' + (y + 4) + '">' + escapeHtml(text) + '</text></g>';
  }

  /**
   * خطوتان متوازيتان على الصف نفسه: سهم أفقي بين حافتيهما.
   * رسمها بقناة رأسية يدفعها إلى هامش العودة فتُقرأ رجوعاً وهي تقدّم.
   */
  function siblingEdge(from, to, edge) {
    var a = box(from);
    var b = box(to);
    var toLeft = b.cx < a.cx;
    var exit = toLeft ? a.left : a.right;
    var enter = toLeft ? b.right : b.left;

    return path([[exit, a.cy], [enter, b.cy]], 'jn-edge')
      + edgeLabel((exit + enter) / 2, a.cy - 14, edge.label);
  }

  /** انتقال عادي: نزولاً، وبانكسار قائم حين يختلف العمود. */
  function forwardEdge(from, to, edge) {
    var a = box(from);
    var b = box(to);
    var channel = a.bottom + (b.top - a.bottom) / 2;

    if (Math.abs(a.cx - b.cx) < 1) {
      return path([[a.cx, a.bottom], [b.cx, b.top]], 'jn-edge')
        + edgeLabel(a.cx + 46, channel, edge.label);
    }

    return path([[a.cx, a.bottom], [a.cx, channel], [b.cx, channel], [b.cx, b.top]], 'jn-edge')
      + edgeLabel((a.cx + b.cx) / 2, channel - 12, edge.label);
  }

  /**
   * سهم العودة إلى خطوة سابقة — على قناة خارج الشريطين.
   * متقطّع ومعنون: العودة ليست تقدّماً، والشكل يقولها قبل النص.
   */
  function backEdge(from, to, edge, index) {
    var a = box(from);
    var b = box(to);
    var outward = RETURN[to.lane] > a.cx ? 1 : -1;
    var lane = RETURN[to.lane] + outward * (index % 3) * 16;
    var exit = outward > 0 ? a.right : a.left;
    var enter = outward > 0 ? b.right : b.left;

    return path([
      [exit, a.cy], [lane, a.cy], [lane, b.cy], [enter, b.cy],
    ], 'jn-edge jn-edge-back')
      + edgeLabel(lane - outward * 52, (a.cy + b.cy) / 2, edge.label);
  }

  function renderLanes(model, height) {
    return model.LANES.map(function (lane) {
      var geometry = LANE_BOX[lane.id];
      return '<g class="jn-lane jn-lane-' + lane.id + '">'
        + '<rect x="' + geometry.x + '" y="30" width="' + geometry.w + '" height="'
        + (height - 50) + '" rx="14"/>'
        + '<text class="jn-lane-title" x="' + (geometry.x + geometry.w / 2) + '" y="56">'
        + escapeHtml(lane.label) + '</text></g>';
    }).join('');
  }

  /**
   * @param {object} model نموذج الرحلة
   * @returns {string} عنصر <svg> كاملاً
   */
  function render(model) {
    var maxRow = model.NODES.reduce(function (top, node) {
      return Math.max(top, node.row);
    }, 0);
    var height = TOP + (maxRow + 1) * ROW_H + 60;

    var backCount = 0;
    var edges = model.EDGES.map(function (edge) {
      var from = model.byId(edge.from);
      var to = model.byId(edge.to);
      if (!from || !to) return '';
      if (edge.back || to.row < from.row) {
        backCount += 1;
        return backEdge(from, to, edge, backCount - 1);
      }
      if (to.row === from.row) return siblingEdge(from, to, edge);
      return forwardEdge(from, to, edge);
    }).join('');

    var nodes = model.NODES.map(renderNode).join('');

    return '<svg class="journey-svg" viewBox="0 0 ' + W + ' ' + height + '" width="' + W
      + '" height="' + height + '" xmlns="http://www.w3.org/2000/svg" role="img"'
      + ' aria-label="مخطط نشاط UML لرحلة المراجع داخل أثر — من الدخول حتى النتيجة">'
      + '<defs><marker id="jnArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7"'
      + ' markerHeight="7" orient="auto-start-reverse">'
      + '<path class="jn-arrow-head" d="M 0 0 L 10 5 L 0 10 z"/></marker></defs>'
      + renderLanes(model, height)
      + '<g class="jn-edges">' + edges + '</g>'
      + '<g class="jn-nodes">' + nodes + '</g>'
      + '</svg>';
  }

  return {
    render: render,
    wrap: wrap,
    box: box,
    W: W,
  };
});
