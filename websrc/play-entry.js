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
    localStorage.setItem('sm_last_room_time', Date.now().toString());
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
        // Fallback to localStorage if last room is recent (4 hours maximum)
        const lastRoom = localStorage.getItem('sm_last_room');
        const lastRoomTimeStr = localStorage.getItem('sm_last_room_time');
        
        if (lastRoom && document.getElementById('room')) {
            if (lastRoomTimeStr) {
                const lastRoomTime = parseInt(lastRoomTimeStr, 10);
                const maxAge = 4 * 60 * 60 * 1000; // 4 hours threshold
                if (Date.now() - lastRoomTime < maxAge) {
                    document.getElementById('room').value = lastRoom;
                } else {
                    // Stale, clear storage entry so it doesn't linger
                    localStorage.removeItem('sm_last_room');
                    localStorage.removeItem('sm_last_room_time');
                }
            } else {
                // If timestamp didn't exist (from past versions), let's pre-fill but clear it so we establish standard going forward
                document.getElementById('room').value = lastRoom;
            }
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
            if (authJson && authJson.success && authJson.data) {
                user = authJson.data.user || null;
            }
        }
    } catch (e) {
        console.error('Auth load failed', e);
    }

    const currentPath = window.location.pathname + window.location.search;
    const loggedInPanel = document.getElementById('auth-logged-in');
    const anonymousPanel = document.getElementById('auth-anonymous');
    const usernameDisplay = document.getElementById('username-display');
    const loginLink = document.getElementById('auth-login-link');
    const signupLink = document.getElementById('auth-signup-link');

    if (user) {
        if (usernameDisplay) {
            usernameDisplay.textContent = user.displayname || user.email;
        }
        if (loggedInPanel) {
            loggedInPanel.classList.remove('hidden');
        }
        if (anonymousPanel) {
            anonymousPanel.classList.add('hidden');
        }

        if (user.displayname && document.getElementById('name')) {
            document.getElementById('name').value = user.displayname;
        }

        if (user.avatar) {
            const avatarImg = document.getElementById(user.avatar);
            if (avatarImg) {
                avatarImg.click();
            }
        }
    } else {
        if (loggedInPanel) {
            loggedInPanel.classList.add('hidden');
        }
        if (anonymousPanel) {
            anonymousPanel.classList.remove('hidden');
        }
        if (loginLink) {
            loginLink.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
        }
        if (signupLink) {
            signupLink.href = `/login?mode=signup&redirect=${encodeURIComponent(currentPath)}`;
        }
    }
    updateButtonState();
});
