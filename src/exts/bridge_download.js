'use strict';

const log = require('electron-log');

const { bridge } = require('../spring_api');
const { config } = require('../launcher_config');
const springDownloader = require('../spring_downloader');
const { wizard } = require('../launcher_wizard');

let downloadQueue = [];
let isDownloading = false;

bridge.on('Download', (command) => {
	for (const dl of downloadQueue) {
		if (dl.name === command.name) {
			return;
		}
	}

	downloadQueue.push(command);

	if (!isDownloading) {
		DownloadFront();
	}
});

function DownloadFront() {
	if (downloadQueue.length == 0) {
		return;
	}

	let dl = downloadQueue[downloadQueue.length - 1];
	const name = dl.name;
	const type = dl.type;
	dl.isDownloading = true;

	isDownloading = true;
	if (type === 'game') {
		if (config.route_prd_to_nextgen) {
			springDownloader.downloadGameNextGen(name);
		} else {
			springDownloader.downloadGames([name]);
		}
	} else if (type === 'map') {
		springDownloader.downloadMap(name);
	} else if (type === 'engine') {
		springDownloader.downloadEngine(name);
	} else if (type === 'resource') {
		const resource = dl.resource;
		if (resource == null) {
			log.error('Resource field missing');
			return;
		}
		if (resource.url == null || resource.destination == null) {
			log.error('Resource field missing: "url" and "destination" fields are mandatory.');
			return;
		}
		if (resource.extract == null) {
			log.warn('Extract field missing, assuming false.');
			resource.extract = false;
		}
		springDownloader.downloadResource(resource);
	} else {
		log.error(`Unknown type: ${type} for download ${dl}`);
	}
}

function RemoveElement(name) {
	for (let i = 0; i < downloadQueue.length; i++) {
		const dl = downloadQueue[i];
		if (dl.name === name) {
			downloadQueue.splice(i, 1);
			return dl;
		}
	}

	return null;
}

bridge.on('AbortDownload', command => {
	log.info('Abort download', command.name, command.type);
	const dl = RemoveElement(command.name);
	if (dl == null) {
		log.info(`Cannot find element to remove for download: ${command.name}`);
		return;
	}

	if (dl.isDownloading) {
		springDownloader.stopDownload();
	} else {
		bridge.send('DownloadFinished', {
			name: command.name,
			isSuccess: false,
			isAborted: true
		});
	}
});

springDownloader.on('finished', downloadItem => {
	ProcessAfterDone(downloadItem, true, false);
});

springDownloader.on('failed', downloadItem => {
	ProcessAfterDone(downloadItem, false, false);
});

springDownloader.on('aborted', downloadItem => {
	ProcessAfterDone(downloadItem, false, true);
});

function ProcessAfterDone(name, isSuccess, isAborted) {
	if (wizard.isLauncherDownloader) {
		return;
	}

	isDownloading = false;
	RemoveElement(name);

	bridge.send('DownloadFinished', {
		name: name,
		isSuccess: isSuccess,
		isAborted: isAborted
	});

	DownloadFront();
}

springDownloader.on('progress', function (downloadItem, current, total) {
	if (wizard.isLauncherDownloader) {
		return;
	}
	if (total < 1024 * 1024) {
		return; // ignore downloads less than 1MB (probably not real downloads!)
	}

	const UPDATE_INTERVAL = 100;

	let shouldUpdate = true;

	if (typeof this.prevSendTime == 'undefined') {
		this.prevSendTime = (new Date()).getTime();
	} else {
		const now = (new Date()).getTime();
		if (now - this.prevSendTime < UPDATE_INTERVAL) {
			shouldUpdate = false;
		} else {
			this.prevSendTime = now;
		}
	}

	if (shouldUpdate) {
		bridge.send('DownloadProgress', {
			name: downloadItem,
			progress: current / total,
			total: total,
		});
	}
});
