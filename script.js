(() => {
  "use strict";

  const LIB_KEY = "boDeQuiz.library.v1";
  const STREAK_KEY = "boDeQuiz.streak.v1";
  const subjectDataKey = (id) => `boDeQuiz.subject.${id}`;
  const notesKey = (id) => `boDeQuiz.notes.${id}`;
  const sessionKey = (id) => `boDeQuiz.session.${id}`;
  const statsKey = (id) => `boDeQuiz.stats.${id}`;
  const examHistoryKey = (id) => `boDeQuiz.examhistory.${id}`;
  const WAIT_ENTER_KEY = "boDeQuiz.waitForEnter.v1";

  const REVIEW_PAGE_SIZE = 20;

  // ---------- State ----------
  let library = [];          // [{id, name, count, addedAt}]
  let subject = null;        // { id, name, questions:[...] }
  let notes = {};            // { [qId]: text }  (for current subject)
  let sess = null;           // active/resumed practice session
  let examSess = null;       // active exam session
  let examTimerHandle = null;
  let examResultWrong = [];
  let examReviewShown = 0;
  let statsRows = [];
  let statsShown = 0;
  let noteState = { qId: null };
  let quizEditingQuestionId = null;
  let quizEditOptions = [];
  let quizEditCorrectIndex = 0;

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const el = {
    brandSubject: $("brandSubject"),
    topbarStats: $("topbarStats"), statScore: $("statScore"), statSeen: $("statSeen"),
    topbarTimer: $("topbarTimer"), timerText: $("timerText"),
    btnLibrary: $("btnLibrary"),

    screenLibrary: $("screenLibrary"), subjectList: $("subjectList"),
    motivationBar: $("motivationBar"), streakNum: $("streakNum"),
    lifetimeSeen: $("lifetimeSeen"), lifetimeAcc: $("lifetimeAcc"),
    fileInput: $("fileInput"), fileInputImport: $("fileInputImport"),
    btnCreateSubject: $("btnCreateSubject"),
    btnExport: $("btnExport"), setupError: $("setupError"),

    screenConfig: $("screenConfig"), btnBackToLibrary: $("btnBackToLibrary"),
    configTitle: $("configTitle"), configSub: $("configSub"),
    tabPractice: $("tabPractice"), tabExam: $("tabExam"),
    panelPractice: $("panelPractice"), panelExam: $("panelExam"),
    categorySelect: $("categorySelect"), countSelect: $("countSelect"), modeSelect: $("modeSelect"),
    btnStart: $("btnStart"),
    setupResume: $("setupResume"), resumeProgress: $("resumeProgress"), btnResume: $("btnResume"),
    examCategorySelect: $("examCategorySelect"), examCount: $("examCount"), examMinutes: $("examMinutes"),
    btnStartExam: $("btnStartExam"), btnOpenStats: $("btnOpenStats"), btnOpenManage: $("btnOpenManage"),

    screenStats: $("screenStats"), btnStatsBack: $("btnStatsBack"), statsTitle: $("statsTitle"),
    statsSummary: $("statsSummary"), statsList: $("statsList"), btnStatsMore: $("btnStatsMore"),

    screenManage: $("screenManage"), btnManageBack: $("btnManageBack"), manageTitle: $("manageTitle"),
    btnAddQuestion: $("btnAddQuestion"), manageList: $("manageList"), btnManageMore: $("btnManageMore"),

    screenEditor: $("screenEditor"), btnEditorBack: $("btnEditorBack"), editorTitle: $("editorTitle"),
    editCategory: $("editCategory"), editQuestion: $("editQuestion"), questionPreview: $("questionPreview"),
    editOptionsList: $("editOptionsList"), btnAddOption: $("btnAddOption"),
    editExplanation: $("editExplanation"), explanationPreview: $("explanationPreview"), editorError: $("editorError"),
    btnSaveQuestion: $("btnSaveQuestion"), btnDeleteQuestion: $("btnDeleteQuestion"),
    btnTogglePaste: $("btnTogglePaste"), jsonPastePanel: $("jsonPastePanel"), jsonPasteArea: $("jsonPasteArea"),
    btnCancelPaste: $("btnCancelPaste"), btnApplyPaste: $("btnApplyPaste"), pasteError: $("pasteError"),

    screenQuiz: $("screenQuiz"), roundBadge: $("roundBadge"),
    quizCurrent: $("quizCurrent"), quizTotal: $("quizTotal"), quizCat: $("quizCat"),
    progressFill: $("progressFill"),
    toggleWaitEnter: $("toggleWaitEnter"),
    card: $("card"), cardQuestion: $("cardQuestion"), cardOptions: $("cardOptions"),
    btnEditCurrentQuestion: $("btnEditCurrentQuestion"), quizInlineEditPanel: $("quizInlineEditPanel"),
    quizEditQuestion: $("quizEditQuestion"), quizEditOptionsList: $("quizEditOptionsList"),
    btnQuizEditAddOption: $("btnQuizEditAddOption"), quizInlineEditError: $("quizInlineEditError"),
    btnCancelCurrentQuestionEdit: $("btnCancelCurrentQuestionEdit"), btnSaveCurrentQuestionEdit: $("btnSaveCurrentQuestionEdit"),
    noteBox: $("noteBox"), noteDisplay: $("noteDisplay"), noteText: $("noteText"),
    btnEditNote: $("btnEditNote"), btnAddNote: $("btnAddNote"),
    noteEdit: $("noteEdit"), noteTextarea: $("noteTextarea"),
    btnCancelNote: $("btnCancelNote"), btnSaveNote: $("btnSaveNote"),
    reviewInfo: $("reviewInfo"), reviewYourAnswer: $("reviewYourAnswer"),
    reviewCorrectAnswer: $("reviewCorrectAnswer"), reviewExplanation: $("reviewExplanation"),
    btnPrev: $("btnPrev"),
    btnSkip: $("btnSkip"), btnNext: $("btnNext"),

    screenRoundComplete: $("screenRoundComplete"), roundDoneEyebrow: $("roundDoneEyebrow"),
    roundDoneScore: $("roundDoneScore"), roundDoneSub: $("roundDoneSub"),
    btnNextRound: $("btnNextRound"), btnStopHere: $("btnStopHere"),

    screenResult: $("screenResult"), resultScore: $("resultScore"), resultSub: $("resultSub"),
    btnRetrySame: $("btnRetrySame"), btnRestart: $("btnRestart"),

    screenExam: $("screenExam"), examCurrent: $("examCurrent"), examTotal: $("examTotal"),
    examCat: $("examCat"), examProgressFill: $("examProgressFill"),
    examCard: $("examCard"), examCardQuestion: $("examCardQuestion"), examCardOptions: $("examCardOptions"),
    btnSubmitExamEarly: $("btnSubmitExamEarly"),

    screenExamResult: $("screenExamResult"), examResultScore: $("examResultScore"), examResultSub: $("examResultSub"),
    btnExamRetry: $("btnExamRetry"), btnExamBack: $("btnExamBack"),
    examReviewList: $("examReviewList"), btnExamReviewMore: $("btnExamReviewMore"),
  };

  // ---------- Utilities ----------
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

  function renderMath(container) {
    if (!container || !window.renderMathInElement) return;
    try {
      window.renderMathInElement(container, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "\\[", right: "\\]", display: true },
          { left: "\\(", right: "\\)", display: false },
          { left: "$", right: "$", display: false },
        ],
        throwOnError: false,
      });
    } catch (e) { /* math rendering is best-effort; plain text still shows */ }
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function slugify(name) {
    return (name || "mon-hoc")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "mon-hoc";
  }

  function todayStr() { return new Date().toISOString().slice(0, 10); }

  function setError(msg) {
    if (!msg) { el.setupError.hidden = true; el.setupError.textContent = ""; return; }
    el.setupError.hidden = false; el.setupError.textContent = msg;
  }

  function safeGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function safeSet(key, val) { try { localStorage.setItem(key, val); return true; } catch (e) { return false; } }
  function safeRemove(key) { try { localStorage.removeItem(key); } catch (e) {} }

  // ---------- Setting: dừng lại chờ Enter sau mỗi câu (mặc định bật) ----------
  function loadWaitForEnterSetting() {
    const v = safeGet(WAIT_ENTER_KEY);
    return v === null ? true : v === "1";
  }
  function saveWaitForEnterSetting(val) { safeSet(WAIT_ENTER_KEY, val ? "1" : "0"); }
  function waitForEnterEnabled() { return el.toggleWaitEnter ? el.toggleWaitEnter.checked : true; }

  function normalizeQuestions(raw) {
    if (!Array.isArray(raw)) throw new Error("File JSON phải là một mảng câu hỏi.");
    return raw.map((q, i) => {
      if (!q || typeof q.question !== "string" || !Array.isArray(q.options)) {
        throw new Error(`Câu ở vị trí ${i} thiếu "question" hoặc "options".`);
      }
      if (q.answer === undefined) throw new Error(`Câu ở vị trí ${i} thiếu "answer".`);
      return {
        id: String(q.id ?? i),
        category: q.category || "Chung",
        question: q.question,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation || "",
      };
    });
  }

  function isMulti(q) { return Array.isArray(q.answer); }

  // ---------- Library persistence ----------
  function loadLibrary() {
    try { library = JSON.parse(safeGet(LIB_KEY) || "[]"); } catch (e) { library = []; }
  }
  function saveLibrary() { safeSet(LIB_KEY, JSON.stringify(library)); }

  function addSubjectToLibrary(name, questions) {
    let id = slugify(name);
    const existingIds = new Set(library.map((s) => s.id));
    let n = 2;
    while (existingIds.has(id)) { id = `${slugify(name)}-${n++}`; }
    const entry = { id, name: (name || "").trim() || "Môn học", count: questions.length, addedAt: Date.now() };
    if (!safeSet(subjectDataKey(id), JSON.stringify(questions))) {
      throw new Error("Không lưu được vào bộ nhớ trình duyệt (có thể đã đầy).");
    }
    library.push(entry);
    saveLibrary();
    return entry;
  }

  function deleteSubject(id) {
    library = library.filter((s) => s.id !== id);
    saveLibrary();
    safeRemove(subjectDataKey(id));
    safeRemove(notesKey(id));
    safeRemove(sessionKey(id));
    safeRemove(statsKey(id));
    safeRemove(examHistoryKey(id));
  }

  function getSubjectQuestions(id) {
    try { return normalizeQuestions(JSON.parse(safeGet(subjectDataKey(id)) || "[]")); }
    catch (e) { return []; }
  }

  async function ensureDefaultSubject() {
    if (library.length > 0) return;
    try {
      const res = await fetch("questions.json", { cache: "no-store" });
      if (!res.ok) return;
      const data = normalizeQuestions(await res.json());
      if (data.length) addSubjectToLibrary("Bộ mẫu", data);
    } catch (e) { /* no sample file next to page — library just starts empty */ }
  }

  // ---------- Notes persistence ----------
  function loadNotes(id) {
    try { return JSON.parse(safeGet(notesKey(id)) || "{}"); } catch (e) { return {}; }
  }
  function saveNoteFor(id, qId, text) {
    const store = loadNotes(id);
    if (text) store[qId] = text; else delete store[qId];
    safeSet(notesKey(id), JSON.stringify(store));
    return store;
  }

  // ---------- Stats persistence (cumulative across all sessions) ----------
  function loadStats(id) {
    try { return JSON.parse(safeGet(statsKey(id)) || "{}"); } catch (e) { return {}; }
  }
  function recordAnswerStat(subjectId, qId, correct) {
    const s = loadStats(subjectId);
    if (!s[qId]) s[qId] = { seen: 0, wrong: 0 };
    s[qId].seen++;
    if (!correct) s[qId].wrong++;
    safeSet(statsKey(subjectId), JSON.stringify(s));
    recordStreak();
  }

  // ---------- Streak persistence ----------
  function loadStreak() {
    try { return JSON.parse(safeGet(STREAK_KEY) || "null") || { lastDate: null, current: 0, best: 0 }; }
    catch (e) { return { lastDate: null, current: 0, best: 0 }; }
  }
  function recordStreak() {
    const st = loadStreak();
    const today = todayStr();
    if (st.lastDate === today) return;
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    st.current = st.lastDate === yesterday ? st.current + 1 : 1;
    st.best = Math.max(st.best || 0, st.current);
    st.lastDate = today;
    safeSet(STREAK_KEY, JSON.stringify(st));
  }

  // ---------- Exam history persistence ----------
  function loadExamHistory(id) {
    try { return JSON.parse(safeGet(examHistoryKey(id)) || "[]"); } catch (e) { return []; }
  }
  function saveExamHistory(id, arr) { safeSet(examHistoryKey(id), JSON.stringify(arr.slice(-10))); }

  // ---------- Session persistence (practice) ----------
  function loadSession(id) {
    try { return JSON.parse(safeGet(sessionKey(id)) || "null"); } catch (e) { return null; }
  }
  function normalizePracticeSession(raw) {
    if (!raw || typeof raw !== "object") return raw;
    const s = { ...raw };
    const total = Array.isArray(s.currentRoundOrder) ? s.currentRoundOrder.length : 0;
    if (!Number.isInteger(s.pos) || s.pos < 0) s.pos = 0;
    if (s.pos > total) s.pos = total;
    if (!Array.isArray(s.answerHistory)) s.answerHistory = new Array(total).fill(null);
    if (s.answerHistory.length !== total) {
      s.answerHistory = s.answerHistory.slice(0, total);
      while (s.answerHistory.length < total) s.answerHistory.push(null);
    }
    s.reviewMode = !!s.reviewMode;
    s.reviewPos = Number.isInteger(s.reviewPos) ? s.reviewPos : null;
    if (!s.reviewMode || s.reviewPos === null || s.reviewPos < 0 || s.reviewPos >= s.pos) {
      s.reviewMode = false;
      s.reviewPos = null;
    }
    if (!Array.isArray(s.optionOrders)) s.optionOrders = [];
    return s;
  }
  // Trả về (và nếu cần, tạo mới) thứ tự hiển thị đáp án đã xáo trộn cho vị trí pos
  // trong vòng hiện tại. Được lưu lại trong sess để giữ nguyên khi re-render/resume.
  function getOptionOrder(pos, q) {
    if (!Array.isArray(sess.optionOrders)) sess.optionOrders = [];
    let order = sess.optionOrders[pos];
    if (!Array.isArray(order) || order.length !== q.options.length) {
      order = shuffle(q.options.map((_, i) => i));
      sess.optionOrders[pos] = order;
    }
    return order;
  }
  function saveSession() { if (subject && sess) safeSet(sessionKey(subject.id), JSON.stringify(sess)); }
  function clearSession() { if (subject) safeRemove(sessionKey(subject.id)); }

  // ---------- Screens ----------
  function showScreen(name) {
    el.screenLibrary.hidden = name !== "library";
    el.screenConfig.hidden = name !== "config";
    el.screenStats.hidden = name !== "stats";
    el.screenManage.hidden = name !== "manage";
    el.screenEditor.hidden = name !== "editor";
    el.screenQuiz.hidden = name !== "quiz";
    el.screenRoundComplete.hidden = name !== "roundComplete";
    el.screenResult.hidden = name !== "result";
    el.screenExam.hidden = name !== "exam";
    el.screenExamResult.hidden = name !== "examResult";
    el.topbarStats.hidden = name !== "quiz";
    el.topbarTimer.hidden = name !== "exam";
    el.btnLibrary.hidden = name === "library";
    el.brandSubject.textContent = (name === "library" || !subject) ? "Bộ Đề" : subject.name;
  }

  // ---------- LIBRARY screen ----------
  function renderMotivationBar() {
    const st = loadStreak();
    let totalSeen = 0, totalWrong = 0;
    for (const s of library) {
      const stats = loadStats(s.id);
      for (const qid in stats) { totalSeen += stats[qid].seen; totalWrong += stats[qid].wrong; }
    }
    if (totalSeen === 0) { el.motivationBar.hidden = true; return; }
    el.motivationBar.hidden = false;
    el.streakNum.textContent = st.current || 0;
    el.lifetimeSeen.textContent = totalSeen;
    el.lifetimeAcc.textContent = Math.round(((totalSeen - totalWrong) / totalSeen) * 100) + "%";
  }

  function renderLibrary() {
    renderMotivationBar();
    if (library.length === 0) {
      el.subjectList.innerHTML = `<p class="setup-sub" style="margin:0 0 4px;">Chưa có môn nào — tải lên một file JSON câu hỏi để bắt đầu.</p>`;
      return;
    }
    el.subjectList.innerHTML = "";
    for (const s of library) {
      const savedSess = loadSession(s.id);
      const stats = loadStats(s.id);
      let seen = 0, wrong = 0;
      for (const qid in stats) { seen += stats[qid].seen; wrong += stats[qid].wrong; }
      const acc = seen ? Math.round(((seen - wrong) / seen) * 100) : null;

      const card = document.createElement("div");
      card.className = "subject-card";
      card.innerHTML = `
        <div class="subject-card-main">
          <p class="subject-card-name">${escapeHtml(s.name)}</p>
          <div class="subject-card-meta">
            <span>${s.count} câu</span>
            ${acc !== null ? `<span>Đã ôn ${seen} lượt · ${acc}% đúng</span>` : ""}
            ${savedSess ? `<span class="subject-card-progress">Đang học dở — vòng ${savedSess.round}</span>` : ""}
          </div>
        </div>
        <button class="subject-card-del" title="Xoá môn này" aria-label="Xoá môn này">✕</button>
      `;
      card.querySelector(".subject-card-main").addEventListener("click", () => openConfig(s.id));
      card.querySelector(".subject-card-del").addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm(`Xoá môn "${s.name}" cùng toàn bộ tiến trình, ghi chú và thống kê?`)) {
          deleteSubject(s.id);
          renderLibrary();
        }
      });
      el.subjectList.appendChild(card);
    }
  }

  el.fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = normalizeQuestions(JSON.parse(reader.result));
        const defaultName = file.name.replace(/\.json$/i, "");
        const name = (prompt("Đặt tên cho môn học này:", defaultName) || defaultName).trim();
        const entry = addSubjectToLibrary(name, data);
        setError("");
        renderLibrary();
        openConfig(entry.id);
      } catch (err) {
        setError("File JSON không hợp lệ: " + err.message);
      }
    };
    reader.onerror = () => setError("Không đọc được file.");
    reader.readAsText(file);
    el.fileInput.value = "";
  });

  // ---------- Export / Import (data management) ----------
  function exportAll() {
    const payload = { exportedAt: Date.now(), streak: loadStreak(), subjects: {} };
    for (const s of library) {
      payload.subjects[s.id] = {
        meta: s,
        questions: getSubjectQuestions(s.id),
        notes: loadNotes(s.id),
        stats: loadStats(s.id),
        examHistory: loadExamHistory(s.id),
      };
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bo-de-backup-${todayStr()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function importAll(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || typeof data.subjects !== "object") throw new Error("File backup không đúng định dạng.");
        let added = 0, renamed = 0;
        const existingIds = new Set(library.map((s) => s.id));
        for (const oldId in data.subjects) {
          const entry = data.subjects[oldId];
          let id = oldId;
          if (existingIds.has(id)) { id = `${oldId}-nhap-${Date.now()}`; renamed++; }
          existingIds.add(id);
          const questions = entry.questions || [];
          const meta = { id, name: (entry.meta && entry.meta.name) || oldId, count: questions.length, addedAt: Date.now() };
          safeSet(subjectDataKey(id), JSON.stringify(questions));
          safeSet(notesKey(id), JSON.stringify(entry.notes || {}));
          safeSet(statsKey(id), JSON.stringify(entry.stats || {}));
          safeSet(examHistoryKey(id), JSON.stringify(entry.examHistory || []));
          library.push(meta);
          added++;
        }
        saveLibrary();
        setError("");
        renderLibrary();
        alert(`Đã nhập ${added} môn học${renamed ? ` (${renamed} môn trùng id được đổi tên để không ghi đè)` : ""}.`);
      } catch (err) {
        setError("Không nhập được file: " + err.message);
      }
    };
    reader.onerror = () => setError("Không đọc được file.");
    reader.readAsText(file);
  }

  el.btnExport.addEventListener("click", exportAll);
  el.fileInputImport.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) importAll(file);
    el.fileInputImport.value = "";
  });

  el.btnBackToLibrary.addEventListener("click", () => { showScreen("library"); renderLibrary(); });
  el.btnLibrary.addEventListener("click", () => { stopExamTimer(); showScreen("library"); renderLibrary(); });

  // ---------- CONFIG screen ----------
  function switchConfigTab(mode) {
    el.tabPractice.classList.toggle("is-active", mode === "practice");
    el.tabExam.classList.toggle("is-active", mode === "exam");
    el.panelPractice.hidden = mode !== "practice";
    el.panelExam.hidden = mode !== "exam";
  }
  el.tabPractice.addEventListener("click", () => switchConfigTab("practice"));
  el.tabExam.addEventListener("click", () => switchConfigTab("exam"));

  function loadSubjectState(id) {
    const questions = getSubjectQuestions(id);
    const meta = library.find((s) => s.id === id);
    subject = { id, name: meta ? meta.name : id, questions };
    notes = loadNotes(id);
  }

  el.btnCreateSubject.addEventListener("click", () => {
    const name = (prompt("Đặt tên cho môn học mới:") || "").trim();
    if (!name) return;
    let entry;
    try {
      entry = addSubjectToLibrary(name, []);
    } catch (err) {
      setError(err.message);
      return;
    }
    setError("");
    renderLibrary();
    loadSubjectState(entry.id);
    openManage();
  });

  function openConfig(id) {
    loadSubjectState(id);
    const questions = subject.questions;
    switchConfigTab("practice");

    el.configTitle.textContent = subject.name;
    el.configSub.textContent = `${questions.length} câu hỏi`;

    const cats = Array.from(new Set(questions.map((q) => q.category)));
    const catOptionsHtml = ['<option value="__all__">Tất cả chương</option>']
      .concat(cats.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)).join("");
    el.categorySelect.innerHTML = catOptionsHtml;
    el.examCategorySelect.innerHTML = catOptionsHtml;

    const savedSess = loadSession(id);
    if (savedSess) {
      el.setupResume.hidden = false;
      el.resumeProgress.textContent = `Vòng ${savedSess.round} — câu ${savedSess.pos + 1}/${savedSess.currentRoundOrder.length}`;
      el.btnResume.onclick = () => { sess = normalizePracticeSession(savedSess); showScreen("quiz"); renderQuestion(); };
    } else {
      el.setupResume.hidden = true;
    }

    showScreen("config");
  }

  el.btnStart.addEventListener("click", () => {
    const category = el.categorySelect.value;
    const mode = el.modeSelect.value;
    let pool = subject.questions.map((_, i) => i);
    if (category !== "__all__") pool = pool.filter((i) => subject.questions[i].category === category);
    if (pool.length === 0) { setError("Chương này không có câu hỏi."); return; }

    const countSel = el.countSelect.value;
    let originalSet = mode === "shuffle" ? shuffle(pool) : pool.slice();
    const n = countSel === "all" ? originalSet.length : Math.min(parseInt(countSel, 10), originalSet.length);
    originalSet = originalSet.slice(0, n);

    sess = {
      category, mode, round: 1,
      currentRoundOrder: originalSet,
      pos: 0,
      roundWrong: [],
      answerHistory: new Array(originalSet.length).fill(null),
      reviewMode: false,
      reviewPos: null,
      firstRoundCorrectCount: 0,
      originalSetLength: originalSet.length,
      optionOrders: [],
    };
    saveSession();
    showScreen("quiz");
    renderQuestion();
  });

  // ---------- STATS screen ----------
  function openStats() {
    const s = loadStats(subject.id);
    statsRows = Object.keys(s)
      .map((qid) => ({ qid, seen: s[qid].seen, wrong: s[qid].wrong }))
      .filter((r) => r.wrong > 0)
      .sort((a, b) => b.wrong - a.wrong || (b.wrong / b.seen) - (a.wrong / a.seen));
    statsShown = 0;

    el.statsTitle.textContent = `Thống kê — ${subject.name}`;
    const totalSeen = Object.values(s).reduce((sum, r) => sum + r.seen, 0);
    const totalWrong = Object.values(s).reduce((sum, r) => sum + r.wrong, 0);
    const acc = totalSeen ? Math.round(((totalSeen - totalWrong) / totalSeen) * 100) : 0;
    el.statsSummary.innerHTML = `
      <div class="stats-summary-item"><span class="stats-summary-num">${totalSeen}</span><span>lượt trả lời</span></div>
      <div class="stats-summary-item"><span class="stats-summary-num">${acc}%</span><span>đúng chung</span></div>
      <div class="stats-summary-item"><span class="stats-summary-num">${statsRows.length}</span><span>câu từng sai</span></div>
    `;
    el.statsList.innerHTML = "";
    el.btnStatsMore.hidden = statsRows.length === 0;
    showScreen("stats");
    if (statsRows.length) renderStatsPage();
  }

  function renderStatsPage() {
    const slice = statsRows.slice(statsShown, statsShown + REVIEW_PAGE_SIZE);
    const frag = document.createDocumentFragment();
    for (const r of slice) {
      const q = subject.questions.find((qq) => qq.id === r.qid);
      if (!q) continue;
      const rate = Math.round((r.wrong / r.seen) * 100);
      const div = document.createElement("div");
      div.className = "stats-item";
      div.innerHTML = `
        <p class="stats-item-q">${escapeHtml(q.question)}</p>
        <p class="stats-item-meta">Sai ${r.wrong}/${r.seen} lượt (${rate}%)</p>
      `;
      frag.appendChild(div);
    }
    el.statsList.appendChild(frag);
    statsShown += slice.length;
    el.btnStatsMore.hidden = statsShown >= statsRows.length;
    renderMath(el.statsList);
  }

  el.btnOpenStats.addEventListener("click", openStats);
  el.btnStatsMore.addEventListener("click", renderStatsPage);
  el.btnStatsBack.addEventListener("click", () => showScreen("config"));

  // ---------- MANAGE screen (manual add / edit / delete questions) ----------

  function syncSubjectCount() {
    const meta = library.find((s) => s.id === subject.id);
    if (meta) { meta.count = subject.questions.length; saveLibrary(); }
  }

  function persistSubjectQuestions() {
    safeSet(subjectDataKey(subject.id), JSON.stringify(subject.questions));
    syncSubjectCount();
  }

  function openManage() {
    el.manageTitle.textContent = `Câu hỏi — ${subject.name}`;
    el.manageList.innerHTML = "";
    el.btnManageMore.hidden = true;
    showScreen("manage");
    if (subject.questions.length) renderManagePage();
  }

  function setManageSingleAnswer(q, idx) {
    q.answer = idx;
    persistSubjectQuestions();
  }
  function toggleManageMultiAnswer(q, idx) {
    const set = new Set(q.answer);
    if (set.has(idx)) {
      if (set.size <= 1) return false; // luôn phải còn ít nhất 1 đáp án đúng
      set.delete(idx);
    } else {
      set.add(idx);
    }
    q.answer = Array.from(set).sort((a, b) => a - b);
    persistSubjectQuestions();
    return true;
  }

  function renderManageOptionsGrid(container, q, multi) {
    container.innerHTML = "";
    const correctSet = new Set(multi ? q.answer : [q.answer]);
    q.options.forEach((optText, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "manage-opt" + (multi ? " is-multi" : "") + (correctSet.has(i) ? " is-correct" : "");
      btn.innerHTML = `<span class="manage-opt-mark">${correctSet.has(i) ? "✓" : ""}</span><span class="manage-opt-text">${escapeHtml(optText)}</span>`;
      btn.addEventListener("click", () => {
        if (multi) {
          if (!toggleManageMultiAnswer(q, i)) return;
        } else {
          if (q.answer === i) return;
          setManageSingleAnswer(q, i);
        }
        renderManageOptionsGrid(container, q, multi);
      });
      container.appendChild(btn);
    });
    renderMath(container);
  }

  function renderManagePage() {
    const frag = document.createDocumentFragment();
    subject.questions.forEach((q) => {
      const multi = isMulti(q);
      const div = document.createElement("div");
      div.className = "manage-item";
      div.innerHTML = `
        <div class="manage-item-top">
          <div class="manage-item-main">
            <p class="manage-item-cat">${escapeHtml(q.category)}${multi ? " · nhiều đáp án đúng" : ""}</p>
            <p class="manage-item-q">${escapeHtml(q.question)}</p>
          </div>
          <div class="manage-item-actions">
            <button class="btn-edit" ${multi ? "disabled title=\"Câu nhiều đáp án đúng — sửa nội dung trực tiếp trong file JSON\"" : ""}>Sửa</button>
            <button class="btn-del">Xoá</button>
          </div>
        </div>
        <div class="manage-options-grid"></div>
      `;
      const optionsGrid = div.querySelector(".manage-options-grid");
      renderManageOptionsGrid(optionsGrid, q, multi);

      div.querySelector(".btn-edit").addEventListener("click", () => { if (!multi) openEditor(q); });
      div.querySelector(".btn-del").addEventListener("click", () => {
        if (confirm("Xoá câu hỏi này? Ghi chú và thống kê của câu này cũng sẽ không còn dùng được.")) {
          subject.questions = subject.questions.filter((qq) => qq.id !== q.id);
          persistSubjectQuestions();
          openManage();
        }
      });
      frag.appendChild(div);
    });
    el.manageList.appendChild(frag);
    el.btnManageMore.hidden = true;
    renderMath(el.manageList);
  }

  el.btnOpenManage.addEventListener("click", openManage);
  el.btnManageMore.addEventListener("click", renderManagePage);
  el.btnManageBack.addEventListener("click", () => { showScreen("config"); openConfig(subject.id); });
  el.btnAddQuestion.addEventListener("click", () => openEditor(null));

  // ---------- EDITOR screen (the add/edit form itself) ----------
  let editingId = null;
  let editorOptions = [];
  let editorCorrectIndex = 0;

  function genQuestionId() { return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

  function openEditor(question) {
    editingId = question ? question.id : null;
    el.editorTitle.textContent = question ? "Sửa câu hỏi" : "Thêm câu hỏi mới";
    el.editCategory.value = question ? question.category : "";
    el.editQuestion.value = question ? question.question : "";
    editorOptions = question ? question.options.slice() : ["", ""];
    editorCorrectIndex = question ? question.answer : 0;
    el.editExplanation.value = question ? question.explanation : "";
    el.btnDeleteQuestion.hidden = !question;
    el.jsonPastePanel.hidden = true;
    setError2("");
    setPasteError("");
    renderEditorOptions();
    updateQuestionPreview();
    updateExplanationPreview();
    showScreen("editor");
  }

  function setError2(msg) {
    if (!msg) { el.editorError.hidden = true; el.editorError.textContent = ""; return; }
    el.editorError.hidden = false; el.editorError.textContent = msg;
  }

  function updateLatexPreview(inputEl, previewEl) {
    const v = inputEl.value;
    if (v.trim()) {
      previewEl.innerHTML = escapeHtml(v);
      renderMath(previewEl);
      previewEl.hidden = false;
    } else {
      previewEl.hidden = true;
    }
  }

  function updateQuestionPreview() { updateLatexPreview(el.editQuestion, el.questionPreview); }
  function updateExplanationPreview() { updateLatexPreview(el.editExplanation, el.explanationPreview); }
  el.editQuestion.addEventListener("input", updateQuestionPreview);
  el.editExplanation.addEventListener("input", updateExplanationPreview);

  function renderEditorOptions() {
    el.editOptionsList.innerHTML = "";
    editorOptions.forEach((text, i) => {
      const row = document.createElement("div");
      row.className = "edit-option-row";
      row.innerHTML = `
        <div class="edit-option-row-top">
          <input type="radio" name="correctAnswer" ${i === editorCorrectIndex ? "checked" : ""}>
          <input type="text" class="field-control edit-option-text" value="${escapeHtml(text)}" placeholder="Đáp án ${i + 1}">
          <button type="button" class="edit-option-remove" ${editorOptions.length <= 2 ? "disabled" : ""}>✕</button>
        </div>
        <div class="latex-preview latex-preview-sm" hidden></div>
      `;
      const textInput = row.querySelector(".edit-option-text");
      const preview = row.querySelector(".latex-preview");
      updateLatexPreview(textInput, preview);
      row.querySelector('input[type="radio"]').addEventListener("change", () => { editorCorrectIndex = i; });
      textInput.addEventListener("input", (e) => {
        editorOptions[i] = e.target.value;
        updateLatexPreview(textInput, preview);
      });
      row.querySelector(".edit-option-remove").addEventListener("click", () => {
        if (editorOptions.length <= 2) return;
        editorOptions.splice(i, 1);
        if (editorCorrectIndex >= editorOptions.length) editorCorrectIndex = editorOptions.length - 1;
        else if (editorCorrectIndex > i) editorCorrectIndex--;
        renderEditorOptions();
      });
      el.editOptionsList.appendChild(row);
    });
  }

  el.btnAddOption.addEventListener("click", () => { editorOptions.push(""); renderEditorOptions(); });

  // ---------- Quick JSON paste (fills the form, or bulk-imports an array) ----------
  function setPasteError(msg) {
    if (!msg) { el.pasteError.hidden = true; el.pasteError.textContent = ""; return; }
    el.pasteError.hidden = false; el.pasteError.textContent = msg;
  }
  function validateRawQuestion(q, i) {
    const label = i !== null ? `Câu ${i + 1}` : "Câu hỏi";
    if (!q || typeof q.question !== "string" || !Array.isArray(q.options)) {
      throw new Error(`${label} thiếu "question" hoặc "options".`);
    }
    if (q.answer === undefined) throw new Error(`${label} thiếu "answer".`);
  }

  el.btnTogglePaste.addEventListener("click", () => {
    el.jsonPasteArea.value = "";
    setPasteError("");
    el.jsonPastePanel.hidden = false;
    el.jsonPasteArea.focus();
  });
  el.btnCancelPaste.addEventListener("click", () => { el.jsonPastePanel.hidden = true; });

  el.btnApplyPaste.addEventListener("click", () => {
    let data;
    try { data = JSON.parse(el.jsonPasteArea.value); }
    catch (e) { setPasteError("JSON không hợp lệ: " + e.message); return; }

    try {
      if (Array.isArray(data)) {
        data.forEach((q, i) => validateRawQuestion(q, i));
        const existingIds = new Set(subject.questions.map((q) => q.id));
        const added = data.map((q) => {
          let id = q.id !== undefined ? String(q.id) : genQuestionId();
          if (existingIds.has(id)) id = genQuestionId();
          existingIds.add(id);
          return {
            id, category: q.category || "Chung", question: q.question,
            options: q.options, answer: q.answer, explanation: q.explanation || "",
          };
        });
        subject.questions = subject.questions.concat(added);
        persistSubjectQuestions();
        alert(`Đã thêm ${added.length} câu hỏi.`);
        showScreen("manage");
        openManage();
      } else {
        validateRawQuestion(data, null);
        let ci = Array.isArray(data.answer) ? data.answer[0] : data.answer;
        if (typeof ci !== "number" || ci < 0 || ci >= data.options.length) ci = 0;
        el.editCategory.value = data.category || "";
        el.editQuestion.value = data.question;
        editorOptions = data.options.slice();
        editorCorrectIndex = ci;
        el.editExplanation.value = data.explanation || "";
        renderEditorOptions();
        updateQuestionPreview();
        updateExplanationPreview();
        el.jsonPastePanel.hidden = true;
        setPasteError("");
      }
    } catch (e) {
      setPasteError(e.message);
    }
  });

  el.btnSaveQuestion.addEventListener("click", () => {
    const category = el.editCategory.value.trim() || "Chung";
    const questionText = el.editQuestion.value.trim();
    const options = editorOptions.map((t) => t.trim());

    if (!questionText) { setError2("Chưa nhập nội dung câu hỏi."); return; }
    if (options.some((t) => !t)) { setError2("Mỗi đáp án cần có nội dung (không để trống)."); return; }
    if (options.length < 2) { setError2("Cần ít nhất 2 đáp án."); return; }

    const newQ = {
      id: editingId || genQuestionId(),
      category, question: questionText, options,
      answer: editorCorrectIndex,
      explanation: el.editExplanation.value.trim(),
    };

    if (editingId) {
      const idx = subject.questions.findIndex((q) => q.id === editingId);
      if (idx !== -1) subject.questions[idx] = newQ;
    } else {
      subject.questions.push(newQ);
    }
    persistSubjectQuestions();
    showScreen("manage");
    openManage();
  });

  el.btnDeleteQuestion.addEventListener("click", () => {
    if (!editingId) return;
    if (!confirm("Xoá câu hỏi này?")) return;
    subject.questions = subject.questions.filter((q) => q.id !== editingId);
    persistSubjectQuestions();
    showScreen("manage");
    openManage();
  });

  el.btnEditorBack.addEventListener("click", () => showScreen("manage"));

  function setQuizInlineEditError(msg) {
    if (!msg) { el.quizInlineEditError.hidden = true; el.quizInlineEditError.textContent = ""; return; }
    el.quizInlineEditError.hidden = false;
    el.quizInlineEditError.textContent = msg;
  }

  function closeQuizInlineEditor() {
    quizEditingQuestionId = null;
    quizEditOptions = [];
    quizEditCorrectIndex = 0;
    el.quizInlineEditPanel.hidden = true;
    setQuizInlineEditError("");
  }

  function renderQuizInlineEditOptions() {
    el.quizEditOptionsList.innerHTML = "";
    quizEditOptions.forEach((text, i) => {
      const row = document.createElement("div");
      row.className = "edit-option-row";
      row.innerHTML = `
        <div class="edit-option-row-top">
          <input type="radio" name="quizInlineCorrectAnswer" ${i === quizEditCorrectIndex ? "checked" : ""}>
          <input type="text" class="field-control edit-option-text" value="${escapeHtml(text)}" placeholder="Đáp án ${i + 1}">
          <button type="button" class="edit-option-remove" ${quizEditOptions.length <= 2 ? "disabled" : ""}>✕</button>
        </div>
      `;
      row.querySelector('input[type="radio"]').addEventListener("change", () => { quizEditCorrectIndex = i; });
      row.querySelector(".edit-option-text").addEventListener("input", (e) => { quizEditOptions[i] = e.target.value; });
      row.querySelector(".edit-option-remove").addEventListener("click", () => {
        if (quizEditOptions.length <= 2) return;
        quizEditOptions.splice(i, 1);
        if (quizEditCorrectIndex >= quizEditOptions.length) quizEditCorrectIndex = quizEditOptions.length - 1;
        else if (quizEditCorrectIndex > i) quizEditCorrectIndex--;
        renderQuizInlineEditOptions();
      });
      el.quizEditOptionsList.appendChild(row);
    });
  }

  el.btnEditCurrentQuestion.addEventListener("click", () => {
    if (!sess || !subject || !el.btnNext.disabled) return;
    const q = currentQuestion();
    if (!q || isMulti(q)) return;
    quizEditingQuestionId = q.id;
    el.quizEditQuestion.value = q.question || "";
    quizEditOptions = Array.isArray(q.options) ? q.options.slice() : ["", ""];
    quizEditCorrectIndex = typeof q.answer === "number" ? q.answer : 0;
    setQuizInlineEditError("");
    renderQuizInlineEditOptions();
    el.quizInlineEditPanel.hidden = false;
  });

  el.btnQuizEditAddOption.addEventListener("click", () => {
    quizEditOptions.push("");
    renderQuizInlineEditOptions();
  });
  el.btnCancelCurrentQuestionEdit.addEventListener("click", closeQuizInlineEditor);
  el.btnSaveCurrentQuestionEdit.addEventListener("click", () => {
    if (!sess || !subject || !quizEditingQuestionId) return;
    const questionText = el.quizEditQuestion.value.trim();
    const options = quizEditOptions.map((t) => t.trim());

    if (!questionText) { setQuizInlineEditError("Chưa nhập nội dung câu hỏi."); return; }
    if (options.length < 2) { setQuizInlineEditError("Cần ít nhất 2 đáp án."); return; }
    if (options.some((t) => !t)) { setQuizInlineEditError("Mỗi đáp án cần có nội dung (không để trống)."); return; }
    if (quizEditCorrectIndex < 0 || quizEditCorrectIndex >= options.length) {
      setQuizInlineEditError("Đáp án đúng không hợp lệ.");
      return;
    }

    const currentIndex = sess.currentRoundOrder[sess.pos];
    const q = subject.questions[currentIndex];
    if (!q || q.id !== quizEditingQuestionId) {
      setQuizInlineEditError("Không tìm thấy câu hỏi hiện tại để lưu.");
      return;
    }

    subject.questions[currentIndex] = { ...q, question: questionText, options, answer: quizEditCorrectIndex };
    persistSubjectQuestions();
    closeQuizInlineEditor();
    renderQuestion();
  });

  // ---------- PRACTICE quiz (round loop) ----------
  function currentViewPos() {
    if (sess.reviewMode && Number.isInteger(sess.reviewPos) && sess.reviewPos >= 0 && sess.reviewPos < sess.pos) {
      return sess.reviewPos;
    }
    return sess.pos;
  }
  function currentQuestion() { return subject.questions[sess.currentRoundOrder[currentViewPos()]]; }
  function answerRecordAt(pos) {
    if (!sess || !Array.isArray(sess.answerHistory) || pos < 0 || pos >= sess.answerHistory.length) return null;
    return sess.answerHistory[pos];
  }
  function isReviewingPastQuestion() {
    return sess.reviewMode && currentViewPos() < sess.pos;
  }
  function answerText(q, selected) {
    if (selected === -1) return "Bỏ qua";
    if (!Number.isInteger(selected) || selected < 0 || selected >= q.options.length) return "Không có dữ liệu";
    return q.options[selected];
  }
  function correctAnswerText(q) {
    return isMulti(q) ? q.answer.map((a) => q.options[a]).join(", ") : q.options[q.answer];
  }
  function renderReviewInfo(q, selected) {
    el.reviewYourAnswer.textContent = `Bạn chọn: ${answerText(q, selected)}`;
    el.reviewCorrectAnswer.textContent = `Đáp án đúng: ${correctAnswerText(q)}`;
    el.reviewExplanation.textContent = `Giải thích: ${q.explanation || "Chưa có giải thích cho câu này."}`;
    el.reviewInfo.hidden = false;
    renderMath(el.reviewInfo);
  }

  function renderQuestion() {
    sess = normalizePracticeSession(sess);
    const q = currentQuestion();
    const viewPos = currentViewPos();
    const total = sess.currentRoundOrder.length;
    const reviewing = isReviewingPastQuestion();
    const answerRecord = answerRecordAt(viewPos);
    const isAnswered = !!answerRecord;

    el.roundBadge.textContent = `Vòng ${sess.round}`;
    el.quizCurrent.textContent = viewPos + 1;
    el.quizTotal.textContent = total;
    el.quizCat.textContent = q.category;
    el.progressFill.style.width = `${(viewPos / total) * 100}%`;
    el.statScore.textContent = Math.max(0, sess.pos - sess.roundWrong.length);
    el.statSeen.textContent = sess.pos;

    el.cardQuestion.innerHTML = escapeHtml(q.question);
    if (reviewing) {
      el.btnNext.disabled = false;
      el.btnNext.textContent = viewPos + 1 < sess.pos ? "Câu đã làm tiếp theo" : "Quay lại câu hiện tại";
    } else if (isAnswered) {
      el.btnNext.disabled = false;
      el.btnNext.textContent = sess.pos + 1 >= total ? "Hoàn tất vòng này" : "Câu tiếp theo";
    } else {
      el.btnNext.disabled = true;
      el.btnNext.textContent = sess.pos + 1 >= total ? "Hoàn tất vòng này" : "Câu tiếp theo";
    }
    el.btnPrev.disabled = viewPos <= 0;
    el.btnSkip.disabled = reviewing || isAnswered;
    closeQuizInlineEditor();
    const canInlineEdit = !isMulti(q) && !reviewing && !isAnswered;
    el.btnEditCurrentQuestion.disabled = !canInlineEdit;
    if (canInlineEdit) el.btnEditCurrentQuestion.removeAttribute("title");
    else el.btnEditCurrentQuestion.setAttribute("title", "Câu nhiều đáp án đúng — sửa trực tiếp trong file JSON");

    resetNoteBox();
    el.reviewInfo.hidden = true;

    const multi = isMulti(q);
    const correctSet = new Set(multi ? q.answer : [q.answer]);

    el.cardOptions.innerHTML = "";
    const optOrder = getOptionOrder(viewPos, q);
    optOrder.forEach((i, slot) => {
      const optText = q.options[i];
      const btn = document.createElement("button");
      btn.className = "option";
      btn.type = "button";
      btn.innerHTML = `<span class="option-letter">${slot + 1}</span><span>${escapeHtml(optText)}</span>`;
      if (reviewing || isAnswered) {
        btn.disabled = true;
        if (correctSet.has(i)) btn.classList.add("is-correct");
        if (answerRecord && answerRecord.selected === i && !answerRecord.correct) btn.classList.add("is-wrong");
        if (answerRecord && answerRecord.selected === i) btn.classList.add("is-selected");
      } else {
        btn.addEventListener("click", () => handleAnswer(i, correctSet, q));
      }
      el.cardOptions.appendChild(btn);
    });
    if (reviewing) renderReviewInfo(q, answerRecord ? answerRecord.selected : null);

    renderMath(el.card);
    saveSession();
  }

  function handleAnswer(i, correctSet, q) {
    if (isReviewingPastQuestion()) return;
    if (answerRecordAt(sess.pos)) return;
    const optionBtns = Array.from(el.cardOptions.children);
    if (optionBtns[0].disabled) return;
    const optOrder = getOptionOrder(sess.pos, q); // slot -> original option index

    optionBtns.forEach((b, slot) => {
      b.disabled = true;
      if (correctSet.has(optOrder[slot])) b.classList.add("is-correct");
    });
    const wasCorrect = correctSet.has(i);
    const clickedSlot = optOrder.indexOf(i);
    if (!wasCorrect && clickedSlot !== -1) optionBtns[clickedSlot].classList.add("is-wrong");

    if (wasCorrect) {
      if (sess.round === 1) sess.firstRoundCorrectCount++;
    } else {
      sess.roundWrong.push(sess.currentRoundOrder[sess.pos]);
    }
    sess.answerHistory[sess.pos] = { selected: i, correct: wasCorrect };
    recordAnswerStat(subject.id, q.id, wasCorrect);

    el.statScore.textContent = (sess.pos + 1) - sess.roundWrong.length;
    el.statSeen.textContent = sess.pos + 1;
    el.btnNext.disabled = false;
    el.btnSkip.disabled = true;
    closeQuizInlineEditor();
    el.btnEditCurrentQuestion.disabled = true;

    if (waitForEnterEnabled()) {
      showNoteBox(q);
      saveSession();
    } else {
      saveSession();
      setTimeout(() => { if (!isReviewingPastQuestion()) advance(); }, 350);
    }
  }

  function skipQuestion() {
    if (el.btnSkip.disabled) return;
    const optionBtns = Array.from(el.cardOptions.children);
    if (!optionBtns[0] || !optionBtns[0].disabled) {
      const q = currentQuestion();
      sess.roundWrong.push(sess.currentRoundOrder[sess.pos]);
      sess.answerHistory[sess.pos] = { selected: -1, correct: false };
      recordAnswerStat(subject.id, q.id, false);
    }
    advance();
  }

  if (el.toggleWaitEnter) {
    el.toggleWaitEnter.checked = loadWaitForEnterSetting();
    el.toggleWaitEnter.addEventListener("change", () => {
      saveWaitForEnterSetting(el.toggleWaitEnter.checked);
    });
  }

  el.btnPrev.addEventListener("click", () => {
    if (!sess) return;
    const viewPos = currentViewPos();
    if (viewPos <= 0) return;
    const prevPos = viewPos - 1;
    if (prevPos < sess.pos) {
      sess.reviewMode = true;
      sess.reviewPos = prevPos;
    } else {
      sess.reviewMode = false;
      sess.reviewPos = null;
    }
    renderQuestion();
  });
  el.btnSkip.addEventListener("click", skipQuestion);
  el.btnNext.addEventListener("click", advance);

  function advance() {
    if (isReviewingPastQuestion()) {
      const nextReviewPos = currentViewPos() + 1;
      if (nextReviewPos < sess.pos) {
        sess.reviewMode = true;
        sess.reviewPos = nextReviewPos;
      } else {
        sess.reviewMode = false;
        sess.reviewPos = null;
      }
      renderQuestion();
      return;
    }
    sess.pos++;
    sess.reviewMode = false;
    sess.reviewPos = null;
    if (sess.pos < sess.currentRoundOrder.length) {
      renderQuestion();
    } else if (sess.roundWrong.length === 0) {
      finishMastered();
    } else {
      showRoundComplete();
    }
  }

  // ---------- Note box (giải thích, tự lưu theo từng câu) ----------
  function resetNoteBox() {
    el.noteBox.hidden = true;
    el.noteDisplay.hidden = true;
    el.btnAddNote.hidden = true;
    el.noteEdit.hidden = true;
  }

  function currentNoteText(qId, q) {
    if (notes[qId]) return notes[qId];
    if (q.explanation) return q.explanation;
    return "";
  }

  function showNoteBox(q) {
    noteState.qId = q.id;
    el.noteBox.hidden = false;
    const text = currentNoteText(q.id, q);
    if (text) {
      el.noteDisplay.hidden = false;
      el.btnAddNote.hidden = true;
      el.noteText.innerHTML = escapeHtml(text);
      renderMath(el.noteBox);
    } else {
      el.noteDisplay.hidden = true;
      el.btnAddNote.hidden = false;
    }
    el.noteEdit.hidden = true;
  }

  el.btnAddNote.addEventListener("click", () => {
    el.noteTextarea.value = "";
    el.noteEdit.hidden = false;
    el.btnAddNote.hidden = true;
    el.noteTextarea.focus();
  });
  el.btnEditNote.addEventListener("click", () => {
    el.noteTextarea.value = notes[noteState.qId] || el.noteText.textContent || "";
    el.noteDisplay.hidden = true;
    el.noteEdit.hidden = false;
    el.noteTextarea.focus();
  });
  el.btnCancelNote.addEventListener("click", () => showNoteBox(currentQuestion()));
  el.btnSaveNote.addEventListener("click", () => {
    const text = el.noteTextarea.value.trim();
    notes = saveNoteFor(subject.id, noteState.qId, text);
    showNoteBox(currentQuestion());
  });

  // ---------- ROUND COMPLETE screen ----------
  function showRoundComplete() {
    const total = sess.currentRoundOrder.length;
    const wrong = sess.roundWrong.length;
    el.roundDoneEyebrow.textContent = `Xong vòng ${sess.round}`;
    el.roundDoneScore.textContent = `${total - wrong}/${total}`;
    el.roundDoneSub.textContent = `${wrong} câu sai sẽ được hỏi lại ở vòng ${sess.round + 1}.`;
    showScreen("roundComplete");
  }

  function advanceToNextRound() {
    const nextPool = sess.mode === "shuffle" ? shuffle(sess.roundWrong) : sess.roundWrong.slice();
    sess.round++;
    sess.currentRoundOrder = nextPool;
    sess.pos = 0;
    sess.roundWrong = [];
    sess.answerHistory = new Array(nextPool.length).fill(null);
    sess.reviewMode = false;
    sess.reviewPos = null;
    sess.optionOrders = [];
  }

  el.btnNextRound.addEventListener("click", () => {
    advanceToNextRound();
    saveSession();
    showScreen("quiz");
    renderQuestion();
  });

  el.btnStopHere.addEventListener("click", () => {
    // Roll over to "start of next round" before saving, so a resumed
    // session always points at a valid, unanswered question.
    advanceToNextRound();
    saveSession();
    showScreen("library");
    renderLibrary();
  });

  // ---------- RESULT screen (mastered) ----------
  function finishMastered() {
    clearSession();
    const pct = sess.originalSetLength ? Math.round((sess.firstRoundCorrectCount / sess.originalSetLength) * 100) : 0;
    el.resultScore.textContent = `${sess.firstRoundCorrectCount}/${sess.originalSetLength}`;
    el.resultSub.textContent = `Điểm ngay lần đầu: ${pct}% — hoàn thành sau ${sess.round} vòng.`;
    showScreen("result");
  }

  el.btnRestart.addEventListener("click", () => { showScreen("library"); renderLibrary(); });
  el.btnRetrySame.addEventListener("click", () => openConfig(subject.id));

  // ---------- EXAM mode (timed, ≤20% overlap with previous exam) ----------
  function pickExamQuestions(pool, n, lastIdSet) {
    const nonOverlap = pool.filter((i) => !lastIdSet.has(subject.questions[i].id));
    const overlap = pool.filter((i) => lastIdSet.has(subject.questions[i].id));
    const minNonOverlap = Math.ceil(n * 0.8);
    let chosen = shuffle(nonOverlap).slice(0, Math.min(minNonOverlap, nonOverlap.length));
    const remaining = n - chosen.length;
    chosen = chosen.concat(shuffle(overlap).slice(0, Math.min(remaining, overlap.length)));
    if (chosen.length < n) {
      const used = new Set(chosen);
      const leftover = shuffle(pool.filter((i) => !used.has(i)));
      chosen = chosen.concat(leftover.slice(0, n - chosen.length));
    }
    return shuffle(chosen);
  }

  function startExamWithParams(category, n, minutes) {
    let pool = subject.questions.map((_, i) => i);
    if (category !== "__all__") pool = pool.filter((i) => subject.questions[i].category === category);
    if (pool.length === 0) { setError("Chương này không có câu hỏi."); return; }
    n = Math.max(1, Math.min(n, pool.length));
    minutes = Math.max(1, minutes);

    const history = loadExamHistory(subject.id);
    const lastExam = history.length ? history[history.length - 1] : null;
    const lastIds = new Set(lastExam ? lastExam.questionIds : []);

    const order = pickExamQuestions(pool, n, lastIds);
    const optionOrders = order.map((qIdx) => shuffle(subject.questions[qIdx].options.map((_, i) => i)));
    examSess = {
      category, order, pos: 0,
      answers: new Array(order.length).fill(-1),
      durationSec: minutes * 60,
      endsAt: Date.now() + minutes * 60 * 1000,
      optionOrders,
    };
    startExamTimer();
    showScreen("exam");
    renderExamQuestion();
  }

  el.btnStartExam.addEventListener("click", () => {
    const category = el.examCategorySelect.value;
    const n = parseInt(el.examCount.value, 10) || 20;
    const minutes = parseInt(el.examMinutes.value, 10) || 15;
    startExamWithParams(category, n, minutes);
  });

  function startExamTimer() {
    el.topbarTimer.hidden = false;
    updateTimerDisplay();
    clearInterval(examTimerHandle);
    examTimerHandle = setInterval(() => {
      if (examSess.endsAt - Date.now() <= 0) { finishExam(true); return; }
      updateTimerDisplay();
    }, 1000);
  }
  function updateTimerDisplay() {
    const remain = Math.max(0, examSess.endsAt - Date.now());
    const m = Math.floor(remain / 60000), s = Math.floor((remain % 60000) / 1000);
    el.timerText.textContent = `${m}:${String(s).padStart(2, "0")}`;
  }
  function stopExamTimer() { clearInterval(examTimerHandle); examTimerHandle = null; }

  function renderExamQuestion() {
    const q = subject.questions[examSess.order[examSess.pos]];
    const total = examSess.order.length;
    el.examCurrent.textContent = examSess.pos + 1;
    el.examTotal.textContent = total;
    el.examCat.textContent = q.category;
    el.examProgressFill.style.width = `${(examSess.pos / total) * 100}%`;
    el.examCardQuestion.innerHTML = escapeHtml(q.question);

    el.examCardOptions.innerHTML = "";
    const optOrder = (Array.isArray(examSess.optionOrders) && examSess.optionOrders[examSess.pos]) ||
      q.options.map((_, i) => i);
    optOrder.forEach((i, slot) => {
      const optText = q.options[i];
      const btn = document.createElement("button");
      btn.className = "option";
      btn.type = "button";
      btn.innerHTML = `<span class="option-letter">${slot + 1}</span><span>${escapeHtml(optText)}</span>`;
      btn.addEventListener("click", () => selectExamOption(i, btn));
      el.examCardOptions.appendChild(btn);
    });
    renderMath(el.examCard);
  }

  function selectExamOption(i, btn) {
    const btns = Array.from(el.examCardOptions.children);
    if (btns[0].disabled) return;
    btns.forEach((b) => (b.disabled = true));
    btn.classList.add("is-selected");
    examSess.answers[examSess.pos] = i;
    setTimeout(advanceExam, 180);
  }

  function advanceExam() {
    examSess.pos++;
    if (examSess.pos < examSess.order.length) renderExamQuestion();
    else finishExam(false);
  }

  el.btnSubmitExamEarly.addEventListener("click", () => finishExam(false));

  function finishExam(timeUp) {
    stopExamTimer();
    let correct = 0;
    const wrongList = [];
    examSess.order.forEach((poolIdx, i) => {
      const q = subject.questions[poolIdx];
      const chosen = examSess.answers[i];
      const correctSet = new Set(isMulti(q) ? q.answer : [q.answer]);
      const isCorrect = chosen !== -1 && correctSet.has(chosen);
      if (isCorrect) correct++; else wrongList.push({ qIndex: poolIdx, chosen });
      recordAnswerStat(subject.id, q.id, isCorrect);
    });

    const timeUsedSec = examSess.durationSec - Math.max(0, Math.round((examSess.endsAt - Date.now()) / 1000));
    const record = {
      id: Date.now(), at: Date.now(), category: examSess.category,
      questionIds: examSess.order.map((idx) => subject.questions[idx].id),
      score: correct, total: examSess.order.length,
      durationSec: examSess.durationSec, timeUsedSec,
    };
    const history = loadExamHistory(subject.id);
    history.push(record);
    saveExamHistory(subject.id, history);

    examResultWrong = wrongList;
    examReviewShown = 0;

    el.examResultScore.textContent = `${correct}/${examSess.order.length}`;
    const pct = Math.round((correct / examSess.order.length) * 100);
    const mm = Math.floor(timeUsedSec / 60), ssec = String(timeUsedSec % 60).padStart(2, "0");
    el.examResultSub.textContent = `${pct}%${timeUp ? " — hết giờ" : ""} · thời gian dùng ${mm}:${ssec}`;
    el.examReviewList.innerHTML = "";
    el.btnExamReviewMore.hidden = wrongList.length === 0;
    showScreen("examResult");
    if (wrongList.length) renderExamReviewPage();
  }

  function renderExamReviewPage() {
    const slice = examResultWrong.slice(examReviewShown, examReviewShown + REVIEW_PAGE_SIZE);
    const frag = document.createDocumentFragment();
    for (const w of slice) {
      const q = subject.questions[w.qIndex];
      const yourAnswer = w.chosen === -1 ? "Bỏ trống" : q.options[w.chosen];
      const correctText = isMulti(q) ? q.answer.map((a) => q.options[a]).join(", ") : q.options[q.answer];
      const div = document.createElement("div");
      div.className = "review-item";
      div.innerHTML = `
        <p class="review-q">${escapeHtml(q.question)}</p>
        <p class="review-your">Bạn chọn: ${escapeHtml(yourAnswer)}</p>
        <p class="review-correct">Đáp án đúng: ${escapeHtml(correctText)}</p>
      `;
      frag.appendChild(div);
    }
    el.examReviewList.appendChild(frag);
    examReviewShown += slice.length;
    el.btnExamReviewMore.hidden = examReviewShown >= examResultWrong.length;
    renderMath(el.examReviewList);
  }
  el.btnExamReviewMore.addEventListener("click", renderExamReviewPage);

  el.btnExamRetry.addEventListener("click", () => {
    startExamWithParams(examSess.category, examSess.order.length, examSess.durationSec / 60);
  });
  el.btnExamBack.addEventListener("click", () => { showScreen("library"); renderLibrary(); });

  // ---------- Keyboard shortcuts (quiz / exam screens only) ----------
  document.addEventListener("keydown", (e) => {
    const inQuiz = !el.screenQuiz.hidden;
    const inExam = !el.screenExam.hidden;
    if (!inQuiz && !inExam) return;
    const activeTag = (document.activeElement && document.activeElement.tagName) || "";
    if (activeTag === "TEXTAREA" || activeTag === "INPUT") return;

    if (e.key >= "1" && e.key <= "9") {
      const container = inExam ? el.examCardOptions : el.cardOptions;
      const idx = Number(e.key) - 1;
      const btns = Array.from(container.children);
      if (btns[idx] && !btns[idx].disabled) { e.preventDefault(); btns[idx].click(); }
    } else if (e.key === "Enter" && inQuiz) {
      if (!el.btnNext.disabled) { e.preventDefault(); el.btnNext.click(); }
    }
  });

  // ---------- Init ----------
  (async function init() {
    loadLibrary();
    await ensureDefaultSubject();
    renderLibrary();
    showScreen("library");
  })();
})();
