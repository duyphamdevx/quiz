(() => {
  "use strict";

  const LIB_KEY = "boDeQuiz.library.v1";
  const subjectDataKey = (id) => `boDeQuiz.subject.${id}`;
  const notesKey = (id) => `boDeQuiz.notes.${id}`;
  const sessionKey = (id) => `boDeQuiz.session.${id}`;
  const statsKey = (id) => `boDeQuiz.stats.${id}`;      // cumulative correct/wrong per question
  const examKey = (id) => `boDeQuiz.exam.${id}`;        // last exam question ids + exam history
  const ACTIVITY_KEY = "boDeQuiz.activity.v1";          // daily study log, for streak/accuracy

  // (option markers use digit numbers 1-9 so they map directly to keyboard shortcuts)

  // ---------- State ----------
  let library = [];          // [{id, name, count, addedAt}]
  let subject = null;        // { id, name, questions:[...] }
  let notes = {};            // { [qId]: text }  (for current subject)
  let sess = null;           // active/resumed session for current subject

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const el = {
    brandSubject: $("brandSubject"),
    topbarStats: $("topbarStats"), statScore: $("statScore"), statSeen: $("statSeen"),
    btnLibrary: $("btnLibrary"),

    screenLibrary: $("screenLibrary"), subjectList: $("subjectList"),
    fileInput: $("fileInput"), setupError: $("setupError"),
    motivationBar: $("motivationBar"), motStreak: $("motStreak"), motAccuracy: $("motAccuracy"), motTotal: $("motTotal"),
    btnExportData: $("btnExportData"), importFileInput: $("importFileInput"),
    btnCreateManualSubject: $("btnCreateManualSubject"),

    screenConfig: $("screenConfig"), btnBackToLibrary: $("btnBackToLibrary"),
    configTitle: $("configTitle"), configSub: $("configSub"),
    studyTypeSelect: $("studyTypeSelect"),
    categorySelect: $("categorySelect"), countSelect: $("countSelect"), modeSelect: $("modeSelect"),
    modeField: $("modeField"), timeLimitField: $("timeLimitField"), timeLimitSelect: $("timeLimitSelect"),
    setupExamHint: $("setupExamHint"),
    btnStart: $("btnStart"), btnViewStats: $("btnViewStats"), btnManageQuestions: $("btnManageQuestions"),
    setupResume: $("setupResume"), resumeProgress: $("resumeProgress"), btnResume: $("btnResume"),

    screenStats: $("screenStats"), btnBackFromStats: $("btnBackFromStats"),
    statsSubtitle: $("statsSubtitle"), statsList: $("statsList"),

    screenManualEntry: $("screenManualEntry"), btnBackFromManual: $("btnBackFromManual"),
    manualTitle: $("manualTitle"), manualSub: $("manualSub"),
    manualCategory: $("manualCategory"), manualCategoryList: $("manualCategoryList"),
    manualQuestion: $("manualQuestion"),
    manualOptionsList: $("manualOptionsList"), btnAddOption: $("btnAddOption"),
    manualExplanation: $("manualExplanation"),
    manualEditingNote: $("manualEditingNote"), manualError: $("manualError"),
    btnManualClear: $("btnManualClear"), btnManualSave: $("btnManualSave"),
    manualAddedCount: $("manualAddedCount"),
    manualListTitle: $("manualListTitle"), manualQuestionList: $("manualQuestionList"),

    screenQuiz: $("screenQuiz"), roundBadge: $("roundBadge"), examTimer: $("examTimer"),
    quizCurrent: $("quizCurrent"), quizTotal: $("quizTotal"), quizCat: $("quizCat"),
    progressFill: $("progressFill"),
    cardQuestion: $("cardQuestion"), cardOptions: $("cardOptions"),
    noteBox: $("noteBox"), noteDisplay: $("noteDisplay"), noteText: $("noteText"),
    btnEditNote: $("btnEditNote"), btnAddNote: $("btnAddNote"),
    noteEdit: $("noteEdit"), noteTextarea: $("noteTextarea"),
    btnCancelNote: $("btnCancelNote"), btnSaveNote: $("btnSaveNote"),
    btnSkip: $("btnSkip"), btnNext: $("btnNext"),

    screenRoundComplete: $("screenRoundComplete"), roundDoneEyebrow: $("roundDoneEyebrow"),
    roundDoneScore: $("roundDoneScore"), roundDoneSub: $("roundDoneSub"),
    btnNextRound: $("btnNextRound"), btnStopHere: $("btnStopHere"),

    screenExamResult: $("screenExamResult"), examResultEyebrow: $("examResultEyebrow"),
    examResultScore: $("examResultScore"), examResultSub: $("examResultSub"),
    btnExamRetry: $("btnExamRetry"), btnExamBackToLibrary: $("btnExamBackToLibrary"),
    examReviewList: $("examReviewList"),

    screenResult: $("screenResult"), resultScore: $("resultScore"), resultSub: $("resultSub"),
    btnRetrySame: $("btnRetrySame"), btnRestart: $("btnRestart"),
  };

  // ---------- Utilities ----------
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

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

  function setError(msg) {
    if (!msg) { el.setupError.hidden = true; el.setupError.textContent = ""; return; }
    el.setupError.hidden = false; el.setupError.textContent = msg;
  }

  function safeGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function safeSet(key, val) { try { localStorage.setItem(key, val); return true; } catch (e) { return false; } }
  function safeRemove(key) { try { localStorage.removeItem(key); } catch (e) {} }

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
    const entry = { id, name: name.trim() || "Môn học", count: questions.length, addedAt: Date.now() };
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
    safeRemove(examKey(id));
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
    } catch (e) { /* no sample file next to page — fine, library just starts empty */ }
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

  // ---------- Session persistence ----------
  function loadSession(id) {
    try { return JSON.parse(safeGet(sessionKey(id)) || "null"); } catch (e) { return null; }
  }
  function saveSession() {
    if (!subject || !sess) return;
    safeSet(sessionKey(subject.id), JSON.stringify(sess));
  }
  function clearSession() { if (subject) safeRemove(sessionKey(subject.id)); }

  // ---------- Cumulative wrong/correct stats persistence ----------
  function loadStats(id) {
    try { return JSON.parse(safeGet(statsKey(id)) || "{}"); } catch (e) { return {}; }
  }
  function recordStat(id, qId, wasCorrect) {
    const store = loadStats(id);
    if (!store[qId]) store[qId] = { correct: 0, wrong: 0 };
    if (wasCorrect) store[qId].correct++; else store[qId].wrong++;
    safeSet(statsKey(id), JSON.stringify(store));
  }

  // ---------- Exam data persistence (last exam question ids + history) ----------
  function loadExamData(id) {
    try { return JSON.parse(safeGet(examKey(id)) || "{}"); } catch (e) { return {}; }
  }
  function saveExamData(id, data) { safeSet(examKey(id), JSON.stringify(data)); }

  // ---------- Daily activity log (for streak + overall accuracy) ----------
  function fmtDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function loadActivity() {
    try { return JSON.parse(safeGet(ACTIVITY_KEY) || "{}"); } catch (e) { return {}; }
  }
  function recordActivity(wasCorrect) {
    const activity = loadActivity();
    const key = fmtDate(new Date());
    if (!activity[key]) activity[key] = { answered: 0, correct: 0 };
    activity[key].answered++;
    if (wasCorrect) activity[key].correct++;
    safeSet(ACTIVITY_KEY, JSON.stringify(activity));
  }
  function computeStreak(activity) {
    const daySet = new Set(Object.keys(activity).filter((d) => activity[d].answered > 0));
    if (daySet.size === 0) return 0;
    const cursor = new Date();
    if (!daySet.has(fmtDate(cursor))) cursor.setDate(cursor.getDate() - 1); // today not studied yet — check from yesterday
    let streak = 0;
    while (daySet.has(fmtDate(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); }
    return streak;
  }

  // ---------- Screens ----------
  function showScreen(name) {
    if (name !== "quiz") stopExamTimer();
    el.screenLibrary.hidden = name !== "library";
    el.screenConfig.hidden = name !== "config";
    el.screenStats.hidden = name !== "stats";
    el.screenManualEntry.hidden = name !== "manualEntry";
    el.screenQuiz.hidden = name !== "quiz";
    el.screenRoundComplete.hidden = name !== "roundComplete";
    el.screenExamResult.hidden = name !== "examResult";
    el.screenResult.hidden = name !== "result";
    el.topbarStats.hidden = name !== "quiz";
    el.btnLibrary.hidden = name === "library";
    el.brandSubject.textContent = (name === "library" || !subject) ? "Bộ Đề" : subject.name;
  }

  // ---------- LIBRARY screen ----------
  function renderMotivation() {
    const activity = loadActivity();
    const streak = computeStreak(activity);
    let totalCorrect = 0, totalAnswered = 0;
    for (const s of library) {
      const stats = loadStats(s.id);
      for (const k in stats) {
        totalCorrect += stats[k].correct || 0;
        totalAnswered += (stats[k].correct || 0) + (stats[k].wrong || 0);
      }
    }
    if (totalAnswered === 0 && streak === 0) { el.motivationBar.hidden = true; return; }
    el.motivationBar.hidden = false;
    el.motStreak.textContent = streak;
    el.motAccuracy.textContent = totalAnswered ? `${Math.round((totalCorrect / totalAnswered) * 100)}%` : "0%";
    el.motTotal.textContent = totalAnswered;
  }

  function renderLibrary() {
    renderMotivation();
    if (library.length === 0) {
      el.subjectList.innerHTML = `<p class="setup-sub" style="margin:0 0 4px;">Chưa có môn nào — tải lên một file JSON câu hỏi để bắt đầu.</p>`;
      return;
    }
    el.subjectList.innerHTML = "";
    for (const s of library) {
      const savedSess = loadSession(s.id);
      const stats = loadStats(s.id);
      let wrongCount = 0;
      for (const k in stats) if (stats[k].wrong > 0) wrongCount++;
      const card = document.createElement("div");
      card.className = "subject-card";
      card.innerHTML = `
        <div class="subject-card-main">
          <p class="subject-card-name">${escapeHtml(s.name)}</p>
          <div class="subject-card-meta">
            <span>${s.count} câu</span>
            ${wrongCount > 0 ? `<span class="subject-card-progress" style="color:var(--bad)">${wrongCount} câu hay sai</span>` : ""}
            ${savedSess ? `<span class="subject-card-progress">Đang học dở — vòng ${savedSess.round}</span>` : ""}
          </div>
        </div>
        <button class="subject-card-del" title="Xoá môn này" aria-label="Xoá môn này">✕</button>
      `;
      card.querySelector(".subject-card-main").addEventListener("click", () => openConfig(s.id));
      card.querySelector(".subject-card-del").addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm(`Xoá môn "${s.name}" cùng toàn bộ tiến trình và ghi chú?`)) {
          deleteSubject(s.id);
          renderLibrary();
        }
      });
      el.subjectList.appendChild(card);
    }
  }

  // ---------- Export / Import backup ----------
  function exportData() {
    const payload = {
      version: 1, exportedAt: new Date().toISOString(),
      library, subjects: {}, notes: {}, sessions: {}, stats: {}, examData: {},
      activity: loadActivity(),
    };
    for (const s of library) {
      payload.subjects[s.id] = getSubjectQuestions(s.id);
      payload.notes[s.id] = loadNotes(s.id);
      payload.sessions[s.id] = loadSession(s.id);
      payload.stats[s.id] = loadStats(s.id);
      payload.examData[s.id] = loadExamData(s.id);
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bo-de-backup-${fmtDate(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(reader.result);
        if (!payload || !Array.isArray(payload.library)) throw new Error("File backup không đúng định dạng.");
        if (!confirm("Nhập dữ liệu sẽ GHI ĐÈ toàn bộ môn học, tiến trình, ghi chú và thống kê hiện có trên trình duyệt này. Tiếp tục?")) return;
        library = payload.library;
        saveLibrary();
        for (const s of library) {
          safeSet(subjectDataKey(s.id), JSON.stringify(payload.subjects?.[s.id] || []));
          safeSet(notesKey(s.id), JSON.stringify(payload.notes?.[s.id] || {}));
          if (payload.sessions?.[s.id]) safeSet(sessionKey(s.id), JSON.stringify(payload.sessions[s.id]));
          else safeRemove(sessionKey(s.id));
          safeSet(statsKey(s.id), JSON.stringify(payload.stats?.[s.id] || {}));
          safeSet(examKey(s.id), JSON.stringify(payload.examData?.[s.id] || {}));
        }
        safeSet(ACTIVITY_KEY, JSON.stringify(payload.activity || {}));
        setError("");
        renderLibrary();
        alert("Đã nhập dữ liệu thành công.");
      } catch (err) {
        setError("Không nhập được file: " + err.message);
      }
    };
    reader.onerror = () => setError("Không đọc được file.");
    reader.readAsText(file);
  }

  el.btnExportData.addEventListener("click", exportData);
  el.importFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) importData(file);
    el.importFileInput.value = "";
  });

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

  el.btnBackToLibrary.addEventListener("click", () => { showScreen("library"); renderLibrary(); });
  el.btnLibrary.addEventListener("click", () => { showScreen("library"); renderLibrary(); });

  el.btnCreateManualSubject.addEventListener("click", () => {
    const name = (prompt("Đặt tên cho môn học mới:", "") || "").trim();
    if (!name) return;
    try {
      const entry = addSubjectToLibrary(name, []);
      setError("");
      renderLibrary();
      openManualEntry(entry.id, { isNew: true });
    } catch (err) {
      setError(err.message);
    }
  });

  // ---------- CONFIG screen ----------
  let lastStudyType = "practice";

  function applyStudyTypeUI() {
    const isExam = el.studyTypeSelect.value === "exam";
    el.timeLimitField.hidden = !isExam;
    el.modeField.hidden = isExam; // exam is always shuffled
    el.setupExamHint.hidden = !isExam;
    el.btnStart.textContent = isExam ? "Bắt đầu thi thử" : "Bắt đầu vòng 1";
    lastStudyType = el.studyTypeSelect.value;
  }
  el.studyTypeSelect.addEventListener("change", applyStudyTypeUI);

  function openConfig(id) {
    const questions = getSubjectQuestions(id);
    const meta = library.find((s) => s.id === id);
    subject = { id, name: meta ? meta.name : id, questions };
    notes = loadNotes(id);

    el.configTitle.textContent = subject.name;
    el.configSub.textContent = `${questions.length} câu hỏi`;

    const cats = Array.from(new Set(questions.map((q) => q.category)));
    el.categorySelect.innerHTML = ['<option value="__all__">Tất cả chương</option>']
      .concat(cats.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)).join("");

    el.studyTypeSelect.value = lastStudyType;
    applyStudyTypeUI();

    const savedSess = loadSession(id);
    if (savedSess) {
      el.setupResume.hidden = false;
      const doneInRound = savedSess.pos;
      el.resumeProgress.textContent = `Vòng ${savedSess.round} — câu ${doneInRound + 1}/${savedSess.currentRoundOrder.length}`;
      el.btnResume.onclick = () => { sess = savedSess; showScreen("quiz"); renderQuestion(); startExamTimerIfNeeded(); };
    } else {
      el.setupResume.hidden = true;
    }

    showScreen("config");
  }

  function buildPool(category) {
    let pool = subject.questions.map((_, i) => i);
    if (category !== "__all__") pool = pool.filter((i) => subject.questions[i].category === category);
    return pool;
  }

  el.btnViewStats.addEventListener("click", () => { renderSubjectStats(); showScreen("stats"); });
  el.btnBackFromStats.addEventListener("click", () => showScreen("config"));
  el.btnManageQuestions.addEventListener("click", () => openManualEntry(subject.id));

  el.btnStart.addEventListener("click", () => {
    const category = el.categorySelect.value;
    const pool = buildPool(category);
    if (pool.length === 0) { setError("Chương này không có câu hỏi."); return; }
    setError("");

    const countSel = el.countSelect.value;
    const isExam = el.studyTypeSelect.value === "exam";

    if (isExam) {
      const desired = countSel === "all" ? pool.length : Math.min(parseInt(countSel, 10), pool.length);
      const examData = loadExamData(subject.id);
      const lastIds = new Set(examData.lastQuestionIds || []);
      const freshIdx = shuffle(pool.filter((i) => !lastIds.has(subject.questions[i].id)));
      const repeatIdx = shuffle(pool.filter((i) => lastIds.has(subject.questions[i].id)));
      const examSet = freshIdx.length >= desired
        ? freshIdx.slice(0, desired)
        : freshIdx.concat(repeatIdx).slice(0, desired);

      const timeLimitMin = parseInt(el.timeLimitSelect.value, 10);
      sess = {
        examMode: true, category, mode: "shuffle", round: 1,
        currentRoundOrder: examSet,
        pos: 0,
        roundWrong: [],
        firstRoundCorrectCount: 0,
        originalSetLength: examSet.length,
        timeLimitSec: timeLimitMin * 60,
        examDeadline: Date.now() + timeLimitMin * 60 * 1000,
      };
    } else {
      const mode = el.modeSelect.value;
      let originalSet = mode === "shuffle" ? shuffle(pool) : pool.slice();
      const n = countSel === "all" ? originalSet.length : Math.min(parseInt(countSel, 10), originalSet.length);
      originalSet = originalSet.slice(0, n);

      sess = {
        examMode: false, category, mode, round: 1,
        currentRoundOrder: originalSet,
        pos: 0,
        roundWrong: [],
        firstRoundCorrectCount: 0,
        originalSetLength: originalSet.length,
      };
    }

    saveSession();
    showScreen("quiz");
    renderQuestion();
    startExamTimerIfNeeded();
  });

  // ---------- Subject stats screen (câu hay sai luỹ kế) ----------
  function renderSubjectStats() {
    const stats = loadStats(subject.id);
    const rows = subject.questions
      .map((q) => ({ q, wrong: stats[q.id]?.wrong || 0, correct: stats[q.id]?.correct || 0 }))
      .filter((r) => r.wrong > 0)
      .sort((a, b) => b.wrong - a.wrong)
      .slice(0, 200);

    el.statsSubtitle.textContent = rows.length
      ? `${subject.name} — ${rows.length} câu từng làm sai, xếp theo số lần sai nhiều nhất (tính luỹ kế qua mọi lần học).`
      : `${subject.name} — chưa có câu nào bị làm sai. Cứ học tiếp nhé!`;

    el.statsList.innerHTML = "";
    for (const r of rows) {
      const noteTxt = notes[r.q.id] || r.q.explanation || "";
      const item = document.createElement("div");
      item.className = "review-item";
      item.innerHTML = `
        <p class="review-q">${escapeHtml(r.q.question)}</p>
        <p class="review-your">Sai ${r.wrong} lần · đúng ${r.correct} lần</p>
        ${noteTxt ? `<p class="review-correct" style="color:var(--paper-muted)">${escapeHtml(noteTxt)}</p>` : ""}
      `;
      el.statsList.appendChild(item);
    }
  }

  // ---------- MANUAL ENTRY screen (nhập / sửa / xoá câu hỏi thủ công) ----------
  let manualSubjectId = null;
  let manualQuestions = [];      // working copy of the subject's full question list
  let manualIsNewSubject = false;
  let manualEditingId = null;    // id of question currently being edited, or null when adding new
  let manualFormOptions = [];    // array of option strings for the form in progress
  let manualFormCorrect = 0;     // index of the correct option in manualFormOptions
  let manualAddedThisSession = 0;

  function genManualId() { return `m${Date.now()}${Math.floor(Math.random() * 10000)}`; }

  function setManualError(msg) {
    if (!msg) { el.manualError.hidden = true; el.manualError.textContent = ""; return; }
    el.manualError.hidden = false; el.manualError.textContent = msg;
  }

  function persistManualQuestions() {
    safeSet(subjectDataKey(manualSubjectId), JSON.stringify(manualQuestions));
    const entry = library.find((s) => s.id === manualSubjectId);
    if (entry) { entry.count = manualQuestions.length; saveLibrary(); }
    if (subject && subject.id === manualSubjectId) subject.questions = manualQuestions;
  }

  function renderManualOptionsList() {
    el.manualOptionsList.innerHTML = "";
    manualFormOptions.forEach((text, idx) => {
      const row = document.createElement("div");
      row.className = "manual-option-row";
      row.innerHTML = `
        <input type="radio" name="manualAnswerRadio" data-idx="${idx}" ${idx === manualFormCorrect ? "checked" : ""}>
        <input type="text" class="field-control manual-option-input" data-idx="${idx}" placeholder="Đáp án ${idx + 1}">
        <button type="button" class="manual-option-remove" data-idx="${idx}" ${manualFormOptions.length <= 2 ? "disabled" : ""} title="Xoá đáp án này">✕</button>
      `;
      row.querySelector('input[type="text"]').value = text;
      el.manualOptionsList.appendChild(row);
    });
  }

  el.manualOptionsList.addEventListener("input", (e) => {
    if (!e.target.classList.contains("manual-option-input")) return;
    manualFormOptions[Number(e.target.dataset.idx)] = e.target.value;
  });
  el.manualOptionsList.addEventListener("change", (e) => {
    if (e.target.type !== "radio") return;
    manualFormCorrect = Number(e.target.dataset.idx);
  });
  el.manualOptionsList.addEventListener("click", (e) => {
    if (!e.target.classList.contains("manual-option-remove") || e.target.disabled) return;
    const idx = Number(e.target.dataset.idx);
    manualFormOptions.splice(idx, 1);
    if (manualFormCorrect === idx) manualFormCorrect = 0;
    else if (manualFormCorrect > idx) manualFormCorrect--;
    renderManualOptionsList();
  });
  el.btnAddOption.addEventListener("click", () => {
    if (manualFormOptions.length >= 8) { setManualError("Tối đa 8 đáp án cho một câu hỏi."); return; }
    manualFormOptions.push("");
    renderManualOptionsList();
  });

  function softResetManualForm() {
    manualEditingId = null;
    manualFormOptions = ["", "", "", ""];
    manualFormCorrect = 0;
    el.manualQuestion.value = "";
    el.manualExplanation.value = "";
    el.manualEditingNote.hidden = true;
    renderManualOptionsList();
    el.manualQuestion.focus();
  }

  function fullResetManualForm() {
    el.manualCategory.value = "";
    softResetManualForm();
  }

  function renderManualCategoryList() {
    const cats = Array.from(new Set(manualQuestions.map((q) => q.category)));
    el.manualCategoryList.innerHTML = cats.map((c) => `<option value="${escapeHtml(c)}"></option>`).join("");
  }

  function renderManualQuestionList() {
    if (manualQuestions.length === 0) {
      el.manualListTitle.hidden = true;
      el.manualQuestionList.innerHTML = "";
      return;
    }
    el.manualListTitle.hidden = false;
    el.manualListTitle.textContent = `Câu hỏi trong môn này (${manualQuestions.length})`;
    el.manualQuestionList.innerHTML = "";
    const shown = manualQuestions.slice(-200).reverse(); // most recently added first, capped for smooth rendering
    for (const q of shown) {
      const item = document.createElement("div");
      item.className = "review-item";
      item.innerHTML = `
        <p class="review-q">${escapeHtml(q.question)}</p>
        <p class="review-your" style="color:var(--paper-muted)">${escapeHtml(q.category)}</p>
        <div class="manual-q-item-actions">
          <button type="button" class="btn-manual-edit">Sửa</button>
          <button type="button" class="btn-manual-delete is-danger">Xoá</button>
        </div>
      `;
      item.querySelector(".btn-manual-edit").addEventListener("click", () => editManualQuestion(q.id));
      item.querySelector(".btn-manual-delete").addEventListener("click", () => deleteManualQuestion(q.id));
      el.manualQuestionList.appendChild(item);
    }
  }

  function editManualQuestion(id) {
    const q = manualQuestions.find((x) => x.id === id);
    if (!q) return;
    manualEditingId = id;
    el.manualCategory.value = q.category;
    el.manualQuestion.value = q.question;
    manualFormOptions = q.options.slice();
    manualFormCorrect = isMulti(q) ? q.answer[0] : q.answer;
    el.manualExplanation.value = q.explanation || "";
    renderManualOptionsList();
    el.manualEditingNote.hidden = false;
    el.manualEditingNote.innerHTML = isMulti(q)
      ? `Đang sửa câu hỏi này — câu gốc có nhiều đáp án đúng, lưu lại sẽ chuyển về 1 đáp án đúng duy nhất. Bấm "Lưu câu hỏi" để cập nhật, hoặc <button type="button" id="btnCancelManualEdit" class="note-link">huỷ sửa</button>.`
      : `Đang sửa câu hỏi này — bấm "Lưu câu hỏi" để cập nhật, hoặc <button type="button" id="btnCancelManualEdit" class="note-link">huỷ sửa</button>.`;
    $("btnCancelManualEdit").addEventListener("click", () => softResetManualForm());
    setManualError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
    el.manualQuestion.focus();
  }

  function deleteManualQuestion(id) {
    const q = manualQuestions.find((x) => x.id === id);
    if (!q) return;
    if (!confirm(`Xoá câu hỏi này khỏi môn?\n\n"${q.question.slice(0, 80)}${q.question.length > 80 ? "…" : ""}"`)) return;
    manualQuestions = manualQuestions.filter((x) => x.id !== id);
    persistManualQuestions();

    const notesStore = loadNotes(manualSubjectId);
    if (notesStore[id] !== undefined) { delete notesStore[id]; safeSet(notesKey(manualSubjectId), JSON.stringify(notesStore)); }
    const statsStore = loadStats(manualSubjectId);
    if (statsStore[id] !== undefined) { delete statsStore[id]; safeSet(statsKey(manualSubjectId), JSON.stringify(statsStore)); }

    if (manualEditingId === id) softResetManualForm();
    el.manualSub.textContent = `Môn này hiện có ${manualQuestions.length} câu.`;
    renderManualCategoryList();
    renderManualQuestionList();
  }

  el.btnManualClear.addEventListener("click", () => { softResetManualForm(); setManualError(""); });

  el.btnManualSave.addEventListener("click", () => {
    const category = (el.manualCategory.value || "Chung").trim() || "Chung";
    const question = el.manualQuestion.value.trim();
    if (!question) { setManualError("Chưa nhập nội dung câu hỏi."); return; }

    const options = manualFormOptions.map((t) => t.trim());
    if (options.length < 2) { setManualError("Cần ít nhất 2 đáp án."); return; }
    if (options.some((t) => !t)) { setManualError("Có đáp án còn để trống — điền đủ hoặc bấm ✕ để xoá bớt."); return; }
    if (manualFormCorrect < 0 || manualFormCorrect >= options.length) { setManualError("Chưa chọn đáp án đúng."); return; }

    const explanation = el.manualExplanation.value.trim();
    const id = manualEditingId || genManualId();
    const qObj = { id, category, question, options, answer: manualFormCorrect, explanation };

    const existingIdx = manualQuestions.findIndex((x) => x.id === id);
    if (existingIdx >= 0) manualQuestions[existingIdx] = qObj;
    else manualQuestions.push(qObj);

    persistManualQuestions();
    if (!manualEditingId) manualAddedThisSession++;
    el.manualAddedCount.hidden = manualAddedThisSession === 0;
    el.manualAddedCount.textContent = `Đã lưu ${manualAddedThisSession} câu mới trong phiên này.`;
    el.manualSub.textContent = `Môn này hiện có ${manualQuestions.length} câu.`;
    setManualError("");
    softResetManualForm();
    el.manualCategory.value = category; // keep category filled for fast bulk entry
    renderManualCategoryList();
    renderManualQuestionList();
  });

  function openManualEntry(id, opts) {
    manualSubjectId = id;
    manualQuestions = getSubjectQuestions(id);
    manualIsNewSubject = !!(opts && opts.isNew);
    manualAddedThisSession = 0;

    const meta = library.find((s) => s.id === id);
    subject = { id, name: meta ? meta.name : id, questions: manualQuestions };
    notes = loadNotes(id);

    el.manualTitle.textContent = subject.name;
    el.manualSub.textContent = `Môn này hiện có ${manualQuestions.length} câu.`;
    el.manualAddedCount.hidden = true;
    setManualError("");
    fullResetManualForm();
    renderManualCategoryList();
    renderManualQuestionList();
    showScreen("manualEntry");
  }

  el.btnBackFromManual.addEventListener("click", () => {
    if (manualIsNewSubject && manualQuestions.length === 0) {
      deleteSubject(manualSubjectId);
      showScreen("library");
      renderLibrary();
    } else {
      openConfig(manualSubjectId);
    }
  });

  // ---------- QUIZ screen ----------
  function currentQuestion() { return subject.questions[sess.currentRoundOrder[sess.pos]]; }

  function renderQuestion() {
    const q = currentQuestion();
    const total = sess.currentRoundOrder.length;

    el.roundBadge.textContent = sess.examMode ? "⏱ Thi thử" : `Vòng ${sess.round}`;
    el.examTimer.hidden = !sess.examMode;
    el.quizCurrent.textContent = sess.pos + 1;
    el.quizTotal.textContent = total;
    el.quizCat.textContent = q.category;
    el.progressFill.style.width = `${(sess.pos / total) * 100}%`;

    el.statScore.textContent = Math.max(0, sess.pos - sess.roundWrong.length);
    el.statSeen.textContent = sess.pos;

    el.cardQuestion.textContent = q.question;
    el.btnNext.disabled = true;
    el.btnNext.textContent = sess.pos + 1 >= total ? "Hoàn tất vòng này" : "Câu tiếp theo";

    resetNoteBox();

    const multi = isMulti(q);
    const correctSet = new Set(multi ? q.answer : [q.answer]);

    el.cardOptions.innerHTML = "";
    q.options.forEach((optText, i) => {
      const btn = document.createElement("button");
      btn.className = "option";
      btn.type = "button";
      btn.innerHTML = `<span class="option-letter">${i + 1}</span><span>${escapeHtml(optText)}</span>`;
      btn.addEventListener("click", () => handleAnswer(i, correctSet, q));
      el.cardOptions.appendChild(btn);
    });

    saveSession();
  }

  function handleAnswer(i, correctSet, q) {
    const optionBtns = Array.from(el.cardOptions.children);
    if (optionBtns[0].disabled) return; // already answered

    optionBtns.forEach((b, idx) => {
      b.disabled = true;
      if (correctSet.has(idx)) b.classList.add("is-correct");
    });
    const wasCorrect = correctSet.has(i);
    if (!wasCorrect) optionBtns[i].classList.add("is-wrong");

    if (wasCorrect) {
      if (sess.round === 1) sess.firstRoundCorrectCount++;
    } else {
      sess.roundWrong.push(sess.currentRoundOrder[sess.pos]);
    }

    recordStat(subject.id, q.id, wasCorrect);
    recordActivity(wasCorrect);

    el.statScore.textContent = (sess.pos + 1) - sess.roundWrong.length;
    el.statSeen.textContent = sess.pos + 1;
    el.btnNext.disabled = false;

    showNoteBox(q);
    saveSession();
  }

  function skipQuestion() {
    const optionBtns = Array.from(el.cardOptions.children);
    if (!optionBtns[0] || !optionBtns[0].disabled) {
      const q = currentQuestion();
      sess.roundWrong.push(sess.currentRoundOrder[sess.pos]);
      recordStat(subject.id, q.id, false);
      recordActivity(false);
    }
    advance();
  }

  el.btnSkip.addEventListener("click", skipQuestion);
  el.btnNext.addEventListener("click", advance);

  function advance() {
    sess.pos++;
    if (sess.pos < sess.currentRoundOrder.length) {
      renderQuestion();
    } else if (sess.examMode) {
      finishExam(false);
    } else if (sess.roundWrong.length === 0) {
      finishMastered();
    } else {
      showRoundComplete();
    }
  }

  // ---------- Exam timer ----------
  let examTimerInterval = null;

  function stopExamTimer() {
    if (examTimerInterval) { clearInterval(examTimerInterval); examTimerInterval = null; }
  }
  function startExamTimerIfNeeded() {
    stopExamTimer();
    if (!sess || !sess.examMode) return;
    updateExamTimerDisplay(sess.examDeadline - Date.now());
    examTimerInterval = setInterval(checkExamTimeout, 1000);
  }
  function updateExamTimerDisplay(remainMs) {
    const s = Math.max(0, Math.ceil(remainMs / 1000));
    const m = Math.floor(s / 60), sec = s % 60;
    el.examTimer.textContent = `⏱ ${m}:${String(sec).padStart(2, "0")}`;
    el.examTimer.classList.toggle("exam-timer-warn", s <= 30);
  }
  function checkExamTimeout() {
    if (!sess || !sess.examMode) { stopExamTimer(); return; }
    const remain = sess.examDeadline - Date.now();
    if (remain > 0) { updateExamTimerDisplay(remain); return; }
    // time's up
    const optionBtns = Array.from(el.cardOptions.children);
    if (optionBtns[0] && !optionBtns[0].disabled) {
      // current question still unanswered — count it as wrong/skipped
      const q = currentQuestion();
      sess.roundWrong.push(sess.currentRoundOrder[sess.pos]);
      recordStat(subject.id, q.id, false);
      recordActivity(false);
      sess.pos++;
    } else if (optionBtns[0]) {
      // already answered, just hadn't clicked "next" yet — include it in the total
      sess.pos++;
    }
    finishExam(true);
  }

  // ---------- Note box (giải thích, tự lưu) ----------
  let noteState = { qId: null, editing: false };

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
      el.noteText.textContent = text;
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
  el.btnCancelNote.addEventListener("click", () => {
    const q = currentQuestion();
    showNoteBox(q);
  });
  el.btnSaveNote.addEventListener("click", () => {
    const text = el.noteTextarea.value.trim();
    notes = saveNoteFor(subject.id, noteState.qId, text);
    const q = currentQuestion();
    showNoteBox(q);
  });

  // ---------- ROUND COMPLETE screen ----------
  function showRoundComplete() {
    const total = sess.currentRoundOrder.length;
    const wrong = sess.roundWrong.length;
    const correct = total - wrong;
    el.roundDoneEyebrow.textContent = `Xong vòng ${sess.round}`;
    el.roundDoneScore.textContent = `${correct}/${total}`;
    el.roundDoneSub.textContent = `${wrong} câu sai sẽ được hỏi lại ở vòng ${sess.round + 1}.`;
    showScreen("roundComplete");
  }

  function advanceToNextRound() {
    const nextPool = sess.mode === "shuffle" ? shuffle(sess.roundWrong) : sess.roundWrong.slice();
    sess.round++;
    sess.currentRoundOrder = nextPool;
    sess.pos = 0;
    sess.roundWrong = [];
  }

  el.btnNextRound.addEventListener("click", () => {
    advanceToNextRound();
    saveSession();
    showScreen("quiz");
    renderQuestion();
  });

  el.btnStopHere.addEventListener("click", () => {
    // Roll the session over to "start of next round" before saving, so a
    // resumed session always points at a valid, unanswered question.
    advanceToNextRound();
    saveSession();
    showScreen("library");
    renderLibrary();
  });

  // ---------- EXAM RESULT screen ----------
  function finishExam(timedOut) {
    stopExamTimer();
    clearSession();

    const total = sess.pos;
    const wrongIdxArr = sess.roundWrong.slice();
    const correct = total - wrongIdxArr.length;

    const examQuestionIds = sess.currentRoundOrder.map((i) => subject.questions[i].id);
    const examData = loadExamData(subject.id);
    examData.lastQuestionIds = examQuestionIds;
    examData.history = examData.history || [];
    examData.history.unshift({
      date: Date.now(), total, correct, wrong: wrongIdxArr.length,
      timeLimitSec: sess.timeLimitSec, timedOut, category: sess.category,
    });
    examData.history = examData.history.slice(0, 20);
    saveExamData(subject.id, examData);

    renderExamResult(total, correct, wrongIdxArr, timedOut);
    showScreen("examResult");
  }

  function renderExamResult(total, correct, wrongIdxArr, timedOut) {
    const pct = total ? Math.round((correct / total) * 100) : 0;
    el.examResultEyebrow.textContent = timedOut ? "Hết giờ" : "Hoàn thành đúng giờ";
    el.examResultScore.textContent = `${correct}/${total}`;
    el.examResultSub.textContent = `Đạt ${pct}%${timedOut ? " — hết thời gian trước khi làm hết." : "."} Lần thi sau sẽ ưu tiên câu chưa xuất hiện ở đề này.`;

    el.examReviewList.innerHTML = "";
    if (wrongIdxArr.length === 0) {
      el.examReviewList.innerHTML = `<p class="setup-sub" style="margin:0;">Không có câu sai nào 🎉</p>`;
      return;
    }
    for (const idx of wrongIdxArr) {
      const q = subject.questions[idx];
      const correctText = isMulti(q) ? q.answer.map((a) => q.options[a]).join(", ") : q.options[q.answer];
      const item = document.createElement("div");
      item.className = "review-item";
      item.innerHTML = `<p class="review-q">${escapeHtml(q.question)}</p><p class="review-correct">Đáp án đúng: ${escapeHtml(correctText)}</p>`;
      el.examReviewList.appendChild(item);
    }
  }

  el.btnExamRetry.addEventListener("click", () => { el.studyTypeSelect.value = "exam"; openConfig(subject.id); });
  el.btnExamBackToLibrary.addEventListener("click", () => { showScreen("library"); renderLibrary(); });

  // ---------- RESULT screen (mastered) ----------
  function finishMastered() {
    clearSession();
    const pct = sess.originalSetLength ? Math.round((sess.firstRoundCorrectCount / sess.originalSetLength) * 100) : 0;
    el.resultScore.textContent = `${sess.firstRoundCorrectCount}/${sess.originalSetLength}`;
    el.resultSub.textContent = `Điểm ngay lần đầu: ${pct}% — hoàn thành sau ${sess.round} vòng.`;
    showScreen("result");
  }

  el.btnRestart.addEventListener("click", () => { showScreen("library"); renderLibrary(); });
  el.btnRetrySame.addEventListener("click", () => { openConfig(subject.id); });

  // ---------- Keyboard shortcuts (quiz screen only) ----------
  document.addEventListener("keydown", (e) => {
    if (el.screenQuiz.hidden) return;
    const activeTag = (document.activeElement && document.activeElement.tagName) || "";
    if (activeTag === "TEXTAREA" || activeTag === "INPUT") return; // don't hijack while typing a note

    if (e.key >= "1" && e.key <= "9") {
      const idx = Number(e.key) - 1;
      const btns = Array.from(el.cardOptions.children);
      if (btns[idx] && !btns[idx].disabled) {
        e.preventDefault();
        btns[idx].click();
      }
    } else if (e.key === "Enter") {
      if (!el.btnNext.disabled) {
        e.preventDefault();
        el.btnNext.click();
      }
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
