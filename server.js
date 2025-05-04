import http from 'http';
import { app, sessionMiddleware } from './server/app.js';
import createSocketServer from './server/socketserver.js';

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


// Start the server on port 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});