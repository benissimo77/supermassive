// Provide basic lobby display for users while waiting for game to start
// Change CSS to lobby-specific CSS at some point...
import gsap from 'gsap';

// At some point variants of the below functions should be loaded...
import { dom } from './dom.quiz.js';
// import { AudioManager } from '../audiomanager.js';
// import { musicTracks, effectTracks, narratorTracks } from './audio.werewolves.js';

console.log('Quiz.js loaded:', window.location);

class Quiz {

    constructor(socket) {
        this.socket = socket;
        this.init();
        console.log('Quiz initialized');
    }

    init() {
        dom.init();
        this.attachSocketEvents(this.socket);
        this.attachButtonEventHandlers();
        console.log('Quiz started');
    }

    // end - perform cleanup
    // Cleaning up is far simpler than the player side since we perform a page redirect which clears eveything anyway
    end() {
        console.log('Quiz ended');
    }


    attachSocketEvents(socket) {

        // built-in events
        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        
        // Connect/Disconnect events specific to game
        socket.on('hostconnect', onHostConnect);
        socket.on('playerconnect', onPlayerConnect);
        socket.on('playerdisconnect', onPlayerDisconnect);
        
        // Other game-specific events
        socket.on('server:introquiz', onIntroQuiz);
        socket.on('server:introround', onIntroRound);
        socket.on('server:question', onQuestion);
        // socket.on('playerlist', onPlayerList);
        // socket.on('audioplay', onAudioPlay);
        // socket.on('gamestate', onGameState);
        // socket.on('startgame', onStartGame);
        socket.on('server:starttimer', onStartTimer);
        // socket.on('server:request', onServerRequest);
        socket.on('server:loadgame', onLoadGame);
    
    }

    // attachButtonEvents - attach event handlers to the buttons
    // These are the specific event handlers for buttons that are displayed on the host screen
    // Most likely will be used during testing - ideally the host screen will be a display-only screen, controlled by the server
    attachButtonEventHandlers() {
        document.getElementById("buttonStart").addEventListener('click', function() {
            console.log('buttonStart');
            socket.emit('host:requeststart', 'quiz');
        });
        document.getElementById("buttonEnd").addEventListener('click', function() {
            console.log('buttonEnd:', socket);
            socket.emit('host:requestend');
        });
        document.getElementById("buttonHostReady").addEventListener('click', function() {
            console.log('buttonHostReady:');
            // clear up all possible audio/visuals
            dom.DOMhideAllPanels();
            socket.emit('host:response');
        });
        
    }        

}

// Placing the init function inside window.onLoad is too late - for some reason a lot of code has already been called including building the display
window.onload = function() {
    dom.init();
    const quiz = new Quiz(socket);
    console.log('window.onload: completed:', socket);
};


// Define event listeners for the HOST buttons (only for testing at this stage)
// Attach event handlers to the buttons
function buttonHostComplete() {
}




// SOCKET EVENTS
// Add client socket event handlers
const onConnect = function () {
    console.log('onConnect:', socket.connected);
  }
const onDisconnect = function () {
    console.log('onDisconnect:', socket.connected);
}
const onHostConnect = function(players) {
    console.log('onHostConnect:', players);
    dom.DOMaddPlayers(players);
    dom.TLgameState().play();
}
const onPlayerConnect = function(player) {
    console.log('onPlayerConnect:', player);
    dom.DOMaddPlayer(player);
    dom.TLgameState().play();
}
const onPlayerDisconnect = function(socketid) {
    console.log('onPlayerDisconnect:', socketid);
    dom.DOMremovePlayer(socketid);
}

// onStartGame
// Sent to the host when the game is started - display instructions on screen (these must be removed)
// players will receive their own instructions
// Host will receive a gamestate event after this to update the player positions
// Maybe this gamestate event should be responsible for removing the instructions ?
// For now provide a button which will remove instructions and send a hostready event to move to next stage
// TODO: this function manipulates the DOM - should be in dom.werewolves.js
function onStartGame() {
    console.log('onStartGame:');
    gsap.set("#largepanel", { display: "block" });
    gsap.set("#largepanelcontent > div", { display: "none" });
    gsap.set("#startgame", { display: "block" });
    dom.TLgameState().play();
}

// onIntroQuiz
// Display the quiz instructions on the screen
// This is a simple fade in/out of the question/answer panel
// Might as well use the question/answer panel since it by definition should not be used when introducing the quiz/round
// Note: slightly hacky but this function also removes the connection panel
function onIntroQuiz(payload) {
    console.log('onIntroQuiz:', payload);
    dom.DOMpanelResponse(payload);
}

// onIntroRound
// Display the round instructions on the screen
// This is a simple fade in/out of the instructions panel
function onIntroRound(payload) {
    console.log('onIntroRound:', payload);
    dom.DOMpanelResponse(payload);
}

// onQuestion
// Display the question on the screen
// This is a simple fade in/out of the question panel
function onQuestion(question) {
    dom.DOMpanelQuestion(question);
}

// onStartTimer
// Simple function to display a timer on the screen which counts down
// Nothing happens when the timer completes - this is just a visual timer
// It is up to the server to determine what happens at the end of the timer period
function onStartTimer(request) {
    console.log('onStartTimer:', request);
    gsap.set("#timer", { display: "block" });
    gsap.fromTo("#timer .timer_progress", { width: "100%" }, { 
        width: 0,
        duration: request.duration,
        ease: "linear",
        onComplete: () => {
            hideTimer();
    }});
}

function hideTimer() {
    gsap.set("#timer", { display: "none" });
}

function onLoadGame(game) {
    console.log('onLoadGame:');
    const tl = dom.TLgameOver();
    tl.add( () => {
        window.location.href = `./${game}.html`;
    });
    tl.play();
}


// Contact the socket.io socket server
// clientOptions can be used to pass things like username/password - see docs
// URL of undefined means io will connect to the window.location (suitable if hosting at same place as socket-server is running)
// import io from 'socket.io-client';
const clientOptions = {};
const socket = io();

