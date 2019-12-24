'use babel';

// This spec file validates:
//  * That the settings are correctly kept in sync with atom settings.
//
//  If it fails:
//  * Validate the settings declaration & observation within index.js.

import {
	it, beforeEach
} from 'jasmine-fix';

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

	it('Should reflect Atom setting python-linters > PythonExecutablePath … changes to internal settings.js', () => {
		const originalPythonExecutablePath = atom.config.get('python-linters.pythonExecutablePath');
		try {
			atom.config.set('python-linters.pythonExecutablePath', 'XXX');
			const settings = require('../lib/settings.js');
			expect(settings.rawPythonExecutablePath).toBe('XXX');
		} finally {
			atom.config.set('python-linters.pythonExecutablePath', originalPythonExecutablePath);
		}
	});

	it('Should reflect Atom setting python-linters > PythonPath … changes to internal settings.js', () => {
		const originalPythonPath = atom.config.get('python-linters.pythonPath');
		try {
			atom.config.set('python-linters.pythonPath', 'XXX');
			const settings = require('../lib/settings.js');
			expect(settings.rawPythonPath).toBe('XXX');
		} finally {
			atom.config.set('python-linters.pythonPath', originalPythonPath);
		}
	});

	it('Should reflect Atom setting python-linters > ConfigPath … changes to internal settings.js', () => {
		const originalConfigPath = atom.config.get('python-linters.configPath');
		try {
			atom.config.set('python-linters.configPath', 'XXX');
			const settings = require('../lib/settings.js');
			expect(settings.rawConfigPath).toBe('XXX');
		} finally {
			atom.config.set('python-linters.configPath', originalConfigPath);
		}
	});

	it('Should reflect Atom setting python-linters > LintTrigger … changes to internal settings.js', () => {
		const originalLintTrigger = atom.config.get('python-linters.lintTrigger');
		for (const currentLintTrigger of ['LintOnFileSave', 'LintAsYouType']) {
			try {
				atom.config.set('python-linters.lintTrigger', currentLintTrigger);
				const settings = require('../lib/settings.js');
				expect(settings.rawLintTrigger).toBe(currentLintTrigger);
			} finally {
				atom.config.set('python-linters.lintTrigger', originalLintTrigger);
			}
		}
	});

	it('Should reflect Atom setting python-linters > useFlake8 … changes to internal settings.js', () => {
		const originalUseFlake8 = atom.config.get('python-linters.useLintTool.flake8');
		for (const currentUse of [true, false]) {
			try {
				atom.config.set('python-linters.useLintTool.flake8', currentUse);
				const settings = require('../lib/settings.js');
				expect(settings.rawLintWithFlake8).toBe(currentUse);
			} finally {
				atom.config.set('python-linters.useLintTool.flake8', originalUseFlake8);
			}
		}
	});

	it('Should reflect Atom setting python-linters > useMypy … changes to internal settings.js', () => {
		const originalUseMypy = atom.config.get('python-linters.useLintTool.mypy');
		for (const currentUse of [true, false]) {
			try {
				atom.config.set('python-linters.useLintTool.mypy', currentUse);
				const settings = require('../lib/settings.js');
				expect(settings.rawLintWithMypy).toBe(currentUse);
			} finally {
				atom.config.set('python-linters.useLintTool.mypy', originalUseMypy);
			}
		}
	});

	it('Should reflect Atom setting python-linters > usePydocstyle … changes to internal settings.js', () => {
		const originalPydocstyles = atom.config.get('python-linters.useLintTool.pydocstyle');
		for (const currentUse of [true, false]) {
			try {
				atom.config.set('python-linters.useLintTool.pydocstyle', currentUse);
				const settings = require('../lib/settings.js');
				expect(settings.rawLintWithPydocstyle).toBe(currentUse);
			} finally {
				atom.config.set('python-linters.useLintTool.pydocstyle', originalPydocstyles);
			}
		}
	});

	it('Should reflect Atom setting python-linters > usePylint … changes to internal settings.js', () => {
		const originalUsePylint = atom.config.get('python-linters.useLintTool.pylint');
		for (const currentUse of [true, false]) {
			try {
				atom.config.set('python-linters.useLintTool.pylint', currentUse);
				const settings = require('../lib/settings.js');
				expect(settings.rawLintWithPylint).toBe(currentUse);
			} finally {
				atom.config.set('python-linters.useLintTool.pylint', originalUsePylint);
			}
		}
	});
});
