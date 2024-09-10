console.log('play.quiz.js is executing');

// This is a simple example of a game module
export class Game {
    constructor(socket) {

		// Cache socket for later use (event handlers need socket)
		this.socket = socket;

		// Just call start here - not sure if really need a constructor AND a start method
		this.start();
        console.log('Quiz initialized');
    }
  
    start() {
      console.log('quiz.start');
      this.loadFonts();
      this.buildDOM();
      this.attachSocketEvents(this.socket);
      this.attachButtonEvents();
      
      // Show the first panel by default
      this.showPanel('panel-1');

    }
  
    end() {
      console.log('Ending the quiz...');
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
			<div class="panel" id="panel-start">
			</div>
			<div class="panel" id="panel-buttonselect">
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
		this.addButton('button-container-2', 'Another Button');
		this.addButton('button-container-2', 'Yet Another Button');
		this.addButton('button-container-3', 'Final Button');

		this.adjustFontSizeToFit('button-container-2');
		// this.adjustFontSizeToFit('button-container-3');
		
	}

    unloadDOM() {
		// Remove all the DOM elements created by this game
		const game = document.getElementById('game');
		game.remove();
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
		console.log('Adding button:', panelId, buttonText);
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
			console.log('Adjusting font size:', totalHeight, availableHeight, loopCount);
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
	
	// onServerRequest
	// This is a generic function managing all types of request
	// request.type holds the type of request (for now assume buttonselect, the basic one)
	// For ease we have a separate panel defined for each type of request
	onServerRequest(request) {
		console.log('onServerRequest:', request);
		const panelId = `panel-${request.type}`;
		const panel = document.getElementById(panelId);
		const buttonContainerId = `button-container-${request.type}`;
		const buttonContainer = document.getElementById(buttonContainerId);
		const buttons = request.payload;

		// Clear the panel first
		buttonContainer.innerHTML = '';

		const createButton = (button) => {
			const buttonElement = this.createButton(button.answer);
			buttonElement.addEventListener('click', (e) => {
				console.log('Button clicked:', e.currentTarget);
				this.socket.emit('client:response', e.currentTarget.id);
				// we also want to remove the buttons once clicked so user can't click a second time
				// take opportunity to give feedback to user what they chose
				document.getElementById('panel-answer-content').innerHTML = `<p>You chose:</p><h2>${e.currentTarget.dataset.answer}</h2>`;
				this.showPanel('panel-answer');
			});
			buttonElement.id = button.id;
			buttonElement.dataset.answer = button.answer; // Add custom data attribute
			buttonContainer.appendChild(buttonElement);
		}
		buttons.forEach( button => createButton(button) );
		this.adjustFontSizeToFit(buttonContainerId);
		this.showPanel(panelId);
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
        console.log('Attaching socket events');
        socket.on('connect', this.onConnect);
        socket.on('disconnect', this.onDisconnect);
        socket.on('player', this.onPlayer);

		socket.on('server:request', this.onServerRequest.bind(this));
    }

    removeSocketEvents(socket) {
        console.log('Removing socket events');
        socket.off('connect', this.onConnect);
        socket.off('disconnect', this.onDisconnect);
        socket.off('player', this.onPlayer);
    }

	attachButtonEvents() {
		// Attach events to buttons defined in play.html that also rely on knowing socket
		document.getElementById('connect').addEventListener('click', this.socketConnect.bind(this) );
		document.getElementById('disconnect').addEventListener('click', this.socketDisconnect.bind(this) );
	}
	removeButtonEvents() {
		// Remove event listeners added in the attach function above
		document.getElementById('connect').removeEventListener('click', this.socketConnect);
		document.getElementById('disconnect').removeEventListener('click', this.socketDisconnect);
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