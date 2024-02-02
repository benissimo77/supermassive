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
function onDisconnect(reason) {
console.log('onDisconnect:', reason);
}
function onFoo(value) {
console.log('onFoo', value);
}

// onPlayerList
// Sent to the host when they first connect - ONLY done in case there are already players in the room
// This ensures the host is fully caught up with all players in the room.
// After this the host will receive addplayer events for any new players
// During the game the separate event gamestate is used to move items around the screen
function onPlayerList(playerlist) {
    console.log('onPlayerList:', playerlist);

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
        stagger:0.4,
        duration:duration
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
function onAddPlayer(player) {
    console.log('onAddPlayer:', player);
    DOMaddPlayer(player);
    gameState.nplayers++;
}
function onWolfKill(socketid) {
    console.log('onWolfKill:', socketid);
    el = document.getElementById(socketid);

    // Try dropping in the function below created in gsap.js for this...
    playerKilledByWolves(el);
    // gsap.to(el, {
    //     x: canvasToScreenX(760),
    //     y: canvasToScreenY(540),
    //     scale: 1.5,
    //     onComplete: () => {
    //         killedbywolves = document.getElementById('killedbywolves');
    //         killedbywolves.appendChild(el);
    //         el.classList.add("dead");
    //         socket.emit('hostready');
    //     }
    //  } );
}
function playerKilledByWolves(el) {

    // Timeline animation for this since a few different things happening BUT will never need to repeat or interrupt
    // so should be safe for a basic timeline animation
    tl = gsap.timeline();
    tl.to(el, {
        x: canvasToScreenX(980),
        y: canvasToScreenY(580),
        scale: 2,
        duration: 2,
        ease: "ease:out",
        onComplete: () => {
            killedbywolves = document.getElementById('killedbywolves');
            killedbywolves.appendChild(el);
            el.classList.add("dead");
            // directly change the position to align with new container - note we hardcode 1600 for now
            newX = canvasToScreenX(980) - 1600;
            gsap.set(el, {x: newX });
            socket.emit('hostready');
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

// Contact the socket.io socket server
// clientOptions can be used to pass things like username/password - see docs
// URL of undefined means io will connect to the window.location (suitable if hosting at same place as socket-server is running)
clientOptions = {};
const socket = io();

console.log('socket-host.js:: Hello:', URL, window.location.host, location.hash);

// Add client socket events listeners
socket.on('connect', onConnect);
socket.on('disconnect', onDisconnect);
socket.on('foo', onFoo);
socket.on('playerlist', onPlayerList);
socket.on('gamestate', onGameState);
socket.on('addplayer', onAddPlayer);
socket.on('wolfkill', onWolfKill);
socket.on('startgame', onStartGame);
socket.on('server:starttimer', onStartTimer);
