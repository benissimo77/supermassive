// General scratch JS file for testing with GSAP and DOM manipulation
// Copy functions from here into other JS files for use in games

// This variable is defined in socket-host.js but include here since I want to test in isolation...
var gameState = {
    playerScale:1,
}

var ting;
// Function copied from gsap site - useful utility function
function callAfterResize(func, delay) {
    console.log('callAfterResize:', func, delay);
    let dc = gsap.delayedCall(delay || 0.2, func).pause(),
    handler = () => dc.restart(true);
    window.addEventListener("resize", handler);
    return handler; // in case you want to window.removeEventListener() later
}

function init() {
    screenSizeBody();
    ting = new Audio('audio/ting1.mp3');
    // gsap.registerPlugin(Draggable);
    // Draggable.create("#playerlist");
    gsap.registerPlugin(MotionPathPlugin)
    adjustPlayerNameSizes();
    callAfterResize(screenSizeBody);
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
}
// OLd version of screen size which adjust container to provide fit:cover type functionality
// Don't like this...
function screenSizeContainer() {
    const windowInnerWidth  = window.innerWidth;
    const windowInnerHeight = window.innerHeight;
    console.log('Viewport:', windowInnerWidth, windowInnerHeight);
    const scaleX = window.innerWidth / 1920;
    const scaleY = window.innerHeight / 1080;
    if (Math.abs(scaleX - scaleY) < 0.1) {
        console.log('scales are similar - stretch to fit');
        setWindowScale(scaleX, scaleY);
        // setWindowOffset(0,0);
    } else {
        console.log('scales are different, add vert/horiz space:', scaleX, scaleY);
        // use the scale closest to 1 as the main one - other dimension gets scaled and adjusted
        if (Math.abs(scaleX-1) < Math.abs(scaleY-1)) {
            const adjustY = (window.innerHeight - 1080 * scaleX ) / 2;
            setWindowScale(scaleX, scaleX);
            setWindowOffset(0, adjustY);
        } else {
            const adjustX = (window.innerWidth * scaleY - 1920) / 2;
            setWindowScale(scaleY, scaleY);
            // setWindowOffset(adjustX, 0);
        }
    }
}
function toX(x) {
    console.log('toX:', x, gameState.windowScaleX);
    stagger = {
        // wrap advanced options in an object
        each: 0.2,
        from: "center",
        grid: "auto",
        ease: "power2.inOut",
    }
    gsap.to(".player", { x: canvasToScreenX(x, gameState.windowScaleX), duration:3, stagger: stagger });
}
function toY(y) {
    console.log('toY:', y);
    gsap.to(".player", { y: canvasToScreenY(y, gameState.windowScaleY), stagger: 0.4, duration: 4, onComplete: toYComplete })
}
function fromX(x) {
    console.log('fromX:', x);
    gsap.from(".player", { x:canvasToScreenX(x, gameState.windowScaleX), duration: 3 })
}
function setXY(x,y) {
    console.log('setXY:', x, y);
    gsap.set(".player", { x:canvasToScreenX(x, gameState.windowScaleX), y:canvasToScreenY(y, gameState.windowScaleY) })
}
function listToX(x) {
    console.log('listToX:', x);
    gsap.to("#playerlist", { x: canvasToScreenX(x), duration:3 });
}
function setScale(s) {
    console.log('setScale (player):', s);
    gameState.playerScale = s;
    gsap.to(".player", { scale: s, duration:1 });
}
function setAvatarScale(s) {
    console.log('setAvatarScale:', s);
    gsap.to(".avatar img", { scale: s, duration:1})
}
function setKilledScale(s) {
    console.log('killedScale:', s);
    gameState.killedByWolvesScale = s;
    gsap.to('#killedbywolves', { scale: s} );
}
function setWindowScale(x,y) {
    console.log('setWindowScale:', x, y);
    gameState.windowScaleX = x;
    gameState.windowScaleY = y;
    gsap.to("body", { scaleX: x, scaleY: y })
}
function setWindowOffset(x,y) {
    console.log('setWindowOffset:', x, y);
    gsap.to("#container", { left:x, top:y })
}
function toYComplete() {
    console.log('Tween toY complete');
    ting.play();
}
// Layout living players in a simple list
// Always set the z as well to ensure lower down screen appear above others
function layoutPlayersListOld() {
    const startX = 100;
    const startY = 150;
    gsap.to(".player",
    {
        x: canvasToScreenX(startX),
        y: (index,target,targets) => { return canvasToScreenY(startY + index*100) },
        z: (index,target,targets) => { return index },                    
        ease: "elastic.out(1,0.3)",
        stagger:0.4,
        duration:2
    });
}
// Trying using a pre-defined timeline - this allows it to be nested inside other timelines
function layoutPlayersList() {
    const startX = 10;
    const startY = 150;
    var layout_list = gsap.timeline();
    layout_list.to("#playerlist .player",
    {
        x: canvasToScreenX(startX),
        y: (index,target,targets) => { return canvasToScreenY(startY + index*100) },
        z: (index,target,targets) => { return index },                    
        ease: "elastic.out(1,0.3)",
        stagger:0.4,
        duration:2
    });
}


