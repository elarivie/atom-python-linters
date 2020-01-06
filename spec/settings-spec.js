'use strict';

// This spec file validates:
//  * That the settings are correctly kept in sync with atom settings.
//
//  If it fails:
//  * Validate the settings declaration & observation within lib/main.js.

// eslint-disable-next-line no-unused-vars
const {it, fit, wait, beforeEach, afterEach} = require('jasmine-fix');

describe('when changing python-linters atom settings', () => {
	beforeEach(async () => {
		// Make sure the implied packages are loaded and active.
		for (const currentPackageName of ['language-python', 'python-linters']) {
			if (!atom.packages.isPackageActive(currentPackageName)) {
				/* eslint-disable no-await-in-loop */
				await atom.packages.activatePackage(currentPackageName);
				/* eslint-enable no-await-in-loop */
				expect(atom.packages.isPackageLoaded(currentPackageName)).toBe(true);
				expect(atom.packages.isPackageActive(currentPackageName)).toBe(true);
			}
		}
	});

	it('Should offer a temp folder', () => {
		const settings = require('../lib/settings.js');
		expect(settings.rawTempFolderPath.length).not.toEqual(0);

		// Check on disk, it should exists.
		const fs = require('fs');
		expect(fs.lstatSync(settings.rawTempFolderPath).isDirectory()).toBe(true);
	});

	it('Should reflect Atom setting python-linters > … changes to internal settings.js', () => {
		const settings = require('../lib/settings.js');
		const settingsName = [settings.sPythonPath, settings.sPythonExecutable, settings.sConfig, settings.sLintTriggerFlake8, settings.sLintTriggerMypy, settings.sLintTriggerPydocstyle, settings.sLintTriggerPylint];

		for (const settingName of settingsName) {
			const originalValue = atom.config.get(settingName);
			try {
				for (const currentValue of ['LintAsYouType', 'LintOnFileSave', 'Never']) {
					atom.config.set(settingName, currentValue);
					expect(atom.config.get(settingName)).toEqual(currentValue);
					expect(settings.getS(settingName)).toEqual(currentValue);
				}
			} finally {
				atom.config.set(settingName, originalValue);
			}
		}
	});
});
