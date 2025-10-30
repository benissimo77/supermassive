import http from 'http';
import { app, sessionMiddleware } from './server/app.js';
import createSocketServer from './server/socketserver.js';
import os from 'os';

const server = http.createServer(app);

// Load the socket server (note the syntax of socketserver.js - permits passing in the server)
const io = createSocketServer(server);

// Use the session middleware with Socket.IO
io.engine.use(sessionMiddleware);


// Copilot says above line is not correct (!) use below instead...
// Use the session middleware with Socket.IO
// io.use((socket, next) => {
//   const mockRes = {};
//   sessionMiddleware(socket.request, mockRes, next);
// });
// Copilot is talking out of its AI-arse...

// Copilot also now tried suggesting another alternative to above...

// Use the session middleware with Socket.IO
// io.use((socket, next) => {
//   sessionMiddleware(socket.request, {}, next);
//   next();
// });

// Function to get the local IP address
function getLocalIPAddress() {
	const nets = os.networkInterfaces();

	for (const name of Object.keys(nets)) {
		for (const net of nets[name]) {
			// Skip over non-IPv4 and internal (loopback) addresses
			if (net.family === 'IPv4' && !net.internal) {
				return net.address;
			}
		}
	}
	return 'localhost'; // Fallback if no IP address found
}


// Start the server on port 3000
const PORT = process.env.PORT || 3000;
// server.listen(PORT, () => {
// 	console.log(`Server is running on http://localhost:${PORT}`);
// });

server.listen(PORT, '0.0.0.0', () => {

	console.log(`Server is running on:`);
	console.log(`- Local: http://localhost:${PORT}`);
	console.log(`- Network: http://${getLocalIPAddress()}:${PORT}`);
});


['SIGINT', 'SIGTERM'].forEach(signal => {
	process.on(signal, () => {
		console.log(`${signal} received, shutting down gracefully`);
		server.close(() => {
			console.log('Server closed');
			process.exit(0);
		});
	});
});
