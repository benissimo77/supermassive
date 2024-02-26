// DOMaddPlayer
// Accepts a player object and builds the HTML to make the player character
// This should not need to be created again - this function ONLY called when a new player joins
function DOMaddPlayer(player) {
    console.log('DOMaddPlayer:', player);
    var DOMplayer = DOMcreatePlayer(player);

    // Decide which container to place this player (might already be dead - then disconnected/reconnected)
    var container = document.getElementById('playerlist');
    if (player.alive == false) {
        if (player.killphase == 'Day') {
            container = document.getElementById('killedbyvillagers');
        } else {
            container = document.getElementById('killedbywolves');
        }
    }
    container.appendChild(DOMplayer);
    // adjustPlayerNameSize(DOMplayer.getElementsByClassName("playername")[0]);
    return DOMplayer;
}
function DOMcreatePlayer(player) {
    console.log('DOMcreatePlayer:', player);
    var DOMplayer = document.createElement('div');
    DOMplayer.setAttribute('class', 'player');
    DOMplayer.setAttribute('id', player.socketid);
    DOMplayer.innerHTML = `
        <div class="pixel"></div>
        <div class='avatar'>
            <img src="/img/avatar-200/image-from-rawpixel-id-${player.avatar}-original.png">
        </div>
        <div class="playernamepanel">
            <div class="playername">${player.name}</div>
        </div>
    `;
    return DOMplayer;
}
function DOMremovePlayer(socketid) {
    console.log('DOMremovePlayer:', socketid);
    var DOMplayer = document.getElementById(socketid);
    if (DOMplayer) {
        gsap.killTweensOf(DOMplayer);
        DOMplayer.remove();
    }
}
// addRandomMovement
// Accepts an element and generates a random tween to a new location - callback added to tween so that it repeats
function addRandomMovement(element) {
    gsap.to(element, {
        x: gsap.utils.random(0,1920),
        y: gsap.utils.random(0,1080),
        duration: gsap.utils.random(1,5,0.2),
        delay: gsap.utils.random(0,3,0.2),
        onComplete:addRandomMovement,
        onCompleteParams:[element]
    });
}


// Recursive function keeps calling itself until width is small enough
function adjustPlayerNameSize(el, size=40) {
    gsap.set(el, { fontSize: size } );
    console.log(el.innerHTML, ":", screenToCanvasX(el.clientWidth));
    if (screenToCanvasX(el.clientWidth) > 500) {
        console.log('Changing font size for', el.innerHTML);
        adjustPlayerNameSize(el, size-1);
    }
}


// Accepts a canvas position (1920x1080) and returns a translated position
function canvasToScreenX(x) {
    return Math.floor(x*window.innerWidth/1920);
}
// Y position is slightly harder since we only scale by width
function canvasToScreenY(y) {
    bodyScale = window.innerWidth / 1920;
    return Math.floor(y*window.innerHeight/(1080 * bodyScale));
}
function screenToCanvasX(x) {
    return Math.floor(x*1920/window.innerWidth);
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

    // Panel width will always be right because body scale ensures it fits, but height needs to be set as this can vary
    gsap.set("#largepanel", { top: canvasToScreenY(40), height: canvasToScreenY(980) } );
    gsap.set("#timer", { top: canvasToScreenY(900), height: canvasToScreenY(60) } );
}

window.onload=init();
