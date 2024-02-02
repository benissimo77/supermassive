
const URL = 'http://localhost:3000';

// Contact the socket.io socket server
// clientOptions can be used to pass things like username/password - see docs
// URL of undefined means io will connect to the window.location (suitable if hosting at same place as socket-server is running)
clientOptions = {};
const socket = io();
let timer;	// general purpose timer to remove content after a delay

console.log('socket-play.js:: Hello:', URL, window.location, location.hash);

// Functions to perform server actions
function onConnect() {
	console.log('onConnect:', socket.connected);
}
function onDisconnect(reason) {
	console.log('onDisconnect:', reason);
}
function onFooEvent(value) {
	console.log('onFooEvent', value);
}
function onPlayerList(value) {
	console.log('onPlayerList:', value);
}
function onGameState(gameState) {
	console.log('onGameState:', gameState);
}
function onAddPlayer(player) {
	console.log('onAddPlayer:', player);
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


// Add socket event listeners
socket.on('server:request', (request) => {
	console.log('server:request:', request.type);
	onServerRequest(request);
})
socket.on('playerrole', (role) => {
	console.log('playerrole:', role);
	DOMplayerRole(role);
})
socket.on('buttonselect', (buttons) => {
	console.log('buttonselect:', buttons);
	DOMbuttonSelect(buttons)
})

socket.on('connect', onConnect);
socket.on('disconnect', onDisconnect);
// socket.on('foo', onFooEvent);
// socket.on('playerlist', onPlayerList);
// socket.on('addplayer', onPlayerList);
// socket.on('gameState', onGameState);

