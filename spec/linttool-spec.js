'use strict';

// This spec file validates:
//	* That the lint tools works as expected.
//

const path = require('path');

// eslint-disable-next-line no-unused-vars
const {it, fit, wait, beforeEach, afterEach} = require('jasmine-fix');

const settings = require('../lib/settings.js');

const zeroPath = path.join(__dirname, 'fixtures', 'zero.py');
const onePath = path.join(__dirname, 'fixtures', 'one.py');
const emptyPath = path.join(__dirname, 'fixtures', 'empty.py');

const lintToolsName = ['flake8', 'mypy', 'pydocstyle', 'pylint'];

const {provideLinter} = require('../lib/main.js');

describe('python-linters package', () => {
	it('Provides multiple linters', () => {
		expect(Array.isArray(provideLinter())).toBe(true);
		expect(provideLinter().length).toBe(lintToolsName.length);
		expect(new Set(provideLinter().map(x => x.name)).size).toBe(lintToolsName.length);
	});
});

for (const currLintToolName of lintToolsName) {
	describe('Lint tool ' + currLintToolName, () => {
		beforeEach(async () => {
			await Promise.all(['language-python', 'python-linters'].map(x => atom.packages.activatePackage(x)));
		});

		it('when package is loaded and active', () => {
			expect(atom.packages.isPackageLoaded('python-linters')).toBe(true);
			expect(atom.packages.isPackageActive('python-linters')).toBe(true);
		});

		it('has ' + currLintToolName + ' within the provided linter', () => {
			expect(Array.isArray(provideLinter(currLintToolName))).toBe(false);
			expect(provideLinter(currLintToolName).name).toBe('python-linters ' + currLintToolName);
			expect(provideLinter(currLintToolName).scope).toBe('file');
			expect(provideLinter(currLintToolName).grammarScopes).toContain('source.python');
			expect(provideLinter(currLintToolName).grammarScopes).toContain('source.python.django');
			expect([true, false]).toContain(provideLinter(currLintToolName).lintsOnChange);
		});

		it('detects zero lint message when linting an empty test file present on disk', async () => {
			const editor = await atom.workspace.open(emptyPath);
			expect(editor.isEmpty()).toBe(true);
			const messages = await provideLinter(currLintToolName).lint(editor);
			expect(Array.isArray(messages)).toBe(true);
			expect(messages.length).toBe(0);
		});

		for (const currFileName of ['binary', 'empty', 'invalid', 'junk', 'zero', 'one', 'bin0', 'bin1', 'cornercase_pylint_00.py']) {
			it('can lint ' + currFileName + '.py without throwing error', async () => {
				const editor = await atom.workspace.open(path.join(__dirname, 'fixtures', currFileName + '.py'));
				const messages = await provideLinter(currLintToolName).lint(editor);
				expect(Array.isArray(messages)).toBe(true);
			});
		}

		it('detects zero lint message when linting the "zero" test file present on disk', async () => {
			const editor = await atom.workspace.open(zeroPath);
			expect(editor.isEmpty()).toBe(false);
			const messages = await provideLinter(currLintToolName).lint(editor);
			expect(Array.isArray(messages)).toBe(true);
			expect(messages.length).toBe(0);
		});

		it('detects one lint message when linting the "one" test file present on disk', async () => {
			const editor = await atom.workspace.open(onePath);
			expect(editor.isEmpty()).toBe(false);
			const messages = await provideLinter(currLintToolName).lint(editor);
			expect(Array.isArray(messages)).toBe(true);
			expect(messages.length).toBe(1);
		});

		for (const currConfFileName of ['00_setup.cfg', '01_setup.cfg', '02_setup.cfg', '03_setup.cfg', '04_setup.cfg', '05_setup.cfg', '06_setup.cfg', '07_setup.cfg', '08_setup.cfg', '09_setup.cfg', '0A_setup.cfg']) {
			it('correctly handle config file ' + currConfFileName, async () => { // Even if config file is ill-formed (shall not crash)
				const originalValue = atom.config.get(atom.config.get(settings.sConfig));
				try {
					atom.config.set(settings.sConfig, path.join(__dirname, 'fixtures', 'config', currConfFileName));
					const editor = await atom.workspace.open(onePath);
					expect(editor.isEmpty()).toBe(false);
					const messages = await provideLinter(currLintToolName).lint(editor);
					expect(Array.isArray(messages)).toBe(true);
				} finally {
					atom.config.set(settings.sConfig, originalValue);
				}
			});
		}

		it('detects lint message from RAM when RAM and disk differ', async () => {
			const editor = await atom.workspace.open(onePath);
			editor.setText('');
			const messages = await provideLinter(currLintToolName).lint(editor);
			expect(Array.isArray(messages)).toBe(true);
			expect(messages.length).toBe(0);
		});

		it('records the file path within lint messages', async () => {
			const editor = await atom.workspace.open(onePath);
			expect(editor.isEmpty()).toBe(false);
			const messages = await provideLinter(currLintToolName).lint(editor);
			expect(Array.isArray(messages)).toBe(true);
			expect(messages.length).toBe(1);
			expect(path.isAbsolute(messages[0].location.file)).toBe(true);
			expect(messages[0].location.file).toBe(editor.getPath());
		});

		it('records the excerpt within lint messages', async () => {
			const editor = await atom.workspace.open(onePath);
			expect(editor.isEmpty()).toBe(false);
			const messages = await provideLinter(currLintToolName).lint(editor);
			expect(Array.isArray(messages)).toBe(true);
			expect(messages.length).toBe(1);
			expect(messages[0].excerpt.length).not.toBe(0);
		});

		if (['pylint'].includes(currLintToolName)) {
			it('records the url within lint messages', async () => {
				const editor = await atom.workspace.open(onePath);
				expect(editor.isEmpty()).toBe(false);
				const messages = await provideLinter(currLintToolName).lint(editor);
				expect(Array.isArray(messages)).toBe(true);
				expect(messages.length).toBe(1);
				expect(messages[0].url.length).not.toBe(0);
			});
		}
	});
}
