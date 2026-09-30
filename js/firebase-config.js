/* ==========================================================================
   XP LAB TRAINER - FIREBASE AUTH, FIRESTORE & ANALYTICS INTEGRATION
   ========================================================================== */

let fbApp = null, fbAuth = null, fbDb = null, fbAnalytics = null;
let currentUser = null;
let syncStatus = 'guest'; // guest | syncing | synced | offline

// Production Firebase config for xp-lab-9b863
const defaultFirebaseConfig = {
  apiKey: "AIzaSyD8O9-nzkiBzJUm9RLzSaCGSpdLP3NmBFs",
  authDomain: "xp-lab-9b863.firebaseapp.com",
  projectId: "xp-lab-9b863",
  storageBucket: "xp-lab-9b863.firebasestorage.app",
  messagingSenderId: "905365452600",
  appId: "1:905365452600:web:0c36315a473f3e6ca973cd",
  measurementId: "G-35Z52MQR2W"
};

function initFirebase() {
  if (!window.__FB) return;
  // Always use production Firebase config for xp-lab-9b863
  const config = defaultFirebaseConfig;
  try {
    fbApp = window.__FB.initializeApp(config);
    fbAuth = window.__FB.getAuth(fbApp);
    fbDb = window.__FB.getFirestore(fbApp);

    // Google Analytics 4
    window.__FB.isAnalyticsSupported().then(supported => {
      if (supported && typeof S !== 'undefined' && !S.analyticsOptOut) {
        fbAnalytics = window.__FB.getAnalytics(fbApp);
      }
    }).catch(() => {});

    // Listen for Authentication state changes
    window.__FB.onAuthStateChanged(fbAuth, async user => {
      currentUser = user;
      if (user) {
        syncStatus = 'syncing';
        if (typeof render === 'function') render();
        await syncWithCloud(user);
      } else {
        syncStatus = 'guest';
        // When signed out, clear local session memory and storage so guest sees 0/blank
        if (typeof S !== 'undefined') {
          S.p = {};
          S.days = [];
          S.bestMs = null;
          S.last = null;
          try {
            localStorage.removeItem("xpl_v2");
            localStorage.removeItem("xpl");
          } catch (e) {}
        }
        if (typeof render === 'function') render();
      }
    });
  } catch (err) {
    console.warn("Firebase running in local-guest mode:", err.message);
    syncStatus = 'offline';
  }
}

// Listen for SDK ready event or initialize immediately if already ready
if (typeof window !== 'undefined' && window.__FB) {
  initFirebase();
} else if (typeof window !== 'undefined') {
  window.addEventListener('firebase-sdk-ready', initFirebase);
}

// GA4 Event Dispatcher
function trackEvent(name, params = {}) {
  if (typeof S !== 'undefined' && S.analyticsOptOut) return;
  if (!fbAnalytics || !window.__FB) return;
  try {
    window.__FB.logEvent(fbAnalytics, name, params);
  } catch (e) {}
}

// Helper: Calculate aggregate user performance metrics
function getAggregateStats() {
  let totalCorrect = 0, totalAttempts = 0, totalDurationMs = 0;
  if (typeof S !== 'undefined' && S && S.p) {
    for (const rec of Object.values(S.p)) {
      totalAttempts += (rec.a || 0);
      totalCorrect += (rec.c || 0);
      totalDurationMs += (rec.ms || 0);
    }
  }
  const totalWrong = Math.max(0, totalAttempts - totalCorrect);
  const accuracyPct = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;
  const currentStreak = typeof streak === 'function' ? streak() : (S && S.days ? S.days.length : 0);
  const masteredCount = typeof mastered === 'function' ? mastered().length : 0;
  const bestStreakDays = Math.max(currentStreak, (S && S.bestStreak) || currentStreak);

  return {
    totalCorrect,
    totalWrong,
    totalAttempts,
    accuracyPct,
    totalDurationMs,
    totalDurationFmt: typeof fmt === 'function' ? fmt(totalDurationMs) : (Math.round(totalDurationMs / 1000) + 's'),
    currentStreakDays: currentStreak,
    bestStreakDays,
    bestExamTimeMs: (S && S.bestMs) || null,
    bestExamTimeFmt: (S && S.bestMs && typeof fmt === 'function') ? fmt(S.bestMs) : null,
    tasksMastered: masteredCount
  };
}

