const DATA_ROOT = 'MedQuiz';
const TOPICS = {
  patho: 'Group 1',
  pharma: 'Group 2'
};
const CATEGORY_FILES = {
  patho: [
    `${DATA_ROOT}/Patho/1 - Copy (10) - Copy.json`,
    `${DATA_ROOT}/Patho/1 - Copy (2).json`,
    `${DATA_ROOT}/Patho/1 - Copy (3).json`,
    `${DATA_ROOT}/Patho/1 - Copy (4).json`,
    `${DATA_ROOT}/Patho/1 - Copy (5).json`,
    `${DATA_ROOT}/Patho/1 - Copy (6).json`,
    `${DATA_ROOT}/Patho/1 - Copy (7).json`,
    `${DATA_ROOT}/Patho/1 - Copy (8) - Copy.json`,
    `${DATA_ROOT}/Patho/1 - Copy (8).json`,
    `${DATA_ROOT}/Patho/1 - Copy (9) - Copy.json`,
    `${DATA_ROOT}/Patho/1 - Copy.json`
  ],
  pharma: [
    `${DATA_ROOT}/Pharma/1 - Copy (2).json`,
    `${DATA_ROOT}/Pharma/1 - Copy (3).json`,
    `${DATA_ROOT}/Pharma/1 - Copy (4).json`,
    `${DATA_ROOT}/Pharma/1 - Copy (5).json`,
    `${DATA_ROOT}/Pharma/1 - Copy.json`,
    `${DATA_ROOT}/Pharma/1.json`
  ]
};
const STORAGE_KEY = 'medquiz_excluded';
const LANGUAGE_KEY = 'medquiz_language';

const translations = {
  en: {
    badge: 'Medical review',
    title: 'MedQuiz',
    subtitle: 'Pathology questions',
    start: 'Start quiz',
    language: 'Language',
    included: 'Select topics',
    options: 'Session options',
    randomize: 'Randomize questions',
    limit: 'Limit',
    hint: 'Mark a question as known and it will be skipped in future sessions.',
    menu: 'Menu',
    question: 'Question',
    of: 'of',
    skip: 'Skip this question next time',
    sessionComplete: 'Session complete!',
    total: 'Total',
    correct: 'Correct',
    wrong: 'Wrong',
    review: 'Review wrong answers now?',
    noBanks: 'Please select at least one topic to start a session.',
    noQuestions: 'No questions were available for the selected topics.',
    noSelection: 'This quiz uses the Patho and Pharma folders next to the website.'
  }
};

const state = {
  randomize: true,
  limit: 0,
  selectedTopics: Object.keys(TOPICS),
  pool: [],
  idx: 0,
  current: null,
  wrong: [],
  markExcl: false,
  answered: false,
  excluded: new Set(),
  currentView: 'menu',
  language: 'en'
};

function t(key) {
  return (translations[state.language] && translations[state.language][key]) || translations.en[key] || key;
}

function hashQuestion(q) {
  const seed = `${q.question || q.q || ''}|${q.correct_answer || q.a || ''}`;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function normalizeQuestion(question) {
  if (!question) return null;
  const q = question.question || question.q;
  const a = question.correct_answer || question.a;
  const wrong = question.wrong_answers || question.wrong || [];
  if (!q || !a) return null;
  return { question: q, correct_answer: a, wrong_answers: Array.isArray(wrong) ? wrong.filter(Boolean) : [] };
}

function loadExcluded() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveExcluded() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.excluded]));
}

function loadLanguage() {
  try {
    const raw = localStorage.getItem(LANGUAGE_KEY);
    return raw === 'ar' ? 'ar' : 'en';
  } catch {
    return 'en';
  }
}

function saveLanguage() {
  localStorage.setItem(LANGUAGE_KEY, state.language);
}

function applyLanguage() {
  document.documentElement.lang = state.language;
  document.title = state.language === 'ar' ? 'اختبار طب' : 'MedQuiz';
}

async function loadQuestions(topic) {
  const files = CATEGORY_FILES[topic] || [];
  const questions = await Promise.all(files.map(async (file) => {
    try {
      const res = await fetch(file);
      if (!res.ok) return [];
      const data = await res.json();
      const bank = Array.isArray(data.questions) ? data.questions : Array.isArray(data) ? data : [];
      return bank.map(normalizeQuestion).filter(Boolean);
    } catch {
      return [];
    }
  }));
  return questions.flat();
}

