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
        // name += ' (Bot)';

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

        // Try to get the correct answer from the game instance
        const game = this.room.game;

        // Better pause logic to suit the question type
        // First range is for the simplest questions true/false multiple choice
        let delay = 2000 + Math.random() * 6000;
        if (game && game.question) {
            const questionType = game.question.type;
            if (questionType === 'text' || questionType === 'number-exact' || questionType === 'hotspot' || questionType === 'point-it-out') {
                delay = 4000 + Math.random() * 8000;
            } else if (questionType === 'matching' || questionType === 'ordering' || questionType === 'number-closest') {
                delay = 8000 + Math.random() * 10000;
            }
        }
        
        setTimeout(() => {
            let answer = null;

            if (game && game.question) {
                const realQuestion = game.question;
                const isCorrect = Math.random() < userObj.skillLevel;

                if (isCorrect) {
                    // Correct (or near-correct) answer logic
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
                        case 'matching':
                        case 'ordering':
                            answer = realQuestion.answer;
                            break;
                        case 'number-closest':
                            const val = parseFloat(realQuestion.answer);
                            answer = realQuestion.answer;
                            if (!isNaN(val)) {
                                // Skill determines how "perfect" the guess is
                                const variance = (1 - userObj.skillLevel) * (val * 0.3); // Up to 30% variance
                                const offset = (Math.random() - 0.5) * variance;
                                answer = val + offset;
                            }
                            break;
                        case 'hotspot':
                            // Get near it based on skill
                            const hx = realQuestion.answer.x;
                            const hy = realQuestion.answer.y;
                            const hVariance = (1 - userObj.skillLevel) * 100; // Up to 100 logical pixels (based on 1000x1000 canvas) away
                            answer = {
                                x: hx + (Math.random() - 0.5) * hVariance,
                                y: hy + (Math.random() - 0.5) * hVariance
                            };
                            break;
                        case 'point-it-out':
                            // Aim for roughly the center of the bounding box
                            const start = realQuestion.answer.start;
                            const end = realQuestion.answer.end;
                            const centerX = (start.x + end.x) / 2;
                            const centerY = (start.y + end.y) / 2;
                            const pVarianceX = (end.x - start.x) * 0.2; // 20% of width
                            const pVarianceY = (end.y - start.y) * 0.2; // 20% of height
                            answer = {
                                x: centerX + (Math.random() - 0.5) * pVarianceX,
                                y: centerY + (Math.random() - 0.5) * pVarianceY
                            };
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
                            answer = '';
                            break;
                        case 'number-exact':
                        case 'number-closest':
                            const val = parseFloat(realQuestion.answer);
                            if (!isNaN(val)) {
                                // Pick a number significantly away but "realistic-looking"
                                let offset = (Math.random() > 0.5 ? 1 : -1) * (val * (0.2 + Math.random() * 0.5));
                                if (Math.abs(offset) < 1) offset = 5; 
                                answer = Math.round(val + offset);
                            } else {
                                answer = Math.floor(Math.random() * 100);
                            }
                            break;
                        case 'hotspot':
                            // Pick a spot reasonably far away but on canvas (avoid edges)
                            answer = {
                                x: 500 + (Math.random() - 0.5) * 250,
                                y: 500 + (Math.random() - 0.5) * 250
                            }
                            break;
                        case 'point-it-out':
                            // Pick a spot outside the target box
                            const start = realQuestion.answer.start;
                            const end = realQuestion.answer.end;
                            // Randomly decide to be wrong in X or Y
                            let px = 400 + Math.random() * 1100;
                            let py = 200 + Math.random() * 600;
                            // Simple nudge outside if we coincidentally hit inside
                            if (px > start.x && px < end.x) px += 500;
                            px = Math.max(20, Math.min(980, px));
                            answer = { x: px, y: py };
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
                    answer = "";
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
