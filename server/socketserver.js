const socketIO = require('socket.io');

const { instrument } = require("@socket.io/admin-ui");
const { sessionMiddleware } = require('./app');

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
	const io = socketIO(server, {
		transports: ['websocket', 'polling'],
		allowEIO3: true, // If you are using Engine.IO v3 clients
	  });

	// This suggested by copilot (hmmm...)
	io.use( (socket, next) => {
		sessionMiddleware(socket.request, {}, next);
	});

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

		// Really need to clean up this logic it seems crazy complex for something so simple as:
		// 1. DEV - allow to override room/name/sessionid
		// 2. PROD - force strict login only via play form and authenticated host

		// Set up for PRODUCTION
		// If DEVELOPMENT selectively override things that have been supplied

		// For regular (production) use we will grab required data from session cookie
		// Routes file will add host/room details during authentication
		// Player route will add room/name/avatar details when user POSTs form
		const session = socket.request.session;

		let userObj = session;

		// For developement use we will grab required data from the URL query string
		if (process.env.NODE_ENV === 'development') {
			const queryString = socket.handshake.headers.referer.split('?')[1] || '';
			const urlParams = new URLSearchParams(queryString);
	
			// Copy each entry from urlParams into userObj - allows to overwrite with my own versions
			// BUT FIRST - remove host property since I might be sharing this session with the host
			if (userObj.host) {
				delete userObj.host;
			}
			userObj = {
				...userObj, // Keep existing properties
				...Object.fromEntries(urlParams) // Add new properties from urlParams
			};
		}

		// Finally add the session and socket IDs
		// Need the ability to overrise session ID for development to allow multiple sessions from same browser
		if (!userObj.sessionID) {
			userObj.sessionID = socket.request.sessionID;
		}

		// Add socket.id to the userObj - then it has everything
		userObj.socketid = socket.id;

		// console.log('io.connect: userObj:', userObj);
		console.log('io.connection:', session, userObj);

		// If we don't have a room via either the session or the URL then ignore this connection
		if (!userObj.room) {
			console.log('No room defined - give up');
			return;
		}

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

	// Send keep-alive (ping) message to all connected clients every 60 seconds
	setInterval(() => {
		io.emit('server:ping');
		console.log('io.ping:', new Date());
	}, 60000); // 1 minute
	return io;
}