function renderApp() {
  const app = document.getElementById('app');
  applyLanguage();

  if (state.currentView === 'menu') {
    app.innerHTML = `
      <div class="card hero-card">
        <header class="hero-header">
          <div>
            <div class="badge">${t('badge')}</div>
            <h1>${t('title')}</h1>
            <p class="subtitle">${t('subtitle')}</p>
          </div>
          <div class="hero-actions">
            <button class="btn-secondary" id="startBtn">${t('start')}</button>
          </div>
        </header>

        <div class="info-grid">
          <div class="info-card">
            <h3>${t('included')}</h3>
            <div class="chip-row">
              ${Object.entries(TOPICS).map(([key, label]) => `
                <button type="button" class="chip ${state.selectedTopics.includes(key) ? 'active' : ''}" data-topic="${key}">${label}</button>
              `).join('')}
            </div>
            <p class="small">${t('noSelection')}</p>
          </div>

          <div class="info-card">
            <h3>${t('options')}</h3>
            <label class="toggle-item">
              <input type="checkbox" id="randomize" ${state.randomize ? 'checked' : ''} />
              <span>${t('randomize')}</span>
            </label>
            <label class="toggle-item">
              <span>${t('limit')}</span>
              <input type="number" id="limit" min="0" value="${state.limit}" />
            </label>
          </div>
        </div>

        <p class="small">${t('hint')}</p>
        <div class="footer-credit">Web version of your quiz</div>
      </div>
    `;

    document.querySelectorAll('[data-topic]').forEach((button) => {
      button.onclick = () => {
        const topic = button.getAttribute('data-topic');
        if (state.selectedTopics.includes(topic)) {
          state.selectedTopics = state.selectedTopics.filter((item) => item !== topic);
        } else {
          state.selectedTopics = [...state.selectedTopics, topic];
        }
        renderApp();
      };
    });

    document.getElementById('startBtn').onclick = startSession;
    document.getElementById('randomize').onchange = (e) => { state.randomize = e.target.checked; };
    document.getElementById('limit').onchange = (e) => { state.limit = Number(e.target.value || 0); };
    return;
  }

  if (state.currentView === 'quiz') {
    app.innerHTML = `
      <div class="card question-card">
        <header class="quiz-header">
          <div>
            <div class="badge">MCQ</div>
            <h2>${t('question')} ${state.idx}/${state.pool.length}</h2>
          </div>
          <button class="btn-danger" id="menuBtn">${t('menu')}</button>
        </header>

        <div class="progress-bar" aria-hidden="true">
          <div class="progress-fill" style="width:${(state.idx / Math.max(state.pool.length, 1)) * 100}%"></div>
        </div>

        <div class="question-text">${state.current.question}</div>
        <div id="options"></div>
        <div class="row" style="margin-top:12px">
          <label class="checkbox-item"><input type="checkbox" id="skipBox" ${state.markExcl ? 'checked' : ''} /> <span>${t('skip')}</span></label>
        </div>
      </div>
    `;

    document.getElementById('menuBtn').onclick = () => {
      state.currentView = 'menu';
      renderApp();
    };

    const skipBox = document.getElementById('skipBox');
    if (skipBox) {
      skipBox.onchange = (e) => { state.markExcl = e.target.checked; };
    }

    renderMCQ();
  }
}

function renderMCQ() {
  const optionsEl = document.getElementById('options');
  if (!optionsEl) return;
  const correct = state.current.correct_answer;
  const wrong = (state.current.wrong_answers || []).slice(0, 3);
  const options = [correct, ...wrong].sort(() => Math.random() - 0.5);
  optionsEl.innerHTML = options.map((opt) => `
    <button class="option-btn" data-option="${opt}">${opt}</button>
  `).join('');
  optionsEl.querySelectorAll('button').forEach((btn) => {
    btn.onclick = () => answerMCQ(btn, btn.getAttribute('data-option'));
  });
}

function answerMCQ(btn, chosen) {
  if (state.answered) return;
  state.answered = true;
  const correct = state.current.correct_answer;
  const buttons = document.querySelectorAll('.option-btn');
  buttons.forEach((b) => {
    const opt = b.getAttribute('data-option');
    if (opt === correct) {
      b.classList.add('correct');
    } else if (opt === chosen) {
      b.classList.add('wrong');
    }
    b.disabled = true;
  });
  if (chosen !== correct) {
    state.wrong.push(state.current);
  }
  window.setTimeout(nextQuestion, 1200);
}

function nextQuestion() {
  if (state.markExcl && state.current) {
    state.excluded.add(hashQuestion(state.current));
    saveExcluded();
  }
  state.markExcl = false;
  state.answered = false;

  if (state.idx >= state.pool.length) {
    finishSession();
    return;
  }

  state.current = state.pool[state.idx];
  state.idx += 1;
  renderApp();
}

async function startSession() {
  if (!state.selectedTopics.length) {
    alert(t('noBanks'));
    return;
  }

  const pool = [];
  const seen = new Set();
  for (const topic of state.selectedTopics) {
    const questions = await loadQuestions(topic);
    for (const q of questions) {
      const h = hashQuestion(q);
      if (!state.excluded.has(h) && !seen.has(h)) {
        seen.add(h);
        pool.push(q);
      }
    }
  }

  if (!pool.length) {
    alert(t('noQuestions'));
    return;
  }

  if (state.randomize) pool.sort(() => Math.random() - 0.5);
  if (state.limit > 0 && state.limit < pool.length) pool.splice(state.limit);

  state.pool = pool;
  state.idx = 0;
  state.wrong = [];
  state.current = null;
  state.currentView = 'quiz';
  nextQuestion();
}

function finishSession() {
  const total = state.pool.length;
  const wrong = state.wrong.length;
  const right = total - wrong;
  const summary = `${t('sessionComplete')}\n\n${t('total')}: ${total}\n${t('correct')}: ${right}\n${t('wrong')}: ${wrong}`;
  const review = confirm(`${summary}\n\n${t('review')}`);
  if (review && state.wrong.length) {
    state.pool = [...state.wrong, ...state.pool.filter((q) => !state.wrong.includes(q))];
    state.wrong = [];
    state.idx = 0;
    state.currentView = 'quiz';
    nextQuestion();
  } else {
    state.currentView = 'menu';
    renderApp();
  }
}

function init() {
  state.language = loadLanguage();
  state.excluded = loadExcluded();
  renderApp();
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(console.error);
    });
  }
}

init();
