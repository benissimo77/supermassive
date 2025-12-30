import { gsap } from 'gsap';
import viewModel from './vm.js';

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
    // console.log('DOMaddPlayer:', player);
    var DOMplayer = document.getElementById(player.socketid);
    if (!DOMplayer) {
        DOMplayer = DOMcreatePlayer(player);
        document.body.appendChild(DOMplayer);    // Note: it will be re-parented later
        vm.addDOMElement(DOMplayer, 'document');
    }

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

// DOMplayerVoted
// Called by server when a player has voted - animates the voter to show they have voted
// Note: most DOM functions return a timeline, but this one is simple enough to just play immediately
function DOMplayerVoted(player) {
    console.log('DOMplayerVoted:', player);
    var DOMvoter = document.getElementById("voter-" + player.socketid);
    if (DOMvoter) {
        gsap.to(DOMvoter, {
            x: 80,
            ease: "back.out(2)",
            duration: 0.5
        });
    }
}

// TLarrangePlayersInPanel
// General-purpose function to set players to their 'home' state
// Passed a container panel (div) and arranges the player element in the panel based on the panel position and size
// player scale is determined using a reference width of 480px - so the player will be scaled to fit the panel
// Note: this only works for a vertical list at the moment, will need to be extended to handle horizontal lists
// Note: used to use getBoundingClientRect but this is not reliable - use the panel offset width and height instead
const TLarrangePlayersInPanel = function(panel, align='top', distribute=false) {
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

// TLarrangePlayersInSafePanel
// Separate from above function since these elements must be arranged horizontally instead of vertically
function TLarrangePlayersInSafePanel() {
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

// TLarrangeVoters
// Similar to DOMarrangePlayersInPanel but for the voters panel
// Voters are arranged in a horizontal list alongside the candidate they are voting for
// They must be arranged from right to left, different to the player list
// Note: we use a -ve number for the available space so that it is calculated from the right-hand side
// Note: since the candidates are scaled this means the space available must be scaled (ouf!)
function TLarrangeVoters(candidateId) {
    const voters = vm.getVoters(candidateId);
    const tl = gsap.timeline();
    let [voterStart, voterSpacing] = calculateVoterPositions(voters.length, 1100 * 480 / 720);
    console.log('DOMarrangeVoters:', candidateId, voters, voterStart, voterSpacing);
    voters.forEach( (voter,index) => {
        tl.add( gsap.to(document.getElementById(voter.id), {
            x: voterStart + index * voterSpacing,
            y: 0,
            'z-index': -1 - index,
            ease: "back.out(1.7)",
        }), "<+=0.1" );
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
    tl.add( TLarrangePlayersInPanel("playerlist"));
    tl.add( TLarrangePlayersInPanel("killedbyvillagers", "top"), "<");
    tl.add( TLarrangePlayersInPanel("killedbywolves", "bottom"), "<");

    // gsap.to("#killedbywolves .player img", {
    //     alpha: 0.6,
    //     duration:duration
    // });
    return tl;
}

// TLmoveCandidateAndVoters
// Accepts a socketid and a new y position and animates the candidate and any voters to the new position
// Returns a timeline which can be appended to other timelines to ensure the animations are sequenced correctly
function TLmoveCandidateAndVoters(v, to, zindex) {
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

// DOMinstructions
// Called by server when the host needs to display instructions to the players
function DOMinstructions(payload) {
    console.log('DOMinstructions:', payload);
    const content = document.getElementById("instructions-content");
    content.innerHTML = payload.message;
    gsap.set("#instructions", { display: "block" });
}


// TLdayVoteStart
// Called by server when the day vote starts - voteObj is an object holding two arrays:
//  voters - an array of playerObjs who are voting
//  candidates - an array of playerObjs who are being voted on
// Complex animation to move players to the votingon container
// Logic:
// 1. Move any players currently in the votingon container back to the playerlist (cleanup from previous vote)
// 3. Put candidates in the candidate container and animate them to their new positions and sizes
// 2. Create (if necessary) a voter for each voting player and move them to the voter positions and sizes
// 4. Move any remaining players in the playerlist to the 'safe' area along the bottom
function TLdayVoteStart(voteObj) {
    console.log('onDayVote:', voteObj.candidates);
    const voters = document.getElementById("voters");

    // Before we begin to assemble the completed timeline we need to kill any tweens of the player elements
    // Note: the kill must happen BEFORE any timelines are created
    gsap.killTweensOf(".player");

    const tl = gsap.timeline();
    tl.timeScale(4); // testing - speed up the animation

    // Hide the dayphase and nightphase panels
    tl.add( gsap.to("#dayphase", { y: canvasAdjustY(-1080) }) );
    tl.add( gsap.to("#nightphase", { y: canvasAdjustY(-1080) }), "<+=0.5" );

    // 1. Move any players currently in the candidates container back to the playerlist (cleanup from previous vote)
    // This should ideally be done in the previous voting result function - initialise shouldn't need to worry about this...
    const DOMcandidates = document.getElementById("candidates");
    // const previousCandidates = DOMcandidates.querySelectorAll(".player");
    // previousCandidates.forEach( candidate => assignNewParent(candidate, document.getElementById("playerlist") ) );
    
    // 3. Put candidate players to the candidates container and animate them to their new positions and sizes
    voteObj.candidates.forEach( (candidate,index) => { assignNewParent(document.getElementById(candidate.socketid), DOMcandidates) } );
    tl.add(TLarrangePlayersInPanel("candidates"));
    
    // 2. Create (if necessary) a voter for each voting player and move them to the voter positions and sizes
    DOMaddVoters(voteObj.voters);
    tl.add( TLarrangePlayersInPanel("voters") );

    // 4. Move any remaining players in the playerlist to the 'safe' area along the bottom
    // This should be done by the previous voting result function - initialise shouldn't need to worry about this...
    console.log('onDayVoteStart complete:', vm);
    return tl;
}

// TLdayVoteResult
// candidates is a list of the playerObjs who are being voted on - used to maintain an ordered list of players to allow ranking
// votes is a dictionary with socketids as keys and player voted on as values
// Work through dictionary animating the players to show the result...
// Rather than complex async processes we use a timeline to manage the animations - much easier to control
// Function ends when all votes have been processed, when timeline completes playing we send response to server and await next step
// Note: the vote can end in a draw, in which case server will send a new vote with the same voters but fewer candidates
function TLdayVoteResult(voteObj) {
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
                tl.add(TLmoveCandidateAndVoters(candidate.socketid, to, i));
                
                // animate candidates between i and index to move down to make space for the above
                // the "<" ensures that all tweens occur at the same time as the above
                for (let j = i+1; j <= index; j++) {
                    const c = candidates[j];
                    const to = candidateStart + j * candidateSpacing;
                    tl.add(TLmoveCandidateAndVoters(c.socketid, to, j), "<");
                }
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
                // tl.add( gsap.to( DOMvoter, {
                //     x: - 160 * candidate.votes,
                //     y: 0,
                //     ease: "back.out(1)",
                // }) );
                vm.addDOMVoter(DOMvoter, DOMcandidate.id);
                tl.add(TLarrangeVoters(DOMcandidate.id));
            }
        }
        doSingleVote();
        adjustRanking();
        console.log('next vote processed:', vm);
        processVotes(); // recurse
    }
    processVotes();

    // Now we clear up - separated out for simplicity
    tl.add( TLclearUpVotes(candidates) );
    return tl;
}

function TLclearUpVotes(candidates) {
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
        safetl.add( TLarrangePlayersInSafePanel() );
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
            let votertl = gsap.timeline();
            votertl.add( gsap.to(DOMvoter, { y: DOMvoter.y + 40 } ) );
            votertl.add( gsap.to(DOMvoter, { x: to, ease: "back.out(1.6)" } ) );
            votertl.add( () => { console.log('assigning new parent'); assignNewParent(DOMvoter, document.getElementById("voters")) } );
            console.log('spreadVoters:', i, voter, -320);
            // note that technically this only needs to go to -320 since with scaling the voter will be 320px wide, but give margin of error
            votertl.add( gsap.to(DOMvoter, { x: -480 } ) );
            voterstl.add(votertl, "<+0.1");
        }
        voterstl.add( () => { DOMcandidate.getElementsByClassName("voters")[0].innerHTML = ''; } );
        vm.removeAllVoters(c.socketid);
    return voterstl;
    }

    // loop through the candidates from zero votes to max votes, spreading voters out to show the result and then moving the candidates to the safe area
    for (var i=0; i<maxVotes; i++) {
        var safeCandidates = candidates.filter( (c) => c.votes == i ).reverse();    // reverse because we want to start with the bottom candidate
        
        // for cases where there are no players with this number of votes we can instantly skip to the next iteration
        if (safeCandidates.length == 0) {
            continue;
        }
        tl.add( () => { } );
        safeCandidates.forEach( (c,index) => {
            tl.add( spreadVoters(c), "<" );
        })
        // inserts a 'break' so that next tweens occur after the above
        tl.add( () => { } );
        safeCandidates.forEach( (c,index) => {
            tl.add( moveCandidateToSafe(c), "<+=0.1" );
            safeCount++;
        });

        var remainingCandidates = candidates.filter( (c) => c.votes > i );
        var [candidateStart, candidateSpacing] = calculatePlayerPositions(remainingCandidates.length, document.getElementById("candidates").offsetHeight, 'centre', true);
        console.log('Remaining candidates:', remainingCandidates, remainingCandidates.length, candidateStart, candidateSpacing);
        // inserts a 'break' so that next tweens occur after the above
        tl.add( () => { } );
        remainingCandidates.forEach( (c, index) => {
            var DOMcandidate = document.getElementById(c.socketid);
            var to = candidateStart + index * candidateSpacing;
            console.log('Remaining:', DOMcandidate.getAttribute("name"), to);
            tl.add( gsap.to(DOMcandidate, { y: to, duration:1, ease:"back.out(0.5)" } ), "<+0.1" );
        });
    }
    // And clear voters for final (losing) candidates - so only the candidates are left in the candidates container
    var safeCandidates = candidates.filter( (c) => c.votes == maxVotes ).reverse();    // reverse because we want to start with the bottom candidate
    tl.add( () => { } );
    safeCandidates.forEach( (c,index) => {
        tl.add( spreadVoters(c), "<+=0.1" );
    })
    return(tl);
}

