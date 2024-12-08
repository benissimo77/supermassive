import { gsap } from 'gsap';
import { TextPlugin } from "gsap/TextPlugin";

import { Overlay } from '../Overlay.js';
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
    console.log('DOMcreatePlayer:', player);
    var DOMplayer = document.createElement('div');
    DOMplayer.setAttribute('class', 'player');
    DOMplayer.setAttribute('id', player.sessionID);
    DOMplayer.setAttribute('name', player.name);
    DOMplayer.setAttribute('data-score', 0);
    DOMplayer.innerHTML = `
        <div class="pixel"></div>
        <div class='avatar'>
            <img src="/img/avatar-200/image-from-rawpixel-id-${player.avatar}-original.png">
        </div>
        <div class="voters"></div>
        <div class="bar"></div>
        <div class="playernamepanel">
            <div class="playername">${player.name}</div>
            <div id="score-${player.sessionID}" class="playerscore"></div>
        </div>
    `;
    return DOMplayer;
}

const DOMcreateMarker = function(distance) {
    console.log('DOMcreateMarker:', distance);
    var DOMmarker = document.createElement('div');
    DOMmarker.setAttribute('class', 'marker');
    DOMmarker.setAttribute('data-distance', distance);
    DOMmarker.innerHTML = `
        <div class='pixel'></div>
        <div class='marker-line'></div>
        <div class='marker-distance'>${distance}</div>
        `;
    gsap.set(DOMmarker, { x: distance } );
    return DOMmarker;
}
const DOMpositionMarkers = function(scale) {
    document.getElementById('racetrack-markers').querySelectorAll('.marker').forEach( (marker) => {
        gsap.set(marker, { x: marker.getAttribute('data-distance') * scale });
    });
}


// DOMremovePlayer
// Accepts a sessionID and removes the player from the DOM - executes on a socket disconnect event
function DOMremovePlayer(sessionID) {
    console.log('DOMremovePlayer:', sessionID);
    var DOMplayer = document.getElementById(sessionID);
    if (DOMplayer) {
        gsap.killTweensOf(DOMplayer);
        DOMplayer.remove();
    }
    vm.removeElement(sessionID);
}


