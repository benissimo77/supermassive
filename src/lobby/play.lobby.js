console.log('play.lobby.js:: hello');

// This is a simple example of a game module
export class Game {

    constructor(socket) {

		// Cache socket for later use (event handlers need socket)
		this.socket = socket;

		// Just call start here - not sure if really need a constructor AND a start method
		this.start();
        console.log('Lobby initialized');
    }
  
    start() {
		this.loadFonts();
		this.buildDOM();
		this.attachSocketEvents(this.socket);
		this.attachButtonEvents();
		
		// Show the first panel by default
		this.showPanel('panel-1');
	}
  
    end() {
      console.log('Ending the lobby...');
	  this.removeButtonEvents();
	  this.removeSocketEvents(this.socket);
	  this.unloadDOM();
      this.unloadFonts();
    }

	// Add all DOM elements relevant to the lobby
	// NOTE: everything is placed inside a wrapper div with id 'lobby' - then this entire div can be removed on cleanup
	buildDOM() {
		// Create the DOM elements for the lobby
		const lobby = document.createElement('div');
		lobby.id = 'lobby';
		document.body.appendChild(lobby);
		lobby.innerHTML = `
			<div class="panel" id="panel-start">
				<!-- For now put these here while testing -->
				<div class="panel-content">
					<button id="connect">Connect</button>
					<button id="disconnect">Disconnect</button>
					<h1>Welcome!</h1>
					<p>Waiting to start...</p>        
				</div>
			</div>
			<div class="panel" id="panel-1">
				<div class="button-container" id="button-container-1"></div>
			</div>
			<div class="panel" id="panel-2">
				<div class="button-container" id="button-container-2"></div>
			</div>
			<div class="panel" id="panel-3">
				<div class="button-container" id="button-container-3"></div>
			</div>
		`;

		// Begin with the welcome panel - maybe do this via the buildDOM function above...
		this.addButton('button-container-1', 'Button 1');
		this.addButton('button-container-1', 'Button 2 with longer text . . .');
		this.addButton('button-container-1', 'Button 3 with even longer text! Probably longer than Ill ever need');
		this.addButton('button-container-1', 'And a 4th Button to make more real - and include more text to ensure font size shrinks');
		this.addButton('button-container-1', '5th button t...f.');
		this.addButton('button-container-1', '6th button to put it to the test...');
		this.addButton('button-container-2', 'Another Button');
		this.addButton('button-container-2', 'Yet Another Button');
		this.addButton('button-container-3', 'Final Button');

		this.adjustFontSizeToFit('button-container-1');
		// this.adjustFontSizeToFit('button-container-2');
		// this.adjustFontSizeToFit('button-container-3');
		
	}

	unloadDOM() {
		// Remove all the DOM elements created by the lobby
		const lobby = document.getElementById('lobby');
		lobby.remove();
	}

	addButton(panelId, buttonText) {
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
				// Another way to prevent any infinite loop - don't loop if fontsize is some minimum value
				// if (currentFontSize > 10) {
				// 	requestAnimationFrame(adjustFontSize); // Wait for the next animation frame before rechecking
				// }
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
        console.log('Attaching socket events to lobby');
        socket.on('connect', this.onConnect);
        socket.on('disconnect', this.onDisconnect);
        socket.on('player', this.onPlayer);
    }

    removeSocketEvents(socket) {
        console.log('Removing socket events from lobby');
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