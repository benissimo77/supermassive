console.log('play.werewolves.js is executing');

// This is a simple example of a game module
export class Game {
    constructor(socket) {
		// Cache socket for later use (event handlers need socket)
		this.socket = socket;

		// Just call start here - not sure if really need a constructor AND a start method
		this.start();
        console.log('Werewolves game initialized');
    }
  
    start() {
      console.log('Starting the werewolves game...');
      this.loadFonts();
      this.buildDOM();
      this.attachSocketEvents(this.socket);
      this.attachButtonEvents();
      
      // Show the first panel by default
      this.showPanel('panel-1');
    }
  
    end() {
        console.log('Ending the werewolves game...');
        this.removeButtonEvents();
        this.removeSocketEvents(this.socket);
        this.unloadDOM();
        this.unloadFonts();
    }

	// Add all DOM elements relevant to the this game
	// NOTE: everything is placed inside a wrapper div - then this entire div can be removed on cleanup
	buildDOM() {
		// Create the DOM elements for this game
		const game = document.createElement('div');
		game.id = 'game';
		document.body.appendChild(game);
		game.innerHTML = `
            <div id="rolecontainer">
                <button id="button-role">ROLE</button>
            </div>
            <div class="panel" id="panel-role"></div>
            
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
		// this.addButton('button-container-1', 'QUIZ 1');
		// this.addButton('button-container-1', '5th button t...f.');
		// this.adjustFontSizeToFit('button-container-1');		

	}

    unloadDOM() {
		// Remove all the DOM elements created by this game
		const game = document.getElementById('game');
		game.remove();
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
        console.log('Attaching socket events to werewolves game');
        // socket.on('server:request', this.onServerRequest);
        // socket.on('playerrole', this.DOMplayerRole);
        socket.on('connect', this.onConnect);
        socket.on('disconnect', this.onDisconnect);
        socket.on('player', this.onPlayer);
        socket.on('playerrole', (role) => {
            console.log('playerrole:', role);
            this.DOMplayerRole(role);
        })
        
    }

    removeSocketEvents(socket) {
        console.log('Removing socket events from werewolves game');
        // socket.off('server:request', this.onServerRequest);
        // socket.off('playerrole', this.DOMplayerRole);
        socket.off('connect', this.onConnect);
        socket.off('disconnect', this.onDisconnect);
        socket.off('player', this.onPlayer);
    }

    attachButtonEvents() {
        console.log('Attaching button events to werewolves game');

        // ROLE button
        const roleButton = document.getElementById('button-role');
        roleButton.addEventListener('mousedown', this.buttonRolePress);
        roleButton.addEventListener('mouseup', this.buttonRoleRelease);
        roleButton.addEventListener('touchstart', this.buttonRolePress);
        roleButton.addEventListener('touchend', this.buttonRoleRelease);
        roleButton.addEventListener('selectstart', () => { return false });                
    }

    removeButtonEvents() {
        console.log('Removing button events from werewolves game');
        // document.getElementById('rolebutton').removeEventListener('mousedown', buttonRolePress);
        // document.getElementById('rolebutton').removeEventListener('mouseup', buttonRoleRelease);
    }
    
    buttonRolePress(e) {
        console.log('buttonRolePress');
        // In case there is already a visible panel we need to hide it - but store its ID so we can restore it afterwards
        const panels = document.querySelectorAll('.panel .active');
        console.log('panels:', panels);
        let panelId = null;
        if (panels.length > 0) {
            panelId = panels[0].id;
        }
        document.getElementById("panel-role").setAttribute("data-active", panelId);    
        this.showPanel('panel-role');
    }
    buttonRoleRelease() {
        console.log('buttonRoleRelease');
        const panelId = document.getElementById("panel-role").getAttribute("data-active");
        this.showPanel(panelId);
    }

    DOMplayerRole(role) {

        // fill out the role panel and make the role button visible so user can see their role
        document.getElementById('panel-role').innerHTML = `
            Your role:<br/><br/>${role}
            `;
        document.getElementById('rolecontainer').style.display = 'block';
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