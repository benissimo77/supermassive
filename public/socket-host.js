const URL = '/host';

// Global variable for holding useful data representing the game eg number of players
var gameState = {
    nplayers: 0,
    playerScale: 1
}



// Event handlers for socket.io events
// onStartGame
// Sent to the host when the game is started - display instructions on screen (these must be removed)
// players will receive their own instructions
// Host will receive a gamestate event after this to update the player positions
// Maybe this gamestate event should be responsible for removing the instructions ?
// For now provide a button which will remove instructions and send a hostready event to move to next stage
function onStartGame() {
    console.log('socket-host: onStartGame');
    el = document.getElementById("largepanelcontent");
    el.innerHTML = `
    <h1>Game Started</h1>
        <p>Instructions for the game go here</p>
        <ul>
        <li>
            Don't let anyone see your screen!
        </li>
        <li>
            Press 'ROLE' button to see your role
        </li>
        <li>
            Release 'ROLE'button to hide your role
        </li>
    </ul>
<button onclick='buttonReady()'>Ready</button>
    `;
    gsap.to("#largepanel", { display: visible });
}
function onConnect() {
    console.log('onConnect:', socket.connected);
  }
function onDisconnect(socketid) {
    console.log('onDisconnect:', socketid);
    DOMremovePlayer(socketid);
}
function onFoo(value) {
console.log('onFoo', value);
}

// onPlayerList
// Debugging - output playerlist to console
// Done by host to get nicer layout of playerlist data
function onPlayerList(playerlist) {
    console.log('onPlayerList:', playerlist);
}

// onPlayersInRoom
// Sent to the host when they first connect - ONLY done in case there are already players in the room
// This ensures the host is fully caught up with all players in the room.
// After this the host will receive addplayer events for any new players
// During the game the separate event gamestate is used to move items around the screen
function onPlayersInRoom(playerlist) {
    console.log('onPlayersInRoom:', playerlist);
    var playerListDOM = document.getElementById("playerlist");
    console.log(playerListDOM);
    playerListDOM.innerHTML = '';
    gameState.nplayers = 0;
    Object.keys(playerlist).forEach(key => {
        player = playerlist[key];
        console.log(player);
        DOMaddPlayer(player);
    })
}

// onAudioPlay
// Sent by the server to begin playing audio
// Object is an audio type and the track
// Invokes the AudioManager class to play the track
function onAudioPlay(audio) {
    console.log('onAudioPlay:', audio, narratorTracks[audio.track]);
    switch (audio.type) {

        case 'NARRATOR':
            audioManager.playTrack(narratorTracks[audio.track]);
            break;

        case 'EFFECTS':
            audioManager.playTrack(effectTracks[audio.track]);
            break;

        case 'MUSIC':
            audioManager.playTrack(musicTracks[audio.track]);
            break;

    }
}
// gameState is currently an array of players - this represents everything needed (for now)
// This is sent to the host after each round to update the player positions
function onGameState() {
    // set a global duration that I can change one time for all animations
    duration = 2;
    console.log('onGameState :');
    gsap.killTweensOf(".player");
    gsap.to("#playerlist .player", {
        x: canvasToScreenX(100),
        y: (index,target,targets) => { return canvasToScreenY(200+index*100) },
        z: (index,target,targets) => { return index },
        scale: 1,
        stagger:0.4,
        duration:duration,
        onComplete: () => {
            audioManager.fadeOut(musicTracks.MUSIC, 2);
        }

    });
    gsap.to("#killedbywolves .player", {
        x: canvasToScreenX(0),
        y: (index,target,targets) => { return canvasToScreenY(200+index*100) },
        z: (index,target,targets) => { return index },               
        scale: 0.8,
        stagger:0.4,
        duration:duration
    });
    gsap.to("#killedbywolves .player img", {
        alpha: 0.6,
        duration:duration
    });
    gsap.to("#killedbyvillagers .player", {
        x: canvasToScreenX(0),
        y: (index,target,targets) => { return canvasToScreenY(200+index*100) },
        z: (index,target,targets) => { return index },               
        scale: 0.8,
        stagger:0.4,
        duration:duration
    });
    
}

