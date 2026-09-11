import { avatarList, getAvatarUrl } from '../utils/avatars.js';

const container = document.getElementById('profile-container');
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
    const joinedDate = currentUser.createdAt ? new Date(currentUser.createdAt).toLocaleDateString() : 'Unknown';
    container.innerHTML = `
                <div class="profile-item">
                    <label>Joined</label>
                    <div class="value">${joinedDate}</div>
                </div>
                <div class="profile-item">
                    <label>Role</label>
                    <div class="value" style="text-transform: capitalize;">${currentUser.role}</div>
                </div>
                <div class="profile-item">
                    <label>Avatar</label>
                    <img src="${getAvatarUrl(currentUser.avatar || avatarList[0])}" class="avatar-preview">
                </div>
                <div class="profile-item">
                    <label>Display Name</label>
                    <div class="value">${currentUser.displayname || 'Not set'}</div>
                </div>
                <div class="profile-item">
                    <label>Email</label>
                    <div class="value">${currentUser.email || 'Not set'}</div>
                </div>
                <div class="profile-actions">
                    <button class="btn btn-edit" id="btn-toggle-edit">
                        <i class="fa-solid fa-pen-to-square"></i> Edit Profile
                    </button>
                </div>
                <div id="status-msg" class="status-msg"></div>
            `;

    document.getElementById('btn-toggle-edit').addEventListener('click', () => {
        isEditing = true;
        render();
    });
}

function renderEditMode() {
    container.innerHTML = `
                <div class="profile-item">
                    <label>Avatar</label>
                    <img src="${getAvatarUrl(selectedAvatar || 'default' )}" class="avatar-preview" id="current-avatar-preview">
                    <div class="avatar-selection-grid">
                        ${avatarList.map(id => `
                            <img src="${getAvatarUrl(id)}" 
                                 class="avatar-option ${String(id) === String(selectedAvatar) ? 'selected' : ''}" 
                                 data-id="${id}"
                                 onclick="this.parentElement.parentElement.querySelector('#current-avatar-preview').src = this.src; Array.from(this.parentElement.children).forEach(c => c.classList.remove('selected')); this.classList.add('selected'); window.updateSelectedAvatar('${id}')">
                        `).join('')}
                    </div>
                </div>
                <div class="profile-item">
                    <label>Display Name (Max 15 chars)</label>
                    <input type="text" id="edit-displayname" class="edit-input" maxlength="15" value="${currentUser.displayname || ''}">
                </div>
                <div class="profile-actions">
                    <button class="btn btn-save" id="btn-save-profile">Save Changes</button>
                    <button class="btn btn-edit" id="btn-cancel-edit">Cancel</button>
                </div>
                <div id="status-msg" class="status-msg"></div>
            `;

    window.updateSelectedAvatar = (id) => {
        selectedAvatar = id;
    };

    document.getElementById('btn-cancel-edit').addEventListener('click', () => {
        isEditing = false;
        selectedAvatar = currentUser.avatar;
        render();
    });

    document.getElementById('btn-save-profile').addEventListener('click', saveProfile);
}

async function saveProfile() {
    const displayname = document.getElementById('edit-displayname').value.trim();
    const btn = document.getElementById('btn-save-profile');
    const status = document.getElementById('status-msg');

    if (displayname.length === 0) {
        status.textContent = 'Display name cannot be empty';
        status.className = 'status-msg status-error';
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

    try {
        const response = await fetch('/auth/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ displayname, avatar: selectedAvatar })
        });

        const data = await response.json();

        if (response.ok) {
            currentUser.displayname = displayname;
            currentUser.avatar = selectedAvatar;
            isEditing = false;
            render();
            const newStatus = document.getElementById('status-msg');
            newStatus.textContent = 'Profile updated successfully!';
            newStatus.className = 'status-msg status-success';
        } else {
            throw new Error(data.message || 'Failed to update profile');
        }
    } catch (err) {
        status.textContent = err.message;
        status.className = 'status-msg status-error';
        btn.disabled = false;
        btn.textContent = 'Save Changes';
    }
}

document.addEventListener('DOMContentLoaded', initDashboardProfile);