// Firestore Two-Way Sync (User Profile, Streak, Duration, Correct, Wrong)
async function syncWithCloud(user) {
  if (!fbDb || !user || !window.__FB) return;
  try {
    const userRef = window.__FB.doc(fbDb, "users", user.uid);
    const snap = await window.__FB.getDoc(userRef);

    if (snap.exists()) {
      const cloudData = snap.data();
      // Merge local and cloud progress (keep highest attempts/accuracy)
      const mergedP = { ...(cloudData.progress || {}) };
      for (const [id, localRec] of Object.entries(S.p)) {
        if (!mergedP[id] || (localRec.a > mergedP[id].a)) {
          mergedP[id] = localRec;
        }
      }
      S.p = mergedP;
      S.days = Array.from(new Set([...(cloudData.streakDays || []), ...(S.days || [])]));
      if (cloudData.bestMs && (!S.bestMs || cloudData.bestMs < S.bestMs)) {
        S.bestMs = cloudData.bestMs;
      }
      if (cloudData.stats && cloudData.stats.bestStreakDays && (!S.bestStreak || cloudData.stats.bestStreakDays > S.bestStreak)) {
        S.bestStreak = cloudData.stats.bestStreakDays;
      }
      saveLocal();
    }

    const stats = getAggregateStats();

    // Persist user record, duration, streak, correct and wrong counts
    await window.__FB.setDoc(userRef, {
      profile: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email.split("@")[0],
        lastActiveAt: window.__FB.serverTimestamp()
      },
      stats: {
        totalCorrect: stats.totalCorrect,
        totalWrong: stats.totalWrong,
        totalAttempts: stats.totalAttempts,
        accuracyPct: stats.accuracyPct,
        totalDurationMs: stats.totalDurationMs,
        totalDurationFmt: stats.totalDurationFmt,
        currentStreakDays: stats.currentStreakDays,
        bestStreakDays: stats.bestStreakDays,
        bestExamTimeMs: stats.bestExamTimeMs,
        bestExamTimeFmt: stats.bestExamTimeFmt,
        tasksMastered: stats.tasksMastered
      },
      streakDays: S.days,
      bestMs: S.bestMs,
      progress: S.p
    }, { merge: true });

    syncStatus = 'synced';
  } catch (err) {
    console.warn("Firestore sync warning (falling back to local cache):", err);
    syncStatus = 'offline';
  }
  if (typeof render === 'function') render();
}