function onMorning() {
    audioManager.playTrack(musicTracks.MORNING);
    audioManager.playTrack(narratorTracks.WAKEUP);
}
function onAddPlayer(player) {
    console.log('onAddPlayer:', player);
    DOMaddPlayer(player);
    gameState.nplayers++;
}
function onDayKill(dead) {
    console.log('onDayKill:', dead);
    doDeathAnimation([dead], "killedbyvillagers");
}
function onNightKill(dead) {
    console.log('onNightKill:', dead);
    doDeathAnimation(dead, "killedbywolves");
}
function onDayDraw(candidates) {
    console.log('onDayDraw:', candidates);
    doDeathAnimation(candidates, "playerlist");
}
function doDeathAnimation(dead, container) {
    // Timeline animation for this since a few different things happening BUT will never need to repeat or interrupt
    // so should be safe for a basic timeline animation
    const elements = dead.map( (id) => document.getElementById(id) );
    tl = gsap.timeline();
    tl.to(elements, {
        x: canvasToScreenX(980),
        y: (index, target, targets) => canvasToScreenY(480 + index*180),
        scale: 2,
        duration: 2,
        ease: "ease:out",
        stagger: 0.5,
        onComplete: (params) => {
            console.log('onComplete:', this, this.target, params);
            const DOMcontainer = document.getElementById(container);
            elements.forEach( (element) => {
                DOMcontainer.appendChild(element);
                element.classList.add("dead");
            })
            // directly change the position to align with new container - note we hardcode 1600 for now
            newX = canvasToScreenX(980) - DOMcontainer.getBoundingClientRect().left;
            console.log('ClientRect:', canvasToScreenX(980), DOMcontainer.getBoundingClientRect(), newX);
            gsap.set(elements, {x: newX });
            // socket.emit('host:response');
            // call onGameState directly since we are not waiting for a socket event
            onGameState();
        }
    })
}
function onStartTimer(request) {
    console.log('onStartTimer:', request);
    gsap.set("#timer", { display: "block" });
    gsap.fromTo("#timer .timer_progress", { width: "100%" }, { 
        width: 0,
        duration: request.duration,
        ease: "linear",
        onComplete: () => {
        gsap.set("#timer", {display: "none"});
    }});
}

function DOMinstructions(payload) {
    console.log('DOMinstructions:', payload);
    const content = document.getElementById("instructions-content");
    content.innerHTML = payload.message;
    gsap.to("#instructions", { display: "block" });
}

// onServerRequest - general purpose function which handles all/most server requests in a generic way
// onServerRequest always responds with a host:response event to the server
function onServerRequest(request) {
	switch (request.type) {

		case 'instructions':
			DOMinstructions(request.payload);
			break;

		case 'message':
			DOMmessage(request.payload);
			break;

		case 'timedmessage':
			DOMtimedMessage(request.payload);
			break;
	}
}


// Contact the socket.io socket server
// clientOptions can be used to pass things like username/password - see docs
// URL of undefined means io will connect to the window.location (suitable if hosting at same place as socket-server is running)
clientOptions = {};
const socket = io();

console.log('socket-host.js:: Hello:', URL, window.location.host, location.hash);

// Add client socket events listeners
socket.on('connect', onConnect);
socket.on('disconnect', onDisconnect);
socket.on('playerdisconnect', () => { console.log('playerdisconnect:')} );
socket.on('foo', onFoo);
socket.on('playerlist', onPlayerList);
socket.on('playersinroom', onPlayersInRoom);
socket.on('audioplay', onAudioPlay);
socket.on('morning', onMorning);
socket.on('gamestate', onGameState);
socket.on('addplayer', onAddPlayer);
socket.on('nightkill', onNightKill);
socket.on('daykill', onDayKill);
socket.on('daydraw', onDayDraw);
socket.on('startgame', onStartGame);
socket.on('server:starttimer', onStartTimer);
socket.on('server:request', (request) => {
    console.log('server:request:', request.type);
    onServerRequest(request);
})
