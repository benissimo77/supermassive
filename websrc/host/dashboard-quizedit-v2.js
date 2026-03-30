import { FileDropzone } from './FileDropzone.js';
import { ImageLibrary } from './ImageLibrary.js';
import { Auth } from '../utils/auth.js';
import '../utils/ImageSelector.js';
import { QuestionTypeRegistry } from './quiz-editor-registry.js';

/**
 * SuperMassive Quiz Editor (Refactored)
 * This version uses a Registry-based pattern to handle different question types.
 */
export function initDashboardQuizEdit() {
    const UI = {
        roundsContainer: document.getElementById('rounds-container'),
        quizTitle: document.getElementById('quiz-title'),
        quizDescription: document.getElementById('quiz-description'),
        quizJson: document.getElementById('quiz-json'),
        quizId: document.getElementById('quiz-id'),
        quizOwner: document.getElementById('quiz-owner'),
        quizSchema: document.getElementById('quiz-schema-version'),
        saveButtons: document.querySelectorAll('.save-quiz-btn'),
        addRoundBtn: document.getElementById('add-round'),
        hostQuizBtn: document.getElementById('host-quiz'),
        
        // AI Generator
        aiPanel: document.getElementById('ai-generator-panel'),
        aiPromptInput: document.getElementById('ai-prompt-input'),
        aiSubmitBtn: document.getElementById('ai-submit-btn'),
        aiStatus: document.getElementById('ai-status')
    };

    let hasUnsavedChanges = false;

    // --- 1. CORE LAYERS: HTML <-> JSON ---

    /**
     * LAYER: HTML -> JSON
     * Reads the entire interface and returns a clean Quiz JSON object.
     */
    function readQuizFromUI() {
        const quizData = {
            _id: UI.quizId.value,
            schemaVersion: UI.quizSchema.value,
            ownerID: UI.quizOwner.value,
            title: UI.quizTitle.value,
            description: UI.quizDescription.value,
            rounds: Array.from(UI.roundsContainer.querySelectorAll('.round')).map(roundEl => readRoundFromUI(roundEl))
        };
        
        // Update debug textarea
        if (UI.quizJson) UI.quizJson.value = JSON.stringify(quizData, null, 2);
        
        return quizData;
    }

    function readRoundFromUI(roundEl) {
        return {
            _id: roundEl.querySelector('.round-id').value,
            ownerID: roundEl.querySelector('.round-owner').value,
            title: roundEl.querySelector('.round-title').value,
            description: roundEl.querySelector('.round-description').value,
            roundTimer: roundEl.querySelector('[data-field="round-timer"]').value,
            showAnswer: roundEl.querySelector('[data-field="show-answer"]').value,
            updateScores: roundEl.querySelector('[data-field="update-scores"]').value,
            scoreMethod: roundEl.querySelector('[data-field="score-method"]').value,
            questions: Array.from(roundEl.querySelectorAll('.question')).map(qEl => readQuestionFromUI(qEl))
        };
    }

    function readQuestionFromUI(qEl) {
        const type = qEl.querySelector('.question-type').value;
        const registry = QuestionTypeRegistry[type];
        
        // Base fields common to all questions
        const baseData = {
            type,
            _id: qEl.querySelector('.question-id').value,
            ownerID: qEl.querySelector('.question-owner').value,
            text: qEl.querySelector('[data-field="question-text"]').value,
            image: qEl.querySelector('[data-field="question-image"]').getAttribute('src'),
            audio: qEl.querySelector('[data-field="question-audio"]').value,
            searchQuery: qEl.querySelector('.ai-search-query')?.textContent.replace('Search: ', '') || '',
            reasoning: qEl.querySelector('.ai-reasoning')?.textContent || '',
            // Initialize defaults for optional fields
            answer: null,
            options: [],
            pairs: [],
            items: [],
            extra: {}
        };

        // Delegate specific fields to the registry
        if (registry && registry.serialize) {
            const specificData = registry.serialize(qEl.querySelector('.question-specific-content'));
            return { ...baseData, ...specificData };
        }

        return baseData;
    }

    /**
     * LAYER: JSON -> HTML
     * Takes a Quiz JSON object and builds the entire interface.
     */
    async function writeQuizToUI(quizData) {
        console.log('Writing quiz to UI:', quizData);
        
        // 1. Data Sanitization
        quizData = normalizeQuizData(quizData);
        quizData = validateQuizStructure(quizData);

        // 2. Clear & Set Global Headers
        UI.quizId.value = quizData._id || "";
        UI.quizOwner.value = quizData.ownerID || "";
        UI.quizSchema.value = quizData.schemaVersion || "";
        UI.quizTitle.value = quizData.title || "";
        UI.quizDescription.value = quizData.description || "";
        updateHeaderWithTitle({ target: UI.quizTitle });

        UI.roundsContainer.innerHTML = '';

        // 3. Build Rounds & Questions
        if (quizData.rounds) {
            for (const roundData of quizData.rounds) {
                const roundEl = addRoundToDOM();
                writeRoundToUI(roundEl, roundData);
                
                if (roundData.questions) {
                    const qContainer = roundEl.querySelector('.questions-container');
                    for (const qData of roundData.questions) {
                        const qEl = addQuestionToDOM(qContainer);
                        writeQuestionToUI(qEl, qData);
                    }
                }
            }
        }

        // 4. Final Polish
        addRoundQuestionNumbers();
        collapseAll();
        resetSaveChanges();
    }

    function writeRoundToUI(roundEl, data) {
        roundEl.querySelector('.round-id').value = data._id || "";
        roundEl.querySelector('.round-owner').value = data.ownerID || "";
        roundEl.querySelector('.round-title').value = data.title || "";
        roundEl.querySelector('.round-description').value = data.description || "";
        roundEl.querySelector('[data-field="round-timer"]').value = data.roundTimer || "0";
        roundEl.querySelector('[data-field="show-answer"]').value = data.showAnswer || "round";
        roundEl.querySelector('[data-field="update-scores"]').value = data.updateScores || "round";
        roundEl.querySelector('[data-field="score-method"]').value = data.scoreMethod || "regular";
        updateHeaderWithTitle({ target: roundEl.querySelector('.round-title') });
    }

    function writeQuestionToUI(qEl, data) {
        qEl.querySelector('.question-id').value = data._id || "";
        qEl.querySelector('.question-owner').value = data.ownerID || "";
        qEl.querySelector('[data-field="question-text"]').value = data.text || "";
        qEl.querySelector('[data-field="question-audio"]').value = data.audio || "";
        
        if (data.image) setImageSelectorSrc(qEl, data.image);
        updateHeaderWithTitle({ target: qEl.querySelector('[data-field="question-text"]') });

        // Set Type & Trigger Render
        const typeSelect = qEl.querySelector('.question-type');
        typeSelect.value = data.type || 'text';
        applyQuestionTypeChange(qEl);

        // Delegate specific fields to registry
        const registry = QuestionTypeRegistry[data.type];
        if (registry && registry.deserialize) {
            registry.deserialize(qEl.querySelector('.question-specific-content'), data);
        }
        
        // AI Context
        const aiHelper = qEl.querySelector('.ai-helper-info');
        if (aiHelper && (data.searchQuery || data.reasoning)) {
            aiHelper.style.display = 'block';
            aiHelper.querySelector('.ai-search-query').textContent = `Search: ${data.searchQuery || ''}`;
            aiHelper.querySelector('.ai-reasoning').textContent = data.reasoning || '';
        }
    }

    // --- 2. DOM & EVENT HELPERS ---

    function applyQuestionTypeChange(qEl) {
        const type = qEl.querySelector('.question-type').value;
        const container = qEl.querySelector('.question-specific-content');
        const hint = qEl.querySelector('.question-type-hint');
        const registry = QuestionTypeRegistry[type];

        container.innerHTML = '';
        if (registry) {
            hint.textContent = registry.label;
            registry.render(container);
            
            // Special case for hotspots/images inside registry
            if (type === 'hotspot' || type === 'point-it-out') {
                const preview = container.querySelector('.image-selector-preview');
                const mainImg = qEl.querySelector('[data-field="question-image"]');
                if (preview && mainImg.getAttribute('src')) {
                    preview.setAttribute('src', mainImg.getAttribute('src'));
                }
                
                // Set up event listeners unique to these types
                if (type === 'hotspot') {
                    preview.addEventListener('selection', (e) => {
                        qEl.querySelector('[data-field="hotspot-x"]').value = e.detail.x;
                        qEl.querySelector('[data-field="hotspot-y"]').value = e.detail.y;
                        markAsChanged();
                    });
                }
                if (type === 'point-it-out') {
                    preview.addEventListener('selection', (e) => {
                        qEl.querySelector('[data-field="point-it-out-startx"]').value = e.detail.start.x;
                        qEl.querySelector('[data-field="point-it-out-starty"]').value = e.detail.start.y;
                        qEl.querySelector('[data-field="point-it-out-endx"]').value = e.detail.end.x;
                        qEl.querySelector('[data-field="point-it-out-endy"]').value = e.detail.end.y;
                        markAsChanged();
                    });
                }
            }
        }
    }

    function addRoundToDOM() {
        const template = document.getElementById('round-template');
        const clone = template.content.cloneNode(true);
        const roundEl = clone.querySelector('.round');
        
        UI.roundsContainer.appendChild(roundEl);
        
        // Events
        roundEl.querySelector('.round-title').addEventListener('blur', updateHeaderWithTitle);
        roundEl.querySelector('.question-btn').addEventListener('click', () => addQuestionToDOM(roundEl.querySelector('.questions-container')));
        setupCollapsible(roundEl.querySelector('.card-header'));

        // Sorting
        new Sortable(roundEl.querySelector('.questions-container'), {
            animation: 150,
            handle: '.drag-handle',
            group: 'questions',
            onSort: () => { addRoundQuestionNumbers(); markAsChanged(); }
        });

        addRoundQuestionNumbers();
        return roundEl;
    }

    function addQuestionToDOM(container) {
        const template = document.getElementById('question-template');
        const clone = template.content.cloneNode(true);
        const qEl = clone.querySelector('.question');
        
        container.appendChild(qEl);
        
        // Events
        qEl.querySelector('[data-field="question-text"]').addEventListener('blur', updateHeaderWithTitle);
        qEl.querySelector('.question-type').addEventListener('change', () => applyQuestionTypeChange(qEl));
        qEl.querySelector('[data-field="question-image-url"]').addEventListener('blur', (e) => {
            if (e.target.value) setImageSelectorSrc(qEl, e.target.value);
        });
        
        setupCollapsible(qEl.querySelector('.card-header'));
        applyQuestionTypeChange(qEl); // Initial render
        addRoundQuestionNumbers();
        return qEl;
    }

    // --- 3. SYSTEM FUNCTIONS (Validation, Loading, Saving) ---

    async function loadQuiz() {
        const id = new URLSearchParams(window.location.search).get('id');
        if (!id) return writeQuizToUI({ title: 'New Quiz', rounds: [] });

        try {
            const res = await fetch(`/api/quiz/${id}`);
            const result = await res.json();
            if (result.success) await writeQuizToUI(result.data);
            else alert('Failed to load quiz');
        } catch (e) {
            console.error(e);
            alert('Error loading quiz');
        }
    }

    async function saveQuiz(e) {
        if (e) e.preventDefault();
        const data = readQuizFromUI();
        
        UI.saveButtons.forEach(btn => btn.textContent = 'Saving...');

        try {
            const res = await fetch('/api/quiz/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();

            if (result.success) {
                UI.saveButtons.forEach(btn => btn.textContent = 'Saved');
                setTimeout(() => UI.saveButtons.forEach(btn => btn.textContent = 'Save Quiz'), 2000);
                await writeQuizToUI(result.data);
            } else {
                alert('Save failed: ' + result.message);
                UI.saveButtons.forEach(btn => btn.textContent = 'Save Quiz');
            }
        } catch (err) {
            console.error(err);
            UI.saveButtons.forEach(btn => btn.textContent = 'Save Quiz');
        }
    }

    // --- 4. UTILITIES (Kept from original for stability) ---

    function updateHeaderWithTitle(e) {
        const el = e.target;
        const headerTitle = el.closest('.card').querySelector('.card-header .header-title');
        if (headerTitle) headerTitle.textContent = el.value;
    }

    function addRoundQuestionNumbers() {
        UI.roundsContainer.querySelectorAll('.round').forEach((round, rIndex) => {
            round.querySelector('.header-round-number').textContent = rIndex + 1;
            round.querySelectorAll('.question').forEach((q, qIndex) => {
                q.querySelector('.header-question-number').textContent = qIndex + 1;
            });
        });
    }

    function setImageSelectorSrc(qEl, url) {
        const img = qEl.querySelector('[data-field="question-image"]');
        const input = qEl.querySelector('[data-field="question-image-url"]');
        const container = qEl.querySelector('.image-preview-container');
        const clearBtn = qEl.querySelector('.clear-image-btn');

        if (img) img.src = url;
        if (input) input.value = url;
        if (container) container.style.display = url ? 'block' : 'none';
        if (clearBtn) clearBtn.style.display = url ? 'inline-block' : 'none';
        
        // Sync with hotspot if active
        const hotspotPvw = qEl.querySelector('.image-selector-preview');
        if (hotspotPvw) hotspotPvw.setAttribute('src', url);
        
        markAsChanged();
    }

    function setupCollapsible(summary) {
        summary.addEventListener('click', (e) => {
            if (e.target.closest('button')) {
                e.preventDefault();
                return;
            }
            const details = summary.parentNode;
            if (details.hasAttribute('open')) {
                details.querySelectorAll('details').forEach(d => d.removeAttribute('open'));
            }
        });
    }

    function collapseAll() {
        document.querySelectorAll('.round, .question').forEach(el => el.removeAttribute('open'));
    }

    function markAsChanged() { 
        hasUnsavedChanges = true; 
        updateSaveButton();
    }
    
    function resetSaveChanges() { 
        hasUnsavedChanges = false; 
        updateSaveButton();
    }

    function updateSaveButton() {
        UI.saveButtons.forEach(btn => {
            if (hasUnsavedChanges) {
                btn.classList.add('unsaved-changes');
            } else {
                btn.classList.remove('unsaved-changes');
            }
        });
    }

    function normalizeQuizData(data) {
        // Essential logic for type-safety from original code
        if (data.rounds) {
            data.rounds.forEach(r => {
                if (r.questions) {
                    r.questions.forEach(q => {
                        if (q.type === 'true-false') q.answer = String(q.answer);
                        if (['number-exact', 'number-closest', 'number-average'].includes(q.type) && q.answer !== '') {
                            q.answer = Number(q.answer);
                        }
                    });
                }
            });
        }
        return data;
    }

    function validateQuizStructure(data) {
        data.rounds = data.rounds || [];
        data.rounds.forEach(r => { r.questions = r.questions || []; });
        return data;
    }

    // --- 5. INITIALIZATION ---

    // Event Delegation
    document.addEventListener('click', async (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;

        if (btn.classList.contains('select-image-btn') || btn.classList.contains('ai-search-btn')) {
            const qEl = btn.closest('.question');
            new ImageLibrary({ onSelect: (img) => setImageSelectorSrc(qEl, img.url) }).show();
        }

        if (btn.classList.contains('clear-image-btn')) {
            setImageSelectorSrc(btn.closest('.question'), '');
        }

        if (btn.classList.contains('delete-btn')) {
            if (confirm('Are you sure?')) {
                btn.closest('.round, .question').remove();
                addRoundQuestionNumbers();
                markAsChanged();
            }
        }
    });

    UI.addRoundBtn.addEventListener('click', addRoundToDOM);
    UI.saveButtons.forEach(btn => btn.addEventListener('click', saveQuiz));
    UI.hostQuizBtn?.addEventListener('click', () => {
        if (UI.quizId.value) window.location.href = `/host/quiz/start?q=${UI.quizId.value}`;
        else alert('Save the quiz first!');
    });

    window.addEventListener('beforeunload', (e) => {
        if (hasUnsavedChanges) e.returnValue = 'Unsaved changes!';
    });

    // Global listeners for change tracking
    document.addEventListener('input', (e) => { if (e.target.id !== 'ai-prompt-input') markAsChanged(); });
    document.addEventListener('change', (e) => { if (e.target.id !== 'ai-prompt-input') markAsChanged(); });

    new Sortable(UI.roundsContainer, {
        animation: 150,
        handle: '.card-header',
        onSort: () => { addRoundQuestionNumbers(); markAsChanged(); }
    });

    loadQuiz();
}
