/* ======================================================================
   app.js — Algorithm a Day
   Daily unlock, weekly quizzes, streaks, Firebase sync, export/import.
   ====================================================================== */

/* ──────────── 1. FIREBASE CONFIG ──────────── */
/* Paste the firebaseConfig object Firebase shows you here (see README).
   If left blank, the app runs in LOCAL-ONLY mode and skips cloud sync. */
const firebaseConfig = {
  apiKey: "AIzaSyBcN5ojg4bIyrFsgumR4Ttj1ilv__AF2Fw",
  authDomain: "algodaily-db5ef.firebaseapp.com",
  projectId: "algodaily-db5ef",
  storageBucket: "algodaily-db5ef.firebasestorage.app",
  messagingSenderId: "1002786497468",
  appId: "1:1002786497468:web:aea3327b49c7f57c4d41b9",
  measurementId: "G-QZK7X7JJVE"
};

const CLOUD_ENABLED = firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("YOUR_");

let fbAuth = null;
let fbDb = null;
if (CLOUD_ENABLED) {
  // initialize compat SDKs (loaded via <script> tags in index.html)
  firebase.initializeApp(firebaseConfig);
  fbAuth = firebase.auth();
  fbDb = firebase.firestore();
}

/* ──────────── 2. STATE ──────────── */
const STORE_KEY = "algo-daily-v1";

const defaultState = () => ({
  currentDay: 0,            // how many lessons unlocked so far
  completed: [],            // ordered list of algorithm ids completed
  quizScores: {},           // {weekNumber: {correct, total}}
  streak: 0,
  lastUnlockDate: null,     // YYYY-MM-DD of most recent unlock
  startDate: null,          // first unlock date
  viewingHistoryIdx: null,  // if reading a past lesson
});

let state = loadLocalState();
let curriculum = [];
let user = null;
let cloudStatus = "local"; // local | synced | syncing | error

/* ──────────── 3. UTILITIES ──────────── */
const todayStr = () => new Date().toISOString().slice(0, 10);
const yesterdayStr = () => {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
};
const daysBetween = (a, b) => {
  if (!a || !b) return 0;
  return Math.round((new Date(b) - new Date(a)) / 86400000);
};

function loadLocalState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return { ...defaultState(), ...JSON.parse(raw) };
  } catch (e) {}
  return defaultState();
}

function saveLocalState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

/* ──────────── 4. CLOUD SYNC ──────────── */
function setCloudStatus(s, msg) {
  cloudStatus = s;
  const el = document.getElementById("cloud-status");
  const txt = document.getElementById("cloud-text");
  el.className = "cloud-status " + s;
  txt.textContent = msg || ({ local: "Local only", synced: "Synced", syncing: "Syncing…", error: "Sync error" }[s] || s);
}

async function loadCloudState() {
  if (!CLOUD_ENABLED || !user) return;
  setCloudStatus("syncing");
  try {
    const doc = await fbDb.collection("progress").doc(user.uid).get();
    if (doc.exists) {
      const cloud = doc.data().data;
      if (cloud && (cloud.completed?.length || 0) >= (state.completed?.length || 0)) {
        state = { ...defaultState(), ...cloud };
        saveLocalState();
      } else {
        // local is ahead — push it up
        await pushCloudState();
      }
    } else {
      // first-time: push current local state up
      await pushCloudState();
    }
    setCloudStatus("synced", `Synced · ${user.email}`);
  } catch (e) {
    console.error("cloud load", e);
    setCloudStatus("error", "Sync failed");
  }
}

async function pushCloudState() {
  if (!CLOUD_ENABLED || !user) return;
  try {
    await fbDb.collection("progress").doc(user.uid).set({
      data: state,
      updated_at: new Date().toISOString(),
    });
    setCloudStatus("synced", `Synced · ${user.email}`);
  } catch (e) {
    console.error("cloud push", e);
    setCloudStatus("error", "Sync failed");
  }
}

/* debounced sync */
let syncTimer = null;
function syncSoon() {
  saveLocalState();
  if (!CLOUD_ENABLED || !user) return;
  if (syncTimer) clearTimeout(syncTimer);
  setCloudStatus("syncing");
  syncTimer = setTimeout(pushCloudState, 600);
}

/* ──────────── 5. AUTH ──────────── */
const authModal = document.getElementById("auth-modal");
const authEmail = document.getElementById("auth-email");
const authPass  = document.getElementById("auth-pass");
const authErr   = document.getElementById("auth-err");
const authTitle = document.getElementById("auth-title");
const authSubmit = document.getElementById("auth-submit");
const authToggle = document.getElementById("auth-toggle");
const authToggleLink = document.getElementById("auth-toggle-link");
let authMode = "signin";

