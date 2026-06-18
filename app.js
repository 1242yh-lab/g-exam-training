// ==============================
// G検定トレーニング v2
// ==============================

// 現在のクイズ状態
let currentQuiz = {
  mode: "quick",
  category: "all",
  questions: [],
  currentIndex: 0,
  answers: [],
  startTime: null,
  shuffledChoices: []
};

// ローカルストレージのキー
const STORAGE_KEYS = {
  history: "g_exam_history_v2",
  progress: "g_exam_progress_v1"
};

// 出題モード
const QUIZ_MODES = {
  quick: {
    label: "今日の10問",
    questionCount: 10
  },
  category: {
    label: "分野別練習",
    questionCount: 10
  },
  wrong: {
    label: "間違えた問題だけ",
    questionCount: 20
  },
  weak: {
    label: "苦手問題集中",
    questionCount: 20
  },
  mock: {
    label: "模試モード",
    questionCount: 145
  }
};

// 初期化
document.addEventListener("DOMContentLoaded", () => {
  prepareQuestions();
  renderCategoryButtons();
  updateStats();
});

// ==============================
// 問題データの下準備
// ==============================

// 既存 questions.js に id/topic/difficulty がなくても動くように補完する
function prepareQuestions() {
  questions.forEach((q, index) => {
    if (!q.id) {
      q.id = createQuestionId(q, index);
    }

    if (!q.topic) {
      q.topic = guessTopic(q);
    }

    if (!q.difficulty) {
      q.difficulty = "standard";
    }

    if (!q.tags) {
      q.tags = [];
    }

    if (!q.status) {
      q.status = "active";
    }
  });
}

// 問題IDを自動生成する
function createQuestionId(question, index) {
  const categoryCode = getCategoryCode(question.category);
  return `${categoryCode}-${String(index + 1).padStart(4, "0")}`;
}

// カテゴリ名から短いコードを作る
function getCategoryCode(category) {
  const map = {
    "AI基礎": "AI",
    "機械学習": "ML",
    "ディープラーニング基礎": "DLB",
    "ディープラーニング手法": "DLM",
    "ディープラーニング応用": "DLA",
    "自然言語処理": "NLP",
    "画像認識": "CV",
    "生成AI": "GEN",
    "法律・倫理": "LAW",
    "数理・統計": "MATH"
  };

  return map[category] || "Q";
}

// ざっくりtopicを推定する
// 後で questions.js 側に topic を直接書くようになったら、そちらが優先される
function guessTopic(question) {
  const text = `${question.question} ${question.explanation || ""}`;

  if (text.includes("Transformer") || text.includes("Attention") || text.includes("アテンション")) {
    return "Transformer・Attention";
  }

  if (text.includes("CNN") || text.includes("畳み込み")) {
    return "CNN";
  }

  if (text.includes("RNN") || text.includes("LSTM") || text.includes("系列")) {
    return "RNN・系列処理";
  }

  if (text.includes("個人情報") || text.includes("著作権") || text.includes("倫理") || text.includes("ガバナンス")) {
    return "法律・倫理";
  }

  if (text.includes("ReLU") || text.includes("シグモイド") || text.includes("活性化関数")) {
    return "活性化関数";
  }

  if (text.includes("過学習") || text.includes("正則化") || text.includes("ドロップアウト")) {
    return "過学習・正則化";
  }

  if (text.includes("評価指標") || text.includes("適合率") || text.includes("再現率") || text.includes("F値")) {
    return "評価指標";
  }

  return question.category;
}

// ==============================
// ホーム画面
// ==============================

function renderCategoryButtons() {
  const categories = [...new Set(questions.map(q => q.category))];
  const container = document.getElementById("category-buttons");
  container.innerHTML = "";

  categories.forEach(category => {
    const count = questions.filter(q => q.category === category).length;

    const btn = document.createElement("button");
    btn.className = "btn btn-category";
    btn.innerHTML = `${escapeHtml(category)} <small>(${count}問)</small>`;
    btn.onclick = () => startQuiz("category", category);

    container.appendChild(btn);
  });
}

