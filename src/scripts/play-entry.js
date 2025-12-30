import { Auth } from '../utils/auth.js';

// State
const avatarlist = [
    12138118, 12138231, 12138743, 12138846, 12139963, 12140600, 12143538, 12189343,
    12214366, 12215207, 12232806, 12348050, 12358126, 12358607, 12359578, 12360465,
    12370419, 12370830, 12391847, 12436639, 12454847, 12474909, 12502935, 12660677,
    12789062, 12791500, 13003915, 13100182,
];

// Functions
function toggleFullScreen() {
    const docElm = document.documentElement;
    if (!document.fullscreenElement &&
        !document.mozFullScreenElement &&
        !document.webkitFullscreenElement &&
        !document.msFullscreenElement) {

        if (docElm.requestFullscreen) {
            docElm.requestFullscreen();
        } else if (docElm.webkitRequestFullscreen) {
            docElm.webkitRequestFullscreen();
        } else if (docElm.mozRequestFullScreen) {
            docElm.mozRequestFullScreen();
        } else if (docElm.msRequestFullscreen) {
            docElm.msRequestFullscreen();
        }
    }
}

function selectAvatar(e) {
    const avatarId = e.target.id;
    document.getElementById('avatar').value = avatarId;
    
    // Reset all borders and classes
    document.querySelectorAll('#gallerycontainer .gallery').forEach(el => {
        el.classList.remove('selected');
    });
    // Highlight selected
    const galleryItem = e.target.closest('.gallery');
    if (galleryItem) {
        galleryItem.classList.add('selected');
    }
    updateButtonState();
}

function updateButtonState() {
    const form = document.getElementById('gameform');
    const submitBtn = document.getElementById('submit');
    if (!form || !submitBtn) return;

    const name = form.name.value.trim();
    const room = form.room.value.trim();
    const avatar = form.avatar.value;

    const isValid = name !== "" && room !== "" && avatar !== "";
    submitBtn.style.opacity = isValid ? "1" : "0.5";
}

function addAvatar(element) {
    const gallery = document.getElementById("gallerycontainer");
    if (!gallery) return;

    const newAvatar = document.createElement('div');
    newAvatar.setAttribute('class', 'gallery');
    newAvatar.innerHTML = `
        <img id='${element}' src="/img/avatar-100/image-from-rawpixel-id-${element}-original.png">
    `;
    newAvatar.addEventListener("click", selectAvatar);
    gallery.appendChild(newAvatar);
}

async function checkForm(event) {
    const form = document.getElementById('gameform');
    const name = form.name.value.trim();
    const room = form.room.value.trim();
    const avatar = form.avatar.value;
    const errorEl = document.getElementById('form-error');

    if (errorEl) {
        errorEl.style.display = 'none';
        errorEl.textContent = '';
    }

    if (name === "" || room === "" || avatar === "") {
        event.preventDefault();
        if (errorEl) {
            errorEl.style.display = 'block';
            if (room === "") errorEl.textContent = "Please enter a room code";
            else if (name === "") errorEl.textContent = "Please enter your team name";
            else if (avatar === "") errorEl.textContent = "Please choose an avatar";
        }
        return false;
    }

    try {
        toggleFullScreen();
        // We don't need the timeout here if we're using addEventListener
    } catch (err) {
        console.log('Fullscreen error:', err);
    }
    return true;
}

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('gameform');
    if (form) {
        form.addEventListener('submit', checkForm);
        form.name.addEventListener('input', updateButtonState);
        form.room.addEventListener('input', updateButtonState);
    }

    // Check if ROOMID is set in URL
    const urlParams = new URLSearchParams(window.location.search);
    const roomID = urlParams.get('room');
    if (roomID && document.getElementById('room')) {
        document.getElementById('room').value = roomID;
    }

    // Populate avatars
    avatarlist.forEach(element => {
        addAvatar(element);
    });

    // Auth Integration
    const user = await Auth.getUser();
    const authStatus = document.getElementById('auth-status');
    
    if (authStatus) {
        if (user) {
            authStatus.innerHTML = `
                <div style="background: rgba(16, 185, 129, 0.15); padding: 12px 20px; border-radius: 16px; display: inline-flex; align-items: center; gap: 10px; border: 1px solid rgba(16, 185, 129, 0.2);">
                    <div style="width: 8px; height: 8px; background: #10b981; border-radius: 50%; box-shadow: 0 0 10px #10b981;"></div>
                    <span style="color: #fff; font-size: 0.9rem;">Playing as <strong>${user.displayname || user.email}</strong></span>
                </div>
            `;
            
            if (user.displayname && document.getElementById('name')) {
                document.getElementById('name').value = user.displayname;
            }

            if (user.avatar) {
                const avatarImg = document.getElementById(user.avatar);
                if (avatarImg) {
                    avatarImg.click();
                }
            }
            updateButtonState();
        } else {
            const currentPath = window.location.pathname + window.location.search;
            authStatus.innerHTML = `
                <div style="background: rgba(255, 255, 255, 0.05); padding: 10px 15px; border-radius: 16px; display: inline-block; border: 1px solid rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); white-space: nowrap;">
                    <span style="color: var(--clr-text-muted); font-size: 0.85rem;">Save your scores?</span>
                    <a href="/login?redirect=${encodeURIComponent(currentPath)}" style="color: var(--clr-accent); text-decoration: none; font-weight: 700; margin-left: 6px; font-size: 0.85rem;">Login</a>
                    <span style="margin: 0 6px; color: rgba(255,255,255,0.2);">|</span>
                    <a href="/login?mode=signup&redirect=${encodeURIComponent(currentPath)}" style="color: var(--clr-accent); text-decoration: none; font-weight: 700; font-size: 0.85rem;">Sign Up</a>
                </div>
            `;
        }
    }
    updateButtonState();
});
