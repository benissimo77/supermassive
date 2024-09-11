import { gsap } from 'gsap';
import viewModel from '../werewolves/vm.js';

// Not sure if a viewModel will be needed here - seems a bit overkill, but since its here I'll include for now
const vm = new viewModel();

// Global variable for holding useful data representing the game eg number of players
// This is updated by the server and used to update the game state
// Not sure if I'll use this in the end, or just rely on the server sending relevent data when needed   
var gameState = {
    nplayers: 0,
    playerScale: 1,
    started: false
}

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
    }
    vm.removeElement(socketid);
}


// DOMaddPlayer
// Accepts a player object and builds the HTML to make the player character
// This should not need to be created again - this function ONLY called when a new player joins
const DOMaddPlayer = function(player) {
    console.log('DOMaddPlayer:', player);
    var DOMplayer = document.getElementById(player.socketid);
    if (!DOMplayer) {
        DOMplayer = DOMcreatePlayer(player);
        document.body.appendChild(DOMplayer);    // Note: it will be re-parented later
        vm.addDOMElement(DOMplayer, 'document');
    }

    // Decide which container to place this player (might already be dead - then disconnected/reconnected)
    var container = 'playerlist';
    assignNewParent(DOMplayer, document.getElementById(container));
    return DOMplayer;
}

// DOMaddPlayers
// Sent to the host when they first connect - ONLY done in case there are already players in the room
// This ensures the host is fully caught up with all players in the room.
// After this the host will receive addplayer events for any new players
// During the game the separate event gamestate is used to move items around the screen
const DOMaddPlayers = function(playerlist) {
    var playerListDOM = document.getElementById("playerlist");
    playerListDOM.innerHTML = '';
    gameState.nplayers = 0;
    playerlist.forEach(player => {
        DOMaddPlayer(player);
    })
}


// TLarrangePlayersInPanel
// General-purpose function to set players to their 'home' state
// Passed a container panel (div) and arranges the player element in the panel based on the panel position and size
// player scale is determined using a reference width of 480px - so the player will be scaled to fit the panel
// Note: this only works for a vertical list at the moment, will need to be extended to handle horizontal lists
// Note: used to use getBoundingClientRect but this is not reliable - use the panel offset width and height instead
const TLarrangePlayersInPanelVertical = function(panel, align='top', distribute=false) {
    const DOMpanel = document.getElementById(panel);
    const players = vm[panel];
    const [playerStart, playerSpacing] = calculatePlayerPositions(players.length, DOMpanel.offsetHeight, align, distribute);
    const playerScale = DOMpanel.offsetWidth / 480;
    const tl = gsap.timeline();
    console.log('TLarrangePlayersInPanel:', panel, players, playerStart, playerSpacing);
    tl.addLabel("arrange")
    players.forEach( (player,index) => {
        tl.add( gsap.to(document.getElementById(player.id), {
            x: 0,
            y: playerStart + index * playerSpacing,
            'z-index': index,
            scale: playerScale,
            ease: "back.out(1.7)",
        }), "<+=0.1" );
    });
    return tl;
}

// TLarrangePlayersInPanelHorizontal
// Separate from above function since these elements must be arranged horizontally instead of vertically
function TLarrangePlayersInPanelHorizontal(panel) {
    const DOMpanel = document.getElementById(panel);
    const DOMplayers = vm[panel];
    const [playerStart, playerSpacing] = calculatePlayerPositions(DOMplayers.length, DOMpanel.offsetWidth, 'top', true);
    const playerScale = DOMpanel.offsetHeight / 120;    // don't use scale just keep same size
    const tl = gsap.timeline();
    DOMplayers.forEach( (player,index) => {
        tl.add( gsap.to(document.getElementById(player.id), {
            x: playerStart + index * playerSpacing,
            y: 0,
            'z-index':index,
            ease: "back.out(1.7)",
        }), "<" );
    });
    return tl;
}




