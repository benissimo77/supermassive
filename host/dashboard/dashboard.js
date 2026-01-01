import { Auth } from '/utils/auth.js';

window.toggleSidebar = function() {
	const sidebar = document.getElementById('sidebar')
	const toggleButton = document.getElementById('toggle-btn')
	if (!sidebar || !toggleButton) return;

	sidebar.classList.toggle('close')

	closeAllSubMenus()
}

window.toggleSubMenu = function(button) {
	const sidebar = document.getElementById('sidebar')
	const toggleButton = document.getElementById('toggle-btn')
	if (!sidebar || !toggleButton) return;

	if (!button.nextElementSibling.classList.contains('show')) {
		closeAllSubMenus()
	}

	button.nextElementSibling.classList.toggle('show')
	button.classList.toggle('rotate')

	if (sidebar.classList.contains('close')) {
		sidebar.classList.toggle('close')
	}
}

function closeAllSubMenus() {
	const sidebar = document.getElementById('sidebar')
	if (!sidebar) return;

	Array.from(sidebar.getElementsByClassName('show')).forEach(ul => {
		ul.classList.remove('show')
		ul.previousElementSibling.classList.remove('rotate')
	})
}

window.toggleTheme = function() {
	document.body.classList.toggle('light-theme');
	const isLight = document.body.classList.contains('light-theme');
	localStorage.setItem('theme', isLight ? 'light' : 'dark');
}

window.logout = async function() {
	try {
		const response = await fetch('/auth/logout', { method: 'POST' });
		if (response.ok) {
			window.location.href = '/login';
		}
	} catch (error) {
		console.error('Logout failed:', error);
	}
}

// Apply saved theme immediately
if (localStorage.getItem('theme') === 'light') {
	document.body.classList.add('light-theme');
}

document.addEventListener('DOMContentLoaded', () => {
	const sidebar = document.getElementById('sidebar');
	if (!sidebar) return;

	fetch('/host/menu.html')
		.then(response => response.text())
		.then(async html => {
			sidebar.innerHTML = html;

			// Sync UI based on role after menu is loaded
			await Auth.syncUI();

			// Highlight the active menu item based on current URL
			// We find the link with the longest href that matches the start of the current path
			let thisPath = window.location.pathname;
			if (thisPath.endsWith('/') && thisPath.length > 1) {
				thisPath = thisPath.slice(0, -1);
			}

			const links = Array.from(sidebar.querySelectorAll('a'))
				.filter(link => {
					const href = link.getAttribute('href');
					return href && href.startsWith('/');
				})
				.sort((a, b) => b.getAttribute('href').length - a.getAttribute('href').length);

			for (const link of links) {
				let href = link.getAttribute('href');
				if (href.endsWith('/') && href.length > 1) {
					href = href.slice(0, -1);
				}

				if (thisPath === href || thisPath.startsWith(href + '/')) {
					const li = link.closest('li');
					if (li) {
						li.classList.add('active');

						// If this link is inside a sub-menu, expand and highlight the parent
						let parent = li.parentElement.closest('li');
						while (parent) {
							parent.classList.add('active');
							const subMenu = parent.querySelector('.sub-menu');
							if (subMenu) {
								subMenu.classList.add('show');
								const btn = subMenu.previousElementSibling;
								if (btn && btn.classList.contains('dropdown-btn')) {
									btn.classList.add('rotate');
								}
							}
							parent = parent.parentElement.closest('li');
						}
						break; // Only highlight the best match
					}
				}
			}
		})
		.catch(err => {
			console.error('Failed to load menu:', err);
		});
});
