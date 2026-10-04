// Single source of truth for quiz tag dimensions - subjects, age-suitability, difficulty.
// Adding a new subject or age-range later is a one-line addition here, nothing else -
// both the quiz list filter page and the quiz editor import from this file.

export const SUBJECTS = [
    { label: 'General Knowledge',    color: '#10b981' },
    { label: 'Science & Technology', color: '#8b5cf6' },
    { label: 'History',              color: '#f59e0b' },
    { label: 'Geography',            color: '#ef4444' },
    { label: 'Sport',                color: '#3b82f6' },
    { label: 'Modern Life',          color: '#ec4899' },
    { label: 'Entertainment',        color: '#14b8a6' },
    { label: 'Art & Literature',     color: '#f97316' },
];

export const AGE_RANGES = [
    { label: 'Family',     color: '#64748b' }, // default - "suitable for all ages"
    { label: 'Boomer',     color: '#6366f1' },
    { label: 'Gen-X',      color: '#84cc16' },
    { label: 'Millennial', color: '#06b6d4' },
    { label: 'Gen-Z',      color: '#d946ef' },
];

export const DEFAULT_AGE_RANGES = ['Family'];

// 1-5, same mechanic as the existing quiz `rating` field
export const DIFFICULTY_LABELS = {
    1: { label: 'Easy',       color: '#4caf50' },
    2: { label: 'Casual',     color: '#84cc16' },
    3: { label: 'Medium',     color: '#f0ad4e' },
    4: { label: 'Hard',       color: '#f97316' },
    5: { label: 'Mastermind', color: '#b53c38' },
};

// The "4-stars and above" list-page filter pill threshold
export const RATING_FILTER_THRESHOLD = 4;

// Flat array form of DIFFICULTY_LABELS for renderPillGroup() - key is the numeric 1-5 value.
export const DIFFICULTY_ITEMS = Object.entries(DIFFICULTY_LABELS).map(([value, { label, color }]) => ({
    key: Number(value), label, color
}));

// --- Shared pill rendering (used by both the quiz editor's Tags section and the quiz list's
// filter bar, so the two pages can't visually drift apart or duplicate this DOM-building code) ---

export function makePill(label, color, selected, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.classList.add('pill');
    btn.style.setProperty('--pill-color', color);
    btn.classList.toggle('pill--selected', selected);
    btn.addEventListener('click', onClick);
    return btn;
}

/**
 * Renders a labeled group of toggle pills (e.g. "Subject Matter" + 8 colored pills) into
 * `container`, replacing its contents. `container` should have the `.form-group` class so
 * the label gets the shared uppercase/small-caps style and sits on its own line above the pills.
 * `items` is an array of {label, color} (optionally {key, label, color} when the toggled value
 * differs from the label, e.g. difficulty's numeric key). `isSelected(key)` returns whether an
 * item is currently active; `onToggle(key)` is called when its pill is clicked.
 */
export function renderPillGroup(container, labelText, items, isSelected, onToggle) {
    container.innerHTML = '';

    const labelEl = document.createElement('label');
    labelEl.textContent = labelText;
    container.appendChild(labelEl);

    const pillsEl = document.createElement('div');
    pillsEl.classList.add('flex', 'flex-wrap');
    items.forEach(item => {
        const key = item.key !== undefined ? item.key : item.label;
        pillsEl.appendChild(makePill(item.label, item.color, isSelected(key), () => onToggle(key)));
    });
    container.appendChild(pillsEl);
}
