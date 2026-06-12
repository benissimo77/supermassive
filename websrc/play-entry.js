import { avatarList, getAvatarUrl } from './utils/avatars.js';

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
        <img id='${element}' src="${getAvatarUrl(element)}">
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

    // Save to localStorage for quick return
    localStorage.setItem('sm_last_room', room);
    localStorage.setItem('sm_last_name', name);
    localStorage.setItem('sm_last_avatar', avatar);

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
    } else {
        // Fallback to localStorage
        const lastRoom = localStorage.getItem('sm_last_room');
        if (lastRoom && document.getElementById('room')) {
            document.getElementById('room').value = lastRoom;
        }
    }

    // Pre-fill name and avatar from localStorage first (guest memory)
    const lastName = localStorage.getItem('sm_last_name');
    const lastAvatar = localStorage.getItem('sm_last_avatar');

    if (lastName && document.getElementById('name')) {
        document.getElementById('name').value = lastName;
    }

    // Populate avatars
    avatarList.forEach(element => {
        addAvatar(element);
    });

    if (lastAvatar) {
        const avatarImg = document.getElementById(lastAvatar);
        if (avatarImg) avatarImg.click();
    }

    // Auth Integration
    let user = null;
    try {
        const authRes = await fetch('/auth/me');
        if (authRes.ok) {
            const authJson = await authRes.json();
            user = (authJson && authJson.success && authJson.data) ? authJson.data.user : null;
        }
    } catch (e) {
        console.error('Auth load failed', e);
    }

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
