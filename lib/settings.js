'use strict';

// Those settings should be accessed in readonly mode, they are kept in sync with the atom settings by the index.js

/* eslint-disable prefer-const */
let rawlintTrigger = ''; //

let rawPythonExecutablePath = '';
let rawPythonPath = '';
let rawConfigPath = '';

let rawLintWithFlake8 = true;
let rawLintWithMypy = true;
let rawLintWithPydocstyle = true;
let rawLintWithPylint = true;

let rawTempFolderPath = ''; // Temp folder to be use if a temp folder is needed, its creation/deletion is handled by the index.js.
/* eslint-enable prefer-const */

module.exports = {rawlintTrigger, rawPythonExecutablePath, rawPythonPath, rawConfigPath, rawLintWithFlake8, rawLintWithMypy, rawLintWithPydocstyle, rawLintWithPylint, rawTempFolderPath};
