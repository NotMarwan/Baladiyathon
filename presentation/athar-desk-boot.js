/**
 * أثر — مُقلع مكتب المراجع.
 * ---------------------------------------------------------------------------
 * كان هذا سكربتاً داخل الصفحة. أُخرج ليُحمَّل بـ defer مع بقية الملفات، فيكتمل
 * تحليل HTML ويُرسم الهيكل قبل أن يُفكّ أي بايت من شبكة الطرق. الترتيب محفوظ:
 * سكربتات defer تُنفَّذ بترتيب ورودها قبل DOMContentLoaded، فكل ما يعتمد عليه
 * هذا الملف يكون معرَّفاً حين يبدأ.
 */
(function () {
  'use strict';

  // مكتب المراجع: صندوق أعمال + خريطة + ملف قرار على مخزن حالة واحد.
  // لا محرك يُعاد كتابته — كلها تُستهلك كما هي. البيانات محلية بالكامل.

  var ACTOR = 'مناوب الفرز';

  /**
   * حالة الإقلاع.
   * ---------------------------------------------------------------------------
   * الغطاء يغطي الخريطة وحدها لا الشاشة: صندوق الأعمال يصبح صالحاً للعمل قبل
   * أن ترسم الخريطة أول بلاطة، فالمراجع يبدأ الفرز بينما تكتمل الخلفية. وكل
   * تبديل نص هنا مربوط بحدث حقيقي — لا مؤشر يدور يوهم بتقدّم لا يحدث.
   */
  var bootEl = document.getElementById('deskBoot');
  var BOOT_CEILING_MS = 25000;
  var bootTimer = null;

  function bootStage(text) {
    if (!bootEl) return;
    var line = bootEl.querySelector('.desk-boot-status');
    if (line) line.textContent = text;
  }

  function bootDone() {
    if (bootTimer) { window.clearTimeout(bootTimer); bootTimer = null; }
    if (!bootEl) return;
    var node = bootEl;
    bootEl = null;
    node.setAttribute('data-done', 'true');
    window.setTimeout(function () {
      if (node.parentNode) node.parentNode.removeChild(node);
    }, 240);
  }

  // غطاء لا ينزاح أسوأ من غياب الغطاء: سقف زمني يرفعه مهما حدث خلفه.
  if (bootEl) bootTimer = window.setTimeout(bootDone, BOOT_CEILING_MS);
  var portfolio = window.ATHAR_CITY_PORTFOLIO || { type: 'FeatureCollection', features: [] };

  var listEl = document.getElementById('deskList');
  var toolbarEl = document.getElementById('deskToolbar');
  var fileEl = document.getElementById('deskFile');
  var ledgerEl = document.getElementById('deskLedger');

  /**
   * ثبات القرار على مستويين.
   * ---------------------------------------------------------------------------
   * المتصفح هو المخزن المؤكّد: يعمل من القرص كما يعمل من الخادم، ولا يفقد
   * المراجع قراره إن سقط الخادم. والخادم مخزن ثانٍ يثبت أن دورة القرار تعبر
   * واجهة معيارية ويفرض القواعد نفسها. الفشل في أحدهما لا يُسقط الآخر ولا
   * يُسقط الصفحة.
   */
  var LEDGER = {
    read: function () {
      try {
        return AtharDecisionRecord.deserialize(
          window.localStorage.getItem(AtharDecisionRecord.STORAGE_KEY)
        );
      } catch (err) {
        return {};
      }
    },
    write: function (byWork) {
      try {
        window.localStorage.setItem(
          AtharDecisionRecord.STORAGE_KEY, AtharDecisionRecord.serialize(byWork)
        );
        return true;
      } catch (err) {
        return false;
      }
    },
    clear: function () {
      try {
        window.localStorage.removeItem(AtharDecisionRecord.STORAGE_KEY);
      } catch (err) { /* وضع خاص أو تخزين ممتلئ — الصفحة تبقى تعمل */ }
    },
  };

  var decisions = LEDGER.read();
  var restored = AtharDecisionRecord.restore(portfolio.features, decisions);

  var store = AtharDeskStore.createStore(restored);
  var activeTab = 'summary';
  var blockers = [];
  var analysisCache = {};
  var serverLedger = false;

  /** إرسال القرار إلى الخادم إن وُجد. الفشل صامت — التخزين المحلي هو المؤكّد. */
  function pushToServer(workId, record) {
    if (typeof fetch !== 'function') return;
    fetch('/api/works/' + encodeURIComponent(workId) + '/decisions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    }).then(function (response) {
      serverLedger = response.ok;
      renderLedger();
    }).catch(function () { /* وضع الملف المحلي — لا خادم */ });
  }

  /**
   * الشريط يحمل حصيلة المراجع لا عدّاد تخزين.
   * ---------------------------------------------------------------------------
   * «12 قراراً محفوظاً» يصف الآلة؛ «قرّرت 12 · فرق متاح 4.2 مليون ساعة-مركبة»
   * يصف عمل المراجع. الأول تفصيلة تنفيذ والثاني سبب فتح الأداة غداً. ومكان
   * الحفظ يبقى مذكوراً — لكن حيث يليق، في التلميحة لا في العنوان.
   */
  function renderLedger() {
    if (!ledgerEl) return;

    var counts = AtharDecisionRecord.counts(decisions);
    if (!counts.decisions) {
      ledgerEl.innerHTML = '';
      ledgerEl.hidden = true;
      return;
    }

    ledgerEl.hidden = false;
    ledgerEl.innerHTML = AtharDeskSession.renderBadge(AtharDeskSession.summarize(decisions));
    ledgerEl.setAttribute('title', counts.decisions + ' قراراً على ' + counts.works + ' عملاً · '
      + (serverLedger ? 'متزامن مع الخادم' : 'محفوظ محلياً'));
  }

  /* ---------- لوحة الحصيلة ---------- */

  var sessionEl = document.getElementById('deskSession');
  var sessionReturnFocus = null;

  function toggleSession(open) {
    if (!sessionEl) return;
    var show = open === undefined ? sessionEl.hidden : open;

    if (show) {
      sessionReturnFocus = document.activeElement;
      sessionEl.innerHTML = AtharDeskSession.render(
        AtharDeskSession.summarize(decisions), AtharEngine, store.counts().needsDecision
      );
      sessionEl.hidden = false;
      var close = document.getElementById('deskSessionClose');
      if (close) {
        close.addEventListener('click', function () { toggleSession(false); });
        close.focus();
      }
      return;
    }

    sessionEl.hidden = true;
    sessionEl.innerHTML = '';
    if (sessionReturnFocus && sessionReturnFocus.focus) sessionReturnFocus.focus();
    sessionReturnFocus = null;
  }

  /* ---------- التحليل: يُحسب من العمل المحدد لحظة تحديده ---------- */

  function inputsFor(p) {
    var start = Date.parse(p.start);
    var end = Date.parse(p.end);
    var windowHours = Number(p.windowHours) > 0 ? Number(p.windowHours) : 8;
    return {
      aadt: Number(p.aadt) > 0 ? Number(p.aadt) : AtharEngine.DEFAULTS.aadt,
      lanes: Number(p.lanes) || AtharEngine.DEFAULTS.lanes,
      lanesClosed: Number(p.lanesClosed) || 1,
      startHour: isNaN(start) ? 8 : new Date(start).getUTCHours(),
      durationHours: windowHours,
      capacityPerLane: AtharEngine.DEFAULTS.capacityPerLane,
      freeFlowMin: AtharEngine.DEFAULTS.freeFlowMin,
      workDays: Number(p.workDays) > 0 ? Number(p.workDays)
        : Math.max(1, Math.ceil((end - start) / 86400000)),
    };
  }

  function delayPercent(scored) {
    var base = 0;
    var closed = 0;
    (scored.hourly || []).forEach(function (hour) {
      base += hour.demand * hour.baseT;
      closed += hour.demand * hour.closedT;
    });
    return base > 0 ? ((closed - base) / base) * 100 : 0;
  }

  /** أعمال أخرى على الشارع نفسه بنافذة زمنية متقاطعة. */
  function overlapping(feature) {
    var p = feature.properties;
    var from = Date.parse(p.start);
    var to = Date.parse(p.end);

    return store.getState().features.filter(function (other) {
      var q = other.properties;
      if (q.id === p.id || q.street !== p.street) return false;
      return Date.parse(q.start) < to && Date.parse(q.end) > from;
    }).map(function (other) {
      var q = other.properties;
      var overlapMs = Math.min(to, Date.parse(q.end)) - Math.max(from, Date.parse(q.start));
      return { withRef: q.permitRef, withId: q.id, overlapHours: Math.round(overlapMs / 3600000) };
    });
  }

  function analyze(feature) {
    var id = feature.properties.id;
    if (analysisCache[id]) return analysisCache[id];

    var input = inputsFor(feature.properties);
    var scored = AtharEngine.score(input);

    // optimize يعيد {top3, baseline}؛ وكل بديل يحمل أسبابه العربية بنفسه.
    var optimized = AtharEngine.optimize(input) || {};
    var alternatives = (optimized.top3 || []).slice(0, 3);
    var best = alternatives[0];

    var asked = scored.delayVehHours * input.workDays;
    var bestTotal = best ? best.delayVehHours * input.workDays : null;

    // الأثر بوحدات القرار: ساعات الناس والريال والكربون بنطاقاتها المعلنة.
    var ph = AtharEngine.personHours(asked);
    var vot = AtharEngine.timeValueSAR(ph);
    var carbon = AtharEngine.co2Range(asked);

    var result = {
      scored: { delayVehHours: asked, delayPct: delayPercent(scored), level: scored.level },
      alternatives: alternatives,
      reasons: (best && best.reasons) || [],
      conflicts: overlapping(feature),
      delta: bestTotal !== null && asked > 0 ? ((bestTotal - asked) / asked) * 100 : null,
      units: {
        personHoursLow: ph.lowPersonHours,
        personHoursHigh: ph.highPersonHours,
        occLow: ph.occLow,
        occHigh: ph.occHigh,
        sarLow: vot.lowSAR,
        sarHigh: vot.highSAR,
        wageHourlySAR: vot.wageHourlySAR,
        shareLow: vot.shareLow,
        shareHigh: vot.shareHigh,
        co2Low: carbon.lowCo2Kg,
        co2High: carbon.highCo2Kg,
      },
      input: input,
    };

    analysisCache[id] = result;
    return result;
  }

  /* ---------- التصيير ---------- */

  function renderInbox() {
    var state = store.getState();
    var filters = { query: state.filters.query, status: state.filters.status, sort: state.sort };
    toolbarEl.innerHTML = AtharDeskInbox.renderToolbar(store.counts(), filters);
    listEl.innerHTML = AtharDeskInbox.renderList(store.getVisible(), state.selectedId);
    bindToolbar();
  }

  function tabBody(feature, analysis) {
    var p = feature.properties;

    if (activeTab === 'history') {
      // السجل يُقرأ من المخزن لا من ذاكرة الجلسة: ما يظهر هو ما سيبقى بعد التحديث.
      return AtharDeskFile.renderAudit((decisions[p.id] || []).map(function (record) {
        return {
          action: record.action, from: null, to: record.status, actor: record.actor,
          reason: record.reason, at: record.at, version: record.version,
        };
      }));
    }

    if (activeTab === 'conflict') {
      if (!analysis.conflicts.length) {
        return '<p class="desk-none">لا تعارض على «' + p.street + '» في النافذة نفسها.</p>';
      }
      return '<ul class="desk-conflicts">' + analysis.conflicts.map(function (conflict) {
        return '<li>تعارض مع ' + conflict.withRef + ' — تداخل ' + conflict.overlapHours + ' ساعة</li>';
      }).join('') + '</ul>';
    }

    if (activeTab === 'impact') {
      return AtharDeskFile.renderSummary(feature, analysis)
        + AtharDeskFile.renderConfidence(feature);
    }

    if (activeTab === 'plan') {
      return '<p class="desk-none">مسودة خطة إدارة المرور تُبنى من البديل الفائز: '
        + (analysis.alternatives[0] ? analysis.alternatives[0].label : '—')
        + '. التصدير متاح في النموذج التفاعلي (WZDx و PDF).</p>';
    }

    if (activeTab === 'publication') {
      var check = AtharDeskStates.guard(p, 'publish');
      return check.allowed
        ? '<p class="desk-none">جاهز للنشر: الاتجاه وزمن الانتهاء مثبتان.</p>'
        : AtharDeskFile.renderBlockers(check.blockers);
    }

    if (activeTab === 'measurement') {
      return '<p class="desk-none">لا قياس ميداني مستورد على هذا المحور. '
        + 'حلقة المعايرة تعمل في مختبر الابتكار على بيانات تاريخية.</p>';
    }

    return AtharDeskFile.renderSummary(feature, analysis)
      + AtharDeskFile.renderConfidence(feature);
  }

  function renderFile() {
    var feature = store.getSelected();

    if (!feature) {
      fileEl.className = 'desk-file-empty';
      fileEl.innerHTML = AtharDeskFile.renderEmpty();
      return;
    }

    var analysis = analyze(feature);
    fileEl.className = 'desk-pane-inner';
    fileEl.innerHTML = AtharDeskFile.renderHeader(feature)
      + AtharDeskFile.renderTabs(activeTab)
      + '<div class="desk-file-body">'
      + AtharDeskFile.renderBlockers(blockers)
      + tabBody(feature, analysis)
      + '</div>'
      + '<div class="desk-foot">' + AtharDeskFile.renderActions(feature) + '</div>';
    bindFile();
  }

  function render() {
    renderInbox();
    renderFile();
  }

  /* ---------- الربط ---------- */

  function bindToolbar() {
    var search = document.getElementById('desk-search');
    if (search) {
      search.addEventListener('input', function () {
        store.setFilter('query', search.value);
      });
    }
    var status = document.getElementById('desk-status');
    if (status) {
      status.addEventListener('change', function () {
        if (status.value) store.setFilter('status', status.value);
        else store.clearFilter('status');
      });
    }
    var sort = document.getElementById('desk-sort');
    if (sort) sort.addEventListener('change', function () { store.setSort(sort.value); });
  }

  function bindFile() {
    Array.prototype.forEach.call(fileEl.querySelectorAll('.desk-tab'), function (tab) {
      tab.addEventListener('click', function () {
        activeTab = tab.getAttribute('data-tab');
        renderFile();
      });
    });

    Array.prototype.forEach.call(fileEl.querySelectorAll('.desk-action'), function (button) {
      button.addEventListener('click', function () {
        runAction(button.getAttribute('data-action'));
      });
    });
  }

  /** الإجراء يمر من الحارس دائماً: العائق يُعرض ولا يُنفَّذ شيء. */
  function runAction(action) {
    var feature = store.getSelected();
    if (!feature) return;

    var check = AtharDeskStates.guard(feature.properties, action);
    if (!check.allowed) {
      blockers = check.blockers;
      renderFile();
      return;
    }

    blockers = [];
    var id = feature.properties.id;
    var analysis = analyze(feature);

    var applied = AtharDeskStates.apply(
      feature.properties, action, ACTOR,
      AtharDeskStates.ACTION_LABELS[action] + ' من مكتب المراجع',
      new Date().toISOString()
    );

    // السجل يُبنى قبل التصيير: القرار ونسخة مدخلاته يُحفظان معاً أو لا يُحفظان.
    var record = AtharDecisionRecord.create(
      feature.properties, analysis, applied.event, analysis.input
    );
    decisions[id] = AtharDecisionRecord.append(decisions[id], record);
    LEDGER.write(decisions);
    pushToServer(id, record);

    // التبويب يتغيّر قبل الاستبدال: الاستبدال يبث فوراً ويعيد التصيير، فضبطه
    // بعده يصل متأخراً بإطار كامل ويترك المراجع على تبويب لا يرى فيه أثر فعله.
    activeTab = 'history';
    delete analysisCache[id];
    store.replace({ type: 'Feature', geometry: feature.geometry, properties: applied.work });
    renderLedger();

    // التأكيد ثم التقدّم — بهذا الترتيب.
    // -------------------------------------------------------------------------
    // القفز الآلي إلى العمل التالي يخفي الدليل على أن القرار وقع، فيتركه
    // المراجع شاكّاً هل ضغط أم لا. والبقاء بلا مخرج يقطع الإيقاع. فالشريط
    // يثبت الوقوع، ويعرض التالي بضغطة واحدة.
    flash({
      tone: 'success',
      mark: '✓',
      text: AtharDeskStates.ACTION_LABELS[action],
      ref: applied.work.permitRef,
      tail: 'نسخة ' + applied.work.version,
      next: true,
    });
  }

  /**
   * شريط واحد لكل ردّ فعل على مفتاح — وقوعاً كان أو رفضاً.
   * ---------------------------------------------------------------------------
   * الرفض المسموع وحده يترك المراجع المبصر أمام لوحة تبدو ميتة، والوقوع غير
   * المرئي يتركه شاكّاً هل ضغط. فمخرج واحد يُرى ويُسمع معاً، وتُميّزه النبرة
   * والرمز والنص — لا اللون وحده.
   */
  function flash(options) {
    var bar = document.getElementById('deskConfirm');
    if (!bar) return;

    var opts = options || {};
    announce([opts.text, opts.ref, opts.tail].filter(Boolean).join(' · '));

    bar.setAttribute('data-tone', opts.tone || 'success');
    bar.innerHTML = '<span class="desk-confirm-mark" aria-hidden="true">'
      + (opts.mark || '✓') + '</span>'
      + '<span class="desk-confirm-text">' + AtharDeskFile.escapeHtml(opts.text)
      // المرجع لاتيني داخل جملة عربية: بلا bdi يقصّه محرّك الاتجاه الثنائي عند
      // أول شرطة فيلتفّ «BLD-» سطراً و«2026-0129» سطراً — رقم واحد يُقرأ رقمين.
      + (opts.ref
        ? ' · <bdi class="desk-confirm-ref">' + AtharDeskFile.escapeHtml(opts.ref) + '</bdi>'
        : '')
      + (opts.tail ? ' · ' + AtharDeskFile.escapeHtml(opts.tail) : '')
      + '</span>'
      + (opts.next
        ? '<button type="button" class="desk-confirm-next" id="deskConfirmNext">'
          + 'التالي الذي ينتظر قراراً <kbd>N</kbd></button>'
        : '');
    bar.hidden = false;

    var next = document.getElementById('deskConfirmNext');
    if (next) {
      next.addEventListener('click', function () {
        if (stepPending()) hideConfirmation();
      });
    }
  }

  function hideConfirmation() {
    var bar = document.getElementById('deskConfirm');
    if (!bar) return;
    bar.hidden = true;
    bar.innerHTML = '';
  }

  /**
   * الطيران يتبع نيّة المراجع لا كل تغيّر في المخزن.
   * ---------------------------------------------------------------------------
   * التحديد الأول آليّ — المكتب يفتح على أخطر عمل ينتظر قراراً — والطيران إليه
   * يخطف المدينة من عين المراجع قبل أن يراها، فيفتح المكتب بمقياس خمسمئة متر
   * على حي لا يعرف موقعه منه. لذلك: التحديد الآلي يُبرز ولا يطير، والنقر يطير.
   * والفرز والترشيح لا يحرّكان الخريطة أصلاً — التحديد لم يتغيّر فلا سبب.
   */
  var userDriven = false;
  var lastHighlighted = null;

  function selectRow(id) {
    userDriven = true;
    store.select(id);
  }

  /* ---------- الفرز بلوحة المفاتيح ---------- */

  /**
   * المفاتيح تعمل على القائمة المرئية لا على المحفظة كلها: المراجع الذي رشّح
   * «ينتظر قراراً» يتنقّل داخل ما رشّحه — وإلا فالترشيح زينة.
   */
  function visibleIds() {
    return store.getVisible().map(function (feature) { return feature.properties.id; });
  }

  function step(delta) {
    var ids = visibleIds();
    if (!ids.length) return;
    var at = ids.indexOf(store.getState().selectedId);
    // بلا تحديد: J يبدأ من الأول، K من الأخير — لا قفزة عمياء إلى الوسط.
    var next = at === -1 ? (delta > 0 ? 0 : ids.length - 1) : at + delta;
    if (next < 0 || next >= ids.length) return;
    selectRow(ids[next]);
  }

  /**
   * التالي الذي ينتظر قراراً فعلاً — يتخطّى ما فُرغ منه، ويلتفّ.
   * ---------------------------------------------------------------------------
   * الالتفاف ليس ترفاً. الفرز يضع المنتظِر أولاً، فالعمل الذي يُعتمد يهبط إلى
   * قاع القائمة فوراً؛ والبحث عمّا بعده من القاع لا يجد شيئاً. بلا التفاف يعلق
   * المراجع بعد أول اعتماد ويظنّ الطابور فرغ وفيه مئة عمل ينتظر.
   */
  function stepPending() {
    var found = store.nextPending(store.getState().selectedId);

    if (!found) {
      flash({ tone: 'refused', mark: '✓',
        text: 'لا عمل آخر ينتظر قراراً في القائمة المعروضة.' });
      return false;
    }

    selectRow(found.feature.properties.id);
    // الالتفاف يُعلن: قفزة إلى الأعلى بلا خبر تُقرأ كفقد للمكان.
    if (found.wrapped) announce('عاد الفرز إلى أعلى القائمة.');
    return true;
  }

  /* ---------- الإعلان: ما يُرى يُسمع كذلك ---------- */

  var liveEl = document.getElementById('deskLive');

  function announce(message) {
    if (liveEl) liveEl.textContent = message;
  }

  /** اسم الحالة عربياً. LABELS تحمل كائناً — الوصول المباشر يطبع [object Object]. */
  function statusLabel(status) {
    var entry = AtharDeskStates.LABELS[status];
    return (entry && entry.label) || status;
  }

  /**
   * الرفض يقول البديل لا الرفض وحده.
   * «غير متاح» تترك المراجع يجرّب مفاتيح حتى يصيب؛ ذكر ما هو متاح على هذه
   * الحالة يحوّل الرفض إلى إرشاد.
   */
  function refusalMessage(action, status, allowed) {
    var wanted = AtharDeskStates.ACTION_LABELS[action] || action;
    var options = (allowed || []).map(function (name) {
      return '«' + (AtharDeskStates.ACTION_LABELS[name] || name) + '»';
    });

    return '«' + wanted + '» غير متاح على حالة «' + statusLabel(status) + '». '
      + (options.length ? 'المتاح: ' + options.join('، ') + '.' : 'لا إجراء متاح على هذه الحالة.');
  }

  /* ---------- لوحة المساعدة ---------- */

  var helpEl = document.getElementById('deskHelp');
  var helpReturnFocus = null;

  function toggleHelp(open) {
    if (!helpEl) return;
    var show = open === undefined ? helpEl.hidden : open;

    if (show) {
      helpReturnFocus = document.activeElement;
      helpEl.innerHTML = AtharDeskKeys.renderHelp();
      helpEl.hidden = false;
      var close = document.getElementById('deskHelpClose');
      if (close) {
        close.addEventListener('click', function () { toggleHelp(false); });
        close.focus();
      }
      return;
    }

    helpEl.hidden = true;
    helpEl.innerHTML = '';
    // البؤرة تعود من حيث جاءت: لوحة تُغلق وتترك البؤرة على الجسد تُفقد المكان.
    if (helpReturnFocus && helpReturnFocus.focus) helpReturnFocus.focus();
    helpReturnFocus = null;
  }

  /**
   * مفتاح واحد على الوثيقة كلها.
   * ---------------------------------------------------------------------------
   * جدول المفاتيح في وحدته النقية؛ هنا الأثر وحده. الترتيب مقصود: المساعدة
   * تُغلق قبل أيّ شيء آخر، فمراجعٌ فتحها لا يجد مفتاحه ينفّذ خلفها.
   */
  document.addEventListener('keydown', function (event) {
    var resolved = AtharDeskKeys.resolve(event);
    if (!resolved) return;

    // لوحة مفتوحة تبتلع كل مفتاح إلا مفتاحها والهروب: مراجع فتح لوحة لا يجد
    // ضغطته تنفّذ خلفها على عمل لا يراه.
    var openPanel = (helpEl && !helpEl.hidden) ? { el: helpEl, intent: 'help', close: toggleHelp }
      : (sessionEl && !sessionEl.hidden)
        ? { el: sessionEl, intent: 'session', close: toggleSession } : null;

    if (openPanel && resolved.intent !== openPanel.intent) {
      if (resolved.intent !== 'escape') return;
      event.preventDefault();
      openPanel.close(false);
      return;
    }

    if (resolved.intent === 'help') { event.preventDefault(); toggleHelp(); return; }
    if (resolved.intent === 'session') { event.preventDefault(); toggleSession(); return; }

    if (resolved.intent === 'search') {
      event.preventDefault();
      var search = document.getElementById('desk-search');
      if (search) { search.focus(); search.select(); }
      return;
    }

    if (resolved.intent === 'escape') {
      var field = document.getElementById('desk-search');
      if (field && document.activeElement === field) {
        field.value = '';
        store.setFilter('query', '');
        field.blur();
      }
      return;
    }

    if (resolved.intent === 'next') { event.preventDefault(); step(1); return; }
    if (resolved.intent === 'prev') { event.preventDefault(); step(-1); return; }
    if (resolved.intent === 'nextPending') { event.preventDefault(); stepPending(); return; }

    if (resolved.intent === 'open') {
      event.preventDefault();
      var firstTab = fileEl.querySelector('.desk-tab');
      if (firstTab) firstTab.focus();
      return;
    }

    if (resolved.intent === 'tab') {
      var tab = AtharDeskFile.TABS[resolved.arg];
      if (!tab || !store.getSelected()) return;
      event.preventDefault();
      activeTab = tab.id;
      renderFile();
      announce('التبويب: ' + tab.label);
      return;
    }

    /**
     * D — نفّذ المتاح.
     * -------------------------------------------------------------------------
     * كثير من الحالات لا تقبل إلا إجراءً واحداً (يحتاج تنسيقاً ← أعد الفرز)،
     * وربطها كلها بمفاتيح مسمّاة يملأ اللوحة بحروف تُنسى. مفتاح واحد ينفّذ
     * المتاح حين يكون وحيداً، ويعرض الخيارات حين تتعدّد — ولا يخمّن أبداً بين
     * اعتماد وإرجاع.
     */
    if (resolved.intent === 'decide') {
      var work = store.getSelected();
      if (!work) return;
      event.preventDefault();

      var options = AtharDeskStates.actionsFor(work.properties.status);

      // إجراء وحيد، أو إجراء أول يوجّه ولا يحكم: يُنفَّذ. غير ذلك: يقف ويسأل.
      // فالمراجع يمرّ بـ N و D على خطوات التوجيه كلها، ويتوقف حيث يلزم حكمه.
      if (options.length === 1 || (options.length && AtharDeskStates.isRouting(options[0]))) {
        runAction(options[0]);
        return;
      }

      flash({
        tone: 'refused',
        mark: '◆',
        text: options.length
          ? 'هذا القرار يحتاج حكمك — اختر: ' + options.map(function (name) {
            var shortcut = AtharDeskFile.ACTION_KEYS[name];
            return '«' + (AtharDeskStates.ACTION_LABELS[name] || name) + '»'
              + (shortcut ? ' (' + shortcut + ')' : '');
          }).join('، ')
          : 'حالة نهائية — لا إجراء متاح على «' + statusLabel(work.properties.status) + '».',
      });
      return;
    }

    if (resolved.intent === 'action') {
      var selected = store.getSelected();
      if (!selected) return;
      event.preventDefault();

      // مفتاح لإجراء لا يسمح به الحارس يقول سببه، ولا يمر صامتاً كأن اللوحة
      // معطّلة. الحارس نفسه هو الذي يجيب — لا نسخة ثانية من قواعده هنا.
      var allowed = AtharDeskStates.actionsFor(selected.properties.status);
      if (allowed.indexOf(resolved.arg) === -1) {
        flash({
          tone: 'refused',
          mark: '⊘',
          text: refusalMessage(resolved.arg, selected.properties.status, allowed),
        });
        return;
      }
      runAction(resolved.arg);
    }
  });

  listEl.addEventListener('click', function (event) {
    var row = event.target.closest('[data-work-id]');
    if (row) selectRow(row.getAttribute('data-work-id'));
  });

  listEl.addEventListener('keydown', function (event) {
    var row = event.target.closest('[data-work-id]');
    if (!row) return;

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectRow(row.getAttribute('data-work-id'));
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      var rows = Array.prototype.slice.call(listEl.querySelectorAll('[data-work-id]'));
      var next = rows[rows.indexOf(row) + (event.key === 'ArrowDown' ? 1 : -1)];
      if (next) next.focus();
    }
  });

  /* ---------- الخريطة ---------- */

  var GL = null;

  if (typeof maplibregl !== 'undefined' && typeof AtharWorksMap !== 'undefined') {
    bootStage('جارٍ رسم شبكة الطرق…');
    GL = AtharWorksMap.init(document.getElementById('map'), window.RIYADH_ROADS, {
      baseGeoJSON: window.RIYADH_BASE,
      center: [46.6872, 24.6902],
      zoom: 11.7,
    });

    GL.map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');
    GL.map.addControl(new maplibregl.ScaleControl({ maxWidth: 110, unit: 'metric' }), 'bottom-left');

    GL.api.onReady(function () {
      GL.api.setWorks(portfolio);
      GL.api.onWorkClick(function (id) { selectRow(id); });

      // المنظر الافتتاحي هو المحفظة كلها: التوزيع يُقرأ قبل أيّ حالة مفردة.
      GL.api.frameWorks();

      // أول تحديد: أخطر عمل ينتظر قراراً — الصندوق يفتح على عمل لا على فراغ.
      var first = store.getVisible()[0];
      if (first) store.select(first.properties.id);
      bootDone();

      // الحلقة الثانية بعد أن يصير المكتب صالحاً للعمل، لا قبله.
      if (typeof AtharRoadsLazy !== 'undefined') AtharRoadsLazy.attach(GL.api);
    });

    GL.map.on('error', function (event) {
      if (event && event.error) console.error('[map]', event.error.message);
      bootDone();
    });
  } else {
    bootDone();
  }

  store.subscribe(function () {
    blockers = store.getSelected() && blockers.length ? blockers : blockers;
    render();

    var selectedId = store.getState().selectedId;
    if (selectedId !== lastHighlighted) {
      // تأكيد قرارٍ سابق لا معنى له فوق عمل آخر.
      hideConfirmation();
      if (GL && GL.api.highlightWork) GL.api.highlightWork(selectedId, { fly: userDriven });
      lastHighlighted = selectedId;
    }
    userDriven = false;
    var selected = listEl.querySelector('[aria-selected="true"]');
    if (selected && selected.scrollIntoView) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  });

  // مسح صريح: العرض التوضيحي يحتاج عودة إلى نقطة الصفر بلا فتح أدوات المطوّر.
  var keyhint = document.getElementById('deskKeyhint');
  if (keyhint) keyhint.addEventListener('click', function () { toggleHelp(true); });

  if (ledgerEl) ledgerEl.addEventListener('click', function () { toggleSession(true); });

  var resetButton = document.getElementById('deskReset');
  if (resetButton) {
    resetButton.addEventListener('click', function () {
      LEDGER.clear();
      window.location.reload();
    });
  }

  render();
  renderLedger();

  window.__atharDesk = {
    store: store, map: GL, states: AtharDeskStates,
    decisions: function () { return decisions; },
    ledger: LEDGER,
  };
})();
