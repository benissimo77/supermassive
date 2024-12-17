// Provide basic lobby display for users while waiting for game to start
// Change CSS to lobby-specific CSS at some point...
import gsap from 'gsap';

// At some point variants of the below functions should be loaded...
import { dom } from './dom.quiz.js';
import { ImageSelector } from '../ImageSelector.js';
import { Overlay } from '../Overlay.js';
import { AudioPlayer } from '../AudioPlayer.js';

// import { AudioManager } from '../audiomanager.js';
// import { musicTracks, effectTracks, narratorTracks } from './audio.werewolves.js';

console.log('Quiz.js loaded:', window.location);

class Quiz {
    
    constructor(socket) {
        this.socket = socket;

        this.events = {
            // Connection events
            'connect': [this.onConnect, false, 'Connect', {}],
            'disconnect': [this.onDisconnect, false, 'Disconnect', {}],
            'hostconnect': [this.onHostConnect, true, 'Host Connect', {room:'QUIZ', players:[{name:'Player One', avatar:'12138743', socketid:1, sessionID:1},{name:'Player Two', avatar:'12140600', socketid:2, sessionID:2},{name:'Player Three', avatar:'12140600', socketid:3,sessionID:3}] } ],
            'playerconnect': [this.onPlayerConnect, false, 'Player Connect', {room: 'QUIZ', player: {name:'Player One', avatar:'12140600', socketid:1, sessionID:"X1" } } ],
            'playerdisconnect': [this.onPlayerDisconnect, false, 'Player Disconnect', {}],
            
            // Quiz events
            'server:introquiz': [this.onIntroQuiz, false, 'Intro Quiz', {"title":"Quiz Title","description":"Quiz Instructions"}],
            'server:introround': [this.onIntroRound, false, 'Intro Round', {title: 'Round Title', description: 'Round Instructions'}],
            'server:question': [this.onQuestion, true, 'Question', {
                "type": "draw",
                "text": "Old-skool draw the answer!",
                "image": null,
                "audio": "",
                "answer": "This is what you should have drawn..."
              }],
            'server:questionanswered': [this.onQuestionAnswered, false, 'Question Answered', {}],
            'server:showanswer': [this.onShowAnswer, true, 'Show Answer', {}],
            'server:updatescores': [this.onUpdateScores, true, 'Update Scores', { scores: {"1":10, "2":0, "3":0 } } ],
            'server:endquestion': [this.onEndQuestion, true, 'End Question', {}],
            'server:endround': [this.onEndRound, true, 'End Round', {}],
            'server:endquiz': [this.onEndQuiz, true, 'End Quiz', {}],
            
            // Additional
            'server:starttimer': [this.onStartTimer, false, 'Start Timer', {duration:10}],
            'server:loadgame': [this.onLoadGame, false, 'Load Game', {}],
        }

        this.init();
        console.log('Quiz initialized');
    }

    init() {
        dom.init();
        this.attachSocketEvents(this.socket);
        if (process.env.NODE_ENV === 'developmentX') {
            this.addDevelopmentButtons(this.events);
        }

        // Additional button handlers needed by the host dev AND production
        document.getElementById("buttonHostReady").addEventListener('click', this.buttonHostReady);
        document.getElementById("buttonStart").addEventListener('click', this.buttonStart);

        // Request the server loads the quiz (if not already loaded)
        this.socket.emit('host:requestgame', 'quiz');
        console.log('Quiz.init done');
    }

    // end - perform cleanup
    // Cleaning up is far simpler than the player side since we perform a page redirect which clears eveything anyway
    end() {
        console.log('Quiz ended');
    }


    attachSocketEvents(socket) {

        // built-in events
        socket.on('connect', this.onConnect);
        socket.on('disconnect', this.onDisconnect);
        
        // Connect/Disconnect events specific to game
        socket.on('hostconnect', this.onHostConnect);
        socket.on('playerconnect', this.onPlayerConnect);
        socket.on('playerdisconnect', this.onPlayerDisconnect);
        
        // Other game-specific events
        socket.on('server:introquiz', this.onIntroQuiz);
        socket.on('server:introround', this.onIntroRound);
        socket.on('server:question', this.onQuestion);
        socket.on('server:questionanswered', this.onQuestionAnswered)
        socket.on('server:showanswer', this.onShowAnswer);
        socket.on('server:updatescores', this.onUpdateScores);
        socket.on('server:endquestion', this.onEndQuestion);
        socket.on('server:endround', this.onEndRound);
        socket.on('server:endquiz', this.onEndQuiz);
        // socket.on('playerlist', onPlayerList);
        // socket.on('audioplay', onAudioPlay);
        // socket.on('gamestate', onGameState);
        // socket.on('startgame', onStartGame);
        socket.on('server:starttimer', this.onStartTimer);
        // socket.on('server:request', onServerRequest);
        socket.on('server:loadgame', this.onLoadGame);
    
    }