// DOMaddPlayer
// Accepts a player object and builds the HTML to make the player character
// This should not need to be created again - this function ONLY called when a new player joins
const DOMaddPlayer = function(player) {
    console.log('DOMaddPlayer:', player);
    var DOMplayer = document.getElementById(player.sessionID);
    if (!DOMplayer) {
        DOMplayer = DOMcreatePlayer(player);
        document.body.appendChild(DOMplayer);    // Note: it will be re-parented later
        vm.addDOMElement(DOMplayer, 'document');
    }

    // Decide which container to place this player (might already be dead - then disconnected/reconnected)
    var container = 'racetrack-lanes';
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

const DOMupdatePlayerScore = function(playerid, score) {
    const player = document.getElementById(playerid);
    // console.log('DOMupdateScore:', playerid, score, player);
    player.setAttribute('data-score', score);
    document.getElementById(`score-${playerid}`).textContent = score;
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
            // scale: playerScale,
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
    tl.add( TLarrangePlayersInPanelVertical("racetrack-lanes"));
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

// Premature optimisation!
// Clever system of panels - but is it really necessary?
// I've instead opted for an approach of 'create it when you need it' (based on templates) and then destroy it the moment its done
// I think this is cleaner and makes it more understandable what is wanted. A template for each panel type.
function DOMsetActivePanel(panel) {
    const panels = document.querySelectorAll('.panel');
    panels.forEach(panel => panel.classList.remove('active'));
    document.getElementById(panel).classList.add('active');
}

function TLhideAllPanels() {
    const tl = gsap.timeline();
    tl.to( '#information-panel', { y:canvasAdjustY(-1080) } );
    tl.to( '#question-panel', {x:-1920}, "<" );
    return tl;
}

// Maybe model the play.quiz.js pattern with a series of panels and activating one panel automatically hides the others
function DOMpanelResponse(instructions) {
    document.getElementById("panel-response-title").innerHTML = instructions.title;
    document.getElementById("panel-response-description").innerHTML = instructions.description;
    this.DOMsetActivePanel("panel-response");
}

// TLendRound
// This borrows some of the TLpanelQuestion since we want to go back through each question, but this time we also show the correct answer
// and we show the players who answered the question correctly
// TODO: Split this function up in pieces, server controls more fine-grained what to do, client manages display only
function TLendRound(payload) {
    const tl = gsap.timeline();
    tl.add( TLhideAllPanels() );
    tl.add( TLpanelSlideDown(payload));
    return tl;
}

function calculatePlayerOvertakes(players) {
    var overtake = new Set();
    for (let i=0; i < players.length - 1; i++) {
        const m1 = players[i].newScore * players[i].newScale - players[i].oldScore * players[i].oldScale;
        const c1 = players[i].oldScore * players[i].oldScale;
        for (let j=i+1; j < players.length; j++) {
            const m2 = players[j].newScore * players[j].newScale - players[j].oldScore * players[j].oldScale;
            const c2 = players[j].oldScore * players[j].oldScale;
            if (m2 != m1) {
                const t = (c2 - c1) / (m1 - m2);
                if ((t >= 0) & (t < 1)) {
                    overtake.add(t);
                }
            }
        }
    }
    return Array.from(overtake).sort();
}

// TLupdateScores
// scores a dictionary of the form: sessionID:score, sessionis2:score2, ...
// We want to loop through each player and animate their position to the new position
// If I'm clever I can also update the actual displayed score (in the player element) as it animates...
var racetrackScale;
function TLupdateScores(scores) {

    // Calculate a new scale based on the new highest score
    // Animate the scale from current to new, and update all players during the animation
    const highestScore = Math.max(...Object.values(scores), 1);
    const lowerScore = Math.min(...Object.values(scores));
    // const newScale = 100; 
    const newScale = Math.max(1, Math.min(180, Math.floor( 1400 / (highestScore) )));
    const currentScale = racetrackScale;
    const scaleObject = { scale: currentScale };
    const tl = gsap.timeline();
    const duration = 2; // this will be used for all durations

    // Begin by flying in the racetrack and clearing away all old panels
    tl.add(TLhideAllPanels(), "<");
    tl.add(TLflyInRacetrack(), "<");
    tl.to( scaleObject, {
        scale: newScale,
        duration: duration,
        ease: 'none',
        onUpdate: function() {
            DOMpositionMarkers(scaleObject.scale);
        }
    });
    racetrackScale = newScale;

    // Bonus timeline! If the scale is reduced down to 1 then we are forced to pan to keep runners in view
    // This works - but notice that Flourish bar chart race does not do this, just keep scaling - remove markers if needed
    // Once the scores get to around 50-60 the scale is 1400/50 which is about as small to go before removing markers
    // So leave in for now, but this is not a perfect solution right now (only needed when scores get large)
    // if (newScale == 1) {
    //     tl.to('#racetrack', { x: 1400 - highestScore, duration:duration, ease:'none' }, "<" )
    // }

    // Now a timeline tween for each player - update score from current score to new score
    // Update x based on the animating score and the new (final) scale
    const panel = 'racetrack-lanes';
    const players = vm[panel];
    players.forEach( (playerElement) => {
        const player = document.getElementById(playerElement.id);
        const playerScore = parseInt(player.getAttribute('data-score'));
        const playerNewScore = scores[playerElement.id] || 0;
        const scoreObject = { score: playerScore };
        playerElement.oldScore = playerScore;
        playerElement.newScore = playerNewScore;    // Stash result for later
        playerElement.oldScale = currentScale;
        playerElement.newScale = newScale;  // These make calculations for overtaking easier
        tl.to( scoreObject, {
            score: playerNewScore,
            duration:duration,
            ease:'none',
            onUpdate: function() {
                DOMupdatePlayerScore(playerElement.id, parseInt(scoreObject.score) );
            },
        }, "<" );
        tl.to( player, { x: playerNewScore * newScale, duration:duration, ease:'none', }, "<");
        tl.to( player.querySelector('.bar'), { duration:duration, ease:'none', left: -1 * playerNewScore * newScale - 5, width: playerNewScore * newScale}, "<");
    });

    
    // Now the complex part - calculate where overtaking happens and re-order the players
    // Experimenting with pre-calculating overtaking moments and adding timelines for each overtake
    // Use the gradient and intercept mx+c to determine when overtaking happens
    const DOMpanel = document.getElementById(panel);
    const [playerStart, playerSpacing] = calculatePlayerPositions(players.length, DOMpanel.offsetHeight, 'top');
    const overtakes = calculatePlayerOvertakes(players);
    console.log('TLupdateScores:', players, overtakes, playerStart, playerSpacing);
    overtakes.forEach( (overtake) => {
        // Calculate all scores and order (some will be the same use their final score to decide order)
        players.forEach( (playerElement) => { playerElement.tScore = (playerElement.newScore - playerElement.oldScore) * overtake + playerElement.oldScore; } );
        players.sort( (a,b) => { if (a.tScore == b.tScore) return (b.newScore - a.newScore); else return b.tScore - a.tScore } );
        console.log('Overtake:', players);
        for (let i=0; i<players.length; i++) {
            const player = document.getElementById(players[i].id);
            const playertl = gsap.timeline();
            playertl.to( player, { y: playerStart + i * playerSpacing, duration:0.2, ease:'none', delay: duration * overtake, zIndex:i } );
            tl.add(playertl, "<");
        }
    })

    // For now fly out the racetrack so I can test it
    // tl.add(TLflyOutRacetrack());
    return tl;
}

function TLupdateScoresV1(scores) {

    // Try animating all players at the same time, with a duration for each based on the increase in score ?
    // As players overtake each other they need to swap places as well... tricky...
    // Start with something simple and then work upwards from there
    const tl = gsap.timeline();

    Object.keys(scores).forEach( (sessionID) => {
        const player = document.getElementById(sessionID);
        const playertl = gsap.timeline();
        const scale = 0;
        const currentScore = player.getAttribute('data-score');
        const scoreObject = { score: 0, scale: scale };
        console.log('updateScores:', currentScore, scores[sessionID]);
        playertl.to( scoreObject, {
            score: scores[sessionID],
            scale: 10,
            duration: 2,
            onUpdate: function() {
                DOMupdatePlayerScore(sessionID, parseInt(scoreObject.score));
                gsap.set(player, { x: scoreObject.score * scoreObject.scale});
            },
            onComplete: function() { console.log('onComplete:', scoreObject.score); }
        } );
        playertl.add( () => { DOMupdatePlayerScore(sessionID, scores[sessionID]); });
        tl.add(playertl, "<");
    });

    return tl;
}


function TLendRoundOLD(round) {
    const tl = gsap.timeline();
    const endData = { title:'End of Round!', description:'Lets see how you got on, here are the answers...', duration: 2 };
    console.log('TLendRound:', round);


    tl.add( TLpanelSlideDown(endData));
    round.questions.forEach( question => {
        tl.add( TLpanelQuestion(question), ">" );
        tl.add( () => DOMresetPlayerNamePanels(), ">" );
        tl.add( () => { document.getElementById(question.correctAnswerId).classList.add('correct'); }, ">+1" );
        tl.add( () => { console.log('Short delay before doign the players...') }, ">+1" );
        for (let sessionID in question.results) {
            if (question.results[sessionID]) {
                tl.add( () => { DOMsetPlayerNamePanel(sessionID); } );
                const player = document.getElementById(sessionID);
                const playerNewScore = player.getAttribute('data-score') ? parseInt(player.getAttribute('data-score')) + 1 : 1;
                player.setAttribute('data-score', playerNewScore);
                console.log('TLendRound: moving player:', player, playerNewScore);
                tl.add( gsap.to(player, { y: playerNewScore * -50 }) );
            }
        }
    });

    // final cleanup - remove the final question and answers
    tl.add( () => { document.getElementById("answers").innerHTML = '' });
    tl.add( gsap.to("#panel-question", { x: -1920 }) );
    tl.add( () => { DOMresetPlayerNamePanels() });

    return tl;
}

   
function TLendQuiz() {
    const tl = gsap.timeline();

    let bestScore = 0;
    let bestPlayerId = '';
    for (let player of document.querySelectorAll('.player')) {
        const score = parseInt(player.getAttribute('data-score'));
        if (score > bestScore) {
            bestScore = score;
            bestPlayerId = player.getAttribute('id');
        }
    }
    console.log('TLendQuiz: best player:', bestPlayerId, bestScore);
    const bestPlayerName = document.getElementById(bestPlayerId).getAttribute('name');
    const endData = { title:'End of Quiz!', description:'and the winner is...<br/><br/><br/>' + bestPlayerName, duration: 5 };
    tl.add( TLpanelSlideDown(endData) );
    tl.add( () => { DOMsetPlayerNamePanel(bestPlayerId); } );
    tl.add( gsap.to(document.getElementById(bestPlayerId), { scale: 2 }) );
    return tl;
}

function createIdFromString(str) {
    return str
        .trim() // Remove leading and trailing whitespace
        .toLowerCase() // Convert to lowercase
        .replace(/[^a-z0-9-_:.]/g, '') // Remove invalid characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/^-+|-+$/g, ''); // Remove leading and trailing hyphens
}

// Utility Functions for creating different answer types
function createOptionButton(optionValue) {
    const button = document.createElement("button");
    button.classList.add("option");
    button.textContent = optionValue;
    button.setAttribute("data-answer", createIdFromString(optionValue));
    return button;
}
function createDropzoneButton(optionValue) {
    const button = createOptionButton(optionValue);
    button.classList.add('droppable');
    return button;
}
function createDraggableButton(optionValue) {
    const button = createOptionButton(optionValue);
    button.classList.add('draggable');
    return button;
}
function createTextLabel(labelText) {
    const p = document.createElement("label");
    p.classList.add("option");
    p.textContent = labelText;
    return p
}

// TLpanelQuestion
// Created in stand-alone script layouts.html to get all the different question/answer types working
// Need to integrate this with TLPanelQuestion below which places everything into a timeline for animation...
function TLpanelQuestion(question) {

    // Holder for entire question
    const questionPanel = document.getElementById('question-panel');
    const questionTemplate = document.getElementById('question-template');
    const questionElement = questionTemplate.content.cloneNode(true);
    const questionText = questionElement.getElementById('question-text');
    const questionImage = questionElement.getElementById('question-image');
    const questionAudio = questionElement.getElementById('question-audio');
    const questionOptions = questionElement.getElementById('question-options');

    console.log('loadQuestion:', question, questionElement);

    // This assumes panel has already been flown off by the previous END_QUESTION call...
    // Initialise the timeline which will hold all the animations for the question
    const tl = gsap.timeline({ onComplete: () => { console.log('timeline.onComplete'); }});

    // Begin by clearing away all panels, and resetting all player name panels
    DOMresetPlayerNamePanels();
    tl.add(TLhideAllPanels());
    tl.add(TLflyOutRacetrack(), "<");

    // Reset the question panel
    tl.add( () => {
        gsap.set(questionPanel, { x: 1920 }); 
        questionPanel.innerHTML = '';
        questionPanel.appendChild(questionElement);
        document.getElementById("question-number").innerHTML = question.number;
    });

    // Fly the question panel in from the right (note the question is not shown yet, only the question number)
    tl.add( gsap.to(questionPanel, { x: 0, ease:"back.out(1)" }) );

    // See if I can set the height of the question panel in advance
    // Animate the question text, word at a time
    // Note: BUG in GSAP that it can't add a Text tween to a timeline and accurately calculate the duration
    // So the progress(1).progress(0) solves this...
    const textTween = gsap.to(questionText, { text: {
        value: question.text,
        delimiter: "",
        speed: 1,
        preserveSpaces:true
    }});
    textTween.progress(1).progress(0);
    tl.add(textTween);

    // Display audio if available
    if (question.audio) {
        const audioPlayer = document.createElement('audio-player');
        audioPlayer.setAttribute('duration', question.duration || 5);
        audioPlayer.setAttribute('src', question.audio);
        tl.add( () => { console.log('doQuestion::audio:', questionAudio, audioPlayer); questionAudio.appendChild(audioPlayer) });
    }

    // Display image if required
    if (question.image) {
        questionImage.classList.add('active');
        // const imageSelector = document.createElement('image-selector');
        const imageSelector = document.createElement("img");
        // imageSelector.setAttribute("mode", "hotspot");
        imageSelector.setAttribute("id", "image-selector");
        imageSelector.setAttribute("src", question.image);
        tl.add( () => {
            console.log('doQuestion::image:', questionImage, imageSelector);
            questionImage.appendChild(imageSelector);
        });
        // const image = document.createElement("img");
        // image.src = question.image;
        // imageContainer.appendChild(image);
    }

    // And now for the question-specific content - all added into question-options container
    switch (question.type) {
        case "text":
        questionOptions.classList.add('question-options-1col');
        tl.add( () => questionOptions.appendChild(createTextLabel('Type the answer on your phone now!')));
        break;

        case "multiple-choice":
            // Add a class to determine whether 1, 2, 3 or 4 column
            questionOptions.classList.add('question-options-2col');
            tl.add( () => question.options.forEach( (option) => { questionOptions.appendChild(createOptionButton(option)); }));
            break;

        case "true-false":
            questionOptions.classList.add('question-options-2col');
            tl.add( () => {
                ['True', 'False'].forEach( (option) => {
                    questionOptions.appendChild(createOptionButton(option));
                })
            });
            break;

        case "matching":
            questionOptions.classList.add('question-options-2col');
            tl.add( () => {
                question.pairs.forEach( (pair, index) => {
                    const button = questionOptions.appendChild(createDraggableButton(pair.left));
                    button.setAttribute("id", "option-" + index);
                    const dropzone = questionOptions.appendChild(createDropzoneButton(pair.right));
                    dropzone.setAttribute("id", "option-end-" + index);
                });
            });
            break;

        case "ordering":
            questionOptions.classList.add('question-options-2col');
            tl.add( () => {
                question.options.forEach( (item, index) => {
                    const button = questionOptions.appendChild(createDraggableButton(item));
                    button.setAttribute("id", "option-" + index);
                    var dropzoneLabel = (index == 0) ? question.extra.startLabel : '';
                    dropzoneLabel = (index == question.items.length - 1) ? question.extra.endLabel : dropzoneLabel;
                    const dropzone = questionOptions.appendChild(createDropzoneButton(dropzoneLabel));
                    dropzone.setAttribute("id", "option-end-" + index);
                })
            });
            break;

        case "hotspot":
        case "point-it-out":
            questionOptions.classList.add('question-options-1col');
            tl.add( () => { questionOptions.appendChild(createTextLabel('Tap your phone/tablet to mark your answer')) });
            break;

        case "draw":
            questionOptions.classList.add('question-options-1col');
            tl.add( () => questionOptions.appendChild(createTextLabel('Use your phone/tablet to draw your answer')));
            break;
    }

    // Now that all draggable buttons and droppable slots have been created attach any further interactivity
    questionOptions.querySelectorAll('.draggable').forEach( (draggable) => {
        console.log('Adding drag:', draggable.innerHTML);
        Draggable.create(draggable, {
            bounds: questionPanel,
            edgeResistance: 0.65,
            onDrag: () => {
                const zone = checkDropzoneHit.bind(draggable)();
                if (zone) {
                    console.log('HIT');
                }
             },
            onDragEnd: function() {
                const dropzones = document.querySelectorAll('.droppable');
                let droppedOnZone = false;
                dropzones.forEach(dropzone => {
                    dropzone.classList.remove('dragover');
                    if (this.hitTest(dropzone, "50%")) {
                        droppedOnZone = true;
                        const draggableRect = this.target.getBoundingClientRect();
                        const dropzoneRect = dropzone.getBoundingClientRect();                                
                        const x = (dropzoneRect.left - draggableRect.left) / windowScale;
                        const y = (dropzoneRect.top - draggableRect.top) / windowScale;
                        // Store the dropzone id on the draggable for later reference
                        this.target.dataset.droppedOn = dropzone.id;
                        gsap.to(this.target, {
                            duration: 0.3,
                            x: this.x + x,
                            y: this.y + y
                        });
                    }
                });
                if (!droppedOnZone) {
                    console.log('No dropzone found...');
                    gsap.to(this.target, {
                        duration: 0.3,
                        x: 0,
                        y: 0
                    });
                    // Clear the droppedOn data if not dropped on a zone
                    delete this.target.dataset.droppedOn;
                }
            },
            onDragLeave: () => { console.log('onDragLeave'); }
        })
    });

    return tl;
}

// DOMshowAnswer
// Show the answer to the user - how this happens depends on the type of question
function DOMshowAnswer(question) {
    const questionPanel = document.getElementById('question-panel');
    const questionOptions = document.getElementById('question-options');

    switch (question.type) {

        case "text":
            document.getElementById('question-answer').innerHTML = question.answer;
            break;

        case "multiple-choice":
        case "true-false":
            document.querySelector(`[data-answer="${createIdFromString(question.answer)}"]`).classList.add("correct");
            break;

        // Lazy approach for showing the correct answers for ordering
        // Just repeat the code from above but use the answer node instead of items node
        case "ordering":
            questionOptions.innerHTML = '';
            question.answer.forEach( (item, index) => {
                const button = questionOptions.appendChild(createDraggableButton(item));
                button.setAttribute("id", "option-" + index);
                var dropzoneLabel = (index == 0) ? question.extra.startLabel : '';
                dropzoneLabel = (index == question.items.length - 1) ? question.extra.endLabel : dropzoneLabel;
                const dropzone = questionOptions.appendChild(createDropzoneButton(dropzoneLabel));
                dropzone.setAttribute("id", "option-end-" + index);
            })
            break;

        case "matching":
            console.log(question);
            questionOptions.innerHTML = '';
            question.pairs.forEach( (pair, index) => {
                const button = questionOptions.appendChild(createDraggableButton(question.answer[index]));
                button.setAttribute("id", "option-" + index);
                const dropzone = questionOptions.appendChild(createDropzoneButton(pair.right));
                dropzone.setAttribute("id", "option-end-" + index);
            });
        break;

        case "hotspot":
        case "point-it-out":
            const imageSelector = document.getElementById("image-selector");
            // We have to assume that image is already loaded (... maybe not?)
            console.log('imageSelector.onload:', imageSelector);
            const overlay = new Overlay(imageSelector);
            overlay.setMode('host');  // specifies whether windowScale should be considered
            overlay.addCrosses(question.results);
            if (question.type == "hotspot") {
                overlay.setCrossColour("green");
                overlay.setCrossThickness(4);
                overlay.addCrosses([question.answer]);    
            } else {
                overlay.addHitArea(question.answer);
            }
            break;


            // add more question types here...
    }

    // Also highlight the players who got this answer correct, found in the playersCorrect node
    if (question.playersCorrect) {
        question.playersCorrect.forEach( (sessionID) => {
            DOMsetPlayerNamePanel(sessionID);
        });    
    }
}
function TLflyPanelLeft(panel) {
    const tl = gsap.timeline();
    tl.to(panel, { x: -1920, ease: "back.in(1)" });
    return tl;
}
function TLflyPanelDown(panel) {
    const tl = gsap.timeline();
    tl.to(panel, { y:200, ease: "back.in(1)" });
    return tl;
}
function TLflyPanelUp(panel) {
    const tl = gsap.timeline();
    tl.to(panel, { y:-400, ease: "back.in(1)" });
    return tl;
}
function TLpanelSlideDown(instructions) {
    const tl = gsap.timeline();
    const panel = document.getElementById("information-panel");
    tl.add( () => {
        document.getElementById("information-panel-title").innerHTML = instructions.title;
        document.getElementById("information-panel-description").innerHTML = instructions.description;    
    });
    tl.to(panel, { y: canvasAdjustY(200), ease: "back.in(1)" });
    return tl;
}
function TLpanelSlideUp() {
    const tl = gsap.timeline();
    const panel = document.getElementById("information-panel");
    tl.to(panel, { y: canvasAdjustY(-1080), ease: "back.in(1)" });
    return tl;
}
// TLflyInRacetrack
// Note that these container divs are positioned in quiz.css using CSS 'left' property so this is what should be animated
function TLflyInRacetrack() {
    const duration = 1;
    const tl = gsap.timeline();
    tl.to('#racetrack-markers', { left: 0, duration: duration, ease: "back.in(1)" });
    tl.to('#racetrack-lanes', { left:0, duration:duration, ease: "back.in(1)" }, "<");
    return tl;
}
function TLflyOutRacetrack() {
    const duration = 1;
    const tl = gsap.timeline();
    tl.to('#racetrack-markers', { left: 1920, duration: duration, ease: "back.in(1)" });
    tl.to('#racetrack-lanes', { left:-1920, duration:duration, ease: "back.in(1)" }, "<");
    return tl;
}


function TLendQuestion() {
    const tl = gsap.timeline();
    tl.add( () => {
        DOMresetPlayerNamePanels();
        DOMhideTimer();
    })
    tl.add( TLflyPanelLeft("#question-panel") );
    return tl;
}

function DOMresetPlayerNamePanels() {
    const players = document.querySelectorAll('.playernamepanel');
    players.forEach( player => player.classList.remove('answered') );
}
// DOMsetPlayerNamePanel
// Sets or resets the playername panel to show that the player has answered
// class 'answered' is added to the panel
function DOMsetPlayerNamePanel(playerId) {
    console.log('DOMsetPlayerNamePanel:', playerId);
    const panel = document.getElementById(playerId).querySelector('.playernamepanel');
    panel.classList.add('answered');
}

function DOMstartTimer(request) {
    console.log('onStartTimer:', request);
    gsap.set("#timer", { display: "block" });
    gsap.fromTo("#timer .timer_progress", { width: "100%" }, { 
        width: 0,
        duration: request.duration,
        ease: "linear",
        onComplete: () => {
           DOMhideTimer();
    }});
}
function DOMhideTimer() {
    gsap.set("#timer", { display: "none" });
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
        elementSpacing = Math.min(120, elementSpacing);    // 120 is the maximum spacing when not distributing
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

// setWindowScale
// Update: trying with setting the scale of a wrapper div so that BODY can have a background image
function setWindowScale(x, instant=true) {
    console.log('setWindowScale:', x, instant, document.getElementById("body"), gsap);
    if (instant) {
        gsap.set("#wrapper", { scaleX: x, scaleY: x });
    } else {
        gsap.to("#wrapper", { scaleX: x, scaleY: x });
    }

    // Experiment - try setting the font size of BODY to scale up... might work...
    // console.log('setWindowScale: setting font size to:', (16/x) );
    // gsap.set("body", { fontSize: (16 / x) });
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

    console.log('dom.init started...');

    // Since we want to animate text we need to register the TextPlugin
    gsap.registerPlugin(TextPlugin);

    screenSizeBody();
    callAfterResize(screenSizeBody, 0.2);

    // console.log('init:', vm);

    // Experiment with adding new functions for the intro eg change the background colour
    gsap.to("body", { backgroundColor: "#ffffff" });

    // quiz.hmtl includes a wrapper div which is set as display:none to prevent drawing before everything set up
    // now that everything is set up we can display the body
    gsap.set("#wrapper", { display: "block" });

    // animate the fade in of the background image by setting the opacity from 1 to final amount
    gsap.to("#overlay", { opacity: 0.85, duration: 1 });

    // Register SplitText plugin to allow questions to be animated one word at a time
    // Not needed for basic text animations - only for more complex (not using right now)
    // gsap.registerPlugin(SplitText);

    // For now just create a few markers - ths will be done momre dynamically laeter
    document.getElementById('racetrack-markers').appendChild(DOMcreateMarker(0));
    document.getElementById('racetrack-markers').appendChild(DOMcreateMarker(1));
    document.getElementById('racetrack-markers').appendChild(DOMcreateMarker(2));
    document.getElementById('racetrack-markers').appendChild(DOMcreateMarker(3));
    document.getElementById('racetrack-markers').appendChild(DOMcreateMarker(4));
    document.getElementById('racetrack-markers').appendChild(DOMcreateMarker(5));
    document.getElementById('racetrack-markers').appendChild(DOMcreateMarker(10));
    document.getElementById('racetrack-markers').appendChild(DOMcreateMarker(15));
    document.getElementById('racetrack-markers').appendChild(DOMcreateMarker(20));
    document.getElementById('racetrack-markers').appendChild(DOMcreateMarker(25));
    document.getElementById('racetrack-markers').appendChild(DOMcreateMarker(30));
    document.getElementById('racetrack-markers').appendChild(DOMcreateMarker(35));
    document.getElementById('racetrack-markers').appendChild(DOMcreateMarker(40));
    document.getElementById('racetrack-markers').appendChild(DOMcreateMarker(45));
    document.getElementById('racetrack-markers').appendChild(DOMcreateMarker(50));
    document.getElementById('racetrack-markers').appendChild(DOMcreateMarker(60));
    document.getElementById('racetrack-markers').appendChild(DOMcreateMarker(70));
    document.getElementById('racetrack-markers').appendChild(DOMcreateMarker(80));
    document.getElementById('racetrack-markers').appendChild(DOMcreateMarker(90));
    document.getElementById('racetrack-markers').appendChild(DOMcreateMarker(100));
    document.getElementById('racetrack-markers').appendChild(DOMcreateMarker(110));
    document.getElementById('racetrack-markers').appendChild(DOMcreateMarker(120));
    document.getElementById('racetrack-markers').appendChild(DOMcreateMarker(130));
    document.getElementById('racetrack-markers').appendChild(DOMcreateMarker(140));
    document.getElementById('racetrack-markers').appendChild(DOMcreateMarker(150));
    document.getElementById('racetrack-markers').appendChild(DOMcreateMarker(175));
    document.getElementById('racetrack-markers').appendChild(DOMcreateMarker(200));
    
    racetrackScale = 180;
    DOMpositionMarkers(racetrackScale);
 
    console.log('dom.init completed...');
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
    console.log('dom.screenSizeBody:: viewport size:', windowInnerWidth, windowInnerHeight);
    const scaleX = window.innerWidth / 1920;
    setWindowScale(scaleX);

    // Panel width will always be right because body scale ensures it fits, but height needs to be set as this can vary
    gsap.set("#playerlist", { top: canvasAdjustY(1040), height: canvasAdjustY(20) } );
    // Not even using any of these anymore... pfff!
    gsap.set("#panel-response", { top: canvasAdjustY(90), height: canvasAdjustY(240) } );
    gsap.set("#panel-question", { top: canvasAdjustY(90), height: canvasAdjustY(380) } );
    gsap.set("#panel-answers", { top: canvasAdjustY(440), height: canvasAdjustY(400) } );

    // This is the only one needed - general purpose question (and options panel)
    gsap.set("#question-panel", { top: canvasAdjustY(90), height: canvasAdjustY(900) } );
    gsap.set("#information-panel", { y: canvasAdjustY(-1080) });

    gsap.set("#racetrack", { y: canvasAdjustY(200), height: canvasAdjustY(600) });
    gsap.set("#racetrack-markers", { y: 0, height: canvasAdjustY(24) });
    gsap.set("#racetrack-lanes", { y: canvasAdjustY(80), height: canvasAdjustY(600) });

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
    // What is the payloadlist ???
    gsap.set("#payloadlist", {
        fontSize: 16 / scaleX,
    })

    if (document.getElementById('question-image')) {
        console.log('screenSize:', document.getElementById('question-image').getBoundingClientRect() );
    }
}


// Export all the functions
// Functions beginning with DOM are DOM manipulation functions that act immediately and don't require further interaction
// Functions beginning with TL are timeline functions that can be added to a timeline and executed in sequence
// General pattern for quiz.js is they will invoke a TL function and then add a host:response event to signify completion
// Some events won't require this and they can call the DOM functions directly
export const dom = {
    DOMaddPlayer,
    DOMaddPlayers,
    DOMremovePlayer,
    DOMsetActivePanel,
    DOMpanelResponse,
    DOMsetPlayerNamePanel,
    DOMresetPlayerNamePanels,
    DOMstartTimer,
    DOMhideTimer,
    DOMshowAnswer,
    TLhideAllPanels,
    TLflyPanelLeft,
    TLflyOutRacetrack,
    TLendQuestion,
    TLarrangePlayersInPanelHorizontal,
    TLarrangePlayersInPanelVertical,
    TLgameState,
    TLgameOver,
    TLendRound,
    TLendQuiz,
    TLupdateScores,
    TLpanelQuestion,
    TLpanelSlideDown,
    TLpanelSlideUp,
    init
  }

