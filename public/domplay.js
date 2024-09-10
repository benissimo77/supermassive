// DOMaddPlayer
// Accepts a player object and builds the HTML to make the player character
// This should not need to be created again - this function ONLY called when a new player joins
function DOMaddPlayer(player) {
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
    document.getElementById('playercontainer').appendChild(playerDOM);
    init(); // this will scale the player div to the correct size
}

function DOMplayerRole(role) {

    // fill out the role panel and make the role button visible so user can see their role
    document.getElementById('panel-role').innerHTML = `
        Your role:<br/><br/>${role}
        `;
    document.getElementById('role').style.display = 'none';
    document.getElementById('rolebutton').style.display = 'block';
    // This is a hack because its not technically part of the role action - but a good moment to clear the current content
    document.getElementById('content').innerHTML = '';
}

function buttonRolePress(e) {
    console.log('buttonRolePress');
    document.getElementById('panel-role').style.display = 'block';
    document.getElementById('content').style.display = 'none';
}
function buttonRoleRelease() {
    console.log('buttonRoleRelease');
    document.getElementById('role').style.display = 'none';
    document.getElementById('content').style.display = 'block';
}

function DOMbuttonSelect(buttons) {
    var contentDOM = document.getElementById("content");
    contentDOM.innerHTML = '';
    timer.clear();
    buttons.forEach(button => {
        buttonDOM = document.createElement("button");
        if (button.socketid) buttonDOM.setAttribute("id", button.socketid);
        buttonDOM.innerHTML = button.name;
        contentDOM.appendChild(buttonDOM);
        buttonDOM.addEventListener('click', (e) => {
            ret = { socketid:e.currentTarget.id, name: e.currentTarget.innerHTML };
            socket.emit('client:response', ret );
            // Experiment with putting the confirmation directly here without requiring the trip to the server - more responsive
            DOMtimedMessage({ message: 'You selected:<br/><br/>' + ret.name, timer: 3 });
        })
    })
}
function DOMtimedMessage(payload) {
    console.log('DOMtimedMessage:', payload);
    var contentDOM = document.getElementById("content");
    contentDOM.innerHTML = payload.message;
    timer.start(payload.timer, () => { contentDOM.innerHTML = ''; });
}


// Accepts a canvas position (720x1440) and returns a translated position
function canvasToScreenX(x) {
    return Math.floor(x*window.innerWidth/720);
}
// Y position is slightly harder since we only scale by width
function canvasToScreenY(y) {
    const bodyScale = window.innerWidth / 720;
    return Math.floor(y*window.innerHeight/(1440 * bodyScale));
}
function screenToCanvasX(x) {
    return Math.floor(x*720/window.innerWidth);
}

function setAvatarScale(x) {
    // console.log('setAvatarScale:', x);
    gsap.to(".player", { scaleX: x, scaleY: x })
}

const timer = {
    id: null,
    clear: function() {
        clearTimeout(this.id);
    },

    start: function(delaySeconds, fn) {
        this.clear();
        this.id = setTimeout(fn, delaySeconds * 1000);
    }
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

// Adjust the scale of the BODY tag and then everything uses 720x1440 scale for positioning
// This ensures content will scale neatly - only problem is the total height of screen is variable
// Use scale function to calculate Y positions so it will scale all the way to the bottom of the visible screen
function screenSizeBody() {
    // do nothing - try without using any kind of global scale
    // Hmmm - I definitely need something otherwise could be a mess
    // Copy from below but don't use the screenOffset just scale x and y independently
    const windowInnerWidth  = window.innerWidth;
    const windowInnerHeight = window.innerHeight;
    // console.log('PLAY:: Viewport:', windowInnerWidth, windowInnerHeight);
    const scaleX = window.innerWidth / 720;
    setAvatarScale(scaleX);
}

// Use the scale function just to scale the player avatar
window.onload=init();
