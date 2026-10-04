import { FileDropzone } from './FileDropzone.js';
import { runSave } from '../utils/saveButton.js';
import { SUBJECTS, AGE_RANGES, DIFFICULTY_ITEMS, RATING_FILTER_THRESHOLD, renderPillGroup } from '../utils/quizTags.js';

// Globals - scoped to this module
let currentUser = null;
let allQuizzes = []; // fetched once, filtered in memory on every pill toggle

const filters = {
	subjects: new Set(),    // independent multi-toggle
	ageRanges: new Set(),   // independent multi-toggle
	difficulty: null,       // single-select - clicking the active pill again clears it
	ratingMin: null         // single standalone toggle - RATING_FILTER_THRESHOLD or null
};

function initDashboardQuiz() {

	const createQuizButton = document.getElementById('create-quiz');
	createQuizButton.addEventListener('click', createQuiz);

	// Initialize import quiz dropzone
	const importQuizDropzone = new FileDropzone({
		element: '#import-quiz-dropzone',
		accept: '.json,application/json',
		onDrop: (files) => {
			if (files.length > 0) {
				importQuizFromFile(files[0]);
			}
		},
		onError: (error) => {
			alert(error);
		}
	});

	renderFilterBadges();
	fetchQuizzes();

}

async function fetchQuizzes() {
	try {
		const quizResPromise = fetch('/api/quiz', {
			method: 'GET',
			headers: { 'Content-Type': 'application/json' }
		});
		const userResPromise = fetch('/auth/me');

		const [quizResponse, userResponse] = await Promise.all([quizResPromise, userResPromise]);

		const result = await quizResponse.json();
		if (!result.success) throw new Error(result.message || 'Failed to fetch quizzes');

		if (userResponse.ok) {
			const userData = await userResponse.json();
			currentUser = (userData && userData.success && userData.data) ? userData.data.user : null;
		}

		allQuizzes = result.data;
		rerenderAll();
	} catch (error) {
		console.error('Error fetching quizzes:', error);
	}
}

function rerenderAll() {
	createQuizList(applyFilters(allQuizzes), currentUser);
}

function applyFilters(quizzes) {
	return quizzes.filter(quiz => {
		if (filters.subjects.size > 0 && !(quiz.subjects || []).some(s => filters.subjects.has(s))) return false;
		if (filters.ageRanges.size > 0 && !(quiz.ageRanges || []).some(a => filters.ageRanges.has(a))) return false;
		if (filters.difficulty && quiz.difficulty !== filters.difficulty) return false;
		if (filters.ratingMin && (quiz.rating || 0) < filters.ratingMin) return false;
		return true;
	});
}

// --- Filter pills: rendered via the shared renderPillGroup() (websrc/utils/quizTags.js),
// the same helper the quiz editor's Tags section uses, so the two pages can't visually
// drift apart or duplicate this DOM-building code. ---

function renderFilterBadges() {
	const subjectsContainer = document.getElementById('filter-subjects');
	const ageRangesContainer = document.getElementById('filter-age-ranges');
	const difficultyContainer = document.getElementById('filter-difficulty');
	const ratingContainer = document.getElementById('filter-rating');
	if (!subjectsContainer) return;

	renderPillGroup(subjectsContainer, 'Subject Matter', SUBJECTS,
		(key) => filters.subjects.has(key),
		(key) => {
			if (filters.subjects.has(key)) filters.subjects.delete(key);
			else filters.subjects.add(key);
			renderFilterBadges();
			rerenderAll();
		});

	renderPillGroup(ageRangesContainer, 'Age Suitability', AGE_RANGES,
		(key) => filters.ageRanges.has(key),
		(key) => {
			if (filters.ageRanges.has(key)) filters.ageRanges.delete(key);
			else filters.ageRanges.add(key);
			renderFilterBadges();
			rerenderAll();
		});

	renderPillGroup(difficultyContainer, 'Difficulty', DIFFICULTY_ITEMS,
		(key) => filters.difficulty === key,
		(key) => {
			filters.difficulty = filters.difficulty === key ? null : key;
			renderFilterBadges();
			rerenderAll();
		});

	renderPillGroup(ratingContainer, 'Rating', [{ key: 'ratingMin', label: `★ ${RATING_FILTER_THRESHOLD}+`, color: '#FFD700' }],
		() => filters.ratingMin === RATING_FILTER_THRESHOLD,
		() => {
			filters.ratingMin = filters.ratingMin === RATING_FILTER_THRESHOLD ? null : RATING_FILTER_THRESHOLD;
			renderFilterBadges();
			rerenderAll();
		});
}