function updateStats() {
  const history = loadHistory();
  const totalAttempts = history.length;

  document.getElementById("total-questions").textContent = totalAttempts;

  if (totalAttempts === 0) {
    document.getElementById("overall-accuracy").textContent = "0%";
    return;
  }

  const correctCount = history.filter(h => h.isCorrect).length;
  const accuracy = Math.round((correctCount / totalAttempts) * 100);

  document.getElementById("overall-accuracy").textContent = `${accuracy}%`;
}

// ==============================
// 出題
// ==============================

function startQuiz(mode = "quick", category = "all") {
  currentQuiz.mode = mode;
  currentQuiz.category = category;
  currentQuiz.currentIndex = 0;
  currentQuiz.answers = [];
  currentQuiz.startTime = Date.now();

  currentQuiz.questions = pickQuestions(mode, category);

  if (currentQuiz.questions.length === 0) {
    alert("この条件で出題できる問題がありません。まずは通常の問題を解いて履歴をためてみてください。");
    return;
  }

  showScreen("quiz-screen");
  showQuestion();
}

function pickQuestions(mode, category = "all") {
  let pool = questions.filter(q => q.status !== "inactive");

  if (category !== "all") {
    pool = pool.filter(q => q.category === category);
  }

  if (mode === "wrong") {
    pool = pool.filter(q => {
      const progress = getQuestionProgress(q.id);
      return progress.wrongCount > 0;
    });
  }

  if (mode === "weak") {
    pool = pool
      .filter(q => {
        const progress = getQuestionProgress(q.id);
        return progress.attemptCount > 0;
      })
      .sort((a, b) => getMastery(a.id) - getMastery(b.id));
  } else {
    pool = shuffleArray([...pool]);
  }

  const count = QUIZ_MODES[mode]?.questionCount || 10;

  return pool.slice(0, Math.min(count, pool.length));
}

function showQuestion() {
  const question = currentQuiz.questions[currentQuiz.currentIndex];

  if (!question) {
    showResult();
    return;
  }

  const progress = ((currentQuiz.currentIndex + 1) / currentQuiz.questions.length) * 100;

  document.getElementById("progress-fill").style.width = `${progress}%`;
  document.getElementById("question-number").textContent =
    `${currentQuiz.currentIndex + 1}/${currentQuiz.questions.length}`;

  document.getElementById("current-category").textContent =
    `${question.category} / ${question.topic}`;

  document.getElementById("question-text").textContent = question.question;

  const choicesContainer = document.getElementById("choices");
  choicesContainer.innerHTML = "";

  currentQuiz.shuffledChoices = shuffleArray(
    question.choices.map((choice, index) => ({
      text: choice,
      originalIndex: index
    }))
  );

  currentQuiz.shuffledChoices.forEach((choiceObj, index) => {
    const choiceDiv = document.createElement("div");
    choiceDiv.className = "choice";
    choiceDiv.textContent = choiceObj.text;
    choiceDiv.onclick = () => selectAnswer(index);

    choicesContainer.appendChild(choiceDiv);
  });
}

function selectAnswer(selectedIndex) {
  const question = currentQuiz.questions[currentQuiz.currentIndex];
  const choices = document.querySelectorAll(".choice");
  const selectedChoice = currentQuiz.shuffledChoices[selectedIndex];

  const isCorrect = selectedChoice.originalIndex === question.correct;

  choices.forEach(choice => {
    choice.classList.add("disabled");
    choice.onclick = null;
  });

  const correctDisplayIndex = currentQuiz.shuffledChoices.findIndex(
    choice => choice.originalIndex === question.correct
  );

  choices[selectedIndex].classList.add(isCorrect ? "correct" : "incorrect");
  choices[correctDisplayIndex].classList.add("correct");

  const choicesContainer = document.getElementById("choices");

  const explanation = document.createElement("div");
  explanation.className = "explanation";
  explanation.innerHTML = `
    <div class="explanation-title">${isCorrect ? "✓ 正解！" : "✗ 不正解"}</div>
    <div>${escapeHtml(question.explanation || "解説はまだありません。")}</div>
  `;

  choicesContainer.appendChild(explanation);

  const nextButton = document.createElement("button");
  nextButton.className = "btn btn-primary next-button";
  nextButton.textContent =
    currentQuiz.currentIndex < currentQuiz.questions.length - 1
      ? "次の問題へ"
      : "結果を見る";

  nextButton.onclick = () => {
    if (currentQuiz.currentIndex < currentQuiz.questions.length - 1) {
      currentQuiz.currentIndex++;
      showQuestion();
    } else {
      showResult();
    }
  };

  choicesContainer.appendChild(nextButton);

  const answerRecord = {
    questionId: question.id,
    question: question.question,
    category: question.category,
    topic: question.topic,
    difficulty: question.difficulty,
    selectedIndex: selectedIndex,
    selectedOriginalIndex: selectedChoice.originalIndex,
    correctOriginalIndex: question.correct,
    correctIndex: correctDisplayIndex,
    isCorrect: isCorrect,
    choices: currentQuiz.shuffledChoices.map(choice => choice.text),
    timestamp: Date.now()
  };

  currentQuiz.answers.push(answerRecord);

  saveAnswerToHistory(answerRecord);
  updateQuestionProgress(question.id, isCorrect);
}

