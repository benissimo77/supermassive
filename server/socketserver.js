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

	// Simple storage for ping results
	const pingResults = [];

	// Ping all connected clients periodically
	setInterval(async () => {
		try {
			// Get all connected sockets
			const sockets = await io.fetchSockets();

			// Only run if we have clients
			if (sockets.length === 0) return;

			console.log(`Pinging ${sockets.length} clients...`);

			// Ping each client
			sockets.forEach(socket => {
				const startTime = Date.now();

				// Send ping with timestamp and expect acknowledgment
				socket.emit('server:ping', { timestamp: startTime }, (response) => {
					const endTime = Date.now();
					const roundTripTime = endTime - startTime;

					// Extract device info from response
					const device = response.device || 'unknown';
					const room = socket.request?.session?.room || 'unknown';

					// Store the result
					const result = {
						socketId: socket.id,
						device,
						roundTripTime,
						timestamp: new Date().toISOString(),
						room
					};

					// Add to results array (limiting size to prevent memory issues)
					pingResults.push(result);
					if (pingResults.length > 1000) {
						pingResults.shift(); // Remove oldest entry if we have too many
					}

					// Log the result
					console.log(`Ping response from ${socket.id} (${device}): ${roundTripTime}ms`);

					// Broadcast the new result to any admin UI clients
					try {
						const adminNs = io.of('/admin'); // admin namespace created by instrument()
						// broadcast a small payload — avoid sending full heavy arrays every tick
						adminNs.emit('server:ping-result', {
							socketId: result.socketId,
							device: result.device,
							roundTripTime: result.roundTripTime,
							timestamp: result.timestamp,
							room: result.room
						});
					} catch (e) {
						console.warn('Could not emit to admin namespace:', e);
					}
				});
			});
		} catch (error) {
			console.error("Error during ping test:", error);
		}
	}, 2 * 60 * 1000); // Every 3 minutes


	// Send keep-alive (ping) message to all connected clients every 60 seconds
	// This was way simpler than the above - always more complexity...
	// setInterval(() => {
	// 	io.emit('server:ping');
	// 	console.log('io.ping:', new Date());
	// }, 60000); // 1 minute

	return io;
}