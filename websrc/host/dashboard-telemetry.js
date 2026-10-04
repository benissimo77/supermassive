import { initCollapsibles } from '../utils/Collapsible.js';

/**
 * Telemetry Dashboard Logic for SuperMassive
 * Adheres to minimal abstraction and direct API usage: one fetch of everything, then every
 * chart/table is just a filter over the in-memory result - no further network calls.
 */

// The UMD script-tag build of chartjs-plugin-annotation does NOT auto-register itself with
// Chart.js (unlike some other Chart.js plugins) - without this, the disconnect-line annotations
// on the latency chart are silently ignored rather than erroring, which is why "add annotations"
// alone wasn't enough.
if (window.Chart && window['chartjs-plugin-annotation']) {
    Chart.register(window['chartjs-plugin-annotation']);
}

// The full payload from /api/telemetry/all, kept in memory - every view below is derived from this.
let rawData = { sessions: [], clients: [], latencySamples: [], disconnects: [], staleResponses: [], devices: [], eventLoopLag: [] };

// Server event loop lag is a single, process-wide signal (not per-client), so it gets its own
// toggle rather than fitting into excludedClientIds - shown by default, same as clients.
let showEventLoopLag = true;
const EVENT_LOOP_LAG_COLOR = '#1e293b';

// Single filter-state object, reused by every dataset via applyFilters(). Adding a new filter
// dimension later is: one more field here, one more check in applyFilters, one more control in
// the HTML - no restructuring.
const filters = {
    dateFrom: null,
    dateTo: null,
    gameType: null,
    OS: null,
    browser: null,
    sessionId: null
};

// Clients explicitly hidden via badge click. Absent from this set = shown (default is "all shown").
const excludedClientIds = new Set();

// Above this many matching clients, individual badges/per-client charts stop being practical -
// fall back to bulk Host/Player filtering and aggregate (non-grouped) charts instead.
const CLIENT_BADGE_THRESHOLD = 30;

const CLIENT_COLORS = ['#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];
function colorForIndex(i) {
    return CLIENT_COLORS[i % CLIENT_COLORS.length];
}

// Colour is keyed by clientId, not by position in whichever filtered/visible subset happens to
// be rendered at the time - badges and charts otherwise iterate different subsets (badges show
// every filtered client, charts only the visible ones), so index-based colour would drift out of
// sync as soon as anything gets excluded. Assigned once, in the stable order clients first
// appear in rawData.clients, so every client keeps the same colour for the whole page session.
const clientColorMap = new Map();
function assignClientColors() {
    clientColorMap.clear();
    rawData.clients.forEach((c) => {
        if (!clientColorMap.has(c.clientId)) {
            clientColorMap.set(c.clientId, colorForIndex(clientColorMap.size));
        }
    });
}
function getClientColor(clientId) {
    return clientColorMap.get(clientId) || '#64748b';
}

const charts = {};

// skip lets a caller compute "what would still match if this one filter weren't applied" - used
// to compute OS/browser badge options so picking one doesn't hide the others (see renderOsBrowserBadges).
function applyFilters(records, skip = []) {
    return records.filter((r) => {
        if (!skip.includes('gameType') && filters.gameType && r.gameType !== filters.gameType) return false;
        if (!skip.includes('OS') && filters.OS && r.OS !== filters.OS) return false;
        if (!skip.includes('browser') && filters.browser && r.browser !== filters.browser) return false;
        if (!skip.includes('sessionId') && filters.sessionId && r.sessionId !== filters.sessionId) return false;
        if (!skip.includes('date')) {
            const ts = r.startTime || r.timestamp;
            if (filters.dateFrom && ts && new Date(ts) < new Date(filters.dateFrom)) return false;
            if (filters.dateTo && ts && new Date(ts) > new Date(filters.dateTo)) return false;
        }
        return true;
    });
}

function fillSelect(id, values) {
    const select = document.getElementById(id);
    if (!select) return;
    const current = select.value;
    select.innerHTML = '<option value="">All</option>' + values.map(v => `<option value="${v}">${v}</option>`).join('');
    select.value = current;
}

function populateFilterOptions() {
    // Only gameType stays a top-level (session-level) filter - OS/browser are client-level
    // properties (a session can mix OSes/browsers), so they're quick-filter badges in the
    // Clients section instead (see renderOsBrowserBadges).
    const gameTypes = [...new Set(rawData.sessions.map(s => s.gameType).filter(Boolean))];
    fillSelect('filter-gameType', gameTypes);
}

function renderSessionsTable(sessions) {
    const tbody = document.querySelector('#sessions-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    sessions.forEach((s) => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';

        const cells = [
            s.roomCode || '',
            s.gameType || '',
            s.startTime ? new Date(s.startTime).toLocaleString() : '',
            s.duration ?? '',
            s.totalPlayers ?? '',
            s.totalHosts ?? ''
        ];
        cells.forEach((value) => {
            const td = document.createElement('td');
            td.textContent = value;
            tr.appendChild(td);
        });

        tr.addEventListener('click', () => {
            filters.sessionId = s.sessionId;
            rerenderAll();
        });
        tbody.appendChild(tr);
    });

    const subtitle = document.getElementById('sessions-subtitle');
    if (subtitle) subtitle.textContent = `${sessions.length} session(s)`;
}