function openAuth() {
  if (!CLOUD_ENABLED) {
    alert("Cloud sync isn't configured. Add your Firebase config in app.js (see README).");
    return;
  }
  authErr.textContent = "";
  authEmail.value = ""; authPass.value = "";
  authModal.style.display = "flex";
}
function closeAuth() { authModal.style.display = "none"; }

function setAuthMode(m) {
  authMode = m;
  authTitle.textContent = m === "signin" ? "Sign in" : "Create account";
  authSubmit.textContent = m === "signin" ? "Sign in" : "Sign up";
  authToggle.innerHTML = m === "signin"
    ? `New here? <a id="auth-toggle-link">Create account</a>`
    : `Already have an account? <a id="auth-toggle-link">Sign in</a>`;
  document.getElementById("auth-toggle-link").addEventListener("click", () =>
    setAuthMode(m === "signin" ? "signup" : "signin"));
}
authToggleLink.addEventListener("click", () => setAuthMode("signup"));
document.getElementById("auth-cancel").addEventListener("click", closeAuth);
document.getElementById("sign-in-btn").addEventListener("click", openAuth);

authSubmit.addEventListener("click", async () => {
  authErr.textContent = "";
  const email = authEmail.value.trim();
  const password = authPass.value;
  if (!email || !password) { authErr.textContent = "Email and password required."; return; }
  try {
    if (authMode === "signin") {
      await fbAuth.signInWithEmailAndPassword(email, password);
    } else {
      await fbAuth.createUserWithEmailAndPassword(email, password);
    }
    closeAuth();
  } catch (e) {
    authErr.textContent = e.message || "Authentication failed.";
  }
});

document.getElementById("sign-out-btn").addEventListener("click", async () => {
  if (!fbAuth) return;
  await fbAuth.signOut();
});

/* react to auth changes */
if (CLOUD_ENABLED) {
  fbAuth.onAuthStateChanged(async (fbUser) => {
    user = fbUser || null;
    document.getElementById("sign-in-btn").style.display = user ? "none" : "block";
    document.getElementById("sign-out-btn").style.display = user ? "block" : "none";
    if (user) {
      await loadCloudState();
      render();
    } else {
      setCloudStatus("local");
    }
  });
}

/* ──────────── 6. DAILY UNLOCK LOGIC ──────────── */
function canUnlockToday() {
  // If we've already unlocked today, no.
  if (state.lastUnlockDate === todayStr()) return false;
  // If we've finished all lessons, no.
  if (state.currentDay >= curriculum.length && !isWeeklyQuizDue()) return false;
  return true;
}

function isWeeklyQuizDue() {
  // After every 7 completed lessons, the next "day" is a quiz instead
  // i.e. weeks completed > scores recorded
  const weeksCompleted = Math.floor(state.completed.length / 7);
  const quizzesTaken = Object.keys(state.quizScores).length;
  return weeksCompleted > quizzesTaken;
}

function unlockToday() {
  const today = todayStr();
  // streak update
  if (state.lastUnlockDate === yesterdayStr()) state.streak += 1;
  else if (state.lastUnlockDate !== today) state.streak = 1;

  state.lastUnlockDate = today;
  if (!state.startDate) state.startDate = today;

  // Determine: lesson or quiz day?
  if (isWeeklyQuizDue()) {
    // Quiz day — don't advance currentDay; render quiz
    state.viewingHistoryIdx = null;
    syncSoon();
    renderQuizDay();
  } else {
    state.currentDay = Math.min(state.currentDay + 1, curriculum.length);
    state.viewingHistoryIdx = null;
    syncSoon();
    renderLesson(state.currentDay - 1);
  }
  render();
}

/* ──────────── 7. RENDERING ──────────── */
function render() {
  // Stats
  document.getElementById("stat-streak").textContent = state.streak;
  document.getElementById("stat-completed").textContent = state.completed.length;
  document.getElementById("stat-day").textContent = state.currentDay || "—";

  renderDailyCard();
  renderHistory();
  if (typeof updatePackIndicator === "function") updatePackIndicator();
}

