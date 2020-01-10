'use strict';

function isLintsOnChange(lintTrigger) {
	return ['Never', 'LintAsYouType'].includes(lintTrigger);
}

// Those settings should be accessed in readonly mode, they are kept in sync with the atom settings by the lib/main.js which is the only allowed 'writer'.

const internalSettings = {}; // Object holding all current settings value (use getS/setS to read/write settings value).

const packageName = 'python-linters';

const settingCategoryPath = 'path';
const settingCategoryLintTrigger = 'lintTrigger';

// Settings Id/path (To be use with getS/setS)
const sPythonPath = [packageName, settingCategoryPath, 'python'].join('.');
const sPythonExecutable = [packageName, settingCategoryPath, 'pythonExecutable'].join('.');
const sConfig = [packageName, settingCategoryPath, 'config'].join('.');

const sLintTriggerFlake8 = [packageName, settingCategoryLintTrigger, 'flake8'].join('.');
const sLintTriggerMypy = [packageName, settingCategoryLintTrigger, 'mypy'].join('.');
const sLintTriggerPydocstyle = [packageName, settingCategoryLintTrigger, 'pydocstyle'].join('.');
const sLintTriggerPylint = [packageName, settingCategoryLintTrigger, 'pylint'].join('.');

function getS(s) {
	switch (s) {
		case sPythonPath:
		case sPythonExecutable:
		case sConfig:
		case sLintTriggerFlake8:
		case sLintTriggerMypy:
		case sLintTriggerPydocstyle:
		case sLintTriggerPylint:
			break;
		default:
			throw s;
	}

	return internalSettings[s];
}

function setS(s, value) {
	// Should only be called from lib/main.js
	switch (s) {
		case sPythonPath:
		case sPythonExecutable:
		case sConfig:
			value = String(value);
			break;
		case sLintTriggerFlake8:
		case sLintTriggerMypy:
		case sLintTriggerPydocstyle:
		case sLintTriggerPylint:
			if (!['LintAsYouType', 'LintOnFileSave', 'Never'].includes(value)) {
				throw new Error(value);
			}

			break;
		default:
			throw new Error(s);
	}

	internalSettings[s] = value;
}

/* eslint-disable prefer-const */
let rawTempFolderPath = ''; // Temp folder to be use if a temp folder is needed, its lifecycle creation/deletion is handled by the lib/main.js.
/* eslint-enable prefer-const */

module.exports = {getS, setS, rawTempFolderPath, sPythonPath, sPythonExecutable, sConfig, sLintTriggerFlake8, sLintTriggerMypy, sLintTriggerPydocstyle, sLintTriggerPylint, isLintsOnChange};
