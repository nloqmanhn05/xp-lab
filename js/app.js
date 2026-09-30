/* ==========================================================================
   XP LAB TRAINER - DESKTOP & MOBILE RESPONSIVE iOS CONTROLLER & ENGINE
   ========================================================================== */

// Persistent App State
let S = {
  p: {},
  days: [],
  bestMs: null,
  last: null,
  theme: "system", // system | light | dark
  analyticsOptOut: false,
  firebaseConfig: null
};

try {
  const stored = localStorage.getItem("xpl_v2") || localStorage.getItem("xpl");
  if (stored) Object.assign(S, JSON.parse(stored));
} catch (e) { }
S.days = S.days || [];
S.p = S.p || {};

const saveLocal = () => {
  try { localStorage.setItem("xpl_v2", JSON.stringify(S)); } catch (e) { }
};

// DOM Utilities
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const norm = s => s.trim().toLowerCase().replace(/\s+/g, " ");
const fmt = ms => {
  const s = Math.round(ms / 1000);
  return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
};
const shuffle = a => {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.random() * (i + 1) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const today = () => new Date().toLocaleDateString("en-CA");

function streak() {
  let n = 0, d = new Date();
  const has = x => S.days.includes(x.toLocaleDateString("en-CA"));
  if (!has(d)) d.setDate(d.getDate() - 1);
  while (has(d)) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

const mastered = () => tasks.filter(t => {
  const p = S.p[t.id];
  return p && p.c >= 1 && (p.c / p.a) >= 0.7;
});

const weak = () => tasks.filter(t => {
  const p = S.p[t.id];
  return p && (p.c / p.a) < 0.6;
});

// Theme Management
function applyTheme(theme) {
  S.theme = theme;
  saveLocal();
  if (theme === 'system') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
  if (typeof trackEvent === 'function') trackEvent('theme_change', { theme });
  render();
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
    (!document.documentElement.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const next = isDark ? 'light' : 'dark';
  applyTheme(next);
}

// Apply initial theme
if (S.theme && S.theme !== 'system') {
  document.documentElement.setAttribute('data-theme', S.theme);
}

/* ==========================================================================
   SESSION CONTROLLER
   ========================================================================== */
let V = "home"; // home | q | done | stats | term | auth
let F = "all";  // all | run | cmd | gui
let Q = null;
let tick = null;
let activeModal = null; // null | 'auth' | 'account' | 'confirmExit' | 'resetData'
let pendingRevision = null; // null | { action: 'start', mode: string } | { action: 'go', view: string }

function go(v) {
  // Gate terminal simulation: require sign up first
  if (v === 'term' && !currentUser) {
    pendingRevision = { action: 'go', view: 'term' };
    authTab = 'signup';
    authError = '';
    activeModal = 'auth';
    render();
    return;
  }
  V = v;
  try {
    if (window.location.hash !== '#' + v) {
      window.location.hash = v;
    }
  } catch (e) { }
  clearInterval(tick);
  render();
}

window.addEventListener('hashchange', () => {
  const h = window.location.hash.replace('#', '');
  if (['home', 'q', 'done', 'stats', 'term', 'auth'].includes(h) && V !== h) {
    if (h === 'term' && !currentUser) {
      pendingRevision = { action: 'go', view: 'term' };
      authTab = 'signup';
      authError = '';
      activeModal = 'auth';
      render();
      return;
    }
    V = h;
    clearInterval(tick);
    render();
  }
});

const initialHash = (typeof window !== 'undefined' ? window.location.hash.replace('#', '') : '');
if (['home', 'q', 'done', 'stats', 'term', 'auth'].includes(initialHash)) {
  V = initialHash;
}

function setF(f) {
  F = f;
  render();
}

function start(mode) {
  // Gate practice revision: pop auth modal to let user sign up first before they use
  if (!currentUser) {
    pendingRevision = { action: 'start', mode };
    authTab = 'signup';
    authError = '';
    activeModal = 'auth';
    render();
    return;
  }

  const pool = tasks.filter(t => F === "all" || t.sec === F);
  let list = pool;
  if (mode === "exam") list = tasks;
  else if (mode === "type") list = pool.filter(t => t.re);
  else if (mode === "drill") {
    const ids = new Set([...weak(), ...(Q ? Q.res.filter(r => !r.ok).map(r => r.t) : [])].map(t => t.id));
    list = tasks.filter(t => ids.has(t.id));
  }
  if (!list.length) return;

  Q = {
    mode,
    list: shuffle(list),
    i: 0,
    ph: "ask", // ask | reveal | fb
    res: [],
    history: [],
    t0: Date.now(),
    T0: Date.now(),
    paused: false,
    pausedAccumMs: 0,
    pauseStart: null
  };

  if (typeof trackEvent === 'function') trackEvent('start_session', { mode, category: F, count: list.length });
  clearInterval(tick);
  tick = setInterval(updateTimerDisplay, 500);
  V = "q";
  render();
}

function getElapsedMs() {
  if (!Q) return 0;
  let now = Date.now();
  if (Q.paused && Q.pauseStart) {
    now = Q.pauseStart;
  }
  const base = (Q.mode === "exam" ? Q.T0 : Q.t0);
  return (now - base) - (Q.pausedAccumMs || 0);
}

function updateTimerDisplay() {
  const c = $("#clk");
  if (c && Q) c.textContent = fmt(Math.max(0, getElapsedMs()));
}

function togglePause() {
  if (!Q) return;
  Q.paused = !Q.paused;
  if (Q.paused) {
    Q.pauseStart = Date.now();
  } else {
    if (Q.pauseStart) {
      Q.pausedAccumMs = (Q.pausedAccumMs || 0) + (Date.now() - Q.pauseStart);
      Q.pauseStart = null;
    }
  }
  render();
}

const typedMode = t => t.re && Q.mode !== "flash";

function rec(t, ok, ms) {
  const p = S.p[t.id] || (S.p[t.id] = { a: 0, c: 0, ms: 0 });
  p.a++;
  if (ok) p.c++;
  p.ms += ms;
  const resultObj = { t, ok, ms };
  Q.res.push(resultObj);
  if (!S.days.includes(today())) S.days.push(today());
  saveLocal();
  if (typeof recordTaskCloud === 'function') recordTaskCloud(t, ok, ms);
  if (typeof trackEvent === 'function') trackEvent('complete_task', { task_id: t.id, ok, ms, mode: Q.mode });
}

function check() {
  if (Q.paused) return;
  const t = Q.list[Q.i];
  const inEl = $("#in");
  if (!inEl) return;
  const v = inEl.value;
  if (!v.trim()) return;

  Q.typed = v;
  Q.ok = t.re.test(norm(v));
  const elapsed = getElapsedMs();
  rec(t, Q.ok, elapsed);
  Q.ph = "fb";
  render();
}

function reveal() {
  if (Q.paused) return;
  const t = Q.list[Q.i];
  Q.ms = getElapsedMs();
  if (typedMode(t)) {
    Q.typed = "";
    Q.ok = false;
    Q.gave = true;
    rec(t, false, Q.ms);
    Q.ph = "fb";
  } else {
    Q.ph = "reveal";
  }
  render();
}

function grade(ok) {
  if (Q.paused) return;
  const t = Q.list[Q.i];
  Q.history.push({
    i: Q.i,
    ph: Q.ph,
    resLength: Q.res.length,
    pSnapshot: JSON.parse(JSON.stringify(S.p[t.id] || null))
  });
  rec(t, ok, Q.ms || getElapsedMs());
  next();
}

function undoLast() {
  if (!Q || !Q.history.length) return;
  const prev = Q.history.pop();
  Q.i = prev.i;
  Q.ph = prev.ph;
  const t = Q.list[Q.i];
  if (Q.res.length > prev.resLength) {
    Q.res.pop();
  }
  if (prev.pSnapshot) {
    S.p[t.id] = prev.pSnapshot;
  } else {
    delete S.p[t.id];
  }
  saveLocal();
  render();
}

function skipTask() {
  if (Q.paused) return;
  const skipped = Q.list.splice(Q.i, 1)[0];
  Q.list.push(skipped);
  Q.t0 = Date.now();
  Q.pausedAccumMs = 0;
  Q.ph = "ask";
  render();
}

function next() {
  Q.alt = false;
  Q.gave = false;
  if (Q.i + 1 >= Q.list.length) {
    const isExam = Q.mode === "exam";
    const ms = isExam ? (Date.now() - Q.T0 - (Q.pausedAccumMs || 0)) : Q.res.reduce((a, r) => a + r.ms, 0);
    const c = Q.res.filter(r => r.ok).length;
    const w = Q.res.length - c;
    Q.total = ms;
    Q.prev = S.last;
    S.last = { c, ms, w, mode: Q.mode };
    if (isExam) {
      if (S.bestMs == null || ms < S.bestMs) S.bestMs = ms;
    }
    saveLocal();

    // Record session to Firestore (user, best streak time, duration, correct, wrong)
    if (typeof recordSessionCloud === 'function') {
      recordSessionCloud({
        mode: Q.mode,
        durationMs: ms,
        durationFmt: fmt(ms),
        correctCount: c,
        wrongCount: w,
        totalTasks: Q.res.length,
        accuracyPct: Math.round(100 * (c / (Q.res.length || 1)))
      });
    }

    if (typeof trackEvent === 'function') {
      trackEvent('finish_session', { mode: Q.mode, score: c, total: Q.list.length, duration_ms: ms });
    }
    return go("done");
  }
  Q.i++;
  Q.ph = "ask";
  Q.t0 = Date.now();
  Q.pausedAccumMs = 0;
  render();
}

/* ==========================================================================
   KEYBOARD CONTROLLER
   ========================================================================== */
window.addEventListener("keydown", e => {
  if (activeModal) {
    if (e.key === "Escape") { activeModal = null; render(); }
    return;
  }

  if (V === "q" && Q) {
    if (e.key === "Escape") {
      e.preventDefault();
      activeModal = "confirmExit";
      render();
      return;
    }
    if (e.key.toLowerCase() === "p" && document.activeElement?.id !== "in") {
      e.preventDefault();
      togglePause();
      return;
    }
    if (Q.paused) return;

    if (Q.ph === "ask") {
      if (e.key === " " && document.activeElement?.id !== "in") {
        e.preventDefault();
        reveal();
      }
    } else if (Q.ph === "reveal") {
      if (e.key === "1") { e.preventDefault(); grade(false); }
      else if (e.key === "2") { e.preventDefault(); grade(true); }
      else if (e.key === "z" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); undoLast(); }
    } else if (Q.ph === "fb") {
      if (e.key === "Enter") {
        e.preventDefault();
        next();
      }
    }
  }
});

/* ==========================================================================
   HEADER COMPONENT
   ========================================================================== */
function renderHeader(title = "XP Lab Trainer", showBack = false) {
  const st = streak();
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
    (!document.documentElement.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const themeTitle = isDark ? "Switch to Light Mode" : "Switch to Dark Mode";
  const themeIcon = isDark ? ic('sun', 16) : ic('moon', 16);

  const userBadge = currentUser
    ? `<button class="btn btn-sec btn-sm" onclick="go('auth')" title="${esc(currentUser.email)}">
         ${ic('user', 14)} <span class="user-btn-label">${esc(currentUser.displayName || currentUser.email.split('@')[0])}</span>
       </button>`
    : `<button class="btn btn-pri btn-sm" onclick="go('auth')" title="Sign In">
         ${ic('user', 14)} <span class="user-btn-label">Sign In</span>
       </button>`;

  const syncDotClass = syncStatus === 'synced' ? 'synced' : syncStatus === 'syncing' ? 'syncing' : syncStatus === 'offline' ? 'offline' : '';
  const syncLabel = syncStatus === 'synced' ? 'Synced' : syncStatus === 'syncing' ? 'Syncing...' : syncStatus === 'offline' ? 'Offline' : 'Guest';

  return `
    <header class="app-header">
      <div style="display:flex;align-items:center;gap:10px;min-width:0">
        ${showBack ? `
          <button class="btn btn-ghost btn-sm" onclick="go('home')" title="Exit to Home" style="font-weight:600;padding:0 8px 0 0;color:var(--ios-blue);display:inline-flex;align-items:center;gap:4px;flex-shrink:0">
            <span style="font-size:18px;line-height:1;margin-top:-1px">‹</span> Exit
          </button>
          <div style="border-left:1px solid var(--ios-separator);height:20px;flex-shrink:0"></div>
        ` : `
          <div class="brand-wrap" onclick="go('home')">
            <div class="brand-icon" title="XP Lab Home">
              <img src="assets/logo-black.png" alt="XP Lab Logo" class="brand-logo-img brand-logo-light">
              <img src="assets/logo-white.png" alt="XP Lab Logo" class="brand-logo-img brand-logo-dark">
            </div>
          </div>
        `}
        <div style="min-width:0">
          <div class="brand-title">${esc(title)}</div>
          <div class="brand-subtitle">Windows XP Systems Lab</div>
        </div>
      </div>
      
      <div class="header-actions">
        ${st ? `<span class="streak-badge" title="${st} day streak">${ic("flame", 14)} <b>${st}d</b></span>` : ""}
        <span class="sync-badge" title="Cloud Sync: ${syncLabel} (Click to open Auth / Account)" onclick="go('auth')" style="cursor:pointer">
          <span class="sync-dot ${syncDotClass}"></span> <span class="sync-badge-text">${syncLabel}</span>
        </span>
        <button class="btn btn-ghost btn-sm header-icon-btn" onclick="toggleTheme()" title="${themeTitle}" aria-label="${themeTitle}">
          ${themeIcon}
        </button>
        ${userBadge}
      </div>
    </header>
  `;
}

/* ==========================================================================
   VIEWS (DESKTOP WIDESCREEN & MOBILE ADAPTIVE)
   ========================================================================== */
function home() {
  const w = weak().length;
  const m = mastered().length;
  const agg = typeof getAggregateStats === 'function' ? getAggregateStats() : { totalCorrect: 0, totalWrong: 0, totalDurationFmt: '00:00' };
  const bestTimeStr = S.bestMs != null ? fmt(S.bestMs) : (S.last && S.last.ms ? fmt(S.last.ms) + " (last)" : "--:--");

  // iOS Segmented Category Control
  const segmentedPills = Object.keys(SEC).map(k => {
    const count = k === "all" ? tasks.length : tasks.filter(t => t.sec === k).length;
    const isActive = F === k;
    return `<button class="ios-segment-btn ${isActive ? "active" : ""}" aria-pressed="${isActive}" onclick="setF('${k}')">
              ${SEC[k]} <span class="badge-count">${count}</span>
            </button>`;
  }).join("");

  const modeCard = (sqClass, icon, title, desc, action, tourId) => `
    <button class="mode-card" onclick="${action}"${tourId ? ` data-tour="${tourId}"` : ''}>
      <div class="ios-squircle ${sqClass}">${ic(icon, 22)}</div>
      <div class="mode-card-text">
        <div class="mode-title">${title}</div>
        <div class="mode-desc">${desc}</div>
      </div>
    </button>
  `;

  return `
    ${renderHeader("XP Lab Trainer")}
    
    <div class="desktop-dashboard-grid">
      <!-- Left Column: Metrics & Overview Sidebar (Desktop) -->
      <aside class="sidebar-col">
        <div class="card-label">Performance Metrics</div>
        <div class="ios-inset-group" data-tour="metrics">
          <div class="ios-row">
            <span style="color:var(--ios-text-sec)">Mastered Tasks</span>
            <b>${m} <span style="font-weight:400;color:var(--ios-text-ter)">/ ${tasks.length}</span></b>
          </div>
          <div class="ios-row">
            <span style="color:var(--ios-text-sec)">Answers Logged</span>
            <b><span style="color:var(--ios-green)">${agg.totalCorrect} correct</span> &middot; <span style="color:var(--ios-red)">${agg.totalWrong} wrong</span></b>
          </div>
          <div class="ios-row">
            <span style="color:var(--ios-text-sec)">Study Duration</span>
            <b style="font-variant-numeric:tabular-nums">${agg.totalDurationFmt}</b>
          </div>
          <div class="ios-row">
            <span style="color:var(--ios-text-sec)">Best Exam Time</span>
            <b style="font-variant-numeric:tabular-nums">${bestTimeStr}</b>
          </div>
          <div class="ios-row" style="cursor:pointer" onclick="${w ? "start('drill')" : "void(0)"}">
            <span style="color:var(--ios-text-sec)">Weak Tasks</span>
            <b style="color:${w ? "var(--ios-red)" : "var(--ios-green)"}">${w ? `${w} · Drill →` : "0 · All Good"}</b>
          </div>
        </div>

        <div class="card-label">Quick Actions</div>
        <div class="ios-inset-group">
          <div class="ios-row" style="cursor:pointer" onclick="go('stats')">
            <span>Task Analytics & Backup</span>
          </div>
          <div class="ios-row" style="cursor:pointer" onclick="activeModal='account';render()">
            <span>Cloud Sync & Settings</span>
          </div>
        </div>
      </aside>

      <!-- Right Column: Study Modes & Category Selection (Main Stage) -->
      <main class="main-stage-col">
        <div style="margin-bottom:14px">
          <div class="card-label">Filter Practice Mode</div>
          <div class="ios-segmented-control" data-tour="filter">${segmentedPills}</div>
        </div>

        <div class="mode-grid" data-tour="modes">
          ${modeCard("sq-blue", "cards", "Flashcards", "Recall and self-grade answers", "start('flash')", "flash")}
          ${modeCard("sq-orange", "keyboard", "Type Command", "Instant automated syntax checking", "start('type')", "type")}
          ${modeCard("sq-purple", "clock", "Mock Exam", `${tasks.length} tasks timed exam`, "start('exam')", "exam")}
          ${modeCard("sq-green", "term", "Terminal Sim", "Interactive fake C:\\ prompt", "go('term')", "term")}
        </div>

        ${w ? `
          <div class="card" style="background:var(--ios-red-subtle);border-color:var(--ios-red);display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
            <div>
              <div style="font-weight:600;color:var(--ios-red)">You have ${w} weak tasks needing review</div>
              <div style="font-size:12px;color:var(--ios-text-sec)">Boost retention by drilling your lowest accuracy tasks.</div>
            </div>
            <button class="btn btn-danger btn-sm" onclick="start('drill')">Start Weak Drill</button>
          </div>
        ` : ""}
      </main>
    </div>
  `;
}

function ques() {
  const t = Q.list[Q.i];
  const ty = typedMode(t);
  const isLast = Q.i + 1 >= Q.list.length;
  const hdr = Q.mode === "exam" ? "Mock Exam" : Q.mode === "drill" ? "Weak Drill" : Q.mode === "type" ? "Command Typing" : "Flashcards";

  let mid = "", desktopActionControls = "", mobileActionControls = "";

  const termBox = content => `
    <div class="terminal-box" style="min-height:300px;display:flex;flex-direction:column;justify-content:flex-start">
      <div class="term-header">Microsoft Windows XP [Version 5.1.2600] - Command Prompt Simulation</div>
      <div style="color:var(--term-dim);font-size:12px;margin-bottom:14px">(C) Copyright 1985-2001 Microsoft Corp.</div>
      <div class="term-line">
        <span class="term-prompt">C:\\&gt;</span>
        ${content}
      </div>
    </div>
  `;

  if (Q.ph === "ask") {
    mid = ty ? termBox(`<input id="in" class="term-input" aria-label="Command" autocomplete="off" autocapitalize="off" spellcheck="false" onkeydown="if(event.key==='Enter')check()">`) : "";
    desktopActionControls = `
      <div class="action-group">
        <button class="btn btn-ghost" onclick="skipTask()">Skip Task</button>
        <button class="btn btn-sec" onclick="reveal()">Show Answer <kbd>Space</kbd></button>
      </div>
      ${ty ? `<button class="btn btn-pri" onclick="check()">Check <kbd>Enter</kbd></button>` : ""}
    `;
    mobileActionControls = `
      <button class="btn btn-ghost" onclick="skipTask()">Skip</button>
      <button class="btn btn-sec" style="flex:1" onclick="reveal()">Show Answer</button>
      ${ty ? `<button class="btn btn-pri" style="flex:1" onclick="check()">Check</button>` : ""}
    `;
  } else if (Q.ph === "reveal") {
    mid = `
      <div class="fb-box info">
        <div class="fb-heading">Reference Answer</div>
        <p style="margin-bottom:6px"><code>${esc(t.ans)}</code></p>
        <p style="font-size:13px;color:var(--ios-text-sec)">${esc(t.ex)}</p>
      </div>
    `;
    desktopActionControls = `
      <div class="action-group">
        ${Q.history.length ? `<button class="btn btn-ghost" onclick="undoLast()">${ic('undo', 14)} Undo</button>` : ""}
      </div>
      <div class="action-group">
        <button class="btn btn-danger" onclick="grade(false)">Missed <kbd>1</kbd></button>
        <button class="btn btn-success" onclick="grade(true)">Knew it <kbd>2</kbd></button>
      </div>
    `;
    mobileActionControls = `
      ${Q.history.length ? `<button class="btn btn-ghost" onclick="undoLast()">${ic('undo', 16)}</button>` : ""}
      <button class="btn btn-danger" style="flex:1" onclick="grade(false)">Missed</button>
      <button class="btn btn-success" style="flex:1" onclick="grade(true)">Knew it</button>
    `;
  } else {
    // Feedback phase
    mid = (ty ? termBox(`<span>${esc(Q.typed)}</span>`) : "") +
      (Q.ok
        ? `<div class="fb-box ok"><div class="fb-heading">Correct</div><p style="font-size:13px">${esc(t.ex)}</p></div>`
        : `<div class="fb-box no"><div class="fb-heading">${Q.gave ? "Answer Given" : "Incorrect"}</div><p style="margin-bottom:6px">Correct syntax: <code>${esc(t.ans)}</code></p><p style="font-size:13px">${esc(t.ex)}</p></div>`
      ) +
      (Q.alt && ALT[t.id] ? `<div class="fb-box info"><div class="fb-heading">GUI Equivalent</div><p style="font-size:13px">${esc(ALT[t.id])}</p></div>` : "");

    desktopActionControls = `
      <div class="action-group">
        ${ALT[t.id] ? `<button class="btn btn-sec" onclick="Q.alt=!Q.alt;render()">${Q.alt ? "Hide" : "Show"} GUI Alternative</button>` : ""}
      </div>
      <button class="btn btn-pri" id="nx" onclick="next()">${isLast ? "View Results" : "Next Task"} <kbd>Enter</kbd></button>
    `;
    mobileActionControls = `
      ${ALT[t.id] ? `<button class="btn btn-sec" onclick="Q.alt=!Q.alt;render()">${Q.alt ? "Hide GUI" : "GUI Alt"}</button>` : ""}
      <button class="btn btn-pri" style="flex:1" id="nx" onclick="next()">${isLast ? "View Results" : "Next Task"}</button>
    `;
  }

  return `
    <header class="app-header">
      <div style="display:flex;align-items:center;gap:12px">
        <button class="btn btn-ghost btn-sm" onclick="activeModal='confirmExit';render()" title="Exit session (Esc)" style="font-weight:600;padding:0 8px 0 0;color:var(--ios-blue);display:inline-flex;align-items:center;gap:4px">
          <span style="font-size:18px;line-height:1;margin-top:-1px">‹</span> Exit <kbd>Esc</kbd>
        </button>
        <div style="border-left:1px solid var(--ios-separator);height:20px"></div>
        <div>
          <div class="brand-title">${hdr}</div>
          <div class="brand-subtitle">Task ${Q.i + 1} of ${Q.list.length} &middot; ${SEC[t.sec]}</div>
        </div>
      </div>
      <div class="header-actions">
        <button class="btn btn-ghost btn-sm" onclick="togglePause()" title="Pause / Resume Timer">
          ${Q.paused ? ic('play', 14) : ic('pause', 14)} ${Q.paused ? "Resume" : "Pause"} <kbd>P</kbd>
        </button>
        <span class="timer-wrap">${ic("clock", 15)} <span id="clk">${fmt(Math.max(0, getElapsedMs()))}</span></span>
      </div>
    </header>

    <div class="progress-bar-wrap">
      <div class="progress-fill" style="width:${(100 * (Q.i + (Q.ph === 'fb' ? 1 : 0)) / Q.list.length)}%"></div>
    </div>

    ${Q.paused ? `<div class="card" style="text-align:center;padding:40px"><div style="font-size:18px;font-weight:700;margin-bottom:8px">Session Paused</div><p style="font-size:13px;color:var(--ios-text-sec);margin-bottom:16px">Take your time. Press [P] or click below to resume.</p><button class="btn btn-pri" onclick="togglePause()">${ic('play', 16)} Resume Session</button></div>` : `
      <!-- 1. Above: Question Card -->
      <div class="card" style="margin-bottom:14px">
        <div class="card-label">Task Objective &middot; ${SEC[t.sec]}</div>
        <div class="card-title">${esc(t.prompt)}</div>
      </div>

      <!-- 2. Below Question: Big Terminal as in Terminal Sim -->
      ${mid}

      <!-- 3. Below Terminal: Action Controls Row -->
      <div class="action-row" style="display:flex;margin-top:16px">
        ${desktopActionControls}
      </div>

      <!-- Mobile Sticky Bottom Thumb Action Bar -->
      <div class="mobile-bottom-bar">
        <button class="btn btn-ghost btn-sm" onclick="activeModal='confirmExit';render()" title="Exit session">‹ Exit</button>
        ${mobileActionControls}
      </div>
    `}
  `;
}

function done() {
  const c = Q.res.filter(r => r.ok).length;
  const n = Q.res.length;
  const isExam = Q.mode === "exam";
  const totalMs = isExam ? Q.total : Q.res.reduce((a, r) => a + r.ms, 0);
  const accuracy = Math.round(100 * (c / n));
  const slowest = [...Q.res].sort((a, b) => b.ms - a.ms).slice(0, 5);
  const missed = Q.res.filter(r => !r.ok);

  let deltaLabel = "Accuracy", deltaVal = `${accuracy}%`, deltaColor = "";
  if (isExam && Q.prev) {
    const diff = Q.total - Q.prev.ms;
    deltaLabel = "vs Previous Exam";
    deltaVal = (diff < 0 ? "-" : "+") + fmt(Math.abs(diff));
    deltaColor = diff < 0 ? "var(--ios-green)" : "var(--ios-red)";
  }

  return `
    ${renderHeader("Session Results", true)}

    <div class="tiles-grid">
      <div class="metric-tile">
        <div class="metric-label">Total Time</div>
        <div class="metric-val" data-counter-type="time" data-value="${totalMs}">${fmt(totalMs)}</div>
      </div>
      <div class="metric-tile">
        <div class="metric-label">Score</div>
        <div class="metric-val" data-counter-type="score" data-current="${c}" data-total="${n}">${c} <span style="font-size:14px;color:var(--ios-text-sec);font-weight:400">/ ${n}</span></div>
      </div>
      <div class="metric-tile">
        <div class="metric-label">${deltaLabel}</div>
        <div class="metric-val" style="color:${deltaColor}" data-counter-type="pct" data-value="${accuracy}">${deltaVal}</div>
      </div>
    </div>

    <div class="desktop-split-view">
      <div>
        <div class="card-label">Slowest Completed Tasks</div>
        <div class="ios-inset-group">
          ${slowest.map(r => `
            <div class="ios-row">
              <span style="max-width:75%"><b>#${r.t.id}</b> &middot; ${esc(r.t.prompt)}</span>
              <span style="font-family:var(--font-mono);font-size:12px;color:${r.ms > 20000 ? "var(--ios-red)" : "var(--ios-text-sec)"}">${Math.round(r.ms / 1000)}s</span>
            </div>
          `).join("")}
        </div>
      </div>

      <div>
        <div class="card-label">Missed Tasks (${missed.length})</div>
        ${missed.length ? `
          <div class="ios-inset-group">
            ${missed.map(r => `
              <div class="ios-row">
                <span style="max-width:65%"><b>#${r.t.id}</b> &middot; ${esc(r.t.prompt)}</span>
                <code>${esc(r.t.ans)}</code>
              </div>
            `).join("")}
          </div>
        ` : `<div class="fb-box ok">Flawless run! Zero missed tasks.</div>`}
      </div>
    </div>

    <div class="action-row" style="margin-top:20px">
      <button class="btn btn-ghost" onclick="go('home')">‹ Exit to Home</button>
      <div class="action-group">
        ${missed.length ? `<button class="btn btn-pri" onclick="start('drill')">Drill Missed Tasks (${missed.length})</button>` : ""}
        <button class="btn btn-sec" onclick="start('${Q.mode === "drill" ? "exam" : Q.mode}')">${isExam ? "Retake Exam" : "Practice Again"}</button>
      </div>
    </div>
  `;
}

let statsSearchTerm = "";
function stats() {
  const allRows = tasks.map(t => {
    const p = S.p[t.id];
    return {
      t,
      p,
      attempts: p ? p.a : 0,
      correct: p ? p.c : 0,
      acc: p && p.a > 0 ? (p.c / p.a) : 0,
      avgSec: p && p.a > 0 ? (p.ms / p.a / 1000) : 0
    };
  });

  const filtered = allRows.filter(r => {
    if (!statsSearchTerm) return true;
    const q = statsSearchTerm.toLowerCase();
    return r.t.prompt.toLowerCase().includes(q) || r.t.ans.toLowerCase().includes(q) || String(r.t.id).includes(q);
  }).sort((a, b) => (a.acc - b.acc) || (b.avgSec - a.avgSec));

  return `
    ${renderHeader("Task Analytics & Data Control", true)}

    <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;align-items:center;justify-content:space-between">
      <input class="input-field" style="flex:1;min-width:240px" placeholder="Search tasks by prompt or command..." value="${esc(statsSearchTerm)}" oninput="statsSearchTerm=this.value;render()">
      <div class="action-group">
        <button class="btn btn-danger" onclick="activeModal='resetData';render()">Delete / Reset Progress</button>
        <button class="btn btn-sec" onclick="exportData()">Export JSON</button>
        <label class="btn btn-sec" style="cursor:pointer">
          Import JSON
          <input type="file" accept=".json" style="display:none" onchange="importData(event)">
        </label>
      </div>
    </div>

    <div class="card-label">Task Performance Database (${filtered.length} tasks)</div>
    <div class="ios-inset-group">
      ${filtered.length ? filtered.map(r => `
        <div class="ios-row">
          <div style="max-width:70%">
            <div style="font-weight:500">#${r.t.id} &middot; ${esc(r.t.prompt)}</div>
            <div style="font-size:11px;color:var(--ios-text-sec);margin-top:2px">Syntax: <code>${esc(r.t.ans)}</code></div>
          </div>
          <div style="text-align:right">
            <span class="badge-count" style="font-size:12px;color:${r.attempts === 0 ? "var(--ios-text-ter)" : r.acc >= 0.8 ? "var(--ios-green)" : "var(--ios-red)"}">
              ${r.attempts === 0 ? "Untested" : `${Math.round(r.acc * 100)}% (${r.correct}/${r.attempts})`}
            </span>
            ${r.avgSec > 0 ? `<div style="font-size:11px;color:var(--ios-text-ter);margin-top:2px">${r.avgSec.toFixed(1)}s avg</div>` : ""}
          </div>
        </div>
      `).join("") : `<div style="padding:20px;text-align:center;color:var(--ios-text-sec)">No matching tasks found.</div>`}
    </div>
  `;
}

function exportData() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(S, null, 2));
  const a = document.createElement("a");
  a.setAttribute("href", dataStr);
  a.setAttribute("download", `xp_lab_progress_${today()}.json`);
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (typeof trackEvent === 'function') trackEvent('export_data', { task_count: Object.keys(S.p).length });
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (parsed && typeof parsed === "object") {
        S = Object.assign(S, parsed);
        saveLocal();
        if (currentUser && typeof syncWithCloud === 'function') syncWithCloud(currentUser);
        alert("Progress data successfully imported!");
        render();
      }
    } catch (err) {
      alert("Invalid JSON file format.");
    }
  };
  reader.readAsText(file);
}

