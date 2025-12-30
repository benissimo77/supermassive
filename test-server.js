// Create a test file test-server.js
import http from 'http';

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Connection successful');
});

server.listen(8000, '0.0.0.0', () => {
    console.log('Test server running on port 8000');
});