// TLdayKill
// Called by the server when there has been a (successful) day kill
// This function is responsible for moving the killed player to the appropriate container
function TLdayKill(dead) {
    console.log('TLdayKill:', dead);
    const el = document.getElementById(dead);
    const tl = gsap.timeline();
    tl.to("#dayphase", { y: 0 });
    tl.to("#nightphase", { y: 0 }, "<+=0.5" );
    // re-assign the parent right away since we want to animate the player relative to screen coords
    assignNewParent(el, document.getElementById("playerlist"));
    tl.add( TLdoDeathAnimation([dead]) );
    // this technique seems to work - add a callback function which assigns the parent and then calls the function which relies on the parent being set correctly
    tl.add( () => {
        assignNewParent(el, document.getElementById("killedbyvillagers") );
        tl.add(TLgameState());
    });    
    return tl;
}

// TLnightKill
// Called by the server when there has been a (successful) night kill
// This function is responsible for moving the killed player to the appropriate container
// Almost identical to dayKill but with a different container
function TLnightKill(dead) {
    console.log('TLnightKill:', dead);
    const el = document.getElementById(dead);
    const tl = gsap.timeline();
    tl.to("#dayphase", { y: 0 });
    tl.to("#nightphase", { y: 0 }, "<+=0.5" );
    // re-assign the parent right away since we want to animate the player relative to screen coords
    assignNewParent(el, document.getElementById("playerlist"));
    tl.add( TLdoDeathAnimation([dead]) );
    // this technique seems to work - add a callback function which assigns the parent and then calls the function which relies on the parent being set correctly
    tl.add( () => {
        assignNewParent(el, document.getElementById("killedbywolves") );
        tl.add(TLgameState());
    });    
    return tl;
}

