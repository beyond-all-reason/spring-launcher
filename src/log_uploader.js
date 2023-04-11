'use strict';

const { dialog, clipboard } = require('electron');
const { config } = require('./launcher_config');
const fs = require('fs');
const path = require('path');
const path7za = require('./path_7za');
const sevenZ = require('node-7z');
const crypto = require('node:crypto');
const got = require('got');

const springPlatform = require('./spring_platform');
const { log, logDir } = require('./spring_log');

function upload_ask() {
	if (!config.log_upload_url) {
		dialog.showMessageBox({
			'type': 'error',
			'buttons': ['OK'],
			'title': 'Can\'t upload log.',
			'message': 'Launcher doesn\'t have configured log destination.',
		});
		return;
	}
	// TODO: probably should disable the UI while this is being done
	const dialogBtns = ['Yes (Upload)', 'No'];

	dialog.showMessageBox({
		'type': 'info',
		'buttons': dialogBtns,
		'title': 'Upload log',
		'message': `Do you want to upload your log to ${config.log_upload_url} ? All information will be public.`
	}).then(result => {
		const response = result.response;
		log.info('User wants to upload? ', dialogBtns[response]);
		if (response != 0) {
			return;
		}

		upload()
			.then(obj => {
				clipboard.clear();
				clipboard.writeText(obj.url);
				const msg = 'Your log has been uploaded to:\n' +
					`${obj.url}` +
					'\n(Copied to clipboard)';
				dialog.showMessageBox({
					'type': 'info',
					'buttons': ['OK'],
					'title': 'Log Uploaded',
					'message': msg,
				});
				log.info(msg);
			})
			.catch(err => failed_to_upload(err));
	});
}

function upload() {
	if (!config.log_upload_url) {
		return Promise.reject('No configured logs upload URL.');
	}

	// Pick the last $lastLogsToUpload log files.
	const lastLogsToUpload = 7;
	const logFiles = fs.readdirSync(logDir).sort().slice(-lastLogsToUpload).map(f => path.join(logDir, f));

	const archiveTime = new Date().toISOString().replace(/[^0-9T]/g, '').substring(0, 13);
	const archiveRandom = crypto.randomBytes(6).toString('base64url');
	const archiveFile = `logs-${archiveTime}-${archiveRandom}.zip`;
	const archivePath = path.join(springPlatform.writePath, archiveFile);

	const stream7z = sevenZ.add(archivePath, logFiles, {
		$bin: path7za,
	});

	return new Promise((resolve, reject) => {
		stream7z.on('end', () => {
			log.info(stream7z.info);
			const contents = fs.readFileSync(archivePath);
			const uploadUrl = `${config.log_upload_url}/${archiveFile}`;
			got(uploadUrl, {
				method: 'PUT',
				body: contents,
				headers: { 'content-type': 'application/zip' }
			}).json().then(res => {
				fs.unlink(archivePath, (err) => {
					if (err) {
						log.warn(`Failed to remove temporary file ${archivePath}: ${err}`);
					}
				});
				resolve({ url: res.downloadUrl });
			}).catch(reject);
		});

		stream7z.on('error', error => {
			reject(error);
		});
	});
}

function failed_to_upload(msg) {
	const errMsg = `Failed to upload log, copy and upload the log manually.\nReason: ${String(msg)}.`;
	log.error(errMsg);
	log.error(msg);
	dialog.showMessageBox({
		'type': 'error',
		'buttons': ['OK'],
		'title': 'Log Upload failed',
		'message': errMsg,
	});
}

module.exports = {
	'upload_ask': upload_ask,
	'upload': upload
};
