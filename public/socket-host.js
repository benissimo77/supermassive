const URL = '/host';


// Event handlers for socket.io events
// onStartGame
// Sent to the host when the game is started - display instructions on screen (these must be removed)
// players will receive their own instructions
// Host will receive a gamestate event after this to update the player positions
// Maybe this gamestate event should be responsible for removing the instructions ?
// For now provide a button which will remove instructions and send a hostready event to move to next stage
function onStartGame() {
    console.log('socket-host: onStartGame');
    gsap.set("#largepanel", { display: "block" });
    gsap.set("#largepanelcontent > div", { display: "none" });
    gsap.set("#startgame", { display: "block" });
    gameState.started = true;
    onGameState();
}
function onConnect() {
    console.log('onConnect:', socket.connected);
  }
function onDisconnect(socketid) {
    console.log('onDisconnect:', socketid);
    DOMremovePlayer(socketid);
    gameState.nplayers--;
}



// onPlayerList
// Debugging - output playerlist to console
// Done by host to get nicer layout of playerlist data
function onPlayerList(playerlist) {
    console.log('onPlayerList:', playerlist);
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


function onMorning() {
    audioManager.playTrack(musicTracks.MORNING);
    audioManager.playTrack(narratorTracks.WAKEUP);
}

// dayKill - dead is a socketid of the player who was killed
// At the moment this handles all the clean up from the days voting...
function onDayKill(dead) {
    console.log('onDayKill:', dead);

    // clear away all the voters and previous candidates
    const voters = document.getElementById("voters");
    voters.innerHTML = '';
    const candidates = document.getElementById("candidates");
    const previousCandidates = candidates.querySelectorAll(".player");
    previousCandidates.forEach( (candidate) => { if (candidate.id != dead) document.getElementById("playerlist").appendChild(candidate) } );
    gsap.killTweensOf(".player");
    doDeathAnimation([dead], "killedbyvillagers");
    gsap.to("#killedbywolves", {
        y: 0,
        duration: 1,
        ease: "elastic.out(1.7)"
    })
    gsap.to("#killedbyvillagers", {
        y: 0,
        duration: 1,
        ease: "elastic.out(1.7)"
    })
    onGameState();
}
function onNightKill(dead) {
    console.log('onNightKill:', dead);
    doDeathAnimation(dead, "killedbywolves");
}

// onDayVoteStart
// Called by server when the day vote starts - vote is an object holding two arrays:
//  voting - an array of playerObjs who are voting
//  votingon is an array of playerObjs who are being voted on
// Complex animation to move players to the votingon container
// Logic:
// 1. Move any players currently in the votingon container back to the playerlist (cleanup from previous vote)
// 2. Create (if necessary) a voter for each voting player and move them to the voter positions and sizes
// 3. Put votingon players to the votingon container and animate them to their new positions and sizes
// 4. Move any remaining players in the playerlist to the 'safe' area along the bottom
function onDayVoteStart(vote) {
    console.log('onDayVote:', vote.votingon);
    const voters = document.getElementById("voters");
    const candidates = document.getElementById("candidates");
    const previousCandidates = candidates.querySelectorAll(".player");
    previousCandidates.forEach( (candidate) => document.getElementById("playerlist").appendChild(candidate) );
    gsap.killTweensOf(".player");
    vote.voting.forEach( (player) => {
        var DOMplayer = document.getElementById("voter-" + player.socketid);
        if (!DOMplayer) {
            DOMplayer = DOMcreatePlayer(player);
            DOMplayer.setAttribute('id', 'voter-' + player.socketid);
        }
        voters.appendChild(DOMplayer);
    })

    // Slightly annoying since we need to maintain the y value of the candidates for the animation
    // This is difficult to get from the DOM so we need to set it as a data attribute
    // BUT gsap would normally calculate this for us - so instead of using gsap to move all players at once we have to loop through them and calculate the y value manually
    // Since we're doing this we might as well make it a bit more dynamic and calculate the spacing between the candidates in a clever way
    // Centre the list vertically, and space them out to slowly expand up and down
    const [candidateStart, candidateSpacing] = calculatePlayerPositions(vote.votingon.length, 1080, 0, 0);
    vote.votingon.forEach( (player, index) => {
        var DOMplayer = document.getElementById(player.socketid);
        var newY = canvasToScreenY( candidateStart + index * candidateSpacing);
        DOMplayer.setAttribute('data-y', newY);
        DOMplayer.setAttribute('data-votes', 0);
        candidates.appendChild(DOMplayer);
        gsap.to(DOMplayer, {
            x: 1100,
            y: newY,
            z: index,
            scale: 1.5,
            duration:1,
            ease: "back.out(1.7)"
        })
    })
    // Now everything is in the right place - animate the voters and candidates
    gsap.to("#killedbywolves", {
        y: -600,
        duration: 1,
        ease: "back.in(1.7)"
    })
    gsap.to("#killedbyvillagers", {
        y: -600,
        duration: 1,
        ease: "back.in(1.7)"
    })

    // the voter spacing we can do using the gsap stagger function since we don't need to remember the y position
    // slightly different to candidatespacing to make it look better
    const [voterStart, voterSpacing] = calculatePlayerPositions(vote.voting.length, 1080, 300, 400);
    gsap.to("#voters .player", {
        x: 100,
        y: (index,target,targets) => { return canvasToScreenY(voterStart + index * voterSpacing) },
        z: (index,target,targets) => { return index },
        scale: 0.8,
        stagger:0.2,
        duration:1,
    })
    gsap.to("#playerlist .player", {
        x: (index,target,targets) => { return index*300 },
        y: canvasToScreenY(1040),
        z: (index,target,targets) => { return index },
        scale: 1,
        stagger:0.2,
        duration:1,
    })
}

// onDayVoteResult
// Called by server when the day vote is complete - votes is a dictionary holding each socketid and the id of the player they voted for
// Recursive function creates an array from dictionary and calls itself removing the first item from the array each time
// Recurive function also adds each popped item to a new dictionary so it can build a queue for each candidate (oooh!)
function onDayVoteResult(votes) {
    console.log('onDayVoteResult:', votes);
    let votesArray = Object.entries(votes);
    let queue = {};
    let maxVotes = 0;   // maintain the max votes so we can animate the winner to the center

    // Recursive function to process the votes
    const processVote = (votesArray, queue) => {
        if (votesArray.length == 0) {
            console.log('processVote: Done:', queue);
            socket.emit('host:response');   // sent by host to signify that animation is over and server can move on
            return;
        }
        const [voter, votedfor] = votesArray.shift();
        const DOMvoter = document.getElementById('voter-' + voter);
        const DOMvotedfor = document.getElementById(votedfor);
        if (!queue[votedfor]) {
            queue[votedfor] = [];
        }
        queue[votedfor].push(voter);
        if (queue[votedfor].length > maxVotes) {
            maxVotes = queue[votedfor].length;
        }
        const newX = 1100 - queue[votedfor].length * 260;
        console.log('processVote:', voter, votedfor, newX, queue[votedfor].length, queue[votedfor])
        gsap.to(DOMvoter, {
            x: newX,
            y: DOMvotedfor.getAttribute("data-y"),
            scale: 0.64,
            delay: 0.5,
            duration: 1,
            ease: "elastic.out(1)",
            onComplete: () => {
                processVote(votesArray, queue);
            }
        });
    }
    processVote(votesArray, queue);
}

// onPlayerVoted
// Called by server whenever a player votes - player holds the playerObj of the player who voted
function onPlayerVoted(player) {
    console.log('onPlayerVoted:', player);
    var DOMplayer = document.getElementById('v-' + player.socketid);
    if (!DOMplayer) {
        DOMplayer = DOMcreatePlayer(player);
        DOMplayer.setAttribute('id', 'v-' + player.socketid);
    }
    const voterlist = document.getElementById("voterlist");
    voterlist.appendChild(DOMplayer);
    gsap.to("#voterlist .player", {
        x: 100,
        y: (index,target,targets) => { return canvasToScreenY(200 + index *100 ) },
        z: (index,target,targets) => { return index },
        scale: 1,
        stagger: 0.2,
        duration: 1,
        ease: "back.out(1.7)"
    });
}
function onDayDraw(candidates) {
    console.log('onDayDraw:', candidates);
    doDeathAnimation(candidates.map( candidate => candidate.socketid ), "playerlist");
}
function doDeathAnimation(dead, container) {
    // Timeline animation for this since a few different things happening BUT will never need to repeat or interrupt
    // so should be safe for a basic timeline animation
    const elements = dead.map( (id) => document.getElementById(id) );
    tl = gsap.timeline();
    tl.to(elements, {
        x: 980,
        y: (index, target, targets) => canvasToScreenY(480 + index*180),
        scale: 2,
        duration: 2,
        ease: "ease:out",
        stagger: 0.5,
        onComplete: (params) => {
            console.log('onComplete:', elements, elements[0], elements[0].x);
            const DOMcontainer = document.getElementById(container);
            elements.forEach( (element) => {
                console.log("onComplete:",
                element.getBoundingClientRect().x,
                element.getBoundingClientRect().y,
                screenToCanvasX(element.getBoundingClientRect().x),
                screenToCanvasY(element.getBoundingClientRect().y),
                canvasToScreenY(480));
                assignNewParent(element, DOMcontainer);
                DOMcontainer.appendChild(element);
                // element.classList.add("dead");
            })
            // directly change the position to align with new container
            // Believe it or not the next line works - convert to screen coords then back to canvas coords, then set
            // the getBoundingClientRect returns the position of the container in screen coords
            // but when using gsap to move positions we use canvas coords (why?)
            // newX = screenToCanvasX( canvasToScreenX(980) - DOMcontainer.getBoundingClientRect().left );
            // console.log('ClientRect:', canvasToScreenX(980), 980, DOMcontainer.getBoundingClientRect(), newX);
            // gsap.set(elements, {x: newX });
            // socket.emit('host:response');
            // call onGameState directly since we are not waiting for a socket event
            // onGameState();
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
    gsap.set("#instructions", { display: "block" });
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
socket.on('playerdisconnect', onDisconnect);
socket.on('playerlist', onPlayerList);
socket.on('playersinroom', DOMaddPlayers);
socket.on('audioplay', onAudioPlay);
socket.on('morning', onMorning);
socket.on('gamestate', onGameState);
socket.on('addplayer', onAddPlayer);
socket.on('nightkill', onNightKill);
socket.on('daykill', onDayKill);
socket.on('daydraw', onDayDraw);
socket.on('startgame', onStartGame);
socket.on('server:dayvotestart', onDayVoteStart);
socket.on('server:dayvoteresult', onDayVoteResult);
socket.on('server:playervoted', onPlayerVoted);
socket.on('server:starttimer', onStartTimer);
socket.on('server:request', (request) => {
    console.log('server:request:', request.type);
    onServerRequest(request);
})
