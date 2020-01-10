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
function provideLinter(moduleName = '') {
	// Auto-magically called by the package linter, see package.json -> "providedServices.linter"
	if (!lintProvider) {
		lintProvider = fetchLint().provideLinter();
	}

	for (const currentLintProvider of lintProvider) {
		if ('python-linters ' + moduleName === currentLintProvider.name) {
			return currentLintProvider;
		}
	}

	// Return all lint provider.
	return lintProvider;
}

module.exports = {
	// Linter extension related:
	provideLinter,

	// Atom package related:
	config: packageConfig,
	activate() {
		fetchSettings().rawTempFolderPath = fetchPromiseCreator().createTempFolderSync(); // Create a temp folder
		require('atom-package-deps').install('python-linters'); // Make sure that every required package are installed.

		if (Disposable.isDisposable(this.disposables)) {
			// Strangely need to clean-up mess left behind
			this.disposables.dispose();
		}

		this.disposables = new CompositeDisposable();

		// Keep the settings in sync with the atom settings.
		[fetchSettings().sPythonPath, fetchSettings().sPythonExecutable, fetchSettings().sConfig, fetchSettings().sLintTriggerFlake8, fetchSettings().sLintTriggerMypy, fetchSettings().sLintTriggerPydocstyle, fetchSettings().sLintTriggerPylint].forEach(s => {
			this.disposables.add(atom.config.observe(s, value => {
				fetchSettings().setS(s, value);
				if (false) {
					// Keep the provided provider in sync with the atom settings
				} else if (s === fetchSettings().sLintTriggerFlake8) {
					provideLinter('flake8').lintsOnChange = fetchSettings().isLintsOnChange(fetchSettings().getS(s));
				} else if (s === fetchSettings().sLintTriggerMypy) {
					provideLinter('mypy').lintsOnChange = fetchSettings().isLintsOnChange(fetchSettings().getS(s));
				} else if (s === fetchSettings().sLintTriggerPydocstyle) {
					provideLinter('pydocstyle').lintsOnChange = fetchSettings().isLintsOnChange(fetchSettings().getS(s));
				} else if (s === fetchSettings().sLintTriggerPylint) {
					provideLinter('pylint').lintsOnChange = fetchSettings().isLintsOnChange(fetchSettings().getS(s));
				}
			}));
		});
	},

	deactivate() {
		if (Disposable.isDisposable(this.disposables)) {
			this.disposables.dispose();
			this.disposables = null;
			lintProvider = null;
		}

		// Delete any temp stuff written to disk.
		fetchPromiseCreator().removeFromDisk(fetchSettings().rawTempFolderPath);
		fetchSettings().rawTempFolderPath = null;

		// Unload modules
		lint = null;
		settings = null;
		promiseCreator = null;
	},
	serialize() {
		return {};
	}
};
