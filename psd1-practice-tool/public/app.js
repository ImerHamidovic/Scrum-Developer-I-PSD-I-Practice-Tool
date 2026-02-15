let allQuestions = [];
let currentQuestions = [];
let currentIndex = 0;
let userAnswers = {}; // Map questionId -> array of selected option indices
let checkedAnswers = {}; // Map questionId -> boolean (true if checked in practice mode)
let bookmarks = new Set(); // Set of questionIds
let shuffledOptionsMap = {}; // Map questionId -> shuffled options with original indices

// Load bookmarks
try {
    const saved = localStorage.getItem('psd1_bookmarks');
    if (saved) {
        bookmarks = new Set(JSON.parse(saved));
    }
} catch (e) {
    console.error('Failed to load bookmarks', e);
}

let timerInterval;
let currentRemainingTime = 0;
const EXAM_DURATION_MINUTES = 60;

// DOM Elements
const loadingDiv = document.getElementById('loading');
const mainMenu = document.getElementById('main-menu');
const practiceArea = document.getElementById('practice-area');
const examArea = document.getElementById('exam-area');
const resultArea = document.getElementById('result-area');

const btnPractice = document.getElementById('btn-practice');
const btnExam = document.getElementById('btn-exam');
const btnExitPractice = document.getElementById('btn-exit-practice');
const btnExitExam = document.getElementById('btn-exit-exam');
const btnBackToMenu = document.getElementById('btn-back-to-menu');
const btnCheckAnswer = document.getElementById('btn-check-answer');
const btnReloadQuestions = document.getElementById('btn-reload-questions');
const btnBookmarks = document.getElementById('btn-bookmarks');
const btnJumpPractice = document.getElementById('btn-jump-practice');
const btnJumpExam = document.getElementById('btn-jump-exam');
const inputJumpPractice = document.getElementById('practice-jump-input');
const inputJumpExam = document.getElementById('exam-jump-input');

const practiceContainer = document.getElementById('practice-question-container');
const examContainer = document.getElementById('exam-question-container');

// Fetch Questions
fetch('/api/questions')
    .then(res => {
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
    })
    .then(data => {
        if (!data || !Array.isArray(data) || data.length === 0) {
            throw new Error('Invalid or empty questions data');
        }
        allQuestions = data;
        loadingDiv.classList.add('hidden');
        mainMenu.classList.remove('hidden');
    })
    .catch(err => {
        loadingDiv.innerText = `Error loading questions: ${err.message}. Please try refreshing or check your connection.`;
        console.error('Failed to load questions:', err);
    });

// Event Listeners
btnPractice.addEventListener('click', () => startPracticeMode());
btnBookmarks.addEventListener('click', startBookmarksMode);
btnExam.addEventListener('click', startExamMode);
btnReloadQuestions.addEventListener('click', reloadQuestions);
btnExitPractice.addEventListener('click', showMenu);
btnExitExam.addEventListener('click', () => {
    if (confirm("Are you sure you want to exit the exam? All progress will be lost.")) {
        showMenu();
    }
});
btnBackToMenu.addEventListener('click', showMenu);
document.getElementById('btn-next-practice').addEventListener('click', () => navigateQuestion(1, 'practice'));
document.getElementById('btn-prev-practice').addEventListener('click', () => navigateQuestion(-1, 'practice'));
document.getElementById('btn-next-exam').addEventListener('click', () => navigateQuestion(1, 'exam'));
document.getElementById('btn-prev-exam').addEventListener('click', () => navigateQuestion(-1, 'exam'));
btnCheckAnswer.addEventListener('click', checkAnswer);
document.getElementById('btn-submit-early').addEventListener('click', finishExam);

btnJumpPractice.addEventListener('click', () => jumpToQuestion('practice'));
btnJumpExam.addEventListener('click', () => jumpToQuestion('exam'));

inputJumpPractice.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') jumpToQuestion('practice');
});
inputJumpExam.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') jumpToQuestion('exam');
});

// Filter failed questions button
let showOnlyFailed = false;
let cachedQuestionResults = [];
document.addEventListener('DOMContentLoaded', () => {
    const btnFilterFailed = document.getElementById('btn-filter-failed');
    if (btnFilterFailed) {
        btnFilterFailed.addEventListener('click', () => {
            showOnlyFailed = !showOnlyFailed;
            btnFilterFailed.innerText = showOnlyFailed ? 'Show All Questions' : 'Show Failed Only';
            generateQuestionsSummary(cachedQuestionResults);
        });
    }
});