// --- Client badges (item 1-4: per-client grouping, selection, bulk host/player toggles) ---

function styleBadge(el, color, selected) {
    el.classList.add('pill');
    el.style.setProperty('--pill-color', color);
    el.classList.toggle('pill--selected', selected);
}

function makeBulkBadge(label, group) {
    const btn = document.createElement('button');
    btn.type = 'button';
    const allSelected = group.length > 0 && group.every(c => !excludedClientIds.has(c.clientId));
    btn.textContent = `${label} (${group.length})`;
    styleBadge(btn, '#64748b', allSelected);
    btn.addEventListener('click', () => {
        if (allSelected) {
            group.forEach(c => excludedClientIds.add(c.clientId));
        } else {
            group.forEach(c => excludedClientIds.delete(c.clientId));
        }
        rerenderAll();
    });
    return btn;
}

function makeEventLoopLagBadge() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Server Event Loop Lag';
    styleBadge(btn, EVENT_LOOP_LAG_COLOR, showEventLoopLag);
    btn.addEventListener('click', () => {
        showEventLoopLag = !showEventLoopLag;
        rerenderAll();
    });
    return btn;
}

function makeClientBadge(client) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = client.name || client.clientId.slice(0, 8);
    const selected = !excludedClientIds.has(client.clientId);
    styleBadge(btn, getClientColor(client.clientId), selected);
    btn.addEventListener('click', () => {
        if (excludedClientIds.has(client.clientId)) {
            excludedClientIds.delete(client.clientId);
        } else {
            excludedClientIds.add(client.clientId);
        }
        rerenderAll();
    });
    return btn;
}

// Single-select quick filter: clicking the already-active value clears it, clicking another
// value switches to it. Same underlying filters.OS/filters.browser used by applyFilters().
function makeFilterBadge(value, field, color) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = value;
    const selected = filters[field] === value;
    styleBadge(btn, color, selected);
    btn.addEventListener('click', () => {
        filters[field] = filters[field] === value ? null : value;
        rerenderAll();
    });
    return btn;
}

