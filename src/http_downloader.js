'use strict';

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

const { Butler } = require('spring-nextgen-dl');

const springPlatform = require('./spring_platform');
const { log, wrapEmitterLogs } = require('./spring_log');
const Extractor = require('./extractor');
const { makeParentDir, getTemporaryFileName, removeTemporaryFiles } = require('./fs_utils');


class HttpDownloader extends EventEmitter {
	constructor() {
		super();

		const butler = new Butler(springPlatform.butlerPath, path.join(springPlatform.writePath, 'tmp'));

		butler.on('started', () => {
			this.emit('started', this.name);
		});

		butler.on('progress', (current, total) => {
			this.emit('progress', this.name, current, total);
		});

		butler.on('aborted', msg => {
			this.emit('aborted', this.name, msg);
		});

		wrapEmitterLogs(butler);

		this.butler = butler;

		try {
			removeTemporaryFiles();
			this.extractor = new Extractor();
			this.extractor.on('finished', downloadItem => {
				this.emit('finished', downloadItem);
			});

			this.extractor.on('failed', (downloadItem, msg) => {
				this.emit('failed', downloadItem, msg);
			});
		} catch (error) {
			// If for some weird permission reason we failed to cleanup downloads, just log it and ignore it
			// No need to disturb the user with this
			log.error('Failed to delete old temporary files');
			log.error(error);
		}
	}

	downloadResource(name, resource) {
		const url = new URL(resource['url']);
		this.name = name;
		const destination = path.join(springPlatform.writePath, resource['destination']);
		if (fs.existsSync(destination)) {
			// this.emit('finished', `Skipping ${destination}: already exists.`);
			this.emit('finished', this.name);
			log.info(`Skipping ${destination}: already exists.`);
			return;
		}

		const destinationTemp = getTemporaryFileName('download');
		this.emit('started', this.name);
		// FIXME: What's going on here..? () shouldn't be preventing this. from working
		// Is then the problem?
		const extractor = this.extractor;
		this.download(this.name, 'resource', url, destinationTemp)
			.then(() => {
				log.info('Finished http download');

				makeParentDir(destination);

				if (!resource['extract']) {
					fs.renameSync(destinationTemp, destination);
					this.emit('finished', this.name);
					return;
				}

				// this.emit('progress', `Extracting to ${destination}`, 100, 100);
				this.emit('progress', this.name, 100, 100);

				extractor.extract(name, url, destinationTemp, destination);
			}).catch(reason => {
				if (fs.existsSync(destinationTemp)) {
					try {
						fs.unlinkSync(destinationTemp);
					} catch (err) {
						if (fs.existsSync(destinationTemp)) {
							log.error(`Failed to cleanup stale download: ${destinationTemp}`);
						}
					}
				}
				log.info('failed', `Download failed: ${reason}`);
				if (resource['optional']) {
					log.warn(reason);
					log.warn('Download is optional, marking as finished succesfully.');
					this.emit('finished', this.name);
				} else {
					log.error(reason);
					this.emit('failed', this.name, reason);
				}
			});
	}

	download(name, type, url, downloadPath) {
		this.name = name;
		this.type = type;
		return this.butler.download(url.href, downloadPath);
	}

	stopDownload() {
		this.butler.stopDownload();
	}
}

module.exports = new HttpDownloader();
