// アプリケーションの状態管理 v2
let currentQuiz = {
    category: null,
    questions: [],
    currentIndex: 0,
    answers: [],
    startTime: null,
    shuffledChoices: []
};

// ローカルストレージのキー
const STORAGE_KEY = 'g_exam_history';

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    loadHistory();
    renderCategoryButtons();
    updateStats();
});

// カテゴリボタンの生成
function renderCategoryButtons() {
    const categories = [...new Set(questions.map(q => q.category))];
    const container = document.getElementById('category-buttons');

    categories.forEach(category => {
        const count = questions.filter(q => q.category === category).length;
        const btn = document.createElement('button');
        btn.className = 'btn btn-category';
        btn.innerHTML = `${category} <small>(${count}問)</small>`;
        btn.onclick = () => startQuiz(category);
        container.appendChild(btn);
    });
}

// 統計情報の更新
function updateStats() {
    const history = loadHistory();
    const totalAttempts = history.length;

    document.getElementById('total-questions').textContent = totalAttempts;

    if (totalAttempts > 0) {
        const correctCount = history.filter(h => h.isCorrect).length;
        const accuracy = Math.round((correctCount / totalAttempts) * 100);
        document.getElementById('overall-accuracy').textContent = accuracy + '%';
    } else {
        document.getElementById('overall-accuracy').textContent = '0%';
    }
}

// クイズ開始
function startQuiz(category) {
    currentQuiz.category = category;
    currentQuiz.currentIndex = 0;
    currentQuiz.answers = [];
    currentQuiz.startTime = Date.now();

    // 問題の選択
    if (category === 'all') {
        currentQuiz.questions = shuffleArray([...questions]).slice(0, 20);
    } else {
        const categoryQuestions = questions.filter(q => q.category === category);
        currentQuiz.questions = shuffleArray([...categoryQuestions]).slice(0, Math.min(10, categoryQuestions.length));
    }

    showScreen('quiz-screen');
    showQuestion();
}

// 配列のシャッフル
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// 問題表示
function showQuestion() {
    const question = currentQuiz.questions[currentQuiz.currentIndex];
    const progress = ((currentQuiz.currentIndex + 1) / currentQuiz.questions.length) * 100;

    document.getElementById('progress-fill').style.width = progress + '%';
    document.getElementById('question-number').textContent =
        `${currentQuiz.currentIndex + 1}/${currentQuiz.questions.length}`;
    document.getElementById('current-category').textContent = question.category;
    document.getElementById('question-text').textContent = question.question;

    const choicesContainer = document.getElementById('choices');
    choicesContainer.innerHTML = '';

    // 選択肢を「本文」と「元の番号」のセットにしてからシャッフル
    currentQuiz.shuffledChoices = shuffleArray(
        question.choices.map((choice, index) => ({
            text: choice,
            originalIndex: index
        }))
    );

    currentQuiz.shuffledChoices.forEach((choiceObj, index) => {
        const choiceDiv = document.createElement('div');
        choiceDiv.className = 'choice';
        choiceDiv.textContent = choiceObj.text;
        choiceDiv.onclick = () => selectAnswer(index);
        choicesContainer.appendChild(choiceDiv);
    });
}

// 問題回答
function selectAnswer(selectedIndex) {
    const question = currentQuiz.questions[currentQuiz.currentIndex];
    const choices = document.querySelectorAll('.choice');

    const selectedChoice = currentQuiz.shuffledChoices[selectedIndex];
    const isCorrect = selectedChoice.originalIndex === question.correct;

    // 選択を無効化
    choices.forEach(choice => {
        choice.classList.add('disabled');
        choice.onclick = null;
    });

    // 正解が画面上の何番目に表示されているか探す
    const correctDisplayIndex = currentQuiz.shuffledChoices.findIndex(
        choice => choice.originalIndex === question.correct
    );

    // 正解・不正解の表示
    choices[selectedIndex].classList.add(isCorrect ? 'correct' : 'incorrect');
    choices[correctDisplayIndex].classList.add('correct');

    // 解説を表示
    const choicesContainer = document.getElementById('choices');
    const explanation = document.createElement('div');
    explanation.className = 'explanation';
    explanation.innerHTML = `
        <div class="explanation-title">${isCorrect ? '✓ 正解！' : '✗ 不正解'}</div>
        <div>${question.explanation}</div>
    `;
    choicesContainer.appendChild(explanation);

    // 次へボタンを追加
    const nextButton = document.createElement('button');
    nextButton.className = 'btn btn-primary next-button';
    nextButton.textContent = currentQuiz.currentIndex < currentQuiz.questions.length - 1 ? '次の問題へ' : '結果を見る';
    nextButton.onclick = () => {
        if (currentQuiz.currentIndex < currentQuiz.questions.length - 1) {
            currentQuiz.currentIndex++;
            showQuestion();
        } else {
            showResult();
        }
    };
    choicesContainer.appendChild(nextButton);

    // 回答を記録
    currentQuiz.answers.push({
        question: question.question,
        category: question.category,
        selectedIndex: selectedIndex,
        correctIndex: correctDisplayIndex,
        isCorrect: isCorrect,
        choices: currentQuiz.shuffledChoices.map(choice => choice.text)
    });

    // 履歴を保存
    saveToHistory({
        category: question.category,
        isCorrect: isCorrect,
        timestamp: Date.now()
    });
}

