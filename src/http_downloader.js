'use strict';

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

const { DownloaderHelper } = require('node-downloader-helper');

const springPlatform = require('./spring_platform');
const { log } = require('./spring_log');
const Extractor = require('./extractor');
const {
	makeParentDir,
	makeDir,
	TMP_DIR,
	removeTemporaryFiles,
	renameSyncWithRetry
} = require('./fs_utils');

class HttpDownloader extends EventEmitter {
	constructor() {
		super();

		this.__dl = null;

		this.extractor = new Extractor();
		this.extractor.on('finished', (downloadItem) => {
			this.emit('finished', downloadItem);
		});

		this.extractor.on('failed', (downloadItem, msg) => {
			this.emit('failed', downloadItem, msg);
		});

		try {
			removeTemporaryFiles();
		} catch (error) {
			// If for some weird permission reason we failed to cleanup downloads, just log it and ignore it
			// No need to disturb the user with this
			log.error('Failed to delete old temporary files');
			log.error(error);
		}
	}

	downloadResource(resource) {
		const url = new URL(resource['url']);
		const name = resource['destination'];
		const destination = path.join(springPlatform.writePath, name);
		if (fs.existsSync(destination)) {
			this.emit('finished', name);
			log.info(`Skipping ${destination}: already exists.`);
			return;
		}

		makeDir(TMP_DIR);

		const dl = new DownloaderHelper(
			url.href,
			TMP_DIR,
			{
				override: true,
				timeout: 10000, // 10 seconds timeout for socket inactivity
				retry: { maxRetries: 5, delay: 3000 },
				progressThrottle: 100,
				headers: { 'User-Agent': 'spring-launcher' },
			}
		);
		this.__dl = dl;

		dl.on('end', (downloadInfo) => {
			if (downloadInfo.incomplete) {
				log.error('Download incomplete');
				this.emit('failed', name, 'Download incomplete');
				return;
			}

			log.info('Finished http download');

			makeParentDir(destination);

			if (!resource['extract']) {
				renameSyncWithRetry(downloadInfo.filePath, destination);
				this.emit('finished', name);
				return;
			}

			this.emit(
				'progress',
				name,
				downloadInfo.downloadedSize,
				downloadInfo.downloadedSize
			);

			this.extractor.extract(name, downloadInfo.filePath, destination);
		});

		let handledErrorOnce = false;
		const handleError = (error) => {
			if (handledErrorOnce) return;
			handledErrorOnce = true;

			log.error(`Download ${name} failed: `, error);
			if (resource['optional']) {
				log.warn(
					`Download ${name} is optional, marking as finished succesfully.`
				);
				this.emit('finished', name);
			} else {
				this.emit('failed', name, error);
			}
		};

		dl.on('error', handleError);
		dl.on('timeout', () => handleError(new Error('timeout')));
		dl.on('stop', () => this.emit('aborted', name));
		dl.on('progress.throttled', (stats) =>
			this.emit('progress', name, stats.downloaded, stats.total)
		);
		dl.on('warning', (err) => log.warn(`Download ${name} warning: ${err}`));
		dl.on('retry', (attempt, retryOpts, err) => {
			log.warn(
				`Retrying ${name} download attempt ${attempt} of ${retryOpts.maxRetries}, error was: ${err.message}`
			);
		});

		this.emit('started', name);
		dl.start().catch(handleError);
	}

	stopDownload() {
		if (this.__dl == null) {
			log.error('No current download. Nothing to stop');
			return;
		}
		this.__dl.stop();
	}
}

module.exports = new HttpDownloader();
