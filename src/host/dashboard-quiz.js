import { FileDropzone } from './FileDropzone.js';

export function initDashboardQuiz() {

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

	fetchQuizzes();

	async function fetchQuizzes() {
		try {
			const response = await fetch('/api/quiz', {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' }
			});
			const result = await response.json();
			if (!result.success) throw new Error(result.message || 'Failed to fetch quizzes');
			
			createQuizList(result.data);
		} catch (error) {
			console.error('Error fetching quizzes:', error);
		}
	}

	function createQuizList(quizzes) {
		const quizItemTemplate = document.getElementById('quiz-item-template');
		const quizList = document.getElementById('quiz-items');
		quizList.innerHTML = '';
		
		if (quizzes.length === 0) {
			quizList.innerHTML = '<tr><td colspan="2" class="no-quizzes">No quizzes found. Create one to get started!</td></tr>';
			return;
		}

		quizzes.forEach(quiz => {
			const quizItemElement = quizItemTemplate.content.cloneNode(true);
			const row = quizItemElement.querySelector('tr');
			
			quizItemElement.querySelector('.quiz-item-title').textContent = quiz.title;
			
			quizItemElement.querySelector('.delete-quiz-item').addEventListener('click', (e) => {
				e.stopPropagation();
				if (confirm(`Are you sure you want to delete "${quiz.title}"?`)) {
					deleteQuiz(quiz._id);
				}
			});
			
			// Make the entire row clickable to edit
			row.style.cursor = 'pointer';
			row.addEventListener('click', () => gotoQuizEdit(quiz));

			const errorIndicator = quizItemElement.querySelector('.error-indicator');
			if (quiz.validation && quiz.validation.length > 0) {
				errorIndicator.style.display = 'inline-flex';
				errorIndicator.title = `${quiz.validation.length} validation issues found`;
			} else {
				errorIndicator.style.display = 'none';
			}
			
			quizList.appendChild(quizItemElement);
		});
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
