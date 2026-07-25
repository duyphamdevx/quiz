(() => {
  "use strict";

  const LIB_KEY = "boDeQuiz.library.v1";
  const subjectDataKey = (id) => `boDeQuiz.subject.${id}`;
  const notesKey = (id) => `boDeQuiz.notes.${id}`;
  const sessionKey = (id) => `boDeQuiz.session.${id}`;

  const LETTERS = "ABCDEFGHIJ".split("");

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

    screenConfig: $("screenConfig"), btnBackToLibrary: $("btnBackToLibrary"),
    configTitle: $("configTitle"), configSub: $("configSub"),
    categorySelect: $("categorySelect"), countSelect: $("countSelect"), modeSelect: $("modeSelect"),
    btnStart: $("btnStart"),
    setupResume: $("setupResume"), resumeProgress: $("resumeProgress"), btnResume: $("btnResume"),

    screenQuiz: $("screenQuiz"), roundBadge: $("roundBadge"),
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

  // ---------- Screens ----------
  function showScreen(name) {
    el.screenLibrary.hidden = name !== "library";
    el.screenConfig.hidden = name !== "config";
    el.screenQuiz.hidden = name !== "quiz";
    el.screenRoundComplete.hidden = name !== "roundComplete";
    el.screenResult.hidden = name !== "result";
    el.topbarStats.hidden = name !== "quiz";
    el.btnLibrary.hidden = name === "library";
    el.brandSubject.textContent = (name === "library" || !subject) ? "Bộ Đề" : subject.name;
  }

  // ---------- LIBRARY screen ----------
  function renderLibrary() {
    if (library.length === 0) {
      el.subjectList.innerHTML = `<p class="setup-sub" style="margin:0 0 4px;">Chưa có môn nào — tải lên một file JSON câu hỏi để bắt đầu.</p>`;
      return;
    }
    el.subjectList.innerHTML = "";
    for (const s of library) {
      const savedSess = loadSession(s.id);
      const card = document.createElement("div");
      card.className = "subject-card";
      card.innerHTML = `
        <div class="subject-card-main">
          <p class="subject-card-name">${escapeHtml(s.name)}</p>
          <div class="subject-card-meta">
            <span>${s.count} câu</span>
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

  // ---------- CONFIG screen ----------
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

    const savedSess = loadSession(id);
    if (savedSess) {
      el.setupResume.hidden = false;
      const doneInRound = savedSess.pos;
      el.resumeProgress.textContent = `Vòng ${savedSess.round} — câu ${doneInRound + 1}/${savedSess.currentRoundOrder.length}`;
      el.btnResume.onclick = () => { sess = savedSess; showScreen("quiz"); renderQuestion(); };
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
      firstRoundCorrectCount: 0,
      originalSetLength: originalSet.length,
    };
    saveSession();
    showScreen("quiz");
    renderQuestion();
  });

  // ---------- QUIZ screen ----------
  function currentQuestion() { return subject.questions[sess.currentRoundOrder[sess.pos]]; }

  function renderQuestion() {
    const q = currentQuestion();
    const total = sess.currentRoundOrder.length;

    el.roundBadge.textContent = `Vòng ${sess.round}`;
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
      btn.innerHTML = `<span class="option-letter">${LETTERS[i] || i + 1}</span><span>${escapeHtml(optText)}</span>`;
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

    el.statScore.textContent = (sess.pos + 1) - sess.roundWrong.length;
    el.statSeen.textContent = sess.pos + 1;
    el.btnNext.disabled = false;

    showNoteBox(q);
    saveSession();
  }

  function skipQuestion() {
    const optionBtns = Array.from(el.cardOptions.children);
    if (!optionBtns[0] || !optionBtns[0].disabled) {
      sess.roundWrong.push(sess.currentRoundOrder[sess.pos]);
    }
    advance();
  }

  el.btnSkip.addEventListener("click", skipQuestion);
  el.btnNext.addEventListener("click", advance);

  function advance() {
    sess.pos++;
    if (sess.pos < sess.currentRoundOrder.length) {
      renderQuestion();
    } else if (sess.roundWrong.length === 0) {
      finishMastered();
    } else {
      showRoundComplete();
    }
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

  // ---------- Init ----------
  (async function init() {
    loadLibrary();
    await ensureDefaultSubject();
    renderLibrary();
    showScreen("library");
  })();
})();