// OS/browser are client-level properties (a session can mix OSes/browsers), so their filter
// options are computed from clients, not sessions - and each is computed ignoring its own
// current selection (via applyFilters' skip param) so picking one doesn't hide the others.
function renderOsBrowserBadges() {
    const osContainer = document.getElementById('client-badges-os');
    const browserContainer = document.getElementById('client-badges-browser');
    if (!osContainer || !browserContainer) return;

    const OSes = [...new Set(applyFilters(rawData.clients, ['OS']).map(c => c.OS).filter(Boolean))];
    const browsers = [...new Set(applyFilters(rawData.clients, ['browser']).map(c => c.browser).filter(Boolean))];

    osContainer.innerHTML = '';
    OSes.forEach(os => osContainer.appendChild(makeFilterBadge(os, 'OS', '#0ea5e9')));

    browserContainer.innerHTML = '';
    browsers.forEach(b => browserContainer.appendChild(makeFilterBadge(b, 'browser', '#f43f5e')));
}

function renderClientBadges(filteredClients) {
    const badgeContainer = document.getElementById('client-badges');
    const bulkContainer = document.getElementById('client-badges-bulk');
    const warning = document.getElementById('client-badges-warning');
    if (!badgeContainer || !bulkContainer || !warning) return;

    // Bulk Host/Player toggles always render, regardless of the threshold below - they're a
    // useful filter even when there are too many individual clients to badge one by one.
    bulkContainer.innerHTML = '';
    bulkContainer.appendChild(makeBulkBadge('All Hosts', filteredClients.filter(c => c.host)));
    bulkContainer.appendChild(makeBulkBadge('All Players', filteredClients.filter(c => !c.host)));
    bulkContainer.appendChild(makeEventLoopLagBadge());

    if (filteredClients.length > CLIENT_BADGE_THRESHOLD) {
        badgeContainer.innerHTML = '';
        warning.style.display = '';
        warning.textContent = `${filteredClients.length} clients match your filters - narrow the filters above (date range, game type, session) to ${CLIENT_BADGE_THRESHOLD} or fewer to see individual client badges and per-client charts. The charts below still respect the Host/Player toggles.`;
        return;
    }

    warning.style.display = 'none';
    badgeContainer.innerHTML = '';
    filteredClients.forEach((c) => badgeContainer.appendChild(makeClientBadge(c)));
}