// TLdoDeathAnimation
// Called when a player has been killed either day or night - deadArray is an array of socketids of the dead players
function TLdoDeathAnimation(deadArray) {
    // Timeline animation for this since a few different things happening BUT will never need to repeat or interrupt
    // so should be safe for a basic timeline animation
    const tl = gsap.timeline();
    deadArray.forEach( (dead, index) => {
        const el = document.getElementById(dead);
        tl.add( gsap.to(el, {
            x: 960,
            y: canvasAdjustY(480 + 180 * index),
            scale: 2
        } ), "<+=0.1" );
    });
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

// calculateVoterPositions
// Performs a similar function to calculatePlayerPositions but for voters
// Slightly different logic required since voters are arranged horizontally and can be on two or more lines
// Returns a tuple of the start position and the spacing between
function calculateVoterPositions(n, totalSpace) {
    let elementSpacing = totalSpace / Math.max(n, 1);    // Math.max prevents division by 0
    elementSpacing = Math.min(160, elementSpacing);    // 160 is the maximum spacing when not distributing
    return [-elementSpacing, -elementSpacing];
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

    console.log('init:', vm);

    // Experiment with adding new functions for the intro eg change the background colour
    gsap.to("body", { backgroundColor: "#000000" });

    // werewwolves.hmtl defines body as display:none to prevent drawing before everything set up
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


  export const dom = {
    DOMaddPlayer,
    DOMaddPlayers,
    DOMremovePlayer,
    DOMaddVoters,
    DOMplayerVoted,
    TLarrangePlayersInPanel,
    TLarrangePlayersInSafePanel,
    TLarrangeVoters,
    TLgameState,
    DOMinstructions,
    TLdayVoteStart,
    TLdayVoteResult,
    TLdayKill,
    TLnightKill,
    TLdoDeathAnimation,
    TLgameOver,
    init
  }

