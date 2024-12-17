// server.js
const http = require('http')
const { app, sessionMiddleware } = require('./server/app');

const server = http.createServer(app);

// load the socket server (note the syntax of socketserver.js - permits passing in the server)
const io = require('./server/socketserver')(server)

// From https://socket.io/how-to/use-with-express-session
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


function levenshteinDistance(str1, str2) {
	const len1 = str1.length;
	const len2 = str2.length;
	const matrix = Array.from({ length: len1 + 1 }, () => Array(len2 + 1).fill(0));
  
	for (let i = 0; i <= len1; i++) matrix[i][0] = i;
	for (let j = 0; j <= len2; j++) matrix[0][j] = j;
  
	for (let i = 1; i <= len1; i++) {
	  for (let j = 1; j <= len2; j++) {
		const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
		matrix[i][j] = Math.min(
		  matrix[i - 1][j] + 1,
		  matrix[i][j - 1] + 1,
		  matrix[i - 1][j - 1] + cost
		);
	  }
	}
	return matrix[len1][len2];
  }
  console.log(levenshteinDistance('kitten', 'sitting'));

console.log(levenshteinDistance('dickvanschaeff', 'dickvanschaff'));

console.log(levenshteinDistance('brazil', 'brasil'));
  