    buttonStart = () => {
        const urlParams = new URLSearchParams(window.location.search);
        console.log('buttonStart:', urlParams);
        this.socket.emit('host:requeststart', { quizID: urlParams.get('q') });
    }
    buttonEnd = () => {
        console.log('buttonEnd:', this.socket);
        this.socket.emit('host:requestend');
    }
    buttonHostReady = () => {
        console.log('buttonHostReady:');
        // clear up all possible audio/visuals
        dom.TLhideAllPanels()
        .add( () => this.socket.emit('host:response') )
        .play();
    }

    // addDevelopmentButtons - attach buttons and event handlers
    // These are the specific event handlers for buttons that are displayed on the host screen during development
    // Most likely will be used during testing - ideally the host screen will be a display-only screen, controlled by the server
    addDevelopmentButtons(events) {
        console.log('addDevelopmentButtons:', this.events);
    
        for (var eventname in this.events) {
            console.log('addDevelopmentButtons:', eventname, events[eventname]);

            const event = events[eventname];

            if (event[1]) {
                const button = this.createEventButton(eventname, event);
                const payload = this.createPayloadButton(eventname, event);
    
                // Place two buttons into buttonlist - one for the event and one for the payload
                // Payload button should be arrange to go on top of the event button
                document.getElementById('buttonlist').appendChild(payload);
                document.getElementById('buttonlist').appendChild(button);
    
                button.addEventListener('click', (e) => { this.triggerSocketEvent(e) });
                payload.addEventListener('click', (e) => { this.togglePayload(e); })    
            }
        }

    }        

    createEventButton(eventname, event) {
        const button = document.createElement('button');
        button.id = `button-${eventname}`;
        button.classList.add('event-button');
        button.innerHTML = event[2];
        return button;
    }
    createPayloadButton(eventname, event) {
        console.log('createPayload:', eventname, event);
        const payload = document.createElement('div');
        payload.id = `payload-${eventname}`;
        payload.classList.add('payload');
        const textarea = payload.appendChild(document.createElement('textarea'));
        textarea.value = JSON.stringify(event[3]);
        document.getElementById('payloadlist').appendChild(payload);

        const payloadButton = document.createElement('button');
        payloadButton.id = `payloadbutton-${eventname}`;
        payloadButton.innerHTML = 'Payload';
        payloadButton.classList.add('payload-button');
        return payloadButton;
    }
    triggerSocketEvent = (e) => {
        const eventname = e.target.id.replace('button-', '');
        const event = this.events[eventname];
        console.log('triggerSocketEvent:', eventname, event);
        const payload = document.getElementById(`payload-${eventname}`);
        const payloadText = payload.querySelector('textarea').value;
        const payloadObject = JSON.parse(payloadText);
        console.log('triggerSocketEvent:', eventname, payloadObject);
        // This feature relies on the server have a triggerserverevent catch which sends the data straight back
        this.socket.emit("triggersocketevent", { eventname: eventname, payload: payloadObject });
    }

    togglePayload = (e) => {
        console.log('togglePayload:', e, e.target.id);
        const eventname = e.target.id.replace('payloadbutton-', '');
        const payload = document.getElementById(`payload-${eventname}`);
        const active = payload.classList.contains('active');
        // Hide all payloads
        const payloads = document.querySelectorAll('.payload');
        payloads.forEach( (payload) => {
            payload.classList.remove('active');
        });
        // Show the payload if it is not already active
        if (!active) {
            payload.classList.add('active');
        }
    }

    // SOCKET EVENT HANDLERS
    // BUILT-IN EVENTS
    onConnect = () => {
        console.log('onConnect:', this.socket.connected);
    }
    onDisconnect = () => {
        console.log('onDisconnect:', this.socket.connected);
    }
    
    // CONNECT/DISCONNECT GAME-SPECIFIC EVENTS
    onHostConnect = (payload) => {
        console.log('onHostConnect:', payload.room, payload.players);
        dom.DOMaddPlayers(payload.players);
        dom.TLgameState().play();
    }
    onPlayerConnect = (player) => {
        console.log('onPlayerConnect:', player);
        dom.DOMaddPlayer(player);
        dom.TLgameState().play();
    }
    onPlayerDisconnect = (sessionID) => {
        console.log('onPlayerDisconnect:', sessionID);
        dom.DOMremovePlayer(sessionID);
    }
    
    // GAME-SPECIFIC EVENTS

    // onIntroQuiz
    // Display the quiz instructions on the screen
    // This is a simple fade in/out of the question/answer panel
    // Might as well use the question/answer panel since it by definition should not be used when introducing the quiz/round
    // Note: slightly hacky but this function also removes the connection panel
    onIntroQuiz = (payload) => {
        console.log('onIntroQuiz:', payload);
        dom.TLpanelSlideUp()
        .add( dom.TLpanelSlideDown(payload) )
        .add( dom.TLflyInRacetrack(), "<" )
        .add( () => {
            this.socket.emit('host:response');
        })
        .play();
    }

