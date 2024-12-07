import { ImageSelector } from '../ImageSelector';

document.addEventListener('DOMContentLoaded', () => {
    const roundsContainer = document.getElementById('rounds-container');
    
    const createQuizButton = document.getElementById('create-quiz');
    createQuizButton.addEventListener('click', createQuiz);

    const addRoundButton = document.getElementById('add-round');
    addRoundButton.addEventListener('click', addRoundToDOM);

    const quizTitle = document.getElementById('quiz-title');
    quizTitle.addEventListener('blur', updateHeaderWithTitle);

    const exportQuizButton = document.getElementById('export-quiz');
    // exportQuizButton.addEventListener('click', exportQuiz);

    const importQuizInput = document.getElementById('import-quiz');
    // importQuizInput.addEventListener('change', importQuizFromFile);
    
    const saveQuizButton = document.getElementById('save-quiz');
    saveQuizButton.addEventListener('click', saveQuiz);

    // Event delegation for delete buttons
    document.addEventListener('click', async (event) => {
        if (event.target.classList.contains('delete-btn')) {
            const elementToRemove = event.target.closest('.round, .question');
            console.log('delete-btn:', elementToRemove, elementToRemove.classList[0] );

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
                        document.getElementById('quiz-json').value = JSON.stringify( await response.json(), null, 4 );
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
    const quill = new Quill('#quiz-description', {
        theme: 'snow',
        modules: {
            toolbar: [
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'header': 1 }, { 'header': 2 }],
                [{ 'list': 'ordered' }, { 'list': 'bullet' }]                        
            ]
        },
        placeholder: 'Enter quiz description',
        bounds: '#quiz-description',
        maxHeight: '300px'
    });


    // importQuizFromURL('quiz-new.json');
    fetchQuizzes();

    // Function to fetch quizzes from the API
    async function fetchQuizzes() {
        try {
            const response = await fetch('/api/quiz', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    // Include any necessary authentication headers here
                }
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const quizzes = await response.json();

            // Try building a quiz list - clickable to edit a specific quiz
            // Make the quiz-list div visible and hide the quiz (edit) div
            document.getElementById('quiz-list').style.display = 'block';
            document.getElementById('quiz-edit').style.display = 'none';
            createQuizList(quizzes);

            // For now just fill out the latest quiz
            // if (quizzes.length > 0) {
            //     const lastQuiz = quizzes.pop();
            //     createQuizFromJSON(lastQuiz);
            // }
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
            quizItemElement.querySelector('.edit-quiz-item').addEventListener('click', () => createQuizFromJSON(quiz));
            quizList.appendChild(quizItemElement);
        });
    }

    // Function to create a new quiz - a bit hacky for now, but will do for testing
    function createQuiz() {
        createQuizFromJSON( {title: 'New Quiz', description:'Add additional info here - prizes, rounds...', rounds:[]} );
    }

    // Function to save a quiz
    async function saveQuiz(event) {
        event.preventDefault(); // Prevent the default form submission

        // Perform validation on the quiz - display nice messages to show where the mistakes are

        // Collect quiz data from the form
        const quizJSON = createJSONfromQuiz();

        try {
            const response = await fetch('/api/quiz/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Include any necessary authentication headers here
                },
                body: JSON.stringify(quizJSON) // Convert the quiz data to JSON
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const savedQuiz = await response.json(); // Parse the response as JSON
            console.log('Quiz saved successfully:', savedQuiz);
            
            document.getElementById('quiz-json').value = JSON.stringify(savedQuiz, null, 4);
            createQuizFromJSON(savedQuiz);
            // Optionally, update the UI or redirect the user
            // For example, you might want to refresh the quiz list
            //fetchQuizzes(); // Call the function to refresh the quiz list

        } catch (error) {
            console.error('Error saving quiz:', error);
            // Optionally, display an error message to the user
        }
    }

    function addRoundToDOM() {
        console.log('addRoundToDOM');
        const roundTemplate = document.getElementById('round-template');
        const roundElement = roundTemplate.content.cloneNode(true);
        const questionsContainer = roundElement.querySelector('.questions-container');
        const addQuestionButton = roundElement.querySelector('.question-btn');
        
        addQuestionButton.addEventListener('click', () => addQuestionToDOM(questionsContainer));
        roundElement.querySelector('.round-title').addEventListener('blur', updateHeaderWithTitle);

        roundsContainer.appendChild(roundElement);

        const roundSorttable = new Sortable(questionsContainer, {
            animation: 150,
            handle: 'summary',
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

        // Add event listeners for dropzone (used on every question)
        const dropzone = questionElement.querySelector('[data-field="dropzone"]');
        const fileInput = dropzone.querySelector('[data-field="dropzone-image"]');
        dropzone.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', handleImageUpload);
        // Prevent default drag behavior on dragover otherwise it will be intercepted by the browser
        dropzone.addEventListener('dragover', (event) => event.preventDefault());
        // Highlight drop area when item is dragged over it
        ['dragenter', 'mouseover'].forEach(eventName => {
            dropzone.addEventListener(eventName, highlightDropzone);
        });
        ['dragleave', 'mouseleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, unhighlightDropzone);
        });
        dropzone.addEventListener('drop', handleDropFiles);

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
        const questionImage = questionElement.querySelector('[data-field="question-image"]');
        console.log('handleQuestionTypeChange:', questionType);

        // Clear existing content
        contentContainer.innerHTML = '';

        switch (questionType) {
            case 'text':
                contentContainer.innerHTML = `
                    <label>Answer:</label><input type="text" data-field="answer" placeholder="Enter answer">
                `;
                break;
            case 'multiple-choice':
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
                contentContainer.innerHTML = `
                    <label>Answer:</label><select data-field="answer">
                        <option value="true">True</option>
                        <option value="false">False</option>
                    </select></p>
                `;
                break;

            case 'matching':
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
                contentContainer.innerHTML = `
                        <label>Start:</label><input type="text" data-field="order-start" placeholder="eg Earliest">
                        <label>End:</label><input type="text" data-field="order-end" placeholder="eg Latest">
                        <label>Items to Order (enter in correct order):</label>
                        <div class="ordering-items">
                            <input type="text" data-field="order-item" placeholder="Item 1">
                            <input type="text" data-field="order-item" placeholder="Item 2">
                            <input type="text" data-field="order-item" placeholder="Item 3">
                            <input type="text" data-field="order-item" placeholder="Item 4">
                            <input type="text" data-field="order-item" placeholder="Item 5">
                        </div>
                `;
                break;

            case 'hotspot':
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
                contentContainer.innerHTML = `
                    <image-selector data-field="image-selector-preview" class="image-selector-preview" mode="rectangle"></image-selector>
                    <input type="hidden" data-field="point-it-out-startx">
                    <input type="hidden" data-field="point-it-out-starty">
                    <input type="hidden" data-field="point-it-out-endx">
                    <input type="hidden" data-field="point-it-out-endy">
                `;
                const pointItOutPreview = contentContainer.querySelector('[data-field="image-selector-preview"]');
                pointItOutPreview.addEventListener('selection', (event) => imageSelectorSelection(questionElement, event.detail, 'rectangle'));
                if (questionImage.getAttribute('src')) {
                    setImageSelectorSrc(questionElement, questionImage.getAttribute('src'));
                }
                break;

            case 'draw':
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

    function highlightDropzone(e) {
        console.log('highlightDropzone:', e.target);
        e.preventDefault();
        e.stopPropagation();
        e.target.classList.add('dragover');
    }
    function unhighlightDropzone(e) {
        e.preventDefault();
        e.stopPropagation();
        e.target.classList.remove('dragover');
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
        reader.onload = function(e) {
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
    // Similarly to the dropzone method, we also want to hide the dropzone element
    function handleExternalImageURL(event) {
        console.log('handleExternalImageURL:', event.target.value);
        const questionElement = event.target.closest('.question');
        setImageSelectorSrc(questionElement, event.target.value);
        
    }

    // setImageSelectorSrc
    // When a new image is selected we update the image-selector-preview elements
    // There can be 2 of these: the first is the question image, the second is the answer image (in the case of hotspot/point-it-out)
    function setImageSelectorSrc(questionElement, src) {
        console.log('setImageSelectorSrc:', src);
        const imageSelectorPreviews = questionElement.querySelectorAll('.image-selector-preview');
        if (imageSelectorPreviews) {
            console.log('setImageSelectorSrc: imageSelectorPreview:', imageSelectorPreviews);
            imageSelectorPreviews.forEach(imageSelectorPreview => {
                imageSelectorPreview.setAttribute('src', src);
                imageSelectorPreview.style.display = 'block';
            });
        }
        // For now remove the image-selection component as we have an image selected
        const dropzone = questionElement.querySelector('[data-field="image-selection"]');
        if (dropzone) {
            dropzone.style.display = 'none';
        }
    }
    function imageSelectorSelection(questionElement, details, type) {
        if (type === 'hotspot') {
            questionElement.querySelector('[data-field="hotspot-x"]').value = details.x;
            questionElement.querySelector('[data-field="hotspot-y"]').value = details.y;
        } else if (type === 'point-it-out') {
            questionElement.querySelector('[data-field="point-it-out-startx"]').value = details.start.x;
            questionElement.querySelector('[data-field="point-it-out-starty"]').value = details.start.y;
            questionElement.querySelector('[data-field="point-it-out-endx"]').value = details.end.x;
            questionElement.querySelector('[data-field="point-it-out-endy"]').value = details.end.y;
        }
    }

    function createJSONfromQuiz() {

        const quizJSON = {
            _id: document.getElementById('quiz-id').value,
            owner: document.getElementById('quiz-owner').value,
            title: document.getElementById('quiz-title').value,
            // description: document.querySelector('#quiz-description .ql-editor').innerHTML,
            description: quill.root.innerHTML,
            rounds: Array.from(roundsContainer.querySelectorAll('details.round')).map(roundElement => ({
                _id: roundElement.querySelector('.round-id').value,
                owner: roundElement.querySelector('.round-owner').value,
                title: roundElement.querySelector('.round-title').value,
                description: roundElement.querySelector('.round-description').value,
                roundTimer: roundElement.querySelector('[data-field="round-timer"]').value,
                showAnswer: roundElement.querySelector('[data-field="show-answer"]').value,
                updateScores: roundElement.querySelector('[data-field="update-scores"]').value,
                questions: Array.from(roundElement.querySelectorAll('details.question')).map(questionElement => gatherQuestionData(questionElement))
            }))
        }
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

    function gatherQuestionData(questionElement) {
        const type = questionElement.querySelector('.question-type').value;
        const baseData = {
            type: type,
            text: questionElement.querySelector('[data-field="question-text"]').value,
            image: questionElement.querySelector('[data-field="question-image"]').getAttribute('src'),
            audio: questionElement.querySelector('[data-field="question-audio"]').value
        };

        switch (type) {
            case 'text':
                baseData.answer = questionElement.querySelector('[data-field="answer"]').value;
                break;
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
                baseData.options = options.filter( (option) => { return option != ""; } );
                break;

            case 'true-false':
                baseData.answer = questionElement.querySelector('[data-field="answer"]').value;
                break;

            case 'picture':
                break;
                
            case 'matching':
                const pairs = Array.from([1,2,3,4,5]).map(index => ({
                    left: questionElement.querySelector(`[data-field="left-${index}"]`).value,
                    right: questionElement.querySelector(`[data-field="right-${index}"]`).value
                }));
                baseData.pairs = pairs.filter( (pair) => { return pair.left != ""; });
                break;

            case 'ordering':
                baseData.startLabel = questionElement.querySelector('[data-field="order-start"]').value;
                baseData.endLabel = questionElement.querySelector('[data-field="order-end"]').value;
                const items = Array.from(questionElement.querySelectorAll('[data-field="order-item"]')).map(input => input.value);
                baseData.items = items.filter( (item) => { return item != ""; });
                break;

            case 'hotspot':
                // Convert the values to numbers using '+'
                baseData.answer = {
                    x: +questionElement.querySelector('[data-field="hotspot-x"]').value,
                    y: +questionElement.querySelector('[data-field="hotspot-y"]').value
                };
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

            case 'image-selector':
                baseData.answer = {
                    x: +questionElement.querySelector('[data-field="hotspot-x"]').value,
                    y: +questionElement.querySelector('[data-field="hotspot-y"]').value
                };
                break;
        }

        return baseData;
    }

    function importQuizFromFile(event) {
        const file = event.target.files[0];
        console.log('importQuiz:', file);
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const quiz = JSON.parse(e.target.result);
                createQuizFromJSON(quiz);
            }
            reader.readAsText(file);
        }
    }

    function importQuizFromURL(url) {

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

    function createQuizFromJSON(quizJSON) { 
        console.log('createQuizFromJSON:', quizJSON);
        document.getElementById('quiz-json').value = JSON.stringify(quizJSON, null, 2);
        document.getElementById('quiz-id').value = quizJSON._id;
        document.getElementById('quiz-owner').value = quizJSON.owner;
        document.getElementById('quiz-edit').querySelector('.header-title').textContent = quizJSON.title;
        document.getElementById('quiz-title').value = quizJSON.title;
        quill.root.innerHTML = quizJSON.description;

        roundsContainer.innerHTML = '';
        quizJSON.rounds.forEach(roundJSON => {
            addRoundToDOM();
            const roundElement = roundsContainer.lastElementChild;
            roundElement.querySelector('.header-title').textContent = roundJSON.title;
            roundElement.querySelector('.round-title').value = roundJSON.title;
            roundElement.querySelector('.round-description').value = roundJSON.description;
            roundElement.querySelector('.round-id').value = roundJSON._id;
            roundElement.querySelector('.round-owner').value = roundJSON.owner;
            const rt = roundElement.querySelector('[data-field="round-timer"]');
            roundElement.querySelector('[data-field="round-timer"]').value = roundJSON.roundTimer;
            roundElement.querySelector('[data-field="show-answer"]').value = roundJSON.showAnswer;
            roundElement.querySelector('[data-field="update-scores"]').value = roundJSON.updateScores;

            const questionsContainer = roundElement.querySelector('.questions-container');
            roundJSON.questions.forEach(questionJSON => {
                addQuestionToDOM(questionsContainer);
                const questionElement = questionsContainer.lastElementChild;

                // We always have a question text field, this is not question-specific
                questionElement.querySelector('[data-field="question-text"]').value = questionJSON.text;
                questionElement.querySelector('.header-title').textContent = questionJSON.text;

                // If we have imageData then we need to set the image selector src
                if (questionJSON.image) {
                    setImageSelectorSrc(questionElement, questionJSON.image);
                }

                // Trigger the select chnage event which will insert the correct question type into the questionElement
                const typeSelect = questionElement.querySelector('.question-type');
                typeSelect.value = questionJSON.type;
                typeSelect.dispatchEvent(new Event('change'));  // This will insert the correct question type into the questionElement

                const contentContainer = questionElement.querySelector('.question-specific-content');
                // contentContainer.querySelector('[data-field="question-text"]').value = question.text || '';

                switch (questionJSON.type) {
                    case 'text':
                        contentContainer.querySelector('[data-field="answer"]').value = questionJSON.answer || '';
                        break;
                    case 'multiple-choice':
                        questionJSON.options.forEach((option, index) => {
                            contentContainer.querySelector(`[data-field="option-${index + 1}"]`).value = option || '';
                        });
                        break;
                    case 'true-false':
                        contentContainer.querySelector('[data-field="answer"]').value = questionJSON.correctAnswer || 'true';
                        break;
                    case 'picture':
                        break;

                    case 'matching':
                        questionJSON.pairs.forEach((pair, index) => {
                            contentContainer.querySelector(`[data-field="left-${index + 1}"]`).value = pair.left || '';
                            contentContainer.querySelector(`[data-field="right-${index + 1}"]`).value = pair.right || '';
                        });
                        break;

                    case 'ordering':
                        contentContainer.querySelector('[data-field="order-start"]').value = questionJSON.startLabel || '';
                        contentContainer.querySelector('[data-field="order-end"]').value = questionJSON.endLabel || '';
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
                                imageSelectorPreview.setAttribute('answer', JSON.stringify(questionJSON.answer) );
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
                                imageSelectorPreview.setAttribute('answer', JSON.stringify(questionJSON.answer) );

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

        addRoundQuestionNumbers();

        // Hide the quiz list and show the quiz
        document.getElementById('quiz-list').style.display = 'none';
        document.getElementById('quiz-edit').style.display = 'block';
    }

});

