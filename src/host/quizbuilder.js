import { ImageSelector } from '../ImageSelector';
import { FileDropzone } from './FileDropzone.js';
import { ImageLibrary } from './ImageLibrary.js';

let hasUnsavedChanges = false;

document.addEventListener('DOMContentLoaded', () => {

	// Add beforeunload event listener to warn about unsaved changes
	window.addEventListener('beforeunload', (e) => {
		if (hasUnsavedChanges) {
			// Standard message (browser will usually show its own message)
			const message = 'You have unsaved changes. Are you sure you want to leave?';
			e.returnValue = message;
			return message;
		}
	});

	const roundsContainer = document.getElementById('rounds-container');

	const createQuizButton = document.getElementById('create-quiz');
	createQuizButton.addEventListener('click', createQuiz);

	const hostQuizButton = document.getElementById('host-quiz');
	hostQuizButton.addEventListener('click', hostQuiz);

	const addRoundButton = document.getElementById('add-round');
	addRoundButton.addEventListener('click', addRoundToDOM);

	const quizTitle = document.getElementById('quiz-title');
	quizTitle.addEventListener('blur', updateHeaderWithTitle);

	const exportQuizButton = document.getElementById('export-quiz');
	// exportQuizButton.addEventListener('click', exportQuiz);

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
			alert(error); // Or display in a nicer way
		}
	});

	const saveQuizButton = document.getElementById('save-quiz');
	saveQuizButton.addEventListener('click', saveQuiz);

	const backToQuizListButton = document.getElementById('back-to-quiz-list');
	backToQuizListButton.addEventListener('click', backToQuizList);

	// Event delegation for delete buttons, image selection...
	document.addEventListener('click', async (event) => {

		// Image selection modal
		if (event.target.matches('.select-image-btn')) {
			const questionElement = event.target.closest('.question');

			// Create and show image selector
			const imageSelector = new ImageLibrary({
				onSelect: (image) => {
					// Update the question with selected image
					const imagePreview = questionElement.querySelector('[data-field="question-image"]');
					const imageUrlField = questionElement.querySelector('[data-field="question-image-url"]');

					imagePreview.src = image.url;
					imagePreview.style.display = 'block';
					imageUrlField.value = image.url;

					// Show clear button / hide add button
					questionElement.querySelector('.clear-image-btn').style.display = 'inline-block';
					questionElement.querySelector('.add-from-library').style.display = 'none';

					// In the event that we are on a Hotspot or Point-it-out question, update the image selector src too
					setImageSelectorSrc(questionElement, image.url);
				}
			});

			imageSelector.show();
		}
		// Remove image from question (needed?)
		if (event.target.matches('.clear-image-btn')) {
			const questionElement = event.target.closest('.question');

			// Clear image
			const imagePreview = questionElement.querySelector('[data-field="question-image"]');
			const imageUrlField = questionElement.querySelector('[data-field="question-image-url"]');

			imagePreview.src = '';
			imagePreview.style.display = 'none';
			imageUrlField.value = '';

			// Hide clear button / Show add button
			event.target.style.display = 'none';
			questionElement.querySelector('.add-from-library').style.display = "inline-block";
		}

		if (event.target.classList.contains('delete-btn')) {
			const elementToRemove = event.target.closest('.round, .question');
			console.log('delete-btn:', elementToRemove, elementToRemove.classList[0]);

			// If deleteing a round then must send message to server to delete round
			// Otherwise quiz will be submitted and merged with existing quiz data - no delete
			if (elementToRemove.classList[0] == "round") {
				const roundId = elementToRemove.querySelector('.round-id').value;
				const quizId = document.getElementById('quiz-id').value;
				console.log('DELETE:', quizId, roundId);
				// We might not have sent these to DB yet, so only DELETE if we have an _id
				if (quizId && roundId) {
					try {
						const response = await fetch(`/api/quiz/${quizId}/${roundId}`, {
							method: 'DELETE',
							headers: {
								'Content-Type': 'application/json',
								// Include any necessary authentication headers here
							},
						});
						if (!response.ok) {
							throw new Error('Network response was not ok');
						}
						// No need to check the response
					} catch (error) {
						console.error('Error deleting round:', error);
					}
				}
			}
			// Finally, remove the DOM element
			elementToRemove.remove();
			addRoundQuestionNumbers();
		}
	});

	new Sortable(roundsContainer, {
		animation: 150,
		handle: 'summary',
		onSort: (evt) => {
			addRoundQuestionNumbers();
		},
	});

	// Quill is loaded via the HTML page
	// const quill = new Quill('#quiz-description', {
	// 	theme: 'snow',
	// 	modules: {
	// 		toolbar: [
	// 			['bold', 'italic', 'underline', 'strike'],
	// 			[{ 'header': 1 }, { 'header': 2 }],
	// 			[{ 'list': 'ordered' }, { 'list': 'bullet' }]
	// 		]
	// 	},
	// 	placeholder: 'Enter quiz description',
	// 	bounds: '#quiz-description',
	// 	maxHeight: '300px'
	// });


	// importQuizFromURL('quiz-new.json');
	fetchQuizzes();

	// Initialize error indicator handlers
	initErrorIndicatorHandlers();

	// Function to fetch quizzes from the API
	async function fetchQuizzes() {
		console.log('fetchQuizzes');

		try {
			const response = await fetch('/api/quiz', {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					// Include any necessary authentication headers here
				}
			});
			const result = await response.json();

			if (!result.success) {
				throw new Error(result);
			}


			// Make the quiz-list div and button panel visible and hide the quiz (edit) div
			document.getElementById('quiz-list').style.display = 'block';
			document.getElementById('button-panel').style.display = 'flex';
			document.getElementById('quiz-edit').style.display = 'none';
			createQuizList(result.data);

		} catch (error) {
			console.error('Error fetching quizzes:', error);
			// Optionally, display an error message to the user
		}
	}

	function createQuizList(quizzes) {
		const quizItemTemplate = document.getElementById('quiz-item-template');
		const quizList = document.getElementById('quiz-items');
		quizList.innerHTML = '';
		quizzes.forEach(quiz => {
			const quizItemElement = quizItemTemplate.content.cloneNode(true);
			quizItemElement.querySelector('.quiz-item-title').textContent = quiz.title;
			quizItemElement.querySelector('.delete-quiz-item').addEventListener('click', () => { const confirmed = confirm('Confirm Delete'); console.log(confirmed); if (confirmed) { deleteQuiz(quiz._id); } });
			quizItemElement.querySelector('.edit-quiz-item').addEventListener('click', () => createQuizFromJSON(quiz));
			quizItemElement.querySelector('.error-indicator').style.display = (quiz.validation && quiz.validation.length > 0) ? 'inline-flex' : 'none';
			quizList.appendChild(quizItemElement);
		});
	}

	// Function to create a new quiz - a bit hacky for now, but will do for testing
	function createQuiz() {
		createQuizFromJSON({ title: 'New Quiz', description: 'Add additional info here - prizes, rounds...', rounds: [] });
	}

	async function deleteQuiz(quizId) {

		const response = await fetch(`/api/quiz/${quizId}`, {
			method: 'DELETE',
			headers: {
				'Content-Type': 'application/json',
				// Include any necessary authentication headers here
			}
		});
		const result = await response.json();

		if (!result.success) {
			throw new Error(result);
		}

		fetchQuizzes();

	}

	function hostQuiz() {
		const quizID = document.getElementById('quiz-id').value;
		if (quizID) {
			window.location.href = `/host/lobby?host=1&q=${quizID}`;
		} else {
			alert('Please save the quiz before hosting it');
		}
	}

	// saveQuiz
	// First validates the quiz and, if valid, sends to server to save
	async function saveQuiz(event) {
		event.preventDefault(); // Prevent the default form submission

		// Collect quiz data from the form
		const quizJSON = createJSONfromQuiz();

		// Update the full JSON object into the HTML page for debugging
		document.getElementById('quiz-json').textContent = JSON.stringify(quizJSON, null, 2);
		
		// Re-validate the quiz before saving
		const validation = await validateQuizSchema(quizJSON);
		if (!validation.valid) {
			console.log('Quiz validation failed:', validation);
			alert('Errors found: please correct before saving)');
			// Update the error indicators
			displayValidationErrors(validation.errors);
			return;
		}

		// Get the button id to replace with saving/saved message
		const saveQuizElement = document.getElementById('save-quiz');
		saveQuizElement.textContent = 'Saving...';


		try {
			const response = await fetch('/api/quiz/save', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					// Include any necessary authentication headers here
				},
				body: JSON.stringify(quizJSON) // Convert the quiz data to JSON
			});
			const result = await response.json();

			if (!result.success) {
				console.log('Error saving quiz: please correct any errors and try again');
				saveQuizElement.textContent = 'Save Quiz';
				alert('Error saving quiz: ' + (result.message || 'Unknown error'));
				return;
			}

			// Parse the response as JSON - note it could have validation errors
			console.log('Quiz saved successfully:', result);
			saveQuizElement.textContent = 'Saved';
			const saveQuizTimeout = setTimeout(() => {
				saveQuizElement.textContent = 'Save Quiz';
				clearTimeout(saveQuizTimeout);
			}, 3000);

			createQuizFromJSON(result.data);

		} catch (error) {
			console.error('Error saving quiz:', error);
			// Optionally, display an error message to the user
		}
	}

	function addCollapseAll(summaryElement) {
		summaryElement.addEventListener('click', (event) => {
			// The click event is fired BEFORE the details element is opened/closed
			const details = summaryElement.parentNode;
			console.log('summaryElement:', event.target, details.hasAttribute('open'));
			if (details.hasAttribute('open')) {
				const allDetails = details.querySelectorAll('details');
				allDetails.forEach(detail => {
					detail.removeAttribute('open');
				});
			}
		});
	}

	function addRoundToDOM() {
		console.log('addRoundToDOM');
		const roundTemplate = document.getElementById('round-template');
		const roundElement = roundTemplate.content.cloneNode(true);
		const questionsContainer = roundElement.querySelector('.questions-container');
		const addQuestionButton = roundElement.querySelector('.question-btn');
		const summaryElement = roundElement.querySelector('.header-round');

		// Add event handlers for round elements
		addQuestionButton.addEventListener('click', () => addQuestionToDOM(questionsContainer));
		roundElement.querySelector('.round-title').addEventListener('blur', updateHeaderWithTitle);
		if (summaryElement) {
			addCollapseAll(summaryElement);
		}

		roundsContainer.appendChild(roundElement);

		const roundSorttable = new Sortable(questionsContainer, {
			animation: 150,
			handle: 'summary',
			group: 'questions',
			scroll: true, // enables auto-scrolling while dragging
			scrollSensitivity: 60,
			onSort: (evt) => {
				console.log('roundSorttable onSort:', evt);
				addRoundQuestionNumbers();
			},
		});

		addRoundQuestionNumbers();

	}

	function addQuestionToDOM(container) {
		const questionTemplate = document.getElementById('question-template');
		const questionElement = questionTemplate.content.cloneNode(true);

		const questionNumber = container.children.length + 1;
		questionElement.querySelector('.header-question-number').textContent = questionNumber;

		// Add event listener for question text changes (update header)
		const questionText = questionElement.querySelector('[data-field="question-text"]');
		questionText.addEventListener('blur', updateHeaderWithTitle);

		// Add event listener for question type changes
		const typeSelector = questionElement.querySelector('.question-type');
		typeSelector.addEventListener('change', questionTypeChangeListener);
		// ...and call the question type change handler immediately to initialise with the default question type (text)
		handleQuestionTypeChange(questionElement);

		// Add event listener for question-image-url changes
		const questionImage = questionElement.querySelector('[data-field="question-image-url"]');
		questionImage.addEventListener('blur', handleExternalImageURL);

		// Add the question to the DOM (container)
		container.appendChild(questionElement);

		addRoundQuestionNumbers();
	}

	function questionTypeChangeListener(event) {
		const questionElement = event.target.closest('.question');
		handleQuestionTypeChange(questionElement);
	}
	function handleQuestionTypeChange(questionElement) {

		// Set up some constants for use in the switch statement
		const contentContainer = questionElement.querySelector('.question-specific-content');
		const questionType = questionElement.querySelector('.question-type').value;
		const questionHint = questionElement.querySelector('.question-type-hint');
		const questionImage = questionElement.querySelector('[data-field="question-image"]');
		console.log('handleQuestionTypeChange:', questionType);

		// Clear existing content
		contentContainer.innerHTML = '';

		switch (questionType) {
			case 'text':
				contentContainer.innerHTML = `
                    <label>Answer:</label><input type="text" data-field="answer" placeholder="Enter answer">
                `;
				questionHint.textContent = 'Basic question - players type the answer via an on-screen keyboard';
				break;
			case 'number-exact':
				questionHint.textContent = 'Answer is numeric - players must get the answer exactly right to score the points';
				contentContainer.innerHTML = `
                    <label>Answer:</label><input type="number" data-field="answer" placeholder="Enter answer">
                `;
				break

			case 'number-closest':
				questionHint.textContent = 'Answer is numeric - players who get closest to the answer score the points';
				contentContainer.innerHTML = `
                    <label>Answer:</label><input type="number" data-field="answer" placeholder="Enter answer">
                `;
				break

			case 'number-average':
				questionHint.textContent = 'Answer is numeric - players who get closest to the average of all player guesses score the points. Question may have an answer, or could be totally subjective.';
				contentContainer.innerHTML = `
                    <label>Answer:</label><input type="number" data-field="answer" placeholder="Optional answer - if there is one">
                `;
				break

				case 'multiple-choice':
				questionHint.textContent = 'Players select an answer from the provided options';
				contentContainer.innerHTML = `
                        <input class="question-field" type="text" data-field="option-1" placeholder="This is the correct answer">
                        <input class="question-field" type="text" data-field="option-2" placeholder="Enter option">
                        <input class="question-field" type="text" data-field="option-3" placeholder="Enter option">
                        <input class="question-field" type="text" data-field="option-4" placeholder="Enter option">
                        <p>Optionally add up to 4 more answers</p>
                        <input class="question-field" type="text" data-field="option-5" placeholder="...">
                        <input class="question-field" type="text" data-field="option-6" placeholder="...">
                        <input class="question-field" type="text" data-field="option-7" placeholder="...">
                        <input class="question-field" type="text" data-field="option-8" placeholder="...">
                    </div>
                `;
				break;
			case 'true-false':
				questionHint.textContent = 'Only two possible answers here...';
				contentContainer.innerHTML = `
                    <label>Answer:</label><select data-field="answer">
                        <option value="true">True</option>
                        <option value="false">False</option>
                    </select></p>
                `;
				break;
			case 'matching':
				questionHint.textContent = 'Players drag items from the left to the matching option on the right (max 5 pairs, can be less just leave empty if not needed)';
				contentContainer.innerHTML = `
                    <div class="question-row">
                        <input class="question-field" type="text" data-field="left-1" placeholder="Left item 1">
                        <input class="question-field" type="text" data-field="right-1" placeholder="Right item 1">
                    </div>
                    <div class="question-row">
                        <input class="question-field" type="text" data-field="left-2" placeholder="Left item 2">
                        <input class="question-field" type="text" data-field="right-2" placeholder="Right item 2">
                    </div>
                    <div class="question-row">
                        <input class="question-field" type="text" data-field="left-3" placeholder="Left item 3">
                        <input class="question-field" type="text" data-field="right-3" placeholder="Right item 3">
                    </div>
                    <div class="question-row">
                        <input class="question-field" type="text" data-field="left-4" placeholder="Left item 4">
                        <input class="question-field" type="text" data-field="right-4" placeholder="Right item 4">
                    </div>
                    <div class="question-row">
                        <input class="question-field" type="text" data-field="left-5" placeholder="Left item 5">
                        <input class="question-field" type="text" data-field="right-5" placeholder="Right item 5">
                    </div>
                `;
				break;
			case 'ordering':
				questionHint.textContent = 'Players drag items into the correct order';
				contentContainer.innerHTML = `
                        <label>Start label:</label><input type="text" data-field="order-start" placeholder="eg Earliest">
                        <label>End label:</label><input type="text" data-field="order-end" placeholder="eg Latest">
                        <label>Items to Order (enter in correct order):</label>
                        <div class="ordering-items">
                            <input type="text" data-field="order-item" placeholder="Item 1">
                            <input type="text" data-field="order-item" placeholder="Item 2">
                            <input type="text" data-field="order-item" placeholder="Item 3">
                            <input type="text" data-field="order-item" placeholder="Item 4">
                            <input type="text" data-field="order-item" placeholder="Item 5">
                            <input type="text" data-field="order-item" placeholder="Item 6">
                        </div>
                `;
				break;
			case 'hotspot':
				questionHint.textContent = 'Players select a point on the picture - closest players score the points (select picture on the left column then mark a X at the correct point)';
				contentContainer.innerHTML = `
                    <image-selector data-field="image-selector-preview" class="image-selector-preview" mode="hotspot"></image-selector>
                    <input type="hidden" data-field="hotspot-x">
                    <input type="hidden" data-field="hotspot-y">
                `;
				const hotspotPreview = contentContainer.querySelector('.image-selector-preview');
				hotspotPreview.addEventListener('selection', (event) => imageSelectorSelection(questionElement, event.detail, 'hotspot'));
				if (questionImage.getAttribute('src')) {
					setImageSelectorSrc(questionElement, questionImage.getAttribute('src'));
				}
				break;

			case 'point-it-out':
				questionHint.textContent = 'Similar to hotspot, except players score if they are within the selected rectangular area (select picture on the left column then drag a rectangle on the picture)';
				contentContainer.innerHTML = `
                    <image-selector data-field="image-selector-preview" class="image-selector-preview" mode="rectangle"></image-selector>
                    <input type="hidden" data-field="point-it-out-startx">
                    <input type="hidden" data-field="point-it-out-starty">
                    <input type="hidden" data-field="point-it-out-endx">
                    <input type="hidden" data-field="point-it-out-endy">
                `;
				const pointItOutPreview = contentContainer.querySelector('[data-field="image-selector-preview"]');
				pointItOutPreview.addEventListener('selection', (event) => imageSelectorSelection(questionElement, event.detail, 'point-it-out'));
				if (questionImage.getAttribute('src')) {
					setImageSelectorSrc(questionElement, questionImage.getAttribute('src'));
				}
				break;

			case 'draw':
				questionHint.textContent = 'Players draw or write the answer on their screen - teams mark each others answers';
				contentContainer.innerHTML = `
                    <label>Answer</label><input type="text" data-field="answer" placeholder="Enter answer">
                `;
				break;

		}

	}

	function createCompositeQuestion() {
		const container = document.createElement('div');
		container.className = 'question-content composite';

		// Add the question text field
		container.appendChild(createLabelledInput("Question", "Enter your question"));

		// Add a label for the top of the answer list
		container.appendChild(createUnlabelledInput('Top Label'));

		// Add four text fields for possible answers
		container.appendChild(createMultipleAnswerFields(4));

		// Add a label for the bottom of the answer list
		container.appendChild(createUnlabelledInput('Bottom Label'));

		return container;
	}
	function createQuestionTextField(label, placeholder) {
		const questionField = document.createElement('div');
		questionField.className = 'question-row';
		questionField.innerHTML = `
            <div class="question-field full-width">
                <label>${label}</label><input type="text" class="question-text" placeholder="${placeholder}">
            </div>
        `;
		return questionField;
	}
	function createUnlabelledInput(placeholder) {
		const unlabelField = document.createElement('div');
		unlabelField.className = 'question-field';
		unlabelField.innerHTML = `
            <input type="text" class="label-text" placeholder="${placeholder}">
        `;
		return unlabelField;
	}
	function createUnLabelledInput(label, placeholder) {
		const labelField = document.createElement('div');
		labelField.className = 'question-field';
		labelField.innerHTML = `
            <label>${label}</label><input type="text" class="label-text" placeholder="${placeholder}">
        `;
		return labelField;
	}
	function createQuestionRow(content) {
		const questionRow = document.createElement('div');
		questionRow.className = 'question-row';
		questionRow.innerHTML = content;
		return questionRow;
	}
	function createMultipleAnswerFields(count) {
		const answersContainer = document.createElement('div');
		answersContainer.className = 'question-row';

		for (let i = 1; i <= count; i++) {
			const answerField = createUnlabelledInput("Answer ${i}");
			answersContainer.appendChild(answerField);
		}
		return answersContainer;
	}


	function addRoundQuestionNumbers() {
		const roundElements = document.querySelectorAll('.round');
		roundElements.forEach((roundElement, index) => {
			roundElement.querySelector('.header-round-number').textContent = index + 1;
			const questionElements = roundElement.querySelectorAll('.question');
			questionElements.forEach((questionElement, questionIndex) => {
				questionElement.querySelector('.header-question-number').textContent = questionIndex + 1;
			});
		});
	}
	function updateHeaderWithTitle(event) {
		console.log('updateHeaderWithTitle:', event.target.value);
		const headerToUpdate = event.target.closest('.quiz, .round, .question');
		headerToUpdate.querySelector('.header-title').textContent = event.target.value;
	}

	// Image Upload functions
	// There are three entry point for image uploads:
	// 1. handleDropFiles - called when files are dropped into the dropzone
	// 2. handleFilesUpload - called when (multiple) files are selected from the file input
	// 3. readImageDataFromFiles - the actual file reader
	// 1 and 2 call 3 to carry out the file reading
	function handleDropFiles(event) {
		console.log('handleDropFiles:', event.target.closest('.question'));
		const dt = event.dataTransfer;
		const files = dt.files;
		if (files.length > 0) {
			readImageDataFromFiles(files[0], event.target.closest('.question'));
		}
	}
	function handleQuestionImageUpload(file, questionElement) {
		const reader = new FileReader();
		reader.onload = (e) => {
			const imagePreview = questionElement.querySelector('[data-field="question-image"]');
			imagePreview.src = e.target.result;
			imagePreview.style.display = 'block';

			// Store the data URL in the URL field or in a hidden field
			const imageUrlField = questionElement.querySelector('[data-field="question-image-url"]');
			imageUrlField.value = ''; // Clear URL field since we're using a local file

			// Store the image data for later use (when saving)
			questionElement.dataset.imageData = e.target.result;
		};
		reader.readAsDataURL(file);
	}
	function handleImageUpload(event) {
		console.log('handleImageUpload:', event.target.closest('.question'));
		const files = event.target.files;
		if (files.length > 0) {
			readImageDataFromFiles(files[0], event.target.closest('.question'));
		}
	}
	function readImageDataFromFiles(file, questionElement) {
		console.log('readImageDataFromFiles:', file, questionElement.querySelector('[data-field="question-image"]'));
		const reader = new FileReader();
		reader.onload = function (e) {
			console.log('readImageDataFromFiles onload:', e.target.result);
			// questionElement.dataset.imageData = e.target.result;
			// const previewDiv = questionElement.querySelector('.image-preview');
			// previewDiv.innerHTML = `<img src="${e.target.result}" style="max-width:200px; max-height:200px;">`;
			const imageSelectorPreviews = questionElement.querySelectorAll('[data-field="question-image"]');
			if (imageSelectorPreviews) {
				console.log('setImageSelectorSrc:');
				imageSelectorPreviews.forEach(imageSelectorPreview => {
					setImageSelectorSrc(questionElement, e.target.result);
				});
			}
		}
		reader.readAsDataURL(file);
	}
	// Handle external image url - no need to load the file simply access from the URL
	// Called when question-image element loses focus - update the src attribute of selectors
	function handleExternalImageURL(event) {
		console.log('handleExternalImageURL:', event.target.value);
		// Just in case user focuses and then blurs without entering a URL
		if (event.target.value) {
			const questionElement = event.target.closest('.question');
			setImageSelectorSrc(questionElement, event.target.value);

			// Similar to if selecting image from library - we show the remove button and hide the add button
			questionElement.querySelector('.clear-image-btn').style.display = 'inline-block';
			questionElement.querySelector('.add-from-library').style.display = 'none';

		}
	}

	// setImageSelectorSrc
	// When a new image is selected we update the image-selector-preview elements
	// There can be 2 of these: the first is the question image, the second is the answer image (in the case of hotspot/point-it-out)
	function setImageSelectorSrc(questionElement, src) {
		console.log('setImageSelectorSrc:', src);
		const questionImage = questionElement.querySelector('[data-field="question-image-url"]');
		if (questionImage) {
			questionImage.value = src;
		}
		const imageSelectorPreviews = questionElement.querySelectorAll('.image-selector-preview');
		if (imageSelectorPreviews) {
			console.log('setImageSelectorSrc: imageSelectorPreview:', imageSelectorPreviews);
			imageSelectorPreviews.forEach(imageSelectorPreview => {
				imageSelectorPreview.setAttribute('src', src);
				imageSelectorPreview.style.display = 'block';
			});
		}
	}
	function imageSelectorSelection(questionElement, details, type) {
		console.log('imageSelectorSelection:', questionElement, details, type);
		if (type === 'hotspot') {
			questionElement.querySelector('[data-field="hotspot-x"]').value = details.x;
			questionElement.querySelector('[data-field="hotspot-y"]').value = details.y;
		} else if (type === 'point-it-out') {
			console.log('update point-it-out:', details);
			questionElement.querySelector('[data-field="point-it-out-startx"]').value = details.start.x;
			questionElement.querySelector('[data-field="point-it-out-starty"]').value = details.start.y;
			questionElement.querySelector('[data-field="point-it-out-endx"]').value = details.end.x;
			questionElement.querySelector('[data-field="point-it-out-endy"]').value = details.end.y;
		}
	}

	function createJSONfromQuiz() {

		const quizJSON = {
			_id: document.getElementById('quiz-id').value,
			schemaVersion: document.getElementById('quiz-schema-version').value,
			ownerID: document.getElementById('quiz-owner').value,
			title: document.getElementById('quiz-title').value,
			description: document.getElementById('quiz-description').value,
			// description: document.querySelector('#quiz-description .ql-editor').innerHTML,
			// description: quill.root.innerHTML,
			rounds: Array.from(roundsContainer.querySelectorAll('details.round')).map(roundElement => ({
				_id: roundElement.querySelector('.round-id').value,
				ownerID: roundElement.querySelector('.round-owner').value,
				title: roundElement.querySelector('.round-title').value,
				description: roundElement.querySelector('.round-description').value,
				roundTimer: roundElement.querySelector('[data-field="round-timer"]').value,
				showAnswer: roundElement.querySelector('[data-field="show-answer"]').value,
				updateScores: roundElement.querySelector('[data-field="update-scores"]').value,
				questions: Array.from(roundElement.querySelectorAll('details.question')).map(questionElement => gatherQuestionData(questionElement))
			}))
		}
		console.log('createJSONfromQuiz:', quizJSON);
		return quizJSON;
	}

	function exportQuiz() {

		const quizJSON = createJSONfromQuiz();
		const blob = new Blob([JSON.stringify(quizJSON, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'quiz.json';
		a.click();
		URL.revokeObjectURL(url);
		document.getElementById('quiz-json').value = JSON.stringify(quizJSON, null, 2);
	}

	// Client-side JavaScript
	async function uploadQuiz(quizFile) {
		try {
			// Read the file
			const fileContent = await quizFile.text();
			const quizData = JSON.parse(fileContent);

			// Send to server
			const response = await fetch('/api/quiz/upload', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(quizData)
			});
			const result = await response.json();

			if (!result.success) {
				// Handle validation errors
				displayValidationErrors(result.errors);
				return;
			}

			// Quiz is valid, show success message
			showSuccessMessage(result.message);

		} catch (error) {
			console.error('Error uploading quiz:', error);
			showErrorMessage('Failed to upload quiz. Please try again.');
		}
	}

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
					displayRoundError(roundIndex, error);
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
		document.querySelectorAll('.error-indicator').forEach(el => {
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
		if (message.includes('title')) {
			const titleInput = document.getElementById('quiz-title');
			titleInput.classList.add('error-field');
			titleInput.title = error.message;
		}
	}

	// Display round-level error
	function displayRoundError(roundIndex, error) {
		const rounds = document.querySelectorAll('.round');
		if (roundIndex >= 0 && roundIndex < rounds.length) {
			const roundElement = rounds[roundIndex];

			// Create error message
			const errorElement = document.createElement('div');
			errorElement.className = 'error-message';
			errorElement.textContent = improveValidationErrorMessage(error);

			// Insert after the summary
			const summary = roundElement.querySelector('summary');
			summary.parentNode.insertBefore(errorElement, summary.nextSibling);

			// Highlight specific fields based on the error message
			let titleInput = null;
			if (error.message.includes('title')) {
				titleInput = roundElement.querySelector('.round-title');
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

			// Make sure the round is expanded
			roundElement.setAttribute('open', 'true');
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

				// Create error message
				const errorElement = document.createElement('div');
				errorElement.className = 'error-message';
				errorElement.textContent = improveValidationErrorMessage(error);

				// Insert after the summary
				const summary = questionElement.querySelector('summary');
				summary.parentNode.insertBefore(errorElement, summary.nextSibling);

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

	function displayValidationErrorsOrig(errors) {
		const errorContainer = document.getElementById('validation-errors');
		errorContainer.innerHTML = '';

		const heading = document.createElement('h3');
		heading.textContent = 'Quiz Validation Errors:';
		errorContainer.appendChild(heading);

		const list = document.createElement('ul');
		errors.forEach(error => {
			const item = document.createElement('li');
			// Format error message to be user-friendly
			item.textContent = `${error.instancePath} ${error.message}`;
			list.appendChild(item);
		});

		errorContainer.appendChild(list);
		errorContainer.style.display = 'block';


	}

	function gatherQuestionData(questionElement) {
		const type = questionElement.querySelector('.question-type').value;
		const baseData = {
			type: type,
			_id: questionElement.querySelector('.question-id').value,
			ownerID: questionElement.querySelector('.question-owner').value,
			text: questionElement.querySelector('[data-field="question-text"]').value,
			image: questionElement.querySelector('[data-field="question-image"]').getAttribute('src'),
			audio: questionElement.querySelector('[data-field="question-audio"]').value,
			answer: null,
			options: [],
			pairs: [],
			items: [],
			extra: {}
		};

		console.log('gatherQuestionData:', type, baseData);

		switch (type) {

			case 'multiple-choice':
				let options = [
					questionElement.querySelector('[data-field="option-1"]').value,
					questionElement.querySelector('[data-field="option-2"]').value,
					questionElement.querySelector('[data-field="option-3"]').value,
					questionElement.querySelector('[data-field="option-4"]').value,
					questionElement.querySelector('[data-field="option-5"]').value,
					questionElement.querySelector('[data-field="option-6"]').value,
					questionElement.querySelector('[data-field="option-7"]').value,
					questionElement.querySelector('[data-field="option-8"]').value
				];
				baseData.options = options.filter((option) => { return option != ""; });
				break;

			case 'true-false':
				baseData.answer = questionElement.querySelector('[data-field="answer"]').value;
				break;

			case 'text':
				baseData.answer = questionElement.querySelector('[data-field="answer"]').value;
				break;

			case 'number-exact':
			case 'number-closest':
			case 'number-average':
				const numValue = questionElement.querySelector('[data-field="answer"]').value;
				baseData.answer = numValue !== '' ? Number(numValue) : null;
				break;

			case 'matching':
				const pairs = Array.from([1, 2, 3, 4, 5]).map(index => ({
					left: questionElement.querySelector(`[data-field="left-${index}"]`).value,
					right: questionElement.querySelector(`[data-field="right-${index}"]`).value
				}));
				baseData.pairs = pairs.filter((pair) => { return pair.left != ""; });
				break;

			case 'ordering':
				baseData.extra = {};
				baseData.extra.startLabel = questionElement.querySelector('[data-field="order-start"]').value;
				baseData.extra.endLabel = questionElement.querySelector('[data-field="order-end"]').value;
				const items = Array.from(questionElement.querySelectorAll('[data-field="order-item"]')).map(input => input.value);
				baseData.items = items.filter((item) => { return item != ""; });
				break;

			case 'hotspot':
				// Convert the values to numbers using '+' - send null if x not set
				console.log('gatherQuestionData: hotspot:', questionElement.querySelector('[data-field="hotspot-x"]').value);
				baseData.answer = questionElement.querySelector('[data-field="hotspot-x"]').value ? {
					x: +questionElement.querySelector('[data-field="hotspot-x"]').value,
					y: +questionElement.querySelector('[data-field="hotspot-y"]').value
				} : null;
				break;

			case 'point-it-out':
				baseData.answer = {
					start: {
						x: +questionElement.querySelector('[data-field="point-it-out-startx"]').value,
						y: +questionElement.querySelector('[data-field="point-it-out-starty"]').value
					},
					end: {
						x: +questionElement.querySelector('[data-field="point-it-out-endx"]').value,
						y: +questionElement.querySelector('[data-field="point-it-out-endy"]').value
					}
				};
				break;

			case 'draw':
				baseData.answer = questionElement.querySelector('[data-field="answer"]').value;
				break;

		}

		return baseData;
	}

	// Top-level function to import quiz - must be thoroughly validated before it can be used
	async function importQuizFromFile(file) {

		// Step 1: Validate file type
		if (!file.name.endsWith('.json') && file.type !== 'application/json') {
			alert('Please select a JSON file.');
			return;
		}

		// Step 2: Read file content
		let text;
		try {
			text = await file.text();
			console.log(`Successfully loaded file: ${file.name}`);
		} catch (error) {
			console.error('Error loading quiz file:', error);
			alert(`Failed to load quiz file: ${error.message}`);
			return;
		}

		// Step 3: Parse JSON
		let quizJSON;
		try {
			quizJSON = JSON.parse(text);
		} catch (error) {
			console.error('Error parsing quiz JSON:', error);
			alert(`Failed to parse quiz JSON: ${error.message}`);
			return;
		}

		// Step 4: Create quiz from JSON - this will also perform validation and show errors
		try {
			createQuizFromJSON(quizJSON);
			alert(`Quiz "${quizJSON.title || 'Untitled'}" imported - please correct any errors and then save`);
		} catch (error) {
			console.error('Error creating quiz from JSON:', error);
			alert(`Failed to create quiz: ${error.message}`);
			return;
		}
	}

	// Function to validate quiz against schema via API
	async function validateQuizSchema(quizJSON) {
		try {
			const response = await fetch('/api/quiz/validate', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					// Add any authentication headers needed
				},
				body: JSON.stringify(quizJSON)
			});

			if (!response.ok) {
				throw new Error(`Server returned ${response.status}: ${response.statusText}`);
			}

			const result = await response.json();
			return result.data; // Access the data property of your apiResponse
		} catch (error) {
			console.error("Validation request failed:", error);
			throw error;
		}
	}

	// Function to display schema validation errors in a user-friendly way
	function displaySchemaErrors(errors, quizJSON) {
		// Create modal or popup for errors
		const errorDiv = document.createElement('div');
		errorDiv.className = 'validation-errors';

		// Create header
		const header = document.createElement('h3');
		header.textContent = 'Quiz Validation Errors';
		errorDiv.appendChild(header);

		// Create error list
		const errorList = document.createElement('ul');

		// Process and group errors
		errors.forEach(error => {
			const errorItem = document.createElement('li');
			errorItem.className = 'error-item';

			// Format the error message based on error type
			let message = '';
			let path = error.instancePath || '';

			// Remove leading slash from path
			if (path.startsWith('/')) {
				path = path.substring(1);
			}

			// Convert JSON path to readable location
			const pathParts = path.split('/');
			let humanPath = '';

			if (pathParts.length > 0 && pathParts[0] !== '') {
				if (pathParts[0] === 'rounds') {
					// For round errors, show round title if available
					const roundIndex = parseInt(pathParts[1], 10);
					const roundTitle = quizJSON.rounds?.[roundIndex]?.title || `Round ${roundIndex + 1}`;
					humanPath = `Round: "${roundTitle}"`;

					// For question errors, add question info
					if (pathParts[2] === 'questions') {
						const questionIndex = parseInt(pathParts[3], 10);
						const questionText = quizJSON.rounds?.[roundIndex]?.questions?.[questionIndex]?.text ||
							`Question ${questionIndex + 1}`;
						humanPath += ` → Question: "${questionText.substring(0, 30)}${questionText.length > 30 ? '...' : ''}"`;
					}
				} else {
					humanPath = pathParts.join(' → ');
				}
			}

			// Format by error keyword
			switch (error.keyword) {
				case 'required':
					message = `Missing required field: ${error.params.missingProperty}`;
					break;
				case 'enum':
					message = `Invalid value. Must be one of: ${error.params.allowedValues.join(', ')}`;
					break;
				case 'type':
					message = `Expected type ${error.params.type} but got ${typeof error.data}`;
					break;
				default:
					message = error.message;
			}

			// Construct the full error message
			errorItem.innerHTML = humanPath ?
				`<strong>${humanPath}:</strong> ${message}` : message;

			errorList.appendChild(errorItem);
		});

		errorDiv.appendChild(errorList);

		// Add to page as modal or replace any existing error display
		const existingErrors = document.querySelector('.validation-errors');
		if (existingErrors) {
			existingErrors.remove();
		}

		// Create a simple modal wrapper
		const modalWrapper = document.createElement('div');
		modalWrapper.className = 'error-modal-wrapper';
		modalWrapper.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:9999; display:flex; justify-content:center; align-items:center;';

		// Style the error div as a modal
		errorDiv.style.cssText = 'background:white; border-radius:8px; padding:20px; max-width:80%; max-height:80%; overflow-y:auto; box-shadow:0 4px 8px rgba(0,0,0,0.2);';

		// Add close button
		const closeBtn = document.createElement('button');
		closeBtn.textContent = 'Close';
		closeBtn.style.cssText = 'padding:8px 16px; background:#f44336; color:white; border:none; border-radius:4px; margin-top:15px; cursor:pointer;';
		closeBtn.onclick = () => modalWrapper.remove();
		errorDiv.appendChild(closeBtn);

		// Add modal to page
		modalWrapper.appendChild(errorDiv);
		document.body.appendChild(modalWrapper);
	}

	async function importQuizFromURL(url) {

		fetch(url)
			.then(response => {
				if (!response.ok) {
					throw new Error('Network response was not ok');
				}
				return response.json();
			})
			.then(data => {
				createQuizFromJSON(data);
			})
			.catch(error => {
				console.error('Error:', error);
				alert('Failed to load quiz from URL. Please check the console for more details.');
			});
	}

	async function createQuizFromJSON(quizJSON) {
		console.log('createQuizFromJSON:', quizJSON);

		try {
			// Several steps here when parsing and building a quiz from JSON data
			quizJSON = normalizeQuizData(quizJSON);

			// Validate the basic structure of the quiz - this ensures it will still render in the editor
			quizJSON = validateQuizStructure(quizJSON);

			console.table(quizJSON);

			// Validate the quiz JSON against the schema via API
			const validation = await validateQuizSchema(quizJSON);
			console.log('Validation result:', validation);
			quizJSON.validation = validation.errors || [];

			// if (!validation.valid) {
			// 	// Display validation errors in a user-friendly way
			// 	displaySchemaErrors(validation.errors, quizJSON);
			// }

			// Ragardless of the validation result we still want to show the quiz in the editor
			// The user can then fix any issues highlighted by the validation
			populateQuizWithData(quizJSON);

		} catch (error) {
			console.error('Error during validation:', error);
			alert('An error occurred during quiz validation. Please check the console for details.');
			// Still show the HTML quiz even though validation failed
			populateQuizWithData(quizJSON);
		}
	}

	// Normalize data types in the quiz JSON to ensure consistency
	// This is like another layer of validation
	function normalizeQuizData(quizJSON) {
		if (quizJSON.rounds && Array.isArray(quizJSON.rounds)) {
			quizJSON.rounds.forEach(round => {
				if (round.questions && Array.isArray(round.questions)) {
					round.questions.forEach(question => {
						console.log('Normalizing question:', question);
						// Convert true-false from boolean to string if needed
						if (question.type === 'true-false' && typeof question.answer === 'boolean') {
							question.answer = question.answer ? 'true' : 'false';
						}
						// Add this debug code
						if (question.type === 'true-false') {
							console.log('True-false question answer:',
								question.answer,
								'Type:', typeof question.answer);
						}
						// Convert number types from string to number if needed
						if ((question.type === 'number-exact' || question.type === 'number-closest' || question.type === 'number-average') &&
							typeof question.answer === 'string' && question.answer !== '') {
							question.answer = Number(question.answer);
						}
					});
				}
			});
		}
		return quizJSON;
	}

	function validateQuizStructure(quizJSON) {

		// Ensure top-level arrays exist (but don't add content)
		quizJSON.rounds = quizJSON.rounds || [];

		// Process each round to ensure structure
		quizJSON.rounds.forEach(round => {
			// Ensure questions array exists
			round.questions = round.questions || [];

			// Ensure each question has the basic structure needed to render
			round.questions.forEach(question => {
				// Only ensure properties needed for UI rendering
				// Don't add default values that would hide validation issues

				// For example, ensure multiple-choice has options array
				// but don't populate it with defaults
				if (question.type === 'multiple-choice') {
					question.options = question.options || [];
				}

				// Ensure matching has pairs array
				if (question.type === 'matching') {
					question.pairs = question.pairs || [];
				}

				// Ensure ordering has items array and extra object
				if (question.type === 'ordering') {
					question.items = question.items || [];
					question.extra = question.extra || {};
				}

				// Ensure point-it-out has answer structure
				if (question.type === 'point-it-out' && question.answer) {
					question.answer.start = question.answer.start || {};
					question.answer.end = question.answer.end || {};
				}
			});
		});

		return quizJSON;
	}

	function populateQuizWithData(quizJSON) {
		console.log('populateQuizWithData:', quizJSON);

		document.getElementById('quiz-json').value = JSON.stringify(quizJSON, null, 2);
		document.getElementById('quiz-id').value = quizJSON._id || "";
		document.getElementById('quiz-owner').value = quizJSON.ownerID || "";
		document.getElementById('quiz-schema-version').value = quizJSON.schemaVersion || "";
		document.getElementById('quiz-edit').querySelector('.header-title').textContent = quizJSON.title;
		document.getElementById('quiz-title').value = quizJSON.title;
		// document.getElementById('validation-summary').innerHTML = JSON.stringify(quizJSON.validation);
		// quill.root.innerHTML = quizJSON.description;
		document.getElementById('quiz-description').value = quizJSON.description || "";

		const summaryElement = document.getElementById('quiz-edit').querySelector('.header-quiz');
		if (summaryElement) {
			addCollapseAll(summaryElement);
		}

		roundsContainer.innerHTML = '';
		quizJSON.rounds.forEach(roundJSON => {
			addRoundToDOM();
			const roundElement = roundsContainer.lastElementChild;
			roundElement.querySelector('.header-title').textContent = roundJSON.title || "";
			roundElement.querySelector('.round-title').value = roundJSON.title || "";
			roundElement.querySelector('.round-description').value = roundJSON.description || "";
			roundElement.querySelector('.round-id').value = roundJSON._id || "";
			roundElement.querySelector('.round-owner').value = roundJSON.ownerID || "";
			const rt = roundElement.querySelector('[data-field="round-timer"]');
			roundElement.querySelector('[data-field="round-timer"]').value = roundJSON.roundTimer;
			roundElement.querySelector('[data-field="show-answer"]').value = roundJSON.showAnswer;
			roundElement.querySelector('[data-field="update-scores"]').value = roundJSON.updateScores;

			const questionsContainer = roundElement.querySelector('.questions-container');
			roundJSON.questions.forEach(questionJSON => {

				// Add a basic question template to the DOM, which we will then populate with the question data
				addQuestionToDOM(questionsContainer);
				const questionElement = questionsContainer.lastElementChild;

				// We always have a question text field, this is not question-specific
				questionElement.querySelector('[data-field="question-text"]').value = questionJSON.text;
				questionElement.querySelector('.header-title').textContent = questionJSON.text;

				// We also always have an _id and owner (unless its a new question)
				questionElement.querySelector('.question-id').value = questionJSON._id || "";
				questionElement.querySelector('.question-owner').value = questionJSON.ownerID || "";

				// If we have imageData then we need to set the image selector src
				if (questionJSON.image) {
					setImageSelectorSrc(questionElement, questionJSON.image);
				}

				// What about audio?
				if (questionJSON.audio) {
					const audioInput = questionElement.querySelector('[data-field="question-audio"]');
					audioInput.value = questionJSON.audio;
				}

				// Trigger the select chnage event which will insert the correct question type into the questionElement
				const typeSelect = questionElement.querySelector('.question-type');
				typeSelect.value = questionJSON.type;
				typeSelect.dispatchEvent(new Event('change'));  // This will insert the correct question type into the questionElement

				const contentContainer = questionElement.querySelector('.question-specific-content');
				// contentContainer.querySelector('[data-field="question-text"]').value = question.text || '';

				switch (questionJSON.type) {

					case 'multiple-choice':
						questionJSON.options.forEach((option, index) => {
							contentContainer.querySelector(`[data-field="option-${index + 1}"]`).value = option || '';
						});
						break;

					case 'true-false':
					case 'text':
					case 'number-exact':
					case 'number-closest':
					case 'number-average':
						contentContainer.querySelector('[data-field="answer"]').value = String(questionJSON.answer) || '';
						break;

					case 'matching':
						questionJSON.pairs.forEach((pair, index) => {
							contentContainer.querySelector(`[data-field="left-${index + 1}"]`).value = pair.left || '';
							contentContainer.querySelector(`[data-field="right-${index + 1}"]`).value = pair.right || '';
						});
						break;

					case 'ordering':
						console.log('Ordering:', questionJSON);
						contentContainer.querySelector('[data-field="order-start"]').value = questionJSON.extra.startLabel || '';
						contentContainer.querySelector('[data-field="order-end"]').value = questionJSON.extra.endLabel || '';
						questionJSON.items.forEach((item, index) => {
							contentContainer.querySelectorAll('[data-field="order-item"]')[index].value = item || '';
						});
						break;

					case 'hotspot':
						if (questionJSON.image) {
							const imageSelectorPreview = contentContainer.querySelector(".image-selector-preview");
							if (imageSelectorPreview) {
								imageSelectorPreview.setAttribute('src', questionJSON.image || '');
								console.log('createQuizFromJSON.setAttribute:answer:', questionJSON.answer);
								imageSelectorPreview.setAttribute('answer', JSON.stringify(questionJSON.answer));
							}
						}
						contentContainer.querySelector('[data-field="hotspot-x"]').value = questionJSON.answer.x || '';
						contentContainer.querySelector('[data-field="hotspot-y"]').value = questionJSON.answer.y || '';
						break;

					case 'point-it-out':
						if (questionJSON.image) {
							const imageSelectorPreview = contentContainer.querySelector(".image-selector-preview");
							if (imageSelectorPreview) {
								imageSelectorPreview.setAttribute('src', questionJSON.image || '');
								imageSelectorPreview.setAttribute('answer', JSON.stringify(questionJSON.answer));

							}
						}
						contentContainer.querySelector('[data-field="point-it-out-startx"]').value = questionJSON.answer.start.x || '';
						contentContainer.querySelector('[data-field="point-it-out-starty"]').value = questionJSON.answer.start.y || '';
						contentContainer.querySelector('[data-field="point-it-out-endx"]').value = questionJSON.answer.end.x || '';
						contentContainer.querySelector('[data-field="point-it-out-endy"]').value = questionJSON.answer.end.y || '';
						break;

					case 'draw':
						contentContainer.querySelector('[data-field="answer"]').value = questionJSON.answer || '';
						break;
				}

			});
		});

		// Start with all rounds and questions collapsed (all details children of main quiz summary element)
		// const allDetails = summaryElement.querySelectorAll('details');
		// allDetails.forEach(detail => {
		// 	detail.removeAttribute('open');
		// });
		// Ensure all rounds and questions are collapsed when loading from JSON
		document.querySelectorAll('.round, .question').forEach(element => {
			element.removeAttribute('open');
		});
		addRoundQuestionNumbers();

		// Hide the quiz list and show the quiz
		document.getElementById('button-panel').style.display = 'none';
		document.getElementById('quiz-list').style.display = 'none';
		document.getElementById('quiz-edit').style.display = 'block';

		// Display any validation errors - including the summary at the top of the quiz
		displayValidationErrors(quizJSON.validation);

		// Set up change tracking after quiz is loaded
		setupChangeTracking();
		resetSaveChanges();
	}

	function backToQuizList() {

		// We can just fetch the quiz list from the server and it will automatically switch to quiz list display
		fetchQuizzes();
	}


	function setupChangeTracking() {

		// Remove any existing listeners from the document
		document.removeEventListener('change', handleFormChanges);
		document.removeEventListener('click', handleButtonClicks);

		// Add single listeners using event delegation
		document.addEventListener('change', handleFormChanges);
		document.addEventListener('click', handleButtonClicks);
	}

	function handleFormChanges(event) {
		// Check if the event came from a form element we care about
		console.log('handleFormChanges:', event.target);
		if (event.target.matches('input, textarea, select')) {
			markAsChanged();
		}
	}

	function handleButtonClicks(event) {
		// Check if the event came from a button we care about
		if (event.target.matches('.add-round-btn, .add-question-btn, .delete-btn')) {
			markAsChanged();
		}
	}


	// Reset change tracking after save
	function resetSaveChanges() {
		hasUnsavedChanges = false;
		updateSaveButton();
	}


	// Mark quiz as changed
	function markAsChanged() {
		console.log('markAsChanged called...');
		hasUnsavedChanges = true;
		updateSaveButton();
	}

	// Update save button to indicate unsaved changes
	function updateSaveButton() {
		const saveButton = document.getElementById('save-quiz');
		if (hasUnsavedChanges) {
			saveButton.classList.add('unsaved-changes');
		} else {
			saveButton.classList.remove('unsaved-changes');
		}
	}


});

