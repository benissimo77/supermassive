function DOMaddPlayer(player) {
    console.log('DOMaddPlayer:', player);
    var playerDOM = document.createElement('div');
    playerDOM.setAttribute('class', 'player');
    playerDOM.setAttribute('id', player.id);
    playerDOM.innerHTML = `
        <div class="pixel"></div>
        <div class="avatar">
            <img src="/img/avatar-200/image-from-rawpixel-id-${player.avatar}-original.png">
        </div>
        <div class="playername">
            ${player.name}
        </div>
    `;
    document.getElementById('playerlist').appendChild(playerDOM);
    addRandomMovement(playerDOM);
}

function DOMplayerRole(role) {

    // simply overwrite the entire content as this is all we need...
    document.getElementById('content').innerHTML = `
        Your role:<br/><br/>${role}
        `
}
function buttonClick(e) {
    ret = { socketid:e.currentTarget.id, name: e.currentTarget.innerHTML };
    console.log('buttonClick - sending client:response event:', ret);
    socket.emit('client:response', ret );
}

function DOMbuttonSelect(buttons) {
    clearTimeout(timer);
    var contentDOM = document.getElementById("content");
    console.log('DOMbuttonSelect');
    contentDOM.innerHTML = '';
    Object.keys(buttons).forEach(key => {
        button = buttons[key];
        console.log(button);
        buttonDOM = document.createElement("button");
        if (button.socketid) buttonDOM.setAttribute("id", button.socketid);
        buttonDOM.innerHTML = button.name;
        buttonDOM.addEventListener('click', buttonClick);
        contentDOM.appendChild(buttonDOM);
    })
}
function DOMtimedMessage(payload) {
    clearTimeout(timer);
    console.log('DOMtimedMessage:', payload);
    const timerEnds = () => {
        contentDOM.innerHTML = '';        
    }
    var contentDOM = document.getElementById("content");
    console.log('DOMbuttonSelect');
    contentDOM.innerHTML = payload.message;
    timer = setTimeout(timerEnds, payload.timer * 1000);
}