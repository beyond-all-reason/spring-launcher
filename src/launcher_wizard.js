'use strict';

const EventEmitter = require('events');
const { app } = require('electron');

const log = require('electron-log');

const { config } = require('./launcher_config');
const { gui } = require('./launcher_gui');
const updater = require('./updater');
const springDownloader = require('./spring_downloader');
const { launcher } = require('./engine_launcher');
const { handleConfigUpdate } = require('./launcher_config_update');
const fs = require('fs');
const got = require('got');

const path = require('path');
const springPlatform = require('./spring_platform');

let mainWindow;
app.on('ready', () => {
	if (!gui) {
		return;
	}
	mainWindow = gui.getMainWindow();
});

class Wizard extends EventEmitter {
	constructor() {
		super();
		this.isActive = false;
		this.generateSteps();
	}

	generateSteps() {
		var steps = [];
		if (!config.no_downloads) {
			let pushConfigFetchActionAtEnd = null;
			if (config.config_url != null) {
				const newConfig = got(config.config_url).json();

				const configFetchAction = {
					name: 'config update',
					action: () => {
						log.info(`Checking for config update from: ${config.config_url}...`);
						newConfig.then(newConfig => {
							try {
								handleConfigUpdate(newConfig);
							} catch (err) {
								log.error('Failed to update config file. Ignoring.');
								log.error(err);
							}
							wizard.nextStep();
						}).catch(error => {
							log.error(`Failed to get config update. Error: ${error}, ignoring`);
							wizard.nextStep();
						});
					}
				}

				// During first run, we check config first because the one with the
				// launcher might be very old.
				if (!fs.existsSync(path.join(springPlatform.writePath, 'config.json'))) {
					steps.push(configFetchAction);
				} else {
					pushConfigFetchActionAtEnd = configFetchAction;
				}
			}

			config.downloads.resources.forEach((resource) => {
				steps.push({
					name: 'resource',
					item: resource,
					action: () => {
						this.isActive = true;
						springDownloader.downloadResource(resource);
					}
				});
			});

			config.downloads.engines.forEach((engine) => {
				steps.push({
					name: 'engine',
					item: engine,
					action: () => {
						this.isActive = true;
						springDownloader.downloadEngine(engine);
					}
				});
			});

			if (config.route_prd_to_nextgen) {
				config.downloads.games.forEach((game) => {
					steps.push({
						name: 'game',
						item: game,
						action: () => {
							this.isActive = true;
							springDownloader.downloadGameNextGen(game);
						}
					});
				});
			} else if (config.downloads.games && config.downloads.games.length > 0) {
				steps.push({
					name: 'games',
					item: config.downloads.games.join(', '),
					action: () => {
						this.isActive = true;
						springDownloader.downloadGames(config.downloads.games);
					}
				});
			}

			config.downloads.maps.forEach((map) => {
				steps.push({
					name: 'map',
					item: map,
					action: () => {
						this.isActive = true;
						springDownloader.downloadMap(map);
					}
				});
			});

			config.downloads.nextgen.forEach((resource) => {
				steps.push({
					name: 'nextgen',
					item: resource,
					action: () => {
						this.isActive = true;
						springDownloader.downloadNextGen(resource);
					}
				});
			});

			if (pushConfigFetchActionAtEnd) {
				steps.push(pushConfigFetchActionAtEnd);
			}

			// Queue asynchronous check for launcher update.
			const isDev = !require('electron').app.isPackaged;
			if (!isDev) {
				const updateCheckPromise = new Promise((resolve, reject) => {
					updater.on('update-available', () => {
						resolve(true);
					});
					updater.on('update-not-available', () => {
						resolve(false);
					});
					updater.on('error', error => {
						reject(error);
					});
				});

				const performUpdate = () => {
					gui.send('dl-started', 'autoupdate');

					updater.on('download-progress', (d) => {
						console.info(`Self-download progress: ${d.percent}`);
						gui.send('dl-progress', 'autoUpdate', d.percent, 100);
					});
					updater.on('update-downloaded', () => {
						log.info('Self-update downloaded');
						gui.send('dl-finished', 'autoupdate');
						setImmediate(() => updater.quitAndInstall(config.silent, true));
					});

					updater.on('error', error => {
						log.error(`Application failed to self-update. Error: ${error}`);
					});

					updater.downloadUpdate();
				};

				steps.push({
					name: 'launcher_update',
					action: () => {
						log.info('Checking for launcher update');
						updateCheckPromise.then(updateAvailable => {
							if (!updateAvailable) {
								log.info('No update available.');
								wizard.nextStep();
							} else {
								performUpdate();
							}
						}).catch(error => {
							log.error(`Failed to check for launcher updates. Error: ${error}`);
						});
					}
				});

				updater.checkForUpdates();
			} else {
				console.log('Development version: no self-update required');
			}
		}

		let enginePath;
		if (config.launch.engine_path != null) {
			enginePath = config.launch.engine_path;
		} else {
			const engineName = config.launch.engine || config.downloads.engines[0];
			if (engineName != null) {
				enginePath = path.join(springPlatform.writePath, 'engine', engineName, springPlatform.springBin);
			}
		}
		if (enginePath != null) {
			steps.push({
				name: 'start',
				action: (step) => {
					setTimeout(() => {
						if (launcher.state != 'failed') {
							mainWindow.hide();
						}
					}, 1000);

					log.info(`Starting Spring from: ${enginePath}`);
					launcher.launch(enginePath, config.launch.start_args);

					this.emit('launched');

					gui.send('launch-started');
					launcher.once('finished', () => {
						this.steps.push(step);
					});

					launcher.once('failed', () => {
						this.steps.push(step);
					});
				}
			});
		}

		this.started = false;
		this.steps = steps;
		this.enabled = true;

		this.emit('stepsGenerated', this.steps);
	}

	setEnabled(enabled) {
		this.enabled = enabled;
	}

	nextStep(forced) {
		if (!this.enabled) {
			return;
		}

		const step = this.steps.shift();
		if (step === undefined) {
			log.warn('No more steps to do.');
			gui.send('wizard-stopped');
			gui.send('wizard-finished');
			this.started = false;
			gui.send('set-next-enabled', false);
			return false;
		}
		if (!this.started) {
			gui.send('wizard-started');
			this.started = true;
		}

		log.info(`Step: ${JSON.stringify(step, null, 4)}`);

		if (step.name === 'start') {
			if (!(config.auto_start || forced)) {
				gui.send('wizard-stopped');
				gui.send('wizard-finished');
				this.steps.push(step);
				return false;
			}
		} else {
			gui.send('wizard-next-step', {
				name: step.name,
				item: step.item
			});
		}

		step.action(step);
		return true;
	}
}

const wizard = new Wizard();

module.exports = {
	wizard: wizard,
};
