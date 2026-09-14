import { avatarList, getAvatarUrl } from '../utils/avatars.js';
import { runSave } from '../utils/saveButton.js';

const container = document.getElementById('profile-container');
const viewTemplate = document.getElementById('profile-view-template');
const editTemplate = document.getElementById('profile-edit-template');
const avatarOptionTemplate = document.getElementById('avatar-option-template');

let currentUser = null;
let isEditing = false;
let selectedAvatar = null;

async function initDashboardProfile() {

    try {
        const res = await fetch('/auth/me');
        if (res.ok) {
            const json = await res.json();
            currentUser = (json && json.success && json.data) ? json.data.user : null;
        }
    } catch (e) {
        console.error('Fetch user failed', e);
    }

    if (!currentUser) {
        window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
        return;
    }
    selectedAvatar = currentUser.avatar;
    render();
}

function render() {
    if (isEditing) {
        renderEditMode();
    } else {
        renderViewMode();
    }
}

function renderViewMode() {
    const clone = viewTemplate.content.cloneNode(true);

    const joinedDate = currentUser.createdAt ? new Date(currentUser.createdAt).toLocaleDateString() : 'Unknown';
    clone.querySelector('.profile-joined').textContent = joinedDate;
    clone.querySelector('.profile-role').textContent = currentUser.role;
    clone.querySelector('.profile-avatar-img').src = getAvatarUrl(currentUser.avatar || avatarList[0]);
    clone.querySelector('.profile-displayname').textContent = currentUser.displayname || 'Not set';
    clone.querySelector('.profile-email').textContent = currentUser.email || 'Not set';

    container.innerHTML = '';
    container.appendChild(clone);

    container.querySelector('.btn-toggle-edit').addEventListener('click', () => {
        isEditing = true;
        render();
    });
}

function renderEditMode() {
    const clone = editTemplate.content.cloneNode(true);

    const preview = clone.querySelector('.current-avatar-preview');
    preview.src = getAvatarUrl(selectedAvatar || 'default');

    const grid = clone.querySelector('.avatar-selection-grid');
    avatarList.forEach(id => {
        const optionClone = avatarOptionTemplate.content.cloneNode(true);
        const img = optionClone.querySelector('.avatar-option');
        img.src = getAvatarUrl(id);
        if (String(id) === String(selectedAvatar)) img.classList.add('selected');

        img.addEventListener('click', () => {
            preview.src = img.src;
            grid.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
            img.classList.add('selected');
            selectedAvatar = id;
        });

        grid.appendChild(optionClone);
    });

    clone.querySelector('.edit-displayname').value = currentUser.displayname || '';

    container.innerHTML = '';
    container.appendChild(clone);

    container.querySelector('.btn-cancel-edit').addEventListener('click', () => {
        isEditing = false;
        selectedAvatar = currentUser.avatar;
        render();
    });

    container.querySelector('.btn-save-profile').addEventListener('click', saveProfile);
}

async function saveProfile() {
    const displayname = container.querySelector('.edit-displayname').value.trim();
    const btn = container.querySelector('.btn-save-profile');
    const status = container.querySelector('.status-msg');

    if (displayname.length === 0) {
        status.textContent = 'Display name cannot be empty';
        status.className = 'status-msg status-error';
        return;
    }

    const result = await runSave(btn, async () => {
        const response = await fetch('/auth/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ displayname, avatar: selectedAvatar })
        });
        return response.json();
    }, {
        onError: (err) => {
            status.textContent = err.message;
            status.className = 'status-msg status-error';
        }
    });

    if (result) {
        currentUser.displayname = displayname;
        currentUser.avatar = selectedAvatar;
        isEditing = false;
        render();
        const newStatus = container.querySelector('.status-msg');
        newStatus.textContent = 'Profile updated successfully!';
        newStatus.className = 'status-msg status-success';
    }
}

document.addEventListener('DOMContentLoaded', initDashboardProfile);
