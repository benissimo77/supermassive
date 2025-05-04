import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

import fs from 'fs';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Keep track of connected sockets
let connectedSockets = new Set();

io.on('connection', (socket) => {
    console.log('a user connected:', socket.id);
    connectedSockets.add(socket.id);

    socket.on('disconnect', () => {
        console.log('user disconnected');
        connectedSockets.delete(socket.id);
    });
    socket.on('client:playermessage', function (message) {
        // emit a message to all players about the player that moved
        io.emit('server:playermessage', message);
        console.log(`Message sent to ${connectedSockets.size} sockets`);
    });

    socket.on('client:saveresults', function (results) {
        console.log('Client results:', results);

        // Write the results to a file
        fs.appendFile('results.txt', results + '\n', (err) => {
            if (err) {
                console.error('Error writing to file:', err);
                socket.emit('connection', 'Error writing to file:' + err);
            } else {
                console.log('Results saved to results.txt');
                socket.emit('connection', 'Results saved:' + results);
            }
        });

    })

    // Immediately send a socket message to the client (testing)
    socket.emit('connection', 'Hello from the server');
})

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));


