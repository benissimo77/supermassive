const cookie = require('cookie');
const socketIO = require('socket.io');
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
		var cookies = socket.handshake.headers.cookie ? cookie.parse(socket.handshake.headers.cookie) : null;
		const session = socket.request.session;

		// For developement use we will grab required data from the URL query string
		const referer = socket.handshake.headers.referer.split('?')[1] || '';
		const params = referer && referer.split('&');
		// Testing - can I just parse request directly into a userObj ?
		const urlParams = new URLSearchParams(referer);
		let userObj = Object.fromEntries(urlParams);

		// Add socket.id to the userObj - then it has everything
		userObj.socketid = socket.id;

		// console.log('io.connect: userObj:', userObj);
		console.log('io.connection:', socket.id, userObj.room);

		if (!rooms[userObj.room]) {
			rooms[userObj.room] = new Room(io, userObj.room);
		}
		thisRoom = rooms[userObj.room];
		
		// From https://socket.io/docs/v4/server-socket-instance/#socketrooms
		// Its possible to add attributes to a socket and they will be readable later...
		// Attach the room - this then gives an entry directly into the room on every event
		socket.room = thisRoom;
		// I think the above only works during a single event - won't persist across events

		// userJoinRoom performs all the relevant socket set up for this user in this room
		thisRoom.addUserToRoom(socket, userObj);

	})	// io.on('connection')

	return io;
}