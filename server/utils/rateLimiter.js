// Simple fixed-window rate limiter - pragmatic, not exhaustive. Tracks call counts per key
// (eg a socket ID) within a rolling window and reports whether a new call should be allowed.
export function createRateLimiter(maxCalls, windowMs) {
	const hits = new Map(); // key -> timestamps within the current window

	return {
		allow(key) {
			const now = Date.now();
			const windowStart = now - windowMs;
			const timestamps = (hits.get(key) || []).filter(t => t > windowStart);
			timestamps.push(now);
			hits.set(key, timestamps);
			return timestamps.length <= maxCalls;
		},
		reset(key) {
			hits.delete(key);
		}
	};
}
