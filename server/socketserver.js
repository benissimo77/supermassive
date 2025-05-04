import { Server } from 'socket.io';
import { instrument } from '@socket.io/admin-ui';
import { sessionMiddleware } from './app.js';
import { Room } from './room.js';

export default function createSocketServer(server) {
	// Initialize Socket.IO
	const io = new Server(server, {
		transports: ['websocket', 'polling'],
		allowEIO3: true, // If you are using Engine.IO v3 clients
	});

	// Use session middleware with Socket.IO
	io.use((socket, next) => {
		sessionMiddleware(socket.request, {}, next);
	});

	// Used by the Admin UI
	instrument(io, {
		auth: false,
	});

	// Store all room objects, keyed on the 4-CHAR ID of the room
	const rooms = {};

	const listSocketConnections = async () => {
		const sockets = await io.fetchSockets();
		console.log('listSocketConnections:', sockets.length);
		sockets.forEach((socket) => {
			console.log(socket.rooms, [...socket.rooms].length);
		});
	};

	io.on('connection', (socket) => {
		const session = socket.request.session;
		let userObj = session;

		// For development, override session data with query string parameters
		if (process.env.NODE_ENV === 'development') {
			const queryString = socket.handshake.headers.referer.split('?')[1] || '';
			const urlParams = new URLSearchParams(queryString);

			// Merge query string parameters into the user object
			if (userObj.host) {
				delete userObj.host;
			}
			userObj = {
				...userObj,
				...Object.fromEntries(urlParams),
			};
		}

		// Add session and socket IDs to the user object
		if (!userObj.sessionID) {
			userObj.sessionID = socket.request.sessionID;
		}
		userObj.socketid = socket.id;

		console.log('io.connection:', session, userObj);

		// If no room is defined, ignore the connection
		if (!userObj.room) {
			console.log('No room defined - give up');
			return;
		}

		// Create a new room if it doesn't exist
		if (!rooms[userObj.room]) {
			rooms[userObj.room] = new Room(io, userObj.room);
		}
		const thisRoom = rooms[userObj.room];

		// Add the user to the room
		thisRoom.addUserToRoom(socket, userObj);
	});

	io.on('disconnection', (socket) => {
		console.log('io.disconnect:', socket.id);
	});

	// Send keep-alive (ping) message to all connected clients every 60 seconds
	setInterval(() => {
		io.emit('server:ping');
		console.log('io.ping:', new Date());
	}, 60000); // 1 minute

	return io;
}