// Shuffle function using Fisher-Yates algorithm
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Get determines if an option should stay at the bottom
function shouldStayAtBottom(optionText) {
    const text = optionText.toLowerCase();
    return text.includes('all of the above') ||
           text.includes('all of these') ||
           text.includes('all the above');
}

// Get or create shuffled options for a question
function getShuffledOptions(question) {
    if (!shuffledOptionsMap[question.id]) {
        // Create indexed version with original indices
        const indexed = question.options.map((opt, idx) => ({
            ...opt,
            originalIndex: idx
        }));

        // Separate options that should stay at bottom
        const bottomOptions = indexed.filter(opt => shouldStayAtBottom(opt.text));
        const regularOptions = indexed.filter(opt => !shouldStayAtBottom(opt.text));

        // Shuffle only regular options and append bottom options
        const shuffled = shuffleArray(regularOptions);
        shuffledOptionsMap[question.id] = [...shuffled, ...bottomOptions];
    }
    return shuffledOptionsMap[question.id];
}

// Keyboard Navigation
document.addEventListener('keydown', (e) => {
    // Check if we are in practice or exam mode (visible)
    const isPracticeVisible = !practiceArea.classList.contains('hidden');
    const isExamVisible = !examArea.classList.contains('hidden');

    if (!isPracticeVisible && !isExamVisible) return;

    // Determine current mode
    const currentMode = isPracticeVisible ? 'practice' : 'exam';

    // Ignore if typing in input fields
    if (e.target.tagName === 'INPUT') return;

    if (e.key === 'Enter' || e.code === 'Space') {
        e.preventDefault(); // Prevent scrolling for Space in all relevant cases

        // Practice Mode Special Logic: Enter/Space checks answer if selected but not not checked
        if (currentMode === 'practice') {
            const question = currentQuestions[currentIndex];
            const hasSelection = userAnswers[question.id] && userAnswers[question.id].length > 0;
            const isChecked = !!checkedAnswers[question.id];

            if (hasSelection && !isChecked) {
                checkAnswer();
                return;
            }
        }

        // Exam Mode: If on last question, submit exam
        if (currentMode === 'exam' && currentIndex === currentQuestions.length - 1) {
            finishExam();
            return;
        }

        const nextBtn = document.getElementById(`btn-next-${currentMode}`);
        if (nextBtn && !nextBtn.disabled) {
            navigateQuestion(1, currentMode);
        }
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
        const prevBtn = document.getElementById(`btn-prev-${currentMode}`);
        if (prevBtn && !prevBtn.disabled) {
            navigateQuestion(-1, currentMode);
        }
    } else if (e.key === 'Alt') {
        // Only in practice mode
        if (currentMode === 'practice') {
            e.preventDefault(); // Prevent default browser behavior for Alt if any
            checkAnswer();
        }
    }
});

// Prevent menu bar focus on Alt keyup
document.addEventListener('keyup', (e) => {
    if (e.key === 'Alt') {
        e.preventDefault();
    }
});

function jumpToQuestion(mode) {
    const input = mode === 'practice' ? inputJumpPractice : inputJumpExam;
    const val = parseInt(input.value);

    if (isNaN(val)) return;

    // 1-based index input, convert to 0-based
    const newIndex = val - 1;

    if (newIndex >= 0 && newIndex < currentQuestions.length) {
        currentIndex = newIndex;
        renderQuestion(currentIndex, mode);
        input.value = ''; // Clear input after jump
    } else {
        alert(`Please enter a number between 1 and ${currentQuestions.length}`);
    }
}

function showMenu() {
    stopTimer();
    hideAllSections();
    mainMenu.classList.remove('hidden');
}

function reloadQuestions() {
    if (!confirm('This will force a re-parse of the README file. Continue?')) return;

    loadingDiv.innerText = 'Reloading questions...';
    loadingDiv.classList.remove('hidden');
    mainMenu.classList.add('hidden');

    fetch('/api/questions?force=true')
        .then(res => res.json())
        .then(data => {
            allQuestions = data;
            loadingDiv.classList.add('hidden');
            mainMenu.classList.remove('hidden');
            alert(`Successfully loaded ${data.length} questions.`);
        })
        .catch(err => {
            loadingDiv.innerText = 'Error reloading questions.';
            console.error(err);
        });
}

function hideAllSections() {
    mainMenu.classList.add('hidden');
    practiceArea.classList.add('hidden');
    examArea.classList.add('hidden');
    resultArea.classList.add('hidden');
}