function layoutPlayersCircle() {
    // gsap.set("#playerlist .playernamepanel", { opacity: 0 });
    console.log('layoutPlayersCircle');
    var enter_circle = gsap.timeline();
    enter_circle.to("#playerlist", { x: canvasToScreenX(640), y:canvasToScreenY(540), ease:"none", duration:3 } );
    enter_circle.to("#playerlist .player", {
        x: (index,target,targets) => { 
            console.log(index, targets.length, Math.sin(index * 2 * Math.PI / targets.length));
            return 300*Math.sin( index * 2*Math.PI / targets.length);
        }, 
        y: (index,target,targets) => {
            return 300*Math.cos( index * 2*Math.PI / targets.length)
        },
        duration: 3,
    }, "<" );
}
var spinCircle = true;
function startSpinPlayersCircle() {
    console.log('startSpinPlayersCircle');
    const duration = 3;
    spinCircle = true;
    var spin_circle = gsap.timeline();
    spin_circle.to("#playerlist", {
        rotation: 360, duration:duration, ease:"none", onComplete: () => {
            console.log('spin_circle complete:');
            if (spinCircle) {
                spin_circle.restart();
            }
        }
    });
    spin_circle.to("#playerlist .player", { rotation: -360, duration:duration, ease:"none" }, "<");
    spin_circle.to("#playerlist", { x: 0, y: 0, onStart: layoutPlayersList } );
    spin_circle.restart();
}
function stopSpinPlayersCircle() {
    spinCircle = false;
}
function playerKilledByWolves() {
    // Just choose the first item of the players list for now...
    const el = document.querySelector("#playerlist .player");
    console.log('playerKilledByWolves:', el, canvasToScreenX(1920));

    // Timeline animation for this since a few different things happening BUT will never need to repeat or interrupt
    // so should be safe for a basic timeline animation
    tl = gsap.timeline();
    tl.to(el, {
        x: canvasToScreenX(980),
        y: canvasToScreenY(580),
        scale: 2,
        duration: 2,
        ease: "ease:out"
    })
    tl.set(el.getElementsByClassName("avatar"), { alpha:0.5 } )
    tl.to(el, {
        x: canvasToScreenX(1620),
        y: canvasToScreenY(100),
        scale: 0.5,
        onComplete: () => {
            document.getElementById("playerlist").removeChild(el);
            document.getElementById("killedbywolves").appendChild(el);
        }
    } );
}

function adjustPlayerNameSizes() {
    // calculate a maximum width for the player name based around a notional panel width of 600px width
    // 10px gutter on either side of panel, 100px margin left 20px right = 140px
    // Therefore 600-140 = 460 max width
    const maxWidth = canvasToScreenX(460);
    const defaultFontSize = 40;
    // First set the font size to the standard 40px and THEN measure its width
    gsap.set(".playername", { fontSize: defaultFontSize });
    gsap.set(".playername", { fontSize: (index, target, targets) => {
        ret = target.clientWidth > maxWidth ? gsap.utils.snap(0.05, (maxWidth / target.clientWidth)) : 1;
        console.log('adjustPlayerNameSizes:', ret, target.clientWidth);
        return 40 * ret; 
        }
    })
}


// ADDITIONAL SUPPORT FUNCTIONS
// Accepts a canvas position (1920x1080) and returns a translated position
// Functions accept an optional scale parameter - allows use with scaled elements
// UPDATE: We now scale BODY directly which means x can fix at 0-1920
// y will then be variable height but scaled to same proportion as x
function canvasToScreenX(x, scale=1) {
    // return Math.floor( x * window.innerWidth / 1920 );
    return x;
}
// CURRENT version scaling based on screen width and then adjust Y position using the width scale
function canvasToScreenY(y, scale=1) {
    return Math.floor( y * 1920 / window.innerWidth );
}
function screenToCanvasX(x, scale=1) {
    // return Math.floor( x * 1920 * scale / window.innerWidth );
    return x;
}

window.onload=init();
