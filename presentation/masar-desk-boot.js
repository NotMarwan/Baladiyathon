/**
 * مسار — مُقلع مكتب المراجع.
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
  var portfolio = window.MASAR_CITY_PORTFOLIO || { type: 'FeatureCollection', features: [] };

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
        return MasarDecisionRecord.deserialize(
          window.localStorage.getItem(MasarDecisionRecord.STORAGE_KEY)
        );
      } catch (err) {
        return {};
      }
    },
    write: function (byWork) {
      try {
        window.localStorage.setItem(
          MasarDecisionRecord.STORAGE_KEY, MasarDecisionRecord.serialize(byWork)
        );
        return true;
      } catch (err) {
        return false;
      }
    },
    clear: function () {
      try {
        window.localStorage.removeItem(MasarDecisionRecord.STORAGE_KEY);
      } catch (err) { /* وضع خاص أو تخزين ممتلئ — الصفحة تبقى تعمل */ }
    },
  };

  var decisions = LEDGER.read();
  var restored = MasarDecisionRecord.restore(portfolio.features, decisions);

  /**
   * سجل المعايرة: التوقّع مقابل الرصد، عبر الجلسات.
   * ---------------------------------------------------------------------------
   * يعيش في التخزين المحلي كسجل القرار، ويُحقن مخزنه ولا يفترضه — فالوحدة
   * نفسها تُختبر في Node بمخزن في الذاكرة. المتصفح الذي يمنع التخزين يحصل على
   * مخزن مؤقّت: الصفحة تعمل والسجل لا يعبر التحديث، وهو أهون من صفحة تسقط.
   */
  var OBSERVATION_KEY = 'masar.observations.v1';

  var calibrationStore = (function () {
    try {
      window.localStorage.setItem('masar.probe', '1');
      window.localStorage.removeItem('masar.probe');
      return window.localStorage;
    } catch (err) {
      var memory = {};
      return {
        getItem: function (key) { return memory[key] === undefined ? null : memory[key]; },
        setItem: function (key, value) { memory[key] = value; },
        removeItem: function (key) { delete memory[key]; },
      };
    }
  })();

  var calibration = MasarImpactCalibration.createCalibration(calibrationStore);

  /** الرصدة المعروضة لكل عمل. السجل يحمل النسب؛ هذا يحمل ما يُعرض في التبويب. */
  var observations = (function () {
    try {
      var raw = calibrationStore.getItem(OBSERVATION_KEY);
      var parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (err) {
      return {};
    }
  })();

  function saveObservations() {
    try {
      calibrationStore.setItem(OBSERVATION_KEY, JSON.stringify(observations));
    } catch (err) { /* تخزين ممتلئ — الجلسة تكمل بلا ثبات */ }
  }

  /**
   * ما كان المراجع يراه آخر مرة.
   * ---------------------------------------------------------------------------
   * يُقرأ قبل بناء المخزن كي تُطبَّق المرشحات على أول تصيير لا بعده: تطبيقها
   * بعده يعرض القائمة كاملة لحظةً ثم يقصّها، فتقفز اللوحة أمام العين.
   */
  var savedView = MasarDeskRecall.read(calibrationStore);

  var store = MasarDeskStore.createStore(restored);
  var activeTab = (savedView && savedView.tab) || 'summary';
  var blockers = [];
  var analysisCache = {};
  var serverLedger = false;
  var serverDenial = '';

  /**
   * مفتاح الكتابة (WP-D1).
   *
   * الخادم يشترط `X-Masar-Key` على الكتابة في سجل القرارات، ويسلّم المفتاح
   * لطالبٍ من الحلقة المحلية. يُجلب مرة ويُحتفظ به في الذاكرة — لا في
   * `localStorage`: مفتاحٌ مخزَّن على القرص يعيش بعد الجلسة بلا داعٍ.
   *
   * والقيمة الفارغة تُحفظ كذلك: غياب الخادم (وضع `file://`) لا يستحق محاولة
   * جلبٍ عند كل قرار.
   */
  var serverKey = null;

  function withServerKey(next) {
    if (serverKey !== null) { next(serverKey); return; }
    fetch('/api/session-key')
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (body) {
        serverKey = (body && body.key) || '';
        next(serverKey);
      })
      .catch(function () { serverKey = ''; next(''); });
  }

  /**
   * قرارات الخادم عند الإقلاع (WP-L1).
   *
   * كان المكتب يكتب في سجل الخادم ولا يقرؤه أبداً — سجلٌّ أحاديّ الاتجاه.
   * ونتيجته أن مراجعاً يفتح المكتب على متصفح آخر أو بعد مسح التخزين المحلي
   * يرى صندوقاً فارغاً بينما الخادم يحمل تاريخ العمل كاملاً.
   *
   * الدمج **لا يُسقط المحلي**: التخزين المحلي هو المؤكّد لأنه يعمل بلا خادم.
   * ما يأتي من الخادم يُضاف لما لا يعرفه المحلي وحده — ونسخةٌ موجودة في
   * الاثنين تبقى على نسخة المحلي، فلا يُلغى قرار المراجع الحاضر بقرارٍ أقدم.
   */
  function mergeServerLedger(byWork) {
    if (typeof fetch !== 'function') return;
    fetch('/api/decisions')
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (body) {
        if (!body || !body.works) return;
        var added = 0;
        Object.keys(body.works).forEach(function (workId) {
          var local = byWork[workId] || [];
          var known = {};
          local.forEach(function (item) { known[item.version] = 1; });
          body.works[workId].forEach(function (record) {
            if (known[record.version]) return;
            local = local.concat([record]);
            added += 1;
          });
          if (local.length) {
            byWork[workId] = local.sort(function (a, b) { return a.version - b.version; });
          }
        });
        if (!added) { serverLedger = true; renderLedger(); return; }
        decisions = byWork;
        LEDGER.write(decisions);
        serverLedger = true;
        /* `store.replace` تستبدل سجلاً واحداً لا قائمة — تمريرُ مصفوفة إليها
           يمرّ صامتاً ولا يستبدل شيئاً. */
        MasarDecisionRecord.restore(portfolio.features, decisions)
          .forEach(function (feature) { store.replace(feature); });
        renderLedger();
      })
      .catch(function () { /* وضع الملف المحلي — لا خادم */ });
  }

  /** إرسال القرار إلى الخادم إن وُجد. الفشل صامت — التخزين المحلي هو المؤكّد. */
  function pushToServer(workId, record) {
    if (typeof fetch !== 'function') return;
    withServerKey(function (key) {
      fetch('/api/works/' + encodeURIComponent(workId) + '/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Masar-Key': key },
        body: JSON.stringify(record),
      }).then(function (response) {
        serverLedger = response.ok;
        /* WP-D3 — الرفض بسبب الدور ليس «فشل مزامنة».
           المكتب يحمل مفتاح الفاحص، والخادم يردّ 403 على الاعتماد. ابتلاع
           ذلك يجعل الشاشة تقول «محفوظ محلياً» وكأن الخادم غائب، بينما هو
           حاضر ورافض — والفرق هو كل معنى فصل الصلاحيات. */
        serverDenial = '';
        if (response.status === 403) {
          return response.json().then(function (body) {
            serverDenial = body && body.error === 'SEGREGATION_OF_DUTIES'
              ? body.reason
              : 'دورك الحالي (' + ((body && body.roleLabel) || 'فاحص الأثر')
                + ') لا يجيز هذا الانتقال — يلزم مفتاح الدور المخوَّل';
            renderLedger();
          });
        }
        renderLedger();
        return null;
      }).catch(function () { /* وضع الملف المحلي — لا خادم */ });
    });
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

    var counts = MasarDecisionRecord.counts(decisions);
    if (!counts.decisions) {
      ledgerEl.innerHTML = '';
      ledgerEl.hidden = true;
      return;
    }

    ledgerEl.hidden = false;
    ledgerEl.innerHTML = MasarDeskSession.renderBadge(MasarDeskSession.summarize(decisions));
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
      sessionEl.innerHTML = MasarDeskSession.render(
        MasarDeskSession.summarize(decisions), MasarEngine, store.counts().needsDecision
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

  /**
   * مرشّح الحفر مرة واحدة لهذا العمل.
   * أثر كل عضو يُؤخذ من تحليله هو لا من تقدير جديد: رقمان لأثرٍ واحد على
   * شاشتين مختلفتين يُسقطان الثقة في الاثنين.
   */
  var mergeCache = {};

  function mergeFor(feature) {
    var id = feature.properties.id;
    if (mergeCache[id] !== undefined) return mergeCache[id];

    var others = MasarDeskDigOnce.candidates(feature, store.getState().features);
    mergeCache[id] = MasarDeskDigOnce.evaluate(feature, others, function (member) {
      return analyze(member).scored.delayVehHours;
    }, MasarEngine);

    return mergeCache[id];
  }

  /**
   * الحصيلة من الوحدة النقية، والتعارض من المحفظة.
   * ---------------------------------------------------------------------------
   * الحساب كله في `masar-desk-analysis.js` كي يُختبر في Node مقابل الأرقام
   * المنشورة مع كل تصريح — وهو الحارس الذي يمنع عودة الرقمين لكمية واحدة.
   * التعارض وحده يبقى هنا: خاصيةُ محفظةٍ لا خاصيةُ تصريح، ولا تُعرف إلا من
   * بقية السجلات.
   */
  function analyze(feature) {
    var id = feature.properties.id;
    if (analysisCache[id]) return analysisCache[id];

    var result = MasarDeskAnalysis.evaluate(feature.properties, MasarEngine);
    result.conflicts = overlapping(feature);

    analysisCache[id] = result;
    return result;
  }

  /* ---------- التصيير ---------- */

  /**
   * الشريط يُبنى مرة، والقائمة تُعاد.
   * ---------------------------------------------------------------------------
   * إعادة بناء الشريط عند كل تغيّر كانت تهدم حقل البحث الذي يكتب فيه المراجع:
   * `setFilter` يبثّ، والبثّ يُعيد التصيير، والتصيير يستبدل `innerHTML`
   * فيُفقد العنصر ومعه البؤرة والمؤشّر. النتيجة أن البحث لا يقبل إلا حرفاً
   * واحداً — تُكتب «الملك» فتبقى «ا». والخانتان تفقدان البؤرة كذلك، فالتنقل
   * بلوحة المفاتيح ينقطع عند كل تغيير.
   *
   * فالشريط الآن يُبنى ويُربط مرة واحدة، ويتغيّر منه ما يتغيّر فعلاً: سطر
   * العدّادات. وقيم الحقول تُزامَن مع المخزن فقط حين يغيّرها غير المستخدم
   * (استئناف جلسة، لوحة أوامر) — ولا تُلمس أبداً وهي تحت البؤرة.
   */
  var toolbarBuilt = false;

  function renderInbox() {
    var state = store.getState();
    var filters = { query: state.filters.query, status: state.filters.status, sort: state.sort };

    if (!toolbarBuilt) {
      toolbarEl.innerHTML = MasarDeskInbox.renderToolbar(store.counts(), filters);
      bindToolbar();
      toolbarBuilt = true;
    } else {
      syncToolbar(filters);
    }

    listEl.innerHTML = MasarDeskInbox.renderList(store.getVisible(), state.selectedId);
  }

  /** يحدّث العدّادات دائماً، وقيمة أي حقل ليس تحت البؤرة. */
  function syncToolbar(filters) {
    var counts = document.getElementById('desk-counts');
    if (counts) counts.innerHTML = MasarDeskInbox.renderCounts(store.counts());

    setFieldValue('desk-search', filters.query || '');
    setFieldValue('desk-status', filters.status || '');
    setFieldValue('desk-sort', filters.sort || '');
  }

  function setFieldValue(id, value) {
    var field = document.getElementById(id);
    if (!field || field === document.activeElement) return;
    if (field.value !== value) field.value = value;
  }

  function tabBody(feature, analysis) {
    var p = feature.properties;

    if (activeTab === 'history') {
      // السجل يُقرأ من المخزن لا من ذاكرة الجلسة: ما يظهر هو ما سيبقى بعد التحديث.
      // الحالة السابقة محفوظة في السجل (`record.from`)، وإسقاطها هنا كان يطبع
      // «— ← معتمد»: نصف الحركة. والسجل الذي لا يقول من أين جاء العمل لا يشرح
      // القرار، وهو الغرض الوحيد من وجوده.
      return MasarDeskFile.renderAudit((decisions[p.id] || []).map(function (record) {
        return {
          action: record.action, from: record.from, to: record.status, actor: record.actor,
          reason: record.reason, at: record.at, version: record.version,
        };
      }));
    }

    if (activeTab === 'conflict') {
      // التعارض معروضٌ ثم متبوعٌ بما يُفعل به. القائمة وحدها تخبر المراجع
      // بما يعرفه؛ الاقتراح يخبره بما يستطيع.
      var overlaps = analysis.conflicts.length
        ? '<ul class="desk-conflicts">' + analysis.conflicts.map(function (conflict) {
          return '<li>تداخل مع <bdi class="desk-ref">' + conflict.withRef + '</bdi> — '
            + conflict.overlapHours + ' ساعة</li>';
        }).join('') + '</ul>'
        : '';

      return overlaps + MasarDeskDigOnce.render(mergeFor(feature), p.street);
    }

    if (activeTab === 'impact') {
      return MasarDeskFile.renderSummary(feature, analysis)
        + MasarDeskFile.renderConfidence(feature, calibration.status());
    }

    if (activeTab === 'plan') {
      return MasarDeskPlan.renderTab(
        MasarDeskPlan.build(feature, analysis, new Date().toISOString())
      );
    }

    if (activeTab === 'publication') {
      var check = MasarDeskStates.guard(p, 'publish');
      return check.allowed
        /* WP-A5: كانت «جاهز للنشر». العبارة تصف حالة سير عمل، لكنها تقع
           بجوار تصدير WZDx فتُقرأ إقراراً بمطابقة المخطط — وهي غير مطابقة.
           الصياغة صارت تسمّي ما ثبت بالضبط. */
        ? '<p class="desk-none">الحالة تسمح بالنشر: الاتجاه وزمن الانتهاء'
          + ' مثبتان. وبنية WZDx 4.2 مفحوصة داخلياً — المحقق الرسمي'
          + ' لم يُشغَّل بعد.</p>'
        : MasarDeskFile.renderBlockers(check.blockers);
    }

    if (activeTab === 'measurement') {
      return MasarDeskMeasurement.render(
        { status: p.status, statusLabel: statusLabel(p.status) },
        analysis.scored.delayVehHours,
        observations[p.id] || null,
        calibration.status()
      );
    }

    return MasarDeskFile.renderSummary(feature, analysis)
      + MasarDeskFile.renderConfidence(feature, calibration.status());
  }

  function renderFile() {
    var feature = store.getSelected();

    if (!feature) {
      fileEl.className = 'desk-file-empty';
      fileEl.innerHTML = MasarDeskFile.renderEmpty();
      return;
    }

    var analysis = analyze(feature);
    fileEl.className = 'desk-pane-inner';
    fileEl.innerHTML = MasarDeskFile.renderHeader(feature)
      + MasarDeskFile.renderTabs(activeTab)
      + '<div class="desk-file-body">'
      + MasarDeskFile.renderBlockers(blockers)
      + tabBody(feature, analysis)
      + '</div>'
      + '<div class="desk-foot">' + MasarDeskFile.renderActions(feature) + '</div>';
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
        setTab(tab.getAttribute('data-tab'));
      });
    });

    /**
     * الإجراء يُربط بما يحمل اسمه لا بما يشبهه شكلاً.
     * -------------------------------------------------------------------------
     * `.desk-action` صنف مظهر يستعمله التصدير والاستيراد أيضاً. الربط بالصنف
     * وحده كان يمرّر أزراراً بلا `data-action` إلى runAction فتُستدعى بـ null،
     * فيظهر «إجراء غير معروف» فوق تبويب صحيح. القائمة السوداء بالمعرّفات كانت
     * ستتقادم مع أول زرّ جديد؛ الشرط على وجود السمة لا يتقادم.
     */
    Array.prototype.forEach.call(fileEl.querySelectorAll('.desk-action[data-action]'),
      function (button) {
        button.addEventListener('click', function () {
          runAction(button.getAttribute('data-action'));
        });
      });

    var importButton = document.getElementById('deskImportObservation');
    if (importButton) importButton.addEventListener('click', importObservation);

    var planButton = document.getElementById('deskExportPlan');
    if (planButton) planButton.addEventListener('click', function () { exportPlan('document'); });

    var wzdxButton = document.getElementById('deskExportWzdx');
    if (wzdxButton) wzdxButton.addEventListener('click', function () { exportPlan('wzdx'); });
  }

  /** الإجراء يمر من الحارس دائماً: العائق يُعرض ولا يُنفَّذ شيء. */
  function runAction(action) {
    var feature = store.getSelected();
    if (!feature) return;

    var check = MasarDeskStates.guard(feature.properties, action);
    if (!check.allowed) {
      blockers = check.blockers;
      renderFile();
      return;
    }

    blockers = [];
    var id = feature.properties.id;
    var analysis = analyze(feature);

    var applied = MasarDeskStates.apply(
      feature.properties, action, ACTOR,
      MasarDeskStates.ACTION_LABELS[action] + ' من مكتب المراجع',
      new Date().toISOString()
    );

    // السجل يُبنى قبل التصيير: القرار ونسخة مدخلاته يُحفظان معاً أو لا يُحفظان.
    var record = MasarDecisionRecord.create(
      feature.properties, analysis, applied.event, analysis.input
    );
    decisions[id] = MasarDecisionRecord.append(decisions[id], record);
    LEDGER.write(decisions);
    pushToServer(id, record);

    // التبويب يتغيّر قبل الاستبدال: الاستبدال يبث فوراً ويعيد التصيير، فضبطه
    // بعده يصل متأخراً بإطار كامل ويترك المراجع على تبويب لا يرى فيه أثر فعله.
    activeTab = 'history';
    delete analysisCache[id];
    // الدمج يعتمد على مسار كل عضو، وقرارٌ على أحدهم يغيّره — فالتخزين يُبطَل كله.
    mergeCache = {};
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
      text: MasarDeskStates.ACTION_LABELS[action],
      ref: applied.work.permitRef,
      tail: 'نسخة ' + applied.work.version,
      undo: true,
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
      + '<span class="desk-confirm-text">' + MasarDeskFile.escapeHtml(opts.text)
      // المرجع لاتيني داخل جملة عربية: بلا bdi يقصّه محرّك الاتجاه الثنائي عند
      // أول شرطة فيلتفّ «BLD-» سطراً و«2026-0129» سطراً — رقم واحد يُقرأ رقمين.
      + (opts.ref
        ? ' · <bdi class="desk-confirm-ref">' + MasarDeskFile.escapeHtml(opts.ref) + '</bdi>'
        : '')
      + (opts.tail ? ' · ' + MasarDeskFile.escapeHtml(opts.tail) : '')
      + '</span>'
      // التراجع يقع حيث يُطلب: في اللحظة التي يرى فيها المراجع ما فعله.
      + (opts.undo
        ? '<button type="button" class="desk-confirm-undo" id="deskConfirmUndo">'
          + 'تراجع <kbd>U</kbd></button>'
        : '')
      + (opts.next
        ? '<button type="button" class="desk-confirm-next" id="deskConfirmNext">'
          + 'التالي <kbd>N</kbd></button>'
        : '');
    bar.hidden = false;

    var undoButton = document.getElementById('deskConfirmUndo');
    if (undoButton) undoButton.addEventListener('click', undoLast);

    var next = document.getElementById('deskConfirmNext');
    if (next) {
      next.addEventListener('click', function () {
        if (stepPending()) hideConfirmation();
      });
    }
  }

  /**
   * التراجع عن آخر قرار على العمل المحدَّد.
   * ---------------------------------------------------------------------------
   * لا يُحذف سطر. التراجع نسخةٌ معوِّضة تُقيَّد باسمها، فمن يقرأ السجل يرى
   * القرار والتراجع عنه — وهذا أصدق من سجلٍّ نظيف يُخفي أن خطأً وقع.
   */
  function undoLast() {
    var feature = store.getSelected();
    if (!feature) return;

    var id = feature.properties.id;
    var check = MasarDecisionRecord.undoSpec(decisions[id]);

    if (!check.allowed) {
      flash({ tone: 'refused', mark: '⊘', text: check.reason });
      return;
    }

    var undo = MasarDecisionRecord.createUndo(
      feature.properties, check.spec, ACTOR, new Date().toISOString()
    );

    decisions[id] = MasarDecisionRecord.append(decisions[id], undo);
    LEDGER.write(decisions);
    pushToServer(id, undo);

    activeTab = 'history';
    delete analysisCache[id];
    mergeCache = {};

    var reverted = JSON.parse(JSON.stringify(feature.properties));
    reverted.status = check.spec.toStatus;
    reverted.version = check.spec.nextVersion;
    reverted.nextAction = MasarDeskStates.nextAction(check.spec.toStatus);
    reverted.decidedAt = undo.at;
    reverted.decidedBy = ACTOR;

    store.replace({ type: 'Feature', geometry: feature.geometry, properties: reverted });
    renderLedger();

    flash({
      tone: 'success',
      mark: '↩',
      text: 'تراجع عن «' + (MasarDeskStates.ACTION_LABELS[check.spec.undoneAction]
        || check.spec.undoneAction) + '» — عاد إلى «' + statusLabel(check.spec.toStatus) + '»',
      ref: feature.properties.permitRef,
      tail: 'نسخة ' + check.spec.nextVersion + ' · السجل يحفظ الاثنين',
    });
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

  /**
   * استيراد رصدة وإدخالها في سجل المعايرة.
   * ---------------------------------------------------------------------------
   * الرصدة تركيبية ومشتقّة من معرّف التصريح، فهي ثابتة عبر التشغيلات. تُسجَّل
   * مرة واحدة لكل عمل: تكرارها يضخّم عيّنة المعايرة برصدة واحدة معادة، فيبدو
   * المعامل أوثق مما هو.
   */
  /**
   * تنزيل مخرَج من المكتب.
   * ---------------------------------------------------------------------------
   * Blob محلي و ObjectURL يُلغى بعد الاستعمال: بلا إلغائه يبقى الملف في ذاكرة
   * الصفحة إلى أن تُغلق، ومراجعٌ ينزّل خمسين خطة يحمل خمسين نسخة بلا سبب.
   */
  function download(name, content, mime) {
    var blob = new Blob([content], { type: mime });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }

  /**
   * خطة إدارة المرور أو WZDx، كلاهما من النافذة الموصى بها.
   * التصدير من المطلوب بدل الموصى به كان سيُخرج وثيقة تناقض التوصية المعروضة
   * فوقها على الشاشة نفسها.
   */
  function exportPlan(kind) {
    var feature = store.getSelected();
    if (!feature) return;

    var plan = MasarDeskPlan.build(feature, analyze(feature), new Date().toISOString());
    if (!plan.recommendation) {
      flash({ tone: 'refused', mark: '⊘',
        text: 'لا نافذة موصى بها على هذا العمل — الخطة تُبنى منها.' });
      return;
    }

    if (kind === 'wzdx') {
      /* كان هنا سطرٌ يلفّ إحداثية النقطة في مصفوفة فيُنتج «خطاً» من نقطة
         واحدة، ويمرّر الاتجاه العربي خاماً. الأول يخترع هندسة والثاني يكسر
         تعداداً مغلقاً — وهما سبب فشل تصدير المحفظة كاملة أمام المخطط الرسمي.
         المُصدِّر الآن يحوّل ما يمكن تحويله ويرفض ما لا يمكن، بسببٍ يُعرَض. */
      var resolutions = (window.MASAR_POINT_GEOMETRY
        && window.MASAR_POINT_GEOMETRY.resolutions) || {};
      var built = MasarWzdxExport.buildFeed(feature, {
        dataSourceId: 'masar-reviewer-desk',
        windows: plan.windows,
        resolution: resolutions[plan.permitRef],
      });

      if (!built.ok) {
        flash({ tone: 'refused', mark: '⊘',
          text: built.outcome + ' — ' + built.blockers.join(' · '),
          ref: plan.permitRef });
        return;
      }

      download(MasarDeskPlan.fileName(plan, 'geojson'),
        JSON.stringify(built.feed, null, 2), 'application/geo+json');
      flash({ tone: 'success', mark: '⬇', text: 'نُزّل WZDx', ref: plan.permitRef,
        /* لا يُقال «اجتاز المخطط الرسمي» هنا: المتصفح لا يشغّل AJV، وكل ما
           تعرفه هذه الشاشة أن حرّاس المُصدِّر مرّت. الاجتياز الرسمي يثبته
           `tests/wzdx-official-schema-test.js` وتقرير المطابقة، ويُقرأ منهما. */
        tail: built.feed.features.length + ' نافذة · بنية WZDx 4.2' });
      return;
    }

    download(MasarDeskPlan.fileName(plan, 'html'),
      MasarDeskPlan.toDocument(plan), 'text/html;charset=utf-8');
    flash({ tone: 'success', mark: '⬇', text: 'نُزّلت خطة إدارة المرور',
      ref: plan.permitRef, tail: 'تُفتح وتُطبع بلا برنامج' });
  }

  function importObservation() {
    var feature = store.getSelected();
    if (!feature) return;

    var id = feature.properties.id;
    if (observations[id]) return;

    var predicted = analyze(feature).scored.delayVehHours;
    var observed = MasarDeskMeasurement.syntheticObservation(feature.properties.permitRef, predicted);
    if (!observed) {
      flash({ tone: 'refused', mark: '⊘', text: 'لا توقّع صالح على هذا العمل — لا شيء يُقارَن به.' });
      return;
    }

    calibration.record({
      permitId: id,
      predictedVehHours: predicted,
      observedVehHours: observed.observedVehHours,
    });

    observations[id] = observed;
    saveObservations();
    renderFile();

    var gap = MasarDeskMeasurement.deviation(predicted, observed.observedVehHours);
    flash({
      tone: 'success', mark: '◈',
      text: 'رصد تركيبي مستورد · انحراف ' + (gap.pct > 0 ? '+' : '')
        + gap.pct.toFixed(1) + '٪',
      ref: feature.properties.permitRef,
      tail: calibration.status().n + ' رصدة في السجل',
    });
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
    var entry = MasarDeskStates.LABELS[status];
    return (entry && entry.label) || status;
  }

  /**
   * الرفض يقول البديل لا الرفض وحده.
   * «غير متاح» تترك المراجع يجرّب مفاتيح حتى يصيب؛ ذكر ما هو متاح على هذه
   * الحالة يحوّل الرفض إلى إرشاد.
   */
  function refusalMessage(action, status, allowed) {
    var wanted = MasarDeskStates.ACTION_LABELS[action] || action;
    var options = (allowed || []).map(function (name) {
      return '«' + (MasarDeskStates.ACTION_LABELS[name] || name) + '»';
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
      helpEl.innerHTML = MasarDeskKeys.renderHelp();
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
    var resolved = MasarDeskKeys.resolve(event);
    if (!resolved) return;

    // لوحة مفتوحة تبتلع كل مفتاح إلا مفتاحها والهروب: مراجع فتح لوحة لا يجد
    // ضغطته تنفّذ خلفها على عمل لا يراه.
    var openPanel = (helpEl && !helpEl.hidden) ? { el: helpEl, intent: 'help', close: toggleHelp }
      : (sessionEl && !sessionEl.hidden)
        ? { el: sessionEl, intent: 'session', close: toggleSession }
        : (paletteEl && !paletteEl.hidden)
          ? { el: paletteEl, intent: 'palette', close: togglePalette } : null;

    if (openPanel && resolved.intent !== openPanel.intent) {
      if (resolved.intent !== 'escape') return;
      event.preventDefault();
      openPanel.close(false);
      return;
    }

    if (resolved.intent === 'help') { event.preventDefault(); toggleHelp(); return; }
    if (resolved.intent === 'session') { event.preventDefault(); toggleSession(); return; }
    if (resolved.intent === 'palette') { event.preventDefault(); togglePalette(); return; }

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
    if (resolved.intent === 'undo') { event.preventDefault(); undoLast(); return; }

    if (resolved.intent === 'open') {
      event.preventDefault();
      var firstTab = fileEl.querySelector('.desk-tab');
      if (firstTab) firstTab.focus();
      return;
    }

    if (resolved.intent === 'tab') {
      var tab = MasarDeskFile.TABS[resolved.arg];
      if (!tab || !store.getSelected()) return;
      event.preventDefault();
      setTab(tab.id);
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

      var options = MasarDeskStates.actionsFor(work.properties.status);

      // إجراء وحيد، أو إجراء أول يوجّه ولا يحكم: يُنفَّذ. غير ذلك: يقف ويسأل.
      // فالمراجع يمرّ بـ N و D على خطوات التوجيه كلها، ويتوقف حيث يلزم حكمه.
      if (options.length === 1 || (options.length && MasarDeskStates.isRouting(options[0]))) {
        runAction(options[0]);
        return;
      }

      flash({
        tone: 'refused',
        mark: '◆',
        text: options.length
          ? 'هذا القرار يحتاج حكمك — اختر: ' + options.map(function (name) {
            var shortcut = MasarDeskFile.ACTION_KEYS[name];
            return '«' + (MasarDeskStates.ACTION_LABELS[name] || name) + '»'
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
      var allowed = MasarDeskStates.actionsFor(selected.properties.status);
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

  if (typeof maplibregl !== 'undefined' && typeof MasarWorksMap !== 'undefined') {
    bootStage('جارٍ رسم شبكة الطرق…');
    GL = MasarWorksMap.init(document.getElementById('map'), window.RIYADH_ROADS, {
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

      // التحديد وقع قبل هذه اللحظة (انظر selectInitial أدناه)، فما بقي إبرازه
      // على الخريطة — بلا طيران: المنظر الافتتاحي هو المحفظة كلها.
      var selectedId = store.getState().selectedId;
      if (selectedId && GL.api.highlightWork) GL.api.highlightWork(selectedId, { fly: false });

      bootDone();

      // الحلقة الثانية بعد أن يصير المكتب صالحاً للعمل، لا قبله.
      if (typeof MasarRoadsLazy !== 'undefined') {
        MasarRoadsLazy.attach(GL.api);
      }
      /**
       * المباني حسب النطاق المعروض — نفس علاج صفحة الخريطة.
       * كانت هنا أيضاً تُنزَّل المدينة كلها (101 ميغابايت) دفعةً واحدة بعد
       * حمولةٍ قبلها، فيبقى المكتب بلا نسيجٍ عشرات الثواني.
       */
      if (typeof MasarBuildingsLazy !== 'undefined') {
        window.__masarBuildings = MasarBuildingsLazy.install(GL.map);
      }
    });

    GL.map.on('error', function (event) {
      if (event && event.error) console.error('[map]', event.error.message);
      mapUnavailable('تعذّر رسم الخريطة على هذا الجهاز.');
    });
  } else {
    mapUnavailable('محرك الخريطة غير متاح في هذا المتصفح.');
  }

  /**
   * الخريطة تسقط، والمكتب لا.
   * ---------------------------------------------------------------------------
   * غياب WebGL أو فشل الأصول يترك مستطيلاً فارغاً في وسط الشاشة بلا كلمة —
   * والمراجع لا يعرف أيَنتظر أم يُكمل. الفرز نفسه لا يحتاج الخريطة: الصندوق
   * والملف والقرار كلها تعمل بلا بلاطة واحدة. فيُقال ذلك صراحةً بدل أن يُترك
   * الفراغ يوحي بعطلٍ شامل.
   */
  function mapUnavailable(reason) {
    bootDone();
    var pane = document.getElementById('map');
    if (!pane || pane.getAttribute('data-unavailable') === 'true') return;
    pane.setAttribute('data-unavailable', 'true');
    pane.innerHTML = '<div class="desk-map-down" role="status">'
      + '<p class="desk-map-down-title">' + MasarDeskFile.escapeHtml(reason) + '</p>'
      + '<p class="desk-map-down-note">الفرز والقرار والتصدير تعمل بلا خريطة — '
      + 'ما ينقص هو الموقع على الأرض وحده.</p></div>';
  }

  store.subscribe(function () {
    // العائق يخصّ عملاً بعينه: «لا ينشر إغلاق بلا اتجاه» قيلت عن هذا التصريح
    // لا عن الذي بعده. إبقاؤه بعد تغيّر التحديد كان يعرض حجباً أحمر فوق ملف
    // عملٍ لم يُطلب عليه إجراء أصلاً — تحذيرٌ عن غير صاحبه.
    if (store.getState().selectedId !== lastHighlighted) blockers = [];
    render();

    var selectedId = store.getState().selectedId;
    if (selectedId !== lastHighlighted) {
      // تأكيد قرارٍ سابق لا معنى له فوق عمل آخر.
      hideConfirmation();
      if (GL && GL.api.highlightWork) GL.api.highlightWork(selectedId, { fly: userDriven });
      lastHighlighted = selectedId;
    }
    userDriven = false;
    saveView();
    var selected = listEl.querySelector('[aria-selected="true"]');
    if (selected && selected.scrollIntoView) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  });

  // مسح صريح: العرض التوضيحي يحتاج عودة إلى نقطة الصفر بلا فتح أدوات المطوّر.
  /* ---------- الاستئناف: عُد من حيث وقفت ---------- */

  /**
   * الحالة تُحفظ عند كل تغيّر، لا عند الإغلاق.
   * مراجعٌ يُغلق التبويب أو ينقطع التيار لا يُطلق حدث إغلاق يُعتمد عليه؛
   * والحفظ عند كل تغيّر يكلّف كتابةً صغيرة ويشتري ألّا يُفقد شيء أبداً.
   */
  function saveView() {
    var state = store.getState();
    MasarDeskRecall.write(calibrationStore, {
      query: state.filters.query,
      status: state.filters.status,
      sort: state.sort,
      selectedId: state.selectedId,
      tab: activeTab,
      decisions: MasarDecisionRecord.counts(decisions).decisions,
      pending: store.counts().needsDecision,
    }, new Date().toISOString());
  }

  /**
   * تبديل التبويب في مكان واحد.
   * التبويب ليس حالةَ مخزن فلا يبثّ عند تغيّره، وبلا حفظٍ صريح هنا يعود
   * المراجع غداً إلى تبويب فرضه آخر قرار لا إلى التبويب الذي كان يقرؤه.
   */
  function setTab(id) {
    activeTab = id;
    renderFile();
    saveView();
  }

  function hideResume() {
    var bar = document.getElementById('deskResume');
    if (!bar) return;
    bar.hidden = true;
    bar.innerHTML = '';
  }

  function showResume() {
    var bar = document.getElementById('deskResume');
    if (!bar) return;

    var state = MasarDeskRecall.resume(savedView, new Date().toISOString(), {
      decisions: MasarDecisionRecord.counts(decisions).decisions,
      pending: store.counts().needsDecision,
    });
    if (!state.show) return;

    var target = state.selectedId
      ? store.getState().features.filter(function (f) {
        return f.properties.id === state.selectedId;
      })[0]
      : null;

    bar.innerHTML = MasarDeskRecall.render(state, target && target.properties.permitRef);
    bar.hidden = false;

    var go = document.getElementById('deskResumeGo');
    if (go) {
      go.addEventListener('click', function () {
        selectRow(state.selectedId);
        hideResume();
      });
    }

    var close = document.getElementById('deskResumeClose');
    if (close) close.addEventListener('click', hideResume);
  }

  /* ---------- لوحة الأوامر ---------- */

  var paletteEl = document.getElementById('deskPalette');
  var paletteReturnFocus = null;
  var paletteResults = [];
  var paletteActive = 0;

  var PALETTE_PAGES = [
    { file: 'masar-map.html', label: 'الخريطة العامة' },
    { file: 'masar-decision.html', label: 'شاشة القرار' },
    { file: 'masar-prototype.html', label: 'النموذج التفاعلي' },
    { file: 'masar-lab.html', label: 'مختبر الابتكار' },
    { file: 'masar-city-impact.html', label: 'لوحة مسار المدينة' },
    { file: 'masar-sources.html', label: 'سجل المصادر' },
  ];

  /**
   * الفهرس يُبنى عند الفتح لا مرة واحدة: الحالات تتغيّر مع كل قرار، وفهرسٌ
   * مبنيّ عند الإقلاع يعرض إجراءات لم تعد متاحة.
   *
   * الترتيب مقصود — الإجراءات والتبويبات قبل 150 تصريحاً: نصٌّ فارغ يعرض ما
   * يُفعل لا ما يُفتح.
   */
  function paletteIndex() {
    var entries = [];
    var selected = store.getSelected();

    if (selected) {
      MasarDeskStates.actionsFor(selected.properties.status).forEach(function (action) {
        entries.push({
          kind: 'action',
          label: MasarDeskStates.ACTION_LABELS[action] || action,
          hint: 'على ' + selected.properties.permitRef,
          value: { type: 'action', action: action },
        });
      });

      MasarDeskFile.TABS.forEach(function (tab) {
        entries.push({ kind: 'tab', label: tab.label, value: { type: 'tab', id: tab.id } });
      });
    }

    PALETTE_PAGES.forEach(function (page) {
      entries.push({ kind: 'page', label: page.label, value: { type: 'page', file: page.file } });
    });

    store.getState().features.forEach(function (feature) {
      var p = feature.properties;
      entries.push({
        kind: 'work',
        label: p.street,
        hint: p.permitRef + ' · ' + statusLabel(p.status),
        value: { type: 'work', id: p.id },
      });
    });

    return entries;
  }

  function paletteRender(query) {
    paletteResults = MasarDeskPalette.search(paletteIndex(), query);
    paletteActive = 0;
    var box = document.getElementById('deskPaletteResults');
    if (box) box.innerHTML = MasarDeskPalette.renderResults(paletteResults, paletteActive);
  }

  function paletteMove(delta) {
    if (!paletteResults.length) return;
    paletteActive = (paletteActive + delta + paletteResults.length) % paletteResults.length;
    var box = document.getElementById('deskPaletteResults');
    if (box) box.innerHTML = MasarDeskPalette.renderResults(paletteResults, paletteActive);
    var option = document.getElementById('deskPaletteOption' + paletteActive);
    if (option && option.scrollIntoView) option.scrollIntoView({ block: 'nearest' });
  }

  function paletteChoose(index) {
    var entry = paletteResults[index === undefined ? paletteActive : index];
    if (!entry) return;
    var value = entry.value;
    togglePalette(false);

    if (value.type === 'work') { selectRow(value.id); return; }
    if (value.type === 'tab') { setTab(value.id); return; }
    if (value.type === 'page') { window.location.href = value.file; return; }
    if (value.type === 'action') { runAction(value.action); }
  }

  function togglePalette(open) {
    if (!paletteEl) return;
    var show = open === undefined ? paletteEl.hidden : open;

    if (!show) {
      paletteEl.hidden = true;
      paletteEl.innerHTML = '';
      paletteResults = [];
      if (paletteReturnFocus && paletteReturnFocus.focus) paletteReturnFocus.focus();
      paletteReturnFocus = null;
      return;
    }

    paletteReturnFocus = document.activeElement;
    paletteEl.innerHTML = MasarDeskPalette.renderShell();
    paletteEl.hidden = false;
    paletteRender('');

    var input = document.getElementById('deskPaletteInput');
    if (input) {
      input.addEventListener('input', function () { paletteRender(input.value); });

      // مفاتيح اللوحة تُعالَج على الحقل نفسه: جدول المفاتيح العام يصمت داخل
      // الحقول عمداً، وهو الصواب — الحرف داخل حقل حرف لا أمر.
      input.addEventListener('keydown', function (event) {
        if (event.key === 'ArrowDown') { event.preventDefault(); paletteMove(1); return; }
        if (event.key === 'ArrowUp') { event.preventDefault(); paletteMove(-1); return; }
        if (event.key === 'Enter') { event.preventDefault(); paletteChoose(); return; }
        if (event.key === 'Escape') { event.preventDefault(); togglePalette(false); }
      });
      input.focus();
    }

    var box = document.getElementById('deskPaletteResults');
    if (box) {
      box.addEventListener('click', function (event) {
        var option = event.target.closest('[data-index]');
        if (option) paletteChoose(Number(option.getAttribute('data-index')));
      });
    }
  }

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

  /**
   * استعادة ما كان معروضاً. التحديد يُطبَّق آخراً كي تكون القائمة المرشَّحة
   * قائمة فعلاً حين يُبحث فيها عن العمل المحفوظ.
   */
  if (savedView) {
    if (savedView.query) store.setFilter('query', savedView.query);
    if (savedView.status) store.setFilter('status', savedView.status);
    if (savedView.sort) store.setSort(savedView.sort);
  }

  /**
   * أول تحديد لا ينتظر أول بلاطة.
   * ---------------------------------------------------------------------------
   * كان داخل `onReady` الخريطة: فإن تأخّر رسمها أو تعذّر، فتح المكتب على ملف
   * قرار فارغ ولا يقول لماذا — وهو أول ما يراه من يفتح الأداة. والمكتب لا
   * يحتاج الخريطة ليعمل: الصندوق مرتّب بالأثر، وأخطر عمل ينتظر قراراً في
   * أعلاه. فيُحدَّد الآن، وتُبرزه الخريطة حين تجهز.
   */
  function selectInitial() {
    if (store.getState().selectedId) return;
    var first = store.getVisible()[0];
    if (first) store.select(first.properties.id);
  }

  selectInitial();
  render();
  renderLedger();
  showResume();

  /* WP-L1 — قراءة سجل الخادم **بعد** أول تصيير.
     قبله كانت تحجب الرسم على طلب شبكة، وبعده تكمّل ما ينقص المحلي بلا أن
     يشعر المراجع بانتظار. */
  mergeServerLedger(decisions);

  window.__masarDesk = {
    store: store, map: GL, states: MasarDeskStates,
    decisions: function () { return decisions; },
    calibration: calibration,
    observations: function () { return observations; },
    ledger: LEDGER,
  };
})();
