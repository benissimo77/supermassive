const urlParams = new URLSearchParams(window.location.search);
const seasonID = urlParams.get('id');
let currentSeasonData = null;
let quizList = [];

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
	document.getElementById('save-season-btn').addEventListener('click', saveAll);
	// One delegated listener on the whole season panel handles all inputs (metadata + episodes)
	document.getElementById('season-details').addEventListener('input', markDirty);
	document.getElementById('season-details').addEventListener('change', markDirty);

	await loadQuizLibrary(); // load quiz list before rendering episodes
	await loadSeasonData();
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
		document.getElementById('season-series-input').value = data.seriesName || '';
		document.getElementById('season-desc-input').value = data.description || '';
		document.getElementById('season-start-input').value = data.startDate
			? toDateInputValue(data.startDate) : '';
		document.getElementById('season-end-input').value = data.endDate
			? toDateInputValue(data.endDate) : '';
		document.getElementById('season-default-time-input').value = data.defaultTime || '18:00';
		// Capture the creator's timezone once so viewer-local conversion is possible later; never overwritten after that
		currentSeasonData = { ...data, timezone: data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone };
		document.getElementById('season-public-input').checked = !!data.isPublic;

		renderEpisodes(data.episodes || []);

	} catch (err) {
		console.error('Failed to load season:', err);
	}
}

function renderEpisodes(episodes) {
	const list = document.getElementById('episode-list');
	if (episodes.length === 0) {
		list.innerHTML = '<div class="empty-state" style="margin-top: 1rem;"><h3>No Episodes Yet</h3><p>Click \'Add Episode\' to attach a quiz to this season.</p></div>';
		return;
	}

	const defaultTime = currentSeasonData?.defaultTime || '18:00';
	list.innerHTML = episodes.map((ep, i) => {
		const currentQuizId = ep.quizID?._id || '';
		const quizTitle = ep.quizID?.title || 'No quiz selected';
		const quizOptions = '<option value="">\u2014 select quiz \u2014</option>' +
			quizList.map(q =>
				`<option value="${q._id}" ${q._id === currentQuizId ? 'selected' : ''}>${q.title}</option>`
			).join('');
		const hostNowBtn = currentQuizId ? `
                            <button class="btn btn-primary btn-sm" onclick="playEpisode('${currentQuizId}')">
                                <i class="fa-solid fa-play"></i>
                                Host Now
                            </button>` : '';
		return `
                <details class="card episode-card" open data-episode-id="${ep._id}">
                    <summary class="card-header">
                        <div class="flex items-center gap-sm" style="flex: 1; min-width: 0;">
                            <span style="font-size: 1.1rem; font-weight: 800; color: var(--clr-text-muted); opacity: 0.4; min-width: 1.8rem;">${i + 1}</span>
                            <span class="ep-quiz-title" style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${quizTitle}</span>
                            ${ep.label ? `<span style="color: var(--clr-text-muted); font-size: 0.85rem; white-space: nowrap;">&mdash; ${ep.label}</span>` : ''}
                        </div>
                        <div class="flex gap-sm" onclick="event.stopPropagation()">
                            <button class="btn btn-xs btn-danger" onclick="deleteEpisode('${ep._id}')">
                                <i class="fa-solid fa-trash"></i>
                                Delete
                            </button>
                        </div>
                    </summary>
                    <div class="card-body">
                        <div class="form-grid mb-md">
                            <label>Quiz</label>
                            <select class="ep-quiz-input" onchange="updateEpisodeTitle(this)">${quizOptions}</select>
                            <label>Episode Label</label>
                            <input type="text" class="ep-label-input" placeholder="e.g. Episode 1: Movie Night" value="${ep.label || ''}">
                            <label>Air Date</label>
                            <input type="date" class="ep-airdate-input" value="${ep.airDate ? toDateInputValue(ep.airDate) : ''}">
                            <label>Air Time</label>
                            <input type="time" class="ep-airtime-input" value="${ep.airTime || ''}" placeholder="Default: ${defaultTime}" title="Leave blank to use the season default time (${defaultTime})" step="300">
                        </div>
                        <div class="flex justify-end">
                            ${hostNowBtn}
                        </div>
                    </div>
                </details>
                `;
	}).join('');
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

window.deleteEpisode = async (episodeId) => {
	if (!confirm('Delete this episode?')) return;
	try {
		const res = await fetch(`/api/seasons/${seasonID}/episodes/${episodeId}`, { method: 'DELETE' });
		const result = await res.json();
		if (result.success) {
			await loadSeasonData();
		} else {
			alert(result.message || 'Failed to remove episode.');
		}
	} catch (err) {
		console.error('Delete episode error:', err);
		alert('Network error. Please try again.');
	}
};

// Add Episode inline — POST a blank episode, re-render with new card open
window.addEpisodeInline = async () => {
	const btn = document.querySelector('.btn-episode');
	btn.disabled = true;
	try {
		const epCount = document.querySelectorAll('.episode-card[data-episode-id]').length;
		const res = await fetch(`/api/seasons/${seasonID}/episodes`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ label: `Episode ${epCount + 1}` })
		});
		const result = await res.json();
		if (result.success) {
			await loadSeasonData();
			const cards = document.querySelectorAll('.episode-card');
			if (cards.length) cards[cards.length - 1].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		} else {
			alert(result.message || 'Failed to add episode.');
		}
	} catch (err) {
		console.error('Add episode error:', err);
		alert('Network error. Please try again.');
	} finally {
		btn.disabled = false;
	}
};

