// console.log('play.quiz.js is executing');

// This is a simple example of a game module
// No matter what the game is, it is always defined as a class Game
// This means the loading code in play.common.js can always instantiate the game using new Game()

import gsap from 'gsap';
import { TextPlugin } from 'gsap/TextPlugin';
import { Draggable } from 'gsap/Draggable';

import { Overlay } from '../Overlay.js';
import { CanvasDraw } from '../CanvasDraw.js';

export class Game {
    constructor(socket) {

		// Cache socket for later use (event handlers need socket)
		this.socket = socket;

		// Just call start here - not sure if really need a constructor AND a start method
		this.start();
        // console.log('Quiz initialized');
    }
  
    start() {
    //   console.log('quiz.start');
		this.loadFonts();
		this.buildDOM();
		this.attachSocketEvents(this.socket);
		this.attachButtonEvents();

		// Since we want to animate text we need to register the TextPlugin
		gsap.registerPlugin(TextPlugin);
		gsap.registerPlugin(Draggable);

		// Initialize the resize handlers to manage scaling and orientation of device
		this.screenSizeBody();
		this.callAfterResize(this.screenSizeBody.bind(this), 0.2);
	
		// Show the first panel by default
		this.showPanel('panel-start');
    }
  
    end() {
    //   console.log('Ending the quiz...');
	  this.removeButtonEvents();
	  this.removeSocketEvents(this.socket);
	  this.unloadDOM();
      this.unloadFonts();
    }

	// Add all DOM elements relevant to the this game
	// NOTE: everything is placed inside a wrapper div - then this entire div can be removed on cleanup
    // NOTE: Maybe some games will set up a lot in advance (different panels for different parts of the game) and switch in and out
    // while other games might use a single panel and update its contents (eq quiz)
    // In fact, maybe quiz sets up a panel for each answer type (multi-choice, multi-choice timed, true/false, order elements) and then switch panel for each question
	buildDOM() {
		// Create the DOM elements for this game
		const game = document.createElement('div');
		game.id = 'game';
		document.body.appendChild(game);
		game.innerHTML = `
			<template id="answer-template-text">
				<input type="text" id="answer-text-input" />
			</template>
			<template id="answer-template-multiple-choice">
				<div id="question-options"></div>
			</template>
			<template id="answer-template-true-false">
				<div id="question-options"></div>
			</template>
			<template id="answer-template-matching">
				<div id="question-options"></div>
				<div id="submit-button"><button>DONE</button></div>
			</template>
			<template id="answer-template-ordering">
				<div id="question-options"></div>
				<div id="submit-button"><button>DONE</button></div>
			</template>
			<template id="answer-template-hotspot">
				<div id="answer-image-container">
					<img id="answer-image"></img>
				</div>
				<div id="submit-button"><button>DONE</button></div>
			</template>
			<template id="answer-template-point-it-out">
				<div id="answer-image-container">
					<img id="answer-image"></img>
				</div>
				<div id="submit-button"><button>DONE</button></div>
			</template>
			<template id="answer-template-draw">
				<canvas-draw id="answer-image"></canvas-draw>
				<button id="submit-button">DONE</button>

			</template>
			<template id="question-template">
				<div id="answer-image-container">
					<image-selector id="answer-image" mode="hotspot"></image-selector>
					<div id="answer-image-overlay"></div>
					<input type="hidden" id="answer-image-x" />
					<input type="hidden" id="answer-image-y" />
				</div>
				<div id="question-options-wrapper">
					<div id="question-options"></div>
					<div id="submit-button"><button>DONE</button></div>
				</div>
			</template>
			<div class="wrapper"></div>
			<div id="panel-rotate">
				<h2>Please rotate your phone</h2>
				<img src="/img/rotation-phone.png" alt="Please rotate your phone" />
			</div>
			<div class="panel" id="panel-start">
				<div class="button-container">
					<h2>Welcome to the Quiz</h2>
					<p>Waiting to start...</p>
				</div>
			</div>
			<div class="panel" id="panel-waiting">
				<div class="button-container">
					<h2>Quiz</h2>
					<p>Waiting for the next question...</p>
				</div>
			</div>
			<div class="panel" id="panel-question"></div>
			<div class="panel" id="panel-buttonselect">
				<div class="button-container" id="button-container-buttonselect"></div>
			</div>
			<div class="panel" id="panel-multiple-choice">
				<div class="button-container" id="button-container-buttonselect"></div>
			</div>
			<div class="panel" id="panel-answer">
				<div id="panel-answer-content"></div>
			</div>
			<div class="panel" id="panel-1">
				<div class="button-container" id="button-container-2"></div>
			</div>
			<div class="panel" id="panel-2">
				<div class="button-container" id="button-container-2"></div>
			</div>
			<div class="panel" id="panel-3">
				<div class="button-container" id="button-container-3"></div>
			</div>
		`;

		// Begin with the welcome panel - maybe do this via the buildDOM function above...
		// this.addButton('button-container-2', 'Another Button');
		// this.addButton('button-container-2', 'Yet Another Button');
		// this.addButton('button-container-3', 'Final Button');

		// this.adjustFontSizeToFit('button-container-3');
		
	}

