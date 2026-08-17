/* ==========================================================================
   BIEK RESULT 2026 — App
   Preloader, background FX, group selector, search, autocomplete,
   result rendering + end-level animations
   ========================================================================== */

(function () {
  'use strict';

  var DATA = window.BIEK_DATA || null;
  var exams = (DATA && DATA.exams) || [];

  /* ------------------------------------------------------------------
     Helpers
     ------------------------------------------------------------------ */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function formatNumber(n) {
    return Number(n).toLocaleString('en-US');
  }

  /* ------------------------------------------------------------------
     Active group state
     ------------------------------------------------------------------ */
  var STORE_KEY = 'biek-active-group';
  var groupTabs = $('#groupTabs');
  var heroGroup = $('#heroGroup');
  var activeIdx = 0;
  var active = null; // { id, exam, results, index, colleges, withheld }

  function loadActiveGroup() {
    if (!exams.length) return;
    var saved = null;
    try { saved = localStorage.getItem(STORE_KEY); } catch (e) { /* ignore */ }
    if (saved) {
      var found = exams.findIndex(function (e) { return e.id === saved; });
      if (found !== -1) activeIdx = found;
    }
    active = exams[activeIdx];
  }

  function renderGroupTabs() {
    if (!groupTabs || exams.length < 2) {
      if (groupTabs) groupTabs.hidden = true;
      return;
    }
    groupTabs.hidden = false;
    groupTabs.innerHTML = exams.map(function (e, i) {
      var label = (e.exam && (e.exam.groupDisplay || e.exam.groupShort)) || e.id;
      return '<button class="group-tab' + (i === activeIdx ? ' is-active' : '') + '" data-idx="' + i +
        '" role="tab" aria-selected="' + (i === activeIdx) + '">' +
        '<span class="group-tab__dot"></span>' + esc(label) + '</button>';
    }).join('');

    $all('.group-tab', groupTabs).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-idx'), 10);
        if (idx === activeIdx) return;
        activeIdx = idx;
        active = exams[activeIdx];
        try { localStorage.setItem(STORE_KEY, active.id); } catch (e) { /* ignore */ }
        $all('.group-tab', groupTabs).forEach(function (b) {
          var on = b === btn;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-selected', String(on));
        });
        colleges = active.colleges || [];
        closeAc();
        resultStage.innerHTML = '';
        if (heroGroup && active.exam) {
          heroGroup.textContent = active.exam.group || active.exam.groupDisplay || '';
        }
        updateExamMeta();
        showToast('Switched to ' + (active.exam && active.exam.groupDisplay ? active.exam.groupDisplay : active.id));
      });
    });
  }

  /* ------------------------------------------------------------------
     Preloader
     ------------------------------------------------------------------ */
  var preloader = $('#preloader');
  var preloaderBar = $('#preloaderBar');
  var preloaderStatus = $('#preloaderStatus');
  var preloaderDone = false;

  function runPreloader() {
    var progress = 0;
    var ring = $('.preloader__ring-progress', preloader);
    var CIRC = 276.46;

    var steps = ['Indexing roll numbers…', 'Loading colleges…', 'Preparing gazette data…', 'Almost there…'];
    var stepIdx = 0;
    var stepAt = [0.15, 0.4, 0.7, 0.92];

    var timer = setInterval(function () {
      progress += Math.random() * 6 + 2.5;
      if (progress >= 100) {
        progress = 100;
        clearInterval(timer);
        finishPreloader();
      }

      if (stepIdx < steps.length && progress >= stepAt[stepIdx] * 100) {
        preloaderStatus.textContent = steps[stepIdx];
        stepIdx++;
      }

      preloaderBar.style.width = progress + '%';
      ring.style.strokeDashoffset = String(CIRC - (CIRC * progress) / 100);
    }, 46);
  }

  function finishPreloader() {
    if (preloaderDone) return;
    preloaderDone = true;
    preloaderStatus.textContent = 'Ready ✓';
    setTimeout(function () {
      preloader.classList.add('is-done');
      document.body.style.overflow = '';
      setTimeout(initReveal, 80);
    }, 380);
  }

  /* ------------------------------------------------------------------
     Background canvas — drifting particles
     ------------------------------------------------------------------ */
  var canvas = $('#bgCanvas');
  var ctx = canvas ? canvas.getContext('2d') : null;
  var particles = [];
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function initParticles() {
    if (reducedMotion || !ctx) return;
    var count = Math.min(70, Math.floor(window.innerWidth / 22));
    particles = [];
    for (var i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.8 + 0.4,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        a: Math.random() * 0.5 + 0.12,
        tw: Math.random() * Math.PI * 2
      });
    }
  }

  function drawParticles(t) {
    if (reducedMotion || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.tw += 0.02;
      if (p.x < -10) p.x = canvas.width + 10;
      if (p.x > canvas.width + 10) p.x = -10;
      if (p.y < -10) p.y = canvas.height + 10;
      if (p.y > canvas.height + 10) p.y = -10;

      var alpha = p.a * (0.6 + 0.4 * Math.sin(p.tw));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(229,9,20,' + alpha + ')';
      ctx.shadowColor = 'rgba(229,9,20,0.8)';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    requestAnimationFrame(drawParticles);
  }

  /* ------------------------------------------------------------------
     Scroll reveal
     ------------------------------------------------------------------ */
  var revealEls;
  function initReveal() {
    revealEls = $all('.reveal');
    if (!('IntersectionObserver' in window)) {
      revealEls.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(function (el, i) {
      el.style.setProperty('--d', (i % 4) * 0.09 + 's');
      io.observe(el);
    });
  }

  /* ------------------------------------------------------------------
     Header scroll state + mobile nav + back-to-top
     ------------------------------------------------------------------ */
  var header = $('#header');
  var backTop = $('#backTop');
  var nav = $('#nav');
  var navToggle = $('#navToggle');

  function onScroll() {
    var y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 30);
    backTop.classList.toggle('is-visible', y > 420);
    if (scrollBar) scrollBar.style.width = (y / Math.max(document.documentElement.scrollHeight - window.innerHeight, 1)) * 100 + '%';
  }

  navToggle.addEventListener('click', function () {
    var open = nav.classList.toggle('is-open');
    navToggle.classList.toggle('is-open', open);
    navToggle.setAttribute('aria-expanded', String(open));
  });

  $all('.nav__link').forEach(function (link) {
    link.addEventListener('click', function () {
      nav.classList.remove('is-open');
      navToggle.classList.remove('is-open');
    });
  });

  backTop.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  window.addEventListener('scroll', onScroll, { passive: true });

  // Nav active state based on section
  var sections = ['home', 'check', 'about'];
  var sectionEls = sections.map(function (id) { return document.getElementById(id); });
  if ('IntersectionObserver' in window) {
    var secIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          $all('.nav__link').forEach(function (l) {
            l.classList.toggle('is-active', l.getAttribute('data-scroll') === entry.target.id);
          });
        }
      });
    }, { threshold: 0.3 });
    sectionEls.forEach(function (el) { if (el) secIO.observe(el); });
  }

  /* ------------------------------------------------------------------
     Scroll progress bar
     ------------------------------------------------------------------ */
  var scrollBar = $('#scrollBar');

  /* ------------------------------------------------------------------
     Toast
     ------------------------------------------------------------------ */
  var toast = $('#toast');
  var toastTimer;
  function showToast(msg, isError) {
    toast.textContent = msg;
    toast.classList.toggle('is-error', !!isError);
    toast.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('is-show'); }, 3200);
  }

  /* ------------------------------------------------------------------
     Search
     ------------------------------------------------------------------ */
  var rollInput = $('#rollInput');
  var collegeInput = $('#collegeInput');
  var checkBtn = $('#checkBtn');
  var acBox = $('#autocomplete');
  var resultStage = $('#resultStage');
  var searchCard = $('#searchCard');

  var selectedCollege = '';
  var colleges = (active && active.colleges) || [];
  var acItems = [];
  var acSelectedIdx = -1;

  // Roll number: numbers only, strip spaces
  rollInput.addEventListener('input', function () {
    var v = rollInput.value.replace(/[^\d]/g, '').slice(0, 6);
    rollInput.value = v;
    rollInput.classList.remove('is-error');
  });
  rollInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); doSearch(); }
  });

  /* ----- Autocomplete ----- */
  function buildAc(query) {
    if (!query || !query.trim()) {
      closeAc();
      return;
    }
    var q = query.trim().toLowerCase();
    if (q.length < 2) { closeAc(); return; }

    var matches = colleges.filter(function (c) {
      return c.toLowerCase().indexOf(q) !== -1;
    }).slice(0, 8);

    if (!matches.length) {
      acBox.innerHTML = '<div class="ac-empty">No college found</div>';
      acBox.hidden = false;
      acItems = [];
      return;
    }

    acBox.innerHTML = matches.map(function (c) {
      var hl = highlight(c, query.trim());
      return '<div class="ac-item" data-val="' + escAttr(c) + '">' +
        '<svg class="ac-item__icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M5 21V7l7-4 7 4v14"/></svg>' +
        '<span>' + hl + '</span></div>';
    }).join('');
    acBox.hidden = false;
    acItems = $all('.ac-item', acBox);
    acSelectedIdx = -1;

    acItems.forEach(function (item) {
      item.addEventListener('mousedown', function (e) {
        e.preventDefault();
        pickCollege(item.getAttribute('data-val'));
      });
    });
  }

  function highlight(text, q) {
    var idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return esc(text);
    return esc(text.slice(0, idx)) + '<b>' + esc(text.slice(idx, idx + q.length)) + '</b>' + esc(text.slice(idx + q.length));
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }
  function escAttr(s) {
    return s.replace(/"/g, '&quot;').replace(/&/g, '&amp;');
  }

  function pickCollege(name) {
    collegeInput.value = name;
    selectedCollege = name;
    closeAc();
    collegeInput.classList.remove('is-error');
  }

  function closeAc() {
    acBox.hidden = true;
    acBox.innerHTML = '';
    acItems = [];
    acSelectedIdx = -1;
  }

  collegeInput.addEventListener('input', function () {
    selectedCollege = '';
    collegeInput.classList.remove('is-error');
    buildAc(collegeInput.value);
  });
  collegeInput.addEventListener('focus', function () { buildAc(collegeInput.value); });
  collegeInput.addEventListener('keydown', function (e) {
    if (!acItems.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      acSelectedIdx = (acSelectedIdx + 1) % acItems.length;
      markAcSelected();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      acSelectedIdx = (acSelectedIdx - 1 + acItems.length) % acItems.length;
      markAcSelected();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (acSelectedIdx >= 0 && acItems[acSelectedIdx]) {
        pickCollege(acItems[acSelectedIdx].getAttribute('data-val'));
      } else {
        doSearch();
      }
    } else if (e.key === 'Escape') {
      closeAc();
    }
  });
  document.addEventListener('click', function (e) {
    if (!collegeInput.contains(e.target)) closeAc();
  });

  function markAcSelected() {
    acItems.forEach(function (it, i) { it.classList.toggle('is-selected', i === acSelectedIdx); });
  }

  /* ----- Search action ----- */
  checkBtn.addEventListener('click', doSearch);

  function doSearch() {
    if (!active) {
      showToast('Result data is not loaded yet.', true);
      return;
    }

    var roll = rollInput.value.trim();
    var college = selectedCollege || (collegeInput.value.trim() ? collegeInput.value.trim() : '');

    if (!roll) {
      rollInput.classList.add('is-error');
      rollInput.focus();
      showToast('Please enter your roll number.', true);
      return;
    }
    if (!/^\d{6}$/.test(roll)) {
      rollInput.classList.add('is-error');
      showToast('Roll number must be 6 digits.', true);
      return;
    }

    // Loading state
    checkBtn.classList.add('is-loading');
    checkBtn.disabled = true;
    resultStage.innerHTML = '';

    setTimeout(function () {
      checkBtn.classList.remove('is-loading');
      checkBtn.disabled = false;
      resolveSearch(roll, college);
    }, 520);
  }

  function resolveSearch(roll, college) {
    // 1) withheld first
    var withheld = active.withheld;
    var reasons = [];
    if (withheld.unfair_means.indexOf(roll) !== -1) reasons.push('UFM case pending B.O.G. decision');
    if (withheld.computerized_enrolment.indexOf(roll) !== -1) reasons.push('Computerized Enrolment Card pending');
    if (withheld.verification_enrolment.indexOf(roll) !== -1) reasons.push('Verification of Enrolment Card pending');
    if (reasons.length) {
      renderWithheld(reasons);
      return;
    }

    // 2) find record O(1)
    var idx = active.index[roll];
    if (idx === undefined) {
      renderNotFound();
      return;
    }
    var rec = active.results[idx];

    // 3) college match check
    if (college) {
      var recCollege = (rec.college_name || '').trim().toLowerCase();
      var inputCollege = college.trim().toLowerCase();
      if (recCollege !== inputCollege) {
        renderMismatch(rec, college);
        return;
      }
    }

    renderResult(rec);
  }

  /* ------------------------------------------------------------------
     Render: Result
     ------------------------------------------------------------------ */
  function renderResult(rec) {
    var name = rec.candidate_name || 'Candidate Name Not Listed';
    var isPass = rec.status === 'PASSED';
    var extra = rec.extra_marks ? ' (+' + rec.extra_marks + ' extra)' : '';
    var grace = rec.grace_marks ? ' (grace ' + rec.grace_marks + ')' : '';
    var exam = active.exam;

    var html =
      '<div class="result-card' + (isPass ? ' is-passed' : '') + '">' +
        '<div class="result-card__top">' +
          '<span class="result-card__verify">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>' +
            '<span class="check-pop">RESULT VERIFIED</span>' +
          '</span>' +
          '<div class="result-card__name">' + esc(name) + '</div>' +
          '<div class="result-card__roll">Roll No: <b>' + rec.roll_number + '</b></div>' +
        '</div>' +
        '<div class="result-card__body">' +
          '<div class="res-grid">' +
            '<div class="res-row">' +
              '<div><div class="res-row__label">College</div><div class="res-row__value college-name">' + esc(rec.college_name) + '</div></div>' +
            '</div>' +
          '</div>' +
          '<div class="res-stats">' +
            '<div class="res-stat">' +
              '<div class="res-stat__num" data-count="' + rec.obtained_marks + '">0</div>' +
              '<div class="res-stat__label">Marks<span class="res-row__label" style="text-transform:none;letter-spacing:0">/ ' + rec.total_marks + extra + grace + '</span></div>' +
            '</div>' +
            '<div class="res-stat">' +
              '<div class="res-stat__num grad" data-count="' + rec.percentage + '" data-decimal="2">0</div>' +
              '<div class="res-stat__label">Percentage</div>' +
            '</div>' +
            '<div class="res-stat">' +
              '<div class="res-stat__num grad">' + (rec.grade || '—') + '</div>' +
              '<div class="res-stat__label">Grade</div>' +
            '</div>' +
          '</div>' +
          '<div class="result-card__status is-pass"><span class="tick-burst">✓</span>PASSED</div>' +
          '<div class="result-card__meta">' +
            '<b>' + esc(exam.board) + '</b> · ' + esc(exam.examination) + '<br/>' +
            esc(exam.group) +
          '</div>' +
        '</div>' +
      '</div>';

    resultStage.innerHTML = html;
    animateCounts($('.result-card'));
    addTilt($('.result-card'));
    if (isPass) confettiBurst();
    scrollToResult();
  }

  /* ------------------------------------------------------------------
     Render: Not found
     ------------------------------------------------------------------ */
  function renderNotFound() {
    resultStage.innerHTML =
      '<div class="msg-card is-error">' +
        '<div class="msg-card__icon">!</div>' +
        '<div class="msg-card__title">Result Not Found</div>' +
        '<p class="msg-card__text">We couldn\'t find a result for this roll number.<br/>Please check your roll number and try again.</p>' +
        '<button class="btn msg-card__btn" onclick="document.getElementById(\'rollInput\').focus();document.getElementById(\'rollInput\').select()">Try Again</button>' +
      '</div>';
    scrollToResult();
  }

  /* ------------------------------------------------------------------
     Render: College mismatch
     ------------------------------------------------------------------ */
  function renderMismatch(rec, college) {
    resultStage.innerHTML =
      '<div class="msg-card is-error">' +
        '<div class="msg-card__icon">✕</div>' +
        '<div class="msg-card__title">College Mismatch</div>' +
        '<p class="msg-card__text">Roll number <b style="color:#fff">' + esc(rec.roll_number) + '</b> is registered under a different college than "' + esc(college) + '".<br/>The candidate\'s actual college is shown below.</p>' +
        '<div class="result-card__body" style="padding:0;margin-top:22px;text-align:left">' +
          '<div class="res-row"><div><div class="res-row__label">College</div><div class="res-row__value college-name">' + esc(rec.college_name) + '</div></div></div>' +
        '</div>' +
      '</div>';
    scrollToResult();
  }

  /* ------------------------------------------------------------------
     Render: Withheld
     ------------------------------------------------------------------ */
  function renderWithheld(reasons) {
    var list = reasons.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('');
    resultStage.innerHTML =
      '<div class="msg-card is-withheld">' +
        '<div class="msg-card__icon">⚠</div>' +
        '<div class="msg-card__title">RESULT WITHHELD</div>' +
        '<p class="msg-card__text">Your result / marks statement is currently withheld according to the official gazette.<br/>Please contact your institution or BIEK for further information.</p>' +
        '<ul class="withheld-reasons" style="list-style:none;margin-top:16px;color:var(--text-2);font-size:13px;text-align:left;display:inline-block">' + list + '</ul>' +
      '</div>';
    scrollToResult();
  }

  function scrollToResult() {
    setTimeout(function () {
      var stage = resultStage;
      var y = stage.getBoundingClientRect().top + window.scrollY - 90;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }, 120);
  }

  /* ------------------------------------------------------------------
     Count-up animation
     ------------------------------------------------------------------ */
  function animateCounts(card) {
    var nums = $all('[data-count]', card);
    if (!nums.length) return;

    if (!('IntersectionObserver' in window)) {
      nums.forEach(function (n) { n.textContent = formatNumber(n.getAttribute('data-count')); });
      return;
    }

    var started = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        if (started[el._cuid]) return;
        started[el._cuid] = true;
        var target = parseFloat(el.getAttribute('data-count'));
        var decimals = parseInt(el.getAttribute('data-decimal') || '0', 10);
        animateNumber(el, target, decimals);
        io.unobserve(el);
      });
    }, { threshold: 0.05 });
    nums.forEach(function (n, i) { n._cuid = i; io.observe(n); });
  }

  function animateNumber(el, target, decimals) {
    var dur = 1100;
    var start = null;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      var val = target * eased;
      el.textContent = val.toFixed(decimals);
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = decimals ? target.toFixed(decimals) : formatNumber(target);
    }
    requestAnimationFrame(step);
  }

  /* ------------------------------------------------------------------
     End-level animations
     ------------------------------------------------------------------ */

  /* 3D tilt on result card */
  function addTilt(el) {
    if (reducedMotion || !el) return;
    var activeTilt = false;
    var raf = null;
    el.addEventListener('mousemove', function (e) {
      if (!activeTilt) {
        activeTilt = true;
        el.classList.add('is-tilting');
      }
      var r = el.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width;
      var py = (e.clientY - r.top) / r.height;
      var rx = (0.5 - py) * 10;
      var ry = (px - 0.5) * 10;
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () {
        el.style.transform = 'perspective(1000px) rotateX(' + rx + 'deg) rotateY(' + ry + 'deg) translateY(-4px)';
      });
    });
    el.addEventListener('mouseleave', function () {
      activeTilt = false;
      if (raf) cancelAnimationFrame(raf);
      el.style.transform = '';
      el.classList.remove('is-tilting');
    });
  }

  /* Confetti burst on PASSED */
  function confettiBurst() {
    if (reducedMotion) return;
    var colors = ['#E50914', '#2ED47A', '#F5B301', '#ffffff', '#7c5cff'];
    for (var i = 0; i < 70; i++) {
      var piece = document.createElement('div');
      piece.className = 'confetti';
      piece.style.left = 50 + (Math.random() - 0.5) * 70 + 'vw';
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDelay = (Math.random() * 0.4) + 's';
      piece.style.animationDuration = (1.4 + Math.random() * 1.6) + 's';
      var size = 5 + Math.random() * 7;
      piece.style.width = size + 'px';
      piece.style.height = (size * (Math.random() > 0.5 ? 1 : 0.4)) + 'px';
      piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      document.body.appendChild(piece);
      (function (p) {
        setTimeout(function () { if (p.parentNode) p.parentNode.removeChild(p); }, 3600);
      })(piece);
    }
  }

  /* Cursor glow follower */
  var cursorGlow;
  function initCursorGlow() {
    if (reducedMotion || !('ontouchstart' in window) === false) return;
    cursorGlow = document.createElement('div');
    cursorGlow.className = 'cursor-glow';
    document.body.appendChild(cursorGlow);
    var cx = 0, cy = 0, tx = 0, ty = 0;
    document.addEventListener('mousemove', function (e) {
      tx = e.clientX;
      ty = e.clientY;
    });
    (function follow() {
      cx += (tx - cx) * 0.12;
      cy += (ty - cy) * 0.12;
      cursorGlow.style.transform = 'translate(' + (cx - 220) + 'px,' + (cy - 220) + 'px)';
      requestAnimationFrame(follow);
    })();
  }

  /* Magnetic buttons */
  function initMagnetic() {
    if (reducedMotion) return;
    var els = $all('.btn--primary');
    els.forEach(function (btn) {
      btn.addEventListener('mousemove', function (e) {
        var r = btn.getBoundingClientRect();
        var mx = e.clientX - r.left - r.width / 2;
        var my = e.clientY - r.top - r.height / 2;
        btn.style.transform = 'translate(' + mx * 0.18 + 'px,' + my * 0.28 + 'px)';
      });
      btn.addEventListener('mouseleave', function () {
        btn.style.transform = '';
      });
    });
  }

  /* ------------------------------------------------------------------
     Exam meta (title / hero)
     ------------------------------------------------------------------ */
  function updateExamMeta() {
    if (!active || !active.exam) return;
    var exam = active.exam;
    $all('.brand__text em').forEach(function (el) {
      el.textContent = exam.year;
    });
    document.title = 'BIEK Result ' + exam.year + ' — ' + exam.class + ' ' + exam.groupShort;
    if (heroGroup && exam.group) heroGroup.textContent = exam.group;
  }

  /* ------------------------------------------------------------------
     Init
     ------------------------------------------------------------------ */
  function init() {
    loadActiveGroup();
    if (!active) {
      document.body.style.overflow = '';
      if (preloader) preloader.classList.add('is-done');
      return;
    }

    resizeCanvas();
    initParticles();
    if (!reducedMotion) requestAnimationFrame(drawParticles);
    window.addEventListener('resize', function () {
      resizeCanvas();
      initParticles();
    });

    colleges = active.colleges || [];
    renderGroupTabs();
    updateExamMeta();

    initCursorGlow();
    initMagnetic();

    // start preloader
    if (reducedMotion) {
      finishPreloader();
    } else {
      document.body.style.overflow = 'hidden';
      runPreloader();
    }

    onScroll();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
