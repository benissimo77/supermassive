import { Modal } from '../utils/Modal.js';
import { getAvatarUrl } from '../utils/avatars.js';
import { initCollapsibles } from '../utils/Collapsible.js';
import { runSave } from '../utils/saveButton.js';

let currentUser = null;
let inviteModal = null;
let createModal = null;

async function initDashboardLeagues() {

	currentUser = await fetchCurrentUser();
	console.log('Current user:', currentUser);

	setupGlobalHandlers(document.body);

	renderLeagues();
}

async function fetchLeagues() {
	const res = await fetch('/api/league/list');
	if (!res.ok) throw new Error('Failed to load');
	return res.json();
}


async function fetchCurrentUser() {
	try {
		const res = await fetch('/auth/me');
		if (res.ok) {
			const json = await res.json();
			return (json && json.success && json.data) ? json.data.user : null;
		}
	} catch (e) {
		console.error('Auth check failed', e);
	}
	return null;
}

function renderLeague(league, container) {

	// Top of page if we have just arrived via an email invite link then display the joined league banner
	const joinedLeague = new URLSearchParams(window.location.search).get('joinedLeague');
	if (joinedLeague) {
		const joinedLeagueBanner = document.getElementById('joined-league-banner');
		if (joinedLeagueBanner) {
			joinedLeagueBanner.style.display = 'flex';
			const leagueNameEl = document.getElementById('joined-league-name');
			if (leagueNameEl) {
				leagueNameEl.textContent = joinedLeague;
			}
		}
	}

	const leagueTemplate = document.getElementById('league-template');
	const clone = leagueTemplate.content.cloneNode(true);
	const card = clone.querySelector('.card.league-card');
	card.dataset.id = league._id;
	card.querySelector('.league-name').textContent = league.name;
	card.querySelector('.league-slogan').textContent = league.visuals?.motto || league.slogan || '';

	const isOwner = currentUser && String(currentUser._id) === String(league.ownerID);
	const inviteBtn = card.querySelector('.btn-invite');
	if (inviteBtn) {
		inviteBtn.dataset.id = league._id;
		if (isOwner) {
			// only show button if user is owner
		} else {
			inviteBtn.remove();
		}
	}

	container.appendChild(clone);

	// League has been added now add the members
	const members = league.members || [];
	const statusEl = card.querySelector('.league-status');
	const membersList = card.querySelector('.members-list');
	const membersTable = card.querySelector('.members-table');

	if (!members.length) {
		if (statusEl) statusEl.textContent = 'No members yet';
		if (membersTable) membersTable.style.display = 'none';
		return;
	}

	if (statusEl) statusEl.style.display = 'none';
	if (membersTable) membersTable.style.display = 'table';
	if (!membersList) return;

	membersList.innerHTML = '';
	const rowTemplate = document.getElementById('league-member-row-template');

	console.log('Rendering members for league', league.name, 'members:', members, currentUser, league);
	for (const member of members) {

		const clone = rowTemplate.content.cloneNode(true);
		const row = clone.querySelector('.member-row');
		const img = row.querySelector('.member-avatar');

		console.log('Rendering member', member.displayname, member.email, member.avatar, typeof member.avatar);

		// If avatar img is an absolute URL use it directrly, otherwise treat it as an ID and attempt to load from our image route (with fallback to default avatar on error)
		img.src = member.avatar ? (typeof member.avatar === 'string' && member.avatar.startsWith('http') ? member.avatar : getAvatarUrl(member.avatar)) : getAvatarUrl('default');
		// img.onerror = () => {
		// 	console.log('Avatar load error for member', member.displayname, 'with avatar', member.avatar);
		// 	img.onerror = null;
		// 	img.src = '/img/default-avatar.png'; 
		// };

		row.querySelector('.member-name').textContent = member.displayname || 'Player';
		row.querySelector('.member-email').textContent = member.email || '';

		const removeBtn = row.querySelector('.btn-remove');
		removeBtn.dataset.id = member._id;
		removeBtn.dataset.league = league._id;

		if (isOwner) {
			if (String(member._id) === String(league.ownerID)) {
				removeBtn.remove();
			}
		} else {
			if (String(member._id) === String(currentUser._id)) {
				removeBtn.textContent = 'Leave';
			} else {
				removeBtn.remove();
			}
		}
		membersList.appendChild(clone);
	}
}

async function renderLeagues() {

	try {

		const allLeagues = await fetchLeagues();
		console.log('Leagues:', allLeagues);

		const leaguesOwned = allLeagues.filter(l => String(l.ownerID) === String(currentUser?._id));
		const leaguesMemberOf = allLeagues.filter(l => l.members.some(m => String(m._id) === String(currentUser?._id)) && String(l.ownerID) !== String(currentUser?._id));
		console.log('Leagues owned:', leaguesOwned);
		console.log('Leagues member of:', leaguesMemberOf);

		// First do for the leagues I own
		if (leaguesOwned && leaguesOwned.length > 0) {

			const container = document.getElementById('league-list');
			if (container) {
				container.innerHTML = '';
				for (const league of leaguesOwned) {
					renderLeague(league, container);
				}
			}
		}
		// Now repeat above but checking for membership instead of ownership
		if (leaguesMemberOf && leaguesMemberOf.length > 0) {

			const container = document.getElementById('member-league-list');
			if (container) {
				container.innerHTML = '';
				for (const league of leaguesMemberOf) {
					renderLeague(league, container);
				}
			}
		}

		initCollapsibles(document);

	} catch (err) {
		console.error('Load leagues error:', err);
		const ownedContainer = document.getElementById('league-list');
		const memberContainer = document.getElementById('member-league-list');
		if (ownedContainer) ownedContainer.innerHTML = '<div class="league-status">Failed to load leagues</div>';
		if (memberContainer) memberContainer.innerHTML = '<div class="league-status">Failed to load leagues</div>';
	}
}

