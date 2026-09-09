'use strict';

const { ipcRenderer } = require('electron');
const isDev = !require('@electron/remote').app.isPackaged;

const btnShowDir = document.getElementById('btn-show-dir');
const lblMainTitle = document.getElementById('title');
const footerLinks = document.getElementById('footerLinks');

btnShowDir.addEventListener('click', () => {
	ipcRenderer.send('open-install-dir');
});

function updateLinks(links) {
	footerLinks.replaceChildren(
		...links.map(({url, title}) => {
			const link = document.createElement('a');
			link.href = url;
			link.target = '_blank';
			link.innerText = title;
			return link;
		})
	);
}

function setMainTitle(title) {
	if (isDev) {
		title = `${title} (DEV)`;
	}
	lblMainTitle.innerText = title;
}

module.exports = {
	updateLinks,
	setMainTitle,
};

// Prevent buttons other than the main one from staying focused, handing focus
// back to the main button so that it remains the keyboard target and can be
// activated with Enter/Space.
const btnProgress = document.getElementById('btn-progress');
for (const btn of document.querySelectorAll('button:not(#btn-progress)')) {
	btn.addEventListener('focus', () => {
		btn.blur();
		btnProgress.focus();
	});
}

// Update the global css variables
{
	const dimensions = require('./dimensions');
	const root = document.documentElement;
	root.style.setProperty('--window-height', `${dimensions.windowHeight}px`);
	root.style.setProperty('--window-width', `${dimensions.windowWidth}px`);
	root.style.setProperty('--infobox-height', `${dimensions.infoboxHeight}px`);

	// This is a hack to reduce flicker because of inacuraccies with the window
	// sizing and content sizing on Windows.
	//
	// We use the 100hw reference in styles to make sure that content is never
	// scrollable, but there is still some resizing in some cases when togling
	// the log window. This hack effectively permamently caches the *real* hight
	// of the window so that when we open  the log window, there isn't any
	// flicker present. The 100ms delay is entirely arbitrary for when window
	// "stabilizes" enough to be able to take the measurement.
	setTimeout(() => {
		const mainContent = document.getElementById('main-content');
		const computedHeight = getComputedStyle(mainContent).getPropertyValue('height');
		root.style.setProperty('--window-height', computedHeight);
	}, 150);
}
