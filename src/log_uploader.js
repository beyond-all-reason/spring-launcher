'use strict';

const { dialog, clipboard } = require('electron');
const { config } = require('./launcher_config');
const fs = require('fs');
const path = require('path');
const path7za = require('./path_7za');
const sevenZ = require('node-7z');

const github = require('octonode');
const got = require('got');
const AWS = require('aws-sdk');
AWS.config.update({
	correctClockSkew: true, // Fix for RequestTimeTooSkewed error
});

const springPlatform = require('./spring_platform');
const { log, logPath, logDir } = require('./spring_log');

// such security, much wow
const sec = [
	'ghp',
	'_j1npS8i',
	'jzzVLSsJ',
	'R0NBQVM',
	'pjUWN1Fi4WdO7n'
];
const github_access_token = sec.join('');
const github_log_repo = config.github_log_repo;
const shouldUploadWithGithub = github_log_repo != null && github_log_repo != '';

const a1 = [
	'414B494133',
	'5843505A41',
	'51414B424C',
	'4D52545747'
];

const a2 = [
	'6939487543',
	'386B497255',
	'673149596A',
	'48692B6C6A',
	'33786D734D',
	'434A5A6D66',
	'4A4F415875',
	'7A5543574A'
];

function s2b(str) {
	const bytes = new Uint8Array(str.length / 2);
	for (let i = 0; i !== bytes.length; i++) {
		bytes[i] = parseInt(str.substr(i * 2, 2), 16);
	}
	return bytes;
}

const aws_id = new TextDecoder().decode(s2b(a1.join('')));
const aws_secret = new TextDecoder().decode(s2b(a2.join('')));
const logs_s3_bucket = config.logs_s3_bucket;
const shouldUploadWithS3 = logs_s3_bucket != null && logs_s3_bucket != '';

function upload_ask() {
	// TODO: probably should disable the UI while this is being done
	const dialogBtns = ['Yes (Upload)', 'No'];

	const uploadDestination = shouldUploadWithS3 ? `https://${logs_s3_bucket}.s3.amazonaws.com/` : (shouldUploadWithGithub ? `https://github.com/${github_log_repo}` : 'http://log.springrts.com');

	dialog.showMessageBox({
		'type': 'info',
		'buttons': dialogBtns,
		'title': 'Upload log',
		'message': `Do you want to upload your log to ${uploadDestination} ? All information will be public.`
	}).then(result => {
		const response = result.response;
		log.info('User wants to upload? ', dialogBtns[response]);
		if (response != 0) {
			return;
		}

		(shouldUploadWithS3 ? uploadToS3() : (shouldUploadWithGithub ? uploadToGithub() : uploadToSpringRTS()))
			.then(obj => {
				clipboard.clear();
				clipboard.writeText(obj.url);
				const msg = `Your log has been uploaded to: ${obj.url}` +
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
	return shouldUploadWithS3 ? uploadToS3() : (shouldUploadWithGithub ? uploadToGithub() : uploadToSpringRTS());
}

function uploadToS3() {
	// Pick the last $lastLogsToUpload log files.
	const lastLogsToUpload = 7;
	const logFiles = fs.readdirSync(logDir).sort().slice(-lastLogsToUpload).map(f => path.join(logDir, f));

	const archiveId = new Date().toISOString().replace(/[^0-9T]/g, '');
	const archiveFile = `spring-launcher-logs-${archiveId}.zip`;
	const archivePath = path.join(springPlatform.writePath, archiveFile)

	const stream7z = sevenZ.add(archivePath, logFiles, {
		$bin: path7za,
	});

	return new Promise((resolve, reject) => {
		stream7z.on('end', () => {
			log.info(stream7z.info);
			const fileContent = fs.readFileSync(archivePath);

			const s3 = new AWS.S3({
				accessKeyId: aws_id,
				secretAccessKey: aws_secret
			});

			const stream = fs.createReadStream(archivePath);
			const params = {
				Bucket: logs_s3_bucket,
				Key: archiveFile,
				Body: stream,
				ContentType: 'application/zip'
			};

			s3.upload(params, function(err, data) {
				fs.unlink(archivePath, (err) => {
					if (err) {
						log.warn(`Failed to remove temporary file ${archivePath}: ${err}`);
					}
				});
				if (err) {
					reject(err);
				}
				resolve({ 'url': data?.Location });
			});
		});

		stream7z.on('error', error => {
			reject(error);
		});
	});
}

function uploadToGithub() {
	const github_client = github.client(github_access_token);
	const ghrepo = github_client.repo('Spring-SpringBoard/Logs');
	return ghrepo.issueAsync({
		'title': `spring-launcher log: ${config.title}`,
		'body': '```' + fs.readFileSync(logPath).toString() + '```',
	}).then(obj => {
		return { 'url': obj[0].html_url };
	});
}

function uploadToSpringRTS() {
	return new Promise((resolve, reject) => {
		log.info('Uploading...');
		const fileData = fs.readFileSync(logPath).toString();
		const isDev = !require('electron').app.isPackaged;
		var tags = ['spring-launcher', config.title];
		if (isDev) {
			tags.push('dev');
		}

		got.post('http://logs.springrts.com/logfiles/', {
			json: {
				name: `spring-launcher log: ${config.title}`,
				text: fileData,
				tags: tags
			},
			responseType: 'json'
		}).then(obj => {
			resolve(obj.body);
		}).catch(err => {
			reject(err);
		});
	}).then(obj => {
		obj.url = obj.url.replace('http://', 'https://');
		return obj;
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