// Record completed study / mock exam session to Firestore
async function recordSessionCloud(sessionData) {
  if (!fbDb || !currentUser || !window.__FB) return;
  try {
    const userRef = window.__FB.doc(fbDb, "users", currentUser.uid);
    const stats = getAggregateStats();

    const sessionPayload = {
      userId: currentUser.uid,
      userEmail: currentUser.email,
      mode: sessionData.mode || "exam",
      durationMs: sessionData.durationMs || 0,
      durationFmt: sessionData.durationFmt || (typeof fmt === 'function' ? fmt(sessionData.durationMs || 0) : "00:00"),
      correctCount: sessionData.correctCount || 0,
      wrongCount: sessionData.wrongCount || 0,
      totalTasks: sessionData.totalTasks || 0,
      accuracyPct: sessionData.accuracyPct || 0,
      currentStreakDays: stats.currentStreakDays,
      bestExamTimeMs: stats.bestExamTimeMs,
      completedAt: window.__FB.serverTimestamp() || new Date().toISOString()
    };

    // Add session to users/{uid}/sessions subcollection
    const sessionsCol = window.__FB.collection(fbDb, "users", currentUser.uid, "sessions");
    await window.__FB.addDoc(sessionsCol, sessionPayload);

    // Update parent user document with latest statistics
    await window.__FB.setDoc(userRef, {
      stats: {
        totalCorrect: stats.totalCorrect,
        totalWrong: stats.totalWrong,
        totalAttempts: stats.totalAttempts,
        accuracyPct: stats.accuracyPct,
        totalDurationMs: stats.totalDurationMs,
        totalDurationFmt: stats.totalDurationFmt,
        currentStreakDays: stats.currentStreakDays,
        bestStreakDays: stats.bestStreakDays,
        bestExamTimeMs: stats.bestExamTimeMs,
        bestExamTimeFmt: stats.bestExamTimeFmt,
        tasksMastered: stats.tasksMastered,
        lastSessionDurationMs: sessionData.durationMs || 0,
        lastSessionDurationFmt: sessionData.durationFmt || "00:00",
        lastSessionMode: sessionData.mode || "exam",
        lastSessionCorrect: sessionData.correctCount || 0,
        lastSessionWrong: sessionData.wrongCount || 0
      },
      lastActiveAt: window.__FB.serverTimestamp() || new Date().toISOString(),
      streakDays: S.days,
      bestMs: S.bestMs
    }, { merge: true });

    syncStatus = 'synced';
  } catch (err) {
    console.warn("Session recording to Firestore warning:", err);
    syncStatus = 'offline';
  }
  if (typeof render === 'function') render();
}

// Record individual task result to Firestore
async function recordTaskCloud(task, ok, ms) {
  if (!fbDb || !currentUser || !window.__FB) return;
  try {
    const userRef = window.__FB.doc(fbDb, "users", currentUser.uid);
    const stats = getAggregateStats();
    await window.__FB.setDoc(userRef, {
      stats: {
        totalCorrect: stats.totalCorrect,
        totalWrong: stats.totalWrong,
        totalAttempts: stats.totalAttempts,
        accuracyPct: stats.accuracyPct,
        totalDurationMs: stats.totalDurationMs,
        totalDurationFmt: stats.totalDurationFmt,
        currentStreakDays: stats.currentStreakDays,
        bestStreakDays: stats.bestStreakDays,
        bestExamTimeMs: stats.bestExamTimeMs,
        bestExamTimeFmt: stats.bestExamTimeFmt,
        tasksMastered: stats.tasksMastered
      },
      streakDays: S.days,
      bestMs: S.bestMs,
      progress: {
        [task.id]: S.p[task.id]
      }
    }, { merge: true });
    syncStatus = 'synced';
  } catch (e) {
    syncStatus = 'offline';
  }
}

// Auth Action Handlers
let authTab = "signin"; // signin | signup
let authError = "";
let authLoading = false;
let authFieldErrors = {}; // { username: bool, email: bool, pass: bool, confirm: bool }

function handlePasswordInput() {
  const p = $("#auth-pass");
  const cp = $("#auth-confirm-pass");
  const errBox = $("#auth-match-error");
  if (!p || !cp) return;

  if (cp.value.length > 0 && p.value !== cp.value) {
    p.classList.add("input-error");
    cp.classList.add("input-error");
    if (errBox) {
      errBox.style.display = "flex";
      errBox.textContent = "Passwords do not match. Please make sure both passwords are the same.";
    }
  } else {
    p.classList.remove("input-error");
    cp.classList.remove("input-error");
    if (errBox) {
      errBox.style.display = "none";
    }
  }
}

