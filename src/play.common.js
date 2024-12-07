
const URL = 'http://localhost:3000';

// Contact the socket.io socket server
// clientOptions can be used to pass things like username/password - see docs
// URL of undefined means io will connect to the window.location (suitable if hosting at same place as socket-server is running)
clientOptions = {};
const socket = io();

// console.log('play.common.js:: Hello:', URL, window.location, location.hash);


// Functions to perform server actions - the only one we are interested in is server:loadgame
// Everything else is handled by the relevant game module
socket.on('server:loadgame', (game) => {
	// console.log('Player:: server:loadgame:', game);
	loadGame(game);
});

async function loadGame(game) {

	try {
		const module = await import(`./modules/play.${game}.min.js`);

		// If import successful then we are good to go - check if there is a game already loaded
		if (window.currentGame) {
			window.currentGame.end();
			delete window.currentGame;
			unloadCSS();
		}
		// load CSS - fpr now we always load a CSS file and its always named the same as the game name
		loadCSS(game);
		const newGame = new module.Game(socket);
  
		// Store the game instance for later use
		window.currentGame = newGame;

	} catch (error) {
		console.error('Error loading the game module:', error);
		// TODO: Display status to the user...
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
	link.href = `/css/${href}.css`;
	link.id = 'dynamic-css'; // Give an ID to easily find and remove it later
	document.head.appendChild(link);
}
  
function unloadCSS() {
	const link = document.getElementById('dynamic-css');
	if (link) {
		document.head.removeChild(link);
	}
}

async function stayAwake() {
	// console.log('stayAwake:', document.visibilityState);
	if (document.visibilityState === 'visible') {
		if (lock === null) {
			if ('wakeLock' in navigator) {
				try {
					lock = await navigator.wakeLock.request('screen');
					// console.log('Screen Wake Lock is active:', lock);
				} catch (err) {
					console.error(`${err.name}, ${err.message}`);
				}
			} else {
				console.error('Wake Lock API not supported.');
				socket.emit('consolelog', 'Wake Lock API not supported.');
				socket.emit('consolelog', navigator);
			}
		}
	} else {
		if (lock !== null) {
			await lock.release();
			lock = null;
			console.log('Screen Wake Lock released:', lock);
			socket.emit('consolelog', 'Screen Wake Lock released:' + lock);
		}
	}
}
let lock = null;
document.addEventListener('visibilitychange', stayAwake);
stayAwake();