    unloadDOM() {
		// Remove all the DOM elements created by this game
		const game = document.getElementById('game');
		game.remove();
	}

	// setWindowScale
	// Update: trying with setting the scale of a wrapper div so that BODY can have a background image
	setWindowScale(x, instant=true) {
	    console.log('setWindowScale:', x, instant, document.getElementById("body"), gsap);
		if (instant) {
			gsap.set("#wrapper", { scaleX: x, scaleY: x });
		} else {
			gsap.to("#wrapper", { scaleX: x, scaleY: x });
		}
	}

	// Function copied from gsap site - useful utility function
	callAfterResize(func, delay) {
		console.log('callAfterResize:');
		let dc = gsap.delayedCall(delay || 0.2, func).pause(),
		handler = () => dc.restart(true);
		window.addEventListener("resize", handler);
		return handler; // in case you want to window.removeEventListener() later
	}

	screenSizeBody() {
		// do nothing - try without using any kind of global scale
		// Hmmm - I definitely need something otherwise could be a mess
		// Copy from below but don't use the screenOffset just scale x and y independently
		const windowInnerWidth  = window.innerWidth;
		const windowInnerHeight = window.innerHeight;
		console.log('dom.screenSizeBody:: viewport size:', windowInnerWidth, windowInnerHeight);
		const scaleX = window.innerWidth / 480;

		// Check if phone is in portrait mode and display a message if so
		if ((windowInnerWidth < windowInnerHeight) & (window.innerWidth < 160)) {
			document.getElementById('panel-rotate').style.display = 'flex';
		} else {
			document.getElementById('panel-rotate').style.display = 'none';
		}
		// Experiment with using this function just to test for portrait mode on phone - leave display responsive
		// this.setWindowScale(scaleX);
	}	
	
	updateVisualViewport() {

		const submitButton = document.getElementById('submit-button');
		const scale = visualViewport.scale; // Get the current scale

		this.socket.emit('consolelog', 'updateVisualViewport:' + scale);

		// Don't set the transform on the submit button because this fucks with the position
		// Instead just set the size of the button leaving scale as 1
		const initialFontSize = 32;
		submitButton.style.fontSize = `${initialFontSize / scale}px`;
		submitButton.style.borderRadius = `${10 / scale }px`;

		const offsetX = visualViewport.offsetLeft; // Get the current horizontal offset
		const offsetY = visualViewport.offsetTop;  // Get the current vertical offset

		// Set the button position to the top left corner (way easier than top right) of the visible viewport
		submitButton.left = `${ offsetX +5 }px`; // 20px for margin
		submitButton.top = `${ (offsetY +5) }px`; // 20px for margin
		submitButton.style.left = `${ offsetX +5 }px`; // 20px for margin
		submitButton.style.top = `${ (offsetY +5) }px`; // 20px for margin
	}

	createButton(buttonText) {
		const button = document.createElement('button');

		// Adjust font size based on text length
		const textLength = buttonText.length;
		if (textLength > 36) {
			button.style.setProperty('--button-font-size', '16px');
		} else if (textLength > 16) {
			button.style.setProperty('--button-font-size', '20px');
		} else {
			button.style.setProperty('--button-font-size', '24px');
		}
		button.textContent = buttonText;
		return button;
	}