// ==============================
// 結果表示
// ==============================

function showResult() {
  const correctCount = currentQuiz.answers.filter(a => a.isCorrect).length;
  const total = currentQuiz.answers.length;
  const percentage = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  document.getElementById("score").textContent = correctCount;
  document.getElementById("total").textContent = total;
  document.getElementById("percentage").textContent = `正答率: ${percentage}%`;

  const detailsContainer = document.getElementById("result-details");
  detailsContainer.innerHTML = "<h2>詳細結果</h2>";

  currentQuiz.answers.forEach((answer, index) => {
    const resultItem = document.createElement("div");
    resultItem.className = `result-item ${answer.isCorrect ? "correct" : "incorrect"}`;

    const yourAnswer = answer.choices[answer.selectedIndex];
    const correctAnswer = answer.choices[answer.correctIndex];

    resultItem.innerHTML = `
      <div class="result-item-header">
        <div class="result-item-question">
          問${index + 1}: ${escapeHtml(answer.question)}
        </div>
        <div class="result-item-status ${answer.isCorrect ? "correct" : "incorrect"}">
          ${answer.isCorrect ? "正解" : "不正解"}
        </div>
      </div>

      <div class="result-item-answer">
        分野: ${escapeHtml(answer.category)} / ${escapeHtml(answer.topic)}<br>
        あなたの回答: ${escapeHtml(yourAnswer)}
        ${answer.isCorrect ? "" : `<br>正解: ${escapeHtml(correctAnswer)}`}
      </div>
    `;

    detailsContainer.appendChild(resultItem);
  });

  showScreen("result-screen");
  updateStats();
}

// ==============================
// 分析
// ==============================

function showAnalysis() {
  const history = loadHistory();

  if (history.length === 0) {
    document.getElementById("analysis-content").innerHTML =
      '<div class="no-data">まだデータがありません。<br>クイズに挑戦して学習履歴を蓄積しましょう！</div>';

    showScreen("analysis-screen");
    return;
  }

  const container = document.getElementById("analysis-content");
  container.innerHTML = "";

  const categoryStats = createStats(history, "category");
  const topicStats = createStats(history, "topic");

  container.innerHTML += "<h2>分野別正答率</h2>";
  renderStats(container, categoryStats, "category");

  container.innerHTML += "<h2>苦手トピック</h2>";
  renderStats(container, topicStats.slice(0, 10), "topic");

  showScreen("analysis-screen");
}

function createStats(history, key) {
  const names = [...new Set(history.map(h => h[key] || "未分類"))];

  return names.map(name => {
    const records = history.filter(h => (h[key] || "未分類") === name);
    const total = records.length;
    const correct = records.filter(h => h.isCorrect).length;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    return {
      name,
      total,
      correct,
      accuracy
    };
  })
  .filter(stat => stat.total > 0)
  .sort((a, b) => a.accuracy - b.accuracy);
}

