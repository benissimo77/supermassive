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
        aiStatus: document.getElementById('ai-status'),
        aiGenerateBtn: document.getElementById('ai-generate-btn'),
        
        // Paste JSON Import
        pasteJsonBtn: document.getElementById('paste-json-btn'),
        pasteJsonPanel: document.getElementById('paste-json-panel'),
        pasteJsonInput: document.getElementById('paste-json-input'),
        pasteJsonSubmit: document.getElementById('paste-json-submit'),
        pasteJsonStatus: document.getElementById('paste-json-status')
    };

    // --- PASTE JSON IMPORT INTEGRATION ---
    if (UI.pasteJsonBtn && UI.pasteJsonPanel && UI.pasteJsonInput && UI.pasteJsonSubmit && UI.pasteJsonStatus) {
        UI.pasteJsonBtn.addEventListener('click', () => {
            UI.pasteJsonPanel.style.display = UI.pasteJsonPanel.style.display === 'none' ? 'block' : 'none';
            if (UI.pasteJsonPanel.style.display === 'block') {
                UI.pasteJsonInput.focus();
            }
        });
        UI.pasteJsonSubmit.addEventListener('click', handlePasteJsonImport);
    }

    async function handlePasteJsonImport() {
        UI.pasteJsonSubmit.disabled = true;
        UI.pasteJsonStatus.style.display = 'block';
        let parsed;
        try {
            parsed = JSON.parse(UI.pasteJsonInput.value);
        } catch (e) {
            UI.pasteJsonStatus.textContent = 'Invalid JSON.';
            UI.pasteJsonSubmit.disabled = false;
            return;
        }

        // Get current quiz data
        let quizData = readQuizFromUI();
        let changed = false;
        // Determine what was pasted and append accordingly
        if (parsed && typeof parsed === 'object') {
            if (Array.isArray(parsed.rounds)) {
                // Looks like a full quiz
                quizData.rounds = quizData.rounds.concat(parsed.rounds);
                changed = true;
            } else if (Array.isArray(parsed)) {
                // Array of questions: append to last round
                if (quizData.rounds.length > 0) {
                    quizData.rounds[quizData.rounds.length - 1].questions = quizData.rounds[quizData.rounds.length - 1].questions.concat(parsed);
                    changed = true;
                } else {
                    UI.pasteJsonStatus.textContent = 'No round exists to add questions.';
                    UI.pasteJsonSubmit.disabled = false;
                    return;
                }
            } else if (parsed.questions && Array.isArray(parsed.questions)) {
                // Single round
                quizData.rounds.push(parsed);
                changed = true;
            } else if (parsed.type && parsed.text) {
                // Single question
                if (quizData.rounds.length > 0) {
                    quizData.rounds[quizData.rounds.length - 1].questions.push(parsed);
                    changed = true;
                } else {
                    UI.pasteJsonStatus.textContent = 'No round exists to add question.';
                    UI.pasteJsonSubmit.disabled = false;
                    return;
                }
            } else {
                UI.pasteJsonStatus.textContent = 'Unrecognized JSON structure.';
                UI.pasteJsonSubmit.disabled = false;
                return;
            }
        }

        // Validate and update UI
        try {
            await writeQuizToUI(quizData);
            markAsChanged();
            UI.pasteJsonStatus.textContent = 'Import successful!';
            UI.pasteJsonInput.value = '';
            setTimeout(() => {
                UI.pasteJsonPanel.style.display = 'none';
                UI.pasteJsonStatus.style.display = 'none';
                // UI.pasteJsonStatus.textContent = '';
                UI.pasteJsonStatus.innerHTML = `<div class="spinner"></div>
						<span>Importing Quiz JSON...</span>`;

            }, 1200);
        } catch (e) {
            UI.pasteJsonStatus.textContent = 'Validation or import failed.';
        } finally {
            UI.pasteJsonSubmit.disabled = false;
        }
    }

    let hasUnsavedChanges = false;

    // --- AI GENERATOR INTEGRATION ---
    if (UI.aiPanel && UI.aiPromptInput && UI.aiSubmitBtn && UI.aiStatus) {
        // Show AI panel when clicking the AI-generate button
        if (UI.aiGenerateBtn) {
            UI.aiGenerateBtn.addEventListener('click', () => {
                UI.aiPanel.style.display = UI.aiPanel.style.display === 'none' ? 'block' : 'none';
                if (UI.aiPanel.style.display === 'block') UI.aiPromptInput.focus();
            });
        }
        UI.aiSubmitBtn.addEventListener('click', generateAIQuiz);
        UI.aiPromptInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') generateAIQuiz();
        });
    }

    async function generateAIQuiz() {
        // Optionally check for host role (remove if not needed)
        if (typeof Auth?.checkRole === 'function') {
            const isHost = await Auth.checkRole('host');
            if (!isHost) {
                alert('AI Generation is a Host feature. Please verify your email address to unlock this feature.');
                return;
            }
        }

        const prompt = UI.aiPromptInput.value.trim();
        if (!prompt) return;

        UI.aiSubmitBtn.disabled = true;
        UI.aiStatus.style.display = 'flex';

        try {
            const response = await fetch('/api/quiz/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });
            const result = await response.json();
            if (result.success) {
                await writeQuizToUI(result.data);
                markAsChanged();
                UI.aiPanel.style.display = 'none';
                UI.aiPromptInput.value = '';
            } else {
                alert('AI Generation failed: ' + result.message);
            }
        } catch (error) {
            console.error('Error generating AI quiz:', error);
            alert('Error generating AI quiz');
        } finally {
            UI.aiSubmitBtn.disabled = false;
            UI.aiStatus.style.display = 'none';
        }
    }

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

    async function validateQuizSchema(quizJSON) {
        try {
            const response = await fetch('/api/quiz/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(quizJSON)
            });
            const result = await response.json();
            return result.data;
        } catch (e) {
            console.error('Validation API error:', e);
            return { valid: true, errors: [] };
        }
    }

    async function loadQuiz() {
        const id = new URLSearchParams(window.location.search).get('id');
        if (!id) return writeQuizToUI({ title: 'New Quiz', rounds: [] });

        try {
            const res = await fetch(`/api/quiz/${id}`);
            const result = await res.json();
            if (result.success) {
                await writeQuizToUI(result.data);
                const validation = await validateQuizSchema(result.data);
                if (!validation.valid) {
                    displayValidationErrors(validation.errors);
                }
            } else {
                alert('Failed to load quiz');
            }
        } catch (e) {
            console.error(e);
            alert('Error loading quiz');
        }
    }

    async function saveQuiz(e) {
        if (e) e.preventDefault();
        
        // Wipe all existing visual errors the moment the user attempts to save
        if (typeof clearValidationErrors === 'function') {
            clearValidationErrors();
        }

        const data = readQuizFromUI();
        
        UI.saveButtons.forEach(btn => btn.textContent = 'Saving...');

        const validation = await validateQuizSchema(data);
        if (!validation.valid) {
            displayValidationErrors(validation.errors);
            const errStr = validation.errors.map(err => ' - ' + err.message).join('\n');
            alert('Save failed: Please correct the errors before saving:\n\n' + errStr);
            UI.saveButtons.forEach(btn => btn.textContent = 'Save Quiz');
            return;
        }

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
                let errStr = result.message;
                const validationErrors = result.error; // apiResponse maps 'details' directly to 'error'
                if (validationErrors && Array.isArray(validationErrors) && validationErrors.length > 0) {
                    displayValidationErrors(validationErrors);
                    errStr += '\n' + validationErrors.map(err => ' - ' + err.message).join('\n');
                }
                alert('Save failed:\\n' + errStr);
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

        if (btn.classList.contains('select-order-image-btn')) {
            e.preventDefault();
            console.log("Order image button clicked!");
            const container = btn.closest('.order-image-container');
            if (!container) console.warn("No .order-image-container found!");
            
            const imgInput = container.querySelector('[data-field="order-image"]');
            const imgPreview = container.querySelector('[data-field="order-image-preview"]');

            new ImageLibrary({
                onSelect: (image) => {
                    console.log("Image selected:", image);
                    if (imgInput) imgInput.value = image.url;
                    if (imgPreview) {
                        imgPreview.style.backgroundImage = `url(${image.url})`;
                        imgPreview.style.display = 'block';
                    }
                    markAsChanged();
                }
            }).show();
            return;
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
    document.addEventListener('input', (e) => { 
        if (e.target.id !== 'ai-prompt-input') markAsChanged(); 
    });

    document.addEventListener('focusout', (e) => {
        if (e.target.matches('[data-field="order-image"]')) {
            const container = e.target.closest('.order-image-container');
            if (container) {
                const imgPreview = container.querySelector('[data-field="order-image-preview"]');
                if (imgPreview) {
                    const url = e.target.value.trim();
                    imgPreview.style.backgroundImage = url ? `url(${url})` : 'none';
                    imgPreview.style.display = url ? 'block' : 'none';
                }
            }
        }
    });

    document.addEventListener('change', (e) => { if (e.target.id !== 'ai-prompt-input') markAsChanged(); });

    new Sortable(UI.roundsContainer, {
        animation: 150,
        handle: '.card-header',
        onSort: () => { addRoundQuestionNumbers(); markAsChanged(); }
    });

    loadQuiz();



	// Add this function to improve validation error messages
	function improveValidationErrorMessage(error) {
		// The original error message
		const originalMessage = error.message;
		// The path where the error occurred
		const path = error.instancePath;

		// Common error translations
		if (originalMessage === 'must match "then" schema') {
			// Extract the question type from the data
			const pathParts = path.split('/');

			// For questions, check what type it is
			if (path.includes('questions')) {
				// Find the round and question index
				const roundIndex = parseInt(pathParts[pathParts.indexOf('rounds') + 1]);
				const questionIndex = parseInt(pathParts[pathParts.indexOf('questions') + 1]);

				// Get the question data
				const questionData = document.querySelectorAll('.round')[roundIndex]
					?.querySelectorAll('.question')[questionIndex]
					?.dataset.questionData;

				if (questionData) {
					const question = JSON.parse(questionData);

					// Provide specific messages based on question type
					switch (question.type) {

						case 'multiple-choice':
							return "This question requires at least 2 options and a correct answer";

						case 'true-false':
							return "This question requires a True or False answer";

						case 'text':
						case 'number-exact':
						case 'number-closest':
							return "This question requires an answer";

						case 'number-average':
							return "This question does not require an answer";

						case 'hotspot':
							return "This question requires hotspot coordinates";

						case 'point-it-out':
							return "This question requires coordinates of two opposite corners of the rectangle";

						case 'ordering':
							return "This question requires 2-6 items to order plus optional start/end labels";

						case 'matching':
							return "This question requires at least 2 matching pairs";

						case 'draw':
							return "This drawing question is missing required settings";

						default:
							return `This ${question.type} question is missing required fields`;
					}
				}
			}

			// Generic fallback message
			return "This item is missing required fields based on its type";
		}

		// Other common error messages
		if (originalMessage.includes("required property")) {
			const property = originalMessage.match(/'([^']+)'/)?.[1];

			// Map property names to user-friendly terms
			const propertyMap = {
				'title': 'Title',
				'text': 'Question text',
				'answer': 'Answer',
				'options': 'Answer options',
				'correctOption': 'Correct option',
				'items': 'Items to order',
				'pairs': 'Matching pairs',
				'startLabel': 'Start label',
				'endLabel': 'End label'
			};

			return `Missing required field: ${propertyMap[property] || property}`;
		}

		// Return the original message if we don't have a specific improvement
		return originalMessage;
	}


	// Display validation errors and add warning icons
	function displayValidationErrors(validationResults) {

		// First, clear any existing error indicators
		clearValidationErrors();

		if (!validationResults || validationResults.length === 0) {
			return;
		}

		// Create error tracking objects
		const roundErrors = {};  // Store errors by round index
		const questionErrors = {}; // Store errors by round and question indices

		// Display summary of errors at the top
		const errorCount = validationResults.length;
		const errorSummary = document.getElementById('validation-summary');
		errorSummary.textContent = `Found ${errorCount} error${errorCount > 1 ? 's' : ''}. Please fix before saving.`;
		errorSummary.style.display = 'block';

		// Process each error
		validationResults.forEach(error => {
			// Parse the error path to determine where to display the error
			const path = error.instancePath.split('/');

			// Skip the first empty element from the split
			path.shift();

			if (path.length === 0) {
				// Quiz-level error
				displayQuizError(error);
			} else if (path[0] === 'rounds') {
				const roundIndex = parseInt(path[1]);

				// Track round errors
				if (!roundErrors[roundIndex]) {
					roundErrors[roundIndex] = [];
				}
				roundErrors[roundIndex].push(error.message);

				if (path.length === 2 || path.length === 3) {
					// Error on the round itself
					const field = path.length > 2 ? path[2] : null;
					displayRoundError(roundIndex, field, error);
				} else if (path[2] === 'questions') {
					const questionIndex = parseInt(path[3]);

					// Track question errors
					if (!questionErrors[roundIndex]) {
						questionErrors[roundIndex] = {};
					}
					if (!questionErrors[roundIndex][questionIndex]) {
						questionErrors[roundIndex][questionIndex] = [];
					}
					questionErrors[roundIndex][questionIndex].push(error.message);

					// Display error in the question
					const field = path.length > 4 ? path[4] : null;
					displayQuestionError(roundIndex, questionIndex, field, error);
				}
			}
		});

		// Add warning icons to rounds with errors
		Object.keys(roundErrors).forEach(roundIndex => {
			addRoundErrorIndicator(parseInt(roundIndex), roundErrors[roundIndex].length);
		});

		// Add warning icons to questions with errors
		Object.keys(questionErrors).forEach(roundIndex => {
			Object.keys(questionErrors[roundIndex]).forEach(questionIndex => {
				addQuestionErrorIndicator(
					parseInt(roundIndex),
					parseInt(questionIndex),
					questionErrors[roundIndex][questionIndex].length
				);
			});
		});
	}

	// Update clearValidationErrors to hide indicators instead of removing them
	function clearValidationErrors() {
		// Clear summary
		const errorSummary = document.getElementById('validation-summary');
		if (errorSummary) {
			errorSummary.textContent = '';
			errorSummary.style.display = 'none';
		}

		// Clear quiz errors
		document.querySelectorAll('.error-message').forEach(el => el.remove());

		// Clear field errors
		document.querySelectorAll('.error-field').forEach(el => {
			el.classList.remove('error-field');
			el.title = '';
		});

		// Hide error indicators instead of removing them
		document.querySelectorAll('.error-indicator, .warning-indicator').forEach(el => {
			el.style.display = 'none';
			el.classList.remove('animate');
			delete el.dataset.count;
		});
	}

	// Modify the addRoundErrorIndicator function to toggle visibility
	function addRoundErrorIndicator(roundIndex, errorCount) {
		const rounds = document.querySelectorAll('.round');
		if (roundIndex >= 0 && roundIndex < rounds.length) {
			const roundElement = rounds[roundIndex];
			const indicator = roundElement.querySelector('.error-indicator');

			if (indicator) {
				// Make it visible
				indicator.style.display = 'inline-flex';
				indicator.title = `This round has ${errorCount} error${errorCount > 1 ? 's' : ''}`;

				// Add error count if more than 1
				if (errorCount > 1) {
					indicator.dataset.count = errorCount;
				} else {
					delete indicator.dataset.count;
				}

				// Add animation to draw attention
				setTimeout(() => {
					indicator.classList.add('animate');
				}, 100);
			}
		}
	}

	function addRoundWarningIndicator(roundIndex, warningCount) {
		const rounds = document.querySelectorAll('.round');
		if (roundIndex >= 0 && roundIndex < rounds.length) {
			const roundElement = rounds[roundIndex];
			const indicator = roundElement.querySelector('.warning-indicator');

			if (indicator) {
				indicator.style.display = 'inline-flex';
				indicator.title = `This round has ${warningCount} warning${warningCount > 1 ? 's' : ''}`;
				if (warningCount > 1) indicator.dataset.count = warningCount;
				else delete indicator.dataset.count;
				setTimeout(() => indicator.classList.add('animate'), 100);
			}
		}
	}

	// Modify the addQuestionErrorIndicator function to toggle visibility
	function addQuestionErrorIndicator(roundIndex, questionIndex, errorCount) {
		const rounds = document.querySelectorAll('.round');
		if (roundIndex >= 0 && roundIndex < rounds.length) {
			const roundElement = rounds[roundIndex];
			const questions = roundElement.querySelectorAll('.question');

			if (questionIndex >= 0 && questionIndex < questions.length) {
				const questionElement = questions[questionIndex];
				const indicator = questionElement.querySelector('.error-indicator');

				if (indicator) {
					// Make it visible
					indicator.style.display = 'inline-flex';
					indicator.title = `This question has ${errorCount} error${errorCount > 1 ? 's' : ''}`;

					// Add error count if more than 1
					if (errorCount > 1) {
						indicator.dataset.count = errorCount;
					} else {
						delete indicator.dataset.count;
					}

					// Add animation to draw attention
					setTimeout(() => {
						indicator.classList.add('animate');
					}, 100);
				}
			}
		}
	}

	function addQuestionWarningIndicator(roundIndex, questionIndex, warningText) {
		const rounds = document.querySelectorAll('.round');
		if (roundIndex >= 0 && roundIndex < rounds.length) {
			const roundElement = rounds[roundIndex];
			const questions = roundElement.querySelectorAll('.question');

			if (questionIndex >= 0 && questionIndex < questions.length) {
				const questionElement = questions[questionIndex];
				const indicator = questionElement.querySelector('.warning-indicator');

				if (indicator) {
					indicator.style.display = 'inline-flex';
					indicator.title = `AI Warning: ${warningText}`;
					setTimeout(() => indicator.classList.add('animate'), 100);
				}
			}
		}
	}

	// Initialize event listeners for error indicators
	function initErrorIndicatorHandlers() {
		document.addEventListener('click', (event) => {
			if (event.target.closest('.error-indicator')) {
				const indicator = event.target.closest('.error-indicator');

				// Find the closest round or question
				const container = indicator.closest('.round, .question');

				// Ensure it's expanded to show the errors
				if (container && !container.hasAttribute('open')) {
					container.setAttribute('open', 'true');
				}

				// Animate the error messages to draw attention
				const errorMessages = container.querySelectorAll('.error-message');
				errorMessages.forEach(msg => {
					msg.style.transition = 'background-color 0.5s';
					msg.style.backgroundColor = 'rgba(240, 173, 78, 0.3)';
					setTimeout(() => {
						msg.style.backgroundColor = 'rgba(217, 83, 79, 0.1)';
					}, 500);
				});
			}
		});
	}


	// Display quiz-level error
	function displayQuizError(error) {
		const quizElement = document.querySelector('.quiz');
		const errorElement = document.createElement('div');
		errorElement.className = 'error-message';
		errorElement.textContent = improveValidationErrorMessage(error);

		// Insert after the header
		const header = quizElement.querySelector('header');
		header.parentNode.insertBefore(errorElement, header.nextSibling);

		// Also highlight the quiz title if it's empty
		if (error.message.includes('title')) {
			const titleInput = document.getElementById('quiz-title');
			titleInput.classList.add('error-field');
			titleInput.title = error.message;
		}
	}

	// Display round-level error
	function displayRoundError(roundIndex, field, error) {
		const rounds = document.querySelectorAll('.round');
		if (roundIndex >= 0 && roundIndex < rounds.length) {
			const roundElement = rounds[roundIndex];

			// Open the round to show the error
			roundElement.open = true;

			// Create error message
			const errorElement = document.createElement('div');
			errorElement.className = 'error-message';
			errorElement.textContent = improveValidationErrorMessage(error);

			// Insert after the header
			const header = roundElement.querySelector('.card-header');
			if (header) {
				header.parentNode.insertBefore(errorElement, header.nextSibling);
			}

			// Highlight specific fields based on the error message
			let titleInput = null;
			if (error.message.includes('title')) {
				titleInput = roundElement.querySelector('.round-title');
			}
			if (error.instancePath.includes('roundTimer')) {
				titleInput = roundElement.querySelector('[data-field="round-timer"]');
			}
			if (error.instancePath.includes('updateScores')) {
				titleInput = roundElement.querySelector('[data-field="update-scores"]');
			}
			if (error.instancePath.includes('showAnswer')) {
				titleInput = roundElement.querySelector('[data-field="show-answer"]');
			}
			if (titleInput) {
				titleInput.classList.add('error-field');
				titleInput.title = error.message;
			}
		}
	}

	// Display question-level error
	function displayQuestionError(roundIndex, questionIndex, field, error) {
		const rounds = document.querySelectorAll('.round');
		if (roundIndex >= 0 && roundIndex < rounds.length) {
			const roundElement = rounds[roundIndex];
			const questions = roundElement.querySelectorAll('.question');

			if (questionIndex >= 0 && questionIndex < questions.length) {
				const questionElement = questions[questionIndex];

				// Open the round and question to show the error
				roundElement.open = true;
				questionElement.open = true;

				// Create error message
				const errorElement = document.createElement('div');
				errorElement.className = 'error-message';
				errorElement.textContent = improveValidationErrorMessage(error);

				// Insert after the header
				const header = questionElement.querySelector('.card-header');
				if (header) {
					header.parentNode.insertBefore(errorElement, header.nextSibling);
				}

				// Highlight specific field based on the error
				if (field) {
					const fieldElement = questionElement.querySelector(`[data-field="${field}"]`);
					if (fieldElement) {
						fieldElement.classList.add('error-field');
						fieldElement.title = error.message;
					}
				} else if (error.message.includes('text')) {
					const textInput = questionElement.querySelector('[data-field="question-text"]');
					textInput.classList.add('error-field');
					textInput.title = error.message;
				} else if (error.message.includes('answer')) {
					const answerInput = questionElement.querySelector('[data-field="answer"]');
					if (answerInput) {
						answerInput.classList.add('error-field');
						answerInput.title = error.message;
					}
				}

			}
		}
	}
}
