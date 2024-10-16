// Provide basic lobby display for users while waiting for game to start
// Change CSS to lobby-specific CSS at some point...
import gsap from 'gsap';


// DOMcreatePlayer
// Accepts a player object and creates the HTML for the player character
const DOMcreatePlayer = function(player) {
    // console.log('DOMcreatePlayer:', player);
    var DOMplayer = document.createElement('div');
    DOMplayer.setAttribute('class', 'player');
    DOMplayer.setAttribute('id', player.socketid);
    DOMplayer.setAttribute('name', player.name);
    DOMplayer.innerHTML = `
        <div class="pixel"></div>
        <div class='avatar'>
            <img src="/img/avatar-200/image-from-rawpixel-id-${player.avatar}-original.png">
        </div>
        <div class="voters"></div>
        <div class="playernamepanel">
            <div class="playername">${player.name}</div>
        </div>
    `;
    return DOMplayer;
}

// DOMremovePlayer
// Accepts a socketid and removes the player from the DOM - executes on a socket disconnect event
function DOMremovePlayer(socketid) {
    console.log('DOMremovePlayer:', socketid);
    var DOMplayer = document.getElementById(socketid);
    if (DOMplayer) {
        gsap.killTweensOf(DOMplayer);
        DOMplayer.remove();
    } else {
        console.log('DOMremovePlayer: player not found:', socketid);
    }
}


// DOMaddPlayer
// Accepts a player object and builds the HTML to make the player character
// This should not need to be created again - this function ONLY called when a new player joins
const DOMaddPlayer = function(player) {
    // console.log('DOMaddPlayer:', player);
    const playerListDOM = document.getElementById("playerlist");
    var DOMplayer = document.getElementById(player.socketid);
    if (!DOMplayer) {
        DOMplayer = DOMcreatePlayer(player);
        playerListDOM.appendChild(DOMplayer);
    }
    addRandomMovement(DOMplayer);
}

// DOMaddPlayers
// Sent to the host when they first connect - ONLY done in case there are already players in the room
// This ensures the host is fully caught up with all players in the room.
// After this the host will receive addplayer events for any new players
// During the game the separate event gamestate is used to move items around the screen
const DOMaddPlayers = function(playerlist) {
    console.log('DOMaddPlayers:', playerlist);
    var playerListDOM = document.getElementById("playerlist");
    playerListDOM.innerHTML = '';
    playerlist.forEach(player => {
        DOMaddPlayer(player);
    })
}

// DOMaddRoomName
// Accepts a room name and adds it to the DOM
const DOMaddRoomName = function(room) {
    console.log('DOMaddRoomName:', room);
    var roomNameDOM = document.getElementById("instructions-room").querySelector('.roomname');
    roomNameDOM.innerHTML = room;
}

// addRandomMovement
// Accepts an element and generates a random tween to a new location - callback added to tween so that it repeats
// Note although the canvas is 1920x1080 we adjust x and y range to allow for the width and height of the player
function addRandomMovement(element) {
    console.log('addRandomMovement:', element.getAttribute('id') );
    gsap.to(element, {
        x: gsap.utils.random(0,1820),
        y: canvasAdjustY( gsap.utils.random(80,1080) ),
        duration: gsap.utils.random(2,5,0.2),
        delay: gsap.utils.random(0,3,0.2),
        onComplete: addRandomMovement,
        onCompleteParams:[element]
    });
}

function setWindowScale(x) {
    console.log('setWindowScale:', x);
    gsap.to("body", { scaleX: x, scaleY: x })
}

// Function copied from gsap site - useful utility function
function callAfterResize(func, delay) {
    console.log('callAfterResize:');
    let dc = gsap.delayedCall(delay || 0.2, func).pause(),
    handler = () => dc.restart(true);
    window.addEventListener("resize", handler);
    return handler; // in case you want to window.removeEventListener() later
}

function init() {
    screenSizeBody();
    callAfterResize(screenSizeBody, 0.2);

    console.log('init:');
}

// Canvas to Screen / Screen to Canvas
// Set coordinates using the canvas scale - BODY scale ensures it is displayed correctly
// When reading positions of elements on the screen they need to be converted to canvas coords - simply divide by the body scale
function screenToCanvasX(x) {
    const bodyScale = window.innerWidth / 1920;
    return x / bodyScale;
}
function screenToCanvasY(y) {
    const bodyScale = window.innerWidth / 1920;
    return y / bodyScale;
}

// ... and the only one we need to be careful of is when aspect ratio is not 16:9
// canvas Y coord must be adjusted to account for the different window height
function canvasAdjustY(y) {
    const bodyScale = window.innerWidth / 1920;
    return Math.floor(y / bodyScale * window.innerHeight / 1080);
}

// Adjust the scale of the BODY tag and then everything uses 1920,1080 scale for positioning
// This ensures content will scale neatly - only problem is the total height of screen is variable
// Use scale function to calculate Y positions so it will scale all the way to the bottom of the visible screen
function screenSizeBody() {
    // do nothing - try without using any kind of global scale
    // Hmmm - I definitely need something otherwise could be a mess
    // Copy from below but don't use the screenOffset just scale x and y independently
    const windowInnerWidth  = window.innerWidth;
    const windowInnerHeight = window.innerHeight;
    console.log('Viewport:', windowInnerWidth, windowInnerHeight);
    const scaleX = window.innerWidth / 1920;
    setWindowScale(scaleX);

}

init();


document.getElementById("buttonHostComplete").addEventListener('click', function() {
    console.log('buttonHostComplete');
    socket.emit('host:ready');
});
document.getElementById("buttonQuiz").addEventListener('click', function() {
    console.log('buttonQuiz');
    socket.emit('host:requestgame', 'quiz');
});
document.getElementById("buttonWerewolves").addEventListener('click', function() {
    console.log('buttonWerewolves:', socket);
    socket.emit('host:requestgame', 'werewolves');
});
document.getElementById("buttonTest").addEventListener('click', function() {
    console.log('Host:: buttonTest: ', socket);
    socket.emit('buttontest', 'test');
});



// Add client socket event handlers
const onConnect = function () {
    console.log('onConnect:', socket.connected);
}
const onDisconnect = function () {
    console.log('onDisconnect:', socket.connected);
}
const onHostConnect = function (room, players) {
    console.log('onHostConnect:', socket.connected, room, players);
    DOMaddRoomName(room);
    DOMaddPlayers(players);
}

const onPlayerConnect = function(player) {
    console.log('onPlayerConnect:', player);
    DOMaddPlayer(player);
}
const onPlayerDisconnect = function(socketid) {
    console.log('onPlayerDisconnect:', socketid);
    DOMremovePlayer(socketid);
}

// Contact the socket.io socket server
// clientOptions can be used to pass things like username/password - see docs
// URL of undefined means io will connect to the window.location (suitable if hosting at same place as socket-server is running)
// import io from 'socket.io-client';
const clientOptions = {};
const socket = io();

// Add client socket events listeners
// First two are default events provided by socket server... adding here just for completeness
socket.on('connect', onConnect);
socket.on('disconnect', onDisconnect);

socket.on('hostconnect', onHostConnect);
socket.on('playerconnect', onPlayerConnect);
socket.on('playerdisconnect', onPlayerDisconnect);
socket.on('server:loadgame', (game) => {
    console.log('server:loadgame:', game);
    history.pushState({ game: `${game}` }, '', `/host/${game}.html`);
    window.location.href = `${game}.html`;
})