function renderStaleTable(entries) {
    const tbody = document.querySelector('#stale-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    entries.forEach((e) => {
        const tr = document.createElement('tr');
        const cells = [
            e.sessionId,
            e.timestamp ? new Date(e.timestamp).toLocaleString() : '',
            e.receivedQuestionNumber,
            e.currentQuestionNumber,
            e.gap,
            e.answer ?? ''
        ];
        cells.forEach((value) => {
            const td = document.createElement('td');
            td.textContent = value;
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
}

function destroyChart(key) {
    if (charts[key]) {
        charts[key].destroy();
        delete charts[key];
    }
}

// Badges already act as a de facto legend for client colour, so every chart below hides its
// own legend to stay clean - hovering a segment still shows its label/value via tooltip.
const NO_LEGEND = { plugins: { legend: { display: false } } };

// clientsForGrouping is empty when there's nothing to group by (no clients, or over the badge
// threshold) - in that case both chart functions fall back to their pre-grouping aggregate form.
// disconnects/eventLoopLagSamples are only used in grouped mode: disconnects as one thin dotted
// vertical line per event, coloured to match the client it belongs to; event loop lag as an
// extra line sharing the same ms y-axis, toggled independently via its own badge (it's a single
// server-wide signal, not tied to any one client) - both rebuilt from the same
// visible-client/filter-scoped data as the client lines so everything stays in sync.
function renderLatencyChart(samples, clientsForGrouping, disconnects, eventLoopLagSamples) {
    destroyChart('latency');
    const ctx = document.getElementById('chart-latency');
    if (!ctx) return;

    // The lag line is independent of client selection - it must still render (as the only
    // dataset, if need be) even when every client is hidden, not just tag along when there
    // happen to be visible clients too.
    const showLagLine = showEventLoopLag && eventLoopLagSamples.length > 0;

    if (clientsForGrouping.length > 0 || showLagLine) {
        const datasets = clientsForGrouping.map((c) => {
            const points = samples
                .filter(s => s.clientId === c.clientId)
                .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
                .map(s => ({ x: new Date(s.timestamp).getTime(), y: s.latency }));
            const color = getClientColor(c.clientId);
            return {
                label: c.name || c.clientId.slice(0, 8),
                data: points,
                borderColor: color,
                backgroundColor: color,
                tension: 0.2
            };
        });

        if (showLagLine) {
            const lagPoints = [...eventLoopLagSamples]
                .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
                .map(s => ({ x: new Date(s.timestamp).getTime(), y: s.lag }));
            datasets.push({
                label: 'Server Event Loop Lag',
                data: lagPoints,
                borderColor: EVENT_LOOP_LAG_COLOR,
                backgroundColor: EVENT_LOOP_LAG_COLOR,
                borderDash: [6, 3],
                tension: 0.2
            });
        }

        const annotations = {};
        clientsForGrouping.forEach((c) => {
            disconnects
                .filter(d => d.clientId === c.clientId)
                .forEach((d, i) => {
                    annotations[`disconnect-${c.clientId}-${i}`] = {
                        type: 'line',
                        scaleID: 'x',
                        value: new Date(d.timestamp).getTime(),
                        borderColor: getClientColor(c.clientId),
                        borderWidth: 1,
                        borderDash: [4, 4]
                    };
                });
        });

        charts.latency = new Chart(ctx, {
            type: 'line',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    annotation: { annotations },
                    // Without this the tooltip title falls back to the raw numeric x value
                    // (epoch ms) - the axis tick callback below only formats the axis labels,
                    // not the tooltip, so it needs its own matching formatter.
                    tooltip: {
                        callbacks: {
                            title: (items) => items.length ? new Date(items[0].parsed.x).toLocaleTimeString() : ''
                        }
                    }
                },
                scales: {
                    x: { type: 'linear', ticks: { callback: (val) => new Date(val).toLocaleTimeString() } },
                    y: { beginAtZero: true }
                }
            }
        });
        return;
    }

    const sorted = [...samples].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    charts.latency = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sorted.map(s => new Date(s.timestamp).toLocaleTimeString()),
            datasets: [{ label: 'Latency (ms)', data: sorted.map(s => s.latency), borderColor: '#10b981', tension: 0.2 }]
        },
        options: { responsive: true, maintainAspectRatio: false, ...NO_LEGEND, scales: { y: { beginAtZero: true } } }
    });
}

// Shared renderer for the disconnects/devices charts. Grouped mode: x-axis stays the same
// category (reason/OS) as the aggregate form, so each bar's TOTAL height matches what it would
// show ungrouped - but each bar is stacked into one segment per client, so it's stratified by
// who contributed to it. Aggregate fallback: one plain bar per groupField value.
function renderStackedByClientChart(key, canvasId, label, records, groupField, clientsForGrouping) {
    destroyChart(key);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    if (clientsForGrouping.length > 0) {
        const categories = [...new Set(records.map(r => r[groupField] || 'unknown'))];
        const datasets = clientsForGrouping.map((c) => ({
            label: c.name || c.clientId.slice(0, 8),
            data: categories.map(cat => records.filter(r => r.clientId === c.clientId && (r[groupField] || 'unknown') === cat).length),
            backgroundColor: getClientColor(c.clientId)
        }));
        charts[key] = new Chart(ctx, {
            type: 'bar',
            data: { labels: categories, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                ...NO_LEGEND,
                scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }
            }
        });
        return;
    }

    const counts = {};
    records.forEach((r) => {
        const k = r[groupField] || 'unknown';
        counts[k] = (counts[k] || 0) + 1;
    });
    charts[key] = new Chart(ctx, {
        type: 'bar',
        data: { labels: Object.keys(counts), datasets: [{ label, data: Object.values(counts), backgroundColor: '#8b5cf6' }] },
        options: { responsive: true, maintainAspectRatio: false, ...NO_LEGEND, scales: { y: { beginAtZero: true } } }
    });
}

