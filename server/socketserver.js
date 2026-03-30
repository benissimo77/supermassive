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

	// Helper to get stats for all active rooms
	io.getRoomStats = () => {
		const stats = {};
		Object.keys(rooms).forEach(roomID => {
			const room = rooms[roomID];
			if (room) {
				const playercount = (room.players ? room.players.length : 0);
				const hostcount = (room.hosts ? room.hosts.length : 0);
				// We include rooms with players/hosts, or non-default rooms
				if (playercount > 0 || hostcount > 0 || (roomID !== '__default__' && roomID !== undefined)) {
					stats[roomID] = {
						players: playercount,
						hosts: hostcount,
						game: room.game ? (room.game.name || 'Active') : 'Lobby'
					};
				}
			}
		});
		return stats;
	};

	const listSocketConnections = async () => {
		const sockets = await io.fetchSockets();
		console.log('listSocketConnections:', sockets.length);
		sockets.forEach((socket) => {
			console.log(socket.rooms, [...socket.rooms].length);
		});
	};

	io.on('connection', (socket) => {

		// ADDED PURELY FOR MONEYTREE - not needed after this
		socket.on('client:saveresults', (results) => {
			console.log('Client save results:', results);
			io.emit('connection', 'Caught results:', results);
		});

		// Identify the user and their room
		const userObj = identifyUser(socket);

		// Synchronize the identified data back to the session for persistence on refresh
		if (socket.request.session) {
			const s = socket.request.session;
			s.name = userObj.name;
			s.avatar = userObj.avatar;
			s.room = userObj.room;
			s.role = userObj.role;
			s.host = userObj.host;
			s.lastActive = Date.now();
			s.save();
		}

		console.log(`Socket connected [${socket.id}] as ${userObj.name} in room ${userObj.room} (${userObj.role})`);

		// Create or get the room
		if (!rooms[userObj.room]) {
			rooms[userObj.room] = new Room(io, userObj.room);
			console.log('Created new room:', userObj.room);
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

	return io;
}

/**
 * Extracts identity and placement info from the session and referer URL.
 * Supports development overrides for testing multiple clients in one browser.
 */
function identifyUser(socket) {
	const session = socket.request.session || {};
	const referer = socket.handshake.headers.referer;

	// 1. Initial Identity (defaults or existing session data)
	let userObj = {
		sessionID: socket.request.sessionID,
		socketID: socket.id,
		userID: session.passport?.user || session.user?._id || null,
		name: session.name || 'Guest',
		avatar: session.avatar || 'default',
		room: session.room || '__default__',
		host: !!session.host,
		role: session.role || 'player'
	};

	// 2. Override based on URL Path (e.g. /host/ROOM1 vs /play/ROOM1)
	if (referer) {
		try {
			const url = new URL(referer);
			const pathSegments = url.pathname.split('/').filter(s => s.length > 0);
			const [type, roomCode] = pathSegments;

			if (type === 'host') {
				userObj.host = true;
				userObj.role = 'host';
				if (roomCode) userObj.room = roomCode.toUpperCase();
			} else if (type === 'admin') {
				userObj.role = 'admin';
				if (roomCode) userObj.room = roomCode.toUpperCase();
			} else if (type === 'play') {
				userObj.host = false;
				userObj.role = 'player';
				if (roomCode) userObj.room = roomCode.toUpperCase();
			}

			// 3. Query Parameter Overrides (ONLY for dev testing)
			if (process.env.NODE_ENV !== 'production') {
				const urlParams = new URLSearchParams(url.search);

				// Support ?sessionID=XYZ ?name=Bob ?avatar=123 ?room=TEST
				if (urlParams.get('sessionID')) userObj.sessionID = urlParams.get('sessionID');
				if (urlParams.get('name')) userObj.name = urlParams.get('name');
				if (urlParams.get('avatar')) userObj.avatar = urlParams.get('avatar');
				if (urlParams.get('room')) userObj.room = urlParams.get('room').toUpperCase();
				if (urlParams.get('role')) userObj.role = urlParams.get('role');
				if (urlParams.has('host')) {
					userObj.host = (urlParams.get('host') === 'true' || urlParams.get('host') === '1');
					if (userObj.host) userObj.role = 'host';
					else if (userObj.role === 'host') userObj.role = 'player';
				}
			}

		} catch (e) {
			console.error('SocketServer::identifyUser: Error parsing referer URL:', e);
		}
	}

	return userObj;
}

