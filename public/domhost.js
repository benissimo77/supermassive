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
function DOMcreatePlayer(player) {
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
function DOMaddPlayer(player) {
    // console.log('DOMaddPlayer:', player);
    var DOMplayer = document.getElementById(player.socketid);
    if (!DOMplayer) {
        DOMplayer = DOMcreatePlayer(player);
        document.body.appendChild(DOMplayer);    // Note: it will be re-parented later
        vm.addDOMElement(DOMplayer, 'document');
        gameState.nplayers++;
    }


    // If player has (re-)joined mid-game then they need to join with the current gameState, otherwise just add random movement
    // slight difference to usual architecture - DOM functions return a timeline to be appended to the main timeline
    // in this case the function returns the created player - so instead of returning the timeline we just play it immediately
    if (gameState.started) {

        // Decide which container to place this player (might already be dead - then disconnected/reconnected)
        var container = 'playerlist';
        if (player.alive == false) {
            if (player.killphase == 'Day') {
                container = 'killedbyvillagers';
            } else {
                container = 'killedbywolves';
            }
        }
        assignNewParent(DOMplayer, document.getElementById(container));
        // DOMarrangePlayersInPanel(container).play();
        onGameState();

    } else {
        addRandomMovement(DOMplayer);
    }
    return DOMplayer;
}

// DOMaddPlayers
// Sent to the host when they first connect - ONLY done in case there are already players in the room
// This ensures the host is fully caught up with all players in the room.
// After this the host will receive addplayer events for any new players
// During the game the separate event gamestate is used to move items around the screen
function DOMaddPlayers(playerlist) {
    var playerListDOM = document.getElementById("playerlist");
    playerListDOM.innerHTML = '';
    gameState.nplayers = 0;
    playerlist.forEach(player => {
        DOMaddPlayer(player);
    })
}

function DOMaddVoters(voters) {
    console.log('DOMaddVoters:', voters);
    voters.forEach(voter => {
        var DOMvoter = document.getElementById("voter-" + voter.socketid);
        if (!DOMvoter) {
            DOMvoter = DOMcreatePlayer(voter);
            DOMvoter.setAttribute('id', 'voter-' + voter.socketid);
        }
        assignNewParent(DOMvoter, document.getElementById('voters'));
    })
}

function DOMplayerVoted(vote) {
    console.log('DOMplayerVoted:', vote);
    var voter = document.getElementById("voter-" + vote.socketid);
    if (voter) {
        gsap.to(voter, {
            x: 80,
            ease: "back.out(2)",
            duration: 0.5
        });
    }
}

// DOMarrangePlayersInPanel
// General-purpose function to set players to their 'home' state
// Passed a container panel (div) and arranges the player element in the panel based on the panel position and size
// player scale is determined using a reference width of 480px - so the player will be scaled to fit the panel
// Note: this only works for a vertical list at the moment, will need to be extended to handle horizontal lists
// Note: used to use getBoundingClientRect but this is not reliable - use the panel offset width and height instead
function DOMarrangePlayersInPanel(panel, align='top', distribute=false) {
    const DOMpanel = document.getElementById(panel);
    const players = vm[panel];
    const [playerStart, playerSpacing] = calculatePlayerPositions(players.length, DOMpanel.offsetHeight, align, distribute);
    const playerScale = DOMpanel.offsetWidth / 480;
    const tl = gsap.timeline();
    players.forEach( (player,index) => {
        tl.add( gsap.to(document.getElementById(player.id), {
            x: 0,
            y: playerStart + index * playerSpacing,
            'z-index': index,
            scale: playerScale,
            ease: "back.out(1.7)",
        }), "<" );
    });
    return tl;
}

// DOMarrangePlayersInSafePanel
// Separate from above function since these elements must be arranged horizontally instead of vertically
function DOMarrangePlayersInSafePanel() {
    const DOMpanel = document.getElementById("safe");
    const DOMplayers = vm["safe"];
    const [playerStart, playerSpacing] = calculatePlayerPositions(DOMplayers.length, DOMpanel.offsetWidth, 'top');
    const playerScale = DOMpanel.offsetHeight / 120;
    const tl = gsap.timeline();
    DOMplayers.forEach( (player,index) => {
        tl.add( gsap.to(document.getElementById(player.id), {
            x: playerStart + index * playerSpacing,
            'z-index':index,
            scale: playerScale,
            ease: "back.out(1.7)",
        }), "<" );
    });
    return tl;
}

// onGameState
// General purpose function to layout the players based on the current game state
// Called at the beginning of each phase to set the screen ready for whatever comes next
// Beware that this function might get out of hand - break it down if needed!
function onGameState() {
    // I used to use duration here to determine an overall speed - but better to use the timeline speed as it can be sped up to near-instant
    const tl = gsap.timeline();
    gsap.killTweensOf(".player");
    tl.add( DOMarrangePlayersInPanel("playerlist"));
    tl.add( DOMarrangePlayersInPanel("killedbyvillagers", "centre", true), "<");
    tl.add( DOMarrangePlayersInPanel("killedbywolves", "bottom"), "<");

    // gsap.to("#killedbywolves .player img", {
    //     alpha: 0.6,
    //     duration:duration
    // });
    return tl;
}

// DOMmoveCandidateAndVoters
// Accepts a socketid and a new y position and animates the candidate and any voters to the new position
// Returns a timeline which can be appended to other timelines to ensure the animations are sequenced correctly
function DOMmoveCandidateAndVoters(v, to, zindex) {
    const DOMcandidate = document.getElementById(v);
    const tl = gsap.timeline();
    tl.to(DOMcandidate, {
        y: to,
    });
    tl.set(DOMcandidate, {
        'z-index': zindex
    });
    return tl;
}

// onDayVoteStart
// Called by server when the day vote starts - voteObj is an object holding two arrays:
//  voters - an array of playerObjs who are voting
//  candidates - an array of playerObjs who are being voted on
// Complex animation to move players to the votingon container
// Logic:
// 1. Move any players currently in the votingon container back to the playerlist (cleanup from previous vote)
// 3. Put candidates in the candidate container and animate them to their new positions and sizes
// 2. Create (if necessary) a voter for each voting player and move them to the voter positions and sizes
// 4. Move any remaining players in the playerlist to the 'safe' area along the bottom
function onDayVoteStart(voteObj) {
    console.log('onDayVote:', voteObj.candidates);
    const voters = document.getElementById("voters");

    const tl = gsap.timeline();
    tl.timeScale(10); // testing - speed up the animation

    // Hide the dayphase and nightphase panels
    tl.add( gsap.to("#dayphase", { y: canvasAdjustY(-1080) }) );
    tl.add( gsap.to("#nightphase", { y: canvasAdjustY(-1080), delay:0.2 }), "<" );

    // 1. Move any players currently in the candidates container back to the playerlist (cleanup from previous vote)
    // This should ideally be done in the previous voting result function - initialise shouldn't need to worry about this...
    const DOMcandidates = document.getElementById("candidates");
    // const previousCandidates = DOMcandidates.querySelectorAll(".player");
    // previousCandidates.forEach( candidate => assignNewParent(candidate, document.getElementById("playerlist") ) );
    
    // 3. Put candidate players to the candidates container and animate them to their new positions and sizes
    voteObj.candidates.forEach( (candidate,index) => { assignNewParent(document.getElementById(candidate.socketid), DOMcandidates) } );
    tl.add(DOMarrangePlayersInPanel("candidates"));
    
    // 2. Create (if necessary) a voter for each voting player and move them to the voter positions and sizes
    DOMaddVoters(voteObj.voters);
    tl.add( DOMarrangePlayersInPanel("voters") );

    // 4. Move any remaining players in the playerlist to the 'safe' area along the bottom
    // This should be done by the previous voting result function - initialise shouldn't need to worry about this...
    tl.play();
    console.log('onDayVoteStart complete:', vm);
}

// onDayVoteResult
// candidates is a list of the playerObjs who are being voted on - used to maintain an ordered list of players to allow ranking
// votes is a dictionary with socketids as keys and player voted on as values
// Work through dictionary animating the players to show the result...
// Rather than complex async processes this time I'm going to use a timeline to manage the animations - much easier to control
function onDayVoteResult(voteObj) {
    const candidates = voteObj.candidates;
    const votes = voteObj.votes;
    let votesArray = Object.entries(votes);
    candidates.forEach( (candidate) => { candidate.votes = 0; } );
    const [candidateStart, candidateSpacing] = calculatePlayerPositions(candidates.length, document.getElementById("candidates").offsetHeight, 'centre', true);
    
    const tl = gsap.timeline();
    tl.timeScale(10); // testing - speed up the animation

    const processVotes = () => {
        if (votesArray.length == 0) {
            console.log('Day vote result complete:', vm);
            return;
        }

        // these locally-scoped variables are used by the two inner functions processVote and adjustRanking
        const vote = votesArray.shift();
        const index = candidates.findIndex( (c) => c.socketid == vote[1] );
        const candidate = candidates[index];
        candidate.votes = candidate.votes+1;

        const adjustRanking = () => {
            // we already know index, the position in the candidates array of the player who was voted for
            // look through the candidates array from index 'upwards' until we find a candidate with more votes
            const n = candidates[index].votes;
            let i = index;
            while (i > 0 && candidates[i-1].votes < n) {
                i--;
            }
            if (i < index) {

                // i is now the position in the array where the player should be - adjust the array to show this
                candidates.splice(index, 1);
                candidates.splice(i, 0, candidate);
                const c = vm['candidates'].splice(index, 1);
                vm['candidates'].splice(i, 0, c[0]);

                //animate candidate to new position and inbetween items down
                const to = candidateStart + i * candidateSpacing;
                tl.add(DOMmoveCandidateAndVoters(candidate.socketid, to, i));
                
                // animate candidates between i and index to move down to make space for the above
                // the "<" ensures that all tweens occur at the same time as the above
                for (let j = i+1; j <= index; j++) {
                    const c = candidates[j];
                    const to = candidateStart + j * candidateSpacing;
                    tl.add(DOMmoveCandidateAndVoters(c.socketid, to, j), "<");
                }
                // Note: *could* use the below function to just arrange candidates - but the arrange function has a stagger which is nice for initial arrangement not so nice here
                // tl.add( DOMarrangeCandidates() );
            }
        }
        const doSingleVote = () => {
            const DOMvoter = document.getElementById("voter-" + vote[0]);
            const DOMcandidate = document.getElementById(vote[1]);
            if (DOMvoter) {
                tl.add( gsap.set( DOMvoter, { 'z-index': -candidate.votes } ) );
                tl.add( () => {
                    assignNewParent( DOMvoter, DOMcandidate.getElementsByClassName("voters")[0] );
                } );
                tl.add( gsap.to( DOMvoter, {
                    x: - 160 * candidate.votes,
                    y: 0,
                    ease: "back.out(1)",
                }) );
                vm.addDOMVoter(DOMvoter, DOMcandidate.id);
            }
        }
        doSingleVote();
        adjustRanking();
        console.log('next vote processed:', vm);
        processVotes(); // recurse
    }
    processVotes();

    // Now we clear up - separated out for simplicity
    tl.add( clearUpVotes(candidates) );
    tl.play();
}

function clearUpVotes(candidates) {
    console.log('clearUpVotes:', candidates);
    const maxVotes = candidates[0].votes;
    var safeCount = 0;

    const tl = gsap.timeline();
    tl.timeScale(0.1);

    // several inner functions to handle stages of the cleanup animation
    const moveCandidateToSafe = (c) => {
        const DOMcandidate = document.getElementById(c.socketid);
        // animate the move to safe area in two steps, first verically downwards and then left
        const safetl = gsap.timeline();
        vm.assignNewParent(DOMcandidate, "safe");
        safetl.add( () => { assignNewParent(DOMcandidate, document.getElementById("safe")) } );
        safetl.add( gsap.set(DOMcandidate, { 'z-index':safeCount } ) );
        safetl.add( gsap.to(DOMcandidate, { y: 20 } ) );
        safetl.add( DOMarrangePlayersInSafePanel() );
        return safetl;
    }
    const spreadVoters = (c) => {
        const DOMcandidate = document.getElementById(c.socketid);
        const voters = vm.getVoters(c.socketid);
        console.log('spreadVoters:', voters, voters.length);
        const voterstl = gsap.timeline();
        for (let i=voters.length; --i>=0; ) {
            const voter = voters[i];
            const DOMvoter = document.getElementById(voter.id);
            const to = -260 -260 * i;
            console.log('spreadVoters:', i, voter, to);
            voterstl.add( gsap.to(DOMvoter, { x: to, ease: "back.out(1.6)" } ) );
            voterstl.add( () => { console.log('assigning new parent'); assignNewParent(DOMvoter, document.getElementById("voters")) } );
            console.log('spreadVoters:', i, voter, -320);
            voterstl.add( gsap.to(DOMvoter, { x: -320 } ) );
        }
        voterstl.add( () => { DOMcandidate.getElementsByClassName("voters")[0].innerHTML = ''; } );
        vm.removeAllVoters(c.socketid);
    return voterstl;
    }

    // loop through the candidates from zero votes to max votes, spreading voters out to show the result and then moving the candidates to the safe area
    for (var i=0; i<maxVotes; i++) {
        var safeCandidates = candidates.filter( (c) => c.votes == i ).reverse();    // reverse because we want to start with the bottom candidate
        safeCandidates.forEach( (c,index) => {
            tl.add(spreadVoters(c));
        })
        safeCandidates.forEach( (c,index) => {
            tl.add( "safelabel" );
            tl.add( moveCandidateToSafe(c) );
            safeCount++;
        });

        var remainingCandidates = candidates.filter( (c) => c.votes > i );
        var [candidateStart, candidateSpacing] = calculatePlayerPositions(remainingCandidates.length, document.getElementById("candidates").offsetHeight, 'centre', true);
        console.log('Remaining candidates:', remainingCandidates, remainingCandidates.length, candidateStart, candidateSpacing);
        tl.add("label"+i);    // inserts a 'break' so that next tweens occur after the above
        remainingCandidates.forEach( (c, index) => {
            var DOMcandidate = document.getElementById(c.socketid);
            var to = candidateStart + index * candidateSpacing;
            console.log('Remaining:', DOMcandidate.getAttribute("name"), to);
            tl.add( gsap.to(DOMcandidate, { y: to, duration:1, ease:"back.in(1)" } ), "<" );
        });
    }
    return(tl);
}

// addRandomMovement
// Accepts an element and generates a random tween to a new location - callback added to tween so that it repeats
// Note although the canvas is 1920x1080 we adjust x and y range to allow for the width and height of the player
function addRandomMovement(element) {
    console.log('addRandomMovement:', element.getAttribute('id') );
    gsap.to(element, {
        x: gsap.utils.random(0,1820),
        y: canvasAdjustY( gsap.utils.random(80,1080) ),
        duration: gsap.utils.random(1,5,0.2),
        delay: gsap.utils.random(0,3,0.2),
        onComplete: addRandomMovement,
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
    DOMnewParent.appendChild(DOMelement);
    gsap.set(DOMelement, {
        x: x,
        y: y
    })
    vm.assignNewParent(DOMelement, DOMnewParent.getAttribute('id'));
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

    console.log('init:', vm);
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
    gsap.set("#playerlist", { top: canvasAdjustY(120), height: canvasAdjustY(860) } );
    gsap.set("#nightphase", { top: canvasAdjustY(40), height: canvasAdjustY(940) } );
    gsap.set("#dayphase", { top: canvasAdjustY(40), height: canvasAdjustY(940) } );
    gsap.set("#voters", { top: canvasAdjustY(140), height: canvasAdjustY(840) } );
    gsap.set("#candidates", { top: canvasAdjustY(140), height: canvasAdjustY(840) } );
    gsap.set("#safe", { top: canvasAdjustY(1000), height: canvasAdjustY(60) } );

    gsap.set("#timer", { top: canvasAdjustY(900), height: canvasAdjustY(60) } );
    gsap.set("#largepanel", { top: canvasAdjustY(40), height: canvasAdjustY(980) } );
    

    // Test whether setting x,y via GSAP is different to specifying top,left in the CSS
    // YES it does make a difference - executeing gsap.set causes a translate3d to be added to the style, separate to the left/top
    // Short answer is that it's better to use GSAP to set x,y for elements that need to be moved
    // CSS can define positions of static (fixed) container elements
    gsap.set("#test1", { x: 500, y:canvasAdjustY(540)});
    gsap.set("#test2", { x:800, y:canvasAdjustY(980)});

    // This only in the test page - buttons to test all the actions
    gsap.set("#buttonlist", {
        y: canvasAdjustY(20),
        height: canvasAdjustY(20),
        scale: 1/scaleX,
    } );
}

window.onload=init();