// TLGameState
// General purpose function to layout the players based on the current game state
// Called at the beginning of each phase to set the screen ready for whatever comes next
// Beware that this function might get out of hand - break it down if needed!
function TLgameState() {
    // I used to use duration here to determine an overall speed - but better to use the timeline speed as it can be sped up to near-instant
    const tl = gsap.timeline();
    gsap.killTweensOf(".player");
    tl.add( TLarrangePlayersInPanelHorizontal("playerlist"));
    return tl;
}


function TLgameOver() {
    const tl = gsap.timeline();
    tl.to("#dayphase", { y: -1080 });
    tl.to("#nightphase", { y: -1080 }, "<+=0.5" );
    tl.to("#playerlist", { x: -1920 } );
    tl.to("body", { backgroundColor: "#051C55" });
    return tl;
}


// Recursive function keeps calling itself until width is small enough
// NOTE: not using this at the moment, CSS defines playername as overflow:ellipsis which is quite neat
// This function could be re-purposed for sizing the text in buttons to make them fit
function adjustPlayerNameSize(el, size=40) {
    gsap.set(el, { fontSize: size } );
    console.log(el.innerHTML, ":", screenToCanvasX(el.clientWidth));
    if (screenToCanvasX(el.clientWidth) > 500) {
        console.log('Changing font size for', el.innerHTML);
        adjustPlayerNameSize(el, size-1);
    }
}

// PANELS
// Organise content into different panels - absolute positioned divs that can be shown/hidden
// Making one panel active will automatically hide the others, so only one can be visible at any time
// panel-response: a panel with a READY button which must be clicked before the game can move on
// panel-info: a general panel for displaying information to the host, but no interaction
// panel-question: specific to quiz, a panel for displaying a question and the answers
function DOMsetActivePanel(panel) {
    const panels = document.querySelectorAll('.panel');
    panels.forEach(panel => panel.classList.remove('active'));
    document.getElementById(panel).classList.add('active');
}

function DOMhideAllPanels() {
    const panels = document.querySelectorAll('.panel');
    panels.forEach(panel => panel.classList.remove('active'));
}

// Maybe model the play.quiz.js pattern with a series of panels and activating one panel automatically hides the others
function DOMpanelResponse(instructions) {
    document.getElementById("panel-response-title").innerHTML = 'Welcome to the Quiz!';
    document.getElementById("panel-response-details").innerHTML = instructions;
    this.DOMsetActivePanel("panel-response");
}
function DOMpanelQuestion(question) {
    console.log('panelQuestion:', question);
    document.getElementById("question-number").innerHTML = "Question: " + question.number;
    document.getElementById("question").innerHTML = question.question;
    const buttonContainer = document.getElementById("answers");
    buttonContainer.innerHTML = '';
    question.answers.forEach( answer => {
        const button = document.createElement('button');
        // button.classList.add('answer');
        button.setAttribute('id', answer.id);
        button.innerHTML = answer.answer;
        buttonContainer.appendChild(button);
    });
    this.DOMsetActivePanel("panel-question");    
}


function setScale(s) {
    console.log('setScale (player):', s);
    gameState.playerScale = s;
    gsap.to(".player", { scale: s, duration:1 });
}

// HELPER FUNCTIONS

// assignNewParent
// Helper function to take a DOM elemet and move it to a new parent
// Adjusts the position of the element to maintain its position on the screen
// x coord uses getBoundingClientRect which gives direct coords on screen - no need to consider parent element
// y coord uses the data-x attribute which is relative to parent, so parent must be included in the calculation
// Key point: retrieving location via getBoundingClientRect returns screen coords - so do everything in screen coords and then translate to canvas coords
function assignNewParent(DOMelement, DOMnewParent) {
    const newRect = DOMnewParent.getBoundingClientRect();
    const x = screenToCanvasX( DOMelement.getBoundingClientRect().x - newRect.x );
    const y = screenToCanvasY( DOMelement.getBoundingClientRect().y - newRect.y );
    console.log('assignNewParent:', DOMelement.getBoundingClientRect().x, newRect.x, x, y);
    DOMnewParent.appendChild(DOMelement);
    gsap.set(DOMelement, {
        x: x,
        y: y
    })
    vm.assignNewParent(DOMelement, DOMnewParent.getAttribute('id'));
    console.log('assignNewParent VM:', DOMnewParent.getAttribute('id'), vm);
}