/* ==========================================================================
   TERMINAL SIMULATOR
   ========================================================================== */
const FS0 = () => ({
  d: new Set(["c:", "c:\\files", "c:\\dirfiles"]),
  f: new Set(["c:\\files\\1.txt", "c:\\files\\2.txt", "c:\\files\\3.txt"])
});
const TL0 = () => [
  "Microsoft Windows XP [Version 5.1.2600]",
  "(C) Copyright 1985-2001 Microsoft Corp.",
  ""
];

let FS = FS0(), CWD = "c:", TL = TL0();
const par = p => p.includes("\\") ? p.slice(0, p.lastIndexOf("\\")) : "c:";
const base = p => p.slice(p.lastIndexOf("\\") + 1);
const show = p => p === "c:" ? "C:\\" : p.toUpperCase();

function P(x) {
  x = x.trim().toLowerCase();
  if (!x) return CWD;
  let r = x === "\\" ? "c:" : x.replace(/\\+$/, "");
  if (!/^c:/.test(r)) r = r[0] === "\\" ? "c:" + r : (CWD + "\\" + r);
  return r;
}

function sim(line) {
  line = line.trim();
  if (/^cd\\/i.test(line)) line = "cd " + line.slice(2);
  const m = line.match(/^(\S+)\s*(.*)$/);
  if (!m) return [];
  const c = m[1].toLowerCase(), a = m[2].trim().split(/\s+/).filter(Boolean), A = a[0] || "";
  const isD = p => FS.d.has(p), isF = p => FS.f.has(p);

  switch (c) {
    case "cls": TL = []; return null;
    case "dir": {
      const p = P(A);
      if (!isD(p)) return ["File Not Found"];
      const ds = [...FS.d].filter(x => x !== "c:" && par(x) === p).map(x => "<DIR>   " + base(x));
      const fs = [...FS.f].filter(x => par(x) === p).map(x => "        " + base(x));
      return [" Directory of " + show(p), "", ...ds, ...fs, "", `   ${fs.length} File(s)`];
    }
    case "md": case "mkdir": {
      const p = P(A);
      if (!A) return ["The syntax of the command is incorrect."];
      if (isD(p)) return ["A subdirectory or file already exists."];
      if (!isD(par(p))) return ["The system cannot find the path specified."];
      FS.d.add(p);
      return [];
    }
    case "rd": case "rmdir": {
      const p = P(A);
      if (!isD(p)) return ["The system cannot find the file specified."];
      if ([...FS.d, ...FS.f].some(x => x !== p && par(x) === p)) return ["The directory is not empty."];
      FS.d.delete(p);
      if (CWD === p) CWD = par(p);
      return [];
    }
    case "del": case "erase": {
      const p = P(A);
      if (!isF(p)) return ["Could Not Find " + show(p)];
      FS.f.delete(p);
      return [];
    }
    case "copy": {
      const s = P(A), d0 = P(a[1] || "");
      if (!isF(s)) return ["The system cannot find the file specified."];
      const d = isD(d0) ? d0 + "\\" + base(s) : d0;
      if (!isD(par(d))) return ["The system cannot find the path specified."];
      FS.f.add(d);
      return ["        1 file(s) copied."];
    }
    case "ren": case "rename": {
      const s = P(A);
      if (!isF(s) || !a[1]) return ["The syntax of the command is incorrect."];
      FS.f.delete(s);
      FS.f.add(par(s) + "\\" + a[1].toLowerCase());
      return [];
    }
    case "cd": {
      if (!A) return [show(CWD)];
      const p = A === ".." ? par(CWD) : P(A);
      if (!isD(p)) return ["The system cannot find the path specified."];
      CWD = p;
      return [];
    }
    case "help":
      return ["Commands: dir, cd, copy, ren, del, md, rd, cls, help"];
    default:
      return [`'${m[1]}' is not recognized as an internal or external command,`, "operable program or batch file."];
  }
}