function renderDailyCard() {
  const card = document.getElementById("daily-card");
  const titleEl = document.getElementById("daily-title");
  const tagEl = document.getElementById("daily-tagline");
  const dayEl = document.getElementById("daily-day");
  const labelEl = document.getElementById("daily-label");
  const btn = document.getElementById("unlock-btn");
  const lockedMsg = document.getElementById("locked-msg");

  if (!curriculum.length) {
    titleEl.textContent = "Loading curriculum…";
    btn.disabled = true;
    return;
  }

  const quizDay = isWeeklyQuizDue();
  const nextIdx = state.currentDay; // index of next lesson to unlock
  const next = curriculum[nextIdx];

  if (quizDay) {
    const weekNum = Math.floor(state.completed.length / 7);
    labelEl.textContent = "Weekly Quiz";
    dayEl.textContent = `End of week ${weekNum}`;
    titleEl.textContent = `Week ${weekNum} review`;
    tagEl.textContent = "A short quiz covering the past seven lessons.";
    btn.classList.add("quiz");
    btn.textContent = "Begin weekly quiz";
  } else if (next) {
    labelEl.textContent = next._packName ? next._packName.toUpperCase() : "Today's Lesson";
    dayEl.textContent = `Day ${state.currentDay + 1}`;
    titleEl.textContent = next.name;
    tagEl.textContent = next.tagline;
    btn.classList.remove("quiz");
    btn.textContent = "Unlock today's lesson";
  } else {
    labelEl.textContent = "Curriculum complete";
    dayEl.textContent = "";
    titleEl.textContent = `All ${curriculum.length} lessons done`;
    tagEl.textContent = "You've worked through every algorithm in the deck.";
    btn.style.display = "none";
    lockedMsg.textContent = "Use the sidebar to revisit any lesson.";
    return;
  }

  btn.style.display = "inline-block";
  if (canUnlockToday()) {
    btn.disabled = false;
    lockedMsg.textContent = "";
  } else {
    btn.disabled = true;
    if (state.lastUnlockDate === todayStr()) {
      lockedMsg.textContent = "You've already unlocked today's lesson. Come back tomorrow.";
    }
  }
}

function renderHistory() {
  const list = document.getElementById("history-list");
  if (!state.completed.length) {
    list.innerHTML = `<li style="font-style: italic; color: var(--ink-soft); cursor: default;">
      <span class="title">Nothing yet — unlock day 1 to begin</span></li>`;
    return;
  }
  list.innerHTML = "";
  state.completed.forEach((algoId, i) => {
    const algo = curriculum.find(a => a.id === algoId);
    if (!algo) return;
    const li = document.createElement("li");
    if (state.viewingHistoryIdx === i) li.classList.add("current");
    li.innerHTML = `
      <span class="n">${String(i+1).padStart(2,"0")}</span>
      <span class="title">${algo.name}</span>
      <span class="check">✓</span>
    `;
    li.addEventListener("click", () => {
      state.viewingHistoryIdx = i;
      renderLesson(curriculum.findIndex(a => a.id === algoId), { historyView: true });
      renderHistory();
    });
    list.appendChild(li);
  });
}

