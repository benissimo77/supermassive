import { avatarList, getAvatarUrl } from '../utils/avatars.js';
import { initCollapsibles } from '../utils/Collapsible.js';

/**
 * Leaderboard Logic for SuperMassive
 * Adheres to minimal abstraction and direct API usage.
 */

const globalContainer = document.querySelector('#leaderboard-global-container');
const seasonsGrid = document.querySelector('#leaderboard-grid');

// Templates
const rowTemplate = document.querySelector('#lb-row-template');
const tableTemplate = document.querySelector('#lb-table-template');
const seasonCardTemplate = document.querySelector('#season-card-template');

const MEDALS = ['🥇', '🥈', '🥉'];

export async function initLeaderboard() {
    console.log('[Leaderboard] Initializing...');

    // The global leaderboard <details> card is static markup, present at load
    initCollapsibles(document);

    // 1. Initial Load Global
    loadGlobalLeaderboard();

    // 2. Load Public Seasons
    loadPublicSeasons();
}

async function loadGlobalLeaderboard() {
    if (!globalContainer) return;

    try {
        const res = await fetch('/api/leaderboard/global');
        const data = await res.json();
        const entries = Array.isArray(data) ? data : [];
        
        renderLeaderboard(globalContainer, entries, false);
    } catch (err) {
        console.error('[Leaderboard] Global fetch failed:', err);
        globalContainer.innerHTML = '<div class="leaderboard-status">Failed to load high scores</div>';
    }
}

async function loadPublicSeasons() {
    if (!seasonsGrid) return;

    try {
        const res = await fetch('/api/seasons/public');
        const json = await res.json();
        
        if (!json.success) {
            console.warn('[Leaderboard] Could not load seasons:', json.message);
            return;
        }

        const seasons = json.data || [];
        
        // Fetch leaderboards for each season
        const results = await Promise.all(
            seasons.map(async season => {
                try {
                    const lbRes = await fetch(`/api/leaderboard/season/${season._id}`);
                    const entries = await lbRes.json();
                    return { season, entries: Array.isArray(entries) ? entries : [] };
                } catch (e) {
                    console.error(`[Leaderboard] failed for season ${season._id}:`, e);
                    return { season, entries: [] };
                }
            })
        );

        // Remove loading placeholders if any were added via static HTML
        // (The current HTML has one static sample we might want to keep or replace)
        
        results.forEach(({ season, entries }) => {
            renderSeasonCard(season, entries);
        });
        initCollapsibles(seasonsGrid);

    } catch (err) {
        console.error('[Leaderboard] Seasons fetch failed:', err);
    }
}

/**
 * Renders a standard leaderboard table into a container
 */
function renderLeaderboard(container, entries, showBest5 = false) {
    if (!entries.length) {
        container.innerHTML = '<div class="leaderboard-status">No scores recorded yet</div>';
        return;
    }

    const tableClone = tableTemplate.content.cloneNode(true);
    const tbody = tableClone.querySelector('tbody');
    const thead = tableClone.querySelector('thead tr');

    // Add Best 5 column if needed
    if (showBest5) {
        const th = document.createElement('th');
        th.className = 'lb-best5';
        th.title = 'Sum of top 5 scores';
        th.textContent = 'Best 5 ★';
        thead.appendChild(th);
    }

    entries.forEach((entry, i) => {
        const rank = i + 1;
        const row = rowTemplate.content.cloneNode(true);
        const tr = row.querySelector('tr');
        
        tr.dataset.rank = rank;
        
        // Rank
        row.querySelector('.lb-rank').innerHTML = rank <= 3 ? `<span class="lb-rank-medal">${MEDALS[i]}</span>` : rank;
        
        // Avatar
        const avatarId = entry.avatar || avatarList[0];
        row.querySelector('.lb-avatar img').src = getAvatarUrl(avatarId);
        
        // Stats
        row.querySelector('.lb-name').textContent = entry.playerName || entry.displayName || 'Anonymous';
        row.querySelector('.lb-games').textContent = entry.gameCount || 0;
        row.querySelector('.lb-qs').textContent = entry.totalQuestions || 0;
        row.querySelector('.lb-correct').textContent = entry.totalCorrect || 0;
        
        const acc = entry.totalQuestions > 0 ? Math.round((entry.totalCorrect / entry.totalQuestions) * 100) : 0;
        row.querySelector('.lb-accuracy').textContent = acc + '%';
        
        row.querySelector('.lb-score').textContent = (entry.totalScore || 0).toLocaleString();

        // Best 5
        if (showBest5) {
            const td = document.createElement('td');
            td.className = 'lb-num lb-best5';
            td.textContent = (entry.best5 || 0).toLocaleString();
            tr.appendChild(td);
        }

        tbody.appendChild(row);
    });

    container.innerHTML = '';
    container.appendChild(tableClone);
}

function renderSeasonCard(season, entries) {
    const card = seasonCardTemplate.content.cloneNode(true);
    
    card.querySelector('h2').textContent = season.name;
    
    const subtitleParts = [];
    if (season.seriesName) subtitleParts.push(season.seriesName);
    if (season.startDate) {
        const start = new Date(season.startDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
        subtitleParts.push(start);
    }
    
    card.querySelector('.card-subtitle').textContent = subtitleParts.join(' • ');
    
    const body = card.querySelector('.card-body');
    renderLeaderboard(body, entries, true);
    
    seasonsGrid.appendChild(card);
}

document.addEventListener('DOMContentLoaded', initLeaderboard);
