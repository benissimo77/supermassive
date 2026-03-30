

console.log('play.common.js:: Hello:', URL, window.location, location.hash);


function activatePanel(panel) {
	// Hide all panels
	document.querySelectorAll('.panel').forEach(panel => {
		panel.style.display = 'none';
	});
	// Show the requested panel
	document.getElementById(panel).style.display = 'block';
}


// onServerRequest - general purpose function which handles all/most server requests in a generic way
function onServerRequest(request) {
	switch (request.type) {

		case 'buttonselect':
			DOMbuttonSelect(request.payload);
			break;

		case 'message':
			DOMmessage(request.payload);
			break;

		case 'timedmessage':
			DOMtimedMessage(request.payload);
			break;
	}
}

// Add socket event listeners used by all games
socket.on('server:request', (request) => {
	console.log('server:request:', request.type);
	onServerRequest(request);
})

socket.on('server:loadgame', (game) => {
	console.log('Player:: server:loadgame:', game);
	loadGame(game);
});

async function loadGame(game) {

	// Check if there is a game already loaded
	if (window.currentGame) {
		window.currentGame.end();
		delete window.currentGame;
		unloadCSS();
	}

	try {
		// load CSS - fpr now we always load a CSS file and its always named the same as the game name
		loadCSS(game);
		const module = await import(`./play.${game}.js`);
		const newGame = new module.Game(socket);
  
		// Store the game instance for later use
		window.currentGame = newGame;
	} catch (error) {
		console.error('Error loading the game module:', error);
	}
}
  
function unloadGame() {
	if (window.currentGame) {
		window.currentGame.end();
		delete window.currentGame;
		unloadCSS();
	}
  }
  
function loadCSS(href) {
	const link = document.createElement('link');
	link.rel = 'stylesheet';
	link.href = `./css/${href}.css`;
	link.id = 'dynamic-css'; // Give an ID to easily find and remove it later
	document.head.appendChild(link);
}
  
function unloadCSS() {
	const link = document.getElementById('dynamic-css');
	if (link) {
		document.head.removeChild(link);
	}
}