function runTerm() {
  const i = $("#in");
  if (!i) return;
  const v = i.value;
  TL.push(show(CWD) + ">" + v);
  const r = sim(v);
  if (r) TL.push(...r);
  render();
}

function termView() {
  return `
    ${renderHeader("XP Command Prompt Simulator", true)}
    
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
      <span style="font-size:12px;color:var(--ios-text-sec);display:flex;align-items:center">Quick commands:</span>
      <button class="ios-segment-btn" onclick="$('#in').value='dir';runTerm()">dir</button>
      <button class="ios-segment-btn" onclick="$('#in').value='cd files';runTerm()">cd files</button>
      <button class="ios-segment-btn" onclick="$('#in').value='dir /a';runTerm()">dir /a</button>
      <button class="ios-segment-btn" onclick="$('#in').value='cls';runTerm()">cls</button>
      <button class="ios-segment-btn" onclick="$('#in').value='help';runTerm()">help</button>
    </div>

    <div class="terminal-box" style="min-height:300px">
      <pre style="margin:0;font-family:inherit;white-space:pre-wrap;word-break:break-word">${esc(TL.join("\n"))}</pre>
      <div class="term-line" style="margin-top:8px">
        <span class="term-prompt">${esc(show(CWD))}&gt;</span>
        <input id="in" class="term-input" aria-label="Command" autocomplete="off" autocapitalize="off" spellcheck="false" onkeydown="if(event.key==='Enter')runTerm()">
      </div>
    </div>

    <div class="action-row">
      <button class="btn btn-ghost" onclick="go('home')">‹ Exit to Home</button>
      <button class="btn btn-sec" onclick="FS=FS0();CWD='c:';TL=TL0();render()">Reset Virtual C:\\ Drive</button>
    </div>
  `;
}

