'use strict';

module.exports = {
	bail: !AtomMocha.headless,
	require: [
		'chai/register-should'
	],
	slow: 1500,
	specPattern: /[\\\/].+-spec\.js$/i,
	timeout: 60000
};
