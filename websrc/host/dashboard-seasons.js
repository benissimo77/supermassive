import { initCollapsibles } from '../utils/Collapsible.js';
import { runSave } from '../utils/saveButton.js';

const template = document.getElementById('season-card-template');

function renderSeasonCard(season, { clickable = false, showPublicBadge = false } = {}) {
	const clone = template.content.cloneNode(true);
	const card = clone.querySelector('.season-card');

	if (clickable) {
		card.addEventListener('click', () => location.href = `/host/dashboard/seasons/edit?id=${season._id}`);
	}

	if (season.seriesName) {
		const label = clone.querySelector('.season-series-label');
		label.textContent = season.seriesName;
		label.hidden = false;
	}

	clone.querySelector('.season-name').textContent = season.name;

	const episodeCount = season.episodes?.length || 0;
	clone.querySelector('.season-episode-count').textContent = `${episodeCount} Episode${episodeCount !== 1 ? 's' : ''}`;

	const fmt = d => new Date(d).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
	const dates = [season.startDate && fmt(season.startDate), season.endDate && fmt(season.endDate)]
		.filter(Boolean).join(' – ');
	if (dates) {
		clone.querySelector('.season-dates-sep').hidden = false;
		const datesEl = clone.querySelector('.season-dates');
		datesEl.textContent = dates;
		datesEl.hidden = false;
	}

	if (showPublicBadge && season.isPublic) {
		clone.querySelector('.season-public-sep').hidden = false;
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