/* ==========================================================================
   AUTHENTICATION & ACCOUNT VIEW (CONNECTED TO XP-LAB-9B863)
   ========================================================================== */
function authView() {
  const header = renderHeader("Authentication & Cloud", true);

  if (currentUser) {
    return `
      ${header}
      <div class="page-container" style="max-width:540px;margin:24px auto 48px auto;padding:0 var(--sp-4)">
        <div class="card" style="padding:28px 24px">
          <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px">
            <div class="ios-squircle blue" style="width:48px;height:48px;border-radius:14px">${ic("user", 24)}</div>
            <div style="min-width:0;flex:1">
              <div style="font-size:18px;font-weight:700;color:var(--ios-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(currentUser.displayName || currentUser.email.split('@')[0])}</div>
              <div style="font-size:13px;color:var(--ios-text-sec);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(currentUser.email)}</div>
            </div>
          </div>

          <div class="ios-inset-group" style="margin-bottom:20px">
            <div class="ios-row">
              <span style="color:var(--ios-text-sec)">Firebase Project</span>
              <b>xp-lab-9b863</b>
            </div>
            <div class="ios-row">
              <span style="color:var(--ios-text-sec)">User ID</span>
              <span style="font-family:var(--font-mono);font-size:11px;color:var(--ios-text-sec)">${esc(currentUser.uid.slice(0, 16))}...</span>
            </div>
            <div class="ios-row">
              <span style="color:var(--ios-text-sec)">Cloud Sync Status</span>
              <span class="sync-badge">
                <span class="sync-dot ${syncStatus === 'synced' ? 'synced' : syncStatus === 'syncing' ? 'syncing' : ''}"></span>
                ${syncStatus === 'synced' ? 'Live Cloud Synced' : syncStatus === 'syncing' ? 'Syncing...' : 'Local Cache'}
              </span>
            </div>
            <div class="ios-row">
              <span style="color:var(--ios-text-sec)">Answers Logged</span>
              <b><span style="color:var(--ios-green)">${typeof getAggregateStats === 'function' ? getAggregateStats().totalCorrect : 0} correct</span> &middot; <span style="color:var(--ios-red)">${typeof getAggregateStats === 'function' ? getAggregateStats().totalWrong : 0} wrong</span></b>
            </div>
            <div class="ios-row">
              <span style="color:var(--ios-text-sec)">Total Study Duration</span>
              <b style="font-variant-numeric:tabular-nums">${typeof getAggregateStats === 'function' ? getAggregateStats().totalDurationFmt : "00:00"}</b>
            </div>
            <div class="ios-row">
              <span style="color:var(--ios-text-sec)">Study Streak</span>
              <span class="streak-badge">${ic("flame", 12)} <b>${streak()} days</b></span>
            </div>
            <div class="ios-row">
              <span style="color:var(--ios-text-sec)">Mastered Tasks</span>
              <b>${mastered().length} / ${tasks.length} (${Math.round((mastered().length / tasks.length) * 100)}%)</b>
            </div>
            <div class="ios-row">
              <span style="color:var(--ios-text-sec)">Best Exam Time</span>
              <b>${S.bestMs ? fmt(S.bestMs) : "Not attempted"}</b>
            </div>
          </div>

          <div class="action-row" style="display:flex;justify-content:space-between;align-items:center">
            <button class="btn btn-ghost" onclick="go('home')" title="Exit to Home">‹ Exit to Lab</button>
            <div class="action-group">
              <button class="btn btn-sec" onclick="syncWithCloud(currentUser)">Sync Now</button>
              <button class="btn btn-danger" onclick="handleSignOut()">Sign Out</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  const isGated = Boolean(pendingRevision);
  const pageTitle = authTab === 'signin' ? 'Sign In to XP Lab' : (isGated ? 'Sign Up to Start Revision' : 'Create XP Lab Account');
  const pageDesc = isGated
    ? 'Please create an account or sign in to start your revision. Your streaks, durations, and exam scores will be recorded.'
    : 'YOU CAN DO IT JUST TAKE TIME';

  return `
      ${header}
      <div class="page-container" style="max-width:500px;margin:24px auto 48px auto;padding:0 var(--sp-4)">
        <div class="card" style="padding:28px 24px">
          <div style="text-align:center;margin-bottom:20px">
            <div style="display:flex;justify-content:center;margin-bottom:14px">
              <div class="brand-icon" style="width:48px;height:44px">
                <img src="assets/logo-black.png" alt="XP Lab Logo" class="brand-logo-img brand-logo-light" style="height:38px">
                <img src="assets/logo-white.png" alt="XP Lab Logo" class="brand-logo-img brand-logo-dark" style="height:38px">
              </div>
            </div>
            <h2 style="font-size:20px;font-weight:700;margin:0 0 6px 0;color:var(--ios-text)">${pageTitle}</h2>
            <p style="font-size:13px;color:var(--ios-text-sec);margin:0;line-height:1.4">${pageDesc}</p>
          </div>

          <div class="ios-segmented-control" style="width:100%;margin-bottom:20px;display:flex">
            <button class="ios-segment-btn ${authTab === 'signup' ? 'active' : ''}" style="flex:1" onclick="authTab='signup';authError='';authFieldErrors={};render()">Create Account</button>
            <button class="ios-segment-btn ${authTab === 'signin' ? 'active' : ''}" style="flex:1" onclick="authTab='signin';authError='';authFieldErrors={};render()">Sign In</button>
          </div>

          ${authError ? `<div class="fb-box no" style="font-size:13px;margin-bottom:16px;padding:12px 14px;border-radius:12px;line-height:1.4">${esc(authError)}</div>` : ""}

          <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:18px">
            ${authTab === 'signup' ? `
              <div>
                <label style="display:block;font-size:12px;font-weight:600;color:var(--ios-text-sec);margin-bottom:6px">Username</label>
                <input id="auth-username" type="text" class="input-field ${(typeof authFieldErrors !== 'undefined' && authFieldErrors.username) ? 'input-error' : ''}" placeholder="e.g. admin_student" autocomplete="username" required>
              </div>
            ` : ''}
            <div>
              <label style="display:block;font-size:12px;font-weight:600;color:var(--ios-text-sec);margin-bottom:6px">Email Address</label>
              <input id="auth-email" type="email" class="input-field ${(typeof authFieldErrors !== 'undefined' && authFieldErrors.email) ? 'input-error' : ''}" placeholder="student@example.com" autocomplete="email" required>
            </div>
            <div>
              <label style="display:block;font-size:12px;font-weight:600;color:var(--ios-text-sec);margin-bottom:6px">Password</label>
              <input id="auth-pass" type="password" class="input-field ${(typeof authFieldErrors !== 'undefined' && authFieldErrors.pass) ? 'input-error' : ''}" placeholder="Minimum 6 characters" autocomplete="${authTab === 'signup' ? 'new-password' : 'current-password'}" required oninput="${authTab === 'signup' ? 'handlePasswordInput()' : ''}">
            </div>
            ${authTab === 'signup' ? `
              <div>
                <label style="display:block;font-size:12px;font-weight:600;color:var(--ios-text-sec);margin-bottom:6px">Confirm Password</label>
                <input id="auth-confirm-pass" type="password" class="input-field ${(typeof authFieldErrors !== 'undefined' && authFieldErrors.confirm) ? 'input-error' : ''}" placeholder="Re-enter your password" autocomplete="new-password" required oninput="handlePasswordInput()" onkeydown="if(event.key==='Enter')handleAuthSubmit()">
                <div id="auth-match-error" class="field-error-msg" style="${(typeof authFieldErrors !== 'undefined' && authFieldErrors.confirm) ? 'display:flex' : 'display:none'}">
                  Passwords do not match. Please make sure both passwords are the same.
                </div>
              </div>
            ` : ''}
          </div>

          <div class="action-row" style="display:flex;justify-content:space-between;align-items:center;margin-top:20px">
            <button class="btn btn-ghost" onclick="pendingRevision=null;go('home')" title="Cancel">Cancel</button>
            <button class="btn btn-pri" onclick="handleAuthSubmit()" ${authLoading ? 'disabled' : ''}>
              ${authLoading ? "Processing..." : authTab === 'signin' ? (isGated ? "Sign In & Start" : "Sign In") : (isGated ? "Create Account & Start" : "Create Account")}
            </button>
          </div>
        </div>
      </div>
    `;
}

/* ==========================================================================
   MODAL RENDERER (iOS BOTTOM SHEET ON MOBILE)
   ========================================================================== */
function renderModal() {
  if (!activeModal) return "";

  const grabber = `<div class="ios-grabber"></div>`;

  if (activeModal === "auth") {
    const isGated = Boolean(pendingRevision);
    const modalTitle = authTab === 'signin' ? 'Welcome Back' : (isGated ? 'Sign Up to Start Revision' : 'Create an Account');
    const modalDesc = isGated
      ? 'Please create an account or sign in first to begin your revision, save progress, and track streak records.'
      : 'Sync your progress and mastery records seamlessly across devices.';

    return `
        <div class="modal-backdrop" onclick="if(event.target===this){activeModal=null;pendingRevision=null;render()}">
          <div class="modal-card">
            ${grabber}
            <div style="display:flex;justify-content:center;margin-bottom:14px">
              <div class="brand-icon" style="width:44px;height:40px">
                <img src="assets/logo-black.png" alt="XP Lab Logo" class="brand-logo-img brand-logo-light" style="height:34px">
                <img src="assets/logo-white.png" alt="XP Lab Logo" class="brand-logo-img brand-logo-dark" style="height:34px">
              </div>
            </div>
            <div class="ios-segmented-control" style="width:100%;margin-bottom:16px;display:flex">
              <button class="ios-segment-btn ${authTab === 'signup' ? 'active' : ''}" style="flex:1" onclick="authTab='signup';authError='';authFieldErrors={};render()">Create Account</button>
              <button class="ios-segment-btn ${authTab === 'signin' ? 'active' : ''}" style="flex:1" onclick="authTab='signin';authError='';authFieldErrors={};render()">Sign In</button>
            </div>

            <div class="modal-title">${modalTitle}</div>
            <div class="modal-desc">${modalDesc}</div>

            ${authError ? `<div class="fb-box no" style="font-size:12px;margin-bottom:12px">${esc(authError)}</div>` : ""}

            <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:14px">
              ${authTab === 'signup' ? `
                <div>
                  <label style="display:block;font-size:11px;font-weight:600;color:var(--ios-text-sec);margin-bottom:4px">Username</label>
                  <input id="auth-username" type="text" class="input-field ${(typeof authFieldErrors !== 'undefined' && authFieldErrors.username) ? 'input-error' : ''}" placeholder="Choose a username" autocomplete="username" required>
                </div>
              ` : ''}
              <div>
                <label style="display:block;font-size:11px;font-weight:600;color:var(--ios-text-sec);margin-bottom:4px">Email Address</label>
                <input id="auth-email" type="email" class="input-field ${(typeof authFieldErrors !== 'undefined' && authFieldErrors.email) ? 'input-error' : ''}" placeholder="Email address" autocomplete="email" required>
              </div>
              <div>
                <label style="display:block;font-size:11px;font-weight:600;color:var(--ios-text-sec);margin-bottom:4px">Password</label>
                <input id="auth-pass" type="password" class="input-field ${(typeof authFieldErrors !== 'undefined' && authFieldErrors.pass) ? 'input-error' : ''}" placeholder="Password (minimum 6 characters)" autocomplete="${authTab === 'signup' ? 'new-password' : 'current-password'}" required oninput="${authTab === 'signup' ? 'handlePasswordInput()' : ''}">
              </div>
              ${authTab === 'signup' ? `
                <div>
                  <label style="display:block;font-size:11px;font-weight:600;color:var(--ios-text-sec);margin-bottom:4px">Confirm Password</label>
                  <input id="auth-confirm-pass" type="password" class="input-field ${(typeof authFieldErrors !== 'undefined' && authFieldErrors.confirm) ? 'input-error' : ''}" placeholder="Confirm password" autocomplete="new-password" required oninput="handlePasswordInput()" onkeydown="if(event.key==='Enter')handleAuthSubmit()">
                  <div id="auth-match-error" class="field-error-msg" style="${(typeof authFieldErrors !== 'undefined' && authFieldErrors.confirm) ? 'display:flex' : 'display:none'}">
                    Passwords do not match. Please make sure both passwords are the same.
                  </div>
                </div>
              ` : ''}
            </div>

            <button class="btn btn-pri" style="width:100%" onclick="handleAuthSubmit()" ${authLoading ? 'disabled' : ''}>
              ${authLoading ? "Processing..." : authTab === 'signin' ? (isGated ? "Sign In & Start" : "Sign In") : (isGated ? "Create Account & Start" : "Create Account")}
            </button>

            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;font-size:13px">
              <button class="btn btn-ghost btn-sm" onclick="activeModal=null;pendingRevision=null;render()">‹ Cancel</button>
              ${authTab === 'signin' ? `<button class="btn btn-ghost btn-sm" onclick="handlePasswordReset()">Forgot password?</button>` : `<span></span>`}
            </div>
          </div>
        </div>
      `;
  }

  if (activeModal === "account") {
    return `
      <div class="modal-backdrop" onclick="if(event.target===this){activeModal=null;render()}">
        <div class="modal-card">
          ${grabber}
          <div class="modal-title">Account & Cloud Sync</div>
          <div class="modal-desc">Manage your profile, cloud records, and telemetry settings.</div>

          <div class="ios-inset-group" style="margin-bottom:14px">
            <div class="ios-row">
              <span style="color:var(--ios-text-sec)">User Account</span>
              <b>${currentUser ? esc(currentUser.email) : "Guest (Local Only)"}</b>
            </div>
            <div class="ios-row">
              <span style="color:var(--ios-text-sec)">Storage Status</span>
              <span class="sync-badge"><span class="sync-dot ${syncStatus === 'synced' ? 'synced' : syncStatus === 'syncing' ? 'syncing' : ''}"></span> ${syncStatus}</span>
            </div>
            <div class="ios-row">
              <span style="color:var(--ios-text-sec)">Usage Telemetry</span>
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
                <input type="checkbox" ${!S.analyticsOptOut ? "checked" : ""} onchange="S.analyticsOptOut=!this.checked;saveLocal();render()">
                <span style="font-size:13px">${!S.analyticsOptOut ? "Enabled" : "Disabled"}</span>
              </label>
            </div>
          </div>

          <button class="btn btn-ghost btn-sm" data-tour="tour-btn" onclick="activeModal=null;render();setTimeout(()=>startTour(),300)" style="width:100%;justify-content:center;color:var(--ios-blue);font-size:13px;display:inline-flex;align-items:center;gap:6px;margin-bottom:12px">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Take a Tour
          </button>

          <div class="action-row">
            <button class="btn btn-ghost" onclick="activeModal=null;render()">‹ Close</button>
            ${currentUser
        ? `<div class="action-group"><button class="btn btn-sec" onclick="syncWithCloud(currentUser)">Sync Now</button><button class="btn btn-danger" onclick="handleSignOut()">Sign Out</button></div>`
        : `<button class="btn btn-pri" onclick="activeModal='auth';render()">Sign In / Register</button>`
      }
          </div>
        </div>
      </div>
    `;
  }

  if (activeModal === "confirmExit") {
    return `
      <div class="modal-backdrop" onclick="if(event.target===this){activeModal=null;render()}">
        <div class="modal-card" style="max-width:400px">
          ${grabber}
          <div class="modal-title">Leave Active Session?</div>
          <div class="modal-desc">Your uncompleted task answers for this session will not be finalized.</div>
          <div class="action-row" style="justify-content:space-between">
            <button class="btn btn-danger" onclick="activeModal=null;go('home')">Quit to Home</button>
            <button class="btn btn-sec" onclick="activeModal=null;render()">Continue Practice</button>
          </div>
        </div>
      </div>
    `;
  }

  if (activeModal === "resetData") {
    return `
      <div class="modal-backdrop" onclick="if(event.target===this){activeModal=null;render()}">
        <div class="modal-card" style="max-width:400px">
          ${grabber}
          <div class="modal-title">Reset All Progress?</div>
          <div class="modal-desc">This will erase all locally recorded question attempts, accuracy history, and exam personal records. This action cannot be undone unless you have an exported JSON backup.</div>
          <div class="action-row" style="justify-content:space-between">
            <button class="btn btn-sec" onclick="activeModal=null;render()">‹ Cancel</button>
            <button class="btn btn-danger" onclick="S.p={};S.days=[];S.bestMs=null;S.last=null;saveLocal();if(currentUser && typeof syncWithCloud==='function')syncWithCloud(currentUser);activeModal=null;render()">Delete All Data</button>
          </div>
        </div>
      </div>
    `;
  }

  return "";
}

/* ==========================================================================
   PRODUCT TOUR ENGINE
   ========================================================================== */
const TOUR_STEPS = [
  {
    target: '[data-tour="metrics"]',
    title: 'Performance Metrics',
    body: 'Track your progress at a glance — mastered tasks, accuracy breakdown, total study time, best exam record, and weak areas that need extra drilling.',
    position: 'right'
  },
  {
    target: '[data-tour="filter"]',
    title: 'Category Filter',
    body: 'Focus your practice! Filter tasks by category — All topics, Run commands, CMD prompt tasks, or GUI operations. The count badge shows how many tasks are in each group.',
    position: 'bottom'
  },
  {
    target: '[data-tour="flash"]',
    title: 'Flashcards Mode',
    body: 'Classic recall training. You\'ll see a task prompt, think of the answer, then reveal it and self-grade whether you got it right. Great for memorizing commands and procedures.',
    position: 'bottom'
  },
  {
    target: '[data-tour="type"]',
    title: 'Type Command Mode',
    body: 'Hands-on typing practice. You\'ll be shown a task and must type the exact command. The system checks your syntax automatically — perfect for building muscle memory.',
    position: 'bottom'
  },
  {
    target: '[data-tour="exam"]',
    title: 'Mock Exam Mode',
    body: 'Simulate the real test! All tasks are presented in random order with a running timer. Try to beat your personal best time and achieve 100% accuracy.',
    position: 'bottom'
  },
  {
    target: '[data-tour="term"]',
    title: 'Terminal Simulator',
    body: 'A fully interactive fake Windows XP command prompt. Practice navigating directories, running commands, and exploring a virtual C:\\ drive — just like the real thing.',
    position: 'bottom'
  }
];

let tourStep = -1;
let tourActive = false;

function startTour() {
  tourStep = 0;
  tourActive = true;
  showTourStep();
}

function endTour() {
  tourActive = false;
  tourStep = -1;
  // Remove existing tour overlay
  const existing = document.querySelector('.tour-overlay');
  if (existing) existing.remove();
  // Mark as seen
  try { localStorage.setItem('xpl_tour_seen', '1'); } catch(e) {}
}

function showTourStep() {
  // Remove previous overlay
  const prev = document.querySelector('.tour-overlay');
  if (prev) prev.remove();

  if (tourStep < 0 || tourStep >= TOUR_STEPS.length) {
    endTour();
    return;
  }

  const step = TOUR_STEPS[tourStep];
  const el = document.querySelector(step.target);
  if (!el) {
    // Skip to next if element not found
    tourStep++;
    if (tourStep < TOUR_STEPS.length) showTourStep();
    else endTour();
    return;
  }

  // Scroll element into view
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Wait for scroll to settle
  setTimeout(() => {
    const rect = el.getBoundingClientRect();
    const pad = 8;

    // Create overlay container
    const overlay = document.createElement('div');
    overlay.className = 'tour-overlay';
    overlay.innerHTML = `
      <svg class="tour-spotlight-svg" width="100%" height="100%">
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white"/>
            <rect x="${rect.left - pad}" y="${rect.top - pad}" 
                  width="${rect.width + pad * 2}" height="${rect.height + pad * 2}" 
                  rx="14" fill="black"/>
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#tour-mask)"/>
      </svg>
      <div class="tour-highlight" style="
        top:${rect.top - pad}px;left:${rect.left - pad}px;
        width:${rect.width + pad * 2}px;height:${rect.height + pad * 2}px;
      "></div>
      <div class="tour-tooltip tour-pos-${step.position}" id="tour-tooltip">
        <div class="tour-tooltip-arrow"></div>
        <div class="tour-step-indicator">${tourStep + 1} of ${TOUR_STEPS.length}</div>
        <div class="tour-tooltip-title">${step.title}</div>
        <div class="tour-tooltip-body">${step.body}</div>
        <div class="tour-tooltip-actions">
          <button class="tour-btn-skip" onclick="endTour()">Skip Tour</button>
          <div style="display:flex;gap:8px">
            ${tourStep > 0 ? '<button class="tour-btn-nav" onclick="tourPrev()">Back</button>' : ''}
            <button class="tour-btn-next" onclick="tourNext()">
              ${tourStep === TOUR_STEPS.length - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    `;

    // Clicking backdrop ends tour
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.closest('.tour-spotlight-svg')) {
        endTour();
      }
    });

    document.body.appendChild(overlay);

    // Position tooltip relative to target
    positionTooltip(rect, step.position);
  }, 350);
}

function positionTooltip(rect, position) {
  const tooltip = document.getElementById('tour-tooltip');
  if (!tooltip) return;
  const pad = 8;
  const gap = 14;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top, left;
  const ttRect = tooltip.getBoundingClientRect();

  switch (position) {
    case 'bottom':
      top = rect.bottom + pad + gap;
      left = rect.left + rect.width / 2 - ttRect.width / 2;
      break;
    case 'top':
      top = rect.top - pad - gap - ttRect.height;
      left = rect.left + rect.width / 2 - ttRect.width / 2;
      break;
    case 'right':
      top = rect.top + rect.height / 2 - ttRect.height / 2;
      left = rect.right + pad + gap;
      break;
    case 'left':
      top = rect.top + rect.height / 2 - ttRect.height / 2;
      left = rect.left - pad - gap - ttRect.width;
      break;
  }

  // Clamp to viewport
  left = Math.max(12, Math.min(left, vw - ttRect.width - 12));
  top = Math.max(12, Math.min(top, vh - ttRect.height - 12));

  // On mobile, always position below if not enough space to the side
  if (vw < 640 && (position === 'right' || position === 'left')) {
    top = rect.bottom + pad + gap;
    left = Math.max(12, Math.min(rect.left, vw - ttRect.width - 12));
  }

  tooltip.style.top = top + 'px';
  tooltip.style.left = left + 'px';
}

function tourNext() {
  tourStep++;
  if (tourStep >= TOUR_STEPS.length) {
    endTour();
  } else {
    showTourStep();
  }
}

function tourPrev() {
  tourStep = Math.max(0, tourStep - 1);
  showTourStep();
}

// Handle window resize during tour
window.addEventListener('resize', () => {
  if (tourActive) showTourStep();
});

/* ==========================================================================
   RENDER DISPATCHER
   ========================================================================== */
function render() {
  const viewFn = { home, q: ques, done, stats, term: termView, auth: authView }[V] || home;
  const appEl = $("#app");
  if (!appEl) return;
  appEl.innerHTML = viewFn() + renderModal();

  // Focus management
  const inEl = $("#in");
  if (inEl && !activeModal && !Q?.paused) {
    inEl.focus();
  } else if (V === "q" && !activeModal) {
    const nx = $("#nx");
    if (nx) nx.focus();
  }

  // Phase 2 & 3: Results roll-up counter & confetti burst
  if (V === "done" && !activeModal) {
    animateResultsCounters();
    if (Q && Q.res && Q.res.length > 0) {
      const c = Q.res.filter(r => r.ok).length;
      if (c === Q.res.length) {
        setTimeout(() => triggerConfetti(), 150);
      }
    }
  }

  // Trigger tour ONLY when user has successfully signed up
  try {
    if (sessionStorage.getItem('xpl_trigger_tour') && V === 'home' && !activeModal) {
      sessionStorage.removeItem('xpl_trigger_tour');
      setTimeout(() => {
        if (typeof startTour === 'function' && !tourActive) {
          startTour();
        }
      }, 500);
    }
  } catch (e) {}
}

/* ==========================================================================
   RESULTS ANIMATIONS & CONFETTI (Phase 2 & 3)
   ========================================================================== */
function triggerConfetti() {
  const existing = document.querySelectorAll('.confetti-particle');
  existing.forEach(el => el.remove());

  const colors = ['#007aff', '#34c759', '#ff9500', '#af52de', '#ff2d55', '#5856d6', '#ffcc00'];
  const count = 40;
  const frag = document.createDocumentFragment();

  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-particle';
    const color = colors[Math.floor(Math.random() * colors.length)];
    const left = Math.random() * 100;
    const size = Math.floor(Math.random() * 6) + 6;
    const duration = (Math.random() * 1.5 + 2.0).toFixed(2);
    const delay = (Math.random() * 0.4).toFixed(2);

    p.style.cssText = `
      left: ${left}vw;
      top: -20px;
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      animation-duration: ${duration}s;
      animation-delay: ${delay}s;
    `;
    frag.appendChild(p);
  }

  document.body.appendChild(frag);
  setTimeout(() => {
    document.querySelectorAll('.confetti-particle').forEach(el => el.remove());
  }, 4000);
}

function animateResultsCounters() {
  const timeEl = document.querySelector('[data-counter-type="time"]');
  const scoreEl = document.querySelector('[data-counter-type="score"]');
  const pctEl = document.querySelector('[data-counter-type="pct"]');

  if (!timeEl && !scoreEl && !pctEl) return;

  const duration = 850;
  const startTime = performance.now();

  const totalMs = timeEl ? parseInt(timeEl.getAttribute('data-value') || '0', 10) : 0;
  const currentScore = scoreEl ? parseInt(scoreEl.getAttribute('data-current') || '0', 10) : 0;
  const totalScore = scoreEl ? parseInt(scoreEl.getAttribute('data-total') || '0', 10) : 0;
  const pctVal = pctEl ? parseInt(pctEl.getAttribute('data-value') || '0', 10) : 0;

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / duration);
    const eased = easeOutCubic(progress);

    if (timeEl) {
      const currentMs = Math.round(totalMs * eased);
      timeEl.textContent = fmt(currentMs);
    }

    if (scoreEl) {
      const scoreVal = Math.round(currentScore * eased);
      scoreEl.innerHTML = `${scoreVal} <span style="font-size:14px;color:var(--ios-text-sec);font-weight:400">/ ${totalScore}</span>`;
    }

    if (pctEl && pctEl.getAttribute('data-value')) {
      const p = Math.round(pctVal * eased);
      pctEl.textContent = `${p}%`;
    }

    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}

// Initial render call
render();