	addButton(panelId, buttonText) {
		// console.log('Adding button:', panelId, buttonText);
		const buttonContainer = document.getElementById(panelId);
		const button = document.createElement('button');

		// Adjust font size based on text length
		const textLength = buttonText.length;
		if (textLength > 36) {
			button.style.setProperty('--button-font-size', '16px');
		} else if (textLength > 16) {
			button.style.setProperty('--button-font-size', '20px');
		} else {
			button.style.setProperty('--button-font-size', '24px');
		}
		
		button.textContent = buttonText;
		buttonContainer.appendChild(button);
	}
	
	adjustFontSizeToFit(containerId) {
        const container = document.getElementById(containerId);
        const buttons = container.querySelectorAll('button');
        const availableHeight = window.innerHeight -  80;	// we always want some padding top and bottom

        // If many buttons then squash them together slightly more than if fewer buttons
        if (buttons.length > 5) {
            container.style.setProperty('gap', '4vh');
        } else if (buttons.length > 4) {
            container.style.setProperty('gap', '6vh');
        } else {
            container.style.setProperty('gap', '8vh');
        }
        
		// Belt and braces - prevent function from looping forever in the event of a bug
		let loopCount = 30;


		const adjustFontSize = () => {
            let totalHeight = container.getBoundingClientRect().height;
			// console.log('Adjusting font size:', totalHeight, availableHeight, loopCount);
            if ( (totalHeight > availableHeight) && (loopCount > 0) ) {
				loopCount--;
                buttons.forEach(button => {
                    const currentFontSize = parseInt(window.getComputedStyle(button).fontSize);
                    button.style.setProperty('--button-font-size', `${currentFontSize - 1}px`);
                });
				requestAnimationFrame(adjustFontSize); // Wait for the next animation frame before rechecking
            }
        };
        requestAnimationFrame(adjustFontSize);
    }

	showPanel(panelId) {
		const panels = document.querySelectorAll('.panel');
		panels.forEach(panel => panel.classList.remove('active'));
		document.getElementById(panelId).classList.add('active');
	}
	
	checkDropzoneHit(draggable) {
		const dropzones = document.querySelectorAll('.droppable');
		var dropped = false;
		dropzones.forEach( (dropzone) => {
			dropzone.classList.remove('dragover');
			if (!dropzone.dataset.dropped) {
				if (draggable.hitTest(dropzone, "50%")) {
					dropzone.classList.add('dragover');
					dropped = dropzone;
				}
			}
		})
		return dropped;
	}