function renderSessionDetail(session, latencySamples, disconnects, staleResponses) {
    const card = document.getElementById('session-detail-card');
    const subtitle = document.getElementById('session-detail-subtitle');
    const body = document.getElementById('session-detail-body');
    if (!card || !subtitle || !body) return;

    if (!session) {
        card.style.display = 'none';
        return;
    }

    card.style.display = '';
    card.open = true;
    subtitle.textContent = `${session.roomCode || ''} - ${session.gameType || ''}`;
    body.textContent = `${latencySamples.length} latency sample(s), ${disconnects.length} disconnect(s), ${staleResponses.length} stale response(s) for this session (respecting the current client selection).`;
}

function rerenderAll() {
    const sessions = applyFilters(rawData.sessions);
    const filteredClients = applyFilters(rawData.clients);
    const visibleClients = filteredClients.filter(c => !excludedClientIds.has(c.clientId));
    const visibleClientIds = new Set(visibleClients.map(c => c.clientId));

    const latencySamples = applyFilters(rawData.latencySamples).filter(r => visibleClientIds.has(r.clientId));
    const disconnects = applyFilters(rawData.disconnects).filter(r => visibleClientIds.has(r.clientId));
    const staleResponses = applyFilters(rawData.staleResponses).filter(r => visibleClientIds.has(r.clientId));
    const devices = applyFilters(rawData.devices).filter(r => visibleClientIds.has(r.clientId));
    // Server-wide, not client-scoped - only the session-level filters apply, no client filter.
    const eventLoopLagSamples = applyFilters(rawData.eventLoopLag);

    renderSessionsTable(sessions);
    renderOsBrowserBadges();
    renderClientBadges(filteredClients);
    renderStaleTable(staleResponses);

    // Only attempt per-client grouping under the badge threshold - same guard-rail as the badges.
    const clientsForGrouping = filteredClients.length <= CLIENT_BADGE_THRESHOLD ? visibleClients : [];
    renderLatencyChart(latencySamples, clientsForGrouping, disconnects, eventLoopLagSamples);
    renderStackedByClientChart('disconnects', 'chart-disconnects', 'Disconnects', disconnects, 'reason', clientsForGrouping);
    renderStackedByClientChart('devices', 'chart-devices', 'Devices', devices, 'OS', clientsForGrouping);

    const selectedSession = filters.sessionId ? sessions.find(s => s.sessionId === filters.sessionId) : null;
    renderSessionDetail(selectedSession, latencySamples, disconnects, staleResponses);
}

function wireFilterControls() {
    const bind = (id, field, transform = (v) => v || null) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('change', (e) => {
            filters[field] = transform(e.target.value);
            rerenderAll();
        });
    };

    bind('filter-gameType', 'gameType');
    bind('filter-dateFrom', 'dateFrom');
    bind('filter-dateTo', 'dateTo');

    const clearBtn = document.getElementById('filter-clear');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            filters.dateFrom = null;
            filters.dateTo = null;
            filters.gameType = null;
            filters.OS = null;
            filters.browser = null;
            filters.sessionId = null;
            excludedClientIds.clear();

            ['filter-gameType', 'filter-dateFrom', 'filter-dateTo'].forEach((id) => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });

            rerenderAll();
        });
    }
}

export async function initTelemetry() {
    console.log('[Telemetry] Initializing...');
    initCollapsibles(document);

    try {
        const res = await fetch('/api/telemetry/all');
        rawData = await res.json();
    } catch (err) {
        console.error('[Telemetry] fetch failed:', err);
        return;
    }

    assignClientColors();
    populateFilterOptions();
    wireFilterControls();
    rerenderAll();
}

document.addEventListener('DOMContentLoaded', initTelemetry);
