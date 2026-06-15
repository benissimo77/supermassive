import { FileDropzone } from './FileDropzone.js';

export function initDashboardQuiz() {

	const createQuizButton = document.getElementById('create-quiz');
	createQuizButton.addEventListener('click', createQuiz);

	// Add collapse/expand functionality to card headers
	document.querySelectorAll('.card-header').forEach(header => {
		header.addEventListener('click', () => {
			const card = header.closest('.card');
			card.classList.toggle('collapsed');
		});
	});

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

	fetchQuizzes();

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

			let user = null;
			if (userResponse.ok) {
				const userData = await userResponse.json();
				user = (userData && userData.success && userData.data) ? userData.data.user : null;
			}
			
			createQuizList(result.data, user);
		} catch (error) {
			console.error('Error fetching quizzes:', error);
		}
	}

	function createQuizList(quizzes, user) {
		const quizItemTemplate = document.getElementById('quiz-item-template');
		const personalSection = document.getElementById('personal-quiz-list');
		const publicSection = document.getElementById('public-quiz-list');
		const personalList = document.getElementById('personal-quiz-items');
		const publicList = document.getElementById('public-quiz-items');
		
		const currentUserId = (user && (user._id || user.id)) ? String(user._id || user.id) : null;

		const personalQuizzes = quizzes.filter(q => {
			const ownerId = q.ownerID || q.owner;
			return ownerId && String(ownerId) === currentUserId;
		});
		
		const publicQuizzes = quizzes.filter(q => {
			const ownerId = q.ownerID || q.owner;
			return q.public === true && (!ownerId || String(ownerId) !== currentUserId);
		});

		if (personalQuizzes.length === 0) {
			personalSection.querySelector('.quiz-table').remove();
		} else {
			personalSection.querySelector('.empty-state').remove();
			renderQuizTable(personalQuizzes, personalList, true);
		}

		if (publicQuizzes.length === 0) {
			publicSection.querySelector('.quiz-table').remove();
		} else {
			publicSection.querySelector('.empty-state').remove();
			renderQuizTable(publicQuizzes, publicList, false);
		}

		function renderQuizTable(quizArray, targetElement, isPersonal) {
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

				quizItemElement.querySelector('.quiz-item-title').textContent = quiz.title;
				
				const deleteBtn = quizItemElement.querySelector('.delete-quiz-item');
				if (isPersonal) {
					deleteBtn.addEventListener('click', (e) => {
						e.stopPropagation();
						if (confirm(`Are you sure you want to delete "${quiz.title}"?`)) {
							deleteQuiz(quiz._id);
						}
					});
				} else {
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

	async function deleteQuiz(quizId) {
		try {
			const response = await fetch(`/api/quiz/${quizId}`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' }
			});
			const result = await response.json();
			if (!result.success) throw new Error(result.message || 'Failed to delete quiz');
			fetchQuizzes();
		} catch (error) {
			console.error('Error deleting quiz:', error);
			alert('Error deleting quiz: ' + error.message);
		}
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
}

document.addEventListener('DOMContentLoaded', initDashboardQuiz);