async function handleAuthSubmit() {
  const email = $("#auth-email")?.value.trim() || "";
  const password = $("#auth-pass")?.value || "";
  const username = $("#auth-username")?.value.trim() || "";
  const confirmPass = $("#auth-confirm-pass")?.value || "";

  authFieldErrors = {};

  if (authTab === "signup") {
    if (!username) {
      authFieldErrors.username = true;
      authError = "Please enter your username.";
      render();
      $("#auth-username")?.focus();
      return;
    }
    if (!email) {
      authFieldErrors.email = true;
      authError = "Please enter your email address.";
      render();
      $("#auth-email")?.focus();
      return;
    }
    if (!password) {
      authFieldErrors.pass = true;
      authError = "Please enter a password.";
      render();
      $("#auth-pass")?.focus();
      return;
    }
    if (password.length < 6) {
      authFieldErrors.pass = true;
      authError = "Password must be at least 6 characters.";
      render();
      $("#auth-pass")?.focus();
      return;
    }
    if (password !== confirmPass) {
      authFieldErrors.pass = true;
      authFieldErrors.confirm = true;
      authError = "Passwords do not match. Please make sure both passwords are the same.";
      render();
      $("#auth-confirm-pass")?.focus();
      return;
    }
  } else {
    if (!email || !password) {
      authError = "Please enter both email and password.";
      render();
      return;
    }
  }

  authLoading = true;
  authError = "";
  authFieldErrors = {};
  render();

  try {
    if (!window.__FB || !fbAuth) throw new Error("Firebase SDK is initializing or offline.");
    if (authTab === "signin") {
      await window.__FB.signInWithEmailAndPassword(fbAuth, email, password);
      trackEvent('login', { method: 'password' });
    } else {
      const userCred = await window.__FB.createUserWithEmailAndPassword(fbAuth, email, password);
      if (username && window.__FB.updateProfile) {
        try {
          await window.__FB.updateProfile(userCred.user, { displayName: username });
        } catch (e) {}
      }
      trackEvent('sign_up', { method: 'password' });
    }
    activeModal = null;
    if (typeof pendingRevision !== 'undefined' && pendingRevision) {
      const pr = pendingRevision;
      pendingRevision = null;
      if (pr.action === 'start' && typeof start === 'function') {
        start(pr.mode);
        return;
      } else if (pr.action === 'go' && typeof go === 'function') {
        go(pr.view);
        return;
      }
    }
    if (typeof V !== 'undefined' && V === 'auth' && typeof go === 'function') {
      go('home');
    }
  } catch (err) {
    authError = err.message.replace("Firebase: ", "");
  } finally {
    authLoading = false;
    render();
  }
}

async function handleGoogleSignIn() {
  if (!window.__FB || !fbAuth) {
    authError = "Authentication service unavailable.";
    render();
    return;
  }
  try {
    authLoading = true;
    authError = "";
    render();
    const provider = new window.__FB.GoogleAuthProvider();
    await window.__FB.signInWithPopup(fbAuth, provider);
    trackEvent('login', { method: 'google' });
    activeModal = null;
    if (typeof V !== 'undefined' && V === 'auth' && typeof go === 'function') {
      go('home');
    }
  } catch (err) {
    let msg = err.message.replace("Firebase: ", "");
    if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
      msg = "Google Sign-In popup requires HTTP/HTTPS hosting (e.g. npx serve or localhost). For local file preview, please sign in with Email and Password.";
    }
    authError = msg;
  } finally {
    authLoading = false;
    render();
  }
}

async function handlePasswordReset() {
  const email = prompt("Enter your email address to receive password reset instructions:");
  if (!email) return;
  try {
    await window.__FB.sendPasswordResetEmail(fbAuth, email.trim());
    alert("Password reset email sent! Check your inbox.");
  } catch (err) {
    alert("Failed to send reset email: " + err.message);
  }
}

async function handleSignOut() {
  if (!window.__FB || !fbAuth) return;
  await window.__FB.signOut(fbAuth);
  currentUser = null;
  syncStatus = 'guest';
  activeModal = null;

  // Wipe previous user's practice data from local memory & browser storage
  if (typeof S !== 'undefined') {
    S.p = {};
    S.days = [];
    S.bestMs = null;
    S.last = null;
    try {
      localStorage.removeItem("xpl_v2");
      localStorage.removeItem("xpl");
    } catch (e) {}
  }

  if (typeof go === 'function') {
    go('home');
  } else if (typeof render === 'function') {
    render();
  }
}
