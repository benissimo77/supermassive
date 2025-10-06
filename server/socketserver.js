import { Server } from 'socket.io';
import { instrument } from '@socket.io/admin-ui';
import { sessionMiddleware } from './app.js';
import { Room } from './room.js';

export default function createSocketServer(server) {
	// Initialize Socket.IO
	const io = new Server(server, {
		transports: ['websocket', 'polling'],
		allowEIO3: true, // If you are using Engine.IO v3 clients
		cors: {
			origin: ['https://admin.socket.io', 'http://localhost:3000'],
			methods: ['GET', 'POST'],
			credentials: true
		}
	});

	// Use session middleware with Socket.IO
	io.use((socket, next) => {
		sessionMiddleware(socket.request, {}, next);
	});

	// Used by the Admin UI
	instrument(io, {
		auth: process.env.NODE_ENV === 'production' ? {
			type: "basic",
			username: process.env.ADMIN_USERNAME,
			password: process.env.ADMIN_PASSWORD
		} : false
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

		// ADDED PURELY FOR MONEYTREE - not needed after this
		//
		socket.on('client:saveresults', (results) => {
			console.log('Client save results:', results);
			io.emit('connection', 'Caught results:', results);
		});
		//
		//
		//
		//

		const session = socket.request.session;
		let userObj = session;

		// For development, override session data with query string parameters
		// Allows single browser session to simulate multiple users and one host
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
		userObj.socketID = socket.id;

		console.log('io.connection:', session, userObj);

		// If no room is defined, ignore the connection
		if (!userObj.room) {
			console.log('No room defined - fallback to default room __default');
			userObj.room = '__default__';
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