function setupGlobalHandlers(container) {
	// Delegate clicks
	container.addEventListener('click', (ev) => {
		const btn = ev.target.closest('.btn-invite');
		if (btn) {
			ev.stopPropagation();
			openInviteModal(btn.dataset.id);
			return;
		}

		const rem = ev.target.closest('.btn-remove');
		if (rem) {
			ev.stopPropagation();
			handleRemoveMember(rem);
			return;
		}
	});
}

function openInviteModal(leagueID) {
	if (!inviteModal) {
		initInviteModal();
	}
	inviteModal.show({ league: leagueID });
}

async function handleRemoveMember(btn) {
	const playerID = btn.dataset.id;
	const leagueID = btn.dataset.league;
	if (!confirm('Remove this member from the league?')) return;

	try {
		const res = await fetch(`/api/league/${leagueID}/remove/${playerID}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' }
		});
		const json = await res.json();
		if (!res.ok) throw new Error(json.error || 'Remove failed');

		// Simply re-render the screen
		await renderLeagues();

	} catch (err) {
		console.error('Remove error:', err);
		alert('Failed to remove member: ' + err.message);
	}
}

function initInviteModal() {
	inviteModal = new Modal('invite-modal');
	const emailsInput = inviteModal.querySelector('.invite-emails');
	const statusEl = inviteModal.querySelector('.invite-status');
	const urlInput = inviteModal.querySelector('.invite-url');

	inviteModal.onShow = async (data) => {
		emailsInput.value = '';
		urlInput.value = '';
		if (statusEl) statusEl.textContent = '';

		// Pre-generate token
		// try {
		// 	const url = await ensureTokenAndUrl(data.league);
		// 	if (urlInput) urlInput.value = url;
		// } catch (e) {
		// 	console.warn('Failed to pre-generate token', e);
		// }
	};

	inviteModal.addEventListener('click', async (ev) => {
		const sendBtn = ev.target.closest('.btn-send-email');
		if (sendBtn) {
			const emailsRaw = emailsInput.value.trim();
			const recipients = emailsRaw ? emailsRaw.split(/[\s,;]+/).filter(Boolean) : [];
			const leagueID = inviteModal.modal.dataset.league;

			if (recipients.length === 0) {
				if (statusEl) statusEl.textContent = 'Please enter at least one email address';
				emailsInput.focus();
				return;
			}

			if (statusEl) statusEl.textContent = 'Sending invites...';
			const result = await runSave(sendBtn, async () => {
				const res = await fetch(`/api/league/${leagueID}/invite`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ emails: recipients })
				});
				const json = await res.json();
				if (!res.ok) throw new Error(json.error || 'Invite send failed');
				return json;
			}, {
				savingText: 'Sending...',
				onError: (err) => { if (statusEl) statusEl.textContent = 'Failed to send invite: ' + err.message; }
			});

			if (result) {
				if (statusEl) statusEl.textContent = 'Invite emails sent';
				setTimeout(() => inviteModal.hide(), 1500);
			}
		}

		const copyBtn = ev.target.closest('.btn-copy');
		if (copyBtn) {
			try {
				let url = urlInput.value;
				if (!url) url = await ensureTokenAndUrl(inviteModal.modal.dataset.league);
				await navigator.clipboard.writeText(url);
				const originalText = copyBtn.innerHTML;
				copyBtn.textContent = 'Copied';
				setTimeout(() => copyBtn.innerHTML = originalText, 1500);
			} catch (err) {
				if (statusEl) statusEl.textContent = 'Copy failed';
			}
		}
	});
}

async function ensureTokenAndUrl(leagueID) {
	if (!leagueID) return '';
	const res = await fetch(`/api/league/${leagueID}/invite`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' }
	});
	const json = await res.json();
	if (!res.ok) throw new Error(json.error || 'Invite failed');
	const token = (json.invite && json.invite.token) || json.token || '';
	return `${location.origin}/host/join-league?token=${encodeURIComponent(token)}`;
}

function initCreateModal() {
	createModal = new Modal('create-league-modal');
	const nameInput = createModal.querySelector('#league-name-input');
	const sloganInput = createModal.querySelector('#league-slogan-input');
	const saveBtn = createModal.querySelector('.btn-save-league');

	createModal.onShow = () => {
		nameInput.value = '';
		sloganInput.value = '';
		nameInput.focus();
	};

	saveBtn.addEventListener('click', async () => {
		const name = nameInput.value.trim();
		const slogan = sloganInput.value.trim();
		if (!name) {
			alert('Please enter a league name');
			nameInput.focus();
			return;
		}

		const result = await runSave(saveBtn, async () => {
			const res = await fetch('/api/league/create', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, slogan })
			});
			const json = await res.json();
			if (!res.ok) throw new Error(json.error || json.message || 'Create failed');
			return json;
		}, {
			onError: (err) => alert('Failed to create league: ' + err.message)
		});

		if (result) {
			createModal.hide();
			await renderLeagues();
		}
	});

	// Also handle Enter key in inputs
	const handleEnter = (e) => {
		if (e.key === 'Enter') saveBtn.click();
	};
	nameInput.addEventListener('keypress', handleEnter);
	sloganInput.addEventListener('keypress', handleEnter);
}

// Initialize create league button once globally
const btnCreate = document.getElementById('btn-create-league');
if (btnCreate) {
	btnCreate.onclick = (e) => {
		e.preventDefault();
		if (!createModal) initCreateModal();
		createModal.show();
	};
}

document.addEventListener('DOMContentLoaded', initDashboardLeagues);
