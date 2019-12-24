const path = require('path');
const helpers = require('atom-linter'); // https://github.com/steelbrain/atom-linter
const NamedRegexp = require('named-js-regexp');

function provideLinter() {
	// Declare regex which extract information about the lint details.
	const regexLineFlake8 = new NamedRegexp('^(?<file>([A-Z]\\:)?[^:]+)\\:(?<line>\\d+)\\:(?:(?<col>\\d+)\\:)?\\ (?<message>.+)$');

	return {
		name: 'python-linter',
		scope: 'file',
		lintsOnChange: true,
		grammarScopes: ['source.python'],
		lint(textEditor) {
			const editorPath = textEditor.getPath();
			const filesystemPath = path.parse(editorPath).root;

			// Do lint.

			// Severity [info, warning, error]
			const result = []; // To hold a list of linter messages: https://steelbrain.me/linter/types/linter-message-v2.html

			const lintFlake8 = new Promise((resolve, reject) => {
			});
			const lintMypy = new Promise((resolve, reject) => {
			});
			const lintPylint = new Promise((resolve, reject) => {
			});
			const lintPydocstyle = new Promise((resolve, reject) => {
			});

			const lintTool = [lintFlake8, lintMypy, lintPylint, lintPydocstyle];

			return Promise.all(lintTool).then(new Promise((resolve, reject) => {
				resolve(result);
			}));

			const executablePath = 'python3';
			const params = ['-m', 'flake8', '--config', '/home/administrateur/Workspace/pyrite/setup.cfg', '--stdin-display-name', editorPath, '-'];
			const options = {
				stream: 'both',
				stdin: textEditor.getText(),
				ignoreExitCode: true,
				cwd: filesystemPath,
				env: Object.create(process.env),
				timeout: Infinity};

			helpers.exec(executablePath, params, options).then(({stdout, stderr, exitCode}) => {
				window.alert(stdout);
				window.alert(stderr);

				// Each line of the output may be a potential lint message so we create an array of string containing each line of the output.
				// We split the text using the new line as a separator and handle any OS kind of new lines.
				const lines = stdout.split(/\r\n|\r|\n/g);
				lines.forEach(line => {
					const currParsedMessage = regexLineFlake8.execGroups(line);
					if (currParsedMessage) {
						if (editorPath !== currParsedMessage.file) {
							return; // Ignore this line since it is not related to current text editor file.
						}

						result.push({
							severity: 'error',
							location: {
								file: editorPath,
								position: [[currParsedMessage.line, currParsedMessage.col], [currParsedMessage.line, currParsedMessage.col + 1]]
							},
							excerpt: currParsedMessage.message,
							description: '### Hi.',
							url: '',
							solutions: []
						});
					}
				});
			});

			return new Promise(resolve => {
				resolve(result);
			});
		}
	};
}

module.exports.provideLinter = provideLinter;