	// doQuestion
	// This function is built following a similar pattern to host
	// This should (hopefully) make it easier to maintain and update since host/players will share code
	doQuestion(question) {

		const panelId = 'panel-question';
		const questionPanel = document.getElementById(panelId);
		const questionTemplate = document.getElementById('answer-template-' + question.type);
		const questionElement = questionTemplate.content.cloneNode(true);
		const questionOptions = questionElement.getElementById('question-options');

		// Utility Functions for creating different answer types
		function createOptionButton(optionValue) {
			const button = document.createElement("button");
			button.textContent = optionValue;
			return button;
		}
		function createClickableButton(optionValue) {
			const button = createOptionButton(optionValue);
			button.classList.add('clickable');
			return button;
		}
		function createDropzoneButton(optionValue) {
			const button = createOptionButton(optionValue);
			button.classList.add('droppable');
			return button;
		}
		function createDraggableButton(optionValue) {
			const button = createOptionButton(optionValue);
			button.classList.add('draggable');
			return button;
		}
		function createTextLabel(labelText) {
			const p = document.createElement("label");
			p.classList.add("option");
			p.textContent = labelText;
			return p
		}

		// Clear away any previous question and replace with new template
		questionPanel.innerHTML = '';
		questionPanel.appendChild(questionElement);

		console.log('questionOptions:', questionOptions);

		    // And now for the question-specific content
			switch (question.type) {
				case "text":
					// the input element is already defined in the template - just need to make it visible and add event listener
					document.getElementById('answer-text-input').focus();
					// Add event listeners for input elements
					document.getElementById('answer-text-input').addEventListener('change', (e) => {
						this.socket.emit('client:response', e.currentTarget.value);
						document.getElementById('panel-answer-content').innerHTML = `<p>You chose:</p><h2>${e.currentTarget.value}</h2>`;
						this.showPanel('panel-answer');
					});
					break;
		
				case "multiple-choice":
					// Add a class to determine whether 1, 2, 3 or 4 column
					console.log('Multiple-choice:', question.options);
					question.options.forEach( (option) => { questionOptions.appendChild(createClickableButton(option)); });
					break;
		
				case "true-false":
					questionOptions.classList.add('question-options-2col');
					['True', 'False'].forEach( (option) => {
						questionOptions.appendChild(createClickableButton(option));
					});
					break;
		
				case "matching":
					questionOptions.classList.add('question-options-2col');
					question.pairs.forEach( (pair, index) => {
						const button = questionOptions.appendChild(createDraggableButton(pair.left));
						button.setAttribute("id", "option-" + index);
						const dropzone = questionOptions.appendChild(createDropzoneButton(pair.right));
						dropzone.setAttribute("id", "option-end-" + index);
					});
					// this question type also needs a custom submit event for when all items are in place
					// Collect up the answers as an array and post to the server
					document.getElementById('submit-button').addEventListener('click', (e) => {
						const answers = [];
						questionOptions.querySelectorAll('.droppable').forEach( (droppable, index) => {
							answers.push(droppable.dataset.dropped);
						});
						this.socket.emit('client:response', answers);
						document.getElementById('panel-answer-content').innerHTML = `<p>You chose:</p><h2>${answers.join('<br/>')}</h2>`;
						this.showPanel('panel-answer');
					});
					break;
		
				case "ordering":
					question.options.forEach( (item, index) => {
						const button = questionOptions.appendChild(createDraggableButton(item));
						button.setAttribute("id", "option-" + index);
						var dropzoneLabel = (index == 0) ? question.extra.startLabel : '';
						dropzoneLabel = (index == question.items.length - 1) ? question.extra.endLabel : dropzoneLabel;
						const dropzone = questionOptions.appendChild(createDropzoneButton(dropzoneLabel));
						dropzone.setAttribute("id", "option-end-" + index);
					});
					// this question type also needs a custom submit event for when all items are in place
					// Collect up the answers as an array and post to the server
					document.getElementById('submit-button').addEventListener('click', (e) => {
						const answers = [];
						questionOptions.querySelectorAll('.droppable').forEach( (droppable, index) => {
							answers.push(droppable.dataset.dropped);
						});
						this.socket.emit('client:response', answers);
						document.getElementById('panel-answer-content').innerHTML = `<p>You chose:</p><h2>${answers.join('<br/>')}</h2>`;
						this.showPanel('panel-answer');
					});
					break;
		
				case "hotspot":
				case "point-it-out":
					const imageContainer = document.getElementById("answer-image-container");
					const imageSelector = document.getElementById('answer-image');
					imageSelector.setAttribute('src', question.image);
					imageSelector.onload = () => {
						console.log('imageSelector.onload:', imageSelector);
						const overlay = new Overlay(imageSelector);
						overlay.onCrossAdded( () => {
							this.socket.emit('consolelog', { 'container': imageContainer.getBoundingClientRect(), 'image': imageSelector.getBoundingClientRect() } );
							document.getElementById('submit-button').classList.add('active');
							this.updateVisualViewport();
						});
						document.getElementById('submit-button').addEventListener('click', (e) => {
							const coords = overlay.getNormalizedCoordinates(0);
							this.socket.emit('client:response', coords );
							e.currentTarget.classList.remove('active');
							window.visualViewport.removeEventListener('resize', () => this.updateVisualViewport() );
							window.visualViewport.removeEventListener('scroll', () => this.updateVisualViewport() );					
							});
						window.visualViewport.addEventListener('resize', () => this.updateVisualViewport() );
						window.visualViewport.addEventListener('scroll', () => this.updateVisualViewport() );					
					}
					break;
					
				case "draw":
					document.getElementById('submit-button').addEventListener('click', (e) => {
						console.log('Submit drawing');
						const svg = document.getElementById('answer-image').getSVG();
						this.socket.emit('client:response', svg );
						document.getElementById('panel-answer-content').innerHTML = `<p>Your answer has been recorded!</p>`;
						this.showPanel('panel-answer');
					});
					// For drawing the submit button is always available
					document.getElementById('submit-button').classList.add('active');
					break;
			}
		
			// Now that all draggable buttons and droppable slots have been created attach any further interactivity
			// These have all been placed inside a questionOptions div element
			// So only add interactivity to elements within this div
			if (!questionOptions) return;

			const gameClass = this;
			questionOptions.querySelectorAll('.draggable').forEach( (draggable) => {
				console.log('Adding drag:', draggable.innerHTML);
				Draggable.create(draggable, {
					bounds: questionPanel,
					edgeResistance: 0.65,
					zIndexBoost: false,
					onDrag: function() {
						if (this.target.dataset.droppedOn) {
							delete document.getElementById(this.target.dataset.droppedOn).dataset.dropped;
							delete this.target.dataset.droppedOn;
						}
						const zone = gameClass.checkDropzoneHit(this);
						if (zone) {
							console.log('HIT');
						}
					 },
					onDragEnd: function() {
						let droppedOnZone = gameClass.checkDropzoneHit(this);
						if (droppedOnZone) {
							const draggableRect = this.target.getBoundingClientRect();
							const dropzoneRect = droppedOnZone.getBoundingClientRect();                                
							const x = (dropzoneRect.left - draggableRect.left);
							const y = (dropzoneRect.top - draggableRect.top);
							// Store the dropzone id on the draggable for later reference
							this.target.dataset.droppedOn = droppedOnZone.id;
							droppedOnZone.dataset.dropped = this.target.textContent;
							gsap.to(this.target, {
								duration: 0.3,
								x: this.x + x,
								y: this.y + y
							});
							// final step - we might have dropped all buttons onto zones, make submit button active
							const nDropped = questionOptions.querySelectorAll('.droppable[data-dropped]').length;
							const nTotal = questionOptions.querySelectorAll('.draggable').length;
							console.log('Dropped:', nDropped, nTotal);
							if (nDropped == nTotal) {
								document.getElementById('submit-button').classList.add('active');
							}
							
						} else {
							console.log('No dropzone found...');
							gsap.to(this.target, {
								duration: 0.3,
								x: 0,
								y: 0
							});
							// Clear the droppedOn data if not dropped on a zone
							delete this.target.dataset.droppedOn;
							document.getElementById('submit-button').classList.remove('active');
						}
					},
					onDragLeave: () => { console.log('onDragLeave'); }
				})
			});

			// Add event listeners for clickable buttons
			questionOptions.addEventListener('touchstart', (e) => {
				// console.log('Touch start:', e.target);
				if (e.target.classList.contains('clickable')) {
					e.target.classList.add('hover');
					// e.preventDefault();
				}
			});
			questionOptions.addEventListener('mouseover', (e) => {
				// console.log('button.mouseover:', e.target);
				if (e.target.classList.contains('clickable')) {
					e.target.classList.add('hover');
					e.preventDefault();
				}
			});
			questionOptions.addEventListener('mouseout', (e) => {
				// console.log('button.mouseout:', e.target);
				if (e.target.classList.contains('clickable')) {
					e.target.classList.remove('hover');
					e.preventDefault();
				}
			});
			questionOptions.addEventListener('click', (e) => {
				console.log('click:', e.target, e.currentTarget);
				if (e.target.classList.contains('clickable')) {
					e.preventDefault();
					this.socket.emit('client:response', e.target.textContent);
					document.getElementById('panel-answer-content').innerHTML = `<p>You chose:</p><button>${e.target.textContent}</button>`;
					this.showPanel('panel-answer');

				}
			});
	}

