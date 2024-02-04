// DOMaddPlayer
// Accepts a player object and builds the HTML to make the player character
// This should not need to be created again - this function ONLY called when a new player joins
function DOMaddPlayer(player) {
    console.log('DOMaddPlayer:', player);
    var playerDOM = document.createElement('div');
    playerDOM.setAttribute('class', 'player');
    playerDOM.setAttribute('id', player.socketid);
    playerDOM.innerHTML = `
        <div class="pixel"></div>
        <div class='avatar'>
            <img src="/img/avatar-200/image-from-rawpixel-id-${player.avatar}-original.png">
        </div>
        <div class="playernamepanel">
            <div class="playername">${player.name}</div>
        </div>
    `;
    document.getElementById('playerlist').appendChild(playerDOM);
    moveToBottomLeftCorner(playerDOM);
}
// addRandomMovement
// Accepts an element and generates a random tween to a new location - callback added to tween so that it repeats
function moveToBottomLeftCorner(element) {
    gsap.to(element, {
        x: canvasToScreenX(gsap.utils.random(0, 1920)),
        y: canvasToScreenY(gsap.utils.random(0, 1080)),
        duration: gsap.utils.random(1,5,0.2),
        delay: gsap.utils.random(0,3,0.2),
        onComplete:moveToBottomLeftCorner,
        onCompleteParams:[element]
    });
}
function toX(x) {
    console.log('toX:', x);
    stagger = {
        // wrap advanced options in an object
        each: 0.2,
        from: "center",
        grid: "auto",
        ease: "power2.inOut",
        repeat: 3, // Repeats immediately, not waiting for the other staggered animations to finish
    }
    gsap.to(".player", { x: canvasToScreenX(x), duration:3, stagger: stagger });
}
function toY(y) {
    console.log('toY:', y);
    gsap.to(".player", { y: canvasToScreenY(y), stagger: 0.4, duration: 4, onComplete: toYComplete })
}
function fromX(x) {
    console.log('fromX:', x);
    gsap.from(".player", { x:canvasToScreenX(x), duration: 3 })
}
function setXY(x,y) {
    console.log('setXY:', x, y);
    gsap.set(".player", { x:canvasToScreenX(x), y:canvasToScreenY(y) })
}
function setScale(s) {
    console.log('setScale:', s);
    gsap.to("#playerlist", { scale: s, stagger:0.5 });
}
function setAvatarScale(s) {
    console.log('setAvatarScale:', s);
    gsap.to(".avatar img", { scale: s, duration:1})
}

function toYComplete() {
    console.log('Tween toY complete');
    ting.play();
}
function layoutPlayers(players) {
    console.log('layoutPlayers:', players);
    gsap.killTweensOf(players);
    gsap.to(players,
    {
        x: canvasToScreenX(100),
        y: (index,target,targets) => { return canvasToScreenY(200+index*100) },                     
        ease: "elastic.out(1,0.3)",
        stagger:0.4,
        duration:2
    });
}
// Recursive function keeps calling itself until width is small enough
function adjustPlayerNameSize(el, size) {
    gsap.set(el, { fontSize: size } );
    console.log(screenToCanvasX(el.clientWidth));
    if (screenToCanvasX(el.clientWidth) > 500) {
        console.log('Changing font size for', el.innerHTML);
        adjustPlayerNameSize(el, size-1);
    }
}
function adjustPlayerNameSizes() {
    console.log('adjustPlayerNameSizes:');
    const els = document.getElementsByClassName("playername");
    console.log('playernames:', els);
    [...els].forEach( (el) => {
        adjustPlayerNameSize(el, 40);
    });
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

function setWindowScale(x,y) {
    console.log('setWindowScale:', x, y);
    gsap.to("body", { scaleX: x, scaleY: y })
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

    // // Experiment with audio files...
    ting = new Audio('audio/ting1.mp3');
    // gsap.registerPlugin(Draggable);
    // Draggable.create("#playerlist");
    // gsap.registerPlugin(MotionPathPlugin)
    // Next line should be done at the time of the player being added NOT in one function...
    // adjustPlayerNameSizes();
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
    setWindowScale(scaleX, scaleX);

    // To ensure the panel is the correct size - set left, top and height
    gsap.set("#largepanel", { top: canvasToScreenY(50), height: canvasToScreenY(980) } );
    gsap.set("#timer", { top: canvasToScreenY(900), height: canvasToScreenY(60) } );
}

window.onload=init();
