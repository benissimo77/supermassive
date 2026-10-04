// Collapsing a card's <summary class="card-header"> also collapses any nested
// <details> inside it, so a parent never shows its children while itself collapsed.
export function initCollapsibles(root = document) {
	root.querySelectorAll('summary.card-header').forEach(summary => {
		if (summary.dataset.collapsibleBound) return;
		summary.dataset.collapsibleBound = 'true';

		summary.addEventListener('click', (e) => {
			if (e.target.closest('button')) {
				e.preventDefault();
				return;
			}
			const details = summary.parentNode;
			if (details.hasAttribute('open')) {
				details.querySelectorAll('details').forEach(d => d.removeAttribute('open'));
			}
		});
	});
}