// Dirty tracking — red outline on Save buttons, matching Quiz Editor
function markDirty() {
	document.querySelectorAll('.btn-save-all').forEach(b => b.classList.add('unsaved-changes'));
}

function clearDirty() {
	document.querySelectorAll('.btn-save-all').forEach(b => b.classList.remove('unsaved-changes'));
}

// Update episode summary title when the quiz select changes
window.updateEpisodeTitle = (selectEl) => {
	const titleSpan = selectEl.closest('.episode-card').querySelector('.ep-quiz-title');
	const opt = selectEl.options[selectEl.selectedIndex];
	if (titleSpan && opt) titleSpan.textContent = opt.text;
};

// Save All: season metadata + all episode fields in parallel
async function saveAll() {
	const btn = document.getElementById('save-season-btn');
	btn.disabled = true;
	try {
		// 1. Season metadata
		const seasonBody = {
			name: document.getElementById('season-name-input').value,
			seriesName: document.getElementById('season-series-input').value || null,
			description: document.getElementById('season-desc-input').value || null,
			startDate: document.getElementById('season-start-input').value || null,
			endDate: document.getElementById('season-end-input').value || null,
			defaultTime: document.getElementById('season-default-time-input').value || '18:00',
			timezone: currentSeasonData?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
			isPublic: document.getElementById('season-public-input').checked
		};
		const seasonRes = await fetch(`/api/seasons/${seasonID}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(seasonBody)
		});
		const seasonResult = await seasonRes.json();
		if (!seasonResult.success) {
			alert(seasonResult.message || 'Failed to save season.');
			return;
		}
		document.getElementById('header-season-name').textContent = seasonBody.name;
		currentSeasonData = { ...currentSeasonData, ...seasonBody };

		// 2. Episode inline fields — patch each in parallel
		const episodeCards = document.querySelectorAll('.episode-card[data-episode-id]');
		await Promise.all(Array.from(episodeCards).map(card => {
			const epId = card.dataset.episodeId;
			const quizID = card.querySelector('.ep-quiz-input')?.value || null;
			const label = card.querySelector('.ep-label-input').value;
			const airDate = card.querySelector('.ep-airdate-input').value;
			const airTime = card.querySelector('.ep-airtime-input').value;
			return fetch(`/api/seasons/${seasonID}/episodes/${epId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ quizID, label, airDate: airDate || null, airTime: airTime || null })
			});
		}));
		clearDirty();
	} catch (err) {
		console.error('Save error:', err);
		alert('Network error. Please try again.');
	} finally {
		btn.disabled = false;
	}
}

document.addEventListener('DOMContentLoaded', initDashboardSeasonEdit);
	

