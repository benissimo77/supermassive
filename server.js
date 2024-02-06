// server.js
const express = require('express');
const http = require('http')
const { app, sessionMiddleware } = require('./app');


const server = http.createServer(app);

// load the socket server (note the syntax of socketserver.js - permits passing in the server)
const io = require('./socketserver')(server)

// From https://socket.io/how-to/use-with-express-session
io.engine.use(sessionMiddleware);


// Start the server on port 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

