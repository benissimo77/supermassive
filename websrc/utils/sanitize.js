const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// Escapes text before it's interpolated into an innerHTML/template string, so it can
// never be parsed as markup or break out of a quoted attribute.
export function escapeHtml(str) {
	if (str === null || str === undefined) return '';
	return String(str).replace(/[&<>"']/g, ch => ESCAPE_MAP[ch]);
}
