import { initCollapsibles } from '../utils/Collapsible.js';
import { runSave } from '../utils/saveButton.js';
import { escapeHtml } from '../utils/sanitize.js';

const urlParams = new URLSearchParams(window.location.search);
const seasonID = urlParams.get('id');
let currentSeasonData = null;
let quizList = [];
let hasUnsavedChanges = false;

// Local (not UTC) YYYY-MM-DD, so hosts outside UTC see the day they actually picked
function toDateInputValue(dateLike) {
	if (!dateLike) return '';
	const d = new Date(dateLike);
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

export async function initDashboardSeasonEdit() {
	if (!seasonID) {
		location.href = '/host/dashboard/seasons/';
		return;
	}

	document.querySelectorAll('.save-season-btn').forEach(btn => btn.addEventListener('click', saveAll));

	// Collapsing the season card collapses all episode cards inside it, matching the Quiz Editor's round/question behaviour
	initCollapsibles(document);

	// One delegated listener on the whole season panel handles all inputs (metadata + episodes)
	document.getElementById('season-details').addEventListener('input', markDirty);
	document.getElementById('season-details').addEventListener('change', markDirty);

	if (window.Sortable) {
		new Sortable(document.getElementById('episode-list'), {
			animation: 150,
			handle: '.card-header',
			onSort: () => { addEpisodeNumbers(); markDirty(); }
		});
	}

	await loadQuizLibrary(); // load quiz list before rendering episodes
	await loadSeasonData();
}

function addEpisodeNumbers() {
	const list = document.getElementById('episode-list');
	const cards = list.querySelectorAll('.episode-card');
	cards.forEach((card, i) => {
		const numberSpan = card.querySelector('summary span');
		if (numberSpan) {
			numberSpan.textContent = i + 1;
		}
	});
}

async function loadSeasonData() {
	try {
		const res = await fetch(`/api/seasons/${seasonID}`);
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const { success, data } = await res.json();
		if (!success) throw new Error('Load failed');

		currentSeasonData = data;

		// Populate inline editor fields
		document.getElementById('header-season-name').textContent = data.name || '';
		document.getElementById('season-name-input').value = data.name || '';
		document.getElementById('season-desc-input').value = data.description || '';
		document.getElementById('season-start-input').value = data.startDate
			? toDateInputValue(data.startDate) : '';
		document.getElementById('season-end-input').value = data.endDate
			? toDateInputValue(data.endDate) : '';
		document.getElementById('season-default-time-input').value = data.defaultTime || '18:00';
		// Capture the creator's timezone once so viewer-local conversion is possible later; never overwritten after that
		currentSeasonData = { ...data, timezone: data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone };
		document.getElementById('season-public-input').checked = !!data.isPublic;

		// Add change handler to update the season name when input value changes
		document.getElementById('season-name-input').addEventListener('input', (e) => {
			document.getElementById('header-season-name').textContent = e.target.value || '';
		});
		renderEpisodes(data.episodes || []);

	} catch (err) {
		console.error('Failed to load season:', err);
	}
}

// Builds one episode card from an episode object \u2014 {_id, quizID, airDate, airTime}. quizID may be
// either a populated {_id, title} (from the server) or absent (a not-yet-saved blank episode).
function createEpisodeCard(ep) {
	const currentQuizId = ep.quizID?._id || '';
	const template = document.getElementById('episode-template');
	const clone = template.content.cloneNode(true);

	// data-episode-id is the episode's own subdocument ID (not the linked quiz's ID) so delete targets the right episode.
	// A not-yet-saved episode has no id yet, hence the '' fallback.
	clone.querySelector('.episode-card').setAttribute('data-episode-id', ep._id || '');

	const summary = clone.querySelector('summary');
	summary.querySelector('.episode-title').textContent = ep.quizID?.title || 'No quiz selected';

	// Provide a drop-down with all the quizzes for selection
	const select = clone.querySelector('select');
	select.innerHTML = '<option value="">\u2014 Select quiz \u2014</option>' +
		quizList.map(q =>
			`<option value="${q._id}" ${q._id === currentQuizId ? 'selected' : ''}>${escapeHtml(q.title)}</option>`
		).join('');

	// Add click handlers for the buttons
	const playBtn = clone.querySelector('.btn-accent');
	playBtn.addEventListener('click', () => {
		window.playEpisode(currentQuizId);
	});

	const deleteBtn = clone.querySelector('.btn-danger');
	deleteBtn.addEventListener('click', () => {
		window.deleteEpisode(ep._id || '');
	});

	// Add air date and time inputs
	clone.querySelector('.ep-airdate-input').value = ep.airDate ? toDateInputValue(ep.airDate) : '';
	clone.querySelector('.ep-airtime-input').value = ep.airTime || '';

	return clone.querySelector('.episode-card');
}

function renderEpisodes(episodes) {

	if (episodes.length === 0) {
		return;
	}

	const list = document.getElementById('episode-list');
	const emptyState = list.querySelector('.empty-state');
	if (emptyState) {
		emptyState.style.display = 'none';
	}
	list.innerHTML = '';

	episodes.forEach(ep => list.appendChild(createEpisodeCard(ep)));

	addEpisodeNumbers();
	initCollapsibles(list);
}


async function loadQuizLibrary() {
	try {
		const res = await fetch('/api/quiz');
		const { success, data } = await res.json();
		if (success) {
			quizList = data;
		}
	} catch (err) {
		console.error('Failed to load quiz library', err);
	}
}

window.playEpisode = (quizID) => {
	location.href = `/host/quiz/start?q=${quizID}&s=${seasonID}`;
};

// Seasons are now saved as a whole object (see saveAll), so deleting an episode just means
// removing it from the DOM and re-saving the entire season via the same POST used for Save.
window.deleteEpisode = async (episodeId) => {
	if (!confirm('Delete this episode?')) return;
	markDirty();
	const card = document.querySelector(`.episode-card[data-episode-id="${episodeId}"]`);
	if (card) card.remove();
	addEpisodeNumbers();
	await saveAll();
	await loadSeasonData();
};

// Add Episode inline — an episode is never created on its own; add a blank card to the DOM
// and save the whole season in one go, the same single POST every other change goes through.
window.addEpisodeInline = async () => {
	const btn = document.querySelector('.btn-episode');
	btn.disabled = true;
	try {
		const list = document.getElementById('episode-list');
		const emptyState = list.querySelector('.empty-state');
		if (emptyState) emptyState.style.display = 'none';

		list.appendChild(createEpisodeCard({ _id: '', quizID: null, airDate: null, airTime: null }));
		addEpisodeNumbers();
		initCollapsibles(list);
		markDirty();

		const saved = await saveAll();
		if (saved) {
			await loadSeasonData();
			const cards = document.querySelectorAll('.episode-card');
			if (cards.length) cards[cards.length - 1].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		}
		// If the save failed, leave the new blank card and dirty state in place so the user can retry via Save Season.
	} finally {
		btn.disabled = false;
	}
};

// Dirty tracking — red outline on Save buttons, matching Quiz Editor
function markDirty() {
	hasUnsavedChanges = true;
	document.querySelectorAll('.btn-save-all').forEach(b => b.classList.add('unsaved-changes'));
}

function clearDirty() {
	hasUnsavedChanges = false;
	document.querySelectorAll('.btn-save-all').forEach(b => b.classList.remove('unsaved-changes'));
}

window.addEventListener('beforeunload', (e) => {
	if (hasUnsavedChanges) e.returnValue = 'Unsaved changes!';
});

// Update episode summary title when the quiz select changes
window.updateEpisodeTitle = (selectEl) => {
	const titleSpan = selectEl.closest('.episode-card').querySelector('.episode-title');
	const opt = selectEl.options[selectEl.selectedIndex];
	if (titleSpan && opt) titleSpan.textContent = opt.text;
};

// Save All: season metadata + all episode fields in parallel
async function saveAll() {

	const buttons = Array.from(document.querySelectorAll('.save-season-btn'));

	// 1. Season metadata
	const seasonBody = {
		name: document.getElementById('season-name-input').value,
		description: document.getElementById('season-desc-input').value || null,
		startDate: document.getElementById('season-start-input').value || null,
		endDate: document.getElementById('season-end-input').value || null,
		defaultTime: document.getElementById('season-default-time-input').value || '18:00',
		timezone: currentSeasonData?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
		isPublic: document.getElementById('season-public-input').checked
	};

	// 2. Episode inline fields — add to seasonBody and then POST entire object
	const episodeCards = document.querySelectorAll('.episode-card[data-episode-id]');
	const episodes = Array.from(episodeCards).map(card => {
		const quizID = card.querySelector('select').options[card.querySelector('select').selectedIndex].value || null;
		const airDate = card.querySelector('.ep-airdate-input').value;
		const airTime = card.querySelector('.ep-airtime-input').value;

		return {
			quizID,
			airDate: airDate || null,
			airTime: airTime || null
		};
	});

	seasonBody.episodes = episodes;

	const result = await runSave(buttons, async () => {
		const res = await fetch(`/api/seasons/${seasonID}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(seasonBody)
		});
		return res.json();
	}, {
		onError: (err) => alert(err.message || 'Network error. Please try again.')
	});

	if (result) clearDirty();
	return result;
}

document.addEventListener('DOMContentLoaded', initDashboardSeasonEdit);
	