// calculatePlayerPositions
// Helper function to calculate the positions of elements within an area defined as totalSpace, topMargin and bottomMargin
// Uses the length of the array and the total space available to calculate the start position and spacing
// Elements can be aligned 'top','centre' or 'bottom' and can be distributed evenly (justified) or not
// Returns a tuple of the start position and the spacing between
function calculatePlayerPositions(n, totalSpace, align="centre", distribute=false) {
    const centreLine = totalSpace / 2;
    console.log('calculatePlayerPositions:', n, totalSpace, centreLine, align , distribute);
    let elementSpacing = totalSpace / Math.max(n, 1);    // Math.max prevents division by 0
    if (distribute === false) {
        elementSpacing = Math.min(160, elementSpacing);    // 160 is the maximum spacing when not distributing
    }
    let elementStart = centreLine - elementSpacing * (n-1)/2;
    if (align == 'top') {
        elementStart = 0;
    } else if (align == 'bottom') {
        elementStart = totalSpace - elementSpacing * (n-1);
    }
    return [elementStart, elementSpacing];
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

function setWindowScale(x, instant=true) {
    console.log('setWindowScale:', x, instant, document.getElementById("body"), gsap);
    if (instant) {
        console.log('Instant scale:', x);
        gsap.set("body", { scaleX: x, scaleY: x });
    } else {
        gsap.to("body", { scaleX: x, scaleY: x });
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

    // console.log('init:', vm);

    // Experiment with adding new functions for the intro eg change the background colour
    gsap.to("body", { backgroundColor: "#8080e0" });

    // quiz.hmtl includes a wrapper div which is set as display:none to prevent drawing before everything set up
    // now that everything is set up we can display the body
    gsap.set("#wrapper", { display: "block" });
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
    gsap.set("#playerlist", { top: canvasAdjustY(1040), height: canvasAdjustY(20) } );
    gsap.set("#panel-response", { top: canvasAdjustY(960), height: canvasAdjustY(60) } );
    gsap.set("#panel-question", { top: canvasAdjustY(90), height: canvasAdjustY(380) } );
    gsap.set("#panel-answers", { top: canvasAdjustY(520), height: canvasAdjustY(400) } );

    gsap.set("#timer", { top: canvasAdjustY(940), height: canvasAdjustY(40) } );

    // Test whether setting x,y via GSAP is different to specifying top,left in the CSS
    // YES it does make a difference - executeing gsap.set causes a translate3d to be added to the style, separate to the left/top
    // Short answer is that it's better to use GSAP to set x,y for elements that need to be moved
    // CSS can define positions of static (fixed) container elements
    // gsap.set("#test1", { x: 500, y:canvasAdjustY(540)});
    // gsap.set("#test2", { x:800, y:canvasAdjustY(980)});

    // This only in the test page - buttons to test all the actions
    gsap.set("#buttonlist", {
        y: canvasAdjustY(8),
        height: canvasAdjustY(20),
        scale: 1/scaleX,
    } );
}



  export const dom = {
    DOMaddPlayer,
    DOMaddPlayers,
    DOMremovePlayer,
    DOMsetActivePanel,
    DOMhideAllPanels,
    DOMpanelResponse,
    DOMpanelQuestion,
    TLarrangePlayersInPanel: TLarrangePlayersInPanelVertical,
    TLgameState,
    TLgameOver,
    init
  }