function createQuizList(quizzes, user) {
	const quizItemTemplate = document.getElementById('quiz-item-template');
	const personalSection = document.getElementById('personal-quiz-list');
	const publicSection = document.getElementById('public-quiz-list');
	const personalList = document.getElementById('personal-quiz-items');
	const publicList = document.getElementById('public-quiz-items');

	const currentUserId = (user && (user._id)) ? String(user._id) : null;

	const personalQuizzes = quizzes.filter(quiz => {
		return quiz.ownerID && String(quiz.ownerID) === currentUserId;
	});

	const publicQuizzes = quizzes.filter(quiz => {
		const isPublic = quiz.isPublic !== undefined ? quiz.isPublic : quiz.public;
		return isPublic === true && quiz.ownerID && String(quiz.ownerID) !== currentUserId;
	});

	if (personalQuizzes.length === 0) {
		personalSection.querySelector('.quiz-table').style.display = 'none';
		personalSection.querySelector('.empty-state').style.display = 'block';
	} else {
		personalSection.querySelector('.quiz-table').style.display = 'table';
		personalSection.querySelector('.empty-state').style.display = 'none';
		renderQuizTable(personalQuizzes, personalList, true);
	}

	if (publicQuizzes.length === 0) {
		publicSection.querySelector('.quiz-table').style.display = 'none';
		publicSection.querySelector('.empty-state').style.display = 'block';
	} else {
		publicSection.querySelector('.quiz-table').style.display = 'table';
		publicSection.querySelector('.empty-state').style.display = 'none';
		renderQuizTable(publicQuizzes, publicList, false);
	}

	function renderQuizTable(quizArray, targetElement, isPersonal) {

		// In case we are re-entering with an updated list we need to clear existing items
		targetElement.innerHTML = '';

		quizArray.forEach(quiz => {
			const quizItemElement = quizItemTemplate.content.cloneNode(true);
			const row = quizItemElement.querySelector('tr');

			// Render Stars
			const starsContainer = quizItemElement.querySelector('.rating-stars');
			const rating = quiz.rating || 0;
			for (let i = 1; i <= 5; i++) {
				const star = document.createElement('span');
				star.innerHTML = '★';
				star.style.fontSize = '1.6rem';
				star.style.marginRight = '-3px'; // Squashed together
				star.style.color = i <= rating ? '#FFD700' : 'rgba(120, 120, 120, 0.2)'; // Gold or Gray
				if (i <= rating) {
					star.style.textShadow = '0 0 3px rgba(255, 215, 0, 0.6), 0 0 1px rgba(255, 255, 255, 0.5)'; // Subtle highlight
				}
				starsContainer.appendChild(star);
			}

			// Set the title and (for admin only - ie me) show if it's public
			if (isPersonal && currentUser?.role === 'admin') {
				const isPublic = quiz.isPublic !== undefined ? quiz.isPublic : quiz.public;
				quizItemElement.querySelector('.public-quiz').hidden = !isPublic;
			}
			quizItemElement.querySelector('.quiz-item-title').textContent = quiz.title;

			const metaEl = quizItemElement.querySelector('.quiz-item-meta');
			if (metaEl && (quiz.roundCount !== undefined || quiz.questionCount !== undefined)) {
				metaEl.textContent = `${quiz.roundCount || 0} round${quiz.roundCount === 1 ? '' : 's'} · ${quiz.questionCount || 0} question${quiz.questionCount === 1 ? '' : 's'}`;
			}

			const deleteBtn = quizItemElement.querySelector('.delete-quiz-item');
			const copyBtn = quizItemElement.querySelector('.copy-quiz-item');
			if (isPersonal) {
				deleteBtn.addEventListener('click', (e) => {
					e.stopPropagation();
					if (confirm(`Are you sure you want to delete "${quiz.title}"?`)) {
						deleteQuiz(quiz._id, deleteBtn);
					}
				});
				copyBtn.style.display = 'none';
			} else {
				copyBtn.addEventListener('click', (e) => {
					e.stopPropagation();
					copyQuiz(quiz._id, copyBtn);
				});
				deleteBtn.style.display = 'none';
			}

			// Make the entire row clickable to edit (or view if public)
			row.style.cursor = 'pointer';
			row.addEventListener('click', () => gotoQuizEdit(quiz));

			const errorIndicator = quizItemElement.querySelector('.error-indicator');
			if (quiz.validation && quiz.validation.length > 0) {
				errorIndicator.style.display = 'inline-flex';
				errorIndicator.title = `${quiz.validation.length} validation issues found`;
			} else {
				errorIndicator.style.display = 'none';
			}

			targetElement.appendChild(quizItemElement);
		});
	}
}

function createQuiz() {
	gotoQuizEdit({ title: 'New Quiz', description: '', rounds: [] });
}

async function deleteQuiz(quizId, btn) {
	const result = await runSave(btn, async () => {
		const response = await fetch(`/api/quiz/${quizId}`, {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' }
		});
		return response.json();
	}, {
		savingText: 'Deleting...',
		onError: (err) => alert('Error deleting quiz: ' + err.message)
	});
	if (result) fetchQuizzes();
}

async function copyQuiz(quizId, btn) {
	const result = await runSave(btn, async () => {
		const response = await fetch(`/api/quiz/${quizId}/copy`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' }
		});
		return response.json();
	}, {
		savingText: 'Copying...',
		onError: (err) => alert('Error copying quiz: ' + err.message)
	});
	if (result) fetchQuizzes();
}

function gotoQuizEdit(quiz) {
	window.location.href = '/host/dashboard/quiz/edit' + (quiz && quiz._id ? `?id=${quiz._id}` : '');
}

async function importQuizFromFile(file) {
	alert(`Importing quiz from file: ${file.name}`);
	if (!file.name.endsWith('.json') && file.type !== 'application/json') {
		alert('Please select a JSON file.');
		return;
	}

	try {
		const text = await file.text();
		const quizData = JSON.parse(text);

		// Remove _id to ensure it's treated as a new quiz
		delete quizData._id;

		const response = await fetch('/api/quiz/save', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(quizData)
		});

		const result = await response.json();
		if (result.success) {
			alert('Quiz imported successfully!');
			fetchQuizzes();
		} else {
			alert('Failed to import quiz: ' + (result.message || 'Unknown error'));
		}
	} catch (error) {
		console.error('Error importing quiz:', error);
		alert('Error importing quiz. Please ensure it is a valid JSON file.');
	}
}


document.addEventListener('DOMContentLoaded', initDashboardQuiz);
