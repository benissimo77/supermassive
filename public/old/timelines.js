// EXPERIMENTS WITH TIMELINES
// This is a series of animations put together into a timeline
// Arrange the living players in a neatly-spaced circle (oval) around the playerlist origin
// Slide the playerlist to the centre of the screen
// Rotate the playerlist, with an onupdate to adjust the players back to make them straight
// Also, for this animation hide the playernames it looks neater...
// EASY!
// gsap.defaults( { paused:true } );

// BIG PROBLEM with timelines!
// The idea of defining them in advance and then just playing them whenever you want to only works if the positions
// will be guaranteed to be the same as the moment when the timeline was created
// The state when the timeline is defined 'bakes in' the positions and so playing the same timeline later when players have moved
// will revert the elements back to where they were when the timeline was created.
// For this reason that sucks - create them on the fly to ensure they pick up the latest fresh data

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

var spin_circle = gsap.timeline();
spin_circle.to("#playerlist", {
    rotation: 360, duration:5, ease:"none", onComplete: () => {
        console.log('spin_circle complete:');
        if (!endNighttime) {
            tl_nighttime.seek("spincircle");
        }
    }
});
spin_circle.to("#playerlist .player", { rotation: -360, duration:5, ease:"none" }, "<");

var exit_circle = gsap.timeline();
exit_circle.to("#playerlist", { x: 0, y: 0, ease:"none", duration:3 });
exit_circle.to("#playerlist .player", {
    x: canvasToScreenX(100),
    y: (index,target,targets) => { canvasToScreenY(100 + index * 100) },
    duration: 3,
    ease:"none"
}, "<" );

// NOTES ON ABOVE
// Managing the rotation of players is difficult - I prefer to make all tweens nothing more than movement
// That way I only have to consider the positioning, not the rotating
// It works but ending the tweens might become quite tricky
// I like the idea that each new tween kills previous tweens instantly - then use a motion path to smoothly move from where it is to where it wants to go
// Trying this next:

const startX = 100;
const startY = 150;
var layout_list = gsap.timeline();
layout_list.to(".player",
{
    x: canvasToScreenX(startX),
    y: (index,target,targets) => { return canvasToScreenY(startY + index*100) },
    z: (index,target,targets) => { return index },                    
    ease: "elastic.out(1,0.3)",
    stagger:0.4,
    duration:2
});

const tl_nighttime = gsap.timeline();
// tl_nighttime.add(enter_circle).addLabel("spincircle").add(spin_circle).addLabel("exitcircle").add(exit_circle);
var endNighttime = false;