/* render a lesson */
function renderLesson(idx, opts = {}) {
  const algo = curriculum[idx];
  if (!algo) return;
  const body = document.getElementById("lesson-body");
  body.style.display = "block";

  // Build code with line spans for numbering
  const codeLines = algo.code.split("\n").map(l => {
    // escape HTML
    const esc = l.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `<span class="ln">${esc || " "}</span>`;
  }).join("");

  const historyNote = opts.historyView
    ? `<div style="font-family: var(--sans); font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-soft); margin-bottom: 12px;">— Reviewing past lesson —</div>`
    : "";

  body.innerHTML = `
    ${historyNote}
    <div style="display:flex; align-items: baseline; gap: 12px; flex-wrap: wrap;">
      <h2 style="font-family: var(--serif); font-weight: 600; font-size: 32px; letter-spacing: -0.01em; margin: 0 0 4px;">${algo.name}</h2>
      <span class="difficulty ${algo.difficulty}">${algo.difficulty}</span>
    </div>
    <p style="font-style: italic; color: var(--ink-soft); margin: 0 0 6px;">${algo.tagline}</p>

    <h3>The intuition</h3>
    <div class="intuition">${algo.intuition}</div>

    <h3>How it works</h3>
    <p>${algo.explanation}</p>

    <h3>In Python</h3>
    <pre class="code"><code>${codeLines}</code></pre>

    <h3>Complexity</h3>
    <div class="complexity">
      <div class="badge"><span class="k">Time</span><span class="v">${algo.complexity.time}</span></div>
      <div class="badge"><span class="k">Space</span><span class="v">${algo.complexity.space}</span></div>
    </div>

    <h3>Visualization</h3>
    <div class="viz-frame" id="viz-host"></div>

    <h3>Where it shows up</h3>
    <p>${algo.use_case}</p>

    <div class="complete-row" id="complete-row"></div>
  `;

  // mount viz
  const vizHost = document.getElementById("viz-host");
  const vizFn = VIZ[algo.viz];
  if (vizFn) {
    try { vizFn(vizHost); }
    catch (e) { vizHost.innerHTML = `<div style="padding: 30px; color: var(--ink-soft); font-style: italic;">(visualization failed to load)</div>`; console.error(e); }
  } else {
    vizHost.innerHTML = `<div style="padding: 30px; color: var(--ink-soft); font-style: italic;">No visualization for this lesson yet.</div>`;
  }

  // Complete button
  const compRow = document.getElementById("complete-row");
  if (opts.historyView || state.completed.includes(algo.id)) {
    compRow.innerHTML = `<span class="completed-pill">✓ Completed</span>
      <button id="back-to-today" style="background: transparent; color: var(--ink); border: 1px solid var(--ink);">Back to today</button>`;
    document.getElementById("back-to-today").addEventListener("click", () => {
      state.viewingHistoryIdx = null;
      body.style.display = "none";
      renderHistory();
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  } else {
    compRow.innerHTML = `<span style="font-family: var(--sans); font-size: 12px; color: var(--ink-soft); letter-spacing: 0.04em;">Read through, run the code in your head, then:</span>
      <button id="mark-complete">Mark as complete</button>`;
    document.getElementById("mark-complete").addEventListener("click", () => {
      if (!state.completed.includes(algo.id)) state.completed.push(algo.id);
      syncSoon();
      render();
      renderLesson(idx, { historyView: false }); // re-render to show "completed" pill
    });
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* render weekly quiz */
function renderQuizDay() {
  const weekNum = Math.floor(state.completed.length / 7) + 1;
  // pull the last 7 completed algorithms
  const recent = state.completed.slice(-7);
  const algos = recent.map(id => curriculum.find(a => a.id === id)).filter(Boolean);

  // pick 1 question from each
  const questions = algos.map((algo, i) => {
    const q = algo.quiz[Math.floor(Math.random() * algo.quiz.length)];
    return { ...q, algo: algo.name, idx: i };
  });

  const body = document.getElementById("lesson-body");
  body.style.display = "block";
  body.innerHTML = `
    <div style="display:flex; align-items: baseline; gap: 12px; flex-wrap: wrap;">
      <h2 style="font-family: var(--serif); font-weight: 600; font-size: 32px; letter-spacing: -0.01em; margin: 0;">Week ${weekNum-1} Quiz</h2>
      <span class="difficulty hard">quiz</span>
    </div>
    <p style="font-style: italic; color: var(--ink-soft); margin: 6px 0 24px;">One question for each algorithm you've completed this week.</p>

    <div id="quiz-container"></div>

    <div class="complete-row">
      <span style="font-family: var(--sans); font-size: 12px; color: var(--ink-soft); letter-spacing: 0.04em;">Answer all questions to see your score.</span>
      <button id="submit-quiz" disabled>Submit quiz</button>
    </div>
    <div id="quiz-result-host"></div>
  `;

  const container = document.getElementById("quiz-container");
  const answers = new Array(questions.length).fill(null);

  questions.forEach((q, qi) => {
    const block = document.createElement("div");
    block.className = "quiz-question";
    block.innerHTML = `
      <div class="qnum">Q${qi + 1} · ${q.algo}</div>
      <div class="qtext">${q.q}</div>
      <div class="quiz-options"></div>
    `;
    const opts = block.querySelector(".quiz-options");
    q.options.forEach((opt, oi) => {
      const b = document.createElement("button");
      b.className = "quiz-option";
      b.innerHTML = `<span class="letter">${String.fromCharCode(65 + oi)}</span> ${opt}`;
      b.addEventListener("click", () => {
        if (b.disabled) return;
        // toggle selection visually within this question
        opts.querySelectorAll(".quiz-option").forEach(o => {
          o.style.borderColor = "";
          o.style.background = "";
        });
        b.style.borderColor = "var(--ink)";
        b.style.background = "var(--paper)";
        answers[qi] = oi;
        // enable submit when all answered
        const allAnswered = answers.every(a => a !== null);
        document.getElementById("submit-quiz").disabled = !allAnswered;
      });
      opts.appendChild(b);
    });
    container.appendChild(block);
  });

  document.getElementById("submit-quiz").addEventListener("click", () => {
    // lock + reveal correct
    let correct = 0;
    questions.forEach((q, qi) => {
      const optsEls = container.querySelectorAll(".quiz-question")[qi].querySelectorAll(".quiz-option");
      optsEls.forEach((el, oi) => {
        el.disabled = true;
        el.style.borderColor = ""; el.style.background = "";
        if (oi === q.answer) el.classList.add("correct");
        else if (oi === answers[qi] && oi !== q.answer) el.classList.add("wrong");
      });
      if (answers[qi] === q.answer) correct++;
    });
    // save
    const weekKey = "week" + (Math.floor(state.completed.length / 7));
    state.quizScores[weekKey] = { correct, total: questions.length };
    syncSoon();
    // result block
    const resultHost = document.getElementById("quiz-result-host");
    const pct = Math.round((correct / questions.length) * 100);
    const verdict = pct === 100 ? "Perfect" : pct >= 80 ? "Strong work" : pct >= 60 ? "Solid" : "Keep at it";
    resultHost.innerHTML = `
      <div class="quiz-result">
        <h3>Quiz complete</h3>
        <div class="score">${correct} / ${questions.length}</div>
        <div class="verdict">${verdict}</div>
      </div>
    `;
    document.getElementById("submit-quiz").style.display = "none";
    render();
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ──────────── 8. EXPORT / IMPORT ──────────── */
document.getElementById("export-btn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `algo-daily-progress-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("import-btn").addEventListener("click", () => {
  document.getElementById("import-file").click();
});

document.getElementById("import-file").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const imported = JSON.parse(ev.target.result);
      if (!confirm("This will overwrite your current progress. Continue?")) return;
      state = { ...defaultState(), ...imported };
      syncSoon();
      render();
      alert("Progress imported.");
    } catch (err) {
      alert("Import failed: invalid JSON.");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
});

/* ──────────── 9. UNLOCK BUTTON ──────────── */
document.getElementById("unlock-btn").addEventListener("click", unlockToday);

/* ──────────── 10. PACK LOADING ──────────── */
let packs = [];  // metadata from packs.json

async function loadCurriculum() {
  try {
    // 1. Read pack index
    const packsRes = await fetch("packs.json");
    const packsData = await packsRes.json();
    packs = packsData.packs || [];

    // 2. Fetch each pack file in order, concatenate
    const all = [];
    for (const pack of packs) {
      try {
        const res = await fetch(pack.file);
        if (!res.ok) {
          console.warn(`Pack ${pack.id} (${pack.file}) not found — skipping`);
          continue;
        }
        const algos = await res.json();
        // Tag each algorithm with its pack for sidebar display
        algos.forEach(a => { a._pack = pack.id; a._packName = pack.name; });
        all.push(...algos);
      } catch (e) {
        console.warn(`Couldn't load pack ${pack.id}:`, e);
      }
    }
    return all;
  } catch (e) {
    // Fallback: try the old single-file approach if packs.json missing
    console.warn("packs.json not found, trying curriculum.json...");
    try {
      const res = await fetch("curriculum.json");
      return await res.json();
    } catch (e2) {
      // Also try pack-1 directly
      const res = await fetch("curriculum-pack-1.json");
      return await res.json();
    }
  }
}

/* ──────────── 11. INIT ──────────── */
async function init() {
  setCloudStatus(CLOUD_ENABLED ? "local" : "local", CLOUD_ENABLED ? "Local · sign in to sync" : "Local only · cloud not configured");

  // load all curriculum packs
  try {
    curriculum = await loadCurriculum();
    if (!curriculum.length) throw new Error("No algorithms loaded");
  } catch (e) {
    document.getElementById("daily-title").textContent = "Couldn't load curriculum";
    console.error(e);
    return;
  }

  // Show current pack info in the daily card label area (subtle)
  updatePackIndicator();

  // Firebase auth state restoration is automatic via onAuthStateChanged above.
  // No explicit session-check needed here.

  // Render either today's lesson (if already unlocked today) or the unlock card
  if (state.viewingHistoryIdx !== null && state.viewingHistoryIdx < state.completed.length) {
    const algoId = state.completed[state.viewingHistoryIdx];
    const idx = curriculum.findIndex(a => a.id === algoId);
    if (idx >= 0) renderLesson(idx, { historyView: true });
  } else if (state.lastUnlockDate === todayStr() && state.currentDay > 0) {
    // already unlocked today's lesson — show it
    renderLesson(state.currentDay - 1);
  }

  render();
}

function updatePackIndicator() {
  // Tells the user which pack they're currently in
  const nextIdx = state.currentDay;
  const next = curriculum[nextIdx];
  if (!next) return;
  // Find a place to show pack name — append into the masthead sub
  const sub = document.querySelector(".masthead .sub");
  if (sub && next._packName) {
    const total = curriculum.length;
    sub.textContent = `${next._packName} · ${state.currentDay} of ${total} unlocked`;
  }
}

init();
