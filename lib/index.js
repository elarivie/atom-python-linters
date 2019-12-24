'use strict';

const {CompositeDisposable, Disposable} = require('atom');
const packageConfig = require('./config-schema.json');

// Lazy-loaded modules
let lint;
let settings;
let promiseCreator;

function fetchLint() {
	if (!lint) {
		lint = require('./lint.js');
	}

	return lint;
}

function fetchSettings() {
	if (!settings) {
		settings = require('./settings.js');
	}

	return settings;
}

function fetchPromiseCreator() {
	if (!promiseCreator) {
		promiseCreator = require('./promises-creator.js');
	}

	return promiseCreator;
}

let lintProvider;
function provideLinter() {
	// Auto-magically called by the package linter, see package.json -> "providedServices.linter"
	if (!lintProvider) {
		lintProvider = fetchLint().provideLinter();
	}

	return lintProvider;
}

module.exports = {
	config: packageConfig,
	provideLinter,

	// Activate package and register commands and event listeners
	activate() {
		require('atom-package-deps').install('python-linters'); // Make sure that every required package are installed.

		if (Disposable.isDisposable(this.disposables)) {
			// Strangely need to clean-up mess left behind
			this.disposables.dispose();
		}

		this.disposables = new CompositeDisposable();

		// Create a temp folder
		fetchPromiseCreator().createTempFolder().then(tempPath => {
			fetchSettings().rawTempFolderPath = tempPath;
		});

		// Keep the settings in sync with the atom settings.

		// LintTrigger
		this.disposables.add(atom.config.observe('python-linters.lintTrigger', value => {
			fetchSettings().rawLintTrigger = value;
			provideLinter().lintsOnChange = 'LintAsYouType' === value;
		}));

		// PythonExecutablePath
		this.disposables.add(atom.config.observe('python-linters.pythonExecutablePath', value => {
			fetchSettings().rawPythonExecutablePath = value;
		}));

		// PythonPath
		this.disposables.add(atom.config.observe('python-linters.pythonPath', value => {
			fetchSettings().rawPythonPath = value;
		}));

		// ConfigPath
		this.disposables.add(atom.config.observe('python-linters.configPath', value => {
			fetchSettings().rawConfigPath = value;
		}));

		// Use Flake8
		this.disposables.add(atom.config.observe('python-linters.useLintTool.flake8', value => {
			fetchSettings().rawLintWithFlake8 = value;
		}));

		// Use Mypy
		this.disposables.add(atom.config.observe('python-linters.useLintTool.mypy', value => {
			fetchSettings().rawLintWithMypy = value;
		}));

		// Use Pydocstyle
		this.disposables.add(atom.config.observe('python-linters.useLintTool.pydocstyle', value => {
			fetchSettings().rawLintWithPydocstyle = value;
		}));

		// Use Pylint
		this.disposables.add(atom.config.observe('python-linters.useLintTool.pylint', value => {
			fetchSettings().rawLintWithPylint = value;
		}));
	},

	deactivate() {
		if (Disposable.isDisposable(this.disposables)) {
			this.disposables.dispose();
			this.disposables = null;
			lint.provider = null;
		}

		// Delete any temp stuff written to disk.
		fetchPromiseCreator().removeFromDisk(fetchSettings().rawTempFolderPath).then(tempPath => {
			fetchSettings().rawTempFolderPath = null;
		});

		// Unload modules
		lint = null;
		settings = null;
		promiseCreator = null;
	},

	serialize() {
		return {};
	}
};