    // onIntroRound
    // Display the round instructions on the screen
    // This is a simple slide in/out of the instructions panel
    onIntroRound = (payload) => {
        console.log('onIntroRound:', payload);
        dom.TLpanelSlideUp()
        .add(dom.TLhideAllPanels(), "<")
        .add(dom.TLflyOutRacetrack(), "<")
        .add(dom.TLpanelSlideDown(payload))
        .add( () => {
            this.socket.emit('host:response');
        })
        .play();
    }

    // onQuestion
    // Display the question on the screen
    // This is a simple fade in/out of the question panel
    // NOTE: importantly the socket event that called this is expecting a response before it starts the timer...
    onQuestion = (question) => {
        console.log('onQuestion:', question);
        gsap.killTweensOf("#question-panel");
        dom.TLpanelSlideUp()
        .add(dom.TLpanelQuestion(question))
        .add( () => {
            console.log('onQuestion: sending hostresponse');
            this.socket.emit('host:response');
        })
        .play();
    }

    // onQuestionAnswered
    onQuestionAnswered = (payload) => {
        console.log('onQuestionAnswered:', payload);
        dom.DOMsetPlayerNamePanel(payload.sessionID);
    }

    // It really seems like showAnswer should not need to show the qeustion again as its already showing...
    onShowAnswer = (payload) => {
        console.log('onShowAnswer:', payload);
        // dom.TLpanelSlideUp()
        // .add(dom.TLpanelQuestion(payload), "<")
        // .add( () => {
        //     console.log('onShowAnswer: adding answer');
        //     dom.DOMshowAnswer(payload);
        // })
        // .play();
        dom.DOMshowAnswer(payload);
    }

    // onEndQuestion
    // Clear up after the question has been answered (or time run out)
    onEndQuestion = () => {
        console.log('onEndQuestion:');
        dom.TLendQuestion()
        .add( () => {
            this.socket.emit('host:response');
        })
        .play();
    }

    //onEndRound
    // Note: this function must end with a host response to move to the next stage
    onEndRound = (round) => {
        console.log('onEndRound:', round);
        dom.TLendRound(round)
        .add( () => {
            this.socket.emit('host:response');
        })
        .play();
    }

    // onUpdateScores
    // Passed a new object containing the players and their new scores
    // Timeline updates the bars for each player using the racing-bars library
    onUpdateScores = (payload) => {
        console.log('onUpdateScores:', payload);
        dom.TLupdateScores(payload.scores)
        .add( () => {
            console.log('onUpdateScores:: race animation ended');
        });
    }

    // onEndQuiz
    // endRound should already have left the panels in a good state... only thing left here is to announce the winner...
    onEndQuiz = (results) => {
        console.log('onEndQuiz:', results);
        dom.TLendQuiz()
        .add( () => {
            this.socket.emit('host:response');
        })
        .play();
    }

    // OTHER MISCELLANEOUS EVENTS

    // onStartTimer
    // Simple function to display a timer on the screen which counts down
    // Nothing happens when the timer completes - this is just a visual timer
    // It is up to the server to determine what happens at the end of the timer period
    onStartTimer = (request) => {
        dom.DOMstartTimer(request);
    }


    // onLoadGame
    onLoadGame = (game) => {
        console.log('onLoadGame:');
        // const tl = dom.TLgameOver();
        // tl.add( () => {
        //     window.location.href = `./${game}.html`;
        // });
        // tl.play();
    }
    
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


// TASKS TO PERFORM OUTSIDE OF THE QUIZ CLASS


// Contact the socket.io socket server
// clientOptions can be used to pass things like username/password - see docs
// URL of undefined means io will connect to the window.location (suitable if hosting at same place as socket-server is running)
// import io from 'socket.io-client';
const clientOptions = {};

// Placing the init function inside window.onLoad is too late - for some reason a lot of code has already been called including building the display
window.onload = function() {

    // For development use a dummy socket object to simulate socket communication
    // If in development mode then use the dummy socket object
    // If in production mode then use the real socket object
    let socket;
    if (process.env.NODE_ENV === 'developmentX') {
        socket = new Socket();
    } else {
        socket = io();
    }
    const quiz = new Quiz(socket);

    // Add general keypress handler to send all keypresses to the server
    // This is a simple way to allow the host to control the game
    window.addEventListener('keydown', (e) => {
        console.log('keypress:', e.key);
        socket.emit('host:keypress', { key:e.key, shift:e.shiftKey, ctrl:e.ctrlKey, alt:e.altKey });
    });

    console.log('window.onload: completed:', socket);
};

class Socket {
    constructor() {
        this.socket = "Dummy socket server";
        this.connected = false;
        this.events = {};
    }

    on(event, callback) {
        console.log('Socket.on:', event);
        this.events[event] = callback;
    }
    emit(event, { eventObj }) {
        console.log('Socket.trigger:', eventObj.eventname, eventObj.payload);
        this.events[eventObj.eventname](eventObj.payload);
    }
    getSocket() {
        return this.socket;
    }
}
