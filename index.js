'use strict';

const {CompositeDisposable, Disposable} = require('atom');

// Lazy-loaded modules
let lint;

lint = require('./lib/lint.js');

function provideLinter() { // eslint-disable-line no-unused-vars
	// Auto-magically called by the package linter, see package.json -> "providedServices.linter"
	if (!lint) {
		lint = require('./lib/lint.js');
	}

	return lint.provideLinter();
}

module.exports = {
	disposables: null,

	// Activate package and register commands and event listeners
	activate() {
		if (Disposable.isDisposable(this.disposables)) {
			this.disposables.dispose();
		}

		require('atom-package-deps').install('python-linter');

		this.disposables = new CompositeDisposable(
			new Disposable(() => {
			})
		);
	},
	deactivate() {
		if (Disposable.isDisposable(this.disposables)) {
			this.disposables.dispose();
			this.disposables = null;
		}
	},

	provideLinter() {
		if (!lint) {
			lint = require('./lib/lint.js');
		}

		return lint.provideLinter();
	}
};
