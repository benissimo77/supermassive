// Standardizes the disable/spinner/restore lifecycle around a network action triggered
// by one or more buttons, and makes sure a failure is never silently swallowed.
// Resolves to the task's result on success, or null on failure (after onError has run) —
// callers use that to decide whether to continue (e.g. close a modal, redirect).
export async function runSave(buttons, task, opts = {}) {
	const list = Array.isArray(buttons) ? buttons : [buttons];
	const {
		savingText = 'Saving...',
		savedText = null,
		savedDuration = 2000,
		onError = (err) => alert(err.message || 'Something went wrong. Please try again.')
	} = opts;

	const idleHtml = list.map(btn => btn.innerHTML);
	list.forEach(btn => {
		btn.disabled = true;
		btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${savingText}`;
	});

	const restore = () => list.forEach((btn, i) => {
		btn.disabled = false;
		btn.innerHTML = idleHtml[i];
	});

	try {
		const result = await task();
		if (result && result.success === false) {
			throw new Error(result.message || 'Request failed');
		}

		if (savedText) {
			list.forEach(btn => btn.innerHTML = `<i class="fa-solid fa-check"></i> ${savedText}`);
			setTimeout(restore, savedDuration);
		} else {
			restore();
		}
		return result ?? true;
	} catch (err) {
		restore();
		onError(err);
		return null;
	}
}