function startPracticeMode(onlyBookmarks = false) {
    let questionsToUse = allQuestions;
    const titleEl = document.getElementById('practice-mode-title');
    let startIdx = 0;

    if (onlyBookmarks) {
        questionsToUse = allQuestions.filter(q => bookmarks.has(q.id));
         if (questionsToUse.length === 0) {
            alert("You haven't bookmarked any questions yet.");
            return;
        }
        titleEl.innerText = "Review Bookmarks";
        titleEl.style.color = "#ffd700";
    } else {
        titleEl.innerText = "Practice Mode";
        titleEl.style.color = "#858585";

        // Check for saved progress
        const savedIndex = localStorage.getItem('psd1_practice_index');
        if (savedIndex !== null) {
            const idx = parseInt(savedIndex);
            if (!isNaN(idx) && idx > 0 && idx < questionsToUse.length) {
                startIdx = idx;
            }
        }
    }

    hideAllSections();
    practiceArea.classList.remove('hidden');
    currentQuestions = [...questionsToUse];
    currentIndex = startIdx;
    userAnswers = {};
    checkedAnswers = {};
    shuffledOptionsMap = {}; // Reset shuffled options for new session
    renderQuestion(currentIndex, 'practice');
}

function startBookmarksMode() {
    startPracticeMode(true);
}

function startExamMode() {
    hideAllSections();
    examArea.classList.remove('hidden');

    // Pick 80 random questions
    const shuffled = [...allQuestions].sort(() => 0.5 - Math.random());
    currentQuestions = shuffled.slice(0, 80);

    currentIndex = 0;
    userAnswers = {};
    checkedAnswers = {}; // Not used in exam but reset anyway
    shuffledOptionsMap = {}; // Reset shuffled options for new exam

    startTimer(EXAM_DURATION_MINUTES * 60);
    renderQuestion(currentIndex, 'exam');
}


function renderQuestion(index, mode) {
    const question = currentQuestions[index];
    const container = mode === 'practice' ? practiceContainer : examContainer;
    const progressEl = mode === 'practice' ? document.getElementById('practice-progress') : document.getElementById('exam-progress');
    const checked = checkedAnswers[question.id];
    const isBookmarked = bookmarks.has(question.id);

    // Display Original Question ID along with current progress
    progressEl.innerHTML = `<span style="color: #4ec9b0;">#${question.id}</span> <span style="font-size: 0.8em; color: #858585;">(${index + 1} / ${currentQuestions.length})</span>`;

    // Disable prev button if first question
    if (mode === 'practice') {
        document.getElementById('btn-prev-practice').disabled = index === 0;
        document.getElementById('btn-next-practice').disabled = index === currentQuestions.length - 1;

        // Show/Hide check button based on whether it's already checked
        btnCheckAnswer.style.display = checked ? 'none' : 'inline-block';

    } else {
        document.getElementById('btn-prev-exam').disabled = index === 0;
        document.getElementById('btn-next-exam').disabled = index === currentQuestions.length - 1;
    }

    let html = `
        <div class="question-card">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                <div class="question-text" style="margin-bottom: 0;">${escapeHtml(question.question)}</div>
                <button class="bookmark-btn ${isBookmarked ? 'active' : ''}" onclick="toggleBookmark(${question.id}, ${index}, '${mode}')" title="${isBookmarked ? 'Remove Bookmark' : 'Bookmark Question'}">
                    ${isBookmarked ? '★' : '☆'}
                </button>
            </div>`;

    // Display images if present
    if (question.images && question.images.length > 0) {
        html += '<div class="question-images" style="margin-bottom: 15px; text-align: center;">';
        question.images.forEach(img => {
            html += `<img src="${escapeHtml(img.src)}" alt="${escapeHtml(img.alt)}" style="max-width: 100%; height: auto; border: 1px solid #3c3c3c; border-radius: 4px; margin: 5px auto; display: block;">`;
        });
        html += '</div>';
    }

    html += `
            <div class="question-meta">Select ${question.expectedAnswers} option(s).</div>
            <div class="options-list">
    `;

    const selectedIndices = userAnswers[question.id] || [];
    const shuffledOptions = getShuffledOptions(question);

    shuffledOptions.forEach((opt, shuffledIndex) => {
        const originalIndex = opt.originalIndex;
        const isSelected = selectedIndices.includes(originalIndex);
        let classes = 'option-item';

        if (isSelected) classes += ' selected';

        // In practice mode, if checked, show correct/incorrect colors
        if (mode === 'practice' && checked) {
            if (opt.isCorrect) classes += ' correct';
            else if (isSelected && !opt.isCorrect) classes += ' incorrect';
        }

        html += `
            <div class="${classes}" onclick="selectOption(${question.id}, ${originalIndex}, '${mode}')">
                <div class="checkbox-visual"></div>
                <span>${escapeHtml(opt.text)}</span>
            </div>
        `;
    });

    html += `
            </div>
        </div>
    `;

    // Add submit button for last question in exam mode
    if (mode === 'exam' && index === currentQuestions.length - 1) {
        html += `
            <div style="text-align: center; margin-top: 30px; margin-bottom: 20px;">
                <button id="btn-big-submit" onclick="finishExam()" style="padding: 15px 40px; font-size: 20px; background-color: #2e7d32; cursor: pointer; border: none; color: white; border-radius: 4px;">Submit Exam</button>
            </div>
        `;
    }

    // Add explanation or feedback if checked in practice mode
    if (mode === 'practice' && checked) {
        html += `
            <div style="margin-top: 10px; padding: 10px; background-color: #2d2d2d; border-left: 4px solid #4ec9b0;">
                <p><strong>Answer Checked.</strong></p>
            </div>
        `;
    }

    container.innerHTML = html;
}