	// Old code here
	// This code a remnant from above code - original button adding code
	oldCode() {
				// Each button is an element of the options array (id, label)
				const createButton = (button) => {
					const buttonElement = this.createButton(button.label);
					buttonElement.addEventListener('click', (e) => {
						console.log('Button clicked:', e.currentTarget);
						this.socket.emit('client:response', e.currentTarget.id);
						// we also want to remove the buttons once clicked so user can't click a second time
						// take opportunity to give feedback to user what they chose
						document.getElementById('panel-answer-content').innerHTML = `<p>You chose:</p><h2>${e.currentTarget.dataset.answer}</h2>`;
						this.showPanel('panel-answer');
					});
					buttonElement.id = button.id;
					buttonElement.dataset.option = button.label; // Add custom data attribute
					buttonContainer.appendChild(buttonElement);
				}
				buttons.forEach( button => createButton(button) );
				this.adjustFontSizeToFit(buttonContainerId);
				this.showPanel(panelId);
	}

	// onServerQuestion
	// This is a generic function managing all types of question
	// question.type holds the type of question (for now assume buttonselect, the basic one)
	// For ease we have a separate panel defined for each type of question
	onServerQuestion(question) {
		console.log('Player:: onServerQuestion:', question.type);
		this.doQuestion(question);
		this.showPanel('panel-question');
	}	