function renderStats(container, stats, type) {
  stats.forEach(stat => {
    const div = document.createElement("div");
    div.className = "analysis-category";

    let barClass = "";
    if (stat.accuracy < 50) {
      barClass = "low";
    } else if (stat.accuracy < 70) {
      barClass = "medium";
    }

    const practiceButton =
      type === "category"
        ? `<button class="btn btn-primary practice-btn" onclick="startQuiz('category', '${escapeAttr(stat.name)}')">この分野を練習する</button>`
        : "";

    div.innerHTML = `
      <div class="analysis-category-header">
        <div class="analysis-category-name">${escapeHtml(stat.name)}</div>
        <div class="analysis-stats">
          <span class="analysis-stat">${stat.correct}/${stat.total}問正解</span>
        </div>
      </div>

      <div class="analysis-bar">
        <div class="analysis-bar-fill ${barClass}" style="width: ${stat.accuracy}%">
          ${stat.accuracy}%
        </div>
      </div>

      ${practiceButton}
    `;

    container.appendChild(div);
  });
}

// ==============================
// 学習履歴・進捗
// ==============================

function saveAnswerToHistory(record) {
  const history = loadHistory();

  history.push({
    questionId: record.questionId,
    category: record.category,
    topic: record.topic,
    difficulty: record.difficulty,
    isCorrect: record.isCorrect,
    selectedOriginalIndex: record.selectedOriginalIndex,
    correctOriginalIndex: record.correctOriginalIndex,
    timestamp: record.timestamp
  });

  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history));
}

function loadHistory() {
  const newData = localStorage.getItem(STORAGE_KEYS.history);

  if (newData) {
    return JSON.parse(newData);
  }

  // 旧履歴がある場合の簡易移行
  const oldData = localStorage.getItem("g_exam_history");

  if (oldData) {
    const oldHistory = JSON.parse(oldData).map((h, index) => ({
      questionId: h.questionId || `OLD-${String(index + 1).padStart(4, "0")}`,
      category: h.category,
      topic: h.topic || h.category,
      difficulty: h.difficulty || "standard",
      isCorrect: h.isCorrect,
      timestamp: h.timestamp || Date.now()
    }));

    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(oldHistory));
    return oldHistory;
  }

  return [];
}

function loadProgress() {
  const data = localStorage.getItem(STORAGE_KEYS.progress);
  return data ? JSON.parse(data) : {};
}

function saveProgress(progress) {
  localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(progress));
}

function getQuestionProgress(questionId) {
  const progress = loadProgress();

  return progress[questionId] || {
    attemptCount: 0,
    correctCount: 0,
    wrongCount: 0,
    lastResult: null,
    lastAnsweredAt: null,
    mastery: 0
  };
}

function updateQuestionProgress(questionId, isCorrect) {
  const progress = loadProgress();

  const current = progress[questionId] || {
    attemptCount: 0,
    correctCount: 0,
    wrongCount: 0,
    lastResult: null,
    lastAnsweredAt: null,
    mastery: 0
  };

  current.attemptCount++;
  current.lastResult = isCorrect;
  current.lastAnsweredAt = Date.now();

  if (isCorrect) {
    current.correctCount++;
    current.mastery = Math.min(100, current.mastery + 20);
  } else {
    current.wrongCount++;
    current.mastery = Math.max(0, current.mastery - 15);
  }

  progress[questionId] = current;
  saveProgress(progress);
}

function getMastery(questionId) {
  return getQuestionProgress(questionId).mastery;
}

// ==============================
// 共通処理
// ==============================

function shuffleArray(array) {
  const copied = [...array];

  for (let i = copied.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }

  return copied;
}

function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach(screen => {
    screen.classList.remove("active");
  });

  document.getElementById(screenId).classList.add("active");
}

function quitQuiz() {
  if (confirm("クイズを中断してホームに戻りますか？")) {
    backToStart();
  }
}

function retryQuiz() {
  startQuiz(currentQuiz.mode, currentQuiz.category);
}

function backToStart() {
  updateStats();
  showScreen("start-screen");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return String(value).replaceAll("'", "\\'");
}
function resetLearningData() {
  const confirmed = confirm(
    "学習履歴と問題ごとの進捗をリセットします。\n本当に削除しますか？"
  );

  if (!confirmed) {
    return;
  }

  localStorage.removeItem(STORAGE_KEYS.history);
  localStorage.removeItem(STORAGE_KEYS.progress);
  localStorage.removeItem("g_exam_history");

  currentQuiz = {
    mode: "quick",
    category: "all",
    questions: [],
    currentIndex: 0,
    answers: [],
    startTime: null,
    shuffledChoices: []
  };

  updateStats();
  showScreen("start-screen");

  alert("学習データをリセットしました。");
}
