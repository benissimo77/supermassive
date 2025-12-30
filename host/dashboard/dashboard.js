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
			let thisPath = window.location.pathname;
			if (thisPath.endsWith('/')) {
				thisPath = thisPath.slice(0, -1);
			}
			const links = sidebar.querySelectorAll('a');
			links.forEach(link => {
				console.log("Checking links in menu:", thisPath, link.getAttribute('href'));
				if (thisPath === link.getAttribute('href')) {
					const li = link.closest('li');
					if (li) {
						li.classList.add('active');
					}
				}
			});
		})
		.catch(err => {
			console.error('Failed to load menu:', err);
		});
});