function toggleBookmark(qId, index, mode) {
    if (bookmarks.has(qId)) {
        bookmarks.delete(qId);
    } else {
        bookmarks.add(qId);
    }

    // Save to local storage
    localStorage.setItem('psd1_bookmarks', JSON.stringify([...bookmarks]));

    // Simple re-render of button icon only would be better, but re-render works
    renderQuestion(index, mode);
}

function selectOption(qId, optIndex, mode) {
    // If practice mode and already checked, do nothing
    if (mode === 'practice' && checkedAnswers[qId]) return;

    if (!userAnswers[qId]) userAnswers[qId] = [];

    const currentQ = currentQuestions[currentIndex];
    const isSingleChoice = currentQ.expectedAnswers === 1; // Though the metadata says expected, behavior depends
    // Wait, the requirement says "amount of items you should select" is shown.
    // If I click an option:
    // If likely single choice (expectedAnswers == 1), replace selection.
    // If multiple choice, toggle.

    const indexInArray = userAnswers[qId].indexOf(optIndex);

    if (indexInArray > -1) {
        // Deselect
        userAnswers[qId].splice(indexInArray, 1);
    } else {
        // Select
        // However, if we want to limit to the exact number, we might want to shift?
        // Usually, users appreciate just standard toggle, and maybe auto-replace if limit 1.
        if (isSingleChoice) {
            userAnswers[qId] = [optIndex];
        } else {
            userAnswers[qId].push(optIndex);
        }
    }

    // Re-render to update UI
    renderQuestion(currentIndex, mode);
}

function navigateQuestion(delta, mode) {
    const newIndex = currentIndex + delta;
    if (newIndex >= 0 && newIndex < currentQuestions.length) {
        currentIndex = newIndex;

        // Save progress if in regular practice mode
        if (mode === 'practice' && document.getElementById('practice-mode-title').innerText === "Practice Mode") {
            localStorage.setItem('psd1_practice_index', currentIndex);
        }

        renderQuestion(currentIndex, mode);
    }
}

function checkAnswer() {
    const question = currentQuestions[currentIndex];
    if (checkedAnswers[question.id]) {
        delete checkedAnswers[question.id];
    } else {
        checkedAnswers[question.id] = true;
    }
    renderQuestion(currentIndex, 'practice');
}

function startTimer(seconds) {
    currentRemainingTime = seconds;
    updateTimerDisplay(currentRemainingTime);

    timerInterval = setInterval(() => {
        currentRemainingTime--;
        updateTimerDisplay(currentRemainingTime);
        if (currentRemainingTime <= 0) {
            finishExam();
        }
    }, 1000);
}

function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
}

