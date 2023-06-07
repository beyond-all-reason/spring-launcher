'use strict';

const EventEmitter = require('events');

const { NextGenDownloader, springToNextgen } = require('spring-nextgen-dl');

const { log, wrapEmitterLogs } = require('./spring_log');
const prdDownloader = require('./prd_downloader');
const httpDownloader = require('./http_downloader');
const { config } = require('./launcher_config');
const springPlatform = require('./spring_platform');

const nextGenDownloader = new NextGenDownloader(springPlatform.butlerPath, springPlatform.writePath);
wrapEmitterLogs(nextGenDownloader);

function getDownloader(name) {
	let url;
	try {
		url = new URL(name);
	} catch (_) {
		return prdDownloader;
	}

	if (url.protocol === 'http:' || url.protocol === 'https:') {
		return httpDownloader;
	} else {
		return prdDownloader;
	}
}

let currentDownloader = null;

let nextgenToSpringMapping = {
};

class SpringDownloader extends EventEmitter {
	constructor() {
		super();

		let downloaders = [prdDownloader, httpDownloader, nextGenDownloader];
		for (const downloader of downloaders) {
			const getMapped = (downloadItem) => {
				if (downloader !== nextGenDownloader) {
					return downloadItem;
				}
				let mapped = nextgenToSpringMapping[downloadItem];
				return mapped != null ? mapped : downloadItem;
			};
			downloader.on('started', downloadItem => {
				this.emit('started', getMapped(downloadItem));
			});

			downloader.on('progress', (downloadItem, current, total) => {
				this.emit('progress', getMapped(downloadItem), current, total);
			});

			downloader.on('finished', downloadItem => {
				currentDownloader = null;
				this.emit('finished', getMapped(downloadItem));
				delete nextgenToSpringMapping[downloadItem];
			});

			downloader.on('failed', (downloadItem, msg) => {
				currentDownloader = null;
				this.emit('failed', getMapped(downloadItem), msg);
				delete nextgenToSpringMapping[downloadItem];
			});

			downloader.on('aborted', (downloadItem, msg) => {
				currentDownloader = null;
				this.emit('aborted', getMapped(downloadItem), msg);
				delete nextgenToSpringMapping[downloadItem];
			});
		}
	}

	downloadEngine(engineName) {
		prdDownloader.downloadEngine(engineName);
		currentDownloader = prdDownloader;
	}

	async downloadGameNextGen(gameName) {
		let nextgenName;
		try {
			nextgenName = await springToNextgen(gameName);
		} catch (err) {
			log.warn(err);
			log.warn(`Cannot find ${gameName} on nextgen. Fallback to prd`);
			prdDownloader.downloadGames([gameName]);
			currentDownloader = prdDownloader;
			return;
		}

		nextgenToSpringMapping[nextgenName] = gameName;
		nextGenDownloader.download(nextgenName);
	}

	downloadGames(gameNames) {
		prdDownloader.downloadGames(gameNames);
		currentDownloader = prdDownloader;
	}

	downloadMap(mapName) {
		prdDownloader.downloadMap(mapName);
		currentDownloader = prdDownloader;
	}

	downloadResource(resource) {
		const downloader = getDownloader(resource['url']);
		downloader.downloadResource(resource);
		currentDownloader = downloader;
	}

	downloadNextGen(resource) {
		nextGenDownloader.download(resource);
		currentDownloader = nextGenDownloader;
	}

	stopDownload() {
		if (currentDownloader == null) {
			log.error('No current download. Nothing to stop');
			return;
		}

		currentDownloader.stopDownload();
	}
}

module.exports = new SpringDownloader();
