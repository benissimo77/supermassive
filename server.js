// server.js
const http = require('http')
const { app, sessionMiddleware } = require('./app');

const server = http.createServer(app);

// load the socket server (note the syntax of socketserver.js - permits passing in the server)
const io = require('./socketserver')(server)

// From https://socket.io/how-to/use-with-express-session
io.engine.use(sessionMiddleware);
// Copilot says above line is not correct (!) use below instead...
// Use the session middleware with Socket.IO
// io.use((socket, next) => {
//   const mockRes = {};
//   sessionMiddleware(socket.request, mockRes, next);
// });
// Copilot is talking out of its AI-arse...

// Start the server on port 3001
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