function updateTimerDisplay(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    document.getElementById('exam-timer').innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function finishExam() {
    // Ask for confirmation before submitting
    if (!confirm('Are you sure you want to submit the exam? You cannot change your answers after submission.')) {
        return;
    }

    stopTimer();
    hideAllSections();
    resultArea.classList.remove('hidden');

    // Calculate time taken
    const totalSeconds = EXAM_DURATION_MINUTES * 60;
    const timeTakenSeconds = totalSeconds - currentRemainingTime;
    const m = Math.floor(timeTakenSeconds / 60);
    const s = timeTakenSeconds % 60;
    document.getElementById('time-taken').innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

    let correctCount = 0;
    const questionResults = []; // Store results for summary

    currentQuestions.forEach((q, qIndex) => {
        const userSelected = userAnswers[q.id] || [];
        // Check if user selected exactly the correct options
        // Get correct indices
        const correctIndices = q.options.map((o, i) => o.isCorrect ? i : -1).filter(i => i !== -1);

        let isCorrect = false;
        // Arrays compare
        if (userSelected.length === correctIndices.length) {
            const sortedUser = [...userSelected].sort();
            const sortedCorrect = [...correctIndices].sort();
            if (JSON.stringify(sortedUser) === JSON.stringify(sortedCorrect)) {
                correctCount++;
                isCorrect = true;
            }
        }

        // Store result for this question
        questionResults.push({
            question: q,
            questionIndex: qIndex,
            userSelected,
            correctIndices,
            isCorrect
        });
    });

    const percentage = Math.round((correctCount / currentQuestions.length) * 100);
    document.getElementById('final-score').innerText = percentage;
    document.getElementById('correct-count').innerText = correctCount;

    const msgEl = document.getElementById('pass-fail-msg');
    if (percentage >= 85) {
        msgEl.innerHTML = '<span style="color: #4ec9b0; font-size: 20px;">🎉 PASSED! 🎉</span>';
    } else {
        msgEl.innerHTML = '<span style="color: #ce9178; font-size: 20px;">failed. (Pass mark is 85%)</span>';
    }

    // Generate questions summary
    cachedQuestionResults = questionResults;
    showOnlyFailed = false; // Reset filter
    const btnFilterFailed = document.getElementById('btn-filter-failed');
    if (btnFilterFailed) {
        btnFilterFailed.innerText = 'Show Failed Only';
    }
    generateQuestionsSummary(questionResults);
}

function generateQuestionsSummary(questionResults) {
    const summaryList = document.getElementById('questions-summary-list');
    let html = '';

    // Filter results based on showOnlyFailed flag
    const filteredResults = showOnlyFailed
        ? questionResults.filter(result => !result.isCorrect)
        : questionResults;

    if (filteredResults.length === 0) {
        html = '<div style="text-align: center; padding: 30px; color: #4ec9b0; font-size: 18px;">🎉 No incorrect answers! You got everything right! 🎉</div>';
        summaryList.innerHTML = html;
        return;
    }

    filteredResults.forEach((result, idx) => {
        const q = result.question;
        const statusIcon = result.isCorrect ? '✓' : '✗';
        const statusColor = result.isCorrect ? '#4ec9b0' : '#f48771';
        const statusText = result.isCorrect ? 'Correct' : 'Incorrect';
        const originalQuestionNumber = result.questionIndex + 1;

        html += `
            <div style="margin-bottom: 25px; padding: 15px; background-color: #2d2d2d; border-left: 4px solid ${statusColor}; border-radius: 4px;">
                <div style="display: flex; align-items: center; margin-bottom: 10px;">
                    <span style="font-size: 24px; color: ${statusColor}; margin-right: 10px;">${statusIcon}</span>
                    <span style="font-weight: bold; color: ${statusColor};">Question ${originalQuestionNumber} - ${statusText}</span>
                    <span style="margin-left: auto; color: #858585; font-size: 0.9em;">#${q.id}</span>
                </div>
                <div style="margin-bottom: 15px; padding: 10px; background-color: #1e1e1e; border-radius: 4px;">
                    <strong>Question:</strong> ${escapeHtml(q.question)}
                </div>
                <div style="margin-bottom: 10px;">
                    <strong>Your Answer(s):</strong>
        `;

        if (result.userSelected.length === 0) {
            html += '<div style="color: #858585; margin-left: 10px; margin-top: 5px;">No answer selected</div>';
        } else {
            result.userSelected.forEach(optIdx => {
                const isCorrectOption = q.options[optIdx].isCorrect;
                const optColor = isCorrectOption ? '#4ec9b0' : '#f48771';
                html += `
                    <div style="margin-left: 10px; margin-top: 5px; padding: 8px; background-color: #1e1e1e; border-left: 3px solid ${optColor}; border-radius: 3px;">
                        <span style="color: ${optColor};">${isCorrectOption ? '✓' : '✗'}</span> ${escapeHtml(q.options[optIdx].text)}
                    </div>
                `;
            });
        }

        html += `
                </div>
                <div style="margin-top: 15px;">
                    <strong style="color: #4ec9b0;">Correct Answer(s):</strong>
        `;

        result.correctIndices.forEach(optIdx => {
            html += `
                <div style="margin-left: 10px; margin-top: 5px; padding: 8px; background-color: #1e1e1e; border-left: 3px solid #4ec9b0; border-radius: 3px;">
                    <span style="color: #4ec9b0;">✓</span> ${escapeHtml(q.options[optIdx].text)}
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;
    });

    summaryList.innerHTML = html;
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}