	// onServerRequest
	// This is a generic function managing all types of request
	// request.type holds the type of request (for now assume buttonselect, the basic one)
	// For ease we have a separate panel defined for each type of request
	onServerRequest(request) {
		console.log('Player:: onServerRequest:', request);
		const panelId = `panel-${request.type}`;
		const panel = document.getElementById(panelId);
		const buttonContainerId = `button-container-${request.type}`;
		const buttonContainer = document.getElementById(buttonContainerId);
		const buttons = request.payload;

		// Clear the panel first
		buttonContainer.innerHTML = '';

		// Each button is an element of the options array (id, label)
		const createButton = (button) => {
			const buttonElement = this.createButton(button.label);
			buttonElement.addEventListener('click', (e) => {
				console.log('Button clicked:', e.currentTarget);
				this.socket.emit('client:response', e.currentTarget.id);
				// we also want to remove the buttons once clicked so user can't click a second time
				// take opportunity to give feedback to user what they chose
				document.getElementById('panel-answer-content').innerHTML = `<p>You chose:</p><h2>${e.currentTarget.dataset.answer}</h2>`;
				this.showPanel('panel-answer');
			});
			buttonElement.id = button.id;
			buttonElement.dataset.option = button.label; // Add custom data attribute
			buttonContainer.appendChild(buttonElement);
		}
		buttons.forEach( button => createButton(button) );
		this.adjustFontSizeToFit(buttonContainerId);
		this.showPanel(panelId);
	}

	onEndQuestion() {
		console.log('onEndQuestion:');
		this.showPanel('panel-waiting');
	}

	socketConnect(e) {
		this.socket.connect();
	}
	socketDisconnect() {
		this.socket.disconnect();
	}
  
    loadFonts() {
        // const preconnect1 = document.createElement('link');
        // preconnect1.rel = 'preconnect';
        // preconnect1.href = 'https://fonts.googleapis.com';
        // preconnect1.id = 'dynamic-font-preconnect-1';
        // document.head.appendChild(preconnect1);
    
        const fontLink = document.createElement('link');
        fontLink.rel = 'stylesheet';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Lilita+One&display=swap';
        fontLink.id = 'dynamic-font-link';
        document.head.appendChild(fontLink);
    }

    unloadFonts() {
        const fontLink = document.getElementById('dynamic-font-link');
        if (fontLink) document.head.removeChild(fontLink);
    }

    attachSocketEvents(socket) {
        // console.log('Attaching socket events');
        socket.on('connect', this.onConnect);
        socket.on('disconnect', this.onDisconnect);
        socket.on('player', this.onPlayer);

		socket.on('server:request', this.onServerRequest.bind(this));
		socket.on('server:question', this.onServerQuestion.bind(this));
		socket.on('server:endquestion', this.onEndQuestion.bind(this));
    }

    removeSocketEvents(socket) {
        // console.log('Removing socket events');
        socket.off('connect', this.onConnect);
        socket.off('disconnect', this.onDisconnect);
        socket.off('player', this.onPlayer);
    }

	attachButtonEvents() {
		// Attach events to buttons defined in play.html that also rely on knowing socket
		// document.getElementById('connect').addEventListener('click', this.socketConnect.bind(this) );
		// document.getElementById('disconnect').addEventListener('click', this.socketDisconnect.bind(this) );
	}
	removeButtonEvents() {
		// Remove event listeners added in the attach function above
		// document.getElementById('connect').removeEventListener('click', this.socketConnect);
		// document.getElementById('disconnect').removeEventListener('click', this.socketDisconnect);
	}

	onConnect() {
		console.log('Connected to server');
	}
	onDisconnect() {
		console.log('Disconnected from server');
	}
	onPlayer(player) {
		console.log('Player:', player);
	}

  }