const cookie = require('cookie');
const socketIO = require('socket.io');
const cookieSignature = require('cookie-signature');

const { instrument } = require("@socket.io/admin-ui");

// Experiment with receiving the server variable from the requiring module...
module.exports = function (server) {

	// init socket.io
	// We are not using react anymore here so likely no need for the cors entry
	// const ioconfig = {
	//   cors: {
	//     origin: 'http://localhost:3001',
	//     credentials: true
	//   }
	// }
	// const io = socketIO(server, ioconfig);
	const io = socketIO(server);

	// Used by the Admin UI
	instrument(io, {
		auth: false
	});

	// Models
	const { Room } = require('./room');

	// Store all room objects, keyed on the 4-CHAR ID of the room
	// This is a simple way to ensure we don't have multiple rooms with the same ID
	// It also makes it easy to find a room by its ID
	// Note: if server restarts for any reason then all rooms will be lost
	var rooms = {};

	
	const listSocketConnections = async () => {
		let sockets = await io.fetchSockets();
		console.log('listSocketConnections:', sockets.length);
		sockets.forEach(socket => {
			console.log(socket.rooms, [...socket.rooms].length);
		})
	}

	io.on('connection', (socket) => {

		// For regular (production) use we will grab required data from session cookie
		const session = socket.request.session;

		// For developement use we will grab required data from the URL query string
		const referer = socket.handshake.headers.referer.split('?')[1] || '';
		const params = referer && referer.split('&');
		const urlParams = new URLSearchParams(referer);

		// All-important is this line to create a userObj, either from query or from session (ideally merge)
		let userObj = Object.fromEntries(urlParams);

		// Session is already in the correct format - use it if URL query string doesn't have the required data
		// Note: this can be hacked if the user simply adds room to their URL - but that's not a big deal for now 
		if (!userObj.room) {
			userObj = session;
		}

		// Add socket.id to the userObj - then it has everything
		userObj.socketid = socket.id;

		// console.log('io.connect: userObj:', userObj);
		console.log('io.connection:', socket.id, session, referer, params, urlParams);

		if (!rooms[userObj.room]) {
			rooms[userObj.room] = new Room(io, userObj.room);
		}
		thisRoom = rooms[userObj.room];
		
		// From https://socket.io/docs/v4/server-socket-instance/#socketrooms
		// Its possible to add attributes to a socket and they will be readable later...
		// Attach the room - this then gives an entry directly into the room on every event
		// socket.room = thisRoom;
		// I think the above only works during a single event - won't persist across events

		// userJoinRoom performs all the relevant socket set up for this user in this room
		thisRoom.addUserToRoom(socket, userObj);

	})	// io.on('connection')

	io.on('disconnection', (socket) => {
		console.log('io.disconnect:', socket.id);
	})

	return io;
}