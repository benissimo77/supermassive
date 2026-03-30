import { GhostSocket } from '../utils/GhostSocket.js';
import crypto from 'crypto';

/**
 * GhostManager handles the lifecycle and "intelligence" of bot players.
 * It acts as a bridge between the Room and the GhostSockets.
 */
export class GhostManager {
    constructor(room) {
        this.room = room;
        this.ghosts = []; // Array of { socket, userObj }
        this.resetPools();
    }

    /**
     * Resets the name and avatar pools to their full lists.
     */
    resetPools() {
        this.names = [
            'Alex', 'Jordan', 'Casey', 'Riley', 'Taylor', 
            'Morgan', 'Quinn', 'Skyler', 'Charlie', 'Parker',
            'Sam', 'Jamie', 'Robin', 'Avery', 'Peyton',
            'Dakota', 'Skyler', 'Phoenix', 'River', 'Sage',
            'Emerson', 'Finley', 'Hayden', 'Rowan', 'Sawyer'
        ];
        
        this.avatars = [
            '12138118', '12138231', '12138743', '12138846', '12139963', '12140600', '12143538', '12189343',
    '12214366', '12215207', '12232806', '12348050', '12358126', '12358607', '12359578', '12360465',
    '12370419', '12370830', '12391847', '12436639', '12454847', '12474909', '12502935', '12660677',
    '12789062', '12791500', '13003915', '13100182'
        ];
    }

    /**
     * Spawns a new ghost player in the room.
     */
    spawnGhost() {
        const id = `ghost_${crypto.randomUUID().substring(0, 8)}`;
        const socket = new GhostSocket(id);
        
        // Pick a name and remove it from the list to avoid duplicates in this room
        let name = "Ghost";
        if (this.names.length > 0) {
            const nameIndex = Math.floor(Math.random() * this.names.length);
            name = this.names.splice(nameIndex, 1)[0];
        }
        name += ' (Bot)';

        // Pick an avatar and remove it from the list to avoid duplicates in this room
        let avatar = '12370830';
        if (this.avatars.length > 0) {
            const avatarIndex = Math.floor(Math.random() * this.avatars.length);
            avatar = this.avatars.splice(avatarIndex, 1)[0];
        }
        
        // Assign a random skill level (0.2 to 0.9)
        const skillLevel = 0.2 + (Math.random() * 0.7);

        const userObj = {
            sessionID: id,
            socketID: id,
            name: name,
            avatar: avatar,
            isBot: true,
            skillLevel: skillLevel,
            room: this.room.id
        };

        // Hook into the socket's emit so the manager can "hear" what the server sends to the bot
        socket.onEmit = (event, data, callback) => {
            this.handleServerEvent(socket, event, data, callback);
        };

        this.ghosts.push({ socket, userObj });
        
        // Add to room using the standard method
        this.room.addUserToRoom(socket, userObj);
        
        // Simulate the bot "loading" the game and becoming ready
        setTimeout(() => {
            socket.receive('player:ready', {});
        }, 1000);
        
        console.log(`GhostManager:: Spawned ghost: ${name} (${id}) with skill ${skillLevel.toFixed(2)}`);
        return userObj;
    }

    /**
     * Handles events sent from the server to the ghost client.
     */
    handleServerEvent(socket, event, data, callback) {
        // console.log(`GhostManager:: Bot ${socket.id} received ${event}`);

        // Logic for Quiz Game
        if (event === 'server:question') {
            const ghost = this.ghosts.find(g => g.socket.id === socket.id);
            if (ghost) {
                this.simulateQuizResponse(ghost, data);
            }
        }
    }

    /**
     * Simulates a bot thinking and then answering a quiz question.
     */
    simulateQuizResponse(ghost, questionData) {
        const { socket, userObj } = ghost;

        // Random delay between 2 and 8 seconds
        const delay = 2000 + Math.random() * 6000;
        
        setTimeout(() => {
            let answer = null;

            // Try to get the correct answer from the game instance
            const game = this.room.game;
            if (game && game.name === 'quiz' && game.question) {
                const realQuestion = game.question;
                const isCorrect = Math.random() < userObj.skillLevel;

                if (isCorrect) {
                    // Correct answer logic
                    switch (realQuestion.type) {
                        case 'multiple-choice':
                        case 'true-false':
                            if (realQuestion.optionsShuffled) {
                                answer = realQuestion.optionsShuffled.indexOf(realQuestion.answer);
                            } else {
                                answer = realQuestion.answer;
                            }
                            break;
                        case 'text':
                        case 'number-exact':
                        case 'number-closest':
                            answer = realQuestion.answer;
                            break;
                        case 'matching':
                        case 'ordering':
                            answer = realQuestion.answer;
                            break;
                    }
                } else {
                    // Incorrect answer logic
                    switch (realQuestion.type) {
                        case 'multiple-choice':
                        case 'true-false':
                            const options = realQuestion.optionsShuffled || realQuestion.options || [];
                            const wrongIndices = options
                                .map((opt, idx) => opt === realQuestion.answer ? -1 : idx)
                                .filter(idx => idx !== -1);
                            if (wrongIndices.length > 0) {
                                answer = wrongIndices[Math.floor(Math.random() * wrongIndices.length)];
                            } else {
                                answer = 0;
                            }
                            break;
                        case 'text':
                            const wrongAnswers = ['I think so', 'Maybe?', 'No idea', 'Pass', '???'];
                            answer = wrongAnswers[Math.floor(Math.random() * wrongAnswers.length)];
                            break;
                        case 'number-exact':
                        case 'number-closest':
                            const val = parseFloat(realQuestion.answer);
                            if (!isNaN(val)) {
                                // Pick a number within +/- 50% of the answer, but not the answer itself
                                let offset = (Math.random() - 0.5) * val;
                                if (Math.abs(offset) < 1) offset = 1; // Ensure it's actually wrong
                                answer = Math.round(val + offset);
                            } else {
                                answer = Math.floor(Math.random() * 100);
                            }
                            break;
                        case 'matching':
                        case 'ordering':
                            // Just shuffle the items randomly
                            if (Array.isArray(realQuestion.answer)) {
                                answer = [...realQuestion.answer].sort(() => Math.random() - 0.5);
                            } else {
                                answer = [];
                            }
                            break;
                    }
                }
            }

            // Fallback to random if we couldn't determine an answer
            if (answer === null) {
                if (questionData.type === 'multiple-choice' || questionData.type === 'true-false') {
                    const optionsCount = questionData.options ? questionData.options.length : 4;
                    answer = Math.floor(Math.random() * optionsCount);
                } else if (questionData.type === 'matching' || questionData.type === 'ordering') {
                    answer = questionData.items || questionData.pairs || [];
                } else if (questionData.type === 'number-exact' || questionData.type === 'number-closest') {
                    answer = Math.floor(Math.random() * 100);
                } else {
                    answer = "Pass";
                }
            }
            
            const response = {
                questionNumber: questionData.questionNumber,
                answer: answer,
                answerTime: Math.round(delay)
            };

            // Send the response back to the room as if it came from a real client
            console.log(`GhostManager:: Bot ${userObj.name} submitting answer:`, answer);
            socket.receive('client:response', response);
        }, delay);
    }

    /**
     * Removes a specific ghost from the manager.
     */
    removeGhost(socketID) {
        this.ghosts = this.ghosts.filter(g => g.socket.id !== socketID);
    }

    /**
     * Removes all ghosts from the room.
     */
    removeAllGhosts() {
        this.ghosts.forEach(g => {
            g.socket.disconnect();
        });
        this.ghosts = [];
        this.resetPools();
    }
}