// 結果表示
function showResult() {
    const correctCount = currentQuiz.answers.filter(a => a.isCorrect).length;
    const total = currentQuiz.answers.length;
    const percentage = Math.round((correctCount / total) * 100);

    document.getElementById('score').textContent = correctCount;
    document.getElementById('total').textContent = total;
    document.getElementById('percentage').textContent = `正答率: ${percentage}%`;

    // 詳細結果の表示
    const detailsContainer = document.getElementById('result-details');
    detailsContainer.innerHTML = '<h2>詳細結果</h2>';

    currentQuiz.answers.forEach((answer, index) => {
        const resultItem = document.createElement('div');
        resultItem.className = `result-item ${answer.isCorrect ? 'correct' : 'incorrect'}`;

        resultItem.innerHTML = `
            <div class="result-item-header">
                <div class="result-item-question">問${index + 1}: ${answer.question}</div>
                <div class="result-item-status ${answer.isCorrect ? 'correct' : 'incorrect'}">
                    ${answer.isCorrect ? '正解' : '不正解'}
                </div>
            </div>
            <div class="result-item-answer">
                ${answer.isCorrect ?
                    `あなたの回答: ${answer.choices[answer.selectedIndex]}` :
                    `あなたの回答: ${answer.choices[answer.selectedIndex]}<br>正解: ${answer.choices[answer.correctIndex]}`
                }
            </div>
        `;

        detailsContainer.appendChild(resultItem);
    });

    showScreen('result-screen');
    updateStats();
}

// 分析画面表示
function showAnalysis() {
    const history = loadHistory();

    if (history.length === 0) {
        document.getElementById('analysis-content').innerHTML =
            '<div class="no-data">まだデータがありません。<br>クイズに挑戦して学習履歴を蓄積しましょう！</div>';
        showScreen('analysis-screen');
        return;
    }

    // 分野別の統計を計算
    const categories = [...new Set(questions.map(q => q.category))];
    const categoryStats = categories.map(category => {
        const categoryHistory = history.filter(h => h.category === category);
        const total = categoryHistory.length;
        const correct = categoryHistory.filter(h => h.isCorrect).length;
        const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

        return {
            category,
            total,
            correct,
            accuracy
        };
    }).filter(stat => stat.total > 0)
      .sort((a, b) => a.accuracy - b.accuracy);

    // 分析結果の表示
    const container = document.getElementById('analysis-content');
    container.innerHTML = '<h2>分野別正答率</h2>';

    categoryStats.forEach(stat => {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'analysis-category';

        let barClass = '';
        if (stat.accuracy < 50) barClass = 'low';
        else if (stat.accuracy < 70) barClass = 'medium';

        categoryDiv.innerHTML = `
            <div class="analysis-category-header">
                <div class="analysis-category-name">${stat.category}</div>
                <div class="analysis-stats">
                    <span class="analysis-stat">${stat.correct}/${stat.total}問正解</span>
                </div>
            </div>
            <div class="analysis-bar">
                <div class="analysis-bar-fill ${barClass}" style="width: ${stat.accuracy}%">
                    ${stat.accuracy}%
                </div>
            </div>
            <button class="btn btn-primary practice-btn" onclick="startQuiz('${stat.category}')">
                この分野を練習する
            </button>
        `;

        container.appendChild(categoryDiv);
    });

    showScreen('analysis-screen');
}

// ローカルストレージへの保存
function saveToHistory(record) {
    const history = loadHistory();
    history.push(record);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

// ローカルストレージから読み込み
function loadHistory() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

// 画面切り替え
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

// クイズ中断
function quitQuiz() {
    if (confirm('クイズを中断してホームに戻りますか？')) {
        backToStart();
    }
}

// もう一度
function retryQuiz() {
    startQuiz(currentQuiz.category);
}

// ホームに戻る
function backToStart() {
    updateStats();
    showScreen('start-screen');
}
