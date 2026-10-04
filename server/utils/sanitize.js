const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// Escapes text so it can never be parsed as markup or break out of a quoted attribute
// wherever it's later displayed (host screen, player screen, stored analysis).
export function escapeHtml(str) {
	if (str === null || str === undefined) return '';
	return String(str).replace(/[&<>"']/g, ch => ESCAPE_MAP[ch]);
}
