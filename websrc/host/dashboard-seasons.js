
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

		container.innerHTML = data.map(season => {
			const episodeCount = season.episodes?.length || 0;
			const fmt = d => new Date(d).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
			const dates = [season.startDate && fmt(season.startDate), season.endDate && fmt(season.endDate)]
				.filter(Boolean).join(' \u2013 ');

			return `
	<div class="season-card card" onclick="location.href='/host/dashboard/seasons/edit?id=${season._id}'">
		<div class="card-body">
			${season.seriesName ? `<div class="season-series-label">${season.seriesName}</div>` : ''}
			<h3 class="season-name">${season.name}</h3>
			<div class="season-meta">
				<span><i class="fa-solid fa-film" style="margin-right:3px; opacity:0.5;"></i>${episodeCount} Episode${episodeCount !== 1 ? 's' : ''}</span>
				${dates ? `<span>&bull;</span><span>${dates}</span>` : ''}
				${season.isPublic ? `<span>&bull;</span><span class="public-badge">Public</span>` : ''}
			</div>
		</div>
	</div>
	`;
		}).join('');
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

		container.innerHTML = data.map(season => {
			const episodeCount = season.episodes?.length || 0;
			const fmt = d => new Date(d).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
			const dates = [season.startDate && fmt(season.startDate), season.endDate && fmt(season.endDate)]
				.filter(Boolean).join(' \u2013 ');
			return `
	<div class="card" style="border-left: 4px solid var(--clr-accent); margin-bottom: 0;">
		<div class="card-body">
			${season.seriesName ? `<div class="season-series-label">${season.seriesName}</div>` : ''}
			<h3 class="season-name">${season.name}</h3>
			<div class="season-meta">
				<span><i class="fa-solid fa-film" style="margin-right:3px; opacity:0.5;"></i>${episodeCount} Episode${episodeCount !== 1 ? 's' : ''}</span>
				${dates ? `<span>&bull;</span><span>${dates}</span>` : ''}
			</div>
		</div>
	</div>
	`;
		}).join('');
	} catch (err) {
		console.error('Failed to load public seasons:', err);
		container.innerHTML = '<div class="empty-state">Failed to load public seasons.</div>';
	}
}

async function createNewSeason() {
	const btn = document.getElementById('new-season-btn');
	btn.disabled = true;
	try {
		const res = await fetch('/api/seasons', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: 'New Season' })
		});
		const result = await res.json();
		if (result.success) {
			location.href = `/host/dashboard/seasons/edit?id=${result.data._id}`;
		} else {
			alert(result.message || 'Failed to create season.');
			btn.disabled = false;
		}
	} catch (err) {
		console.error('Create season error:', err);
		alert('Failed to create season. Please try again.');
		btn.disabled = false;
	}
}

function initDashboardSeasons() {

	console.log('Initializing Dashboard Seasons:: hello.');
	document.getElementById('new-season-btn').addEventListener('click', createNewSeason);
	loadSeasons();
	loadPublicSeasons();

	// Card collapse (matches Quiz Dashboard behaviour)
	document.querySelectorAll('.card-header').forEach(header => {
		header.addEventListener('click', () => {
			header.closest('.card').classList.toggle('collapsed');
		});
	});
}

document.addEventListener('DOMContentLoaded', initDashboardSeasons);
