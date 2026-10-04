// Minimal, dependency-free verbosity control. Swap console.log -> log incrementally, file by
// file, wherever you want production quiet by default. VERBOSE_LOGS=true re-enables it in
// production for one-off debugging without a code change.
const enabled = process.env.NODE_ENV !== 'production' || process.env.VERBOSE_LOGS === 'true';

export function log(...args) {
	if (enabled) console.log(...args);
}
