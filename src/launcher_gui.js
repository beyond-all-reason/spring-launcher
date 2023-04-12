'use strict';

const electron = require('electron');
const { app, BrowserWindow, Menu, Tray, dialog } = electron;
const isDev = !require('electron').app.isPackaged;
const settings = require('electron-settings');
const { writePath } = require('./spring_platform');
const { config } = require('./launcher_config');

let mainWindow;
let tray;

app.on('second-instance', () => {
	// Someone tried to run a second instance, we should focus our window.
	const mainWindow = gui.getMainWindow();
	if (mainWindow) {
		if (mainWindow.isMinimized()) {
			mainWindow.restore();
		}
		mainWindow.focus();
	}
});

app.prependListener('ready', () => {
	const { wizard } = require('./launcher_wizard');

	const display = electron.screen.getPrimaryDisplay();
	const sWidth = display.workAreaSize.width;
	const width = 800;
	const height = process.platform === 'win32' ? 418 : 380 + 8;

	let windowOpts = {
		x: (sWidth - width) / 2,
		// y: (sHeight - height) / 2,
		y: 100,
		width: width,
		height: height,
		show: false,
		icon: `${__dirname}/renderer/spring-icon.png`,
		webPreferences: {
			nodeIntegration: true,
			enableRemoteModule: true,
			contextIsolation: false,
			worldSafeExecuteJavaScript: false,
		},
	};
	windowOpts.resizable = true; // enable resizing here, because this is what gets passed to spring.exe, and we want that to be resizeable
	Menu.setApplicationMenu(null);
	mainWindow = new BrowserWindow(windowOpts);

	require('@electron/remote/main').enable(mainWindow.webContents);

	mainWindow.loadFile(`${__dirname}/renderer/index.html`);
	if (isDev) {
		// mainWindow.webContents.openDevTools();
	}

	mainWindow.on('closed', () => {
		mainWindow = null;
		app.quit();
	});

	tray = new Tray(`${__dirname}/renderer/spring-icon.png`);
	var template = [
		// TODO: About dialog that shows URL, author, version, etc.
		// {
		//   role: 'about',
		//   click: () => {
		//     log.info("About clicked");
		//   }
		// },
		{
			// TODO: Proper "show/hide"
			label: 'Toggle hide',
			click: () => {
				if (mainWindow.isVisible()) {
					//menuItem.label = "Show";
					mainWindow.hide();
				} else {
					mainWindow.show();
					//menuItem.label = "Hide";
				}
			}
		},
		// TODO: Settings dialog for user config
		{ role: 'quit' }
	];
	if (process.platform === 'linux') {
		// template.unshift([{label: 'Spring-Launcher'}]);
	}
	// tray.setToolTip('Spring-Launcher: Distribution system for SpringRTS.');
	tray.setToolTip(config.title);
	tray.setContextMenu(Menu.buildFromTemplate(template));

	mainWindow.once('ready-to-show', () => {
		mainWindow.show();
		//mainWindow.resizable = false; // Disable resizing of the launcher window, this does not get passed to spring.exe

		function isPrintableASCII(str) {
			return /^[\x20-\x7F]*$/.test(str);
		}

		if (process.platform == 'win32' &&
			!isPrintableASCII(writePath) &&
			!config.disable_win_ascii_install_path_check &&
			!settings.getSync('disableNonAsciiPathWarning')) {
			dialog.showMessageBox(mainWindow, {
				type: 'warning',
				title: 'Non-ASCII install directory',
				buttons: ['OK'],
				message: 'Beyond All Reason installation path contains non-ASCII characters.',
				detail:
					`Current installation path ${writePath} constains non-ASCII characters (non English alphabet letters). ` +
					'It is currently not supported and will likely prevent the game updating and starting properly. ' +
					'Please reinstall the game under location that contains only ASCII characters.',
				checkboxLabel: 'Do not show this message again',
				noLink: true,
			}).then(({ checkboxChecked }) => {
				if (checkboxChecked) {
					settings.setSync('disableNonAsciiPathWarning', true);
				}
			});
		}

		gui.send('all-configs', config.getAvailableConfigs());

		const { generateAndBroadcastWizard } = require('./launcher_wizard_util');
		generateAndBroadcastWizard();

		if (config.no_downloads && config.auto_start) {
			wizard.nextStep();
		} else if (config.auto_download) {
			gui.send('wizard-started');
			wizard.nextStep();
		} else {
			gui.send('wizard-stopped');
		}
	});

	// Workaround for linux/wayland on which electron has a problem with
	// properly setting window size from the beggining and a simple size refresh
	// after it got rendered once fixes it.
	// TODO: check if it can be dropped once on electron >= 21.
	mainWindow.once('show', () => {
		setTimeout(() => {
			mainWindow.setSize(width, height);
		}, 0);
	});
});

class GUI {
	send(...args) {
		if (mainWindow && mainWindow.webContents) {
			mainWindow.webContents.send(...args);
		}
	}

	getMainWindow() {
		return mainWindow;
	}
}

const gui = new GUI();

module.exports = {
	gui: gui,
};
