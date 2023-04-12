'use strict';

const { ipcRenderer, shell } = require('electron');

const { setConfigEnabled } = require('./renderer_config');

const lblFull = document.getElementById('lbl-progress-full');
const lblPart = document.getElementById('lbl-progress-part');
const pbPart = document.getElementById('progress-part');
const pbFull = document.getElementById('progress-full');

const btnProgress = document.getElementById('btn-progress');
const cbCheckForUpdates = document.getElementById('cb-check-for-updates');
const lblCheckForUpdates = document.getElementById('lbl-check-for-updates');

let steps;
let currentStep = 0;

let operationInProgress = false;
let nextStepEnabled = true;

let error_suffix = null;

ipcRenderer.on('wizard-list', (_, s) => {
	steps = s;
});

ipcRenderer.on('wizard-started', () => {
	currentStep = 0;
	setInProgress(true);
});

ipcRenderer.on('wizard-stopped', () => {
	setInProgress(false);
});

ipcRenderer.on('wizard-finished', () => {
	btnProgress.innerHTML = 'Start';
	lblFull.innerHTML = 'Download complete';
	lblPart.innerHTML = '';

	pbPart.value = 100;
	pbFull.value = 100;

	pbPart.classList.remove('is-primary', 'is-danger');
	pbPart.classList.add('is-success');

	pbFull.classList.remove('is-primary', 'is-danger');
	pbFull.classList.add('is-success');
	//pbPart.value = parseInt(100 * currentStep / steps.length);
});

ipcRenderer.on('wizard-next-step', (e, step) => {
	lblPart.innerHTML = '';
	lblFull.innerHTML = `Step ${currentStep + 1} of ${steps.length} Checking for download: ${step.name} `;
	pbFull.value = Math.round(100 * currentStep / steps.length);
	currentStep++;
});

btnProgress.addEventListener('click', (event) => {
	event.preventDefault();
	if (!operationInProgress && nextStepEnabled) {
		lblFull.classList.remove('error');
		btnProgress.classList.remove('is-warning');
		ipcRenderer.send('wizard-next');
	}
});

cbCheckForUpdates.addEventListener('change', () => {
	ipcRenderer.send('wizard-check-for-updates', cbCheckForUpdates.checked);
});

function setInProgress(state) {
	setConfigEnabled(!state);
	if (state) {
		btnProgress.classList.add('is-loading');
	} else {
		btnProgress.classList.remove('is-loading');
	}
	cbCheckForUpdates.disabled = state;
	lblCheckForUpdates.disabled = state;
	operationInProgress = state;
}

function stepError(message) {
	if (error_suffix) {
		lblFull.innerHTML = `${message} ${error_suffix}`;
	} else {
		lblFull.innerHTML = message;
	}
	lblFull.classList.add('error');
	lblPart.classList.add('error');

	lblFull.addEventListener('click', event => {
		if (event.target.tagName.toLowerCase() === 'a') {
			event.preventDefault();
			shell.openExternal(event.target.href);
		}
	});

	pbFull.classList.remove('is-primary');
	pbPart.classList.remove('is-primary');

	pbFull.classList.add('is-danger');
	pbPart.classList.add('is-danger');

	setInProgress(false);
}

function updateWizard(config) {
	let buttonText;
	cbCheckForUpdates.checked = !config.no_downloads;
	if (config.no_downloads) {
		if (config.auto_start && !operationInProgress && false) { // eslint-disable-line no-constant-condition
		} else {
			buttonText = 'Start';
		}
	} else {
		if (config.auto_download && !operationInProgress && false) { // eslint-disable-line no-constant-condition
		} else {
			if (config.auto_start) {
				buttonText = 'Update & Start';
			} else {
				buttonText = 'Update';
			}
		}
	}

	error_suffix = config.error_suffix;

	resetUI();
	btnProgress.innerHTML = buttonText;
}

function resetUI() {
	pbPart.value = 0;
	pbFull.value = 0;
	pbFull.classList.remove('is-danger', 'is-success');
	pbPart.classList.remove('is-danger', 'is-success');
	pbFull.classList.add('is-primary');
	pbPart.classList.add('is-primary');

	lblFull.classList.remove('error');
	lblPart.classList.remove('error');
	lblFull.innerHTML = 'Ready';
	lblPart.innerHTML = '';

	btnProgress.classList.remove('is-warning');
	btnProgress.classList.add('is-primary');
	cbCheckForUpdates.disabled = false;
	lblCheckForUpdates.disabled = false;
	setNextStepEnabled(true);
	setInProgress(false);
}

function setNextStepEnabled(enabled) {
	nextStepEnabled = enabled;
	btnProgress.disabled = !enabled;
}

module.exports = {
	stepError: stepError,
	setInProgress: setInProgress,
	getCurrentStepIndex: () => currentStep,
	getTotalSteps: () => steps.length,
	setNextStepEnabled: setNextStepEnabled,
	updateWizard: updateWizard
};
