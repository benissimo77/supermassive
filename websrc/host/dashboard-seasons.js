import { initCollapsibles } from '../utils/Collapsible.js';
import { runSave } from '../utils/saveButton.js';

const template = document.getElementById('season-card-template');

function renderSeasonCard(season, { clickable = false, showPublicBadge = false } = {}) {
	const clone = template.content.cloneNode(true);
	const card = clone.querySelector('.season-card');

	if (clickable) {
		card.classList.add('is-clickable');
		card.addEventListener('click', () => location.href = `/host/dashboard/seasons/edit?id=${season._id}`);

		const deleteBtn = clone.querySelector('.delete-season-item');
		deleteBtn.hidden = false;
		deleteBtn.addEventListener('click', () => {
			if (confirm(`Are you sure you want to delete "${season.name}"? This cannot be undone.`)) {
				deleteSeason(season._id, deleteBtn);
			}
		});
	}

	clone.querySelector('.season-name').textContent = season.name;

	if (season.description) {
		const desc = clone.querySelector('.season-description');
		desc.textContent = season.description;
		desc.hidden = false;
	}

	const episodeCount = season.episodes?.length || 0;
	clone.querySelector('.season-episode-count').textContent = `${episodeCount} Episode${episodeCount !== 1 ? 's' : ''}`;

	if (showPublicBadge && season.isPublic) {
		clone.querySelector('.public-badge').hidden = false;
	}

	return clone;
}

async function loadSeasons() {

	const container = document.getElementById('season-list');
	try {
		const res = await fetch('/api/seasons');
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const { success, data } = await res.json();

		if (!success || data.length === 0) {
			container.innerHTML = `
                        <div class="empty-state">
                            <h3>No Seasons Yet</h3>
                            <p>Create a season to group quizzes into an episode run and track season leaderboards.</p>
                        </div>`;
			return;
		}

		container.innerHTML = '';
		data.forEach(season => container.appendChild(renderSeasonCard(season, { clickable: true, showPublicBadge: true })));
	} catch (err) {
		console.error('Failed to load seasons:', err);
		container.innerHTML = '<div class="empty-state">Failed to load seasons. Please try again.</div>';
	}
}

async function loadPublicSeasons() {
	const container = document.getElementById('public-season-list');
	try {
		const res = await fetch('/api/seasons/public');
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const { success, data } = await res.json();

		if (!success || data.length === 0) {
			container.innerHTML = `
                        <div class="empty-state">
                            <h3>No Public Seasons</h3>
                            <p>When creators mark their seasons as public they will appear here.</p>
                        </div>`;
			return;
		}

		container.innerHTML = '';
		data.forEach(season => container.appendChild(renderSeasonCard(season)));
	} catch (err) {
		console.error('Failed to load public seasons:', err);
		container.innerHTML = '<div class="empty-state">Failed to load public seasons.</div>';
	}
}

async function deleteSeason(seasonId, btn) {
	const result = await runSave(btn, async () => {
		const response = await fetch(`/api/seasons/${seasonId}`, {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' }
		});
		return response.json();
	}, {
		savingText: 'Deleting...',
		onError: (err) => alert('Error deleting season: ' + err.message)
	});
	if (result) loadSeasons();
}

async function createNewSeason() {
	const btn = document.getElementById('new-season-btn');
	const result = await runSave(btn, async () => {
		const res = await fetch('/api/seasons', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: 'New Season' })
		});
		return res.json();
	}, {
		onError: (err) => alert(err.message || 'Failed to create season. Please try again.')
	});
	if (result) location.href = `/host/dashboard/seasons/edit?id=${result.data._id}`;
}

function initDashboardSeasons() {

	console.log('Initializing Dashboard Seasons:: hello.');
	document.getElementById('new-season-btn').addEventListener('click', createNewSeason);
	loadSeasons();
	loadPublicSeasons();

	initCollapsibles(document);
}

document.addEventListener('DOMContentLoaded', initDashboardSeasons);
